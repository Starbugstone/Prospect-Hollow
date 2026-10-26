<?php
// Pure save/public-projection checks: no account, clock, database or network needed.
require dirname(__DIR__) . '/vendor/autoload.php';
use App\TownPersonalisation;

$schema = json_decode(
    file_get_contents(dirname(__DIR__) . '/content/public-schema.json'),
    true,
    64,
    JSON_THROW_ON_ERROR,
);
$rules = json_decode(
    file_get_contents(dirname(__DIR__) . '/content/save-rules.json'),
    false,
    64,
    JSON_THROW_ON_ERROR,
);
$town = $rules->defaultProfile->town;
$count = 0;
function checkPersonalisation(bool $ok, string $label): void
{
    global $count;
    $count++;
    if (!$ok) {
        throw new RuntimeException($label);
    }
}
function copyPersonalisation(object $value): object
{
    return json_decode(json_encode($value, JSON_THROW_ON_ERROR), false, 64, JSON_THROW_ON_ERROR);
}
$empty = TownPersonalisation::normalize(null);
checkPersonalisation(
    json_encode($empty) === json_encode(TownPersonalisation::normalize($empty)),
    'normalization is idempotent',
);
foreach ([null, [], 'bad', 1, (object) ['crest' => (object) ['emblem' => '<script>']]] as $bad) {
    checkPersonalisation(
        TownPersonalisation::normalize($bad)->crest === null,
        'malformed values have no banner',
    );
}
$town->personalisation = (object) [
    'crest' => (object) [
        'shape' => 'shield',
        'pattern' => 'split',
        'emblem' => 'otter',
        'primary' => '#ABCDEF',
        'secondary' => '#123456',
        'emblemColour' => '#AB1234',
        'url' => 'private',
    ],
    'paint' => (object) [
        'home' => (object) ['walls' => '#123456', 'roof' => 'url(bad)', 'extra' => '#654321'],
        'unknown' => (object) ['walls' => '#123456'],
    ],
    'clothing' => (object) ['shirt' => '#ABCDEF', 'skin' => '#000000'],
    'choices' => (object) ['home' => 'garden', 'saloon' => 'bogus'],
    'areas' => (object) ['meadow' => ['headframe', 'windgarden', 'longhall']],
    'plaques' => new stdClass(),
];
$p = TownPersonalisation::normalize($town->personalisation);
checkPersonalisation(
    $p->crest->primary === '#abcdef' && !isset($p->crest->url),
    'crest bounded to catalog fields',
);
checkPersonalisation(!isset($p->paint), 'retired building paint removed');
checkPersonalisation(!isset($p->choices), 'retired building styles removed');
checkPersonalisation(!isset($p->clothing), 'legacy clothing overrides removed');
checkPersonalisation($p->areas->meadow === ['headframe'], 'paid landmark choice preserved');
checkPersonalisation($p->crest->emblemColour === '#ab1234', 'emblem colour normalized');
$legacyPalette = copyPersonalisation($town->personalisation);
$legacyPalette->paint->all = (object) ['walls' => '#112233'];
$legacyPalette->crest->emblemColour = 'url(bad)';
$migrated = TownPersonalisation::normalize($legacyPalette);
checkPersonalisation(
    !isset($migrated->paint, $migrated->choices),
    'shared paint and styles discarded',
);
checkPersonalisation(
    $migrated->crest->emblemColour === '#393c43',
    'invalid emblem colour defaults',
);
checkPersonalisation(
    json_encode($migrated) === json_encode(TownPersonalisation::normalize($migrated)),
    'migration is idempotent',
);
$previous = (object) ['town' => copyPersonalisation($town)];
$oldClient = copyPersonalisation($previous);
unset($oldClient->town->personalisation);
checkPersonalisation(
    TownPersonalisation::keep($oldClient, $previous)->town->personalisation->crest->emblem ===
        'otter',
    'older client preserves decoration',
);

