<?php
require __DIR__.'/support.php';
use Symfony\Component\HttpFoundation\Request;
$marker = dirname(__DIR__).'/public/release.txt';
$original = is_file($marker) ? file_get_contents($marker) : null;
$release = str_repeat('a', 40).'-20260926000000-'.str_repeat('b', 8);
$request = Request::create('http://localhost:8094/api/health?check=test');
try {
    file_put_contents($marker, $release."\n");
    $controller = new App\HealthController($db, $auth);
    $response = $controller($request);
    check($response->getStatusCode() === 200, 'ready schema');
    check(json_decode($response->getContent(), true) === ['status'=>'ok'], 'template JSON contract');
    check($response->headers->get('X-Release-Id') === $release, 'executing release identity');
    check(str_contains($response->headers->get('Cache-Control'), 'no-store'), 'readiness uncached');
    file_put_contents($marker, "not-a-release\n");
    check(!$controller($request)->headers->has('X-Release-Id'), 'invalid identity omitted');
    $unavailable = new App\Database();
    $_ENV['DATABASE_URL'] = 'mysql://test:test@127.0.0.1:1/unavailable';
    $response = (new App\HealthController($unavailable, $auth))($request);
    check($response->getStatusCode() === 503, 'database outage fails readiness');
    check(json_decode($response->getContent(), true) === ['status'=>'unavailable'], 'generic outage response');
    echo "Release readiness checks passed ($count assertions).\n";
} finally {
    if ($original === null) unlink($marker); else file_put_contents($marker, $original);
}
