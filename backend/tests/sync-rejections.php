<?php
require __DIR__ . '/support.php';
use App\{ApiError, Database, SyncRejections};

// Its own address keeps the shared 127.0.0.1 sign-in limit for the other suites.
$signInIp = [
    'REMOTE_ADDR' =>
        '127.' . random_int(1, 254) . '.' . random_int(1, 254) . '.' . random_int(1, 254),
];

try {
    $owner = account($signInIp);
    $town = status(200, callApi('POST', 'towns', townBody('Retry Log'), $owner), 'create log town');
    $row = $db->get()->fetchAssociative('SELECT * FROM towns WHERE id=?', [$town['townId']]);
    $first = json_encode(profile(111));
    $second = json_encode(profile(222));
    SyncRejections::record(
        $db->get(),
        $row,
        $first,
        ['coins' => 25],
        SyncRejections::rejection(new ApiError(422, 'first reason'), null),
    );
    SyncRejections::record(
        $db->get(),
        $row,
        $second,
        ['coins' => 30],
        SyncRejections::rejection(new ApiError(422, 'second reason'), null),
    );
    $entries = SyncRejections::list($db->get(), $town['townId']);
    check(count($entries) === 1, 'a burst captures only one full comparison');
    $kept = SyncRejections::find($db->get(), $town['townId'], $entries[0]['id']);
    check(
        $kept['upload'] === $first &&
            $kept['message'] === 'first reason' &&
            json_decode($kept['expected'], true) === ['coins' => 25],
        'a different retry cannot replace the original reason without its snapshot',
    );
    $db->get()->update(
        'town_sync_rejections',
        ['rejected_at' => time() * 1000 - SyncRejections::THROTTLE_MS - 1000],
        ['id' => $kept['id']],
    );
    SyncRejections::record(
        $db->get(),
        $row,
        $second,
        null,
        SyncRejections::rejection(new ApiError(422, 'later window'), null),
    );
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 2,
        'another window captures again',
    );
    $row['revision'] = 2;
    $db->get()->update('towns', ['revision' => 2], ['id' => $row['id']]);
    SyncRejections::record(
        $db->get(),
        $row,
        $second,
        null,
        SyncRejections::rejection(new ApiError(422, 'new revision'), null),
    );
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 3,
        'a new revision captures immediately',
    );
    // An unchanged accepted save raises the revision, so alternating saves and refused
    // uploads stop at the per-town budget for the window.
    for ($revision = 3; $revision <= 6; $revision++) {
        $row['revision'] = $revision;
        $db->get()->update('towns', ['revision' => $revision], ['id' => $row['id']]);
        SyncRejections::record(
            $db->get(),
            $row,
            $first,
            null,
            SyncRejections::rejection(new ApiError(422, 'alternating'), null),
        );
    }
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 3,
        'alternating saves and refusals cannot exceed the per-town window budget',
    );
    $db->get()->executeStatement('UPDATE town_sync_rejections SET rejected_at=? WHERE town_id=?', [
        time() * 1000 - SyncRejections::THROTTLE_MS - 1000,
        $row['id'],
    ]);
    SyncRejections::record(
        $db->get(),
        $row,
        $first,
        null,
        SyncRejections::rejection(new ApiError(422, 'alternating'), null),
    );
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 4,
        'the next window captures the latest revision again',
    );
    for ($i = 0; $i < SyncRejections::KEPT; $i++) {
        $db->get()->executeStatement(
            'UPDATE town_sync_rejections SET rejected_at=? WHERE town_id=?',
            [time() * 1000 - SyncRejections::THROTTLE_MS - ($i + 1) * 1000, $row['id']],
        );
        SyncRejections::record(
            $db->get(),
            $row,
            $first,
            null,
            SyncRejections::rejection(new ApiError(422, 'window ' . $i), null),
        );
    }
    $entries = SyncRejections::list($db->get(), $town['townId']);
    check(count($entries) === SyncRejections::KEPT, 'the full comparison count stays bounded');
    $db->get()->update(
        'town_sync_rejections',
        ['rejected_at' => (time() - (SyncRejections::KEEP_DAYS + 1) * 86400) * 1000],
        ['id' => $entries[0]['id']],
    );
    SyncRejections::expire($db->get());
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === SyncRejections::KEPT - 1,
        'daily cleanup expires old comparisons',
    );

    // A refused upload keeps the action it stopped at and the game build that sent it.
    $refusal = SyncRejections::rejection(
        new ApiError(422, 'stopped', [
            'code' => 'save_integrity_mismatch',
            'field' => 'building-finish',
            'finding' => ['kind' => 'building-finish', 'sequence' => 4, 'check' => 'wins'],
        ]),
        '1.2.1+0123456789ab',
    );
    $logged = status(
        200,
        callApi('POST', 'towns', townBody('Explained Log'), $owner),
        'create explained town',
    );
    $loggedRow = $db
        ->get()
        ->fetchAssociative('SELECT * FROM towns WHERE id=?', [$logged['townId']]);
    SyncRejections::record($db->get(), $loggedRow, $first, null, $refusal);
    [$explained] = SyncRejections::list($db->get(), $logged['townId']);
    check(
        $explained['outcome'] === 'rejected' &&
            $explained['findings'] === [
                ['kind' => 'building-finish', 'sequence' => 4, 'check' => 'wins'],
            ] &&
            $explained['clientBuild'] === '1.2.1+0123456789ab' &&
            $explained['sameRules'] === false &&
            SyncRejections::resettable(
                SyncRejections::find($db->get(), $logged['townId'], $explained['id']),
            ) === (int) $loggedRow['revision'],
        'a rejection lists its cause and build and resets at its own revision',
    );
    // Corrections in the player's favour flag a town for review once they repeat.
    $review = fn() => (int) $db
        ->get()
        ->fetchOne('SELECT ' . SyncRejections::REVIEW . ' FROM towns t WHERE t.id=?', [
            $logged['townId'],
        ]);
    $blocked = fn() => $db
        ->get()
        ->fetchOne('SELECT ' . SyncRejections::BLOCKED_AT . ' FROM towns t WHERE t.id=?', [
            $logged['townId'],
        ]);
    check($blocked() !== null && $review() === 0, 'a rejection blocks but does not flag');
    $finding = ['kind' => 'value', 'field' => 'town.coins', 'server' => 1, 'client' => 9];
    for ($i = 1; $i <= SyncRejections::REVIEW_AFTER; $i++) {
        $loggedRow['revision'] = (int) $loggedRow['revision'] + 1;
        $db->get()->update(
            'towns',
            ['revision' => $loggedRow['revision']],
            ['id' => $loggedRow['id']],
        );
        $db->get()->executeStatement(
            'UPDATE town_sync_rejections SET rejected_at=? WHERE town_id=?',
            [time() * 1000 - SyncRejections::THROTTLE_MS - 1000, $loggedRow['id']],
        );
        SyncRejections::record(
            $db->get(),
            $loggedRow,
            $first,
            ['coins' => 1],
            SyncRejections::correction([$finding], true, null),
        );
        check(
            $review() === ($i >= SyncRejections::REVIEW_AFTER ? 1 : 0),
            'favourable correction ' . $i . ' of ' . SyncRejections::REVIEW_AFTER,
        );
    }
    check($blocked() === null, 'a correction at the current revision does not block');
    $correction = SyncRejections::list($db->get(), $logged['townId'])[0];
    check(
        $correction['outcome'] === 'corrected' &&
            $correction['field'] === 'town.coins' &&
            $correction['favourable'] &&
            $correction['clientBuild'] === null &&
            $correction['sameRules'] === null &&
            SyncRejections::resettable(
                SyncRejections::find($db->get(), $logged['townId'], $correction['id']),
            ) ===
                $loggedRow['revision'] + 1,
        'a correction resets from the revision it saved',
    );

    // All recorders reach this fresh window together, after their rejected saves
    // released their locks. Their own capture transaction must serialize them.
    $parallel = status(
        200,
        callApi('POST', 'towns', townBody('Parallel Retry'), $owner),
        'create parallel town',
    );
    $parallelRow = $db
        ->get()
        ->fetchAssociative('SELECT * FROM towns WHERE id=?', [$parallel['townId']]);
    $db->get()->close();
    $children = [];
    for ($i = 0; $i < 4; $i++) {
        $pid = pcntl_fork();
        if ($pid === 0) {
            SyncRejections::record(
                (new Database())->get(),
                $parallelRow,
                json_encode(profile(100 + $i)),
                ['attempt' => $i],
                SyncRejections::rejection(new ApiError(422, 'attempt ' . $i), null),
            );
            exit(0);
        }
        if ($pid < 0) {
            throw new RuntimeException('Could not fork a rejection recorder.');
        }
        $children[] = $pid;
    }
    foreach ($children as $pid) {
        pcntl_waitpid($pid, $exit);
        check(
            pcntl_wifexited($exit) && pcntl_wexitstatus($exit) === 0,
            'a concurrent recorder succeeds',
        );
    }
    $entries = SyncRejections::list($db->get(), $parallel['townId']);
    check(count($entries) === 1, 'concurrent retries capture only one full comparison');
    $kept = SyncRejections::find($db->get(), $parallel['townId'], $entries[0]['id']);
    $attempt = json_decode($kept['expected'], true)['attempt'];
    check(
        $kept['message'] === 'attempt ' . $attempt &&
            json_decode($kept['upload'])->town->coins === 100 + $attempt,
        'concurrent capture keeps one coherent comparison',
    );
    App\SaveService::tombstone($db->get(), $parallel['townId']);
    $db->get()->delete('town_sync_rejections', ['town_id' => $parallel['townId']]);
    SyncRejections::record(
        $db->get(),
        $parallelRow,
        $first,
        null,
        SyncRejections::rejection(new ApiError(422, 'deleted meanwhile'), null),
    );
    check(
        SyncRejections::list($db->get(), $parallel['townId']) === [],
        'a deleted town is not recorded after the save rollback',
    );
    echo "Sync rejection checks passed ($count assertions).\n";
} finally {
    cleanup();
}
