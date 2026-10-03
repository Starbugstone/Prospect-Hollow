<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\ArrayParameterType;

/** Admin views of players and towns, and the audited support and moderation actions. */
final class AdminService
{
    public const PAGE = 25;
    private ?array $eras = null;
    public function __construct(
        private Database $database,
        private AdminAuth $admins,
        private SaveService $saves,
        private PublicTown $public,
    ) {}

    private function eras(): array
    {
        return $this->eras ??= json_decode(
            file_get_contents(dirname(__DIR__) . '/content/public-schema.json'),
            true,
            32,
            JSON_THROW_ON_ERROR,
        )['eras'];
    }
    private static function decode(?string $json): mixed
    {
        try {
            return json_decode((string) $json, false, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
    }
    // Campaign progress read from a save. Gameplay rules stay in the client; these are counts.
    public static function stats(mixed $save): array
    {
        $records = is_object($save->records ?? null) ? get_object_vars($save->records) : [];
        $levels = 0;
        $stars = 0;
        $score = 0;
        $highest = 0;
        foreach ($records as $id => $record) {
            if (
                !is_object($record) ||
                !is_int($record->stars ?? null) ||
                $record->stars < 1 ||
                $record->stars > 3
            ) {
                continue;
            }
            $levels++;
            $stars += $record->stars;
            $highest = max($highest, (int) $id);
            if (is_int($record->score ?? null) || is_float($record->score ?? null)) {
                $score += max(0, $record->score);
            }
        }
        return SaveService::summary($save) + [
            'levels' => $levels,
            'stars' => $stars,
            'score' => (int) min($score, 9007199254740991),
            'highestLevel' => $highest,
        ];
    }
    private static function time(mixed $at): ?int
    {
        return $at === null ? null : (int) $at;
    }
    public static function page(array $query): int
    {
        $page = filter_var($query['page'] ?? '1', FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 100000],
        ]);
        if (!$page) {
            throw new ApiError(422, 'Invalid page.');
        }
        return $page;
    }
    private static function search(array $query): string
    {
        return mb_strtolower(trim((string) ($query['q'] ?? '')));
    }
    private static function like(string $text): string
    {
        return '%' . addcslashes($text, '%_\\') . '%';
    }
    private static function activity(array $row): array
    {
        return [
            'lastSeenAt' => self::time($row['seen_at']),
            'lastSignInAt' => self::time($row['signed_in_at']),
            'signIns' => (int) ($row['sign_ins'] ?? 0),
            'ip' => $row['ip'],
            'agent' => $row['agent'],
            'platform' => $row['platform'],
        ];
    }
    private static function town(array $row): array
    {
        return [
            'id' => $row['id'],
            'name' => $row['name'],
            'revision' => (int) $row['revision'],
            'savedAt' => (int) $row['saved_at'],
            'isPublic' => (bool) $row['listed'],
            'publicId' => $row['public_id'],
            'deletedAt' => self::time($row['deleted_at']),
        ] +
            (isset($row['email'])
                ? ['owner' => ['id' => $row['player_id'], 'email' => $row['email']]]
                : []) +
            (array_key_exists('profile', $row)
                ? ['stats' => self::stats(self::decode($row['profile']))]
                : []);
    }

