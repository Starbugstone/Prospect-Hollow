<?php
// Town Honours on the server: bounded storage, merges that never revoke or double-count,
// and the public projection with provable honours recomputed from the saved state.
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService, Honours, SaveIntegrity};

$content = dirname(__DIR__) . '/content/';
$schema = json_decode(
    file_get_contents($content . 'public-schema.json'),
    true,
    32,
    JSON_THROW_ON_ERROR,
);
$rules = json_decode(
    file_get_contents($content . 'save-rules.json'),
    true,
    64,
    JSON_THROW_ON_ERROR,
);
$defaultProfile = json_decode(
    file_get_contents($content . 'save-rules.json'),
    false,
    64,
    JSON_THROW_ON_ERROR,
)->defaultProfile;
$catalog = new Honours($schema['honours']);
function asObject(mixed $value): mixed
{
    return json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
}
// The honours stored after accepting $incoming over $previous (profile fields as arrays).
function kept(array $previous, array $incoming): mixed
{
    global $catalog;
    $result = $catalog->keep(
        asObject(['schemaVersion' => 2] + $incoming),
        $previous ? asObject(['schemaVersion' => 2] + $previous) : null,
    );
    return property_exists($result, 'honours')
        ? json_decode(json_encode($result->honours, JSON_THROW_ON_ERROR), true)
        : 'absent';
}
function shared(object $profile): array
{
    global $public;
    return json_decode($public->projection($profile, 'Honour Hall', 'honours'), true)['appearance'];
}
function checkpointState(string $token): array
{
    $body = explode('.', $token)[0];
    return json_decode(gzuncompress(base64_decode(strtr($body, '-_', '+/'))), true)['state'];
}
$adminAudit = 'honours-test-' . bin2hex(random_bytes(4));
try {
    // ---------- Shared definitions ----------
    $definitions = $schema['honours']['definitions'];
    check(
        $schema['honours']['version'] === 1 &&
            $schema['honours']['showcaseSlots'] === 3 &&
            $schema['honours']['scoreFromLevel'] === 37 &&
            $schema['honours']['finalEra'] === 'riverlight' &&
            $schema['levels'] === $rules['levelCount'],
        'the public schema exports the honours constants from the registry',
    );
    check(
        $definitions['score-ace'] === [
            'family' => 'score',
            'rank' => 1,
            'category' => 'achievement',
            'proof' => 'score',
            'multiple' => 2,
        ] &&
            $definitions['score-legend']['rank'] === 2 &&
            $definitions['score-legend']['multiple'] === 3 &&
            $definitions['first-perfect']['proof'] === 'any-perfect' &&
            $definitions['perfect-prospector']['proof'] === 'all-perfect' &&
            $definitions['town-complete']['proof'] === 'final-era',
        'score ranks share a family and provable honours name their proof',
    );
    check(
        !isset($definitions['first-fusion']['proof']) &&
            !isset($definitions['laureate-ruby']['proof']) &&
            $definitions['defence-riverlight']['category'] === 'defence' &&
            $definitions['relic-keeper']['category'] === 'mine',
        'observed honours are claims in their categories',
    );

    // ---------- Storage bounds ----------
    check(kept([], []) === 'absent', 'a save without honours stays without honours');
    foreach (['garbage', [1, 2], 7, null, true] as $junk) {
        check(kept([], ['honours' => $junk]) === 'absent', 'a non-object honours block is dropped');
    }
    $fresh = [
        'version' => 1,
        'earned' => (object) [],
        'counts' => ['gems' => (object) [], 'forge' => 0, 'mine' => (object) []],
        'fusions' => [],
        'showcase' => [],
        'backfilled' => 0,
    ];
    $client = [
        'version' => 1,
        'earned' => [
            'first-perfect' => [
                'at' => 1700000000000,
                'version' => 1,
                'evidence' => ['levelId' => 4],
                'seen' => true,
                'announced' => true,
            ],
            'score-ace' => [
                'at' => 1700000001000,
                'version' => 1,
                'evidence' => ['levelId' => 40, 'score' => 30000, 'target' => 12000],
                'seen' => false,
                'announced' => false,
            ],
            'defence-frontier' => [
                'at' => null,
                'version' => 1,
                'seen' => false,
                'announced' => false,
                'backfilled' => true,
            ],
        ],
        'counts' => ['gems' => ['ruby' => 120], 'forge' => 2, 'mine' => ['relics' => 3]],
        'fusions' => ['bomb+cross'],
        'showcase' => ['score', 'first-perfect'],
        'backfilled' => 1,
    ];
    foreach ([$fresh, $client] as $block) {
        check(
            json_encode($catalog->keep(asObject(['honours' => $block]), null)->honours) ===
                json_encode($block),
            'a well-formed client block is stored byte for byte',
        );
    }
    $garbage = kept(
        [],
        [
            'honours' => [
                'version' => 'x',
                'earned' => [
                    'BAD ID' => ['at' => 5],
                    'first-fusion' => 'yes',
                    'first-perfect' => [
                        'at' => -5,
                        'version' => 0,
                        'seen' => 'yes',
                        'announced' => 1,
                        'backfilled' => 'true',
                        'evidence' => [
                            'levelId' => 40,
                            'nested' => ['x'],
                            'bad key!' => 1,
                            'long' => str_repeat('a', 41),
                            'flag' => true,
                        ],
                    ],
                    'future-honour' => ['at' => 9, 'version' => 2],
                ],
                'counts' => [
                    'gems' => [
                        'ruby' => -1,
                        'sapphire' => 1.5,
                        'emerald' => '7',
                        '1bad' => 5,
                        'topaz' => 9,
                        'amethyst' => PHP_INT_MAX,
                    ],
                    'forge' => -3,
                    'mine' => 'lots',
                ],
                'fusions' => ['bomb+cross', 'bomb+cross', 5, 'BOMB+x', 'cross+rainbow'],
                'showcase' => ['score', 'score', 'Bad', 'first-perfect', 'forge-delivers', 'gates'],
                'backfilled' => -1,
            ],
        ],
    );
    check(
        $garbage === [
            'version' => 1,
            'earned' => [
                'first-perfect' => [
                    'at' => null,
                    'version' => 1,
                    'evidence' => ['levelId' => 40],
                    'seen' => false,
                    'announced' => false,
                ],
                'future-honour' => [
                    'at' => 9,
                    'version' => 2,
                    'seen' => false,
                    'announced' => false,
                ],
            ],
            'counts' => ['gems' => ['topaz' => 9], 'forge' => 0, 'mine' => []],
            'fusions' => ['bomb+cross', 'cross+rainbow'],
            'showcase' => ['score', 'first-perfect', 'forge-delivers'],
            'backfilled' => 0,
        ],
        'malformed honours values are dropped, unknown future IDs kept ' . json_encode($garbage),
    );
    $flood = ['earned' => [], 'counts' => ['gems' => []], 'fusions' => []];
    for ($i = 0; $i < 500; $i++) {
        $flood['earned']['future-' . $i] = ['at' => $i + 1];
        $flood['counts']['gems']['gem' . $i] = $i + 1;
        $flood['fusions'][] = 'a' . str_repeat('b', $i % 20) . '+c' . $i % 7 . 'd';
        $flood['fusions'][] = 'x' . chr(97 + ($i % 26)) . '+y' . chr(97 + intdiv($i, 26));
    }
    $flood['earned']['first-perfect'] = ['at' => 1];
    $flood['earned']['first-perfect']['evidence'] = array_fill_keys(
        array_map(fn($n) => 'key' . $n, range(1, 20)),
        1,
    );
    $bounded = kept([], ['honours' => $flood]);
    check(
        count($bounded['earned']) === 33 &&
            isset($bounded['earned']['first-perfect'], $bounded['earned']['future-31']) &&
            !isset($bounded['earned']['future-32']) &&
            count($bounded['earned']['first-perfect']['evidence']) === 8 &&
            count($bounded['counts']['gems']) === 64 &&
            count($bounded['fusions']) === 64,
        'storage keeps every catalog honour and caps unknown IDs, evidence, counts and fusions',
    );
    check(
        kept([], ['honours' => $bounded]) === $bounded,
        'bounding an already bounded block changes nothing',
    );

    // ---------- Merge: never revoke, never sum ----------
    $previous = [
        'version' => 1,
        'earned' => [
            'first-perfect' => [
                'at' => 500,
                'version' => 1,
                'evidence' => ['levelId' => 3],
                'seen' => true,
                'announced' => false,
            ],
            'forge-delivers' => [
                'at' => null,
                'version' => 1,
                'seen' => false,
                'announced' => false,
                'backfilled' => true,
            ],
            'future-honour' => ['at' => 7, 'version' => 2, 'seen' => false, 'announced' => false],
        ],
        'counts' => [
            'gems' => ['ruby' => 50, 'topaz' => 4],
            'forge' => 3,
            'mine' => ['relics' => 9],
        ],
        'fusions' => ['bomb+cross'],
        'showcase' => ['first-perfect'],
        'backfilled' => 1,
    ];
    $incoming = [
        'version' => 1,
        'earned' => [
            'first-perfect' => ['at' => 300, 'version' => 1, 'seen' => false, 'announced' => true],
            'forge-delivers' => ['at' => 900, 'version' => 1, 'seen' => true, 'announced' => true],
            'first-fusion' => ['at' => 1000, 'version' => 1, 'seen' => false, 'announced' => false],
        ],
        'counts' => [
            'gems' => ['ruby' => 30, 'sapphire' => 8],
            'forge' => 1,
            'mine' => (object) [],
        ],
        'fusions' => ['cross+cross'],
        'showcase' => ['first-fusion'],
        'backfilled' => 0,
    ];
    $merged = [
        'version' => 1,
        'earned' => [
            'first-perfect' => ['at' => 300, 'version' => 1, 'seen' => true, 'announced' => true],
            'forge-delivers' => ['at' => 900, 'version' => 1, 'seen' => true, 'announced' => true],
            'future-honour' => ['at' => 7, 'version' => 2, 'seen' => false, 'announced' => false],
            'first-fusion' => ['at' => 1000, 'version' => 1, 'seen' => false, 'announced' => false],
        ],
        'counts' => [
            'gems' => ['ruby' => 50, 'topaz' => 4, 'sapphire' => 8],
            'forge' => 3,
            'mine' => ['relics' => 9],
        ],
        'fusions' => ['bomb+cross', 'cross+cross'],
        'showcase' => ['first-fusion'],
        'backfilled' => 1,
    ];
    $result = kept(['honours' => $previous], ['honours' => $incoming]);
    check(
        $result === $merged,
        'merge unions honours with the earliest date and the larger count ' . json_encode($result),
    );
    check(
        kept(['honours' => $merged], ['honours' => $incoming]) === $merged,
        'merging the same upload again is idempotent',
    );
    check(
        kept(['honours' => $previous], []) === kept([], ['honours' => $previous]) &&
            kept(['honours' => $previous], ['honours' => 'garbage']) ===
                kept([], ['honours' => $previous]),
        'an upload without a usable honours block keeps the earlier honours',
    );
    $emptied = kept(['honours' => $previous], ['honours' => $fresh]);
    check(
        array_keys($emptied['earned']) === array_keys($previous['earned']) &&
            $emptied['counts']['gems'] === ['ruby' => 50, 'topaz' => 4] &&
            $emptied['showcase'] === [],
        'an older snapshot never revokes honours; the incoming copy picks the showcase',
    );

    // ---------- Public projection ----------
    $plain = profile();
    $view = json_decode($public->projection($plain, 'Plain', 'honours'), true)['appearance'];
    check(
        array_key_exists('honours', $view) && $view['honours'] === null,
        'a save without honours records their absence rather than an empty collection',
    );
    $target37 = $rules['levels'][37]['starScoreTarget'];
    $target36 = $rules['levels'][36]['starScoreTarget'];
    $score37 = (int) ceil($target37 * 2.5);
    $proud = profile();
    $proud->records = asObject([
        '36' => ['stars' => 3, 'score' => $target36 * 10],
        '37' => ['stars' => 2, 'score' => $score37, 'bestTimeMs' => 900],
    ]);
    $proud->continuousRecords = asObject(['38' => ['score' => 999999999, 'coins' => 0]]);
    $proud->honours = asObject([
        'version' => 1,
        'earned' => [
            'first-perfect' => [
                'at' => 100,
                'version' => 1,
                'evidence' => ['levelId' => 36],
                'seen' => true,
                'announced' => true,
            ],
            'future-honour' => ['at' => 150, 'version' => 9, 'seen' => true, 'announced' => true],
            'score-ace' => [
                'at' => 200,
                'version' => 1,
                'evidence' => ['levelId' => 99, 'score' => 1, 'target' => 1],
                'seen' => false,
                'announced' => false,
            ],
            'score-legend' => ['at' => 250, 'version' => 1, 'seen' => false, 'announced' => false],
            'first-fusion' => [
                'at' => null,
                'version' => 1,
                'seen' => false,
                'announced' => false,
                'backfilled' => true,
            ],
            'perfect-prospector' => ['at' => 300, 'version' => 1],
            'laureate-ruby' => ['at' => 400, 'version' => 1],
            'town-complete' => ['at' => 450, 'version' => 1],
            'defence-frontier' => ['at' => 500, 'version' => 1],
        ],
        'counts' => ['gems' => ['ruby' => 12000], 'forge' => 4, 'mine' => ['relics' => 2]],
        'fusions' => ['bomb+cross'],
        'showcase' => ['perfect-prospector', 'score', 'first-fusion'],
        'backfilled' => 1,
    ]);
    $honours = shared($proud)['honours'];
    check(
        $honours === [
            'version' => 1,
            'earned' => [
                'first-perfect' => ['at' => 100],
                'score-ace' => [
                    'at' => 200,
                    'evidence' => ['levelId' => 37, 'score' => $score37, 'target' => $target37],
                ],
                'first-fusion' => ['at' => null],
                'laureate-ruby' => ['at' => 400],
                'defence-frontier' => ['at' => 500],
            ],
            'showcase' => ['score', 'first-fusion'],
        ],
        'visitors get proven honours, claims and public score evidence only ' .
            json_encode($honours),
    );
    $raw = $public->projection($proud, 'Honour Hall', 'honours');
    foreach (
        ['counts', 'fusions', 'seen', 'announced', 'backfilled', 'future-honour']
        as $private
    ) {
        check(!str_contains($raw, '"' . $private . '"'), 'the projection omits ' . $private);
    }
    $proud->records->{'37'}->score = $target37 * 2 - 1;
    $proud->records->{'402'} = (object) ['stars' => 1, 'score' => 1.5];
    check(
        !isset(shared($proud)['honours']['earned']['score-ace']),
        'a score rank below its multiple of the star target is not published',
    );
    $proud->records = asObject([
        '36' => ['stars' => 2, 'score' => $target36 * 5],
        '40' => ['stars' => 3, 'score' => 'lots'],
    ]);
    $earned = shared($proud)['honours']['earned'];
    check(
        isset($earned['first-perfect']) && !isset($earned['score-ace']),
        'levels below the score floor and invalid scores never prove a score rank',
    );
    $proud->records = new stdClass();
    check(
        !isset(shared($proud)['honours']['earned']['first-perfect']),
        'First Perfect needs a three-star record',
    );

    $perfect = profile();
    $perfect->records = new stdClass();
    for ($level = 1; $level <= $schema['levels']; $level++) {
        $perfect->records->{(string) $level} = (object) ['stars' => 3, 'score' => 1];
    }
    $perfect->honours = asObject([
        'earned' => ['perfect-prospector' => ['at' => 5], 'first-perfect' => ['at' => 4]],
        'showcase' => ['perfect-prospector'],
    ]);
    $honours = shared($perfect)['honours'];
    check(
        $honours['earned'] === [
            'perfect-prospector' => ['at' => 5],
            'first-perfect' => ['at' => 4],
        ] && $honours['showcase'] === ['perfect-prospector'],
        'Perfect Prospector is published with three stars on every published level',
    );
    $perfect->records->{(string) $schema['levels']}->stars = 2;
    $honours = shared($perfect)['honours'];
    check(
        !isset($honours['earned']['perfect-prospector']) && $honours['showcase'] === [],
        'one missing star hides Perfect Prospector and its showcase slot',
    );

    $final = $schema['honours']['finalEra'];
    $eraIndex = fn($era) => array_search($era, $rules['eraOrder'], true);
    $complete = json_decode(json_encode($defaultProfile));
    $complete->town->era = $final;
    $required = null;
    foreach ($rules['buildings'] as $id => $building) {
        if (
            $building['requiredForEraCompletion'] &&
            $eraIndex($building['introducedEra']) <= $eraIndex($final)
        ) {
            $complete->town->buildings->$id = $building['maxLevel'];
            $complete->town->buildingEras->$id = $final;
            $complete->town->buildingEraLevels->$id = $rules['eraBuildingLevels'];
            $required ??= $id;
        }
    }
    $complete->honours = asObject(['earned' => ['town-complete' => ['at' => 8]]]);
    $integrity = new SaveIntegrity();
    check(
        $integrity->eraComplete(json_decode(json_encode($complete->town), true)) &&
            !$integrity->eraComplete(json_decode(json_encode($defaultProfile->town), true)) &&
            !$integrity->eraComplete(['era' => 'unknown-era', 'buildings' => []]) &&
            !$integrity->eraComplete([]),
        'the shared era completion check reads saved towns',
    );
    // The same check still gates a replayed era advance.
    $now = time() * 1000;
    $frontier = json_decode(json_encode($defaultProfile));
    $frontier->integrity = (object) [
        'version' => 1,
        'epoch' => uuid(),
        'baseSequence' => 0,
        'clientAt' => $now,
        'actions' => [],
    ];
    $short = null;
    foreach ($rules['buildings'] as $id => $building) {
        if ($building['requiredForEraCompletion'] && $building['introducedEra'] === 'frontier') {
            $frontier->town->buildings->$id = $building['maxLevel'];
            $short ??= $id;
        }
    }
    $advance = function (object $town) use ($integrity, $now, $rules): string {
        $anchor = $integrity->accept($town, null, $now);
        $next = json_decode(json_encode($town));
        $next->integrity = json_decode(json_encode($anchor->integrity));
        $next->integrity->actions = [
            (object) [
                'sequence' => 1,
                'id' => uuid(),
                'kind' => 'era-advance',
                'data' => (object) ['expectedEra' => 'frontier', 'at' => $now],
            ],
        ];
        $next->town->era = $rules['eraOrder'][1];
        try {
            return $integrity->accept($next, $anchor, $now)->town->era;
        } catch (App\ApiError $error) {
            return $error->details['field'] ?? 'error';
        }
    };
    check($advance($frontier) === $rules['eraOrder'][1], 'a complete town still advances its era');
    $frontier->town->buildings->$short--;
    check($advance($frontier) === 'era-advance', 'an incomplete town still cannot advance');
    check(
        shared($complete)['honours']['earned'] === ['town-complete' => ['at' => 8]],
        'Prospect Hollow Complete is published for a finished final era',
    );
    $complete->town->buildings->$required = $rules['buildings'][$required]['maxLevel'] - 1;
    check(
        shared($complete)['honours']['earned'] === [],
        'an unfinished required building hides Prospect Hollow Complete',
    );
    $complete->town->buildings->$required = $rules['buildings'][$required]['maxLevel'];
    $complete->town->projects = asObject([
        $required => ['id' => $required, 'stage' => 1, 'required' => 1, 'wins' => 0],
    ]);
    check(
        shared($complete)['honours']['earned'] === [],
        'a building project in progress hides Prospect Hollow Complete',
    );
    $complete->town->projects = new stdClass();
    $complete->town->era = $rules['eraOrder'][$eraIndex($final) - 1];
    check(
        shared($complete)['honours']['earned'] === [],
        'an earlier era never proves Prospect Hollow Complete',
    );

    foreach (
        [
            ['earned' => 'x', 'showcase' => 'y', 'counts' => 5, 'version' => -1],
            ['earned' => ['first-fusion' => ['at' => 'soon']], 'showcase' => [['first-fusion']]],
        ]
        as $blob
    ) {
        $odd = profile();
        $odd->honours = asObject($blob);
        $raw = $public->projection($odd, 'Odd', 'honours');
        check(str_contains($raw, '"honours":{"version":1,"earned":'), 'garbage still projects');
    }
    check(
        str_contains($raw, '"earned":{"first-fusion":{"at":null}},"showcase":[]'),
        'an invalid date is published as unknown and earned stays an object',
    );
    $odd->honours = asObject(['earned' => (object) [], 'showcase' => []]);
    check(
        str_contains(
            $public->projection($odd, 'Odd', 'honours'),
            '"honours":{"version":1,"earned":{},"showcase":[]}',
        ),
        'an honours block with nothing earned publishes an empty object',
    );

    // ---------- Accepting uploads ----------
    $owner = account();
    $body = townBody('Honour Hall');
    $body['profile']->honours = asObject($previous);
    $town = status(200, callApi('POST', 'towns', $body, $owner), 'attach with honours');
    $id = $town['townId'];
    check(
        $town['profile']['honours'] === kept([], ['honours' => $previous]),
        'a new town stores its bounded honours',
    );
    $upload = ['baseRevision' => 1, 'uploadId' => uuid(), 'profile' => profile()];
    $upload['profile']->honours = asObject($incoming);
    $saved = status(200, callApi('PUT', 'towns/' . $id, $upload, $owner), 'save merges honours');
    check(
        $saved['profile']['honours'] === $merged,
        'an accepted upload keeps every earlier honour and never sums counts',
    );
    check(
        status(200, callApi('PUT', 'towns/' . $id, $upload, $owner), 'honours retry') === $saved,
        'an exact retry returns the same merged save',
    );
    $older = status(
        200,
        callApi(
            'PUT',
            'towns/' . $id,
            ['baseRevision' => 2, 'uploadId' => uuid(), 'profile' => profile(30)],
            $owner,
        ),
        'older client without honours',
    );
    check(
        $older['profile']['honours'] === $merged,
        'an upload from an older client keeps the cloud honours',
    );
    $first = json_decode(
        $db
            ->get()
            ->fetchOne('SELECT profile FROM town_history WHERE town_id=? AND revision=1', [$id]),
    );
    $restored = status(
        200,
        callApi(
            'PUT',
            'towns/' . $id . '/resolve',
            ['baseRevision' => 3, 'uploadId' => uuid(), 'profile' => $first],
            $owner,
        ),
        'restore the first snapshot',
    );
    check(
        array_keys($restored['profile']['honours']['earned']) === array_keys($merged['earned']) &&
            $restored['profile']['honours']['counts'] === $merged['counts'] &&
            $restored['profile']['honours']['showcase'] === ['first-perfect'] &&
            $restored['profile']['town']['coins'] === 25,
        'restoring an older snapshot replaces progress but never revokes honours',
    );
    $junk = profile();
    $junk->honours = 'garbage';
    $afterJunk = status(
        200,
        callApi(
            'PUT',
            'towns/' . $id,
            ['baseRevision' => 4, 'uploadId' => uuid(), 'profile' => $junk],
            $owner,
        ),
        'a garbage honours block never breaks saving',
    );
    check(
        $afterJunk['profile']['honours'] === $restored['profile']['honours'],
        'a garbage block keeps the stored honours',
    );
    $junk->honours = asObject($flood);
    $afterFlood = status(
        200,
        callApi(
            'PUT',
            'towns/' . $id,
            ['baseRevision' => 5, 'uploadId' => uuid(), 'profile' => $junk],
            $owner,
        ),
        'a flood of honours is bounded',
    );
    $unknown = array_diff(
        array_keys($afterFlood['profile']['honours']['earned']),
        array_keys($definitions),
    );
    check(
        count($unknown) === 32 &&
            isset($afterFlood['profile']['honours']['earned']['future-honour']) &&
            count($afterFlood['profile']['honours']['counts']['gems']) === 64 &&
            $afterFlood['profile']['honours']['counts']['gems']['ruby'] === 50,
        'stored honours stay bounded and keep earlier entries first',
    );

    // Admin history restores keep the honours earned since that revision.
    $admin = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
    $admin->restoreTown($adminAudit, $id, ['revision' => 1]);
    $adminRestored = status(200, callApi('GET', 'towns/' . $id, null, $owner), 'owner reads');
    check(
        $adminRestored['revision'] === 7 &&
            $adminRestored['profile']['town']['coins'] === 25 &&
            isset(
                $adminRestored['profile']['honours']['earned']['first-fusion'],
                $adminRestored['profile']['honours']['earned']['future-30'],
            ) &&
            $adminRestored['profile']['honours']['counts']['gems']['ruby'] === 50,
        'an admin restore never revokes honours',
    );

    // Tracked towns: honours are outside the replay comparison and the signed checkpoint.
    $trackedProfile = json_decode(json_encode($defaultProfile));
    $trackedProfile->integrity = (object) [
        'version' => 1,
        'epoch' => uuid(),
        'baseSequence' => 0,
        'clientAt' => time() * 1000,
        'actions' => [],
    ];
    $trackedProfile->honours = asObject(['earned' => ['first-perfect' => ['at' => 1000]]]);
    $trackedBody = townBody('Tracked Honours');
    $trackedBody['profile'] = $trackedProfile;
    $tracked = status(200, callApi('POST', 'towns', $trackedBody, $owner), 'tracked honours');
    $signed = checkpointState($tracked['integrity']['checkpoint']);
    check(
        !isset($signed['honours']) && $tracked['integrity']['status'] === 'baseline',
        'the signed checkpoint never contains honours',
    );
    $honoursOnly = json_decode(json_encode($trackedProfile));
    $honoursOnly->integrity = asObject($tracked['profile']['integrity']);
    $honoursOnly->honours = asObject([
        'earned' => ['forge-delivers' => ['at' => 2000]],
        'counts' => ['forge' => 1],
    ]);
    $honoursUpload = [
        'baseRevision' => 1,
        'uploadId' => uuid(),
        'profile' => $honoursOnly,
    ];
    $trackedSaved = status(
        200,
        callApi('PUT', 'towns/' . $tracked['townId'], $honoursUpload, $owner),
        'tracked honours change',
    );
    check(
        array_keys($trackedSaved['profile']['honours']['earned']) === [
            'first-perfect',
            'forge-delivers',
        ] &&
            $trackedSaved['integrity']['ackSequence'] === 0 &&
            checkpointState($trackedSaved['integrity']['checkpoint']) === $signed,
        'an honours-only change replays nothing and leaves the signed state unchanged',
    );
    check(
        status(
            200,
            callApi('PUT', 'towns/' . $tracked['townId'], $honoursUpload, $owner),
            'tracked honours retry',
        ) === $trackedSaved,
        'a tracked honours upload retries exactly',
    );
    $recovery = json_decode(json_encode($trackedProfile));
    $recovery->integrity = asObject($tracked['profile']['integrity']);
    $recovery->honours = asObject($fresh);
    $recovered = status(
        200,
        callApi(
            'PUT',
            'towns/' . $tracked['townId'] . '/resolve',
            ['baseRevision' => 2, 'uploadId' => uuid(), 'profile' => $recovery],
            $owner,
        ),
        'signed recovery with fewer honours',
    );
    check(
        array_keys($recovered['profile']['honours']['earned']) === [
            'first-perfect',
            'forge-delivers',
        ] &&
            $recovered['profile']['honours']['counts']['forge'] === 1 &&
            $recovered['integrity']['status'] === 'tracked',
        'signed recovery never revokes honours',
    );

    // ---------- Shared towns ----------
    status(
        200,
        callApi(
            'PATCH',
            'towns/' . $id . '/settings',
            ['baseRevision' => 7, 'name' => 'Honour Hall', 'isPublic' => true],
            $owner,
        ),
        'share honours town',
    );
    $publicId = $adminRestored['publicId'];
    $visit = status(200, callApi('GET', 'villages/' . $publicId), 'visit honours town');
    check(
        array_keys($visit['appearance']['honours']) === ['version', 'earned', 'showcase'] &&
            isset($visit['appearance']['honours']['earned']['first-fusion']) &&
            !isset($visit['appearance']['honours']['earned']['first-perfect']) &&
            !isset($visit['appearance']['honours']['earned']['future-honour']),
        'a visit shows claimed honours and hides unproven and unknown ones',
    );
    $plainBody = townBody('Quiet Gulch');
    $plainTown = status(200, callApi('POST', 'towns', $plainBody, $owner), 'town without honours');
    $plainPublic = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $plainTown['townId'] . '/settings',
            ['baseRevision' => 1, 'name' => 'Quiet Gulch', 'isPublic' => true],
            $owner,
        ),
        'share town without honours',
    )['publicId'];
    $stored = json_decode(
        $db->get()->fetchOne('SELECT appearance FROM towns WHERE id=?', [$plainTown['townId']]),
        true,
    );
    check(
        array_key_exists('honours', $stored['appearance']) &&
            $stored['appearance']['honours'] === null,
        'the stored projection records that the save has no honours',
    );
    foreach (['', '/latest'] as $suffix) {
        $quiet = status(200, callApi('GET', 'villages/' . $plainPublic . $suffix), 'quiet visit');
        check(
            !array_key_exists('honours', $quiet['appearance']),
            'visitors see no honours field, not an empty collection',
        );
    }
    // A recorded absence is trusted, so visits never re-read that save.
    $sneaky = profile();
    $sneaky->honours = asObject(['earned' => ['first-fusion' => ['at' => 1]]]);
    $db->get()->update(
        'towns',
        ['profile' => json_encode($sneaky)],
        ['id' => $plainTown['townId']],
    );
    check(
        !array_key_exists(
            'honours',
            status(200, callApi('GET', 'villages/' . $plainPublic), 'no re-read')['appearance'],
        ),
        'a recorded absence is served without reading the save',
    );
    // Shares projected before honours existed gain them on read.
    unset($stored['appearance']['honours']);
    $db->get()->update(
        'towns',
        ['appearance' => json_encode($stored)],
        ['id' => $plainTown['townId']],
    );
    foreach (['', '/latest'] as $suffix) {
        $legacy = status(200, callApi('GET', 'villages/' . $plainPublic . $suffix), 'legacy');
        check(
            $legacy['appearance']['honours'] === [
                'version' => 1,
                'earned' => ['first-fusion' => ['at' => 1]],
                'showcase' => [],
            ],
            'an older share is projected from the saved honours on read',
        );
    }
    $page = 1;
    do {
        $browse = status(200, callApi('GET', 'villages?page=' . $page, null, $owner), 'browse');
        foreach ($browse['entries'] as $entry) {
            check(
                !array_key_exists('honours', $entry['appearance']) ||
                    is_array($entry['appearance']['honours']),
                'browsing never lists a null honours field',
            );
        }
        $page++;
    } while ($browse['hasNext'] && $page <= 50);
    echo "Honours checks passed ($count assertions).\n";
} finally {
    $db->get()->delete('admin_audit', ['admin' => $adminAudit]);
    cleanup();
}
