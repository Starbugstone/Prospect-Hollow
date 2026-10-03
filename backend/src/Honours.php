<?php
declare(strict_types=1);
namespace App;

/**
 * Town Honours (docs/honours.md) are presentation and history, not money: they stay
 * outside the integrity replay and its signed checkpoint. The server bounds the saved
 * block like normalizeHonours(), never revokes an earned honour and publishes only the
 * visitor projection, recomputing the honours the saved records and town can prove.
 */
final class Honours
{
    private const ID = '/^[a-z][a-z0-9-]{0,47}$/D';
    private const COUNT_KEY = '/^[a-zA-Z][a-zA-Z0-9_-]{0,39}$/D';
    private const EVIDENCE_KEY = '/^[a-zA-Z0-9_]{1,24}$/D';
    private const FUSION = '/^[a-z]{1,24}\+[a-z]{1,24}$/D';
    /** Storage bounds. Catalog honours are always kept; these cap everything else. */
    private const UNKNOWN_EARNED = 32;
    private const EVIDENCE_KEYS = 8;
    private const COUNT_KEYS = 64;
    private const FUSIONS = 64;
    private const MAX = 9007199254740991;
    /**
     * Different signed-in players who visited a town, each account once. The owner's own
     * signed-in visits are never recorded; signed-out visits carry neither a display name
     * nor a home town and stay in the guestbook only. `%s` is `id` or `public_id`.
     */
    public const VISITORS = "SELECT COUNT(DISTINCT v.visitor_key) FROM visitor_visits v JOIN towns t ON t.id=v.town_id WHERE t.%s=? AND (v.origin_town_id IS NOT NULL OR v.name <> '')";

    /** @param array<string, mixed> $catalog The `honours` block of public-schema.json. */
    public function __construct(private array $catalog = []) {}

    public static function load(): self
    {
        $path = dirname(__DIR__) . '/content/public-schema.json';
        $schema = is_file($path)
            ? json_decode(file_get_contents($path), true, 32, JSON_THROW_ON_ERROR)
            : [];
        return new self(is_array($schema['honours'] ?? null) ? $schema['honours'] : []);
    }

    /**
     * Stores the merged block on an accepted (or restored) profile. Its integrity seal is
     * unchanged because honours are outside the signed state; a garbage block is dropped.
     */
    public function keep(object $accepted, ?object $previous): object
    {
        $merged = $this->merge($previous->honours ?? null, $accepted->honours ?? null);
        if ($merged === null) {
            unset($accepted->honours);
        } else {
            $accepted->honours = self::encode($merged);
        }
        return $accepted;
    }