$rank = array_key_first($schema['honours']['definitions']);
$town->personalisation->plaques = (object) [
    'mine' => $rank,
    'home' => $rank,
    'saloon' => 'invented-award',
    'museum' => 'player-alpha',
];
$public = TownPersonalisation::publish($town, null, $schema);
checkPersonalisation(
    count((array) $public->plaques) === 0,
    'unearned and off-mine plaques removed',
);
$honours = (object) ['earned' => (object) [$rank => (object) ['at' => 1]]];
$public = TownPersonalisation::publish($town, $honours, $schema);
checkPersonalisation(
    (array) $public->plaques === ['mine' => $rank],
    'verified rank is published only on the mine',
);
// Player entries remain pending verification by PublicTown::distinguish on each read.
$town->personalisation->plaques->mine = 'player-alpha';
checkPersonalisation(
    TownPersonalisation::publish($town, null, $schema)->plaques->mine === 'player-alpha',
    'player badge is resolved against its owner at read time',
);
foreach ($schema['personalisation']['areas'] as $area) {
    $state = json_decode(json_encode($rules->defaultTown), true);
    $state['coins'] = 1000000;
    $state['moonstones'] = 1000000;
    $currency = $area['currency'];
    $state['era'] = $area['era'];
    $command = [
        'monumentVersion' => $schema['personalisation']['monumentProgression']['version'],
        'id' => $area['id'],
        'slot' => 0,
        'value' => $area['choices'][0],
        'expectedChoice' => null,
        'expectedLevel' => 0,
    ];
    $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
    checkPersonalisation(
        $next !== null && $next[$currency] < $state[$currency],
        'landmark charges its price',
    );
    checkPersonalisation(
        TownPersonalisation::purchase($next, $command, $schema['eras']) === null,
        'duplicate command rejected',
    );
    $poor = $state;
    $poor[$currency] = 0;
    checkPersonalisation(
        TownPersonalisation::purchase($poor, $command, $schema['eras']) === null,
        'insufficient funds rejected',
    );
    // A built monument is permanent: no other design replaces it, even in later eras.
    $later = $next;
    $later['era'] = end($schema['eras']);
    foreach (array_slice($area['choices'], 1) as $choice) {
        $command['expectedChoice'] = $next['personalisation']['areas'][$area['id']][0];
        $command['expectedLevel'] = $next['personalisation']['areaLevels'][$area['id']];
        $command['value'] = $choice;
        checkPersonalisation(
            TownPersonalisation::purchase($later, $command, $schema['eras']) === null,
            'monument replacement rejected',
        );
    }
    if ($area['timeless']) {
        $command['value'] = $area['choices'][0];
        checkPersonalisation(
            TownPersonalisation::purchase($later, $command, $schema['eras']) === null,
            'timeless monument never grows',
        );
    }
}
// New purchases have a fixed ceiling in the opening era; historical receipts
// retain their old price/ceiling, so pending offline journals still verify.
foreach ($schema['personalisation']['areas'] as $area) {
    if ($area['timeless']) {
        continue;
    }
    $state = json_decode(json_encode($rules->defaultTown), true);
    $state['era'] = $area['era'];
    $state['coins'] = 10000000;
    $state['moonstones'] = 10000000;
    $currency = $area['currency'];
    $choice = $area['choices'][0];
    $base = array_values(
        array_filter($schema['personalisation']['landmarks'], fn($o) => $o['id'] === $choice),
    )[0]['price'];
    foreach ($schema['personalisation']['monumentProgression']['levels'] as $index => $milestone) {
        $command = [
            'monumentVersion' => $schema['personalisation']['monumentProgression']['version'],
            'id' => $area['id'],
            'slot' => 0,
            'value' => $choice,
            'expectedChoice' => $index ? $choice : null,
            'expectedLevel' => $index,
        ];
        $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
        checkPersonalisation(
            $next !== null &&
                $state[$currency] - $next[$currency] ===
                    ($area['levelPrices'][$index] ?? $base * $milestone['multiplier']),
            'fixed milestone price',
        );
        $poor = $state;
        $poor[$currency] = ($area['levelPrices'][$index] ?? $base * $milestone['multiplier']) - 1;
        checkPersonalisation(
            TownPersonalisation::purchase($poor, $command, $schema['eras']) === null,
            'cannot underpay milestone',
        );
        $state = $next;
    }
    $command['expectedChoice'] = $choice;
    $command['expectedLevel'] = 5;
    $state['era'] = end($schema['eras']);
    checkPersonalisation(
        TownPersonalisation::purchase($state, $command, $schema['eras']) === null,
        'future eras add no sixth level',
    );
}
$legacy = (object) [
    'areas' => (object) ['meadow' => ['headframe']],
    'areaLevels' => (object) ['meadow' => 11],
];
checkPersonalisation(
    TownPersonalisation::normalize($legacy)->areaLevels->meadow === 11,
    'historical paid levels survive normalization',
);
$state = json_decode(json_encode($rules->defaultTown), true);
$state['era'] = 'industrial';
$state['coins'] = 10000;
$state['personalisation']['areas']['meadow'] = ['headframe'];
$state['personalisation']['areaLevels']['meadow'] = 1;
$legacyCommand = [
    'id' => 'meadow',
    'slot' => 0,
    'value' => 'headframe',
    'expectedChoice' => 'headframe',
    'expectedLevel' => 1,
];
$next = TownPersonalisation::purchase($state, $legacyCommand, $schema['eras']);
checkPersonalisation($next['coins'] === 8800, 'old offline receipt retains its original price');
$legacyCommand['monumentVersion'] = 999;
checkPersonalisation(
    TownPersonalisation::purchase($state, $legacyCommand, $schema['eras']) === null,
    'unsupported monument price version rejected',
);

