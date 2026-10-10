<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\ArrayParameterType;
use Symfony\Component\HttpFoundation\Request;

/**
 * How signed-in players find other shared towns: random draws, name search and favourites.
 * Every list returns the same small cards, never level records or the full appearance, and
 * never the player's own towns.
 */
final class TownDirectory
{
    public const DRAW_SIZE = 7;
    public const SEARCH_SIZE = 20;
    public const FAVOURITE_LIMIT = 50;
    public const ACTIVE_SECONDS = 14 * 86400;
    private const CARD = 'SELECT t.id,t.public_id,t.player_id,t.name,t.appearance,s.collected_at FROM towns t LEFT JOIN saloon_collections s ON s.town_id=t.id';
    private const SHARED = 't.listed=1 AND t.deleted_at IS NULL';

    public function __construct(private Database $database, private Auth $auth) {}

    // Shared towns are dealt like a shuffled deck: the seed fixes one random order, and each
    // page is the next draw of seven, so refreshing never repeats a town until the deck runs
    // out. Every visitor gets their own seed, which spreads visits across all shared towns.
    // Towns saved in the last two weeks come first, and among them towns this player had not
    // visited when the deck was shuffled. The seed starts with that time in hex, so visiting
    // a town while drawing never reorders the deck.
    public function browse(Request $r): array
    {
        $session = $this->auth->session($r);
        $page = filter_var($r->query->get('page', '1'), FILTER_VALIDATE_INT, [
            'options' => ['min_range' => 1, 'max_range' => 10000],
        ]);
        if (!$page) {
            throw new ApiError(422, 'Invalid page.');
        }
        $now = time();
        $seed = $r->query->get('seed') ?? sprintf('%08x', $now) . bin2hex(random_bytes(4));
        if (!preg_match('/^[a-f0-9]{16}$/D', $seed)) {
            throw new ApiError(422, 'Invalid seed.');
        }
        $dealt = min($now, (int) hexdec(substr($seed, 0, 8)));
        $rows = $this->database
            ->get()
            ->fetchAllAssociative(
                self::CARD .
                    ' LEFT JOIN (SELECT DISTINCT town_id FROM visitor_visits WHERE visitor_key=? AND arrived_at<?) seen ON seen.town_id=t.id WHERE ' .
                    self::SHARED .
                    ' AND t.player_id<>? ORDER BY CASE WHEN t.saved_at>=? THEN 0 ELSE 2 END+CASE WHEN seen.town_id IS NULL THEN 0 ELSE 1 END,MD5(CONCAT(t.public_id,CAST(? AS CHAR(16)))),t.public_id LIMIT ' .
                    (self::DRAW_SIZE + 1) .
                    ' OFFSET ' .
                    ($page - 1) * self::DRAW_SIZE,
                [
                    $this->auth->visitorKey($session['player_id']),
                    $dealt,
                    $session['player_id'],
                    $dealt - self::ACTIVE_SECONDS,
                    $seed,
                ],
            );
        return [
            'entries' => $this->cards(array_slice($rows, 0, self::DRAW_SIZE), $session, $now),
            'seed' => $seed,
            'page' => $page,
            'hasNext' => count($rows) > self::DRAW_SIZE,
        ];
    }

