<?php
declare(strict_types=1);
// TEMPORARY (issue #60): placeholder shared towns with Town Honours for testing the town
// explorer on preprod. Refuses to run outside preprod or a local machine.
//   php bin/preprod-fixtures.php status
//   php bin/preprod-fixtures.php seed [--visit=PUBLIC_ID[,PUBLIC_ID…]]
//   php bin/preprod-fixtures.php remove
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require dirname(__DIR__) . '/vendor/autoload.php';
if (is_file(dirname(__DIR__) . '/.env.local')) {
    (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__) . '/.env.local');
}
$database = new App\Database();
$auth = new App\Auth($database);
$origin = $auth->origin();
if (!App\PreprodFixtures::allowed($origin)) {
    fwrite(STDERR, "Refusing to run on {$origin}: preprod fixtures are for preprod only.\n");
    exit(1);
}
$fixtures = new App\PreprodFixtures($database, new App\PublicTown($database, $auth), $origin);
$command = $argv[1] ?? '';
$visit = [];
foreach (array_slice($argv, 2) as $argument) {
    if (str_starts_with($argument, '--visit=')) {
        $visit = array_values(array_filter(explode(',', substr($argument, 8))));
    }
}
try {
    if ($command === 'seed') {
        $data = json_decode(
            file_get_contents(dirname(__DIR__) . '/content/preprod-fixtures.json'),
            true,
            512,
            JSON_THROW_ON_ERROR,
        );
        foreach ($fixtures->seed($data, $visit) as $town) {
            printf(
                "%-20s %s/visit#town=%s (%d visitors)\n",
                $town['name'],
                $origin,
                $town['publicId'],
                $town['visitors'],
            );
        }
        if ($visit) {
            echo 'Each fixture mayor also visited: ' . implode(', ', $visit) . "\n";
        }
    } elseif ($command === 'remove') {
        $removed = $fixtures->remove();
        printf(
            "Removed %d placeholder players, %d towns and %d fixture visits.\n",
            $removed['players'],
            $removed['towns'],
            $removed['visits'],
        );
    } elseif ($command === 'status') {
        $status = $fixtures->status();
        printf(
            "%d placeholder players, %d towns, %d fixture visits.\n",
            $status['players'],
            $status['towns'],
            $status['visits'],
        );
    } else {
        fwrite(STDERR, "Usage: preprod-fixtures.php status|seed [--visit=PUBLIC_ID,…]|remove\n");
        exit(2);
    }
} catch (Throwable $error) {
    fwrite(STDERR, $error->getMessage() . "\n");
    exit(1);
}