    public function overview(): array
    {
        $db = $this->database->get();
        $now = time();
        $today = intdiv($now, 86400);
        $count = fn(string $sql, array $params = []) => (int) $db->fetchOne($sql, $params);
        $players = [
            'total' => $count('SELECT COUNT(*) FROM players'),
            'online' => $count('SELECT COUNT(*) FROM player_activity WHERE seen_at>=?', [
                $now - 300,
            ]),
            'signedIn' => $count(
                'SELECT COUNT(DISTINCT player_id) FROM sessions WHERE expires_at>?',
                [$now],
            ),
        ];
        foreach (['day' => 1, 'week' => 7, 'month' => 30] as $key => $days) {
            $players['new'][$key] = $count('SELECT COUNT(*) FROM players WHERE created_at>=?', [
                $now - $days * 86400,
            ]);
            $players['active'][$key] = $count(
                'SELECT COUNT(*) FROM player_activity WHERE seen_at>=?',
                [$now - $days * 86400],
            );
        }
        $players['platforms'] = [];
        foreach (
            $db->fetchAllAssociative(
                'SELECT platform,COUNT(*) AS n FROM player_activity WHERE seen_at>=? GROUP BY platform',
                [$now - 30 * 86400],
            )
            as $row
        ) {
            $players['platforms'][$row['platform'] ?? 'unknown'] = (int) $row['n'];
        }
        // Thirty UTC days, oldest first. Active days are recorded from this release onward.
        $daily = [];
        for ($day = $today - 29; $day <= $today; $day++) {
            $daily[$day] = ['day' => $day * 86400, 'signups' => 0, 'active' => 0];
        }
        foreach (
            $db->fetchFirstColumn('SELECT created_at FROM players WHERE created_at>=?', [
                ($today - 29) * 86400,
            ])
            as $at
        ) {
            if (isset($daily[($day = intdiv((int) $at, 86400))])) {
                $daily[$day]['signups']++;
            }
        }
        foreach (
            $db->fetchAllAssociative(
                'SELECT day,COUNT(*) AS n FROM activity_days WHERE day>=? GROUP BY day',
                [$today - 29],
            )
            as $row
        ) {
            if (isset($daily[(int) $row['day']])) {
                $daily[(int) $row['day']]['active'] = (int) $row['n'];
            }
        }
        $eras = array_fill_keys($this->eras(), 0);
        $levels = [];
        foreach (
            $db->iterateAssociative('SELECT profile FROM towns WHERE deleted_at IS NULL')
            as $row
        ) {
            $stats = self::stats(self::decode($row['profile']));
            $eras[$stats['era']] = ($eras[$stats['era']] ?? 0) + 1;
            $levels[] = $stats['levels'];
        }
        return [
            'players' => $players,
            'daily' => array_values($daily),
            'towns' => [
                'total' => count($levels),
                'public' => $count(
                    'SELECT COUNT(*) FROM towns WHERE listed=1 AND deleted_at IS NULL',
                ),
                'deleted' => $count('SELECT COUNT(*) FROM towns WHERE deleted_at IS NOT NULL'),
                'eras' => array_map(
                    fn($era, $towns) => ['era' => $era, 'towns' => $towns],
                    array_keys($eras),
                    $eras,
                ),
                'levels' => $levels,
            ],
        ];
    }

