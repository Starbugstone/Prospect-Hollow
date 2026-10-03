<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\ArrayParameterType;
use Symfony\Component\HttpFoundation\Request;
final class PublicTown
{
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
        return json_encode(
            ['villageId' => $publicId, 'name' => $name, 'era' => $era, 'appearance' => $appearance],
            JSON_THROW_ON_ERROR,
        );
    }
    public const DRAW_SIZE = 7;
    public const ACTIVE_SECONDS = 14 * 86400;
    // Shared towns are dealt like a shuffled deck: the seed fixes one random order, and each
    // page is the next draw of seven, so refreshing never repeats a town until the deck runs
    // out. Every visitor gets their own seed, which spreads visits across all shared towns.
    // Towns saved in the last two weeks are dealt first; the visitor's own towns never are.
    public function browse(Request $r): array
    {
        $session = $this->auth->session($r);
        $page = filter_var($r->query->get('page', '1'), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 10000],
        ]);
        if (!$page) {
            throw new ApiError(422, 'Invalid page.');
        }
        $seed = $r->query->get('seed') ?? bin2hex(random_bytes(8));
        if (!preg_match('/^[a-f0-9]{16}$/D', $seed)) {
            throw new ApiError(422, 'Invalid seed.');
        }
        $db = $this->database->get();
        $now = time();
        $rows = $db->fetchAllAssociative(
            'SELECT t.id,t.public_id,t.name,t.appearance,s.collected_at FROM towns t LEFT JOIN saloon_collections s ON s.town_id=t.id WHERE t.listed=1 AND t.deleted_at IS NULL AND t.player_id<>? ORDER BY CASE WHEN t.saved_at>=? THEN 0 ELSE 1 END,MD5(CONCAT(t.public_id,CAST(? AS CHAR(16)))),t.public_id LIMIT ' .
                (self::DRAW_SIZE + 1) .
                ' OFFSET ' .
                ($page - 1) * self::DRAW_SIZE,
            [$session['player_id'], $now - self::ACTIVE_SECONDS, $seed],
        );
        $drawn = array_slice($rows, 0, self::DRAW_SIZE);
        // People walking around each town now, as the guestbook counts them.
        $present = $drawn
            ? array_column(
                $db->fetchAllAssociative(
                    'SELECT v.town_id,COUNT(DISTINCT v.id) AS present FROM visitor_visits v JOIN visitor_leases l ON l.visit_id=v.id WHERE v.town_id IN (?) AND v.departed_at IS NULL AND l.expires_at>? GROUP BY v.town_id',
                    [array_column($drawn, 'id'), $now],
                    [ArrayParameterType::STRING],
                ),
                'present',
                'town_id',
            )
            : [];
        return [
            'entries' => array_map(
                fn($row) => $this->card($row, (int) ($present[$row['id']] ?? 0), $now),
                $drawn,
            ),
            'seed' => $seed,
            'page' => $page,
            'hasNext' => count($rows) > self::DRAW_SIZE,
        ];
    }
    // A list card carries what helps choose a town, never the level records of a full visit.
    private function card(array $row, int $visitors, int $now): array
    {
        $appearance = json_decode($row['appearance'])->appearance ?? new \stdClass();
        $buildings = (array) ($appearance->buildings ?? []);
        return [
            'villageId' => $row['public_id'],
            'name' => $row['name'],
            'era' => $appearance->era ?? null,
            'buildings' => count(array_filter($buildings, fn($level) => $level > 0)),
            'mineLevel' => $appearance->mineLevel ?? null,
            'saloonReady' =>
                ($buildings['saloon'] ?? 0) > 0 &&
                $this->saloonReadyAt($row['collected_at']) <= $now,
            'visitors' => $visitors,
        ];
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
        // Older shared appearances predate level awards or completed runs. Project their saved progress
        // on read so visitors need not wait for the owner to connect and save again.
        if (
            !isset($village->appearance->levelRecords) ||
            !isset($village->appearance->completedRuns)
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
        return $village;
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
    private function saloonReadyAt(mixed $at): int
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
