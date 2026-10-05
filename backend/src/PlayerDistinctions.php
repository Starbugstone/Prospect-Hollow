<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;

/**
 * Player distinctions (docs/honours.md, "Player distinctions"): limited badges held by a
 * player's account rather than a town. The server alone decides who holds them; the game
 * only shows what it receives. Event distinctions are rows of player_distinctions,
 * granted to the players present at a key moment: Alpha Player by the version 16
 * migration, later ones with `php bin/admin.php award-distinction`. The time distinction
 * is computed here from players.created_at (the first sign-in) and the server clock with
 * the STEPS ladder, so it climbs on its own. A town shows at most one distinction in its
 * showcase, and visitors receive it only while its owner holds it. The catalog is
 * exported to public-schema.json.
 */
final class PlayerDistinctions
{
    public const PREFIX = 'player-';
    private const DAY_MS = 86400000;
    /**
     * The time distinction's ladder, in order. Each step counts whole units (days or
     * calendar months); the last step that reached one unit is shown, so the badge reads
     * 1–4 weeks, then 1–11 months, then 1, 2, 3… years, for good. A later step takes over
     * as soon as it reaches its first unit. A unit needs labels in the game
     * (TENURE_UNITS in src/data/playerDistinctions.js).
     */
    public const STEPS = [
        ['unit' => 'week', 'days' => 7],
        ['unit' => 'month', 'months' => 1],
        ['unit' => 'year', 'months' => 12],
    ];
    /** @var array<string, array<string, mixed>>|null */
    private static ?array $exported = null;

    /** @param array<string, mixed> $catalog ID => ['kind' => 'event'|'tenure']. */
    public function __construct(private array $catalog = []) {}