    public function players(array $query): array
    {
        $page = self::page($query);
        $q = self::search($query);
        $db = $this->database->get();
        $order = match ($query['sort'] ?? 'seen') {
            'seen' => '(a.seen_at IS NULL),a.seen_at DESC,p.id',
            'created' => 'p.created_at DESC,p.id',
            'email' => 'p.email,p.id',
            default => throw new ApiError(422, 'Invalid sort.'),
        };
        [$where, $params] =
            $q === '' ? ['1=1', []] : ['(p.email LIKE ? OR p.id=?)', [self::like($q), $q]];
        $total = (int) $db->fetchOne('SELECT COUNT(*) FROM players p WHERE ' . $where, $params);
        $rows = $db->fetchAllAssociative(
            'SELECT p.id,p.email,p.created_at,a.seen_at,a.signed_in_at,a.sign_ins,a.ip,a.agent,a.platform,(SELECT COUNT(*) FROM sessions s WHERE s.player_id=p.id AND s.expires_at>?) AS sessions FROM players p LEFT JOIN player_activity a ON a.player_id=p.id WHERE ' .
                $where .
                ' ORDER BY ' .
                $order .
                ' LIMIT ' .
                self::PAGE .
                ' OFFSET ' .
                ($page - 1) * self::PAGE,
            [time(), ...$params],
        );
        $towns = [];
        if ($rows) {
            foreach (
                $db->fetchAllAssociative(
                    'SELECT player_id,profile FROM towns WHERE deleted_at IS NULL AND player_id IN (?)',
                    [array_column($rows, 'id')],
                    [ArrayParameterType::STRING],
                )
                as $town
            ) {
                $towns[$town['player_id']][] = self::stats(self::decode($town['profile']));
            }
        }
        $rank = array_flip($this->eras());
        return [
            'total' => $total,
            'page' => $page,
            'pageSize' => self::PAGE,
            'players' => array_map(function ($row) use ($towns, $rank) {
                $owned = $towns[$row['id']] ?? [];
                usort($owned, fn($a, $b) => ($rank[$b['era']] ?? -1) <=> ($rank[$a['era']] ?? -1));
                return [
                    'id' => $row['id'],
                    'email' => $row['email'],
                    'createdAt' => (int) $row['created_at'],
                    'sessions' => (int) $row['sessions'],
                    'towns' => count($owned),
                    'bestEra' => $owned[0]['era'] ?? null,
                    'levels' => $owned ? max(array_column($owned, 'levels')) : 0,
                ] + self::activity($row);
            }, $rows),
        ];
    }
    private function playerRow(string $id): array
    {
        $row = $this->database
            ->get()
            ->fetchAssociative(
                'SELECT p.*,a.seen_at,a.signed_in_at,a.sign_ins,a.ip,a.agent,a.platform FROM players p LEFT JOIN player_activity a ON a.player_id=p.id WHERE p.id=?',
                [$id],
            );
        if (!$row) {
            throw new ApiError(404, 'No player has that ID.');
        }
        return $row;
    }
    public function player(string $id): array
    {
        $row = $this->playerRow($id);
        $db = $this->database->get();
        $now = time();
        return [
            'player' =>
                [
                    'id' => $row['id'],
                    'email' => $row['email'],
                    'createdAt' => (int) $row['created_at'],
                    'activeDays' => (int) $db->fetchOne(
                        'SELECT COUNT(*) FROM activity_days WHERE player_id=? AND day>?',
                        [$id, intdiv($now, 86400) - 30],
                    ),
                ] + self::activity($row),
            'sessions' => array_map(
                fn($s) => [
                    'createdAt' => (int) $s['created_at'],
                    'expiresAt' => (int) $s['expires_at'],
                ],
                $db->fetchAllAssociative(
                    'SELECT created_at,expires_at FROM sessions WHERE player_id=? AND expires_at>? ORDER BY created_at DESC',
                    [$id, $now],
                ),
            ),
            'towns' => array_map(
                fn($t) => self::town($t),
                $db->fetchAllAssociative(
                    'SELECT id,name,revision,saved_at,listed,public_id,deleted_at,profile FROM towns WHERE player_id=? ORDER BY (deleted_at IS NOT NULL),name,id',
                    [$id],
                ),
            ),
        ];
    }
    // Ends every device session and unused sign-in link; the player's saves are untouched.
    public function signOutPlayer(string $actor, string $id): array
    {
        return $this->database->get()->transactional(function ($db) use ($actor, $id) {
            $player = $db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE', [$id]);
            if (!$player) {
                throw new ApiError(404, 'No player has that ID.');
            }
            $sessions = $db->delete('sessions', ['player_id' => $id]);
            $db->delete('login_intents', ['email' => $player['email']]);
            $this->admins->audit($actor, 'player_signed_out', $id, $sessions . ' session(s)');
            return ['sessions' => $sessions];
        });
    }
    public function deletePlayer(string $actor, string $id, array $body): array
    {
        SaveService::keys($body, ['confirmation']);
        return $this->database->get()->transactional(function ($db) use ($actor, $id, $body) {
            $player = $db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE', [$id]);
            if (!$player) {
                throw new ApiError(404, 'No player has that ID.');
            }
            if (($body['confirmation'] ?? null) !== $player['email']) {
                throw new ApiError(422, 'Type the player’s email to confirm deletion.');
            }
            $db->delete('login_intents', ['email' => $player['email']]);
            $db->delete('players', ['id' => $id]);
            // The log keeps only the ID: the deleted email must not outlive the account.
            $this->admins->audit($actor, 'player_deleted', $id);
            return ['ok' => true];
        });
    }

