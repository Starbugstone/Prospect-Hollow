<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;

/**
 * TEMPORARY preprod test data (issue #60): shared towns with Town Honours, owned by
 * placeholder players, plus signed-in visits so visitor ranks can be proven. Every row it
 * creates is recognisable (placeholder e-mail domain, `fx` visit IDs), so `remove()` deletes
 * exactly that data and nothing else. It refuses to run outside preprod or a local machine.
 * Delete this class, bin/preprod-fixtures.php, content/preprod-fixtures.json and
 * scripts/create-preprod-fixtures.mjs once testing is over.
 */
final class PreprodFixtures
{
    public const EMAIL_DOMAIN = 'fixtures.prospect-hollow.invalid';
    private const VISIT_PREFIX = 'fx';
    private const GUESTS = [
        'Ada Mercer',
        'Bram Teller',
        'Cora Vance',
        'Dell Ashby',
        'Eli Brook',
        'Fay Linden',
        'Gus Marlow',
        'Hana Reed',
        'Ike Fallow',
        'Jo Pemberton',
        'Kit Warren',
        'Lena Moss',
        'Milo Crane',
        'Nora Hale',
        'Otto Finch',
        'Pia Rowan',
        'Quin Shaw',
        'Rory Dale',
        'Sela Brant',
        'Theo Lark',
    ];

    public function __construct(
        private Database $database,
        private PublicTown $public,
        private string $origin,
    ) {}

    /** Preprod (`preprod.` host) or a local machine; never production. */
    public static function allowed(string $origin): bool
    {
        $host = strtolower((string) parse_url($origin, PHP_URL_HOST));
        return str_starts_with($host, 'preprod.') ||
            in_array($host, ['localhost', '127.0.0.1'], true);
    }

    /** @return array{players: int, towns: int, visits: int} */
    public function status(): array
    {
        $db = $this->database->get();
        $email = '%@' . self::EMAIL_DOMAIN;
        return [
            'players' => (int) $db->fetchOne('SELECT COUNT(*) FROM players WHERE email LIKE ?', [
                $email,
            ]),
            'towns' => (int) $db->fetchOne(
                'SELECT COUNT(*) FROM towns t JOIN players p ON p.id=t.player_id WHERE p.email LIKE ?',
                [$email],
            ),
            'visits' => (int) $db->fetchOne('SELECT COUNT(*) FROM visitor_visits WHERE id LIKE ?', [
                self::VISIT_PREFIX . '%',
            ]),
        ];
    }

    /**
     * Deletes the placeholder players (their towns, profiles, favourites and history cascade)
     * and every fixture visit, including those added to real towns.
     *
     * @return array{players: int, towns: int, visits: int} What was removed.
     */
    public function remove(): array
    {
        $this->guard();
        $removed = $this->status();
        $this->database->get()->transactional(function (Connection $db): void {
            $db->executeStatement('DELETE FROM visitor_visits WHERE id LIKE ?', [
                self::VISIT_PREFIX . '%',
            ]);
            $db->executeStatement('DELETE FROM players WHERE email LIKE ?', [
                '%@' . self::EMAIL_DOMAIN,
            ]);
        });
        return $removed;
    }