    // Names are matched as the owner saved them, ignoring case: names that start with the
    // search come first, then recently played towns, then alphabetical order.
    public function search(Request $r): array
    {
        $session = $this->auth->session($r);
        $this->auth->limit('town-search:' . ($r->getClientIp() ?? 'unknown'), 120, 60);
        $query = \Normalizer::normalize(
            trim((string) $r->query->get('q', '')),
            \Normalizer::FORM_KC,
        );
        $query = is_string($query) ? preg_replace('/ +/u', ' ', $query) : null;
        if (!is_string($query) || mb_strlen($query) < 2 || mb_strlen($query) > 24) {
            throw new ApiError(422, 'Search with 2–24 characters.');
        }
        $like = strtr(transliterator_transliterate('Any-Lower', $query), [
            '!' => '!!',
            '%' => '!%',
            '_' => '!_',
        ]);
        $now = time();
        $rows = $this->database
            ->get()
            ->fetchAllAssociative(
                self::CARD .
                    ' WHERE ' .
                    self::SHARED .
                    " AND t.player_id<>? AND t.normalized_name LIKE ? ESCAPE '!' ORDER BY CASE WHEN t.normalized_name LIKE ? ESCAPE '!' THEN 0 ELSE 1 END,CASE WHEN t.saved_at>=? THEN 0 ELSE 1 END,t.normalized_name,t.public_id LIMIT " .
                    (self::SEARCH_SIZE + 1),
                [$session['player_id'], "%$like%", "$like%", $now - self::ACTIVE_SECONDS],
            );
        return [
            'entries' => $this->cards(array_slice($rows, 0, self::SEARCH_SIZE), $session, $now),
            'query' => $query,
            'more' => count($rows) > self::SEARCH_SIZE,
        ];
    }

    // Favourites follow the account on every device, newest first. A town its owner stops
    // sharing disappears from the list and returns if it is shared again.
    public function favourites(Request $r): array
    {
        $session = $this->auth->session($r);
        $rows = $this->database
            ->get()
            ->fetchAllAssociative(
                self::CARD .
                    ' JOIN town_favourites f ON f.town_id=t.id WHERE f.player_id=? AND ' .
                    self::SHARED .
                    ' ORDER BY f.created_at DESC,t.public_id LIMIT ' .
                    self::FAVOURITE_LIMIT,
                [$session['player_id']],
            );
        return [
            'entries' => $this->cards($rows, $session, time()),
            'limit' => self::FAVOURITE_LIMIT,
        ];
    }

    public function favourite(Request $r, string $publicId, bool $keep): array
    {
        $session = $this->auth->session($r, true);
        return $this->database
            ->get()
            ->transactional(function ($db) use ($session, $publicId, $keep) {
                // The player row lock keeps two tabs from passing the limit together.
                $db->fetchOne('SELECT id FROM players WHERE id=? FOR UPDATE', [
                    $session['player_id'],
                ]);
                $this->auth->recheck($session);
                $town = $db->fetchAssociative(
                    'SELECT id,player_id,listed,deleted_at FROM towns WHERE public_id=?',
                    [$publicId],
                );
                if (!$keep) {
                    // Removing still works after the owner stops sharing the town.
                    if ($town) {
                        $db->delete('town_favourites', [
                            'player_id' => $session['player_id'],
                            'town_id' => $town['id'],
                        ]);
                    }
                    return ['favourite' => false];
                }
                if (!$town || !$town['listed'] || $town['deleted_at'] !== null) {
                    throw new ApiError(404, 'Town unavailable.');
                }
                if ($town['player_id'] === $session['player_id']) {
                    throw new ApiError(422, 'Your own towns cannot be favourites.');
                }
                $kept = $db->fetchOne(
                    'SELECT town_id FROM town_favourites WHERE player_id=? AND town_id=?',
                    [$session['player_id'], $town['id']],
                );
                if (!$kept) {
                    $count = (int) $db->fetchOne(
                        'SELECT COUNT(*) FROM town_favourites f JOIN towns t ON t.id=f.town_id WHERE f.player_id=? AND ' .
                            self::SHARED,
                        [$session['player_id']],
                    );
                    if ($count >= self::FAVOURITE_LIMIT) {
                        throw new ApiError(
                            422,
                            'You can keep up to 50 favourite towns. Remove one first.',
                            ['code' => 'favourites_full'],
                        );
                    }
                    $db->insert('town_favourites', [
                        'player_id' => $session['player_id'],
                        'town_id' => $town['id'],
                        'created_at' => time(),
                    ]);
                }
                return ['favourite' => true];
            });
    }

