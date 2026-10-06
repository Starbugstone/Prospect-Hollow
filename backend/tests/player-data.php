<?php
// The player's own data: overview, export, email change and complete account erasure,
// including that other players keep the visits an erased account paid them.
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService};
$dataTestIp = '127.' . random_int(1, 254) . '.' . random_int(1, 254) . '.' . random_int(1, 254);
function dataApi(string $method, string $path, mixed $body = null, array $session = []): array
{
    global $dataTestIp;
    return callApi($method, $path, $body, $session, ['REMOTE_ADDR' => $dataTestIp]);
}
function email(string $id): string
{
    global $db;
    return (string) $db->get()->fetchOne('SELECT email FROM players WHERE id=?', [$id]);
}
// Opens a shared town and records one live visit, then leaves.
function visit(string $publicId, array $session): void
{
    $presence = 'villages/' . $publicId . '/presence';
    $token = bin2hex(random_bytes(32));
    status(
        200,
        dataApi(
            'POST',
            $presence,
            ['token' => $token, 'browserToken' => bin2hex(random_bytes(32)), 'sequence' => 1],
            $session,
        ),
        'join',
    );
    status(200, dataApi('DELETE', $presence, ['token' => $token, 'sequence' => 2]), 'leave');
}
function shared(array $owner, string $name): array
{
    $body = townBody($name);
    $town = status(200, dataApi('POST', 'towns', $body, $owner), 'create ' . $name);
    $town['publicId'] = status(
        200,
        dataApi(
            'PATCH',
            'towns/' . $town['townId'] . '/settings',
            ['baseRevision' => 1, 'name' => $name, 'isPublic' => true],
            $owner,
        ),
        'share ' . $name,
    )['publicId'];
    return $town;
}
function guests(string $townId, array $owner): array
{
    return status(200, dataApi('GET', 'towns/' . $townId . '/visitors', null, $owner), 'guests');
}
try {
    // Its own address keeps the shared 127.0.0.1 sign-in limit for the other suites.
    $host = account(['REMOTE_ADDR' => $dataTestIp]);
    $named = account(['REMOTE_ADDR' => $dataTestIp]);
    $nameless = account(['REMOTE_ADDR' => $dataTestIp]);
    $private = account(['REMOTE_ADDR' => $dataTestIp]);
    $hostTown = shared($host, 'Lantern Rest');
    $namedHome = shared($named, 'Copper Ridge');
    // No public name: the guestbook shows "Mayor of Dust Flats" until the account goes.
    status(200, dataApi('POST', 'towns', townBody('Dust Flats'), $nameless), 'nameless home');
    $privateHome = status(
        200,
        dataApi('POST', 'towns', townBody('Quiet Hollow'), $private),
        'private home',
    );
    status(
        200,
        dataApi('PATCH', 'account/profile', ['displayName' => 'Clementine'], $named),
        'public name',
    );
    $privacy = status(
        200,
        dataApi(
            'PATCH',
            'account/profile',
            ['displayName' => 'Hidden Mayor', 'anonymousVisits' => true],
            $private,
        ),
        'private visits',
    );
    check($privacy['profile']['anonymousVisits'] === true, 'private visits are saved');
    $kept = status(
        200,
        dataApi('PATCH', 'account/profile', ['displayName' => 'Hidden Mayor'], $private),
        'rename keeps the choice',
    );
    check($kept['profile']['anonymousVisits'] === true, 'an update without the choice keeps it');
    status(
        422,
        dataApi(
            'PATCH',
            'account/profile',
            ['displayName' => 'Hidden Mayor', 'anonymousVisits' => 'yes'],
            $private,
        ),
        'private visits need a boolean',
    );

    // Three signed-in visitors, the named one twice; a signed-out visit never counts.
    visit($hostTown['publicId'], $named);
    visit($hostTown['publicId'], $named);
    visit($hostTown['publicId'], $nameless);
    visit($hostTown['publicId'], $private);
    visit($hostTown['publicId'], []);
    $before = guests($hostTown['townId'], $host);
    check($before['uniqueVisitors'] === 3, 'signed-in visitors count once each');
    $hidden = array_values(
        array_filter($before['history'], fn($v) => $v['name'] === '' && $v['townName'] === null),
    );
    check(
        count($hidden) === 2 && array_column($hidden, 'publicId') === [null, null],
        'a private visit shows neither name nor home town, like a signed-out one',
    );
    check(
        count(array_filter($before['history'], fn($v) => $v['townName'] === 'Dust Flats')) === 1,
        'a visitor without a public name shows their home town',
    );
    check(
        count(array_filter($before['history'], fn($v) => $v['name'] === 'Clementine')) === 2 &&
            in_array($namedHome['publicId'], array_column($before['history'], 'publicId'), true),
        'a named visitor links their shared home town',
    );
    $privateTravels = (int) $db
        ->get()
        ->fetchOne(sprintf(App\Honours::TRAVELS, 'id'), [$privateHome['townId']]);
    check($privateTravels === 1, 'a private visit still counts for the visitor’s travels');

    // Overview and export of the named visitor.
    status(401, dataApi('GET', 'account/data'), 'overview needs sign in');
    status(401, dataApi('GET', 'account/export'), 'export needs sign in');
    $summary = status(200, dataApi('GET', 'account/data', null, $named), 'overview');
    check(
        $summary['email'] === email($named['id']) &&
            $summary['publicName'] === 'Clementine' &&
            $summary['towns'] === 1 &&
            $summary['savedVersions'] === 1 &&
            $summary['visits'] === 2 &&
            $summary['townsVisited'] === 1 &&
            $summary['sessions'] === 1 &&
            $summary['emailSignIns'] === 1 &&
            $summary['lastIp'] === $dataTestIp &&
            $summary['activeDays'] === 1 &&
            $summary['pendingEmail'] === null,
        'the overview counts what is kept ' . json_encode($summary),
    );
    $export = status(200, dataApi('GET', 'account/export', null, $named), 'export');
    check(
        $export['account']['email'] === email($named['id']) &&
            $export['account']['id'] === $named['id'] &&
            $export['publicProfile']['publicName'] === 'Clementine' &&
            $export['activity']['lastIpAddress'] === $dataTestIp &&
            count($export['activity']['activeDays']) === 1 &&
            count($export['signedInDevices']) === 1 &&
            $export['towns'][0]['name'] === 'Copper Ridge' &&
            $export['towns'][0]['save']['town']['coins'] === 25 &&
            $export['towns'][0]['earlierSaves'] === [] &&
            count($export['visitsMade']) === 2 &&
            $export['visitsMade'][0]['town'] === 'Lantern Rest' &&
            $export['visitsMade'][0]['shownAs'] === 'Clementine',
        'the export holds the account, activity, towns and visits ' .
            json_encode(array_diff_key($export, ['towns' => 1])),
    );
    $hostExport = status(200, dataApi('GET', 'account/export', null, $host), 'host export');
    $hostJson = json_encode($hostExport);
    check(
        $hostExport['towns'][0]['differentSignedInVisitors'] === 3 &&
            !str_contains($hostJson, 'Clementine') &&
            !str_contains($hostJson, email($named['id'])),
        'a host’s export counts visitors without naming them',
    );
    check(
        !str_contains(json_encode($export), $named['cookie']) &&
            !str_contains(json_encode($export), $named['csrf']),
        'the export holds no session secret',
    );
    for ($i = 1; $i < 10; $i++) {
        dataApi('GET', 'account/export', null, $named);
    }
    status(429, dataApi('GET', 'account/export', null, $named), 'export rate limit');

    // Email change: the link to the new address proves it; the old address lets go.
    $old = email($nameless['id']);
    status(
        422,
        dataApi('POST', 'account/email', ['email' => 'not an email'], $nameless),
        'invalid address',
    );
    status(
        422,
        dataApi('POST', 'account/email', ['email' => strtoupper($old)], $nameless),
        'same address',
    );
    status(
        403,
        callApi('POST', 'account/email', ['email' => 'x@example.test'], $nameless, [
            'HTTP_X_CSRF_TOKEN' => 'bad',
        ]),
        'email change csrf',
    );
    $new = 'moved-' . bin2hex(random_bytes(6)) . '@example.test';
    status(
        200,
        dataApi('POST', 'account/email', ['email' => $new], $nameless),
        'request email change',
    );
    check(email($nameless['id']) === $old, 'nothing changes before confirmation');
    check(
        status(200, dataApi('GET', 'account/data', null, $nameless), 'pending')['pendingEmail'] ===
            $new,
        'the overview shows the pending address',
    );
    // The mailed token is unknown here, so replace the stored hash with a known one.
    $token = bin2hex(random_bytes(32));
    $db->get()->update(
        'email_changes',
        ['token_hash' => $auth->hash($token)],
        ['player_id' => $nameless['id']],
    );
    status(
        422,
        dataApi('POST', 'account/email/confirm', ['token' => 'nope']),
        'malformed confirmation',
    );
    $confirmed = status(
        200,
        dataApi('POST', 'account/email/confirm', ['token' => $token]),
        'confirm without a session',
    );
    check(
        $confirmed === ['email' => $new] && email($nameless['id']) === $new,
        'the account now uses the new address',
    );
    status(
        401,
        dataApi('POST', 'account/email/confirm', ['token' => $token]),
        'a used link expires',
    );
    check(
        !$db
            ->get()
            ->fetchOne('SELECT email_hash FROM identities WHERE email_hash=?', [
                $auth->identityHash($old),
            ]),
        'the old address leaves no identity row',
    );
    status(200, dataApi('GET', 'account', null, $nameless), 'the session survives the change');
    // An address another account already uses is refused when the link is opened.
    $taken = email($host['id']);
    status(200, dataApi('POST', 'account/email', ['email' => $taken], $nameless), 'request');
    $db->get()->update(
        'email_changes',
        ['token_hash' => $auth->hash($token)],
        ['player_id' => $nameless['id']],
    );
    status(
        409,
        dataApi('POST', 'account/email/confirm', ['token' => $token]),
        'address taken by another account',
    );
    $db->get()->update(
        'email_changes',
        ['expires_at' => time() - 1],
        ['player_id' => $nameless['id']],
    );
    status(401, dataApi('POST', 'account/email/confirm', ['token' => $token]), 'expired link');

    // Erasure: every visitor deletes their account; the host keeps all three visits.
    $namedEmail = email($named['id']);
    status(
        422,
        dataApi('DELETE', 'account', ['confirmation' => 'delete'], $named),
        'deletion needs the phrase',
    );
    status(
        200,
        dataApi('DELETE', 'account', ['confirmation' => 'DELETE MY ACCOUNT'], $named),
        'delete the named visitor',
    );
    status(
        200,
        dataApi('DELETE', 'account', ['confirmation' => 'DELETE MY ACCOUNT'], $nameless),
        'delete the nameless visitor',
    );
    // The admin panel erases the same way.
    $admin = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
    $admin->deletePlayer('player-data-test', $private['id'], [
        'confirmation' => email($private['id']),
    ]);
    $after = guests($hostTown['townId'], $host);
    check(
        $after['uniqueVisitors'] === 3,
        'visits keep counting after their visitors erase their accounts ' .
            json_encode($after['uniqueVisitors']),
    );
    check(
        count($after['history']) === count($before['history']) &&
            count(
                array_filter(
                    $after['history'],
                    fn($v) => $v['name'] === '' &&
                        $v['townName'] === null &&
                        $v['publicId'] === null,
                ),
            ) === count($after['history']),
        'the guestbook keeps the visits without any name or home town',
    );
    $keys = $db
        ->get()
        ->fetchAllAssociative(
            'SELECT visitor_key,COUNT(*) AS visits FROM visitor_visits WHERE town_id=? AND signed_in=1 GROUP BY visitor_key',
            [$hostTown['townId']],
        );
    check(
        count($keys) === 3 &&
            in_array(2, array_map('intval', array_column($keys, 'visits')), true) &&
            !array_intersect(array_column($keys, 'visitor_key'), [
                $auth->visitorKey($named['id']),
                $auth->visitorKey($nameless['id']),
                $auth->visitorKey($private['id']),
            ]),
        'each erased visitor keeps one key unrelated to the account',
    );
    foreach (
        [
            'SELECT COUNT(*) FROM players WHERE id IN (?,?,?)',
            'SELECT COUNT(*) FROM towns WHERE player_id IN (?,?,?)',
            'SELECT COUNT(*) FROM player_profiles WHERE player_id IN (?,?,?)',
            'SELECT COUNT(*) FROM player_activity WHERE player_id IN (?,?,?)',
            'SELECT COUNT(*) FROM activity_days WHERE player_id IN (?,?,?)',
            'SELECT COUNT(*) FROM sessions WHERE player_id IN (?,?,?)',
            'SELECT COUNT(*) FROM email_changes WHERE player_id IN (?,?,?)',
        ]
        as $query
    ) {
        check(
            (int) $db->get()->fetchOne($query, [$named['id'], $nameless['id'], $private['id']]) ===
                0,
            'nothing of the erased accounts is left: ' . $query,
        );
    }
    check(
        !$db
            ->get()
            ->fetchOne('SELECT email_hash FROM identities WHERE email_hash IN (?,?)', [
                $auth->identityHash($namedEmail),
                $auth->identityHash($new),
            ]) &&
            !$db->get()->fetchOne('SELECT email FROM login_intents WHERE email=?', [$namedEmail]),
        'the erased email leaves no identity row or sign-in link',
    );
    check(
        !str_contains(
            json_encode(
                $db
                    ->get()
                    ->fetchAllAssociative('SELECT * FROM visitor_visits WHERE town_id=?', [
                        $hostTown['townId'],
                    ]),
            ),
            'Clementine',
        ),
        'no erased public name stays in the guestbook',
    );
    status(401, dataApi('GET', 'account/data', null, $named), 'the erased session is gone');
    echo "Player data checks passed ($count assertions).\n";
} finally {
    cleanup();
}