    /**
     * Two copies of the same town, as mergeHonours(): earned honours are unioned with the
     * earliest known date and either copy's seen/announced flags, counts take the larger
     * value (never the sum) and fusions are unioned, so retries and restores cannot
     * double-count or revoke. The incoming copy chooses the showcase. Null when neither
     * copy has an honours object.
     *
     * @return array<string, mixed>|null
     */
    public function merge(mixed $previous, mixed $incoming): ?array
    {
        $a = $this->sanitize($previous);
        $b = $this->sanitize($incoming);
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
        $max = function (array $p, array $q): array {
            foreach ($q as $key => $count) {
                $p[$key] = max($p[$key] ?? 0, $count);
            }
            return array_slice($p, 0, self::COUNT_KEYS, true);
        };
        return [
            'version' => max($a['version'], $b['version']),
            'earned' => $this->bounded($earned),
            'counts' => [
                'gems' => $max($a['counts']['gems'], $b['counts']['gems']),
                'forge' => max($a['counts']['forge'], $b['counts']['forge']),
                'mine' => $max($a['counts']['mine'], $b['counts']['mine']),
                'visitors' => max($a['counts']['visitors'], $b['counts']['visitors']),
            ],
            'fusions' => array_slice(
                array_values(array_unique([...$a['fusions'], ...$b['fusions']])),
                0,
                self::FUSIONS,
            ),
            'showcase' => $b['showcase'],
            'backfilled' => max($a['backfilled'], $b['backfilled']),
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
        $fusions = [];
        foreach (is_array($value->fusions ?? null) ? $value->fusions : [] as $key) {
            if (count($fusions) >= self::FUSIONS) {
                break;
            }
            if (
                is_string($key) &&
                preg_match(self::FUSION, $key) &&
                !in_array($key, $fusions, true)
            ) {
                $fusions[] = $key;
            }
        }
        $showcase = [];
        foreach (is_array($value->showcase ?? null) ? $value->showcase : [] as $id) {
            if (count($showcase) >= $this->slots()) {
                break;
            }
            if (is_string($id) && preg_match(self::ID, $id) && !in_array($id, $showcase, true)) {
                $showcase[] = $id;
            }
        }
        return [
            'version' => self::positive($value->version ?? null) ?? 1,
            'earned' => $this->bounded($earned),
            'counts' => [
                'gems' => self::counts($value->counts->gems ?? null),
                'forge' => self::count($value->counts->forge ?? null),
                'mine' => self::counts($value->counts->mine ?? null),
                'visitors' => self::count($value->counts->visitors ?? null),
            ],
            'fusions' => $fusions,
            'showcase' => $showcase,
            'backfilled' => self::count($value->backfilled ?? null),
        ];
    }

    /**
     * The visitor copy, exactly the publicHonours() shape: catalog honours with their
     * date, score evidence and the showcase of published families. The honours below are
     * published only when the saved records or town prove them; every other honour is
     * the owner's claim. Never counts, fusions, progress or presentation flags. Null
     * when the save has no honours object.
     *
     * @param \Closure(): SaveIntegrity $rules Loads the shared accounting catalog when needed.
     * @return array<string, mixed>|null
     */
    public function publish(
        object $profile,
        int $levels,
        \Closure $rules,
        ?\Closure $visitors = null,
    ): ?array {
        $saved = $this->sanitize($profile->honours ?? null);
        if ($saved === null) {
            return null;
        }
        $definitions = is_array($this->catalog['definitions'] ?? null)
            ? $this->catalog['definitions']
            : [];
        $records =
            ($profile->records ?? null) instanceof \stdClass ? (array) $profile->records : [];
        $proven = [];
        $earned = new \stdClass();
        $families = [];
        foreach ($saved['earned'] as $id => $entry) {
            $definition = $definitions[$id] ?? null;
            if (!is_array($definition) || !is_string($definition['family'] ?? null)) {
                continue;
            }
            $evidence = [];
            $proof = $definition['proof'] ?? null;
            if ($proof !== null) {
                if (!is_string($proof)) {
                    continue;
                }
                if (!array_key_exists($proof, $proven)) {
                    $proven[$proof] = $this->prove(
                        $proof,
                        $profile,
                        $records,
                        $levels,
                        $rules,
                        $visitors,
                    );
                }
                $evidence = $proven[$proof];
                $multiple = $definition['multiple'] ?? null;
                $goal = self::positive($definition['goal'] ?? null);
                if (
                    $evidence === null ||
                    ($proof === 'visitors' && ($goal === null || $evidence['count'] < $goal)) ||
                    ($proof === 'score' &&
                        !(
                            self::number($multiple) &&
                            $multiple > 0 &&
                            $evidence['ratio'] >= $multiple
                        ))
                ) {
                    continue;
                }
            }
            $public = ['at' => $entry['at']];
            if ($definition['family'] === 'score' && isset($evidence['levelId'])) {
                $public['evidence'] = (object) [
                    'levelId' => $evidence['levelId'],
                    'score' => $evidence['score'],
                    'target' => $evidence['target'],
                ];
            }
            $earned->$id = (object) $public;
            $families[$definition['family']] = true;
        }
        return [
            'version' => self::positive($this->catalog['version'] ?? null) ?? 1,
            'earned' => $earned,
            'showcase' => array_values(
                array_filter($saved['showcase'], fn($family) => isset($families[$family])),
            ),
        ];
    }

    /**
     * Recomputes a provable honour from the saved records and town, or null. Score
     * evidence is the best ratio of a completed normal puzzle from the floor level to
     * its current star target, as bestScoreRun(); continuous records never count.
     *
     * @param array<int|string, mixed> $records
     * @param \Closure(): SaveIntegrity $rules
     * @return array<string, int|float>|null
     */
    private function prove(
        string $proof,
        object $profile,
        array $records,
        int $levels,
        \Closure $rules,
        ?\Closure $visitors,
    ): ?array {
        $stars = fn(int $id) => ($records[$id] ?? null) instanceof \stdClass
            ? $records[$id]->stars ?? null
            : null;
        if ($proof === 'any-perfect') {
            for ($id = 1; $id <= $levels; $id++) {
                if ($stars($id) === 3) {
                    return [];
                }
            }
            return null;
        }
        if ($proof === 'all-perfect') {
            for ($id = 1; $id <= $levels; $id++) {
                if ($stars($id) !== 3) {
                    return null;
                }
            }
            return $levels > 0 ? [] : null;
        }
        if ($proof === 'final-era') {
            $town = json_decode(json_encode($profile->town ?? null) ?: 'null', true);
            return is_array($town) &&
                is_string($this->catalog['finalEra'] ?? null) &&
                ($town['era'] ?? null) === $this->catalog['finalEra'] &&
                $rules()->eraComplete($town)
                ? []
                : null;
        }
        if ($proof === 'visitors') {
            return $visitors === null ? null : ['count' => (int) $visitors()];
        }
        if ($proof === 'score') {
            $from = self::positive($this->catalog['scoreFromLevel'] ?? null);
            if ($from === null) {
                return null;
            }
            $integrity = $rules();
            $best = null;
            for ($id = $from; $id <= $levels; $id++) {
                $score =
                    ($records[$id] ?? null) instanceof \stdClass
                        ? $records[$id]->score ?? null
                        : null;
                if (!self::number($score)) {
                    continue;
                }
                $target = $integrity->starScoreTarget($id);
                if ($target === null) {
                    continue;
                }
                $ratio = $score / $target;
                if ($best === null || $ratio > $best['ratio']) {
                    $best = [
                        'levelId' => $id,
                        'score' => $score,
                        'target' => $target,
                        'ratio' => $ratio,
                    ];
                }
            }
            return $best;
        }
        return null;
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
        $known = is_array($this->catalog['definitions'] ?? null)
            ? $this->catalog['definitions']
            : [];
        $unknown = 0;
        foreach (array_keys($earned) as $id) {
            if (!isset($known[$id]) && ++$unknown > self::UNKNOWN_EARNED) {
                unset($earned[$id]);
            }
        }
        return $earned;
    }

    private function slots(): int
    {
        return self::positive($this->catalog['showcaseSlots'] ?? null) ?? 3;
    }

    /** @return array<string, int> */
    private static function counts(mixed $value): array
    {
        $counts = [];
        if ($value instanceof \stdClass) {
            foreach (get_object_vars($value) as $key => $count) {
                $count = self::count($count);
                if (
                    $count > 0 &&
                    preg_match(self::COUNT_KEY, (string) $key) &&
                    count($counts) < self::COUNT_KEYS
                ) {
                    $counts[(string) $key] = $count;
                }
            }
        }
        return $counts;
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
    private static function encode(array $honours): \stdClass
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
            'counts' => (object) [
                'gems' => (object) $honours['counts']['gems'],
                'forge' => $honours['counts']['forge'],
                'mine' => (object) $honours['counts']['mine'],
                'visitors' => $honours['counts']['visitors'],
            ],
            'fusions' => $honours['fusions'],
            'showcase' => $honours['showcase'],
            'backfilled' => $honours['backfilled'],
        ];
    }
}