    // A list card carries what helps choose a town. "visited" covers every visit this player
    // made while signed in, on any device; "visitors" counts people present now, as the
    // guestbook does.
    private function cards(array $rows, array $session, int $now): array
    {
        if (!$rows) {
            return [];
        }
        $db = $this->database->get();
        $ids = array_column($rows, 'id');
        $present = array_column(
            $db->fetchAllAssociative(
                'SELECT v.town_id,COUNT(DISTINCT v.id) AS present FROM visitor_visits v JOIN visitor_leases l ON l.visit_id=v.id WHERE v.town_id IN (?) AND v.departed_at IS NULL AND l.expires_at>? GROUP BY v.town_id',
                [$ids, $now],
                [ArrayParameterType::STRING],
            ),
            'present',
            'town_id',
        );
        $visited = array_flip(
            $db->fetchFirstColumn(
                'SELECT DISTINCT town_id FROM visitor_visits WHERE visitor_key=? AND town_id IN (?)',
                [$this->auth->visitorKey($session['player_id']), $ids],
                [1 => ArrayParameterType::STRING],
            ),
        );
        $favourites = array_flip(
            $db->fetchFirstColumn(
                'SELECT town_id FROM town_favourites WHERE player_id=? AND town_id IN (?)',
                [$session['player_id'], $ids],
                [1 => ArrayParameterType::STRING],
            ),
        );
        // Owners of towns that showcase a player distinction, checked as a visit does.
        $appearances = array_map(
            fn($row) => json_decode($row['appearance'])->appearance ?? new \stdClass(),
            $rows,
        );
        $owners = [];
        foreach ($rows as $index => $row) {
            if (PlayerDistinctions::showcases($appearances[$index]->honours ?? null)) {
                $owners[] = $row['player_id'];
            }
        }
        $distinctions = PlayerDistinctions::load()->received($db, $owners, $now * 1000);
        return array_map(
            function ($row, $appearance) use (
                $present,
                $visited,
                $favourites,
                $distinctions,
                $now,
            ) {
                $buildings = (array) ($appearance->buildings ?? []);
                return [
                    'villageId' => $row['public_id'],
                    'name' => $row['name'],
                    'era' => $appearance->era ?? null,
                    ...$appearance->personalisation->crest ?? null
                        ? ['crest' => $appearance->personalisation->crest]
                        : [],
                    'buildings' => count(array_filter($buildings, fn($level) => $level > 0)),
                    'mineLevel' => $appearance->mineLevel ?? null,
                    'saloonReady' =>
                        ($buildings['saloon'] ?? 0) > 0 &&
                        PublicTown::saloonReadyAt($row['collected_at']) <= $now,
                    'visitors' => (int) ($present[$row['id']] ?? 0),
                    'visited' => isset($visited[$row['id']]),
                    'favourite' => isset($favourites[$row['id']]),
                    'honours' => $this->honours(
                        $appearance->honours ?? null,
                        $distinctions[$row['player_id']] ?? [],
                    ),
                ];
            },
            $rows,
            $appearances,
        );
    }

    // Town Honours as the shared appearance publishes them (earned IDs and the owner's
    // showcase, with its player distinction while the owner holds it); null until the
    // owner's town has published any.
    private function honours(mixed $honours, array $distinctions): ?array
    {
        if (
            !($honours instanceof \stdClass) ||
            !(($honours->earned ?? null) instanceof \stdClass)
        ) {
            return null;
        }
        $honours = PlayerDistinctions::attach(clone $honours, $distinctions);
        $id = fn($value) => is_string($value) && preg_match('/^[a-z0-9-]{1,64}$/D', $value);
        return [
            'earned' => array_values(array_filter(array_keys((array) $honours->earned), $id)),
            'showcase' => array_values(array_filter($honours->showcase, $id)),
        ] + (isset($honours->distinction) ? ['distinction' => $honours->distinction] : []);
    }
}
