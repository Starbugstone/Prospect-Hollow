<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;
use Symfony\Component\HttpFoundation\{Request, StreamedResponse};

/**
 * The player's own view of what the server keeps about them (GDPR access and portability)
 * and the confirmed change of their email address (rectification). Erasure is
 * SaveService::eraseAccount, shared with the admin panel.
 */
final class PlayerData
{
    /** How long an email change link stays valid, in seconds. */
    private const EMAIL_CHANGE_SECONDS = 3600;

    public function __construct(
        private Database $database,
        private Auth $auth,
        private SaveService $saves,
    ) {}

    private static function time(mixed $seconds): ?string
    {
        return $seconds === null ? null : gmdate('Y-m-d\TH:i:s\Z', (int) $seconds);
    }

    /** The new address of a change whose link is still valid, if any. */
    private static function pendingEmail(Connection $db, string $player): ?string
    {
        return $db->fetchOne('SELECT email FROM email_changes WHERE player_id=? AND expires_at>?', [
            $player,
            time(),
        ]) ?:
            null;
    }

    /** Counts and the latest connection details, for the "Your data" overview. */
    public function summary(Request $r): array
    {
        return $this->saves->transaction($r, false, function (Connection $db, array $a) {
            $id = $a['id'];
            $count = fn(string $sql, ?array $params = null) => (int) $db->fetchOne(
                $sql,
                $params ?? [$id],
            );
            $activity =
                $db->fetchAssociative('SELECT * FROM player_activity WHERE player_id=?', [$id]) ?:
                [];
            $profile =
                $db->fetchAssociative(
                    'SELECT display_name,anonymous_visits FROM player_profiles WHERE player_id=?',
                    [$id],
                ) ?:
                [];
            $towns = $db->fetchAllAssociative(
                'SELECT profile,deleted_at FROM towns WHERE player_id=?',
                [$id],
            );
            $honours = [];
            foreach ($towns as $town) {
                if ($town['deleted_at'] === null) {
                    $summary = SaveService::summary(json_decode($town['profile']));
                    $honours += array_flip($summary['honours']['earned'] ?? []);
                }
            }
            $key = $this->auth->visitorKey($id);
            $ms = fn($seconds) => $seconds === null || $seconds === false
                ? null
                : (int) $seconds * 1000;
            return [
                'email' => $a['email'],
                'createdAt' => $ms($a['created_at']),
                'publicName' => $profile['display_name'] ?? '',
                'anonymousVisits' => (bool) ($profile['anonymous_visits'] ?? false),
                'lastSeenAt' => $ms($activity['seen_at'] ?? null),
                'lastIp' => $activity['ip'] ?? null,
                'lastBrowser' => $activity['agent'] ?? null,
                'platform' => $activity['platform'] ?? null,
                'lastSignInAt' => $ms($activity['signed_in_at'] ?? null),
                'emailSignIns' => (int) ($activity['sign_ins'] ?? 0),
                'activeDays' => $count('SELECT COUNT(*) FROM activity_days WHERE player_id=?'),
                'sessions' => $count(
                    'SELECT COUNT(*) FROM sessions WHERE player_id=? AND expires_at>?',
                    [$id, time()],
                ),
                'towns' => count(array_filter($towns, fn($t) => $t['deleted_at'] === null)),
                'deletedTowns' => count(array_filter($towns, fn($t) => $t['deleted_at'] !== null)),
                'savedVersions' =>
                    count($towns) +
                    $count(
                        'SELECT COUNT(*) FROM town_history h JOIN towns t ON t.id=h.town_id WHERE t.player_id=?',
                    ),
                'refusedSaves' => $count(
                    'SELECT COUNT(*) FROM town_sync_rejections r JOIN towns t ON t.id=r.town_id WHERE t.player_id=?',
                ),
                'honours' => count($honours),
                'distinctions' => count((array) PlayerDistinctions::owned($db, $id)),
                'visits' => $count('SELECT COUNT(*) FROM visitor_visits WHERE visitor_key=?', [
                    $key,
                ]),
                'townsVisited' => $count(
                    'SELECT COUNT(DISTINCT town_id) FROM visitor_visits WHERE visitor_key=?',
                    [$key],
                ),
                'favourites' => $count('SELECT COUNT(*) FROM town_favourites WHERE player_id=?'),
                'pendingEmail' => self::pendingEmail($db, $id),
            ];
        });
    }

