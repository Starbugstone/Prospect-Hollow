<?php
// Player distinctions on the server, which alone decides who holds them: the time
// ladder, the account reply, event grants, and what visitors and the directory receive:
// at most one distinction per town, only while its owner holds it, at the current step.
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService, PlayerDistinctions};

$ms = fn(string $at): int => (int) (new DateTimeImmutable($at))->format('Uv');
foreach (
    json_decode(
        file_get_contents(__DIR__ . '/fixtures/tenure-steps.json'),
        true,
        8,
        JSON_THROW_ON_ERROR,
    )
    as $case
) {
    $expected = $case['expected'];
    if ($expected !== null) {
        $expected['at'] = $ms($expected['at']);
        $expected['next']['at'] = $ms($expected['next']['at']);
    }
    check(
        PlayerDistinctions::tenure($ms($case['since']), $ms($case['now'])) === $expected,
        'time distinction: ' . $case['label'],
    );
}

// The ladder is data: another step extends it without new code.
$since = $ms('2026-01-10T12:00:00Z');
$decades = [...PlayerDistinctions::STEPS, ['unit' => 'decade', 'months' => 120]];
$eightYears = PlayerDistinctions::tenure($since, $ms('2034-03-01T00:00:00Z'), $decades);
check(
    $eightYears['unit'] === 'year' &&
        $eightYears['count'] === 8 &&
        $eightYears['next'] === [
            'unit' => 'year',
            'count' => 9,
            'at' => $ms('2035-01-10T12:00:00Z'),
        ],
    'years continue below a later step',
);
check(
    PlayerDistinctions::tenure($since, $ms('2036-01-10T12:00:00Z'), $decades)['unit'] ===
        'decade' &&
        PlayerDistinctions::tenure($since, $ms('2035-12-31T00:00:00Z'), $decades)['next'][
            'unit'
        ] === 'decade',
    'a later step takes over at its first unit',
);
check(
    PlayerDistinctions::tenure($since, $since + 36600 * 86400000)['count'] === 100,
    'years have no end',
);

$distinctions = PlayerDistinctions::load();
$name = fn(string $prefix): string => $prefix . ' ' . bin2hex(random_bytes(3));
// Shares a town whose saved showcase lists $showcase, as an older or edited save might.
$share = function (array $owner, string $town, array $showcase): string {
    $body = townBody($town);
    $body['profile']->honours = (object) [
        'version' => 1,
        'earned' => new stdClass(),
        'showcase' => $showcase,
    ];
    $id = status(200, callApi('POST', 'towns', $body, $owner), 'create ' . $town)['townId'];
    return status(
        200,
        callApi(
            'PATCH',
            'towns/' . $id . '/settings',
            ['baseRevision' => 1, 'name' => $town, 'isPublic' => true],
            $owner,
        ),
        'share ' . $town,
    )['publicId'];
};
$visit = fn(string $public): array => status(200, callApi('GET', 'villages/' . $public), 'visit')[
    'appearance'
]['honours'];

