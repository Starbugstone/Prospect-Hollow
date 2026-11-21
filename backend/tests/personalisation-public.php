<?php
require __DIR__ . '/support.php';
use App\PlayerDistinctions;
try {
    $owner = account();
    $body = townBody('Emblem Hollow');
    $body['profile']->town->personalisation = (object) [
        'crest' => (object) [
            'shape' => 'shield',
            'pattern' => 'split',
            'emblem' => 'otter',
            'primary' => '#367673',
            'secondary' => '#e8bf79',
            'emblemColour' => '#123456',
        ],
        'clothing' => (object) ['shirt' => '#123456'],
        'paint' => (object) ['well' => (object) ['walls' => '#abcdef']],
        'choices' => (object) ['home' => 'garden'],
        'plaques' => (object) ['mine' => 'player-alpha', 'well' => 'player-alpha'],
    ];
    $id = status(200, callApi('POST', 'towns', $body, $owner), 'personalised save')['townId'];
    $shared = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $id . '/settings',
            ['baseRevision' => 1, 'name' => $body['name'], 'isPublic' => true],
            $owner,
        ),
        'share personalised town',
    );
    $visit = fn() => status(
        200,
        callApi('GET', 'villages/' . $shared['publicId']),
        'visit personalised town',
    )['appearance'];
    $appearance = $visit();
    check(
        $appearance['personalisation']['crest']['emblem'] === 'otter',
        'visitors see the saved crest',
    );
    check(
        !isset($appearance['personalisation']['clothing']),
        'visitors keep individual resident outfits',
    );
    check(
        !isset($appearance['personalisation']['paint'], $appearance['personalisation']['choices']),
        'retired paint and styles are not published',
    );
    check(
        !isset($appearance['personalisation']['plaques']['mine']),
        'unearned player plaque is removed on public read',
    );
    PlayerDistinctions::load()->award($db->get(), 'player-alpha', $owner['id'], 1700000000);
    $appearance = $visit();
    check(
        $appearance['personalisation']['plaques']['mine'] === 'player-alpha',
        'earned player plaque survives public read',
    );
    check(
        !isset($appearance['personalisation']['plaques']['well']),
        'earned badges stay off other buildings',
    );
    check(
        isset($appearance['plaqueDistinctions']['player-alpha']),
        'renderer receives server-verified plaque artwork data without a showcase',
    );
    check(
        $appearance['personalisation']['crest']['emblemColour'] === '#123456',
        'public emblem colour retained',
    );
    // The time distinction on a plaque: visitors see its step, never the owner's next one,
    // which would give away when the account was created.
    $veteran = account();
    $db->get()->update(
        'players',
        ['created_at' => time() - 400 * 86400],
        [
            'id' => $veteran['id'],
        ],
    );
    $plaqued = townBody('Veteran Hollow');
    $plaqued['profile']->town->personalisation = (object) [
        'plaques' => (object) ['mine' => 'player-time'],
    ];
    $plaquedId = status(200, callApi('POST', 'towns', $plaqued, $veteran), 'plaque save')['townId'];
    $plaquedPublic = status(
        200,
        callApi(
            'PATCH',
            'towns/' . $plaquedId . '/settings',
            ['baseRevision' => 1, 'name' => $plaqued['name'], 'isPublic' => true],
            $veteran,
        ),
        'share plaqued town',
    )['publicId'];
    $plaquedVisit = status(200, callApi('GET', 'villages/' . $plaquedPublic), 'visit plaqued town');
    check(
        ($plaquedVisit['appearance']['plaqueDistinctions']['player-time']['tenure'] ?? null) === [
            'unit' => 'year',
            'count' => 1,
        ],
        'a time plaque shows its current step to visitors',
    );
    $leaks = function (mixed $value) use (&$leaks): bool {
        if (!is_array($value)) {
            return false;
        }
        if (is_array($value['tenure'] ?? null) && array_key_exists('next', $value['tenure'])) {
            return true;
        }
        foreach ($value as $child) {
            if ($leaks($child)) {
                return true;
            }
        }
        return false;
    };
    check(!$leaks($plaquedVisit), 'no public payload carries the next time step');
    $cards = status(200, callApi('GET', 'account', null, $owner), 'crest town summary')['towns'];
    check($cards[0]['summary']['crest']['emblem'] === 'otter', 'saved-town card carries the crest');
    echo "Public personalisation checks passed ($count assertions).\n";
} finally {
    cleanup();
}
