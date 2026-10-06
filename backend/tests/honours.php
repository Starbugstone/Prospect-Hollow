<?php
// Town Honours on the server: counters credited by the integrity replay (offline play
// included), verification that never revokes, bounded storage, merges that never sum, and
// a public projection with verified honours only. Goals are read from the exported
// catalog, so calibrating them never breaks these checks.
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService, Honours, SaveIntegrity};

$content = dirname(__DIR__) . '/content/';
$schema = json_decode(
    file_get_contents($content . 'public-schema.json'),
    true,
    64,
    JSON_THROW_ON_ERROR,
);
$rules = json_decode(
    file_get_contents($content . 'save-rules.json'),
    true,
    64,
    JSON_THROW_ON_ERROR,
);
$flows = json_decode(
    file_get_contents(__DIR__ . '/fixtures/integrity-flows.json'),
    false,
    64,
    JSON_THROW_ON_ERROR,
)->fixtures;
$defaultProfile = json_decode(
    file_get_contents($content . 'save-rules.json'),
    false,
    64,
    JSON_THROW_ON_ERROR,
)->defaultProfile;
$definitions = $schema['honours']['definitions'];
$catalog = new Honours($schema['honours']);
$validator = new SaveIntegrity();
$noSocial = fn(string $counter): int => 0;