// Construction of the latest paid level is cosmetic and kept exactly as the client keeps
// it; anything damaged, stale or historical shows the finished monument instead.
$building = (object) [
    'areas' => (object) ['meadow' => ['headframe'], 'monument' => ['guardian']],
    'areaLevels' => (object) ['meadow' => 2, 'monument' => 1],
    'construction' => (object) [
        'meadow' => (object) ['level' => 2, 'wins' => 1],
        'monument' => (object) ['level' => 1, 'wins' => 3],
    ],
];
$built = TownPersonalisation::normalize($building);
checkPersonalisation(
    json_encode($built->construction) ===
        '{"meadow":{"level":2,"wins":1},"monument":{"level":1,"wins":3}}',
    'construction of the latest paid level is kept',
);
checkPersonalisation(
    json_encode($built) === json_encode(TownPersonalisation::normalize($built)),
    'construction normalization is idempotent',
);
$longer = copyPersonalisation($building);
$longer->construction->meadow = (object) ['level' => 2, 'wins' => 2];
checkPersonalisation(
    json_encode(TownPersonalisation::normalize($longer)->construction->meadow) ===
        '{"level":2,"wins":1}',
    'progress saved under a longer build stays ready to unveil',
);
foreach (
    [
        (object) ['level' => 1, 'wins' => 0],
        (object) ['level' => 2, 'wins' => -1],
        (object) ['level' => 2, 'wins' => 1.5],
        (object) ['level' => 2, 'wins' => '1'],
        (object) ['level' => 2],
        'building',
        null,
    ]
    as $damaged
) {
    $copy = copyPersonalisation($building);
    $copy->construction->meadow = $damaged;
    checkPersonalisation(
        !isset(TownPersonalisation::normalize($copy)->construction->meadow),
        'damaged construction shows the finished monument',
    );
}
$copy = copyPersonalisation($building);
$copy->construction = (object) [
    'monument' => (object) ['level' => 2, 'wins' => 0],
    'motor-court' => (object) ['level' => 1, 'wins' => 0],
    'unknown' => (object) ['level' => 1, 'wins' => 0],
];
checkPersonalisation(
    (array) TownPersonalisation::normalize($copy)->construction === [],
    'construction needs the paid level of a known, built site',
);
$copy->areaLevels->meadow = 11;
$copy->construction = (object) ['meadow' => (object) ['level' => 11, 'wins' => 0]];
checkPersonalisation(
    (array) TownPersonalisation::normalize($copy)->construction === [],
    'historical paid levels are never rebuilt',
);
$copy->construction = 'scaffolding';
checkPersonalisation(
    (array) TownPersonalisation::normalize($copy)->construction === [],
    'malformed construction is ignored',
);
checkPersonalisation(
    json_encode(
        TownPersonalisation::publish((object) ['personalisation' => $building], null, $schema)
            ->construction,
    ) === json_encode($built->construction),
    'visitors see the same construction as the owner',
);

$honours = new App\Honours($schema['honours']);
foreach (
    [
        null,
        'unknown',
        'headframe',
        'founders-arch',
        'crystal-spire',
        'guardian',
        'world-tree',
        'celestial-sphere',
    ]
    as $choice
) {
    $profile = copyPersonalisation($rules->defaultProfile);
    $profile->town->personalisation->areas->monument = [$choice];
    $profile->honours->earned->{'monument-gold'} = (object) ['at' => 123];
    $untracked = $honours->keep(copyPersonalisation($profile), null, fn(string $counter): int => 0);
    checkPersonalisation(
        !in_array('monument-gold', $untracked->honours->verified, true),
        'untracked claims cannot verify a monument',
    );
    // Unit proof state; honours.php also exercises actual signed purchase replay.
    $profile->integrity = (object) ['version' => 1];
    $kept = $honours->keep($profile, null, fn(string $counter): int => 0);
    checkPersonalisation(
        in_array('monument-gold', $kept->honours->verified, true) ===
            in_array(
                $choice,
                ['founders-arch', 'crystal-spire', 'guardian', 'world-tree', 'celestial-sphere'],
                true,
            ),
        'only a known monument proves the honour, never an uploaded claim',
    );
}
// The lunar site uses the same authoritative catalog, prices and publication.
$moonArea = array_values(
    array_filter(
        $schema['personalisation']['areas'],
        fn($area) => $area['id'] === 'earthrise-plaza',
    ),
)[0];
checkPersonalisation(
    $moonArea['settlement'] === 'moon' &&
        $moonArea['currency'] === 'coins' &&
        $moonArea['era'] === 'twin-hollows',
    'lunar site declares its settlement, currency and opening era',
);
foreach ($moonArea['choices'] as $choice) {
    $state = json_decode(json_encode($rules->defaultTown), true);
    $state['era'] = 'moonward';
    $state['coins'] = 100000;
    $command = [
        'id' => $moonArea['id'],
        'slot' => 0,
        'value' => $choice,
        'expectedChoice' => null,
        'expectedLevel' => 0,
        'monumentVersion' => $schema['personalisation']['monumentProgression']['version'],
    ];
    checkPersonalisation(
        TownPersonalisation::purchase($state, $command, $schema['eras']) === null,
        'Moonward cannot buy the Twin Hollows site early',
    );
    $state['era'] = 'twin-hollows';
    $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
    $definition = array_values(
        array_filter($schema['personalisation']['landmarks'], fn($o) => $o['id'] === $choice),
    )[0];
    checkPersonalisation(
        $next !== null && $state['coins'] - $next['coins'] === $definition['price'],
        'each lunar design charges its exported price',
    );
    $next['personalisation']['construction'][$moonArea['id']] = ['level' => 1, 'wins' => 2];
    $published = TownPersonalisation::publish(json_decode(json_encode($next)), null, $schema);
    checkPersonalisation(
        $published->areas->{'earthrise-plaza'} === [$choice] &&
            $published->construction->{'earthrise-plaza'}->wins === 2,
        'lunar choice and unfinished construction survive public projection',
    );
}

