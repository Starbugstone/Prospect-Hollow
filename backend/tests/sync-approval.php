<?php
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService, ApiError, SyncApproval, SyncRejections};

$admin = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
function approvalError(int $status, callable $run, string $label): void
{
    try {
        $run();
        check(false, $label . ': expected rejection');
    } catch (ApiError $error) {
        check($error->status === $status, $label);
    }
}
try {
    $player = account();
    $other = account();
    $create = function (string $name) use ($player): array {
        $profile = json_decode(file_get_contents(dirname(__DIR__) . '/content/save-rules.json'))
            ->defaultProfile;
        $profile->integrity = (object) [
            'version' => 1,
            'epoch' => uuid(),
            'baseSequence' => 0,
            'clientAt' => time() * 1000,
            'actions' => [],
        ];
        $body = townBody($name);
        $body['profile'] = $profile;
        $reply = callApi('POST', 'towns', $body, $player);
        status(200, $reply, 'create approval fixture');
        return json_decode($reply['response']->getContent(), true);
    };
    $body = fn(array $town, object $profile) => [
        'baseRevision' => $town['revision'],
        'uploadId' => uuid(),
        'profile' => $profile,
    ];
    $profile = fn(array $town) => json_decode(
        $db->get()->fetchOne('SELECT profile FROM towns WHERE id=?', [$town['townId']]),
    );
    $reject = function (array $town, object $upload) use ($player, $body, $db): array {
        status(
            422,
            callApi('PUT', 'towns/' . $town['townId'], $body($town, $upload), $player),
            'reject unreviewed upload',
        );
        return SyncRejections::list($db->get(), $town['townId'])[0];
    };
    $approve = fn(array $town, array $rejection) => $admin->setForceSync(
        AdminAuth::SERVER,
        $town['townId'],
        ['forceSync' => true, 'rejectionId' => $rejection['id']],
    );
    $view = fn(array $town) => $admin->townDetail($town['townId'])['town'];
    $stored = fn(array $town) => $db
        ->get()
        ->fetchAssociative('SELECT * FROM towns WHERE id=?', [$town['townId']]);

    $town = $create('Exact Approval');
    approvalError(
        422,
        fn() => $admin->setForceSync(AdminAuth::SERVER, $town['townId'], ['forceSync' => true]),
        'an unblocked town cannot arm an arbitrary next upload',
    );
    $forged = $profile($town);
    $forged->town->coins += 500;
    $db->get()->update('towns', ['force_sync' => 1], ['id' => $town['townId']]);
    $rejection = $reject($town, $forged);
    check(!$view($town)['forceSync'], 'a legacy boolean never authorizes replay bypass');
    $approval = $approve($town, $rejection);
    check(
        $approval['forceSync'] &&
            $approval['forceSyncUntil'] >= time() + SyncApproval::SECONDS - 1 &&
            $approval['syncApproval']['rejectionId'] === $rejection['id'],
        'approval identifies the immutable reviewed upload and expires in 24 hours',
    );
    $raw = json_decode($stored($town)['sync_approval'], true);
    $raw['expiresAt'] = time();
    $db->get()->update('towns', ['sync_approval' => json_encode($raw)], ['id' => $town['townId']]);
    check(
        !$view($town)['forceSync'] && $view($town)['syncApproval']['status'] === 'expired',
        'approval expires at its deadline',
    );
    $rejection = $reject($town, $forged);
    $approve($town, $rejection);
    $different = clone $forged;
    $different = json_decode(json_encode($different));
    $different->town->coins += 999;
    $reject($town, $different);
    check(
        $view($town)['forceSync'],
        'a different rejected payload at the SAME revision does not consume approval',
    );
    status(
        404,
        callApi('PUT', 'towns/' . $town['townId'], $body($town, $forged), $other),
        'another account cannot use the approval',
    );
    check($view($town)['forceSync'], 'another account cannot consume the approval');
    $otherTown = $create('Other Approval');
    approvalError(
        404,
        fn() => $approve($otherTown, $rejection),
        'rejection IDs are scoped to their town',
    );
    $copied = $stored($town)['sync_approval'];
    $db->get()->update('towns', ['sync_approval' => $copied], ['id' => $otherTown['townId']]);
    check(!$view($otherTown)['forceSync'], 'copied approvals are bound to the original town');
    $row = $stored($town);
    $row['player_id'] = $other['id'];
    check(
        !SyncApproval::matches($db->get(), $row, json_encode($forged)),
        'approval is bound to its owner',
    );

    // JSON key order and a new transport upload ID do not change the reviewed profile.
    $reordered = (object) array_reverse(get_object_vars($forged), true);
    $retry = $body($town, $reordered);
    $accepted = status(
        200,
        callApi('PUT', 'towns/' . $town['townId'], $retry, $player),
        'exact reviewed retry',
    );
    check(
        $accepted['profile']['town']['coins'] === $forged->town->coins &&
            $accepted['revision'] === 2,
        'only the reviewed balance becomes trusted',
    );
    check(
        $stored($town)['sync_approval'] === null && (int) $stored($town)['force_sync'] === 0,
        'successful override consumes approval and clears legacy flags',
    );
    status(
        200,
        callApi('PUT', 'towns/' . $town['townId'], $retry, $player),
        'lost response can retry idempotently after consumption',
    );
    $town['revision'] = 2;
    $forged = $profile($town);
    $forged->town->coins += 500;
    $rejection = $reject($town, $forged);
    approvalError(
        409,
        fn() => $approve($town, ['id' => $approval['syncApproval']['rejectionId']]),
        'old cloud revision cannot be reapproved',
    );
    $approve($town, $rejection);
    $staleApproval = $stored($town)['sync_approval'];
    // Loading the cloud on another device ends the block through normal replay.
    $normal = status(
        200,
        callApi('PUT', 'towns/' . $town['townId'], $body($town, $profile($town)), $player),
        'normal recovery while approved',
    );
    check(
        $stored($town)['sync_approval'] === null && !$view($town)['forceSync'],
        'normal acceptance clears an unused approval',
    );
    $town['revision'] = $normal['revision'];
    $db->get()->update(
        'towns',
        ['sync_approval' => $staleApproval, 'force_sync' => 1],
        ['id' => $town['townId']],
    );
    check(
        $view($town)['syncApproval']['status'] === 'stale',
        'changed revision disables a leftover approval',
    );
    $reject($town, $forged);
    status(
        200,
        callApi('PUT', 'towns/' . $town['townId'], $body($town, $profile($town)), $player),
        'normal acceptance clears stale approval',
    );
    check(
        $stored($town)['sync_approval'] === null && (int) $stored($town)['force_sync'] === 0,
        'stale flags clear even when no override was used',
    );

    $town = $create('Unblocked Approval');
    $forged = $profile($town);
    $forged->town->coins += 500;
    $rejection = $reject($town, $forged);
    $approve($town, $rejection);
    $db->get()->delete('town_sync_rejections', ['town_id' => $town['townId']]);
    check(
        $view($town)['syncApproval']['status'] === 'stale',
        'removing the rejection disarms an unblocked town',
    );
    $reject($town, $forged);
    check(
        !$view($town)['forceSync'],
        'a different rejection at the same revision cannot revive approval',
    );
    status(
        200,
        callApi('PUT', 'towns/' . $town['townId'], $body($town, $profile($town)), $player),
        'unblocked town uses normal replay',
    );
    check($stored($town)['sync_approval'] === null, 'normal save clears an orphaned approval');

    // Canonicalization covers the whole profile, including honour counters and list order.
    check(
        SyncApproval::fingerprint('{"a":{"y":2,"x":1},"b":[1,2]}') ===
            SyncApproval::fingerprint('{"b":[1,2],"a":{"x":1,"y":2}}'),
        'canonical hash ignores nested object key order',
    );
    check(
        SyncApproval::fingerprint('{"a":[1,2]}') !== SyncApproval::fingerprint('{"a":[2,1]}'),
        'canonical hash preserves list order',
    );
    check(
        SyncApproval::fingerprint('{"honours":{"counts":{"wins":1}}}') !==
            SyncApproval::fingerprint('{"honours":{"counts":{"wins":999}}}'),
        'approval binds client honour counters too',
    );
    echo "Sync approval checks passed ($count assertions).\n";
} finally {
    cleanup();
}