try {
    // ---------- The account reply ----------
    $owner = account();
    check(
        status(200, callApi('GET', 'account', null, $owner), 'account')['account'][
            'distinctions'
        ] === [],
        'a new account holds no distinction',
    );
    $since = time() - 400 * 86400;
    $db->get()->update('players', ['created_at' => $since], ['id' => $owner['id']]);
    $account = status(200, callApi('GET', 'account', null, $owner), 'account')['account'];
    check(
        !array_key_exists('since', $account) &&
            array_keys($account['distinctions']) === ['player-time'] &&
            $account['distinctions']['player-time']['at'] ===
                PlayerDistinctions::addMonths($since * 1000, 12) &&
            $account['distinctions']['player-time']['tenure'] === [
                'unit' => 'year',
                'count' => 1,
                'next' => [
                    'unit' => 'year',
                    'count' => 2,
                    'at' => PlayerDistinctions::addMonths($since * 1000, 24),
                ],
            ],
        'the server decides the time step from the first sign-in and its own clock',
    );

    // ---------- Event grants ----------
    check(
        $distinctions->award($db->get(), 'player-alpha', $owner['id'], 1700000000) === 1 &&
            $distinctions->award($db->get(), 'player-alpha', $owner['id'], 1800000000) === 0,
        'an event distinction is granted once',
    );
    check(
        status(200, callApi('GET', 'account', null, $owner), 'account')['account']['distinctions'][
            'player-alpha'
        ] === ['at' => 1700000000000],
        'the account lists it with the first grant date',
    );
    foreach (['player-time', 'player-unknown'] as $invalid) {
        try {
            $distinctions->award($db->get(), $invalid, $owner['id']);
            check(false, "$invalid cannot be granted");
        } catch (InvalidArgumentException) {
            check(true, "$invalid cannot be granted");
        }
    }
    $late = account();
    check(
        $distinctions->award($db->get(), 'player-alpha') >= 1 &&
            array_key_exists(
                'player-alpha',
                $distinctions->received($db->get(), [$late['id']], time() * 1000)[$late['id']],
            ),
        'a grant without a player reaches every current account',
    );

    // ---------- What visitors receive ----------
    // The time distinction comes first in this showcase, so Alpha Player is a second one.
    $ridge = $name('Ridge');
    $ridgePublic = $share($owner, $ridge, ['player-time', 'player-alpha', 'player-unknown']);
    $honours = $visit($ridgePublic);
    check(
        $honours['showcase'] === ['player-time'] &&
            $honours['distinction']['id'] === 'player-time' &&
            $honours['distinction']['tenure'] === ['unit' => 'year', 'count' => 1],
        'a town shows one player distinction, at the current time step',
    );
    $db->get()->update(
        'players',
        ['created_at' => time() - 3 * 366 * 86400],
        ['id' => $owner['id']],
    );
    check(
        $visit($ridgePublic)['distinction']['tenure'] === ['unit' => 'year', 'count' => 3],
        'the time step climbs between saves',
    );
    $db->get()->update('players', ['created_at' => time()], ['id' => $owner['id']]);
    $honours = $visit($ridgePublic);
    check(
        $honours['showcase'] === [] && !array_key_exists('distinction', $honours),
        'a distinction the owner does not hold leaves the showcase',
    );

    $other = account();
    $gulch = $name('Gulch');
    $gulchPublic = $share($other, $gulch, ['player-alpha']);
    check(
        $visit($gulchPublic)['showcase'] === [],
        'another player cannot show Alpha Player without holding it',
    );
    $distinctions->award($db->get(), 'player-alpha', $other['id'], 1700000000);
    $honours = $visit($gulchPublic);
    check(
        $honours['showcase'] === ['player-alpha'] &&
            $honours['distinction'] === ['id' => 'player-alpha', 'at' => 1700000000000],
        'once granted, the saved showcase shows it without another save',
    );

    // ---------- Directory cards ----------
    $searcher = account();
    $entries = status(
        200,
        callApi('GET', 'villages?q=' . rawurlencode($gulch), null, $searcher),
        'search',
    )['entries'];
    check(
        count($entries) === 1 &&
            $entries[0]['honours']['showcase'] === ['player-alpha'] &&
            $entries[0]['honours']['distinction']['id'] === 'player-alpha',
        'a directory card shows the owner’s distinction',
    );

    // ---------- Admin ----------
    $admin = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
    check(
        array_column($admin->player($other['id'])['player']['distinctions'], 'id') === [
            'player-alpha',
        ] && $admin->player($other['id'])['player']['distinctions'][0]['at'] === 1700000000,
        'the admin player view lists distinctions in seconds',
    );

    // ---------- Deletion ----------
    $db->get()->delete('players', ['id' => $other['id']]);
    check(
        (int) $db
            ->get()
            ->fetchOne('SELECT COUNT(*) FROM player_distinctions WHERE player_id=?', [
                $other['id'],
            ]) === 0,
        'a deleted account takes its distinctions with it',
    );
    echo "Player distinction checks passed ($count assertions).\n";
} finally {
    cleanup();
}