foreach ($schema['personalisation']['areas'] as $area) {
    if ($area['currency'] !== 'moonstones') {
        continue;
    }
    $state = json_decode(json_encode($rules->defaultTown), true);
    $state['era'] = 'twin-hollows';
    $state['coins'] = 1000000;
    $state['moonstones'] = 300;
    $command = [
        'id' => $area['id'],
        'slot' => 0,
        'value' => $area['choices'][0],
        'expectedChoice' => null,
        'expectedLevel' => 0,
        'monumentVersion' => $schema['personalisation']['monumentProgression']['version'],
        'currency' => 'moonstones',
        'price' => 20,
    ];
    $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
    checkPersonalisation(
        $next !== null && $next['moonstones'] === 280 && $next['coins'] === $state['coins'],
        'moonstone foundation debits resource only',
    );
    foreach (['price' => 1, 'currency' => 'coins', 'monumentVersion' => 1] as $field => $forged) {
        $fake = array_replace($command, [$field => $forged]);
        checkPersonalisation(
            TownPersonalisation::purchase($state, $fake, $schema['eras']) === null,
            'forged resource purchase rejected',
        );
    }
    $upgrade = array_replace($command, [
        'expectedChoice' => $command['value'],
        'expectedLevel' => 1,
        'price' => 30,
    ]);
    $poor = $next;
    $poor['moonstones'] = 29;
    checkPersonalisation(
        TownPersonalisation::purchase($poor, $upgrade, $schema['eras']) === null,
        'coins cannot cover missing upgrade moonstone',
    );
    $upgraded = TownPersonalisation::purchase($next, $upgrade, $schema['eras']);
    checkPersonalisation(
        $upgraded !== null &&
            $upgraded['moonstones'] === 250 &&
            $upgraded['coins'] === $state['coins'],
        'upgrade debits moonstones only',
    );
}
// Old preprod journals may contain any of the five paid levels. Their version
// selects the original terms; ownership survives and subsequent current purchases
// use the new schedule (also covered by frontend-generated integrity flows).
foreach ($schema['personalisation']['areas'] as $area) {
    if ($area['currency'] !== 'moonstones') {
        continue;
    }
    $state = json_decode(json_encode($rules->defaultTown), true);
    $state['era'] = 'twin-hollows';
    $state['moonstones'] = 5000;
    foreach ([60, 240, 600, 1200, 2100] as $index => $price) {
        $command = [
            'id' => $area['id'],
            'slot' => 0,
            'value' => $area['choices'][0],
            'expectedChoice' => $index ? $area['choices'][0] : null,
            'expectedLevel' => $index,
            'monumentVersion' => 2,
            'currency' => 'moonstones',
            'price' => $price,
        ];
        $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
        checkPersonalisation(
            $next !== null && $state['moonstones'] - $next['moonstones'] === $price,
            'historical resource receipt keeps its exact price',
        );
        $wrong = array_replace($command, ['price' => $area['levelPrices'][$index]]);
        checkPersonalisation(
            TownPersonalisation::purchase($state, $wrong, $schema['eras']) === null,
            'historical version cannot claim discounted terms',
        );
        $state = $next;
    }
}
echo "Personalisation: $count checks passed.\n";
