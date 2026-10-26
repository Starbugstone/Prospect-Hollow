<?php
require __DIR__ . '/support.php';
use Symfony\Component\HttpFoundation\Request;
$marker = dirname(__DIR__) . '/public/release.txt';
$original = is_file($marker) ? file_get_contents($marker) : null;
$release = str_repeat('a', 40) . '-20260926000000-' . str_repeat('b', 8);
$request = Request::create('http://localhost:8094/api/health?check=test');
try {
    file_put_contents($marker, $release . "\n");
    $controller = new App\HealthController($db, $auth);
    $response = $controller($request);
    check($response->getStatusCode() === 200, 'ready schema');
    check(
        json_decode($response->getContent(), true) === ['status' => 'ok'],
        'template JSON contract',
    );
    check($response->headers->get('X-Release-Id') === $release, 'executing release identity');
    check(str_contains($response->headers->get('Cache-Control'), 'no-store'), 'readiness uncached');
    file_put_contents($marker, "not-a-release\n");
    check(!$controller($request)->headers->has('X-Release-Id'), 'invalid identity omitted');
    // `rollback RELEASE_ID` runs an earlier release on a database a later release migrated.
    // Migrations are additive, so a newer schema stays ready; a missing one is not.
    $connection = $db->get();
    $later = App\Database::latestVersion() + 1;
    $connection->insert('schema_versions', ['version' => $later]);
    try {
        check($controller($request)->getStatusCode() === 200, 'ready after a later migration');
    } finally {
        $connection->delete('schema_versions', ['version' => $later]);
    }
    foreach ([App\Database::latestVersion(), array_key_first(App\Database::migrations())] as $v) {
        $connection->delete('schema_versions', ['version' => $v]);
        try {
            check($controller($request)->getStatusCode() === 503, "not ready without version $v");
        } finally {
            $connection->insert('schema_versions', ['version' => $v]);
        }
    }
    check($controller($request)->getStatusCode() === 200, 'ready again once migrated');
    // The additive rule that keeps rollback safe. Version 12 replaced a prototype table
    // before any release could roll back to it.
    $breaking = '/\b(DROP|RENAME|TRUNCATE|MODIFY|CHANGE\s+COLUMN|ALTER\s+COLUMN)\b/i';
    $required = '/ADD\s+COLUMN\s+\w+\s+[^,;]*\bNOT\s+NULL\b(?![^,;]*\bDEFAULT\b)/i';
    foreach (App\Database::migrations() as $version => $stem) {
        foreach (['', '-postgresql'] as $suffix) {
            $sql = file_get_contents(dirname(__DIR__) . $stem . $suffix . '.sql');
            check(
                $version <= 12 || (!preg_match($breaking, $sql) && !preg_match($required, $sql)),
                "migration $version$suffix is additive",
            );
        }
    }
    $unavailable = new App\Database();
    $_ENV['DATABASE_URL'] = 'mysql://test:test@127.0.0.1:1/unavailable';
    $response = (new App\HealthController($unavailable, $auth))($request);
    check($response->getStatusCode() === 503, 'database outage fails readiness');
    check(
        json_decode($response->getContent(), true) === ['status' => 'unavailable'],
        'generic outage response',
    );
    echo "Release readiness checks passed ($count assertions).\n";
} finally {
    if ($original === null) {
        unlink($marker);
    } else {
        file_put_contents($marker, $original);
    }
}
