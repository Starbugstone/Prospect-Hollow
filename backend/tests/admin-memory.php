<?php
// The admin overview and player list read live saves larger than memory, under the
// production 128 MB limit, with the same totals as reading every save at once.
require __DIR__ . '/support.php';
use App\{AdminAuth, AdminService};

ini_set('memory_limit', '128M');
$service = new AdminService($db, new AdminAuth($db, $auth), $saves, $public);
try {
    $before = $service->overview()['towns'];
    $marker = 'admin-memory-' . bin2hex(random_bytes(4));
    $now = time();
    // One page of players with three saves apiece, each near the 1 MB save limit: about
    // 75 MB of live saves, which MySQL used to buffer twice over in a single read.
    $padding = str_repeat('a', 1000 * 1024);
    $expected = [];
    for ($i = 0; $i < AdminService::PAGE; $i++) {
        $player = bin2hex(random_bytes(16));
        $accounts[] = $player;
        $db->get()->insert('players', [
            'id' => $player,
            'email' => $marker . '-' . $i . '@example.test',
            'created_at' => $now,
        ]);
        for ($j = 0; $j < 3; $j++) {
            $save = profile();
            // Player $i has $i levels in its first town and none in the others.
            for ($level = 1; $j === 0 && $level <= $i; $level++) {
                $save->records->{$level} = (object) ['score' => 100, 'stars' => 1];
            }
            $save->town->era = $j === 2 && $i % 2 ? 'river-rail' : 'frontier';
            $save->padding = $padding;
            $db->get()->insert('towns', [
                'id' => uuid(),
                'player_id' => $player,
                'name' => 'Memory ' . $i . '-' . $j,
                'normalized_name' => 'memory ' . $i . '-' . $j,
                'revision' => 1,
                'profile' => json_encode($save, JSON_THROW_ON_ERROR),
                'saved_at' => $now,
                'public_id' => bin2hex(random_bytes(16)),
                'listed' => 0,
            ]);
            unset($save);
        }
        $expected[$player] = [
            'towns' => 3,
            'bestEra' => $i % 2 ? 'river-rail' : 'frontier',
            'levels' => $i,
        ];
    }
    unset($padding);
    $after = $service->overview()['towns'];
    $eras = fn(array $towns) => array_column($towns['eras'], 'towns', 'era');
    $added = $eras($after);
    foreach ($eras($before) as $era => $count) {
        $added[$era] -= $count;
    }
    $levels = $after['levels'];
    foreach ($before['levels'] as $count) {
        unset($levels[array_search($count, $levels, true)]);
    }
    sort($levels);
    $levelsExpected = [...range(0, AdminService::PAGE - 1), ...array_fill(0, 50, 0)];
    sort($levelsExpected);
    check(
        $after['total'] - $before['total'] === 75 &&
            $added['frontier'] === 75 - intdiv(AdminService::PAGE, 2) &&
            $added['river-rail'] === intdiv(AdminService::PAGE, 2) &&
            $levels === $levelsExpected,
        'the overview counts every live save, era and level total',
    );
    $listed = $service->players(['q' => $marker, 'sort' => 'email']);
    $found = [];
    foreach ($listed['players'] as $row) {
        $found[$row['id']] = [
            'towns' => $row['towns'],
            'bestEra' => $row['bestEra'],
            'levels' => $row['levels'],
        ];
    }
    ksort($found);
    ksort($expected);
    check(
        $listed['total'] === AdminService::PAGE && $found === $expected,
        'the player list gives every player their towns, best era and levels',
    );
    check(
        memory_get_peak_usage(true) < 64 * 1024 * 1024,
        'the admin reads stay well inside the memory limit (peak ' .
            memory_get_peak_usage(true) .
            ')',
    );
    echo 'Admin memory checks passed (' .
        $count .
        ' assertions, peak ' .
        memory_get_peak_usage(true) .
        ").\n";
} finally {
    cleanup();
}
