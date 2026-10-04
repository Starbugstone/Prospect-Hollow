<?php
// TEMPORARY (issue #60): the preprod fixture seeder adds only recognisable placeholder data,
// proves its honours through the real projection and removes exactly what it added.
require __DIR__ . '/support.php';
use App\PreprodFixtures;

$data = json_decode(
    file_get_contents(dirname(__DIR__) . '/content/preprod-fixtures.json'),
    true,
    512,
    JSON_THROW_ON_ERROR,
);
try {
    check(
        PreprodFixtures::allowed('https://preprod.prospecthollow.starbugstone.com') &&
            PreprodFixtures::allowed('http://localhost:8094') &&
            !PreprodFixtures::allowed('https://prospecthollow.starbugstone.com') &&
            !PreprodFixtures::allowed('https://notpreprod.example.com'),
        'fixtures run on preprod and local machines only',
    );
    $production = new PreprodFixtures($db, $public, 'https://prospecthollow.starbugstone.com');
    $refused = false;
    try {
        $production->seed($data);
    } catch (RuntimeException) {
        $refused = true;
    }
    check($refused && $production->status()['towns'] === 0, 'production refuses to seed');

    // A real player's shared town, which must survive removal untouched.
    $owner = account();
    $body = townBody('Real Meadow');
    $real = status(200, callApi('POST', 'towns', $body, $owner), 'real town');
    $realPublic = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $real['townId'] . '/settings',
            ['baseRevision' => 1, 'name' => 'Real Meadow', 'isPublic' => true],
            $owner,
        ),
        'share real town',
    )['publicId'];

    $fixtures = new PreprodFixtures($db, $public, 'http://localhost:8094');
    $seeded = $fixtures->seed($data, [$realPublic]);
    $guests = array_sum(array_column($data['towns'], 'visitors'));
    $expected = [
        'players' => count($data['towns']),
        'towns' => count($data['towns']),
        'visits' => $guests + count($data['towns']),
    ];
    check($fixtures->status() === $expected, 'seed adds the placeholder towns and visits');
    $fixtures->seed($data, [$realPublic]);
    check($fixtures->status() === $expected, 'seeding again replaces rather than duplicates');

    $byName = array_column($seeded, 'publicId', 'name');
    $amber = status(200, callApi('GET', 'villages/' . $byName['Amberfall']), 'visit Amberfall');
    $earned = $amber['appearance']['honours']['earned'];
    check(
        isset(
            $earned['perfect-prospector'],
            $earned['town-complete'],
            $earned['score-legend'],
            $earned['popular-destination'],
        ) &&
            $amber['appearance']['honours']['showcase'] === [
                'perfect-prospector',
                'score',
                'town-complete',
            ],
        'Amberfall proves its completion, score and visitor honours to visitors',
    );
    $lark = status(200, callApi('GET', 'villages/' . $byName['Larkspur Bay']), 'visit Larkspur');
    check(
        isset($lark['appearance']['honours']['earned']['popular-destination']) &&
            $lark['appearance']['honours']['showcase'][0] === 'visitors',
        'sixteen different visitors prove Popular Destination',
    );
    $quiet = status(200, callApi('GET', 'villages/' . $byName['Quiet Hollow']), 'visit quiet');
    check(!array_key_exists('honours', $quiet['appearance']), 'a town without honours shows none');
    $draw = status(200, callApi('GET', 'villages?page=1', null, $owner), 'explorer draw');
    $named = array_column($draw['entries'], 'honours', 'name');
    check(
        count($draw['entries']) > 0 &&
            array_intersect(array_keys($named), array_keys($byName)) !== [],
        'the explorer deals fixture towns with their honours',
    );
    $guestbook = status(
        200,
        callApi('GET', 'towns/' . $real['townId'] . '/visitors', null, $owner),
        'real guestbook',
    );
    check(
        $guestbook['uniqueVisitors'] === count($data['towns']),
        'every fixture mayor visited the named real town',
    );

    $removed = $fixtures->remove();
    check(
        $removed === $expected &&
            $fixtures->status() === ['players' => 0, 'towns' => 0, 'visits' => 0],
        'remove deletes exactly the fixtures',
    );
    $after = status(
        200,
        callApi('GET', 'towns/' . $real['townId'] . '/visitors', null, $owner),
        'real guestbook after removal',
    );
    check(
        $after['uniqueVisitors'] === 0 &&
            status(200, callApi('GET', 'villages/' . $realPublic), 'real town')['name'] ===
                'Real Meadow',
        'the real town remains, without the fixture visits',
    );
    echo "Preprod fixture checks passed ($count assertions).\n";
} finally {
    (new PreprodFixtures($db, $public, 'http://localhost:8094'))->remove();
    cleanup();
}