    /**
     * Replaces any earlier fixtures with the ones in `$fixtures` (content/preprod-fixtures.json).
     * Each fixture town receives its own number of different signed-in visitors; each real shared
     * town in `$visit` (public IDs) is visited once by every fixture mayor.
     *
     * @param array{towns: list<array{key: string, name: string, mayor: string, visitors: int, profile: array<string, mixed>}>} $fixtures
     * @param list<string> $visit
     * @return list<array{name: string, publicId: string, visitors: int}>
     */
    public function seed(array $fixtures, array $visit = []): array
    {
        $this->remove();
        $now = time();
        $towns = [];
        foreach ($fixtures['towns'] as $index => $town) {
            [$name, $normalized] = $this->public->name($town['name']);
            $towns[] = [
                'player' => 'fixture-' . $town['key'],
                'email' => $town['key'] . '@' . self::EMAIL_DOMAIN,
                'mayor' => $town['mayor'],
                'id' => self::uuid('town:' . $town['key']),
                'publicId' => substr(hash('sha256', 'fixture-public:' . $town['key']), 0, 32),
                'name' => $name,
                'normalized' => $normalized,
                'era' => is_string($town['profile']['town']['era'] ?? null)
                    ? $town['profile']['town']['era']
                    : 'frontier',
                'visitors' => max(0, $town['visitors']),
                'profile' => json_encode($town['profile'], JSON_THROW_ON_ERROR),
                'savedAt' => $now - $index * 3600,
            ];
        }
        $this->database
            ->get()
            ->transactional(function (Connection $db) use ($towns, $visit, $now): void {
                foreach ($towns as $town) {
                    $db->insert('players', [
                        'id' => $town['player'],
                        'email' => $town['email'],
                        'created_at' => $now,
                    ]);
                    $db->insert('towns', [
                        'id' => $town['id'],
                        'player_id' => $town['player'],
                        'name' => $town['name'],
                        'normalized_name' => $town['normalized'],
                        'revision' => 1,
                        'profile' => $town['profile'],
                        'saved_at' => $town['savedAt'],
                        'public_id' => $town['publicId'],
                        'listed' => 1,
                        'appearance' => null,
                    ]);
                    $db->insert('player_profiles', [
                        'player_id' => $town['player'],
                        'display_name' => $town['mayor'],
                        'visiting_town_id' => $town['id'],
                    ]);
                }
                // Different signed-in visitors for each fixture town, some from other fixture towns.
                foreach ($towns as $index => $host) {
                    for ($guest = 0; $guest < $host['visitors']; $guest++) {
                        $from = $towns[($index + 1 + $guest) % count($towns)];
                        $local = $guest < count($towns) - 1;
                        $this->visit($db, $host['id'], [
                            'key' => 'fixture-guest:' . $guest,
                            'name' => self::GUESTS[$guest % count(self::GUESTS)],
                            'origin' => $local ? $from : null,
                            'era' => $local ? $from['era'] : $host['era'],
                            'at' => $now - ($guest + 1) * 5400,
                        ]);
                    }
                }
                // Real shared towns named on the command line: one visit from every fixture mayor.
                foreach ($visit as $publicId) {
                    $host = $db->fetchOne(
                        'SELECT id FROM towns WHERE public_id=? AND listed=1 AND deleted_at IS NULL',
                        [$publicId],
                    );
                    if (!is_string($host)) {
                        throw new \RuntimeException("No shared town with public ID {$publicId}.");
                    }
                    foreach ($towns as $index => $from) {
                        $this->visit($db, $host, [
                            'key' => 'fixture-mayor:' . $from['player'],
                            'name' => $from['mayor'],
                            'origin' => $from,
                            'era' => $from['era'],
                            'at' => $now - ($index + 1) * 2700,
                        ]);
                    }
                }
                // Appearances last, so the projection proves visitor ranks from the visits above.
                foreach ($towns as $town) {
                    $db->update(
                        'towns',
                        [
                            'appearance' => $this->public->projection(
                                json_decode($town['profile'], false, 64, JSON_THROW_ON_ERROR),
                                $town['name'],
                                $town['publicId'],
                            ),
                        ],
                        ['id' => $town['id']],
                    );
                }
            });
        return array_map(
            fn($town) => [
                'name' => $town['name'],
                'publicId' => $town['publicId'],
                'visitors' => $town['visitors'],
            ],
            $towns,
        );
    }

    private function guard(): void
    {
        if (!self::allowed($this->origin)) {
            throw new \RuntimeException(
                'Preprod fixtures only run on preprod or a local machine, never production.',
            );
        }
    }

    /**
     * @param array{key: string, name: string, origin: array{id: string, name: string}|null, era: string, at: int} $guest
     */
    private function visit(Connection $db, string $town, array $guest): void
    {
        $db->insert('visitor_visits', [
            'id' => self::VISIT_PREFIX . bin2hex(random_bytes(15)),
            'town_id' => $town,
            'visitor_key' => hash('sha256', $guest['key']),
            'name' => $guest['name'],
            'origin_town_id' => $guest['origin']['id'] ?? null,
            'town_name' => $guest['origin']['name'] ?? null,
            'era' => $guest['era'],
            'arrived_at' => $guest['at'],
            'last_seen_at' => $guest['at'] + 900,
            'departed_at' => $guest['at'] + 1200,
        ]);
    }

    private static function uuid(string $seed): string
    {
        $h = md5('prospect-hollow-fixture:' . $seed);
        return substr($h, 0, 8) .
            '-' .
            substr($h, 8, 4) .
            '-4' .
            substr($h, 13, 3) .
            '-8' .
            substr($h, 17, 3) .
            '-' .
            substr($h, 20, 12);
    }
}