    /**
     * Pages with a stable unique cursor, including on MySQL whose PDO driver buffers
     * query results. Large save rows use a page of one; small metadata uses 100.
     * All columns and directions come from the fixed export queries below.
     * @return \Generator<int, array<string, mixed>>
     */
    private static function exportRows(
        Connection $db,
        string $sql,
        array $params,
        array $order,
        int $page = 100,
    ): \Generator {
        $cursor = null;
        do {
            $where = [];
            $after = [];
            if ($cursor !== null) {
                $equal = [];
                $values = [];
                foreach ($order as $column => $direction) {
                    $where[] =
                        '(' .
                        implode(' AND ', [
                            ...$equal,
                            $column . ($direction === 'ASC' ? '>?' : '<?'),
                        ]) .
                        ')';
                    $after = [...$after, ...$values, $cursor[$column]];
                    $equal[] = $column . '=?';
                    $values[] = $cursor[$column];
                }
            }
            $rows = $db->fetchAllAssociative(
                $sql .
                    ($where ? ' AND (' . implode(' OR ', $where) . ')' : '') .
                    ' ORDER BY ' .
                    implode(
                        ',',
                        array_map(
                            fn($column, $direction) => $column . ' ' . $direction,
                            array_keys($order),
                            array_values($order),
                        ),
                    ) .
                    ' LIMIT ' .
                    $page,
                [...$params, ...$after],
            );
            foreach ($rows as $row) {
                $cursor = [];
                foreach ($order as $column => $direction) {
                    $field = str_contains($column, '.')
                        ? substr($column, strrpos($column, '.') + 1)
                        : $column;
                    $cursor[$column] = $row[$field];
                }
                yield $row;
            }
        } while (count($rows) === $page);
    }

