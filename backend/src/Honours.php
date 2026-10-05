<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ArrayParameterType;

/**
 * Town Honours (docs/honours.md). The saved block is the owner's presentation and
 * history: the server bounds it like normalizeHonours() and never revokes an earned
 * honour. Visitors only see what the server verifies itself, with the rank measures
 * exported from src/data/honours.js: the replayed records, town and powers, the
 * counters the integrity replay credits (SaveIntegrity) and its own count of visits.
 * The client's counts are never evidence.
 */
final class Honours
{
    private const ID = '/^[a-z][a-z0-9-]{0,47}$/D';
    /** Counter keys, as KEY in honours.js: gem types, mine elements and fusions ('bomb+cross'). */
    private const COUNT_KEY = '/^[a-zA-Z][\w+-]{0,39}$/D';
    private const EVIDENCE_KEY = '/^[a-zA-Z0-9_]{1,24}$/D';
    /** Storage bounds. Catalog honours are always kept; these cap everything else. */
    private const UNKNOWN_EARNED = 32;
    private const EVIDENCE_KEYS = 8;
    private const COUNT_KEYS = 64;
    private const VERIFIED = 256;
    private const MAX = 9007199254740991;
    /** The counters the integrity replay credits and keeps in the checkpoint context. */
    public const REPLAYED = [
        'gems' => 'map',
        'mine' => 'map',
        'fusions' => 'map',
        'forge' => 'number',
        'guardian' => 'number',
    ];
    /** The town's incident, BANDIT_EVENT in src/data/town.js. */
    private const INCIDENT = 'dusty-trail-visitors';
    /**
     * Different signed-in players who visited a town, each account once. The owner's own
     * signed-in visits are never recorded; signed-out visits carry neither a display name
     * nor a home town and stay in the guestbook only. `%s` is `id` or `public_id`.
     */
    private const SIGNED_IN_VISITOR = "(v.origin_town_id IS NOT NULL OR v.name <> '')";
    public const VISITORS =
        'SELECT COUNT(DISTINCT v.visitor_key) FROM visitor_visits v JOIN towns t ON t.id=v.town_id WHERE t.%s=? AND ' .
        self::SIGNED_IN_VISITOR;
    /**
     * Different other players' villages visited from a town (its home-town visits), each
     * village once. Visits to the owner's own towns never count; a host that is later
     * unshared or deleted still counts while its visits are kept. `%s` is the visiting
     * town's `id` or `public_id`.
     */
    public const TRAVELS = 'SELECT COUNT(DISTINCT v.town_id) FROM visitor_visits v JOIN towns h ON h.id=v.town_id JOIN towns o ON o.id=v.origin_town_id WHERE o.%s=? AND h.player_id <> o.player_id';

    private ?SaveIntegrity $integrity = null;

    /**
     * @param array<string, mixed> $catalog The `honours` block of public-schema.json.
     * @param (\Closure(): SaveIntegrity)|null $rules Loads the shared accounting catalog
     *     (star targets, era order) when a measure needs it.
     */
    public function __construct(private array $catalog = [], private ?\Closure $rules = null) {}