    /** The exported catalog (the `playerDistinctions` of the public schema's honours). */
    public static function load(): self
    {
        if (self::$exported === null) {
            $path = dirname(__DIR__) . '/content/public-schema.json';
            $schema = is_file($path)
                ? json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR)
                : [];
            $catalog = $schema['honours']['playerDistinctions'] ?? null;
            self::$exported = is_array($catalog) ? $catalog : [];
        }
        return new self(self::$exported);
    }

    public static function isDistinction(mixed $id): bool
    {
        return is_string($id) && str_starts_with($id, self::PREFIX);
    }

    public function kind(string $id): ?string
    {
        $kind = $this->catalog[$id]['kind'] ?? null;
        return is_string($kind) ? $kind : null;
    }

    /**
     * Every distinction the given players hold now, by player and ID: ['at' => ms] for an
     * event, plus `tenure` ['unit', 'count', 'next'] for the time distinction, where `at`
     * is when the current step was reached and `next` the following step.
     *
     * @param list<string> $players
     * @return array<string, array<string, array<string, mixed>>>
     */
    public function received(Connection $db, array $players, int $now): array
    {
        $players = array_values(array_unique($players));
        if ($players === []) {
            return [];
        }
        $received = array_fill_keys($players, []);
        foreach (
            $db->fetchAllAssociative(
                'SELECT player_id,distinction_id,awarded_at FROM player_distinctions WHERE player_id IN (?)',
                [$players],
                [ArrayParameterType::STRING],
            )
            as $row
        ) {
            if ($this->kind($row['distinction_id']) === 'event') {
                $received[$row['player_id']][$row['distinction_id']] = [
                    'at' => (int) $row['awarded_at'] * 1000,
                ];
            }
        }
        $timed = array_keys(
            array_filter(
                $this->catalog,
                fn($definition) => ($definition['kind'] ?? null) === 'tenure',
            ),
        );
        if ($timed !== []) {
            foreach (
                $db->fetchAllAssociative(
                    'SELECT id,created_at FROM players WHERE id IN (?)',
                    [$players],
                    [ArrayParameterType::STRING],
                )
                as $row
            ) {
                $step = self::tenure((int) $row['created_at'] * 1000, $now);
                foreach ($step === null ? [] : $timed as $id) {
                    $received[$row['id']][$id] = [
                        'at' => $step['at'],
                        'tenure' => [
                            'unit' => $step['unit'],
                            'count' => $step['count'],
                            'next' => $step['next'],
                        ],
                    ];
                }
            }
        }
        return $received;
    }

    /**
     * A public honours block (Honours::publish keeps at most one known distinction in its
     * showcase) for visitors: the distinction stays while the owner holds it and is
     * described as `distinction` {id, at, tenure? {unit, count}}; otherwise it leaves the
     * showcase. The owner's next time step stays private.
     *
     * @param array<string, array<string, mixed>> $received The owner's, from received().
     */
    public static function attach(\stdClass $honours, array $received): \stdClass
    {
        $showcase = [];
        $shown = null;
        foreach (is_array($honours->showcase ?? null) ? $honours->showcase : [] as $id) {
            if (!self::isDistinction($id)) {
                $showcase[] = $id;
            } elseif ($shown === null && isset($received[$id])) {
                $shown = $id;
                $showcase[] = $id;
            }
        }
        $honours->showcase = $showcase;
        unset($honours->distinction);
        if ($shown !== null) {
            $public = ['id' => $shown] + $received[$shown];
            unset($public['tenure']['next']);
            $honours->distinction = json_decode(json_encode($public, JSON_THROW_ON_ERROR));
        }
        return $honours;
    }

    /** Whether a public honours block shows a distinction, so its owner must be looked up. */
    public static function showcases(mixed $honours): bool
    {
        return $honours instanceof \stdClass &&
            is_array($honours->showcase ?? null) &&
            array_filter($honours->showcase, [self::class, 'isDistinction']) !== [];
    }

    /**
     * Grants an event distinction to every current player, or to one, who lacks it. Returns
     * how many players received it now; a player who already holds it keeps the first date.
     */
    public function award(Connection $db, string $id, ?string $player = null, ?int $at = null): int
    {
        if ($this->kind($id) !== 'event') {
            throw new \InvalidArgumentException("$id is not an event distinction.");
        }
        return $db->executeStatement(
            'INSERT INTO player_distinctions(player_id,distinction_id,awarded_at) SELECT p.id,?,? FROM players p WHERE NOT EXISTS (SELECT 1 FROM player_distinctions d WHERE d.player_id=p.id AND d.distinction_id=?)' .
                ($player === null ? '' : ' AND p.id=?'),
            [$id, $at ?? time(), $id, ...$player === null ? [] : [$player]],
        );
    }

    /**
     * The time distinction for a first sign-in at $since (ms) on a ladder of STEPS: the
     * last step with one whole unit, its count, when it was reached and the next step
     * {unit, count, at}. Null before the first unit of the first step.
     *
     * @param list<array{unit: string, days?: int, months?: int}> $steps
     * @return array{unit: string, count: int, at: int, next: array{unit: string, count: int, at: int}}|null
     */
    public static function tenure(int $since, int $now, array $steps = self::STEPS): ?array
    {
        if ($since <= 0 || $now < $since) {
            return null;
        }
        for ($index = count($steps) - 1; $index >= 0; $index--) {
            $step = $steps[$index];
            $count = isset($step['days'])
                ? intdiv($now - $since, $step['days'] * self::DAY_MS)
                : intdiv(self::fullMonths($since, $now), $step['months'] ?? 1);
            if ($count < 1) {
                continue;
            }
            // The next unit of this step, unless the following step reaches its first unit
            // as soon or sooner: four weeks lead to one month, eleven months to one year.
            $following = $steps[$index + 1] ?? null;
            $next = ['unit' => $step['unit'], 'count' => $count + 1];
            $next['at'] = self::stepAt($since, $step, $count + 1);
            if ($following !== null && self::stepAt($since, $following, 1) <= $next['at']) {
                $next = [
                    'unit' => $following['unit'],
                    'count' => 1,
                    'at' => self::stepAt($since, $following, 1),
                ];
            }
            return [
                'unit' => $step['unit'],
                'count' => $count,
                'at' => self::stepAt($since, $step, $count),
                'next' => $next,
            ];
        }
        return null;
    }

    /**
     * When $count units of a step are complete.
     *
     * @param array{unit: string, days?: int, months?: int} $step
     */
    private static function stepAt(int $since, array $step, int $count): int
    {
        return isset($step['days'])
            ? $since + $count * $step['days'] * self::DAY_MS
            : self::addMonths($since, $count * ($step['months'] ?? 1));
    }

    /** Calendar months in UTC; a day missing from the target month is its last day. */
    public static function addMonths(int $at, int $months): int
    {
        $seconds = intdiv($at, 1000);
        [$year, $month, $day, $hour, $minute, $second] = array_map(
            'intval',
            explode(' ', gmdate('Y n j G i s', $seconds)),
        );
        $first = gmmktime(0, 0, 0, $month + $months, 1, $year);
        return gmmktime(
            $hour,
            $minute,
            $second,
            (int) gmdate('n', $first),
            min($day, (int) gmdate('t', $first)),
            (int) gmdate('Y', $first),
        ) *
            1000 +
            ($at - $seconds * 1000);
    }

    private static function fullMonths(int $since, int $now): int
    {
        [$fromYear, $fromMonth] = array_map(
            'intval',
            explode(' ', gmdate('Y n', intdiv($since, 1000))),
        );
        [$toYear, $toMonth] = array_map('intval', explode(' ', gmdate('Y n', intdiv($now, 1000))));
        $months = ($toYear - $fromYear) * 12 + $toMonth - $fromMonth;
        if ($months > 0 && self::addMonths($since, $months) > $now) {
            $months--;
        }
        return max(0, $months);
    }
}