function asObject(mixed $value): mixed
{
    return json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
}
function asArray(mixed $value): mixed
{
    return json_decode(json_encode($value, JSON_THROW_ON_ERROR), true, 64, JSON_THROW_ON_ERROR);
}
/** Order-independent comparison of decoded maps. */
function canonical(mixed $value): mixed
{
    if (!is_array($value)) {
        return $value;
    }
    if (!array_is_list($value)) {
        ksort($value);
    }
    return array_map('canonical', $value);
}
function goal(string $id): int|float
{
    global $definitions;
    return $definitions[$id]['goal'];
}
/** The exported catalog with some goals replaced, to test exact thresholds. */
function catalogWith(array $goals): Honours
{
    global $schema;
    $honours = $schema['honours'];
    foreach ($goals as $id => $goal) {
        $honours['definitions'][$id]['goal'] = $goal;
    }
    return new Honours($honours);
}
function earnedEntry(?int $at = 1000): array
{
    return ['at' => $at, 'version' => 1, 'seen' => false, 'announced' => false];
}
/** The honours stored after accepting $incoming over $previous (untracked profiles). */
function kept(array $previous, array $incoming): mixed
{
    global $catalog;
    $result = $catalog->keep(
        asObject(['schemaVersion' => 2] + $incoming),
        $previous ? asObject(['schemaVersion' => 2] + $previous) : null,
    );
    return property_exists($result, 'honours') ? asArray($result->honours) : 'absent';
}
/** Server counters as the replay stores them, with every counter present. */
function replayed(array $values = []): array
{
    return canonical(
        array_replace(
            ['gems' => [], 'mine' => [], 'fusions' => [], 'forge' => 0, 'guardian' => 0],
            $values,
        ),
    );
}
function counters(object $profile): array
{
    return canonical(asArray($profile->integrity->context->honours));
}
function flow(string $name): object
{
    global $flows;
    foreach ($flows as $flow) {
        if ($flow->name === $name) {
            return asObject($flow);
        }
    }
    throw new RuntimeException('Missing integrity fixture: ' . $name);
}
function published(object $profile, ?Closure $social = null, ?Honours $with = null): array
{
    global $catalog, $noSocial;
    return asArray(($with ?? $catalog)->publish($profile, $social ?? $noSocial));
}
function checkpointContext(string $token): array
{
    $body = explode('.', $token)[0];
    return json_decode(gzuncompress(base64_decode(strtr($body, '-_', '+/'))), true)['context'];
}
function sorted(array $values): array
{
    sort($values);
    return $values;
}
/** A tracked first-enrollment profile from the default profile, with these records. */
function tracked(array $records = []): object
{
    global $defaultProfile;
    $profile = json_decode(json_encode($defaultProfile, JSON_THROW_ON_ERROR));
    foreach ($records as $id => $record) {
        $profile->records->$id = (object) $record;
    }
    $profile->integrity = (object) [
        'version' => 1,
        'epoch' => uuid(),
        'baseSequence' => 0,
        'clientAt' => time() * 1000,
        'actions' => [],
    ];
    return $profile;
}
/** The stored cloud profile, keeping empty maps as objects for the next upload. */
function storedProfile(string $id): object
{
    global $db;
    return json_decode($db->get()->fetchOne('SELECT profile FROM towns WHERE id=?', [$id]));
}
function shared(object $profile): mixed
{
    global $public;
    return json_decode($public->projection($profile, 'Honour Hall', 'honours'), true)['appearance'];
}
$adminAudit = 'honours-test-' . bin2hex(random_bytes(4));
try {
    // ---------- Shared definitions ----------
    check(
        $schema['honours']['version'] === 2 &&
            $schema['honours']['showcaseSlots'] === 3 &&
            $schema['honours']['counters'] === [
                'gems' => 'map',
                'mine' => 'map',
                'fusions' => 'map',
                'forge' => 'number',
                'guardian' => 'number',
                'visitors' => 'number',
                'travels' => 'number',
            ],
        'the public schema exports the honours constants and counters from the registry',
    );
    $kinds = ['stars', 'score', 'era', 'count', 'distinct', 'powers', 'social', 'landmark'];
    foreach ($definitions as $id => $definition) {
        check(
            array_keys($definition) === ['family', 'rank', 'metal', 'tab', 'goal', 'measure'] &&
                str_starts_with($id, $definition['family'] . '-') &&
                in_array($definition['measure']['kind'], $kinds, true) &&
                (is_int($definition['goal']) || is_float($definition['goal'])),
            $id . ' is a rank the server can evaluate',
        );
    }
    check(
        $definitions['fusion-silver']['measure']['kind'] === 'distinct' &&
            in_array('bomb+cross', $definitions['fusion-silver']['measure']['keys'], true) &&
            $definitions['score-bronze']['measure']['fromLevel'] === 37 &&
            $definitions['ages-gold']['goal'] ===
                array_search('riverlight', $rules['eraOrder'], true) * 2 + 1,
        'measures carry their keys, first level and precomputed era step',
    );
    $elements = array_filter(
        array_map(fn($level) => $level['honourElements'] ?? null, $rules['levels']),
    );
    check(
        $rules['honours']['gems'] === [
            'ruby',
            'sapphire',
            'emerald',
            'topaz',
            'amethyst',
            'moonstone',
        ] &&
            in_array('rainbow+rainbow', $rules['honours']['fusions'], true) &&
            count($elements) > 100 &&
            !array_filter(
                $elements,
                fn($counts) => !array_filter($counts) ||
                    array_diff_key($counts, $schema['honours']['counters']) === [],
            ),
        'save rules export claimable keys and each level’s mine elements ' .
            json_encode(array_slice($elements, 0, 3, true)),
    );

    // The paid-landmark replay is the proof, not an uploaded honour claim.
    $monumentFlow = flow('optional landmark monument: construction, upgrades and replacement');
    $monumentClock = $monumentFlow->after->integrity->clientAt;
    $monumentBase = $validator->accept(
        $monumentFlow->before,
        null,
        $monumentClock,
        false,
        [],
        'monument-town',
    );
    $monumentBase = $catalog->keep($monumentBase, null, $noSocial);
    check(
        !in_array('monument-gold', $monumentBase->honours->verified, true),
        'no monument, no distinction',
    );
    $monumentSaved = $validator->accept(
        $monumentFlow->after,
        $monumentBase,
        $monumentClock,
        false,
        [],
        'monument-town',
    );
    $monumentSaved = $catalog->keep($monumentSaved, $monumentBase, $noSocial);
    check(
        in_array('monument-gold', $monumentSaved->honours->verified, true),
        'paid construction and replacements verify the single monument distinction',
    );
    $monumentAgain = $validator->accept(
        $monumentFlow->after,
        $monumentSaved,
        $monumentClock,
        false,
        [],
        'monument-town',
    );
    $monumentAgain = $catalog->keep($monumentAgain, $monumentSaved, $noSocial);
    check(
        $monumentAgain->honours->earned->{'monument-gold'} ==
            $monumentSaved->honours->earned->{'monument-gold'},
        'receipt retries keep the first award',
    );
    $monumentPublic = published($monumentSaved);
    check(
        isset($monumentPublic['earned']['monument-gold']),
        'visitors see the verified monument distinction',
    );

    // ---------- Storage bounds ----------
    check(kept([], []) === 'absent', 'a save without honours stays without honours');
    foreach (['garbage', [1, 2], 7, null, true] as $junk) {
        check(kept([], ['honours' => $junk]) === 'absent', 'a non-object honours block is dropped');
    }
    $fresh = [
        'version' => 1,
        'earned' => (object) [],
        'counts' => [
            'gems' => (object) [],
            'mine' => (object) [],
            'fusions' => (object) [],
            'forge' => 0,
            'guardian' => 0,
            'visitors' => 0,
            'travels' => 0,
        ],
        'showcase' => [],
        'backfilled' => 0,
        'seenGeneration' => 1,
        'verified' => [],
    ];
    $client = [
        'version' => 1,
        'earned' => [
            'stars-bronze' => [
                'at' => 1700000000000,
                'version' => 1,
                'evidence' => ['levelId' => 4],
                'seen' => true,
                'announced' => true,
            ],
            'score-silver' => [
                'at' => 1700000001000,
                'version' => 1,
                'evidence' => ['levelId' => 40, 'score' => 30000, 'target' => 12000],
                'seen' => false,
                'announced' => false,
            ],
            'guardian-bronze' => earnedEntry(null) + ['backfilled' => true],
        ],
        'counts' => [
            'gems' => ['ruby' => 120],
            'mine' => ['relics' => 3],
            'fusions' => ['bomb+cross' => 2],
            'forge' => 2,
            'guardian' => 1,
            'visitors' => 2,
            'travels' => 4,
        ],
        'showcase' => ['score', 'stars'],
        'backfilled' => 1,
        'seenGeneration' => 1,
        'verified' => [],
    ];
    foreach ([$fresh, $client] as $block) {
        check(
            json_encode($catalog->keep(asObject(['honours' => $block]), null)->honours) ===
                json_encode($block),
            'a well-formed untracked client block is stored byte for byte',
        );
    }
    $garbage = kept(
        [],
        [
            'honours' => [
                'version' => 'x',
                'earned' => [
                    'BAD ID' => ['at' => 5],
                    'fusion-bronze' => 'yes',
                    'stars-bronze' => [
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
                    'fusions' => ['bomb+cross' => 3, 'bad key' => 1, 'cross+rainbow' => 0],
                    'forge' => -3,
                    'mine' => 'lots',
                    'travels' => 2.5,
                ],
                'fusions' => ['bomb+cross'],
                'showcase' => ['score', 'score', 'Bad', 'stars', 'forge', 'gates'],
                'backfilled' => -1,
                'seenGeneration' => 'x',
                'verified' => ['gem-ruby-gold', 'stars-gold'],
            ],
        ],
    );
    check(
        $garbage === [
            'version' => 1,
            'earned' => [
                'stars-bronze' => [
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
            'counts' => [
                'gems' => ['topaz' => 9],
                'mine' => [],
                'fusions' => ['bomb+cross' => 3],
                'forge' => 0,
                'guardian' => 0,
                'visitors' => 0,
                'travels' => 0,
            ],
            'showcase' => ['score', 'stars', 'forge'],
            'backfilled' => 0,
            'seenGeneration' => 0,
            'verified' => [],
        ],
        'malformed values are dropped, fusion keys kept, the old fusions list and an uploaded verified list ignored ' .
            json_encode($garbage),
    );
    $flood = ['earned' => [], 'counts' => ['gems' => [], 'fusions' => []]];
    for ($i = 0; $i < 500; $i++) {
        $flood['earned']['future-' . $i] = ['at' => $i + 1];
        $flood['counts']['gems']['gem' . $i] = $i + 1;
        $flood['counts']['fusions']['a' . $i . '+b'] = $i + 1;
    }
    $flood['earned']['stars-bronze'] = ['at' => 1];
    $flood['earned']['stars-bronze']['evidence'] = array_fill_keys(
        array_map(fn($n) => 'key' . $n, range(1, 20)),
        1,
    );
    $flood['verified'] = array_map(fn($n) => 'forged-' . $n, range(1, 5000));
    $bounded = kept([], ['honours' => $flood]);
    check(
        count($bounded['earned']) === 33 &&
            isset($bounded['earned']['stars-bronze'], $bounded['earned']['future-31']) &&
            !isset($bounded['earned']['future-32']) &&
            count($bounded['earned']['stars-bronze']['evidence']) === 8 &&
            count($bounded['counts']['gems']) === 64 &&
            count($bounded['counts']['fusions']) === 64 &&
            $bounded['verified'] === [],
        'storage keeps every catalog honour and caps unknown IDs, evidence and count keys',
    );
    check(
        kept([], ['honours' => $bounded]) === $bounded,
        'bounding an already bounded block changes nothing',
    );
    check(
        kept([], ['honours' => ['earned' => []]])['seenGeneration'] ===
            $schema['honours']['version'],
        'a block from before generations has seen the current generation, as on the client',
    );

    // ---------- Merge: never revoke, never sum ----------
    $previous = [
        'version' => 1,
        'earned' => [
            'stars-bronze' => [
                'at' => 500,
                'version' => 1,
                'evidence' => ['levelId' => 3],
                'seen' => true,
                'announced' => false,
            ],
            'forge-bronze' => earnedEntry(null) + ['backfilled' => true],
            'future-honour' => ['at' => 7, 'version' => 2, 'seen' => false, 'announced' => false],
        ],
        'counts' => [
            'gems' => ['ruby' => 50, 'topaz' => 4],
            'mine' => ['relics' => 9],
            'fusions' => ['bomb+cross' => 3],
            'forge' => 3,
            'travels' => 6,
        ],
        'showcase' => ['stars'],
        'backfilled' => 1,
        'seenGeneration' => 1,
    ];
    $incoming = [
        'version' => 1,
        'earned' => [
            'stars-bronze' => ['at' => 300, 'version' => 1, 'seen' => false, 'announced' => true],
            'forge-bronze' => ['at' => 900, 'version' => 1, 'seen' => true, 'announced' => true],
            'fusion-bronze' => earnedEntry(1000),
        ],
        'counts' => [
            'gems' => ['ruby' => 30, 'sapphire' => 8],
            'fusions' => ['bomb+cross' => 1, 'cross+cross' => 2],
            'forge' => 1,
            'visitors' => 4,
        ],
        'showcase' => ['fusion'],
        'backfilled' => 0,
        'seenGeneration' => 2,
        'verified' => ['gem-ruby-gold'],
    ];
    $merged = [
        'version' => 1,
        'earned' => [
            'stars-bronze' => ['at' => 300, 'version' => 1, 'seen' => true, 'announced' => true],
            'forge-bronze' => ['at' => 900, 'version' => 1, 'seen' => true, 'announced' => true],
            'future-honour' => ['at' => 7, 'version' => 2, 'seen' => false, 'announced' => false],
            'fusion-bronze' => earnedEntry(1000),
        ],
        'counts' => [
            'gems' => ['ruby' => 50, 'topaz' => 4, 'sapphire' => 8],
            'mine' => ['relics' => 9],
            'fusions' => ['bomb+cross' => 3, 'cross+cross' => 2],
            'forge' => 3,
            'guardian' => 0,
            'visitors' => 4,
            'travels' => 6,
        ],
        'showcase' => ['fusion'],
        'backfilled' => 1,
        'seenGeneration' => 2,
        'verified' => [],
    ];
    $result = kept(['honours' => $previous], ['honours' => $incoming]);
    check(
        $result === $merged,
        'merge unions honours with the earliest date and the larger count ' . json_encode($result),
    );
    check(
        kept(['honours' => $merged], ['honours' => $incoming]) === $merged,
        'merging the same upload again is idempotent and never sums',
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

    // ---------- Offline play: one sync credits every queued action ----------
    $offline = flow(
        'offline Town Honours: claimed victories, a forge collection and a protected raid',
    );
    $clock = $offline->serverNow;
    $actions = asArray($offline->after)['integrity']['actions'];
    $victories = array_keys(array_filter($actions, fn($action) => $action['kind'] === 'victory'));
    check(
        count($victories) === 2 &&
            !array_diff(['forge-collect', 'raid-seen'], array_column($actions, 'kind')),
        'the offline fixture queues two claimed victories, a forge collection and a raid',
    );
    $mine = [];
    foreach ($victories as $index) {
        foreach (
            $rules['levels'][$actions[$index]['data']['levelId']]['honourElements'] ?? []
            as $element => $count
        ) {
            $mine[$element] = ($mine[$element] ?? 0) + $count;
        }
    }
    $expected = replayed([
        'gems' => ['ruby' => 150, 'topaz' => 40, 'sapphire' => 20],
        'mine' => $mine,
        'fusions' => ['bomb+cross' => 1, 'cross+cross' => 2],
        'forge' => 1,
        'guardian' => 1,
    ]);
    $enrolled = $validator->accept($offline->before, null, $clock, false, [], 'offline-town');
    check(
        counters($enrolled) === replayed() && $mine !== [],
        'a new town enrolls with empty counters; the fixture levels hold mine elements',
    );
    $enrolled = $catalog->keep($enrolled, null, $noSocial);
    $synced = $validator->accept($offline->after, $enrolled, $clock, false, [], 'offline-town');
    check(
        counters($synced) === $expected && SaveIntegrity::receipt($synced)['status'] === 'tracked',
        'one offline sync credits claimed gems and fusions, level mine elements, the forge and the protected raid ' .
            json_encode(counters($synced)),
    );
    check(
        canonical(checkpointContext($synced->integrity->checkpoint)['honours']) === $expected &&
            $synced->integrity->context->honours->gems instanceof stdClass,
        'the signed checkpoint carries the counters, stored with object-shaped maps',
    );
    $again = $validator->accept($offline->after, $synced, $clock, false, [], 'offline-town');
    check(
        counters($again) === $expected,
        'the same batch uploaded again (an acknowledgment lost in transit) never double-counts',
    );
    // Thresholds at the replayed counts verify exactly what the server credited.
    $exact = catalogWith([
        'forge-bronze' => 1,
        'guardian-bronze' => 1,
        'gem-ruby-bronze' => 150,
        'gem-ruby-silver' => 151,
        'gem-topaz-bronze' => 40,
        'fusion-bronze' => 3,
        'fusion-gold' => 4,
        'mine-relics-bronze' => $mine['relics'] ?? 1,
    ]);
    $stored = $exact->keep(clone $synced, $enrolled, $noSocial);
    $verified = $stored->honours->verified;
    check(
        !array_diff(
            [
                'forge-bronze',
                'guardian-bronze',
                'gem-ruby-bronze',
                'gem-topaz-bronze',
                'fusion-bronze',
            ],
            $verified,
        ) &&
            in_array('mine-relics-bronze', $verified, true) === isset($mine['relics']) &&
            !array_intersect(['gem-ruby-silver', 'fusion-gold', 'fusion-silver'], $verified),
        'offline counters verify exactly the ranks they reach ' . json_encode($verified),
    );
    check(
        canonical(
            array_diff_key(asArray($stored->honours->counts), ['visitors' => 0, 'travels' => 0]),
        ) === $expected,
        'the stored counts are the server counters, including mine elements the client never sent',
    );
    $shown = published($stored, null, $exact);
    check(
        $shown['earned'] &&
            sorted(array_keys($shown['earned'])) ===
                sorted(
                    array_intersect(
                        array_keys(asArray($offline->after->honours->earned)),
                        $verified,
                    ),
                ),
        'the honours earned offline are published once the server verified them ' .
            json_encode($shown),
    );
    // With the calibrated goals, whatever verifies matches the counters.
    $calibrated = $catalog->keep(clone $synced, $enrolled, $noSocial)->honours->verified;
    foreach ($definitions as $id => $definition) {
        $measure = $definition['measure'];
        if ($measure['kind'] !== 'count') {
            continue;
        }
        $value = $expected[$measure['counter']];
        $value = is_array($value)
            ? (isset($measure['key'])
                ? $value[$measure['key']] ?? 0
                : array_sum($value))
            : $value;
        check(
            in_array($id, $calibrated, true) === $value >= $definition['goal'],
            $id . ' verifies exactly when the server counter reaches its goal',
        );
    }

    // ---------- Claims are bounded but never block syncing ----------
    $firstVictory = $victories[0];
    $jewels = $actions[$firstVictory]['data']['jewels'];
    $withoutFirst = replayed([
        'gems' => ['ruby' => 30, 'sapphire' => 20],
        'mine' => $mine,
        'fusions' => ['cross+cross' => 2],
        'forge' => 1,
        'guardian' => 1,
    ]);
    foreach (
        [
            'an unknown gem' => ['gems' => ['ruby' => 1, 'diamond' => 1], 'fusions' => []],
            'more gems than jewels' => ['gems' => ['ruby' => $jewels - 5, 'topaz' => 6]],
            'more fusions than jewels' => [
                'gems' => [],
                'fusions' => ['bomb+cross' => $jewels + 1],
            ],
            'a negative count' => ['gems' => ['ruby' => -5]],
            'a fractional count' => ['gems' => ['ruby' => 1.5]],
            'a numeric string' => ['gems' => ['ruby' => '5']],
            'an unknown fusion' => ['fusions' => ['bomb+bomb+bomb' => 1]],
            'a nested count' => ['gems' => ['ruby' => [5]]],
            'a list' => ['gems' => [5, 6]],
            'a malformed claim' => 'lots',
            'a malformed map' => ['gems' => 'lots'],
            'no claim' => null,
        ]
        as $label => $claim
    ) {
        $odd = asArray($offline->after);
        if ($claim === null) {
            unset($odd['integrity']['actions'][$firstVictory]['data']['honours']);
        } else {
            $odd['integrity']['actions'][$firstVictory]['data']['honours'] = $claim;
        }
        $accepted = $validator->accept(
            asObject($odd),
            $enrolled,
            $clock,
            false,
            [],
            'offline-town',
        );
        check(
            counters($accepted) === $withoutFirst &&
                SaveIntegrity::receipt($accepted)['status'] === 'tracked',
            $label .
                ' credits nothing from that claim and still syncs ' .
                json_encode(counters($accepted)),
        );
    }
    $full = asArray($offline->after);
    $full['integrity']['actions'][$firstVictory]['data']['honours'] = [
        'gems' => ['ruby' => $jewels - 1, 'moonstone' => 1],
        'fusions' => ['rainbow+rainbow' => $jewels],
    ];
    $accepted = $validator->accept(asObject($full), $enrolled, $clock, false, [], 'offline-town');
    check(
        counters($accepted)['gems']['ruby'] === $jewels - 1 + 30 &&
            counters($accepted)['gems']['moonstone'] === 1 &&
            counters($accepted)['fusions']['rainbow+rainbow'] === $jewels,
        'a claim totalling exactly the receipt jewels is credited',
    );

    // ---------- A hacked upload proves nothing ----------
    $hacked = asArray($offline->after);
    $huge = 9007199254740991;
    $hacked['honours']['counts'] = [
        'gems' => array_fill_keys($rules['honours']['gems'], $huge),
        'mine' => ['relics' => $huge, 'gates' => $huge],
        'fusions' => array_fill_keys($rules['honours']['fusions'], $huge),
        'forge' => $huge,
        'guardian' => $huge,
        'visitors' => 9999,
        'travels' => 9999,
    ];
    foreach (array_keys($definitions) as $id) {
        $hacked['honours']['earned'][$id] = earnedEntry(5);
    }
    $hacked['honours']['verified'] = array_keys($definitions);
    $hacked['honours']['showcase'] = ['gem-ruby', 'visitors', 'explorer'];
    $hacked['integrity']['context'] = ['honours' => $hacked['honours']['counts']];
    $hackedSync = $validator->accept(
        asObject($hacked),
        $enrolled,
        $clock,
        false,
        [],
        'offline-town',
    );
    check(
        counters($hackedSync) === $expected,
        'client counts and a client-supplied context never reach the server counters',
    );
    $hackedKept = $catalog->keep($hackedSync, $enrolled, $noSocial);
    $legit = $catalog->keep(clone $synced, $enrolled, $noSocial)->honours->verified;
    $hackedShown = published($hackedKept);
    check(
        $hackedKept->honours->verified === $legit &&
            canonical(
                array_diff_key(asArray($hackedKept->honours->counts), [
                    'visitors' => 0,
                    'travels' => 0,
                ]),
            ) === $expected &&
            sorted(array_keys($hackedShown['earned'])) === sorted($legit) &&
            $hackedShown['showcase'] === [],
        'invented earned entries, counts and a forged verified list publish nothing unproven ' .
            json_encode($hackedShown),
    );

    // ---------- Counters across baselines, recovery and older checkpoints ----------
    $recovery = asArray($offline->after);
    $recovery['integrity']['checkpoint'] = $enrolled->integrity->checkpoint;
    $recovered = $validator->accept(asObject($recovery), $synced, $clock, true, [], 'offline-town');
    check(
        counters($recovered) === $expected,
        'signed recovery replays from its checkpoint counters and never double-counts',
    );
    $preRelease = asArray($synced);
    unset($preRelease['integrity']['context']['honours']);
    $seeded = $validator->accept(
        asObject($preRelease),
        asObject($preRelease),
        $clock,
        false,
        [],
        'offline-town',
    );
    check(
        counters($seeded) === replayed(['forge' => 1, 'guardian' => 1]),
        'a town tracked before honours seeds its counters from its checkpoint: a forge collection time and a seen protected incident',
    );
    $quiet = asArray($enrolled);
    unset($quiet['integrity']['context']['honours']);
    check(
        counters($validator->accept(asObject($quiet), asObject($quiet), $clock)) === replayed(),
        'a town without that history seeds nothing',
    );
    $claimed = asArray($offline->before);
    $claimed['honours']['counts'] = [
        'gems' => ['ruby' => 5000, 'bad key' => 4, 'opal' => -1],
        'mine' => ['relics' => 7],
        'fusions' => ['bomb+cross' => 2],
        'forge' => 3,
        'guardian' => 'many',
        'visitors' => 9,
    ];
    $baseline = $validator->accept(asObject($claimed), null, $clock);
    check(
        counters($baseline) ===
            replayed([
                'gems' => ['ruby' => 5000],
                'mine' => ['relics' => 7],
                'fusions' => ['bomb+cross' => 2],
                'forge' => 3,
            ]) && SaveIntegrity::receipt($baseline)['status'] === 'baseline',
        'first enrollment starts from the client’s own sanitized counts, an unverified baseline',
    );
    $proven = asArray($offline->after);
    $proven['honours']['counts'] = ['forge' => 0, 'guardian' => 0];
    check(
        counters($validator->accept(asObject($proven), null, $clock)) ===
            replayed(['forge' => 1, 'guardian' => 1]),
        'first enrollment never counts below what the town already proves',
    );

    // ---------- Verified honours are never revoked ----------
    $target40 = $rules['levels'][40]['starScoreTarget'];
    $ratio = goal('score-silver') + 0.1;
    $records = ['40' => ['score' => (int) ceil($target40 * $ratio), 'stars' => 2]];
    for ($level = 1; $level <= goal('stars-bronze'); $level++) {
        $records[(string) ($level + 100)] = ['score' => 1, 'stars' => 3];
    }
    $scored = tracked($records);
    $scored->honours = asObject([
        'earned' => [
            'score-silver' => earnedEntry(10),
            'stars-bronze' => earnedEntry(11),
            'score-gold' => earnedEntry(12),
        ],
        'showcase' => ['score', 'stars'],
    ]);
    $scored = $catalog->keep($validator->accept($scored, null, time() * 1000), null, $noSocial);
    check(
        !array_diff(['score-bronze', 'score-silver', 'stars-bronze'], $scored->honours->verified) &&
            !in_array('score-gold', $scored->honours->verified, true),
        'accepted records verify the score and star ranks they reach, not more',
    );
    check(
        published($scored)['earned'] === [
            'score-silver' => [
                'at' => 10,
                'evidence' => [
                    'levelId' => 40,
                    'score' => (int) ceil($target40 * $ratio),
                    'target' => $target40,
                ],
            ],
            'stars-bronze' => ['at' => 11],
        ] && published($scored)['showcase'] === ['score', 'stars'],
        'score evidence is the server’s own best run against the current target',
    );
    $raisedRules = $rules;
    $raisedRules['levels'][40]['starScoreTarget'] = $target40 * 3;
    $raised = new Honours($schema['honours'], fn() => new SaveIntegrity($raisedRules));
    $unverified = asArray($scored);
    unset($unverified['honours']['verified']);
    check(
        !in_array(
            'score-silver',
            $raised->keep(asObject($unverified), null, $noSocial)->honours->verified,
            true,
        ),
        'a raised star target no longer proves the score rank from scratch',
    );
    $again = $raised->keep(asObject(asArray($scored)), $scored, $noSocial);
    check(
        in_array('score-silver', $again->honours->verified, true) &&
            isset(published($again, null, $raised)['earned']['score-silver']),
        'a raised star target never un-verifies or unpublishes a verified score rank',
    );
    $changed = $schema['honours'];
    unset($changed['definitions']['score-bronze']);
    $changed['definitions']['stars-bronze']['goal'] = 999999;
    $afterChange = (new Honours($changed))->keep(asObject(asArray($scored)), $scored, $noSocial);
    check(
        !array_diff(['score-bronze', 'stars-bronze'], $afterChange->honours->verified) &&
            isset(
                asArray((new Honours($changed))->publish($afterChange))['earned']['stars-bronze'],
            ),
        'a removed rank or a moved goal keeps its verified IDs',
    );
    $untracked = profile();
    $untracked->records = asObject($records);
    $untracked->honours = asObject(asArray($scored->honours));
    unset($untracked->honours->verified);
    check(
        published($untracked)['earned'] === [] &&
            $catalog->keep($untracked, null, $noSocial)->honours->verified === [],
        'a save outside the integrity replay is the client’s claim and verifies nothing',
    );
    $plain = profile();
    $view = shared($plain);
    check(
        array_key_exists('honours', $view) && $view['honours'] === null,
        'a save without honours records their absence rather than an empty collection',
    );
    $raw = $public->projection($stored, 'Honour Hall', 'honours');
    foreach (
        ['counts', 'verified', 'seen', 'announced', 'backfilled', 'seenGeneration']
        as $private
    ) {
        check(!str_contains($raw, '"' . $private . '"'), 'the projection omits ' . $private);
    }
    foreach (
        [
            ['earned' => 'x', 'showcase' => 'y', 'counts' => 5, 'version' => -1],
            ['earned' => ['fusion-bronze' => ['at' => 'soon']], 'showcase' => [['fusion']]],
        ]
        as $blob
    ) {
        $odd = profile();
        $odd->honours = asObject($blob);
        check(
            str_contains(
                $public->projection($odd, 'Odd', 'honours'),
                '"honours":{"version":2,"earned":{},"showcase":[]}',
            ),
            'garbage still projects an empty object',
        );
    }

    // ---------- Accepting uploads through the API ----------
    $owner = account();
    $body = townBody('Honour Hall');
    $body['profile'] = $offline->before;
    $town = status(200, callApi('POST', 'towns', $body, $owner), 'attach a tracked town');
    $id = $town['townId'];
    check(
        $town['profile']['honours']['verified'] === [] &&
            canonical($town['profile']['integrity']['context']['honours']) === replayed(),
        'a new town stores its honours with an empty verified list and fresh counters',
    );
    $offlineUpload = ['baseRevision' => 1, 'uploadId' => uuid(), 'profile' => $offline->after];
    $saved = status(200, callApi('PUT', 'towns/' . $id, $offlineUpload, $owner), 'offline sync');
    check(
        canonical($saved['profile']['integrity']['context']['honours']) === $expected &&
            canonical(
                array_diff_key($saved['profile']['honours']['counts'], [
                    'visitors' => 0,
                    'travels' => 0,
                ]),
            ) === $expected &&
            $saved['profile']['honours']['verified'] === $legit,
        'an offline sync credits the server counters and verifies the reached ranks',
    );
    check(
        status(200, callApi('PUT', 'towns/' . $id, $offlineUpload, $owner), 'retry') === $saved,
        'an exact retry returns the same save',
    );
    $hackProfile = storedProfile($id);
    $hackProfile->honours = asObject($hacked['honours']);
    $hackUpload = ['baseRevision' => 2, 'uploadId' => uuid(), 'profile' => $hackProfile];
    $afterHack = status(
        200,
        callApi('PUT', 'towns/' . $id, $hackUpload, $owner),
        'hacked honours upload',
    );
    check(
        $afterHack['profile']['honours']['verified'] === $legit &&
            canonical($afterHack['profile']['integrity']['context']['honours']) === $expected &&
            $afterHack['profile']['honours']['counts']['forge'] === 1 &&
            $afterHack['profile']['honours']['counts']['visitors'] === 9999,
        'a hacked upload keeps the server counters and verified list; claims stay unverified',
    );
    $junk = storedProfile($id);
    $junk->honours = 'garbage';
    $afterJunk = status(
        200,
        callApi(
            'PUT',
            'towns/' . $id,
            ['baseRevision' => 3, 'uploadId' => uuid(), 'profile' => $junk],
            $owner,
        ),
        'a garbage honours block never breaks saving',
    );
    check(
        $afterJunk['profile']['honours']['verified'] === $legit &&
            isset($afterJunk['profile']['honours']['earned']['gem-ruby-gold']),
        'a garbage block keeps the stored honours',
    );
    // Admin history restores keep every honour earned, verified and counted since.
    $admin = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
    $admin->restoreTown($adminAudit, $id, ['revision' => 1]);
    $adminRestored = status(200, callApi('GET', 'towns/' . $id, null, $owner), 'owner reads');
    check(
        $adminRestored['revision'] === 5 &&
            $adminRestored['profile']['records'] == asArray($offline->before->records) &&
            $adminRestored['profile']['honours']['verified'] === $legit &&
            isset($adminRestored['profile']['honours']['earned']['gem-ruby-gold']) &&
            canonical($adminRestored['profile']['integrity']['context']['honours']) === $expected,
        'an admin restore of an older snapshot never revokes honours or lowers counters',
    );

    // ---------- Social ranks: the server's own visit counts ----------
    $visitNumber = 0;
    $recordVisit = function (string $host, string $key, string $name, ?string $origin) use (
        $db,
        &$visitNumber,
    ) {
        $visitNumber++;
        $db->get()->insert('visitor_visits', [
            'id' => bin2hex(random_bytes(16)),
            'town_id' => $host,
            'visitor_key' => $key,
            'name' => $name,
            'origin_town_id' => $origin,
            'town_name' => $origin === null ? null : 'Somewhere',
            'era' => 'frontier',
            // Live presence marks every visit made while signed in.
            'signed_in' => $name !== '' || $origin !== null ? 1 : 0,
            'arrived_at' => 1000 + $visitNumber,
            'last_seen_at' => 1000 + $visitNumber,
            'departed_at' => 1000 + $visitNumber,
        ]);
    };
    $hostProfile = tracked();
    $hostProfile->honours = asObject([
        'earned' => [
            'visitors-bronze' => earnedEntry(5),
            'visitors-silver' => earnedEntry(6),
            'explorer-bronze' => earnedEntry(7),
        ],
        'counts' => ['visitors' => 50, 'travels' => 50],
        'showcase' => ['visitors', 'explorer'],
    ]);
    $hostBody = townBody('Guest Hall');
    $hostBody['profile'] = $hostProfile;
    $host = status(200, callApi('POST', 'towns', $hostBody, $owner), 'host town');
    $hostId = $host['townId'];
    check(
        $host['profile']['honours']['verified'] === [],
        'claimed visitor ranks are not verified without visits',
    );
    // One account visiting three times counts once; a home town proves a signed-in visit;
    // signed-out visits (no name, no home town) never count.
    $own = status(200, callApi('POST', 'towns', townBody('Own Annex'), $owner), 'own town');
    foreach ([1, 2, 3] as $repeat) {
        $recordVisit($hostId, str_repeat('a', 64), 'Ada', null);
    }
    $recordVisit($hostId, str_repeat('b', 64), '', $own['townId']);
    $recordVisit($hostId, str_repeat('c', 64), '', null);
    // Villages visited from the host town: other players' towns, each once.
    $travelGoal = (int) goal('explorer-bronze');
    $others = [];
    while (count($others) < $travelGoal) {
        $neighbour = account();
        for ($slot = 0; $slot < 3 && count($others) < $travelGoal; $slot++) {
            $others[] = status(
                200,
                callApi('POST', 'towns', townBody('Neighbour ' . count($others)), $neighbour),
                'neighbour town',
            )['townId'];
        }
    }
    foreach ([...$others, $others[0], $own['townId']] as $visited) {
        $recordVisit($visited, str_repeat('o', 64), 'Owner', $hostId);
    }
    $guestbook = status(
        200,
        callApi('GET', 'towns/' . $hostId . '/visitors', null, $owner),
        'guestbook',
    );
    check(
        $guestbook['uniqueVisitors'] === 2 && $guestbook['townsVisited'] === $travelGoal,
        'the owner guestbook counts different signed-in visitors and other players’ villages visited ' .
            json_encode([$guestbook['uniqueVisitors'], $guestbook['townsVisited']]),
    );
    $hostPublic = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $hostId . '/settings',
            ['baseRevision' => 1, 'name' => 'Guest Hall', 'isPublic' => true],
            $owner,
        ),
        'share host',
    )['publicId'];
    $visitorsOnly = status(
        200,
        callApi('GET', 'villages/' . $hostPublic . '/visitors'),
        'public guestbook',
    );
    check(
        !array_key_exists('uniqueVisitors', $visitorsOnly) &&
            !array_key_exists('townsVisited', $visitorsOnly),
        'the public guestbook publishes neither social count',
    );
    $hostSave = status(
        200,
        callApi(
            'PUT',
            'towns/' . $hostId,
            ['baseRevision' => 1, 'uploadId' => uuid(), 'profile' => storedProfile($hostId)],
            $owner,
        ),
        'host save',
    );
    $expectVerified = array_values(
        array_filter(
            ['visitors-bronze', 'visitors-silver', 'explorer-bronze'],
            fn($rank) => ($rank === 'explorer-bronze' ? $travelGoal : 2) >= goal($rank),
        ),
    );
    check(
        $hostSave['profile']['honours']['verified'] === $expectVerified &&
            $hostSave['profile']['honours']['counts']['visitors'] === 50 &&
            $hostSave['profile']['honours']['counts']['travels'] === 50,
        'social ranks verify at save time from the server counts ' .
            json_encode($hostSave['profile']['honours']['verified']),
    );
    // The visitors and one visited village disappear; verified honours stay published.
    $db->get()->executeStatement('DELETE FROM visitor_visits WHERE town_id=?', [$hostId]);
    $db->get()->executeStatement('DELETE FROM towns WHERE id=?', [$others[1]]);
    check(
        status(200, callApi('GET', 'towns/' . $hostId . '/visitors', null, $owner), 'later')[
            'townsVisited'
        ] ===
            $travelGoal - 1,
        'a deleted village no longer counts as visited',
    );
    $visit = status(200, callApi('GET', 'villages/' . $hostPublic), 'visit host');
    check(
        array_keys($visit['appearance']['honours']) === ['version', 'earned', 'showcase'] &&
            array_keys($visit['appearance']['honours']['earned']) === $expectVerified,
        'verified social ranks stay published after their visits are gone',
    );

    // ---------- Shared towns ----------
    status(
        200,
        callApi(
            'PATCH',
            'towns/' . $id . '/settings',
            ['baseRevision' => 5, 'name' => 'Honour Hall', 'isPublic' => true],
            $owner,
        ),
        'share honours town',
    );
    $publicId = $adminRestored['publicId'];
    $visit = status(200, callApi('GET', 'villages/' . $publicId), 'visit honours town');
    check(
        array_keys($visit['appearance']['honours']['earned']) === $legit &&
            !isset($visit['appearance']['honours']['earned']['gem-ruby-gold']),
        'a visit shows verified honours and hides every unproven claim',
    );
    $owner2 = account();
    $plainTown = status(
        200,
        callApi('POST', 'towns', townBody('Quiet Gulch'), $owner2),
        'town without honours',
    );
    $plainPublic = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $plainTown['townId'] . '/settings',
            ['baseRevision' => 1, 'name' => 'Quiet Gulch', 'isPublic' => true],
            $owner2,
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
        $quietVisit = status(200, callApi('GET', 'villages/' . $plainPublic . $suffix), 'quiet');
        check(
            !array_key_exists('honours', $quietVisit['appearance']),
            'visitors see no honours field, not an empty collection',
        );
    }
    // Shares projected before honours existed gain them on read, verified ones only.
    $sneaky = asArray($scored);
    $db->get()->update(
        'towns',
        ['profile' => json_encode($sneaky)],
        ['id' => $plainTown['townId']],
    );
    unset($stored['appearance']['honours']);
    $db->get()->update(
        'towns',
        ['appearance' => json_encode($stored)],
        ['id' => $plainTown['townId']],
    );
    foreach (['', '/latest'] as $suffix) {
        $legacy = status(200, callApi('GET', 'villages/' . $plainPublic . $suffix), 'legacy');
        check(
            array_keys($legacy['appearance']['honours']['earned']) === [
                'score-silver',
                'stars-bronze',
            ],
            'an older share is projected from the saved, verified honours on read',
        );
    }
    // ---------- Town cards: the owner's own showcase in the account town list ----------
    $listed = status(200, callApi('GET', 'account', null, $owner), 'account towns');
    $card = array_values(array_filter($listed['towns'], fn($town) => $town['townId'] === $id))[0];
    check(
        is_array($card['summary']['honours'] ?? null) &&
            in_array('gem-ruby-gold', $card['summary']['honours']['earned'], true) &&
            is_array($card['summary']['honours']['showcase']) &&
            !array_key_exists('counts', $card['summary']['honours']),
        'the owner town list carries earned honour IDs and the showcase, never counts',
    );
    check(
        App\SaveService::summary(profile())['honours'] === null,
        'a town without honours has no honours on its card',
    );
    $page = 1;
    $hostCard = false;
    do {
        $browse = status(200, callApi('GET', 'villages?page=' . $page, null, $owner2), 'browse');
        foreach ($browse['entries'] as $entry) {
            check(
                $entry['honours'] === null ||
                    (array_is_list($entry['honours']['earned']) &&
                        array_is_list($entry['honours']['showcase'])),
                'directory cards carry published honour IDs or nothing',
            );
            if ($entry['villageId'] === $hostPublic) {
                $hostCard = $entry['honours']['earned'] === $expectVerified;
            }
        }
        $page++;
    } while ($browse['hasNext'] && $page <= 50);
    check($hostCard, 'a directory card lists only the published honours');
    echo "Honours checks passed ($count assertions).\n";
} finally {
    $db->get()->delete('admin_audit', ['admin' => $adminAudit]);
    cleanup();
}