    /** @param (\Closure(): SaveIntegrity)|null $rules */
    public static function load(?\Closure $rules = null): self
    {
        $path = dirname(__DIR__) . '/content/public-schema.json';
        $schema = is_file($path)
            ? json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR)
            : [];
        return new self(is_array($schema['honours'] ?? null) ? $schema['honours'] : [], $rules);
    }

    /**
     * The server's own social counts for one town, by its `id` or `public_id`: `visitors`
     * and `travels`, the counters of the `social` measure. Other counters count nothing.
     *
     * @return \Closure(string): int
     */
    public static function social(Connection $db, string $column, string $town): \Closure
    {
        return fn(string $counter): int => match ($counter) {
            'visitors' => (int) $db->fetchOne(sprintf(self::VISITORS, $column), [$town]),
            'travels' => (int) $db->fetchOne(sprintf(self::TRAVELS, $column), [$town]),
            default => 0,
        };
    }

    /**
     * @param list<string> $towns
     * @return array<string, int>
     */
    public static function visitorCounts(Connection $db, array $towns): array
    {
        if ($towns === []) {
            return [];
        }
        $counts = array_fill_keys($towns, 0);
        foreach (
            $db->fetchAllAssociative(
                'SELECT v.town_id,COUNT(DISTINCT v.visitor_key) AS visitors FROM visitor_visits v WHERE v.town_id IN (?) AND ' .
                    self::SIGNED_IN_VISITOR .
                    ' GROUP BY v.town_id',
                [$towns],
                [ArrayParameterType::STRING],
            )
            as $row
        ) {
            $counts[$row['town_id']] = (int) $row['visitors'];
        }
        return $counts;
    }

    /**
     * Stores the honours block of an accepted (or restored) profile: the merged block,
     * the counts the server knows and the verified ranks. `verified` is server-owned: the
     * previous stored list plus every rank the accepted state proves now. It never comes
     * from an upload and never loses an ID, so a content change, a raised star target or
     * an older restored snapshot cannot un-verify. The integrity seal is unchanged
     * because honours are outside the signed state; a garbage block is dropped.
     *
     * @param (\Closure(string): int)|null $social The server's social counts (social()).
     */
    public function keep(object $accepted, ?object $previous, ?\Closure $social = null): object
    {
        $merged = $this->merge($previous->honours ?? null, $accepted->honours ?? null);
        if ($merged === null) {
            unset($accepted->honours);
            return $accepted;
        }
        $state = $this->state($accepted, $social);
        if ($state !== null) {
            // Other devices pulling this copy get the true counts: the replayed counters
            // replace the client's, and social counts never fall below the server's.
            foreach ($this->counters() as $counter => $shape) {
                if (isset(self::REPLAYED[$counter])) {
                    $merged['counts'][$counter] = $state['counts'][$counter];
                } elseif ($shape === 'number' && $state['social'] !== null) {
                    $merged['counts'][$counter] = max(
                        $merged['counts'][$counter],
                        $state['social']($counter),
                    );
                }
            }
        }
        $verified = array_flip($merged['verified']);
        foreach ($this->definitions() as $id => $definition) {
            if (!isset($verified[$id]) && $this->proves($definition, $state)) {
                $merged['verified'][] = $id;
            }
        }
        $accepted->honours = $this->encode($merged);
        return $accepted;
    }

    /**
     * Two copies of the same town, as mergeHonours(): earned honours are unioned with the
     * earliest known date and either copy's seen/announced flags, counts take the larger
     * value (never the sum), and generations the later one, so retries and restores
     * cannot double-count or revoke. The incoming copy chooses the showcase; `verified`
     * only ever comes from the previous (stored) copy. Null when neither copy has an
     * honours object.
     *
     * @return array<string, mixed>|null
     */
    public function merge(mixed $previous, mixed $incoming): ?array
    {
        $a = $this->sanitize($previous);
        $b = $this->sanitize($incoming);
        if ($b !== null) {
            $b['verified'] = [];
        }
        if ($a === null || $b === null) {
            return $a ?? $b;
        }
        $earned = $a['earned'];
        foreach ($b['earned'] as $id => $y) {
            $x = $earned[$id] ?? null;
            if ($x === null) {
                $earned[$id] = $y;
                continue;
            }
            $first = $x['at'] !== null && ($y['at'] === null || $x['at'] <= $y['at']) ? $x : $y;
            $first['seen'] = $x['seen'] || $y['seen'];
            $first['announced'] = $x['announced'] || $y['announced'];
            $earned[$id] = $first;
        }
        return [
            'version' => max($a['version'], $b['version']),
            'earned' => $this->bounded($earned),
            'counts' => self::maxCounts($a['counts'], $b['counts']),
            'showcase' => $b['showcase'],
            'backfilled' => max($a['backfilled'], $b['backfilled']),
            'seenGeneration' => max($a['seenGeneration'], $b['seenGeneration']),
            'verified' => $a['verified'],
        ];
    }

    /**
     * The saved block bounded like normalizeHonours(): malformed values are dropped,
     * unknown future honour IDs are kept (within a cap) and never displayed. Null when
     * the value is not an honours object.
     *
     * @return array<string, mixed>|null
     */
    public function sanitize(mixed $value): ?array
    {
        if (!($value instanceof \stdClass)) {
            return null;
        }
        $earned = [];
        if (($value->earned ?? null) instanceof \stdClass) {
            foreach (get_object_vars($value->earned) as $id => $entry) {
                if (preg_match(self::ID, (string) $id) && $entry instanceof \stdClass) {
                    $earned[(string) $id] = self::entry($entry);
                }
            }
        }
        return [
            'version' => self::positive($value->version ?? null) ?? 1,
            'earned' => $this->bounded($earned),
            'counts' => self::counts($value->counts ?? null, $this->counters()),
            'showcase' => self::ids($value->showcase ?? null, $this->slots()),
            'backfilled' => self::count($value->backfilled ?? null),
            // A save from before generations has seen the current one, as on the client.
            'seenGeneration' => property_exists($value, 'seenGeneration')
                ? self::count($value->seenGeneration)
                : $this->version(),
            'verified' => self::ids($value->verified ?? null, self::VERIFIED),
        ];
    }

    /**
     * The visitor copy, exactly the publicHonours() shape: the catalog honours the owner
     * earned that the server verified at an accepted save or proves now, with their
     * date, the server's best score run as score evidence, and the showcase of published
     * families. Unverifiable claims stay in the owner's save and are simply not
     * published. Never counts, progress or presentation flags. Null when the save has
     * no honours object.
     *
     * @param (\Closure(string): int)|null $social The server's social counts (social()).
     * @return array<string, mixed>|null
     */
    public function publish(object $profile, ?\Closure $social = null): ?array
    {
        $saved = $this->sanitize($profile->honours ?? null);
        if ($saved === null) {
            return null;
        }
        $definitions = $this->definitions();
        $verified = array_flip($saved['verified']);
        $state = null;
        $earned = new \stdClass();
        $families = [];
        foreach ($saved['earned'] as $id => $entry) {
            $definition = $definitions[$id] ?? null;
            if ($definition === null) {
                continue;
            }
            $state ??= $this->state($profile, $social);
            if (!isset($verified[$id]) && !$this->proves($definition, $state)) {
                continue;
            }
            $public = ['at' => $entry['at']];
            $best =
                $state !== null && ($definition['measure']['kind'] ?? null) === 'score'
                    ? $this->bestScore($state, $definition['measure'])
                    : null;
            if ($best !== null) {
                unset($best['ratio']);
                $public['evidence'] = (object) $best;
            }
            $earned->$id = (object) $public;
            $families[$definition['family']] = true;
        }
        return [
            'version' => $this->version(),
            'earned' => $earned,
            'showcase' => array_values(
                array_filter($saved['showcase'], fn($family) => isset($families[$family])),
            ),
        ];
    }

    /**
     * Counters bounded like normalizeCounts(): safe non-negative integers, and maps keyed
     * like KEY without zero counts. Reads decoded objects or arrays.
     *
     * @param array<string, string> $shapes Counter name => 'map' or 'number'.
     * @return array<string, mixed>
     */
    public static function counts(mixed $value, array $shapes = self::REPLAYED): array
    {
        $value = self::plain($value);
        $counts = [];
        foreach ($shapes as $name => $shape) {
            if ($shape === 'number') {
                $counts[$name] = self::count($value[$name] ?? null);
                continue;
            }
            $counts[$name] = [];
            foreach (self::plain($value[$name] ?? null) as $key => $count) {
                $count = self::count($count);
                if (
                    $count > 0 &&
                    preg_match(self::COUNT_KEY, (string) $key) &&
                    count($counts[$name]) < self::COUNT_KEYS
                ) {
                    $counts[$name][(string) $key] = $count;
                }
            }
        }
        return $counts;
    }

    /**
     * Two copies of the same counters: the larger of each, never the sum.
     *
     * @param array<string, mixed> $a
     * @param array<string, mixed> $b
     * @return array<string, mixed>
     */
    public static function maxCounts(array $a, array $b): array
    {
        foreach ($b as $name => $value) {
            if (!is_array($value)) {
                $a[$name] = max($a[$name] ?? 0, $value);
                continue;
            }
            foreach ($value as $key => $count) {
                $a[$name][$key] = max($a[$name][$key] ?? 0, $count);
            }
            $a[$name] = array_slice($a[$name], 0, self::COUNT_KEYS, true);
        }
        return $a;
    }

    /**
     * Adds to a replayed counter, or to one key of a map counter, capped at the safe
     * maximum like the client's add().
     *
     * @param array<string, mixed> $counts
     * @return array<string, mixed>
     */
    public static function credit(
        array $counts,
        string $counter,
        int $count = 1,
        ?string $key = null,
    ): array {
        if ($count > 0 && $key === null) {
            $counts[$counter] = min(self::MAX, $counts[$counter] + $count);
        } elseif ($count > 0) {
            $counts[$counter][$key] = min(self::MAX, ($counts[$counter][$key] ?? 0) + $count);
        }
        return $counts;
    }

    /**
     * Counters a town proves without its history, as seedCounts(): a saved forge
     * collection time is at least one collection, and a seen, fully protected incident
     * is at least one.
     *
     * @param array<string, mixed> $counts
     * @param array<string, mixed> $town
     * @return array<string, mixed>
     */
    public static function seed(array $counts, array $town): array
    {
        if (is_int($town['lastCollections']['blacksmith'] ?? null)) {
            $counts['forge'] = max($counts['forge'], 1);
        }
        $incident = $town['events'][self::INCIDENT] ?? null;
        if (($incident['seen'] ?? null) === true && self::protectedIncident($incident)) {
            $counts['guardian'] = max($counts['guardian'], 1);
        }
        return $counts;
    }

    /** An incident the town came through completely, as protectedIncident(). */
    public static function protectedIncident(mixed $event): bool
    {
        return is_array($event) &&
            ($event['outcome'] ?? null) === 'protected' &&
            ($event['loss'] ?? null) === 0;
    }

    /**
     * The counters as JSON, keeping empty maps as objects.
     *
     * @param array<string, mixed> $counts
     */
    public static function encodeCounts(array $counts): \stdClass
    {
        return (object) array_map(
            fn($value) => is_array($value) ? (object) $value : $value,
            $counts,
        );
    }

    /**
     * What the server verifies against: the accepted records, town and powers, the
     * counters the integrity replay credited and its own social counts (memoized). Null
     * for a save outside the integrity replay, whose whole state is the client's claim.
     *
     * @return array<string, mixed>|null
     */
    private function state(object $profile, ?\Closure $social): ?array
    {
        $integrity = $profile->integrity ?? null;
        if (!($integrity instanceof \stdClass) || ($integrity->version ?? null) !== 1) {
            return null;
        }
        $records = self::plain($profile->records ?? null);
        ksort($records, SORT_NUMERIC);
        $cache = [];
        return [
            'records' => $records,
            'town' => self::plain($profile->town ?? null),
            'powers' => self::plain($profile->powers ?? null),
            'counts' => self::counts($integrity->context->honours ?? null),
            'social' =>
                $social === null
                    ? null
                    : function (string $counter) use ($social, &$cache): int {
                        return $cache[$counter] ??= $social($counter);
                    },
        ];
    }

    /**
     * Whether the proof state reaches a rank's goal, as qualifies() in honours.js.
     *
     * @param array<string, mixed> $definition
     * @param array<string, mixed>|null $state
     */
    private function proves(array $definition, ?array $state): bool
    {
        $goal = $definition['goal'] ?? null;
        $value =
            $state !== null && self::number($goal)
                ? $this->value($definition['measure'] ?? null, $state)
                : null;
        return $value !== null && $value >= $goal;
    }

    /**
     * A measure's value over the proof state, as MEASURES in honours.js. Null for a
     * measure the server cannot evaluate, so its ranks never verify.
     *
     * @param array<string, mixed> $state
     */
    private function value(mixed $measure, array $state): int|float|null
    {
        if (!is_array($measure)) {
            return null;
        }
        $counter = is_string($measure['counter'] ?? null) ? $measure['counter'] : '';
        $counts = $state['counts'][$counter] ?? 0;
        $key = $measure['key'] ?? null;
        $threshold = $measure['quantity'] ?? null;
        return match ($measure['kind'] ?? null) {
            'stars' => count(
                array_filter($state['records'], fn($record) => ($record['stars'] ?? null) === 3),
            ),
            'score' => $this->bestScore($state, $measure)['ratio'] ?? 0,
            'era' => $this->rules()->eraStep($state['town']),
            // One counter, or the total of a counter map when no key is named.
            'count' => is_array($counts)
                ? (is_string($key)
                    ? $counts[$key] ?? 0
                    : array_sum($counts))
                : $counts,
            'distinct' => is_array($counts) && is_array($measure['keys'] ?? null)
                ? count(
                    array_filter(
                        $measure['keys'],
                        fn($id) => is_string($id) && ($counts[$id] ?? 0) > 0,
                    ),
                )
                : null,
            'powers' => self::number($threshold)
                ? count(
                    array_filter(
                        $state['powers'],
                        fn($power) => self::number($power['quantity'] ?? null) &&
                            $power['quantity'] >= $threshold,
                    ),
                )
                : null,
            'social' => $state['social'] === null ? null : $state['social']($counter),
            default => null,
        };
    }

    /**
     * The best completed normal puzzle from the measure's first level against its
     * current star score target, as bestScoreRun(). Continuous records never count; a
     * level without a positive target never does.
     *
     * @param array<string, mixed> $state
     * @param array<string, mixed> $measure
     * @return array{levelId: int, score: int|float, target: int|float, ratio: float}|null
     */
    private function bestScore(array $state, array $measure): ?array
    {
        $from = self::positive($measure['fromLevel'] ?? null);
        if ($from === null) {
            return null;
        }
        $best = null;
        foreach ($state['records'] as $id => $record) {
            $score = $record['score'] ?? null;
            if (!ctype_digit((string) $id) || (int) $id < $from || !self::number($score)) {
                continue;
            }
            $target = $this->rules()->starScoreTarget((int) $id);
            if ($target === null) {
                continue;
            }
            $ratio = $score / $target;
            if ($best === null || $ratio > $best['ratio']) {
                $best = ['levelId' => (int) $id, 'score' => $score, 'target' => $target];
                $best['ratio'] = (float) $ratio;
            }
        }
        return $best;
    }

    private function rules(): SaveIntegrity
    {
        return $this->integrity ??= $this->rules ? ($this->rules)() : new SaveIntegrity();
    }

    /** @return array<string, array<string, mixed>> Catalog rank definitions by ID. */
    private function definitions(): array
    {
        $definitions = is_array($this->catalog['definitions'] ?? null)
            ? $this->catalog['definitions']
            : [];
        return array_filter(
            $definitions,
            fn($definition) => is_array($definition) && is_string($definition['family'] ?? null),
        );
    }

    /** @return array<string, string> Counter name => 'map' or 'number', from the catalog. */
    private function counters(): array
    {
        $counters = is_array($this->catalog['counters'] ?? null) ? $this->catalog['counters'] : [];
        return array_filter($counters, fn($shape) => $shape === 'map' || $shape === 'number');
    }

    /** @return array<string, mixed> */
    private static function entry(\stdClass $entry): array
    {
        $result = [
            'at' => self::positive($entry->at ?? null),
            'version' => self::positive($entry->version ?? null) ?? 1,
        ];
        $evidence = [];
        if (($entry->evidence ?? null) instanceof \stdClass) {
            foreach (get_object_vars($entry->evidence) as $key => $value) {
                if (
                    count($evidence) < self::EVIDENCE_KEYS &&
                    preg_match(self::EVIDENCE_KEY, (string) $key) &&
                    (self::number($value, -INF) || (is_string($value) && mb_strlen($value) <= 40))
                ) {
                    $evidence[(string) $key] = $value;
                }
            }
        }
        if ($evidence) {
            $result['evidence'] = $evidence;
        }
        $result['seen'] = ($entry->seen ?? null) === true;
        $result['announced'] = ($entry->announced ?? null) === true;
        if (($entry->backfilled ?? null) === true) {
            $result['backfilled'] = true;
        }
        return $result;
    }

    /**
     * Every catalog honour, then at most UNKNOWN_EARNED future IDs in saved order.
     *
     * @param array<string, array<string, mixed>> $earned
     * @return array<string, array<string, mixed>>
     */
    private function bounded(array $earned): array
    {
        $known = $this->definitions();
        $unknown = 0;
        foreach (array_keys($earned) as $id) {
            if (!isset($known[$id]) && ++$unknown > self::UNKNOWN_EARNED) {
                unset($earned[$id]);
            }
        }
        return $earned;
    }

    /**
     * Distinct honour or family IDs in saved order, at most $limit.
     *
     * @return list<string>
     */
    private static function ids(mixed $value, int $limit): array
    {
        $ids = [];
        foreach (is_array($value) ? $value : [] as $id) {
            if (count($ids) >= $limit) {
                break;
            }
            if (is_string($id) && preg_match(self::ID, $id)) {
                $ids[$id] = true;
            }
        }
        return array_keys($ids);
    }

    private function slots(): int
    {
        return self::positive($this->catalog['showcaseSlots'] ?? null) ?? 3;
    }

    private function version(): int
    {
        return self::positive($this->catalog['version'] ?? null) ?? 1;
    }

    /**
     * A decoded object or array as a plain array; anything else is empty.
     *
     * @return array<int|string, mixed>
     */
    private static function plain(mixed $value): array
    {
        return is_array($value) || is_object($value)
            ? json_decode(json_encode($value, JSON_THROW_ON_ERROR), true, 64, JSON_THROW_ON_ERROR)
            : [];
    }

    /** A safe non-negative integer, as safeCount() in the client; anything else is zero. */
    private static function count(mixed $value): int
    {
        return is_int($value) && $value >= 0 && $value <= self::MAX ? $value : 0;
    }

    private static function positive(mixed $value): ?int
    {
        return is_int($value) && $value > 0 && $value <= self::MAX ? $value : null;
    }

    private static function number(mixed $value, float $min = 0): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min;
    }

    /** @param array<string, mixed> $honours */
    private function encode(array $honours): \stdClass
    {
        $earned = new \stdClass();
        foreach ($honours['earned'] as $id => $entry) {
            if (isset($entry['evidence'])) {
                $entry['evidence'] = (object) $entry['evidence'];
            }
            $earned->$id = (object) $entry;
        }
        return (object) [
            'version' => $honours['version'],
            'earned' => $earned,
            'counts' => self::encodeCounts($honours['counts']),
            'showcase' => $honours['showcase'],
            'backfilled' => $honours['backfilled'],
            'seenGeneration' => $honours['seenGeneration'],
            'verified' => $honours['verified'],
        ];
    }
}