    public function towns(array $query): array
    {
        $page = self::page($query);
        $q = self::search($query);
        $db = $this->database->get();
        $where = [
            match ($query['filter'] ?? 'live') {
                'live' => 't.deleted_at IS NULL',
                'public' => 't.listed=1 AND t.deleted_at IS NULL',
                'deleted' => 't.deleted_at IS NOT NULL',
                default => throw new ApiError(422, 'Invalid filter.'),
            },
        ];
        $params = [];
        if ($q !== '') {
            $where[] = '(LOWER(t.name) LIKE ? OR p.email LIKE ? OR t.id=? OR t.public_id=?)';
            array_push($params, self::like($q), self::like($q), $q, $q);
        }
        $from = 'FROM towns t JOIN players p ON p.id=t.player_id WHERE ' . implode(' AND ', $where);
        $total = (int) $db->fetchOne('SELECT COUNT(*) ' . $from, $params);
        $rows = $db->fetchAllAssociative(
            'SELECT t.id,t.name,t.player_id,p.email,t.revision,t.saved_at,t.listed,t.public_id,t.deleted_at,t.profile ' .
                $from .
                ' ORDER BY t.saved_at DESC,t.id LIMIT ' .
                self::PAGE .
                ' OFFSET ' .
                ($page - 1) * self::PAGE,
            $params,
        );
        return [
            'total' => $total,
            'page' => $page,
            'pageSize' => self::PAGE,
            'towns' => array_map(fn($row) => self::town($row), $rows),
        ];
    }
    public function townDetail(string $id): array
    {
        $db = $this->database->get();
        $row = $db->fetchAssociative(
            'SELECT t.*,p.email,s.collected_at AS saloon_at,g.name AS guest_name,g.visited_at AS guest_at FROM towns t JOIN players p ON p.id=t.player_id LEFT JOIN saloon_collections s ON s.town_id=t.id LEFT JOIN town_guests g ON g.town_id=t.id WHERE t.id=?',
            [$id],
        );
        if (!$row) {
            throw new ApiError(404, 'No town has that ID.');
        }
        $profile = self::decode($row['profile']);
        // The same appearance projection a share link renders, built even for private towns.
        try {
            $appearance = json_decode(
                $this->public->projection($profile, $row['name'], $row['public_id']),
            );
        } catch (\Throwable) {
            $appearance = null;
        }
        return [
            'town' => self::town($row) + [
                'saloonCollectedAt' => self::time($row['saloon_at']),
                'guest' =>
                    $row['guest_name'] === null
                        ? null
                        : ['name' => $row['guest_name'], 'at' => (int) $row['guest_at']],
            ],
            'appearance' => $appearance,
            'profile' => $profile,
            'history' => array_map(
                fn($h) => [
                    'revision' => (int) $h['revision'],
                    'savedAt' => (int) $h['saved_at'],
                    'stats' => self::stats(self::decode($h['profile'])),
                ],
                $db->fetchAllAssociative(
                    'SELECT revision,saved_at,profile FROM town_history WHERE town_id=? ORDER BY revision DESC',
                    [$id],
                ),
            ),
        ];
    }
    // Same lock order as the owner's saves: the account row, then the live town.
    private function locked(string $id, callable $change): array
    {
        return $this->database->get()->transactional(function ($db) use ($id, $change) {
            $owner = $db->fetchOne('SELECT player_id FROM towns WHERE id=?', [$id]);
            if (!$owner) {
                throw new ApiError(404, 'No town has that ID.');
            }
            $db->fetchOne('SELECT id FROM players WHERE id=? FOR UPDATE', [$owner]);
            $row = $db->fetchAssociative('SELECT * FROM towns WHERE id=? AND deleted_at IS NULL', [
                $id,
            ]);
            if (!$row) {
                throw new ApiError(409, 'This town was deleted.');
            }
            return $change($db, $row);
        });
    }
    // Moderation: rename a town or stop sharing it. Admins never publish a player's town.
    public function updateTown(string $actor, string $id, array $body): array
    {
        SaveService::keys($body, ['name', 'isPublic']);
        if (array_key_exists('isPublic', $body) && $body['isPublic'] !== false) {
            throw new ApiError(422, 'Admins can only stop sharing a town.');
        }
        if (array_key_exists('name', $body) && !is_string($body['name'])) {
            throw new ApiError(422, 'Choose a town name.');
        }
        $this->locked($id, function ($db, $row) use ($actor, $body) {
            $changes = [];
            if (isset($body['name'])) {
                [$name, $normalized] = $this->saves->nameAvailable(
                    $db,
                    $row['player_id'],
                    $row['id'],
                    $body['name'],
                );
                $changes += ['name' => $name, 'normalized_name' => $normalized];
            }
            $name = $changes['name'] ?? $row['name'];
            $listed = $row['listed'] && !array_key_exists('isPublic', $body);
            if ($listed) {
                $this->public->moderate($name);
                $changes['appearance'] = $this->public->projection(
                    json_decode($row['profile']),
                    $name,
                    $row['public_id'],
                );
            } else {
                $changes += ['listed' => 0, 'appearance' => null];
            }
            $db->update('towns', $changes, ['id' => $row['id']]);
            if ($name !== $row['name']) {
                $this->admins->audit(
                    $actor,
                    'town_renamed',
                    $row['id'],
                    $row['name'] . ' → ' . $name,
                );
            }
            if ($row['listed'] && !$listed) {
                $this->admins->audit($actor, 'town_unshared', $row['id'], $name);
            }
            return [];
        });
        return $this->townDetail($id);
    }
    public function deleteTown(string $actor, string $id, array $body): array
    {
        SaveService::keys($body, ['confirmation']);
        return $this->locked($id, function ($db, $row) use ($actor, $body) {
            if (($body['confirmation'] ?? null) !== $row['name']) {
                throw new ApiError(422, 'Type the town name to confirm deletion.');
            }
            SaveService::tombstone($db, $row['id']);
            $this->admins->audit($actor, 'town_deleted', $row['id'], $row['name']);
            return ['ok' => true];
        });
    }
    // Saved as a new revision, so the replaced save stays in history and the owner's
    // devices pick it up (or ask which copy to keep) exactly as after a save elsewhere.
    public function restoreTown(string $actor, string $id, array $body): array
    {
        SaveService::keys($body, ['revision']);
        if (!is_int($body['revision'] ?? null)) {
            throw new ApiError(422, 'Choose a revision to restore.');
        }
        $this->locked($id, function ($db, $row) use ($actor, $body) {
            $old = $db->fetchAssociative(
                'SELECT revision,profile FROM town_history WHERE town_id=? AND revision=?',
                [$row['id'], $body['revision']],
            );
            if (!$old) {
                throw new ApiError(404, 'That revision is no longer kept.');
            }
            $now = (int) floor(microtime(true) * 1000);
            $latest = json_decode($row['profile'], false, 64, JSON_THROW_ON_ERROR);
            // An older snapshot never revokes the honours earned since.
            $restored = Honours::load()->keep(
                (new SaveIntegrity())->restoreKnownCheckpoint(
                    json_decode($old['profile'], false, 64, JSON_THROW_ON_ERROR),
                    $latest,
                    $now,
                    $row['id'],
                    (int) $row['saved_at'] * 1000,
                ),
                $latest,
            );
            $profile = json_encode($restored, JSON_THROW_ON_ERROR);
            SaveService::archive($db, $row);
            $changes = [
                'profile' => $profile,
                'revision' => (int) $row['revision'] + 1,
                'saved_at' => intdiv($now, 1000),
                'upload_id' => 'admin-restore-' . bin2hex(random_bytes(12)),
                'upload_hash' => hash('sha256', $profile),
            ];
            if ($row['listed']) {
                $changes['appearance'] = $this->public->projection(
                    $restored,
                    $row['name'],
                    $row['public_id'],
                );
            }
            $db->update('towns', $changes, ['id' => $row['id']]);
            $this->admins->audit(
                $actor,
                'town_restored',
                $row['id'],
                'revision ' . $old['revision'] . ' saved as revision ' . $changes['revision'],
            );
            return [];
        });
        return $this->townDetail($id);
    }

    public function auditLog(array $query): array
    {
        $page = self::page($query);
        $rows = $this->database
            ->get()
            ->fetchAllAssociative(
                'SELECT * FROM admin_audit ORDER BY id DESC LIMIT 51 OFFSET ' . ($page - 1) * 50,
            );
        return [
            'page' => $page,
            'hasNext' => count($rows) > 50,
            'entries' => array_map(
                fn($r) => [
                    'at' => (int) $r['at'],
                    'admin' => $r['admin'],
                    'action' => $r['action'],
                    'target' => $r['target'],
                    'detail' => $r['detail'],
                ],
                array_slice($rows, 0, 50),
            ),
        ];
    }
}
