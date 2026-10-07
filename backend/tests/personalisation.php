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
    'areas' => (object) ['meadow' => ['roundhouse', 'windgarden', 'longhall']],
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
checkPersonalisation($p->areas->meadow === ['roundhouse'], 'paid landmark choice preserved');
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
    $state['era'] = $area['era'];
    $command = [
        'id' => $area['id'],
        'slot' => 0,
        'value' => $area['choices'][0],
        'expectedChoice' => null,
        'expectedLevel' => 0,
    ];
    $next = TownPersonalisation::purchase($state, $command, $schema['eras']);
    checkPersonalisation(
        $next !== null && $next['coins'] < $state['coins'],
        'landmark charges its price',
    );
    checkPersonalisation(
        TownPersonalisation::purchase($next, $command, $schema['eras']) === null,
        'duplicate command rejected',
    );
    $poor = $state;
    $poor['coins'] = 0;
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
$honours = new App\Honours($schema['honours']);
foreach (
    [
        null,
        'unknown',
        'roundhouse',
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
echo "Personalisation: $count checks passed.\n";
