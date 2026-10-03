<?php
declare(strict_types=1);
namespace App;
use Symfony\Component\HttpFoundation\Request;
final class PublicTown
{
    private ?SaveIntegrity $rules = null;
    public function __construct(
        private Database $database,
        private Auth $auth,
        private NameModeration $names = new NameModeration(),
    ) {}
    public function name(string $name): array
    {
        $name = \Normalizer::normalize(trim($name), \Normalizer::FORM_KC);
        $name = preg_replace('/ +/u', ' ', $name);
        if (!preg_match("/^[\\p{L}\\p{N}][\\p{L}\\p{M}\\p{N} '\x{2019}-]{2,23}$/uD", $name)) {
            throw new ApiError(
                422,
                'Use 3–24 letters, numbers, spaces, apostrophes or hyphens for the town name.',
            );
        }
        return [$name, transliterator_transliterate('Any-Lower', $name)];
    }
    public function moderate(string $name): void
    {
        if (!$this->names->allows($name)) {
            throw new ApiError(
                422,
                'This town name cannot be used publicly. Rename it before sharing.',
            );
        }
    }
    public function projection(object $profile, string $name, string $publicId): string
    {
        $schema = json_decode(
            file_get_contents(dirname(__DIR__) . '/content/public-schema.json'),
            true,
            32,
            JSON_THROW_ON_ERROR,
        );
        $town = $profile->town;
        $era = in_array($town->era, $schema['eras'], true) ? $town->era : $schema['eras'][0];
        $appearance = [
            'era' => $era,
            'buildings' => new \stdClass(),
            'buildingEras' => new \stdClass(),
            'buildingEraLevels' => new \stdClass(),
            'projects' => new \stdClass(),
        ];
        foreach ($schema['buildings'] as $id) {
            // Frontier landmarks such as the saloon reach level 5; levels within a later era stop at 3.
            foreach (
                ['buildings' => $schema['buildingLevels'][$id] ?? 3, 'buildingEraLevels' => 3]
                as $key => $max
            ) {
                $value = $town->$key->$id ?? 0;
                $appearance[$key]->$id = is_int($value) ? max(0, min($max, $value)) : 0;
            }
            $value = $town->buildingEras->$id ?? $era;
            $appearance['buildingEras']->$id = in_array($value, $schema['eras'], true)
                ? $value
                : $era;
        }
        // Completed puzzles pick the same space-helmet wearer for visitors as for the owner.
        $runs = $town->completedRuns ?? 0;
        $appearance['completedRuns'] = is_int($runs) ? max(0, $runs) : 0;
        // Like the owner's own mine sign: the first puzzle without a completion record.
        $records = (array) ($profile->records ?? []);
        $appearance['mineLevel'] = 1;
        while (
            $appearance['mineLevel'] < ($schema['levels'] ?? 1) &&
            isset($records[$appearance['mineLevel']])
        ) {
            $appearance['mineLevel']++;
        }
        // Share only authored level IDs and their earned stars, never the full save records.
        $appearance['levelRecords'] = new \stdClass();
        foreach ($records as $id => $record) {
            if (
                !ctype_digit((string) $id) ||
                (int) $id < 1 ||
                (int) $id > ($schema['levels'] ?? 1)
            ) {
                continue;
            }
            $stars = is_object($record) ? $record->stars ?? null : null;
            if (is_int($stars) && $stars >= 1 && $stars <= 3) {
                $appearance['levelRecords']->{(string) (int) $id} = (object) ['stars' => $stars];
            }
        }
        if (is_array($schema['honours'] ?? null)) {
            $appearance['honours'] = $this->honoursProjection($profile, $schema, $publicId);
        }
        return json_encode(
            ['villageId' => $publicId, 'name' => $name, 'era' => $era, 'appearance' => $appearance],
            JSON_THROW_ON_ERROR,
        );
    }
    // Town Honours: the publicHonours() shape with provable honours recomputed. A save
    // without honours is recorded as null, so visits know there is nothing to re-project.
    private function honoursProjection(object $profile, array $schema, string $publicId): ?array
    {
        return (new Honours($schema['honours']))->publish(
            $profile,
            is_int($schema['levels'] ?? null) ? $schema['levels'] : 0,
            fn() => ($this->rules ??= new SaveIntegrity()),
            fn() => (int) $this->database
                ->get()
                ->fetchOne(sprintf(Honours::VISITORS, 'public_id'), [$publicId]),
        );
    }
    // Visitors never receive that null: an absent field means "unknown", not "none".
    private static function published(object $village): object
    {
        if (
            ($village->appearance ?? null) instanceof \stdClass &&
            property_exists($village->appearance, 'honours') &&
            $village->appearance->honours === null
        ) {
            unset($village->appearance->honours);
        }
        return $village;
    }
    public const SALOON_REST = 3600;
    // A share link needs no account: anyone holding the unguessable public ID may see the
    // appearance projection. Browsing the full list still needs one. Live presence is
    // handled separately by VisitorService; viewing never queues an ordinary VIP.
    public function visit(Request $r, string $id, bool $arrival = true): object
    {
        $row = $this->database
            ->get()
            ->fetchAssociative(
                'SELECT t.id,t.player_id,t.appearance,s.collected_at FROM towns t LEFT JOIN saloon_collections s ON s.town_id=t.id WHERE t.public_id=? AND t.listed=1 AND t.deleted_at IS NULL',
                [$id],
            );
        if (!$row) {
            throw new ApiError(404, 'Town unavailable.');
        }
        $village = json_decode($row['appearance']);
        // Older shared appearances predate level awards, completed runs or honours. Project their saved
        // progress on read so visitors need not wait for the owner to connect and save again.
        if (
            !isset($village->appearance->levelRecords) ||
            !isset($village->appearance->completedRuns) ||
            !property_exists($village->appearance, 'honours')
        ) {
            $saved = $this->database
                ->get()
                ->fetchAssociative(
                    'SELECT profile,name,public_id FROM towns WHERE id=? AND listed=1 AND deleted_at IS NULL',
                    [$row['id']],
                );
            if (!$saved) {
                throw new ApiError(404, 'Town unavailable.');
            }
            $village = json_decode(
                $this->projection(
                    json_decode($saved['profile']),
                    $saved['name'],
                    $saved['public_id'],
                ),
            );
        }
        $village->saloonReadyAt = $this->saloonReadyAt($row['collected_at']);
        return self::published($village);
    }

