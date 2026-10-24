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
        new ApiError(422, 'first reason'),
    );
    SyncRejections::record(
        $db->get(),
        $row,
        $second,
        ['coins' => 30],
        new ApiError(422, 'second reason'),
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
    SyncRejections::record($db->get(), $row, $second, null, new ApiError(422, 'later window'));
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 2,
        'another window captures again',
    );
    $row['revision'] = 2;
    $db->get()->update('towns', ['revision' => 2], ['id' => $row['id']]);
    SyncRejections::record($db->get(), $row, $second, null, new ApiError(422, 'new revision'));
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 3,
        'a new revision captures immediately',
    );
    // An unchanged accepted save raises the revision, so alternating saves and refused
    // uploads stop at the per-town budget for the window.
    for ($revision = 3; $revision <= 6; $revision++) {
        $row['revision'] = $revision;
        $db->get()->update('towns', ['revision' => $revision], ['id' => $row['id']]);
        SyncRejections::record($db->get(), $row, $first, null, new ApiError(422, 'alternating'));
    }
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 3,
        'alternating saves and refusals cannot exceed the per-town window budget',
    );
    $db->get()->executeStatement('UPDATE town_sync_rejections SET rejected_at=? WHERE town_id=?', [
        time() * 1000 - SyncRejections::THROTTLE_MS - 1000,
        $row['id'],
    ]);
    SyncRejections::record($db->get(), $row, $first, null, new ApiError(422, 'alternating'));
    check(
        count(SyncRejections::list($db->get(), $town['townId'])) === 4,
        'the next window captures the latest revision again',
    );
    for ($i = 0; $i < SyncRejections::KEPT; $i++) {
        $db->get()->executeStatement(
            'UPDATE town_sync_rejections SET rejected_at=? WHERE town_id=?',
            [time() * 1000 - SyncRejections::THROTTLE_MS - ($i + 1) * 1000, $row['id']],
        );
        SyncRejections::record($db->get(), $row, $first, null, new ApiError(422, 'window ' . $i));
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
                new ApiError(422, 'attempt ' . $i),
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
        new ApiError(422, 'deleted meanwhile'),
    );
    check(
        SyncRejections::list($db->get(), $parallel['townId']) === [],
        'a deleted town is not recorded after the save rollback',
    );
    echo "Sync rejection checks passed ($count assertions).\n";
} finally {
    cleanup();
}