    /**
     * Everything stored about the account, in one JSON document. Spooling inside the
     * authorized transaction reports errors before headers, then releases its player
     * lock before the client downloads. Raw save JSON never needs decoding here.
     */
    public function export(Request $r): StreamedResponse
    {
        return $this->saves->transaction($r, false, function (Connection $db, array $a) {
            $id = $a['id'];
            $this->auth->limit('export:' . $id, 10, 3600);
            $key = $this->auth->visitorKey($id);
            $time = self::time(...);
            $activity =
                $db->fetchAssociative('SELECT * FROM player_activity WHERE player_id=?', [$id]) ?:
                null;
            $profile =
                $db->fetchAssociative(
                    'SELECT p.display_name,p.anonymous_visits,t.name FROM player_profiles p LEFT JOIN towns t ON t.id=p.visiting_town_id WHERE p.player_id=?',
                    [$id],
                ) ?:
                null;
            $distinctions = [];
            foreach ((array) PlayerDistinctions::owned($db, $id) as $distinction => $state) {
                $distinctions[] = ['id' => $distinction] + (array) $state;
            }
            $towns = function () use ($db, $id, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT t.*,s.collected_at,(SELECT COUNT(*) FROM town_travels r WHERE r.origin_town_id=t.id) AS travels FROM towns t LEFT JOIN saloon_collections s ON s.town_id=t.id WHERE t.player_id=?',
                        [$id],
                        ['t.saved_at' => 'DESC', 't.id' => 'ASC'],
                        1,
                    )
                    as $town
                ) {
                    $earlier = function () use ($db, $id, $town, $time): \Generator {
                        foreach (
                            self::exportRows(
                                $db,
                                'SELECT h.revision,h.saved_at,h.profile FROM town_history h JOIN towns t ON t.id=h.town_id WHERE t.player_id=? AND h.town_id=?',
                                [$id, $town['id']],
                                ['h.revision' => 'DESC'],
                                1,
                            )
                            as $entry
                        ) {
                            yield [
                                'revision' => (int) $entry['revision'],
                                'savedAt' => $time($entry['saved_at']),
                                'save' => JsonExport::stored($entry['profile']),
                            ];
                        }
                    };
                    yield [
                        'townId' => $town['id'],
                        'name' => $town['name'],
                        'shared' => (bool) $town['listed'],
                        'shareId' => $town['public_id'],
                        'revision' => (int) $town['revision'],
                        'savedAt' => $time($town['saved_at']),
                        'deletedAt' => $time($town['deleted_at']),
                        'saloonCollectedByVisitorAt' => $time($town['collected_at']),
                        'differentSignedInVisitors' => Honours::visitorCounts($db, [$town['id']])[
                            $town['id']
                        ],
                        'otherPlayersTownsVisited' => (int) $town['travels'],
                        'save' => JsonExport::stored($town['profile']),
                        'earlierSaves' => $earlier(),
                    ];
                }
            };
            $activeDays = function () use ($db, $id): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT day FROM activity_days WHERE player_id=?',
                        [$id],
                        ['day' => 'ASC'],
                    )
                    as $day
                ) {
                    yield gmdate('Y-m-d', (int) $day['day'] * 86400);
                }
            };
            $devices = function () use ($db, $id, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT token_hash,created_at,expires_at FROM sessions WHERE player_id=? AND expires_at>?',
                        [$id, time()],
                        ['created_at' => 'ASC', 'token_hash' => 'ASC'],
                    )
                    as $session
                ) {
                    yield [
                        'signedInAt' => $time($session['created_at']),
                        'expiresAt' => $time($session['expires_at']),
                    ];
                }
            };
            $visits = function () use ($db, $key, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT h.name AS host,v.id,v.arrived_at,v.departed_at,v.name,v.town_name FROM visitor_visits v JOIN towns h ON h.id=v.town_id WHERE v.visitor_key=?',
                        [$key],
                        ['v.arrived_at' => 'ASC', 'v.id' => 'ASC'],
                    )
                    as $visit
                ) {
                    yield [
                        'town' => $visit['host'],
                        'arrivedAt' => $time($visit['arrived_at']),
                        'leftAt' => $time($visit['departed_at']),
                        'shownAs' => $visit['name'] === '' ? null : $visit['name'],
                        'from' => $visit['town_name'],
                    ];
                }
            };
            $favourites = function () use ($db, $id, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT t.name,f.created_at,f.town_id FROM town_favourites f JOIN towns t ON t.id=f.town_id WHERE f.player_id=?',
                        [$id],
                        ['f.created_at' => 'ASC', 'f.town_id' => 'ASC'],
                    )
                    as $favourite
                ) {
                    yield [
                        'town' => $favourite['name'],
                        'addedAt' => $time($favourite['created_at']),
                    ];
                }
            };
            $finds = function () use ($db, $id, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT h.name AS host,t.name AS home,f.found_at FROM helmet_finds f JOIN towns t ON t.id=f.town_id LEFT JOIN towns h ON h.id=f.host_town_id WHERE f.player_id=?',
                        [$id],
                        ['f.found_at' => 'ASC'],
                    )
                    as $find
                ) {
                    yield [
                        'foundIn' => $find['host'],
                        'rewardedTown' => $find['home'],
                        'foundAt' => $time($find['found_at']),
                    ];
                }
            };
            $refused = function () use ($db, $id, $time): \Generator {
                foreach (
                    self::exportRows(
                        $db,
                        'SELECT r.*,t.name FROM town_sync_rejections r JOIN towns t ON t.id=r.town_id WHERE t.player_id=?',
                        [$id],
                        ['r.rejected_at' => 'ASC', 'r.id' => 'ASC'],
                        1,
                    )
                    as $rejection
                ) {
                    yield [
                        'townId' => $rejection['town_id'],
                        'town' => $rejection['name'],
                        'refusedAt' => $time(intdiv((int) $rejection['rejected_at'], 1000)),
                        'revision' => (int) $rejection['revision'],
                        'code' => $rejection['code'],
                        'field' => $rejection['field'],
                        'reason' => $rejection['message'],
                        'upload' => JsonExport::stored($rejection['upload']),
                        'cloud' => JsonExport::stored($rejection['cloud']),
                        'expected' => JsonExport::stored($rejection['expected']),
                    ];
                }
            };
            $export = new JsonExport();
            $export->write([
                'exportedAt' => $time(time()),
                'account' => [
                    'id' => $id,
                    'email' => $a['email'],
                    'createdAt' => $time($a['created_at']),
                    'pendingEmailChange' => self::pendingEmail($db, $id),
                ],
                'publicProfile' => [
                    'publicName' => $profile['display_name'] ?? '',
                    'visitingAs' => $profile['name'] ?? null,
                    'privateVisits' => (bool) ($profile['anonymous_visits'] ?? false),
                ],
                'activity' => [
                    'lastSeenAt' => $time($activity['seen_at'] ?? null),
                    'lastIpAddress' => $activity['ip'] ?? null,
                    'lastBrowser' => $activity['agent'] ?? null,
                    'lastPlatform' => $activity['platform'] ?? null,
                    'lastEmailSignInAt' => $time($activity['signed_in_at'] ?? null),
                    'emailSignIns' => (int) ($activity['sign_ins'] ?? 0),
                    'activeDays' => $activeDays(),
                ],
                'signedInDevices' => $devices(),
                'towns' => $towns(),
                'visitsMade' => $visits(),
                'favouriteTowns' => $favourites(),
                'astronautFinds' => $finds(),
                'refusedCloudSaves' => $refused(),
                'distinctions' => $distinctions,
            ]);
            return $export->response();
        });
    }

    /** Sends a confirmation link to the new address; nothing changes until it is opened. */
    public function requestEmailChange(Request $r, array $body): array
    {
        SaveService::keys($body, ['email']);
        $email = Auth::email($body['email'] ?? null);
        $token = bin2hex(random_bytes(32));
        $this->saves->transaction($r, true, function (Connection $db, array $a) use (
            $email,
            $token,
        ) {
            if ($email === $a['email']) {
                throw new ApiError(422, 'This is already your email address.');
            }
            $this->auth->limit('email:' . $email, 5, 3600);
            // Only the latest request stays valid.
            $db->delete('email_changes', ['player_id' => $a['id']]);
            $db->insert('email_changes', [
                'token_hash' => $this->auth->hash($token),
                'player_id' => $a['id'],
                'email' => $email,
                'expires_at' => time() + self::EMAIL_CHANGE_SECONDS,
            ]);
        });
        if (
            !$this->auth->mail(
                $email,
                'Confirm your new Prospect Hollow email address',
                "Open this link within an hour to sign in with this address from now on:\n\n" .
                    $this->auth->origin() .
                    '/#email=' .
                    $token .
                    "\n\nIf you did not ask for this, ignore this email: nothing changes.",
            )
        ) {
            $this->database
                ->get()
                ->delete('email_changes', ['token_hash' => $this->auth->hash($token)]);
            throw new ApiError(503, 'The confirmation email could not be sent. Try again later.');
        }
        return ['pendingEmail' => $email];
    }

    /** Opening the link proves the new address; it needs no session on this device. */
    public function confirmEmailChange(array $body): array
    {
        SaveService::keys($body, ['token']);
        if (
            !is_string($body['token'] ?? null) ||
            !preg_match('/^[a-f0-9]{64}$/D', $body['token'])
        ) {
            throw new ApiError(422, 'Invalid confirmation link.');
        }
        $hash = $this->auth->hash($body['token']);
        $db = $this->database->get();
        [$previous, $email] = Database::retryOnDeadlock($db, function () use ($db, $hash) {
            $expired = new ApiError(401, 'This link has expired or was already used.');
            // The player row lock comes first, as in every account operation, then the
            // address's identity lock that a sign-in creating an account also takes.
            $owner = $db->fetchOne('SELECT player_id FROM email_changes WHERE token_hash=?', [
                $hash,
            ]);
            $player = $owner
                ? $db->fetchAssociative('SELECT * FROM players WHERE id=? FOR UPDATE', [$owner])
                : false;
            $change = $player
                ? $db->fetchAssociative(
                    'SELECT * FROM email_changes WHERE token_hash=? FOR UPDATE',
                    [$hash],
                )
                : false;
            if (!$change || (int) $change['expires_at'] <= time()) {
                throw $expired;
            }
            $this->auth->lockIdentity($db, $change['email']);
            if (
                $db->fetchOne('SELECT id FROM players WHERE email=?', [$change['email']]) !== false
            ) {
                throw new ApiError(409, 'Another account already uses this email address.');
            }
            $db->update('players', ['email' => $change['email']], ['id' => $player['id']]);
            $db->delete('email_changes', ['player_id' => $player['id']]);
            // The old address can no longer sign in to this account or be traced to it.
            $db->delete('login_intents', ['email' => $player['email']]);
            $db->delete('identities', [
                'email_hash' => $this->auth->identityHash($player['email']),
            ]);
            return [$player['email'], $change['email']];
        });
        $this->auth->mail(
            $previous,
            'Your Prospect Hollow email address was changed',
            "Your Prospect Hollow account now signs in with a different email address. This address is no longer linked to it.\n\n" .
                'If you did not make this change, ' .
                SiteSettings::contactHint($this->database->get()) .
                '.',
        );
        return ['email' => $email];
    }
}