    // Saloon: any visitor may collect it for the owner, at most once per hour per town.
    // Only the time is stored: the owner's game moves its own reserved coins, so no money
    // is created and several open tabs cannot collect twice.
    public function tapSaloon(Request $r, string $id): array
    {
        $this->auth->limit('saloon:' . ($r->getClientIp() ?? 'unknown'), 30, 3600);
        return $this->database->get()->transactional(function ($db) use ($id) {
            $row = $db->fetchAssociative(
                'SELECT id,appearance FROM towns WHERE public_id=? AND listed=1 AND deleted_at IS NULL FOR UPDATE',
                [$id],
            );
            if (!$row) {
                throw new ApiError(404, 'Town unavailable.');
            }
            if ((json_decode($row['appearance'])->appearance->buildings->saloon ?? 0) < 1) {
                throw new ApiError(409, 'This town has no saloon yet.', ['code' => 'no_saloon']);
            }
            $readyAt = $this->saloonReadyAt(
                $db->fetchOne('SELECT collected_at FROM saloon_collections WHERE town_id=?', [
                    $row['id'],
                ]),
            );
            if ($readyAt > time()) {
                throw new ApiError(
                    409,
                    'A visitor already collected this saloon. Come back later.',
                    ['code' => 'saloon_resting', 'readyAt' => $readyAt],
                );
            }
            $now = time();
            $this->upsert('saloon_collections', $row['id'], ['collected_at' => $now]);
            return ['readyAt' => $now + self::SALOON_REST];
        });
    }
    public static function saloonReadyAt(mixed $at): int
    {
        return $at === null || $at === false ? 0 : (int) $at + self::SALOON_REST;
    }

    // Guest names appear in another player's village: never a link or an email, only
    // letters, digits and single spaces, and they must pass the public-name moderation.
    public function guestName(string $name): ?string
    {
        $name = \Normalizer::normalize($name, \Normalizer::FORM_KC);
        if (preg_match('~@|://|\bwww\b|\.[a-z]{2,}\b~iu', $name)) {
            return null;
        }
        $clean = trim(
            preg_replace('/ +/u', ' ', preg_replace('/[^\p{L}\p{M}\p{N} ]+/u', '', $name)),
        );
        if (
            mb_strlen($clean) < 3 ||
            mb_strlen($clean) > 24 ||
            preg_match('~(^| )(https?|www)~iu', $clean)
        ) {
            return null;
        }
        try {
            $this->moderate($clean);
        } catch (ApiError) {
            return null;
        }
        return $clean;
    }
    private function upsert(string $table, string $town, array $values): void
    {
        $db = $this->database->get();
        if (!$db->update($table, $values, ['town_id' => $town])) {
            try {
                $db->insert($table, ['town_id' => $town] + $values);
            } catch (\Doctrine\DBAL\Exception\UniqueConstraintViolationException) {
                $db->update($table, $values, ['town_id' => $town]);
            }
        }
    }
}
