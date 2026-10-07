<?php
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminController, AdminService, ApiError, Totp};
use Symfony\Component\HttpFoundation\Request;
$admins = new AdminAuth($db, $auth);
$adminApi = new AdminController($auth, $admins, new AdminService($db, $admins, $saves, $public));
// A fresh client address per run keeps these checks inside the real sign-in limits.
$ip = '10.' . random_int(0, 255) . '.' . random_int(0, 255) . '.' . random_int(1, 254);
$adminIds = [];
function adminCall(
    string $method,
    string $path,
    mixed $body = null,
    array $session = [],
    array $headers = [],
): array {
    global $adminApi, $ip;
    $headers += [
        'HTTP_HOST' => 'localhost:8094',
        'HTTP_ORIGIN' => 'http://localhost:8094',
        'CONTENT_TYPE' => 'application/json',
        'HTTP_X_CSRF_TOKEN' => $session['csrf'] ?? '',
        'REMOTE_ADDR' => $ip,
    ];
    $r = Request::create(
        'http://localhost:8094/api/admin/' . $path,
        $method,
        [],
        isset($session['cookie']) ? ['cascade_admin_local' => $session['cookie']] : [],
        [],
        $headers,
        $body === null ? '' : json_encode($body, JSON_THROW_ON_ERROR),
    );
    foreach ($headers as $key => $value) {
        if (str_starts_with($key, 'HTTP_')) {
            $r->headers->set(str_replace('_', '-', substr($key, 5)), $value);
        }
    }
    $response = $adminApi($r, explode('?', $path)[0]);
    return [
        'status' => $response->getStatusCode(),
        'data' => json_decode($response->getContent(), true),
        'response' => $response,
    ];
}
function adminLogin(string $username, string $password): array
{
    $result = adminCall('POST', 'login', ['username' => $username, 'password' => $password]);
    $data = status(200, $result, 'admin password');
    return [
        'cookie' => $result['response']->headers->getCookies()[0]->getValue(),
        'csrf' => $data['csrf'],
        'stage' => $data['stage'],
    ];
}
function code(string $secret, int $offset = 0): string
{
    return Totp::code($secret, intdiv(time(), 30) + $offset);
}
function wrongCode(string $secret): string
{
    $valid = [code($secret, -1), code($secret), code($secret, 1)];
    for ($n = 0; in_array($code = sprintf('%06d', $n), $valid, true); $n++);
    return $code;
}
function newAdmin(string $prefix): array
{
    global $admins, $adminIds, $db;
    $created = $admins->create(AdminAuth::SERVER, $prefix . bin2hex(random_bytes(4)));
    $adminIds[] = $db
        ->get()
        ->fetchOne('SELECT id FROM admins WHERE username=?', [$created['username']]);
    return $created;
}
// Enrolls the authenticator and returns a full session plus the secret.
function fullAdmin(string $prefix, string $password): array
{
    $created = newAdmin($prefix);
    $s = adminLogin($created['username'], $created['password']);
    status(200, adminCall('POST', 'password', ['password' => $password], $s), 'choose password');
    $secret = status(200, adminCall('GET', 'login/authenticator', null, $s), 'enrollment')[
        'secret'
    ];
    check(
        status(
            200,
            adminCall('POST', 'login/authenticator', ['code' => code($secret)], $s),
            'enroll',
        )['stage'] === 'full',
        'enrolled session is full',
    );
    return [$created['username'], $s, $secret];
}
try {
    // RFC 6238 SHA-1 vectors, truncated to six digits.
    $rfc = Totp::encode('12345678901234567890');
    check(
        $rfc === 'GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ' &&
            Totp::decode($rfc) === '12345678901234567890',
        'base32 round trip',
    );
    check(
        Totp::code($rfc, 1) === '287082' && Totp::code($rfc, intdiv(1111111109, 30)) === '081804',
        'RFC 6238 codes',
    );
    check(
        Totp::verify($rfc, '287082', 0, 59) === 1 &&
            Totp::verify($rfc, '287082', 1, 59) === null &&
            Totp::verify($rfc, '28708', 0, 59) === null,
        'spent steps and malformed codes rejected',
    );

    foreach (
        [
            ['GET', 'me'],
            ['GET', 'stats'],
            ['GET', 'players'],
            ['GET', 'towns'],
            ['GET', 'admins'],
            ['GET', 'audit'],
            ['GET', 'nothing-here'],
        ]
        as [$method, $path]
    ) {
        status(401, adminCall($method, $path), 'anonymous ' . $path);
    }
    try {
        $admins->create(AdminAuth::SERVER, 'No Spaces');
        check(false, 'invalid username');
    } catch (ApiError $e) {
        check($e->status === 422, 'username validated');
    }
    $first = newAdmin('root-');
    try {
        $admins->create(AdminAuth::SERVER, $first['username']);
        check(false, 'duplicate');
    } catch (ApiError $e) {
        check($e->status === 409, 'usernames unique');
    }
    check(
        preg_match('/^[a-zA-Z0-9]{5}(-[a-zA-Z0-9]{5}){3}$/D', $first['password']) === 1,
        'temporary password format',
    );
    status(
        401,
        adminCall('POST', 'login', [
            'username' => $first['username'],
            'password' => 'wrong password!',
        ]),
        'wrong password',
    );
    status(
        401,
        adminCall('POST', 'login', [
            'username' => 'nobody-' . bin2hex(random_bytes(3)),
            'password' => $first['password'],
        ]),
        'unknown admin',
    );
    status(
        422,
        adminCall('POST', 'login', [
            'username' => $first['username'],
            'password' => 'x',
            'extra' => 1,
        ]),
        'unexpected login field',
    );

    // Temporary password → required change → authenticator enrollment → full session.
    $s = adminLogin($first['username'], $first['password']);
    check($s['stage'] === 'change', 'temporary password must be changed');
    check(
        status(403, adminCall('GET', 'stats', null, $s), 'data before finishing')['stage'] ===
            'change',
        'pending session cannot read data',
    );
    status(
        403,
        adminCall('GET', 'login/authenticator', null, $s),
        'enrollment waits for the password change',
    );
    status(
        403,
        adminCall(
            'POST',
            'password',
            ['password' => 'long enough password'],
            ['csrf' => 'nope'] + $s,
        ),
        'csrf on password change',
    );
    status(422, adminCall('POST', 'password', ['password' => 'short'], $s), 'short password');
    status(
        422,
        adminCall('POST', 'password', ['password' => 'my name is ' . $first['username']], $s),
        'password with username',
    );
    status(
        422,
        adminCall('POST', 'password', ['password' => $first['password']], $s),
        'temporary password reused',
    );
    $password = 'correct horse battery staple';
    check(
        status(
            200,
            adminCall('POST', 'password', ['password' => $password], $s),
            'choose password',
        )['stage'] === 'enroll',
        'authenticator required next',
    );
    status(403, adminCall('GET', 'players', null, $s), 'enrolling session cannot read data');
    $enrollment = status(200, adminCall('GET', 'login/authenticator', null, $s), 'enrollment');
    $secret = $enrollment['secret'];
    check(
        strlen($secret) === 32 &&
            str_starts_with(
                $enrollment['uri'],
                'otpauth://totp/Prospect%20Hollow%3A' . $first['username'],
            ) &&
            str_contains($enrollment['uri'], 'secret=' . $secret),
        'authenticator link',
    );
    check(
        status(200, adminCall('GET', 'login/authenticator', null, $s), 'enrollment again')[
            'secret'
        ] === $secret,
        'enrollment secret stable until confirmed',
    );
    check(
        !str_contains(
            (string) $db
                ->get()
                ->fetchOne('SELECT totp_secret FROM admins WHERE username=?', [$first['username']]),
            $secret,
        ),
        'authenticator secret encrypted at rest',
    );
    status(
        422,
        adminCall('POST', 'login/authenticator', ['code' => wrongCode($secret)], $s),
        'wrong enrollment code',
    );
    check(
        status(
            200,
            adminCall('POST', 'login/authenticator', ['code' => code($secret)], $s),
            'enroll',
        )['stage'] === 'full',
        'enrolled',
    );
    $me = status(200, adminCall('GET', 'me', null, $s), 'me');
    check(
        $me['stage'] === 'full' &&
            $me['admin']['username'] === $first['username'] &&
            $me['csrf'] === $s['csrf'],
        'session restored after reload',
    );

    // Browser-only, same-origin mutations with the session CSRF token.
    status(
        403,
        adminCall('POST', 'admins', ['username' => 'csrf-test'], ['csrf' => 'wrong'] + $s),
        'admin csrf',
    );
    status(
        403,
        adminCall('POST', 'admins', ['username' => 'origin-test'], $s, [
            'HTTP_ORIGIN' => 'capacitor://localhost',
        ]),
        'native origin rejected',
    );
    status(
        403,
        adminCall('POST', 'admins', ['username' => 'site-test'], $s, [
            'HTTP_SEC_FETCH_SITE' => 'same-site',
        ]),
        'sibling subdomain rejected',
    );
    status(
        415,
        adminCall('POST', 'logout', (object) [], $s, ['CONTENT_TYPE' => 'text/plain']),
        'json only',
    );
    status(422, adminCall('GET', 'stats?debug=1', null, $s), 'unexpected query');
    status(422, adminCall('GET', 'players?page=0', null, $s), 'page bounds');
    status(422, adminCall('GET', 'players?sort=password', null, $s), 'sort allowlist');
    check(
        adminCall('GET', 'me', null, $s)['response']->headers->get('X-Robots-Tag') ===
            'noindex, nofollow',
        'not indexed',
    );

    // Signing in again needs a fresh code: the enrollment code cannot be replayed.
    status(200, adminCall('POST', 'logout', (object) [], $s), 'admin logout');
    status(401, adminCall('GET', 'me', null, $s), 'logged out');
    $s = adminLogin($first['username'], $password);
    check($s['stage'] === 'totp', 'code required');
    status(422, adminCall('POST', 'login/code', ['code' => code($secret)], $s), 'replayed code');
    status(422, adminCall('POST', 'login/code', ['code' => wrongCode($secret)], $s), 'wrong code');
    check(
        status(
            200,
            adminCall(
                'POST',
                'login/code',
                ['code' => implode(' ', str_split(code($secret, 1), 3))],
                $s,
            ),
            'code with a space',
        )['stage'] === 'full',
        'signed in with code',
    );
    $db->get()->executeStatement(
        'UPDATE admin_sessions SET used_at=? WHERE admin_id=(SELECT id FROM admins WHERE username=?)',
        [time() - 3601, $first['username']],
    );
    status(401, adminCall('GET', 'me', null, $s), 'idle session expires');
    $db->get()->executeStatement('UPDATE admins SET totp_step=0 WHERE username=?', [
        $first['username'],
    ]);
    $s = adminLogin($first['username'], $password);
    status(200, adminCall('POST', 'login/code', ['code' => code($secret)], $s), 'fresh sign in');

    // Five wrong codes end the pending session.
    [$second, $s2, $secret2] = fullAdmin('second-', 'another long passphrase');
    $pending = adminLogin($second, 'another long passphrase');
    for ($i = 1; $i < 5; $i++) {
        status(
            422,
            adminCall('POST', 'login/code', ['code' => wrongCode($secret2)], $pending),
            'wrong code ' . $i,
        );
    }
    status(
        401,
        adminCall('POST', 'login/code', ['code' => wrongCode($secret2)], $pending),
        'fifth wrong code',
    );
    status(
        401,
        adminCall('POST', 'login/code', ['code' => code($secret2, 1)], $pending),
        'session ended after wrong codes',
    );

    // Player activity: last connection, IP, browser and platform.
    $player = account();
    $body = townBody('Admin Viewed');
    $body['profile']->records = (object) [
        '1' => (object) ['score' => 1200, 'stars' => 3],
        '2' => (object) ['score' => 800, 'stars' => 2],
    ];
    $body['profile']->powers = [(object) ['id' => 'tnt', 'quantity' => 2]];
    $town = status(200, callApi('POST', 'towns', $body, $player), 'player town');
    // A kept pre-integrity save can contain an old diagnostic zero-star record.
    // Current uploads reject it, while admin statistics and historical recovery must
    // still handle a known legacy row without counting it as completed gameplay.
    $body['profile']->records->{'3'} = (object) ['score' => 10, 'stars' => 0];
    $db->get()->update(
        'towns',
        ['profile' => json_encode($body['profile'], JSON_THROW_ON_ERROR)],
        ['id' => $town['townId']],
    );
    $detail = status(200, adminCall('GET', 'players/' . $player['id'], null, $s), 'player detail');
    $p = $detail['player'];
    check(
        str_ends_with($p['email'], '@example.test') &&
            $p['signIns'] === 1 &&
            $p['platform'] === 'web' &&
            $p['ip'] === '127.0.0.1' &&
            $p['agent'] === 'Symfony',
        'sign-in recorded',
    );
    check(
        $p['lastSeenAt'] >= time() - 120 &&
            $p['lastSignInAt'] >= time() - 5 &&
            $p['activeDays'] === 1 &&
            count($detail['sessions']) === 1,
        'last connection recorded',
    );
    check(
        $detail['towns'][0]['stats'] === [
            'era' => 'frontier',
            'coins' => 25,
            'buildings' => 1,
            'honours' => null,
            'levels' => 2,
            'stars' => 5,
            'score' => 2000,
            'highestLevel' => 2,
        ],
        'town progress summary',
    );
    $db->get()->executeStatement(
        'UPDATE player_activity SET seen_at=seen_at-600 WHERE player_id=?',
        [$player['id']],
    );
    status(
        200,
        callApi('GET', 'account', null, $player, [
            'REMOTE_ADDR' => '192.0.2.7',
            'HTTP_USER_AGENT' => "Test\x01Browser/1",
        ]),
        'player returns',
    );
    $p = status(200, adminCall('GET', 'players/' . $player['id'], null, $s), 'player detail again')[
        'player'
    ];
    check(
        $p['ip'] === '192.0.2.7' &&
            $p['agent'] === 'TestBrowser/1' &&
            $p['lastSeenAt'] >= time() - 60 &&
            $p['signIns'] === 1,
        'latest connection replaces the previous one',
    );
    $token = bin2hex(random_bytes(32));
    $db->get()->insert('login_intents', [
        'token_hash' => $auth->hash($token),
        'email' => 'app-' . bin2hex(random_bytes(4)) . '@example.test',
        'expires_at' => time() + 900,
    ]);
    $native = status(
        200,
        callApi(
            'POST',
            'auth/confirm',
            ['token' => $token, 'native' => true],
            [],
            ['HTTP_ORIGIN' => 'capacitor://localhost'],
        ),
        'native sign in',
    );
    $accounts[] = $native['account']['id'];
    check(
        status(
            200,
            adminCall('GET', 'players/' . $native['account']['id'], null, $s),
            'native player',
        )['player']['platform'] === 'app',
        'app platform recorded',
    );

    // Lists and search.
    $list = status(
        200,
        adminCall('GET', 'players?q=' . rawurlencode(explode('@', $p['email'])[0]), null, $s),
        'search players',
    );
    check(
        $list['total'] === 1 &&
            $list['players'][0]['id'] === $player['id'] &&
            $list['players'][0]['towns'] === 1 &&
            $list['players'][0]['levels'] === 2 &&
            $list['players'][0]['bestEra'] === 'frontier',
        'player list row',
    );
    check(
        status(200, adminCall('GET', 'players?q=%25', null, $s), 'wildcard search')['total'] === 0,
        'search text is literal',
    );
    foreach (['seen', 'created', 'email'] as $sort) {
        status(
            200,
            adminCall('GET', 'players?sort=' . $sort . '&page=1', null, $s),
            'sort ' . $sort,
        );
    }
    $towns = status(200, adminCall('GET', 'towns?q=admin+viewed', null, $s), 'search towns');
    check(
        $towns['total'] >= 1 &&
            in_array($town['townId'], array_column($towns['towns'], 'id'), true),
        'town search by name',
    );
    $listedTown = array_values(
        array_filter($towns['towns'], fn($row) => $row['id'] === $town['townId']),
    )[0];
    check($listedTown['uniqueVisitors'] === 0, 'town without visits has a numeric zero');
    $beforeVisitRead = $db
        ->get()
        ->fetchAssociative('SELECT profile,revision FROM towns WHERE id=?', [$town['townId']]);
    // Repeat arrivals count once, anonymous guests do not count, and a home-town
    // identity still counts when its recorded display name is empty.
    foreach (
        [
            ['repeat', 'Guest', null],
            ['repeat', 'Renamed guest', null],
            ['anonymous', '', null],
            ['home', '', $town['townId']],
        ]
        as [$key, $guestName, $origin]
    ) {
        $db->get()->insert('visitor_visits', [
            'id' => bin2hex(random_bytes(16)),
            'town_id' => $town['townId'],
            'visitor_key' => hash('sha256', $key),
            'name' => $guestName,
            'origin_town_id' => $origin,
            'era' => 'frontier',
            // Live presence marks every visit made while signed in.
            'signed_in' => $guestName !== '' || $origin !== null ? 1 : 0,
            'arrived_at' => time() - 3600,
            'last_seen_at' => time() - 3500,
            'departed_at' => time() - 3400,
        ]);
    }
    $towns = status(
        200,
        adminCall('GET', 'towns?q=' . $town['townId'], null, $s),
        'visitor counts in list',
    );
    check(
        $towns['towns'][0]['uniqueVisitors'] === 2,
        'list deduplicates all recorded signed-in visitors',
    );
    status(422, adminCall('GET', 'towns?filter=secret', null, $s), 'filter allowlist');
    $view = status(200, adminCall('GET', 'towns/' . $town['townId'], null, $s), 'town detail');
    check(
        $view['town']['uniqueVisitors'] === 2 && $view['town']['townsVisited'] === 0,
        'detail returns server social counts',
    );
    check(
        $beforeVisitRead ===
            $db
                ->get()
                ->fetchAssociative('SELECT profile,revision FROM towns WHERE id=?', [
                    $town['townId'],
                ]),
        'admin visitor reads leave the save unchanged',
    );
    check(
        $view['town']['owner']['id'] === $player['id'] &&
            $view['appearance']['era'] === 'frontier' &&
            $view['appearance']['appearance']['buildings']['well'] === 1 &&
            $view['profile']['town']['coins'] === 25 &&
            $view['history'] === [],
        'private town rendered from its save',
    );
    $stats = status(200, adminCall('GET', 'stats', null, $s), 'overview');
    check(
        $stats['players']['total'] >= 2 &&
            $stats['players']['active']['day'] >= 2 &&
            $stats['players']['platforms']['app'] >= 1 &&
            count($stats['daily']) === 30 &&
            end($stats['daily'])['active'] >= 2 &&
            $stats['towns']['eras'][0]['era'] === 'frontier' &&
            in_array(2, $stats['towns']['levels'], true),
        'overview stats',
    );

    // Moderation of shared towns.
    $shared = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $town['townId'] . '/settings',
            ['baseRevision' => 1, 'name' => 'Admin Viewed', 'isPublic' => true],
            $player,
        ),
        'owner shares',
    );
    status(
        422,
        adminCall('PATCH', 'towns/' . $town['townId'], ['isPublic' => true], $s),
        'admins never publish',
    );
    status(
        422,
        adminCall('PATCH', 'towns/' . $town['townId'], ['name' => 'fuck town'], $s),
        'moderated public rename',
    );
    status(200, callApi('POST', 'towns', townBody('Taken Name'), $player), 'second town');
    status(
        409,
        adminCall('PATCH', 'towns/' . $town['townId'], ['name' => 'taken name'], $s),
        'owner name uniqueness',
    );
    $renamed = status(
        200,
        adminCall('PATCH', 'towns/' . $town['townId'], ['name' => 'Quiet Creek'], $s),
        'admin rename',
    );
    check(
        $renamed['town']['name'] === 'Quiet Creek' &&
            $renamed['town']['isPublic'] &&
            status(200, callApi('GET', 'villages/' . $shared['publicId']), 'renamed share')[
                'name'
            ] === 'Quiet Creek',
        'rename keeps the share link',
    );
    check(
        !status(
            200,
            adminCall('PATCH', 'towns/' . $town['townId'], ['isPublic' => false], $s),
            'unshare',
        )['town']['isPublic'],
        'unshared',
    );
    status(404, callApi('GET', 'villages/' . $shared['publicId']), 'unshared link closed');
    $card = array_values(
        array_filter(
            status(200, callApi('GET', 'account', null, $player), 'owner list')['towns'],
            fn($t) => $t['townId'] === $town['townId'],
        ),
    )[0];
    check(
        $card['name'] === 'Quiet Creek' && !$card['isPublic'] && $card['revision'] === 1,
        'owner sees moderation without a new revision',
    );

    // Restoring a kept revision saves it as the newest one.
    foreach ([2 => 200, 3 => 300] as $revision => $coins) {
        status(
            200,
            callApi(
                'PUT',
                'towns/' . $town['townId'],
                [
                    'baseRevision' => $revision - 1,
                    'uploadId' => uuid(),
                    'profile' => profile($coins),
                ],
                $player,
            ),
            'save ' . $revision,
        );
    }
    $view = status(200, adminCall('GET', 'towns/' . $town['townId'], null, $s), 'history');
    check(
        array_column($view['history'], 'revision') === [2, 1] &&
            $view['history'][1]['stats']['levels'] === 2,
        'history summaries',
    );
    status(
        404,
        adminCall('POST', 'towns/' . $town['townId'] . '/restore', ['revision' => 99], $s),
        'missing revision',
    );
    status(
        422,
        adminCall('POST', 'towns/' . $town['townId'] . '/restore', ['revision' => '1'], $s),
        'revision type',
    );
    $restored = status(
        200,
        adminCall('POST', 'towns/' . $town['townId'] . '/restore', ['revision' => 1], $s),
        'restore',
    );
    check(
        $restored['town']['revision'] === 4 &&
            $restored['town']['stats']['coins'] === 25 &&
            array_column($restored['history'], 'revision') === [3, 2, 1],
        'restored as a new revision; replaced save kept',
    );
    check(
        status(
            200,
            callApi('GET', 'towns/' . $town['townId'], null, $player),
            'owner reads restore',
        )['profile']['town']['coins'] === 25,
        'owner receives restored save',
    );
    check(
        status(
            409,
            callApi(
                'PUT',
                'towns/' . $town['townId'],
                ['baseRevision' => 3, 'uploadId' => uuid(), 'profile' => profile(999)],
                $player,
            ),
            'stale device',
        )['code'] === 'save_conflict',
        'a device with unsynced progress is asked which save to keep',
    );

    // Once enrolled, recovering old diagnostic records must agree with the client:
    // zero stars are not a completion, while earned records/resources are preserved.
    $diagnosticEnrollment = json_decode(json_encode($body['profile'], JSON_THROW_ON_ERROR));
    unset($diagnosticEnrollment->records->{'3'});
    $diagnosticEnrollment->integrity = (object) [
        'version' => 1,
        'epoch' => uuid(),
        'baseSequence' => 0,
        'actions' => [],
        'clientAt' => (int) floor(microtime(true) * 1000),
    ];
    status(
        200,
        callApi(
            'PUT',
            'towns/' . $town['townId'],
            ['baseRevision' => 4, 'uploadId' => uuid(), 'profile' => $diagnosticEnrollment],
            $player,
        ),
        'enroll legacy town after frontend record normalization',
    );
    $diagnosticRestore = status(
        200,
        adminCall('POST', 'towns/' . $town['townId'] . '/restore', ['revision' => 1], $s),
        'restore pre-integrity diagnostics into tracked town',
    );
    check(
        !isset($diagnosticRestore['profile']['records']['3']) &&
            $diagnosticRestore['profile']['records']['1']['stars'] === 3 &&
            $diagnosticRestore['profile']['records']['2']['stars'] === 2,
        'tracked history recovery drops only unearned diagnostic records',
    );
    check(
        $diagnosticRestore['profile']['town']['coins'] === 25 &&
            $diagnosticRestore['profile']['powers'] === [['id' => 'tnt', 'quantity' => 2]],
        'diagnostic normalization preserves coins and inventory',
    );
    $diagnosticDownload = callApi('GET', 'towns/' . $town['townId'], null, $player);
    status(200, $diagnosticDownload, 'download cleaned historical checkpoint');
    $rawDiagnostic = json_decode($diagnosticDownload['response']->getContent())->profile;
    $diagnosticRoundtrip = callApi(
        'PUT',
        'towns/' . $town['townId'],
        ['baseRevision' => 6, 'uploadId' => uuid(), 'profile' => $rawDiagnostic],
        $player,
    );
    status(200, $diagnosticRoundtrip, 'raw cleaned historical checkpoint roundtrip');
    // Rehydrate the canonical defaults like a normal frontend load of this minimal
    // legacy row, including its five inventory slots and missing town maps.
    $canonical = json_decode(file_get_contents(dirname(__DIR__) . '/content/save-rules.json'))
        ->defaultProfile;
    $canonical->records = $rawDiagnostic->records;
    $canonical->town->coins = $rawDiagnostic->town->coins;
    $canonical->town->buildings->well = $rawDiagnostic->town->buildings->well;
    foreach ($canonical->powers as $power) {
        if ($power->id === 'tnt') {
            $power->quantity = 2;
        }
    }
    $canonical->integrity = json_decode(
        $diagnosticRoundtrip['response']->getContent(),
    )->profile->integrity;
    $normalizedRoundtrip = status(
        200,
        callApi(
            'PUT',
            'towns/' . $town['townId'],
            ['baseRevision' => 7, 'uploadId' => uuid(), 'profile' => $canonical],
            $player,
        ),
        'normalized frontend checkpoint roundtrip',
    );
    check(
        $normalizedRoundtrip['profile']['town']['coins'] === 25 &&
            $normalizedRoundtrip['profile']['powers'][1]['quantity'] === 2,
        'frontend defaults preserve recovered resources and remain syncable',
    );

    // Admin recovery must retain the latest earning ledger and review evidence,
    // while replacing gameplay with the known historical branch and resealing it.
    $fixture = json_decode(file_get_contents(__DIR__ . '/fixtures/integrity-flows.json'))
        ->fixtures[0];
    $before = $fixture->before;
    $after = $fixture->after;
    $now = (int) floor(microtime(true) * 1000);
    $epoch = uuid();
    foreach ([$before, $after] as $moneyProfile) {
        $moneyProfile->integrity->epoch = $epoch;
        $moneyProfile->integrity->clientAt = $now;
        if ($moneyProfile->town->income->at !== null) {
            $moneyProfile->town->income->at = $now;
        }
    }
    foreach ($after->integrity->actions as $action) {
        $action->id = uuid();
        if (isset($action->data->at)) {
            $action->data->at = $now;
        }
        if ($action->kind === 'victory') {
            $action->data->jewels += 1000000000;
            $after->town->coins += 1000000000;
        }
    }
    $_ENV['SAVE_MONEY_GUARD_MODE'] = 'observe';
    $trackedBody = townBody('Audited Restore');
    $trackedBody['profile'] = $before;
    $tracked = status(
        200,
        callApi('POST', 'towns', $trackedBody, $player),
        'attach tracked admin recovery fixture',
    );
    $trackedId = $tracked['townId'];
    $audited = status(
        200,
        callApi(
            'PUT',
            'towns/' . $trackedId,
            ['baseRevision' => 1, 'uploadId' => uuid(), 'profile' => $after],
            $player,
        ),
        'save flagged tracked earnings',
    );
    $latestLedger = $audited['profile']['integrity']['context']['moneyBudget'];
    check(
        $latestLedger['debt'] > 0 &&
            $latestLedger['reviewCount'] === 1 &&
            $latestLedger['lastReview']['status'] === 'review',
        'tracked fixture earns a durable observation flag',
    );
    $oldToken = $tracked['integrity']['checkpoint'];
    // Even an operator's optional hold policy must not block authorized restoration
    // of an already accepted snapshot because of a previously recorded debt.
    $_ENV['SAVE_MONEY_GUARD_MODE'] = 'hold';
    $adminRestored = status(
        200,
        adminCall('POST', 'towns/' . $trackedId . '/restore', ['revision' => 1], $s),
        'admin restores tracked history under optional hold',
    );
    $ledger = $adminRestored['profile']['integrity']['context']['moneyBudget'];
    check(
        $adminRestored['town']['revision'] === 3 &&
            $adminRestored['profile']['town']['coins'] === $before->town->coins &&
            array_column($adminRestored['history'], 'revision') === [2, 1],
        'admin restore replaces known gameplay as a new revision and archives the flagged branch',
    );
    check(
        $ledger['highWater'] === $latestLedger['highWater'] &&
            $ledger['reviewCount'] === $latestLedger['reviewCount'] &&
            $ledger['lastReview'] === $latestLedger['lastReview'],
        'admin restore cannot rewind gross high-water or erase durable review',
    );
    $expectedRemaining =
        $latestLedger['credit'] -
        $latestLedger['debt'] +
        max(0, $ledger['serverAt'] - $latestLedger['serverAt']);
    check(
        $ledger['serverAt'] >= $latestLedger['serverAt'] &&
            abs($ledger['credit'] - $ledger['debt'] - $expectedRemaining) < 0.000001,
        'admin restore accrues only genuine elapsed time without renewed burst',
    );
    check(
        $adminRestored['profile']['integrity']['checkpoint'] !== $oldToken,
        'restored gameplay is resealed with the retained latest ledger',
    );
    $ownerRestored = callApi('GET', 'towns/' . $trackedId, null, $player);
    status(200, $ownerRestored, 'owner downloads admin restore');
    $rawRestored = json_decode($ownerRestored['response']->getContent())->profile;
    $_ENV['SAVE_MONEY_GUARD_MODE'] = 'observe';
    $roundtrip = status(
        200,
        callApi(
            'PUT',
            'towns/' . $trackedId,
            ['baseRevision' => 3, 'uploadId' => uuid(), 'profile' => $rawRestored],
            $player,
        ),
        'untouched admin-restored backup ordinary roundtrip',
    );
    check(
        $roundtrip['integrity']['moneyBudget']['newGrossCharge'] == 0 &&
            $roundtrip['profile']['integrity']['context']['moneyBudget']['reviewCount'] === 1,
        'restored raw cloud backup roundtrips without charging prior earnings again',
    );
    $resealed = json_decode($ownerRestored['response']->getContent())->profile;
    $recovered = status(
        200,
        callApi(
            'PUT',
            'towns/' . $trackedId . '/resolve',
            ['baseRevision' => 4, 'uploadId' => uuid(), 'profile' => $resealed],
            $player,
        ),
        'resealed admin-restored signed backup recovery',
    );
    check(
        $recovered['profile']['integrity']['context']['moneyBudget']['highWater'] ===
            $latestLedger['highWater'] &&
            $recovered['profile']['integrity']['context']['moneyBudget']['reviewCount'] === 1,
        'resealed signed checkpoint verifies during later owner recovery without reset',
    );
    unset($_ENV['SAVE_MONEY_GUARD_MODE']);

    // A blocked sync: the log, the compare, accept next sync and an admin reset.
    $syncPlayer = account();
    $syncProfile = json_decode(file_get_contents(dirname(__DIR__) . '/content/save-rules.json'))
        ->defaultProfile;
    $syncProfile->integrity = (object) [
        'version' => 1,
        'epoch' => uuid(),
        'baseSequence' => 0,
        'clientAt' => time() * 1000,
        'actions' => [],
    ];
    $syncBody = townBody('Desync Gulch');
    $syncBody['profile'] = $syncProfile;
    $synced = status(200, callApi('POST', 'towns', $syncBody, $syncPlayer), 'attach desync town');
    $syncId = $synced['townId'];
    $desynced = json_decode(json_encode($syncProfile));
    $desynced->integrity = json_decode(json_encode($synced['profile']['integrity']));
    $desynced->town->coins += 500;
    $upload = fn(int $revision) => [
        'baseRevision' => $revision,
        'uploadId' => uuid(),
        'profile' => $desynced,
    ];
    $listed = fn(string $filter = 'live') => array_column(
        status(
            200,
            adminCall('GET', 'towns?filter=' . $filter . '&q=' . $syncId, null, $s),
            'list desync town',
        )['towns'],
        null,
        'id',
    )[$syncId] ?? null;
    check(
        $listed()['forceSync'] === false &&
            $listed()['syncBlockedAt'] === null &&
            $listed('blocked') === null,
        'a syncing town is not flagged',
    );
    check(
        status(422, callApi('PUT', 'towns/' . $syncId, $upload(1), $syncPlayer), 'desync')[
            'code'
        ] === 'save_integrity_mismatch',
        'a desync blocks the upload',
    );
    check(
        is_int($listed()['syncBlockedAt']) && $listed('blocked')['id'] === $syncId,
        'the town list flags the blocked town and filters by it',
    );
    $detail = status(200, adminCall('GET', 'towns/' . $syncId, null, $s), 'blocked detail');
    $log = $detail['syncRejections'];
    check(
        count($log) === 1 &&
            $log[0]['code'] === 'save_integrity_mismatch' &&
            $log[0]['field'] === 'town.coins' &&
            $log[0]['revision'] === 1 &&
            $log[0]['replayed'] === true &&
            $detail['town']['syncBlockedAt'] === $log[0]['at'],
        'the sync log names the rejected field ' . json_encode($log),
    );
    $compare = status(
        200,
        adminCall('GET', 'towns/' . $syncId . '/sync/' . $log[0]['id'], null, $s),
        'compare',
    );
    check(
        $compare['current'] === true &&
            $compare['upload']['town']['coins'] === $desynced->town->coins &&
            $compare['expected']['town']['coins'] === $syncProfile->town->coins &&
            $compare['cloud']['town']['coins'] === $syncProfile->town->coins &&
            !isset($compare['expected']['integrity']),
        'the compare shows the cloud save, the replayed expectation and the upload',
    );
    status(
        404,
        adminCall('GET', 'towns/' . $syncId . '/sync/' . str_repeat('0', 32), null, $s),
        'unknown rejection',
    );
    // Retries are kept up to a cap, newest first.
    for ($i = 0; $i < App\SyncRejections::KEPT; $i++) {
        status(422, callApi('PUT', 'towns/' . $syncId, $upload(1), $syncPlayer), 'desync retry');
    }
    check(
        count(
            status(200, adminCall('GET', 'towns/' . $syncId, null, $s), 'capped log')[
                'syncRejections'
            ],
        ) === App\SyncRejections::KEPT,
        'the sync log keeps the latest rejections only',
    );

    // Accept next sync lets exactly one upload through.
    status(
        422,
        adminCall('PATCH', 'towns/' . $syncId . '/sync', ['forceSync' => 1], $s),
        'accept next sync needs a boolean',
    );
    status(
        422,
        adminCall('PATCH', 'towns/' . $syncId . '/sync', ['forceSync' => true, 'name' => 'x'], $s),
        'accept next sync takes no other field',
    );
    check(
        status(
            200,
            adminCall('PATCH', 'towns/' . $syncId . '/sync', ['forceSync' => true], $s),
            'set accept next sync',
        )['forceSync'] === true && $listed()['forceSync'] === true,
        'an admin sets accept next sync from the town list',
    );
    status(
        409,
        callApi('PUT', 'towns/' . $syncId, $upload(0), $syncPlayer),
        'a stale revision still asks which save to keep',
    );
    check($listed()['forceSync'] === true, 'a rejected upload does not use up accept next sync');
    $forcedReply = callApi('PUT', 'towns/' . $syncId, $upload(1), $syncPlayer);
    $forced = status(200, $forcedReply, 'forced upload');
    check(
        $forced['revision'] === 2 &&
            $forced['profile']['town']['coins'] === $desynced->town->coins &&
            $forced['integrity']['status'] === 'baseline' &&
            $listed()['forceSync'] === false &&
            $listed()['syncBlockedAt'] === null,
        'the next upload is re-baselined, accept next sync clears itself and so does the flag',
    );
    status(
        200,
        callApi(
            'PUT',
            'towns/' . $syncId,
            [
                'baseRevision' => 2,
                'uploadId' => uuid(),
                'profile' => json_decode($forcedReply['response']->getContent())->profile,
            ],
            $syncPlayer,
        ),
        'the re-baselined town keeps syncing normally',
    );
    $desynced->integrity = json_decode(json_encode($forced['profile']['integrity']));
    $desynced->town->coins += 500;
    check(
        status(422, callApi('PUT', 'towns/' . $syncId, $upload(3), $syncPlayer), 'desync again')[
            'code'
        ] === 'save_integrity_mismatch',
        'only one upload skips the desync check',
    );
    status(
        200,
        adminCall('PATCH', 'towns/' . $syncId . '/sync', ['forceSync' => true], $s),
        'set accept next sync again',
    );
    check(
        status(
            200,
            adminCall('PATCH', 'towns/' . $syncId . '/sync', ['forceSync' => false], $s),
            'clear accept next sync',
        )['forceSync'] === false && $listed()['forceSync'] === false,
        'an admin clears accept next sync before it is used',
    );

    // An admin edits the compared save and the owner's game loads it.
    $latest = status(200, adminCall('GET', 'towns/' . $syncId, null, $s), 'blocked again')[
        'syncRejections'
    ][0];
    check($latest['revision'] === 3, 'the newest rejection is listed first');
    $resetPath = 'towns/' . $syncId . '/sync/' . $latest['id'] . '/reset';
    $stale = status(200, adminCall('GET', 'towns/' . $syncId, null, $s), 'older rejection')[
        'syncRejections'
    ];
    status(
        409,
        adminCall(
            'POST',
            'towns/' . $syncId . '/sync/' . end($stale)['id'] . '/reset',
            ['base' => 'cloud', 'changes' => []],
            $s,
        ),
        'a rejection from an older revision cannot reset the town',
    );
    status(422, adminCall('POST', $resetPath, ['base' => 'x', 'changes' => []], $s), 'reset base');
    foreach (
        [
            ['path' => ['integrity', 'epoch'], 'value' => 'x'],
            ['path' => ['town', 'nowhere', 'deep'], 'value' => 1],
            ['path' => 'town.coins', 'value' => 1],
            ['path' => ['town', 'coins']],
        ]
        as $change
    ) {
        status(
            422,
            adminCall('POST', $resetPath, ['base' => 'upload', 'changes' => [$change]], $s),
            'reset path ' . json_encode($change),
        );
    }
    status(
        422,
        adminCall(
            'POST',
            $resetPath,
            ['base' => 'upload', 'changes' => [['path' => ['town', 'coins'], 'value' => -5]]],
            $s,
        ),
        'an edited save is still validated',
    );
    $reset = status(
        200,
        adminCall(
            'POST',
            $resetPath,
            [
                'base' => 'upload',
                'changes' => [
                    ['path' => ['town', 'coins'], 'value' => 777],
                    ['path' => ['powers', 'tnt'], 'value' => 3],
                ],
            ],
            $s,
        ),
        'admin reset',
    );
    check(
        $reset['town']['revision'] === 4 &&
            $reset['profile']['town']['coins'] === 777 &&
            $reset['profile']['integrity']['status'] === 'baseline' &&
            $reset['town']['syncBlockedAt'] === null &&
            !$reset['town']['forceSync'] &&
            in_array(
                ['id' => 'tnt', 'quantity' => 3],
                array_map(
                    fn($power) => ['id' => $power['id'], 'quantity' => $power['quantity']],
                    $reset['profile']['powers'],
                ),
                true,
            ),
        'the edited save is a new sealed revision and clears the flag',
    );
    $conflict = status(
        409,
        callApi('PUT', 'towns/' . $syncId, $upload(3), $syncPlayer),
        'the blocked game meets the reset',
    );
    check(
        $conflict['code'] === 'save_conflict' &&
            $conflict['cloud']['adminReset'] === true &&
            $conflict['cloud']['profile']['town']['coins'] === 777,
        'the owner game is told to load the admin reset',
    );
    $owned = json_decode(
        callApi('GET', 'towns/' . $syncId, null, $syncPlayer)['response']->getContent(),
    );
    status(
        200,
        callApi(
            'PUT',
            'towns/' . $syncId,
            ['baseRevision' => 4, 'uploadId' => uuid(), 'profile' => $owned->profile],
            $syncPlayer,
        ),
        'the game syncs from the reset',
    );
    check(
        !isset(
            status(200, callApi('GET', 'towns/' . $syncId, null, $syncPlayer), 'after')[
                'adminReset'
            ],
        ),
        'the reset notice ends with the next accepted save',
    );

    // Deletion, sign-out and account removal.
    status(
        422,
        adminCall('DELETE', 'towns/' . $town['townId'], ['confirmation' => 'wrong'], $s),
        'town confirmation',
    );
    status(
        200,
        adminCall('DELETE', 'towns/' . $town['townId'], ['confirmation' => 'Quiet Creek'], $s),
        'delete town',
    );
    status(
        404,
        callApi('GET', 'towns/' . $town['townId'], null, $player),
        'owner lost deleted town',
    );
    check(
        status(200, adminCall('GET', 'towns/' . $town['townId'], null, $s), 'deleted town')['town'][
            'deletedAt'
        ] >=
            time() - 5,
        'tombstone visible',
    );
    status(
        409,
        adminCall('PATCH', 'towns/' . $town['townId'], ['name' => 'Back Again'], $s),
        'deleted town is read-only',
    );
    status(
        409,
        adminCall('PATCH', 'towns/' . $town['townId'] . '/sync', ['forceSync' => true], $s),
        'a deleted town cannot accept a sync',
    );
    check(
        status(
            200,
            adminCall('GET', 'towns?filter=deleted&q=' . $town['townId'], null, $s),
            'deleted filter',
        )['total'] === 1,
        'deleted towns listed',
    );
    check(
        status(
            200,
            adminCall('POST', 'players/' . $player['id'] . '/sign-out', (object) [], $s),
            'sign out player',
        )['sessions'] === 1,
        'sessions revoked',
    );
    status(401, callApi('GET', 'account', null, $player), 'player signed out everywhere');
    // Player distinctions are given and removed through the admin HTTP routes.
    $distinction = 'players/' . $player['id'] . '/distinctions/player-alpha';
    $state = fn(array $reply) => array_column($reply['distinctions'], 'state', 'id')[
        'player-alpha'
    ];
    check(
        $state(status(200, adminCall('POST', $distinction, (object) [], $s), 'give')) === 'held' &&
            $state(status(200, adminCall('DELETE', $distinction, (object) [], $s), 'remove')) ===
                'removed',
        'an admin gives and removes a player distinction',
    );
    status(405, adminCall('PATCH', $distinction, (object) [], $s), 'distinction method');
    status(
        404,
        adminCall(
            'POST',
            'players/' . $player['id'] . '/distinctions/player-nope',
            (object) [],
            $s,
        ),
        'unknown distinction',
    );
    status(401, adminCall('POST', $distinction, (object) [], []), 'distinctions need an admin');
    status(
        422,
        adminCall('DELETE', 'players/' . $player['id'], ['confirmation' => 'nope'], $s),
        'account confirmation',
    );
    status(
        200,
        adminCall('DELETE', 'players/' . $player['id'], ['confirmation' => $p['email']], $s),
        'delete account',
    );
    status(404, adminCall('GET', 'players/' . $player['id'], null, $s), 'account deleted');
    check(
        $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM player_activity WHERE player_id=?', [$player['id']]) ==
            0,
        'activity deleted with the account',
    );

    // Equal admins manage each other, never themselves.
    $third = status(
        200,
        adminCall('POST', 'admins', ['username' => 'third-' . bin2hex(random_bytes(3))], $s),
        'add admin',
    );
    $adminIds[] = $db
        ->get()
        ->fetchOne('SELECT id FROM admins WHERE username=?', [$third['username']]);
    status(
        409,
        adminCall('POST', 'admins', ['username' => $third['username']], $s),
        'duplicate admin',
    );
    $list = status(200, adminCall('GET', 'admins', null, $s), 'admins');
    $byName = array_column($list['admins'], null, 'username');
    check(
        $list['self'] === $first['username'] &&
            $byName[$third['username']]['mustChangePassword'] &&
            !$byName[$third['username']]['authenticator'] &&
            $byName[$second]['authenticator'],
        'admin list',
    );
    $selfId = $byName[$first['username']]['id'];
    $secondId = $byName[$second]['id'];
    foreach (['reset-password', 'reset-authenticator'] as $action) {
        status(
            409,
            adminCall('POST', 'admins/' . $selfId . '/' . $action, (object) [], $s),
            'no self ' . $action,
        );
    }
    status(409, adminCall('DELETE', 'admins/' . $selfId, (object) [], $s), 'no self delete');
    $reset = status(
        200,
        adminCall('POST', 'admins/' . $secondId . '/reset-password', (object) [], $s),
        'reset password',
    );
    status(401, adminCall('GET', 'me', null, $s2), 'reset signs the admin out');
    status(
        401,
        adminCall('POST', 'login', [
            'username' => $second,
            'password' => 'another long passphrase',
        ]),
        'old password gone',
    );
    $again = adminLogin($second, $reset['password']);
    check($again['stage'] === 'totp', 'reset password keeps the authenticator');
    status(
        200,
        adminCall('POST', 'admins/' . $secondId . '/reset-authenticator', (object) [], $s),
        'reset authenticator',
    );
    check(
        adminLogin($second, $reset['password'])['stage'] === 'change',
        'then the password, then a new authenticator',
    );
    status(200, adminCall('DELETE', 'admins/' . $secondId, (object) [], $s), 'delete admin');
    status(404, adminCall('DELETE', 'admins/' . $secondId, (object) [], $s), 'already deleted');
    // Outside the forced change, changing one's own password needs the current one.
    status(
        422,
        adminCall(
            'POST',
            'password',
            ['current' => 'wrong', 'password' => 'a brand new passphrase'],
            $s,
        ),
        'own password change needs the current password',
    );
    check(
        status(
            200,
            adminCall(
                'POST',
                'password',
                ['current' => $password, 'password' => 'a brand new passphrase'],
                $s,
            ),
            'change own password',
        )['stage'] === 'full',
        'own password changed',
    );
    $log = status(200, adminCall('GET', 'audit', null, $s), 'audit')['entries'];
    $actions = array_column($log, 'action');
    foreach (
        [
            'sign_in_failed',
            'password_changed',
            'authenticator_enrolled',
            'signed_in',
            'code_attempts_exceeded',
            'town_renamed',
            'town_unshared',
            'town_restored',
            'town_sync_forced',
            'town_sync_force_cleared',
            'town_sync_reset',
            'town_deleted',
            'player_signed_out',
            'player_deleted',
            'admin_created',
            'admin_password_reset',
            'admin_authenticator_reset',
            'admin_deleted',
        ]
        as $action
    ) {
        check(in_array($action, $actions, true), 'audited ' . $action);
    }
    $deleted = array_values(
        array_filter($log, fn($entry) => $entry['action'] === 'player_deleted'),
    )[0];
    check(
        $deleted['target'] === $player['id'] && !str_contains(json_encode($log), $p['email']),
        'deleted email not kept in the log',
    );

    // The activity log keeps three months unless changed, and can be purged by hand.
    $audit = fn() => status(200, adminCall('GET', 'audit', null, $s), 'audit');
    check($audit()['retentionDays'] === 90, 'the activity log is kept for three months');
    $stale = fn(int $days) => $db->get()->insert('admin_audit', [
        'at' => time() - $days * 86400,
        'admin' => 'retention-test',
        'action' => 'sign_in',
    ]);
    $kept = fn() => (int) $db
        ->get()
        ->fetchOne("SELECT COUNT(*) FROM admin_audit WHERE admin='retention-test'");
    $stale(100);
    $stale(200);
    $audit();
    check($kept() === 0, 'opening the log removes entries older than three months');
    status(
        422,
        adminCall('PATCH', 'audit/settings', ['retentionDays' => 45], $s),
        'retention outside the offered choices',
    );
    $stale(100);
    $stale(200);
    check(
        status(
            200,
            adminCall('PATCH', 'audit/settings', ['retentionDays' => 180], $s),
            'keep six months',
        )['purged'] === 1 &&
            $audit()['retentionDays'] === 180 &&
            $kept() === 1,
        'a longer retention keeps newer entries and removes older ones at once',
    );
    $db->get()->update('admin_settings', ['value' => '30'], ['name' => 'audit_retention_days']);
    check(
        App\AdminService::expireAudit($db->get()) >= 1 && $kept() === 0,
        'the daily cleanup applies the retention',
    );
    $stale(1);
    check(
        status(200, adminCall('POST', 'audit/purge', ['all' => false], $s), 'purge old')[
            'purged'
        ] === 0 && $kept() === 1,
        'purging old entries keeps recent ones',
    );
    status(200, adminCall('POST', 'audit/purge', ['all' => true], $s), 'purge everything');
    $remaining = $audit()['entries'];
    check(
        $kept() === 0 &&
            count($remaining) === 1 &&
            $remaining[0]['action'] === 'audit_purged' &&
            str_ends_with($remaining[0]['detail'], ', all'),
        'purging everything leaves only the record of the purge',
    );
    status(401, adminCall('POST', 'audit/purge', ['all' => true], []), 'purge needs an admin');
    status(
        422,
        adminCall('POST', 'audit/purge', ['everything' => true], $s),
        'purge rejects unknown fields',
    );
    $db->get()->update('admin_settings', ['value' => '90'], ['name' => 'audit_retention_days']);

    // The privacy contact is set in the panel and shown to everyone on /privacy.
    $db->get()->delete('admin_settings', ['name' => 'privacy_contact']);
    $publicContact = fn() => status(200, callApi('GET', 'privacy'), 'public contact')['contact'];
    check(
        status(200, adminCall('GET', 'settings', null, $s), 'settings')['privacyContact'] === '' &&
            $publicContact() === null,
        'no privacy contact until an admin sets one',
    );
    status(401, adminCall('GET', 'settings', null, []), 'settings need an admin');
    status(
        401,
        adminCall('PATCH', 'settings/privacy', ['privacyContact' => 'x@example.test'], []),
        'changing the contact needs an admin',
    );
    foreach (['not an address', 42, null] as $bad) {
        status(
            422,
            adminCall('PATCH', 'settings/privacy', ['privacyContact' => $bad], $s),
            'invalid privacy contact',
        );
    }
    status(
        422,
        adminCall('PATCH', 'settings/privacy', ['contact' => 'x@example.test'], $s),
        'unknown settings field',
    );
    check(
        status(
            200,
            adminCall(
                'PATCH',
                'settings/privacy',
                ['privacyContact' => '  Privacy@Example.test '],
                $s,
            ),
            'set contact',
        )['privacyContact'] === 'privacy@example.test' &&
            $publicContact() === 'privacy@example.test' &&
            status(200, adminCall('GET', 'settings', null, $s), 'settings')['privacyContact'] ===
                'privacy@example.test',
        'the contact is normalised, stored and published',
    );
    $changes = array_values(
        array_filter($audit()['entries'], fn($e) => $e['action'] === 'privacy_contact_changed'),
    );
    check(
        count($changes) === 1 && $changes[0]['detail'] === 'none → privacy@example.test',
        'changing the contact is logged',
    );
    check(
        App\SiteSettings::contactHint($db->get()) === 'write to privacy@example.test',
        'account emails point to the contact',
    );
    status(
        200,
        adminCall('PATCH', 'settings/privacy', ['privacyContact' => ''], $s),
        'clear contact',
    );
    check(
        $publicContact() === null &&
            App\SiteSettings::contactHint($db->get()) === 'reply to this email' &&
            !$db->get()->fetchOne("SELECT value FROM admin_settings WHERE name='privacy_contact'"),
        'an empty contact removes the setting',
    );

    // Sign-in brute force is limited per client address.
    $ip = '10.' . random_int(0, 255) . '.' . random_int(0, 255) . '.' . random_int(1, 254);
    for ($i = 0; $i < 10; $i++) {
        status(
            401,
            adminCall('POST', 'login', [
                'username' => $third['username'],
                'password' => 'guess ' . $i,
            ]),
            'guess ' . $i,
        );
    }
    status(
        429,
        adminCall('POST', 'login', [
            'username' => $third['username'],
            'password' => $third['password'],
        ]),
        'login rate limit',
    );

    // Server command for the first admin and lock-out recovery.
    $ip = '10.' . random_int(0, 255) . '.' . random_int(0, 255) . '.' . random_int(1, 254);
    $cli = function (string ...$args): array {
        $env = [
            'DATABASE_URL' => $_ENV['DATABASE_URL'],
            'APP_ORIGIN' => $_ENV['APP_ORIGIN'],
            'APP_SECRET' => $_ENV['APP_SECRET'],
            'PATH' => getenv('PATH'),
        ];
        $process = proc_open(
            [PHP_BINARY, dirname(__DIR__) . '/bin/admin.php', ...$args],
            [1 => ['pipe', 'w'], 2 => ['pipe', 'w']],
            $pipes,
            null,
            $env,
        );
        $out = stream_get_contents($pipes[1]) . stream_get_contents($pipes[2]);
        return [proc_close($process), $out];
    };
    $name = 'cli-' . bin2hex(random_bytes(3));
    [$exit, $out] = $cli('create', $name);
    $adminIds[] = $db->get()->fetchOne('SELECT id FROM admins WHERE username=?', [$name]);
    check(
        $exit === 0 &&
            preg_match('/: ([a-zA-Z0-9-]{23})\n/', $out, $m) === 1 &&
            adminLogin($name, $m[1])['stage'] === 'change',
        'CLI creates an admin with a temporary password',
    );
    check($cli('list')[0] === 0 && str_contains($cli('list')[1], $name), 'CLI lists admins');
    check(
        $cli('reset-authenticator', $name)[0] === 0 && $cli('reset-password', $name)[0] === 0,
        'CLI recovery',
    );
    check(
        $cli('delete', $name)[0] === 0 &&
            $cli('delete', $name)[0] === 1 &&
            $cli('unknown')[0] === 2,
        'CLI delete and usage',
    );
    echo "Admin checks passed ($count assertions).\n";
} finally {
    foreach (array_filter($adminIds) as $id) {
        $db->get()->delete('admins', ['id' => $id]);
    }
    cleanup();
}
