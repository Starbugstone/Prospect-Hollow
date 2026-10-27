<?php
declare(strict_types=1);
require dirname(__DIR__) . '/vendor/autoload.php';
use App\{ApiError, SaveIntegrity, SyncRejections};
$_ENV['APP_SECRET'] = str_repeat('correction-test-secret-', 3);

// An ordinary save is reconciled: a failing action is skipped, a journal gap resumes from
// the cloud checkpoint and every protected value comes from the replay. None of it is a
// refusal, a move budget or a penalty; only structural problems are still refused.
$rules = json_decode(
    file_get_contents(dirname(__DIR__) . '/content/save-rules.json'),
    true,
    64,
    JSON_THROW_ON_ERROR,
);
$count = 0;
$now = 1780000000000;
function check(bool $ok, string $message): void
{
    global $count;
    $count++;
    if (!$ok) {
        throw new RuntimeException($message);
    }
}
function asObject(array $data): object
{
    return json_decode(json_encode($data, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
}
function asArray(object $data): array
{
    return json_decode(json_encode($data, JSON_THROW_ON_ERROR), true, 64, JSON_THROW_ON_ERROR);
}
function uuidFor(int $n): string
{
    return '22222222-2222-4222-8222-' . str_pad((string) $n, 12, '0', STR_PAD_LEFT);
}
function action(int $n, string $kind, array $data): array
{
    return ['sequence' => $n, 'id' => uuidFor($n + 100), 'kind' => $kind, 'data' => $data];
}
function refused(callable $operation, string $code, string $label): ApiError
{
    try {
        $operation();
    } catch (ApiError $error) {
        check(($error->details['code'] ?? null) === $code, $label . ' gives ' . $code);
        return $error;
    }
    throw new RuntimeException($label . ' was accepted');
}
function quantity(array $profile, string $id): int
{
    foreach ($profile['powers'] as $power) {
        if ($power['id'] === $id) {
            return $power['quantity'];
        }
    }
    return 0;
}

// A tracked cloud checkpoint: the well is under construction with one of its two wins,
// one TNT is stored, and the player has seen a tip (not protected, the game's own).
$start = $rules['defaultProfile'];
$start['town']['projects'] = [
    'well' => ['id' => 'well', 'stage' => 1, 'wins' => 1, 'required' => 2],
];
foreach ($start['powers'] as &$power) {
    $power['quantity'] = $power['id'] === 'tnt' ? 1 : 0;
}
unset($power);
$start['integrity'] = [
    'version' => 1,
    'epoch' => uuidFor(1),
    'baseSequence' => 0,
    'actions' => [],
    'clientAt' => $now,
];
$validator = new SaveIntegrity();
$cloud = $validator->accept(asObject($start), null, $now);
check($validator->findings() === [], 'enrolment has no findings');

// The reported desync: the game finished a building the server still counts one win
// short, then spent a TNT. The finish is skipped, the TNT spend still replays.
$upload = asArray($cloud);
$upload['town']['buildings']['well'] = 1;
$upload['town']['buildingEras']['well'] = 'frontier';
$upload['town']['projects'] = [];
foreach ($upload['powers'] as &$power) {
    $power['quantity'] = 0;
}
unset($power);
$upload['seenTips'] = ['a-tip-only-the-game-tracks'];
$upload['integrity']['actions'] = [
    action(1, 'building-finish', ['buildingId' => 'well', 'expectedStage' => 1, 'at' => $now]),
    action(2, 'power-spend', ['itemId' => 'tnt', 'at' => $now]),
];
$upload['integrity']['clientBuild'] = '1.1.0+0123456789ab';
$strict = refused(
    fn() => (new SaveIntegrity())->accept(asObject($upload), $cloud, $now),
    'save_integrity_mismatch',
    'the strict replay',
);
check(
    $strict->details['check'] === 'wins' &&
        $strict->details['server'] === 1 &&
        $strict->details['client'] === 2 &&
        $strict->details['finding']['sequence'] === 1 &&
        $strict->details['finding']['kind'] === 'building-finish' &&
        $strict->details['finding']['subject'] === 'well',
    'a strict refusal names the action, the check and both values',
);
$event = SyncRejections::rejection($strict, SaveIntegrity::clientBuild(asObject($upload)));
check(
    $event['outcome'] === 'rejected' &&
        $event['findings'][0]['check'] === 'wins' &&
        $event['build'] === '1.1.0+0123456789ab',
    'a rejection event keeps the finding and the game build',
);
$reconciler = new SaveIntegrity();
$corrected = asArray($reconciler->reconcile(asObject($upload), $cloud, $now, '', null));
$findings = $reconciler->findings();
check(
    $findings[0]['kind'] === 'building-finish' &&
        $findings[0]['sequence'] === 1 &&
        $findings[0]['check'] === 'wins' &&
        $findings[0]['subject'] === 'well',
    'the skipped finish is the first finding ' . json_encode($findings),
);
check(
    !in_array('power-spend', array_column($findings, 'kind'), true),
    'the valid action after it still replays',
);
check(
    $corrected['town']['buildings']['well'] === 0 &&
        $corrected['town']['projects']['well']['wins'] === 1 &&
        quantity($corrected, 'tnt') === 0,
    'protected values come from the replay: the well stays under construction',
);
check(
    $corrected['seenTips'] === ['a-tip-only-the-game-tracks'],
    'values the replay does not own stay as the game sent them',
);
check(
    $corrected['integrity']['baseSequence'] === 2 &&
        $corrected['integrity']['actions'] === [] &&
        $corrected['integrity']['epoch'] === uuidFor(1),
    'the whole journal is acknowledged, so the skipped action never comes back',
);
check(
    $reconciler->favourable() && $reconciler->changed(),
    'a claimed building level is in the player’s favour and changes the save',
);
check(
    $reconciler->expected()['town']['buildings']['well'] === 0,
    'the admin comparison gets the replayed state',
);
$adopted = new SaveIntegrity();
$again = $adopted->reconcile(asObject($corrected), asObject($corrected), $now, '', null);
check(
    $adopted->findings() === [] && asArray($again)['town']['projects']['well']['wins'] === 1,
    'the game adopting the corrected save syncs normally afterwards',
);
$saved = SyncRejections::correction(
    $findings,
    $reconciler->favourable(),
    SaveIntegrity::clientBuild(asObject($upload)),
);
check(
    $saved['outcome'] === 'corrected' &&
        $saved['favourable'] &&
        str_starts_with($saved['field'], 'town.'),
    'a correction event records the outcome and its review signal',
);
check(
    SaveIntegrity::sameRules('1.1.0+0123456789ab') === false &&
        SaveIntegrity::sameRules(null) === null &&
        SaveIntegrity::sameRules('1.2.1+' . substr($rules['contentDigest'], 0, 12)) === true,
    'a build is matched against the server’s save rules',
);
check(
    SaveIntegrity::clientBuild(asObject(['integrity' => ['clientBuild' => '<script>']])) === null &&
        SaveIntegrity::clientBuild(null) === null,
    'only a well-formed build is kept',
);

// Injected money is corrected back, never kept, and flagged as in the player's favour.
$rich = asArray($cloud);
$rich['town']['coins'] += 500;
$injection = new SaveIntegrity();
$restored = asArray($injection->reconcile(asObject($rich), $cloud, $now, '', null));
check(
    $restored['town']['coins'] === $cloud->town->coins &&
        $injection->findings() === [
            [
                'kind' => 'value',
                'field' => 'town.coins',
                'server' => $cloud->town->coins,
                'client' => $cloud->town->coins + 500,
            ],
        ] &&
        $injection->favourable(),
    'an injected balance is replaced by the replayed one',
);
// A game short of its own progress gets it back; that is not in its favour.
$poor = asArray($cloud);
$poor['builderHammers'] = 0;
$cloudHammers = asArray($cloud);
$cloudHammers['builderHammers'] = 2;
$hammerCloud = $validator->accept(asObject($cloudHammers), null, $now);
$poor['integrity'] = asArray($hammerCloud)['integrity'];
$short = new SaveIntegrity();
$back = asArray($short->reconcile(asObject($poor), $hammerCloud, $now, '', null));
check(
    $back['builderHammers'] === 2 && !$short->favourable(),
    'a game missing verified progress gets it back, not flagged',
);

// A journal that cannot continue from the checkpoint resumes from the cloud save.
foreach (
    [
        'epoch' => fn(array $p) => ['epoch' => uuidFor(9)] + $p,
        'ahead' => fn(array $p) => ['baseSequence' => 50] + $p,
        'missing' => null,
    ]
    as $check => $journal
) {
    $gap = asArray($cloud);
    $gap['town']['coins'] += 7;
    $gap['seenTips'] = ['kept'];
    if ($journal === null) {
        unset($gap['integrity']);
    } else {
        $gap['integrity'] = $journal($gap['integrity']);
    }
    $resumer = new SaveIntegrity();
    $resumed = asArray($resumer->reconcile(asObject($gap), $cloud, $now, '', null));
    check(
        $resumer->findings()[0]['kind'] === 'journal' &&
            $resumer->findings()[0]['check'] === $check &&
            $resumed['town']['coins'] === $cloud->town->coins &&
            $resumed['seenTips'] === ['kept'] &&
            $resumed['integrity']['epoch'] === uuidFor(1) &&
            $resumer->changed(),
        'a ' . $check . ' journal resumes from the cloud checkpoint',
    );
    refused(
        fn() => (new SaveIntegrity())->accept(asObject($gap), $cloud, $now),
        'save_integrity_mismatch',
        'the strict replay of a ' . $check . ' journal',
    );
}
$behindCloud = asArray($cloud);
$behindCloud['integrity']['baseSequence'] = 5;
$behindAnchor = $validator->accept(asObject($behindCloud), null, $now);
$behind = asArray($behindAnchor);
$behind['integrity']['baseSequence'] = 2;
$behindReconciler = new SaveIntegrity();
$behindReconciler->reconcile(asObject($behind), $behindAnchor, $now, '', null);
check(
    $behindReconciler->findings()[0]['check'] === 'behind',
    'a journal ending before the checkpoint resumes from it',
);

// An honest upload has no findings and keeps its own profile.
$honest = asArray($cloud);
$honest['integrity']['actions'] = [action(1, 'power-spend', ['itemId' => 'tnt', 'at' => $now])];
foreach ($honest['powers'] as &$power) {
    $power['quantity'] = 0;
}
unset($power);
$clean = new SaveIntegrity();
$kept = asArray($clean->reconcile(asObject($honest), $cloud, $now, '', null));
check(
    $clean->findings() === [] && !$clean->favourable() && quantity($kept, 'tnt') === 0,
    'an honest upload is accepted unchanged',
);
// A skipped action with no effect on the saved values does not make the game reload.
$noop = asArray($cloud);
$noop['integrity']['actions'] = [
    action(1, 'building-finish', ['buildingId' => 'well', 'expectedStage' => 1, 'at' => $now]),
];
$quiet = new SaveIntegrity();
$quiet->reconcile(asObject($noop), $cloud, $now, '', null);
check(
    count($quiet->findings()) === 1 && !$quiet->changed(),
    'a skipped action without effect is noted but changes nothing',
);

// The findings are capped, but a correction is still announced: forty skipped actions
// followed by an injected balance still make the game load the server's values.
$flood = asArray($cloud);
$flood['town']['coins'] += 100;
$flood['integrity']['actions'] = array_map(
    fn($n) => action($n, 'building-finish', [
        'buildingId' => 'well',
        'expectedStage' => 1,
        'at' => $now,
    ]),
    range(1, SaveIntegrity::MAX_FINDINGS + 1),
);
$capped = new SaveIntegrity();
$cappedSave = asArray($capped->reconcile(asObject($flood), $cloud, $now, '', null));
check(
    count($capped->findings()) === SaveIntegrity::MAX_FINDINGS &&
        $capped->changed() &&
        $cappedSave['town']['coins'] === $cloud->town->coins,
    'a correction past the findings cap is still one the game must load',
);

// A journal gap on an older Moonstone checkpoint resumes with the same migration as a
// replay, so a newer game's save is not refused.
$moonOld = asArray($cloud);
$moonOld['schemaVersion'] = 3;
$moonOld['town']['moonstoneVersion'] = 1;
$moonOld['town']['moonstoneProduction'] = ['progress' => 1, 'charge' => 0];
$moonCloud = $validator->accept(asObject($moonOld), null, $now);
foreach (['missing', 'epoch'] as $check) {
    $moonNew = asArray($moonCloud);
    $moonNew['schemaVersion'] = 4;
    $moonNew['town']['moonstoneVersion'] = 2;
    $moonNew['town']['moonstoneProduction'] = ['progress' => 1, 'stored' => 0];
    $moonNew['town']['coins'] += 3;
    if ($check === 'missing') {
        unset($moonNew['integrity']);
    } else {
        $moonNew['integrity']['epoch'] = uuidFor(8);
    }
    $moonResumer = new SaveIntegrity();
    $moonResumed = asArray($moonResumer->reconcile(asObject($moonNew), $moonCloud, $now, '', null));
    check(
        $moonResumed['town']['moonstoneVersion'] === 2 &&
            $moonResumed['town']['moonstoneProduction'] === ['progress' => 1, 'stored' => 0] &&
            $moonResumed['town']['coins'] === $moonCloud->town->coins &&
            $moonResumer->findings()[0]['check'] === $check,
        'a ' . $check . ' journal on a Moonstone version 1 checkpoint resumes migrated',
    );
}

// Action data is the upload's own: a deeply nested value is summarized in its finding,
// and a stored record too deep to read never hides the rest of the sync log.
$deep = 1;
for ($i = 0; $i < 35; $i++) {
    $deep = [$deep];
}
$nested = asArray($cloud);
$nested['integrity']['actions'] = [
    action(1, 'building-finish', ['buildingId' => 'well', 'expectedStage' => $deep, 'at' => $now]),
];
$shallow = new SaveIntegrity();
$shallow->reconcile(asObject($nested), $cloud, $now, '', null);
check(
    $shallow->findings()[0]['check'] === 'stage' &&
        $shallow->findings()[0]['client'] === ['summary' => '1 entries'] &&
        json_decode(json_encode($shallow->findings()), true, 32) !== null,
    'a deeply nested action value is summarized in its finding',
);
$unreadable = SyncRejections::summary([
    'id' => 'x',
    'rejected_at' => 1000,
    'revision' => 1,
    'code' => 'save_corrected',
    'field' => null,
    'message' => 'm',
    'findings' => str_repeat('[', 70) . str_repeat(']', 70),
    'expected' => null,
]);
check($unreadable['findings'] === [], 'an unreadable stored finding list reads as empty');

// A corrected map key comes from the upload (event IDs are not checked as keys); the
// finding path stays within its 255-character column.
$keyed = new SaveIntegrity();
(new ReflectionMethod(SaveIntegrity::class, 'differences'))->invoke(
    $keyed,
    ['known' => 1],
    ['known' => 1, str_repeat('k', 400) => 2],
    'town.events',
);
check(
    count($keyed->findings()) === 1 && mb_strlen($keyed->findings()[0]['field']) === 255,
    'a finding path never exceeds 255 characters',
);

// The build stays within its 64-character event column.
check(
    SaveIntegrity::clientBuild(
        asObject(['integrity' => ['clientBuild' => '1.2.1+' . str_repeat('a', 31)]]),
    ) !== null &&
        SaveIntegrity::clientBuild(
            asObject(['integrity' => ['clientBuild' => '1.2.1+' . str_repeat('a', 32)]]),
        ) === null &&
        SaveIntegrity::clientBuild(
            asObject([
                'integrity' => ['clientBuild' => str_repeat('9', 32) . '+' . str_repeat('a', 31)],
            ]),
        ) !== null,
    'the longest accepted build is 64 characters',
);

// Structural problems are still refused: a device clock far ahead of the server.
$ahead = asArray($cloud);
$ahead['integrity']['actions'] = [
    action(1, 'building-finish', [
        'buildingId' => 'well',
        'expectedStage' => 1,
        'at' => $now + 86400000,
    ]),
];
refused(
    fn() => (new SaveIntegrity())->reconcile(asObject($ahead), $cloud, $now, '', null),
    'save_clock_mismatch',
    'an action stamped beyond the server clock',
);
echo "Sync correction checks passed ($count assertions).\n";
