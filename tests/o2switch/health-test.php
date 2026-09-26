<?php
/** Exercise release health decisions and bounded waits without network calls or sleeping. */
declare(strict_types=1);
require __DIR__.'/../../scripts/o2switch/deploy.php';

function checkHealth(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}

class HealthFixture extends HostingDeployer
{
    public array $responses = [];
    public int $requests = 0;
    public float $elapsed = 0;
    public function probe(string $id): bool { return $this->healthy($id); }
    protected function healthRequest(string $path, int $limit): array {
        ++$this->requests;
        if (!$this->responses) throw new RuntimeException('Unexpected extra health request');
        return array_shift($this->responses);
    }
    protected function healthNow(): float { return $this->elapsed; }
    protected function healthPause(int $seconds): void { $this->elapsed += $seconds; }
}

$root = sys_get_temp_dir().'/hosting-health-test-'.bin2hex(random_bytes(6));
mkdir($root);
$config = ['root' => $root, 'repository_path' => $root, 'github_repository' => 'owner/repo', 'branch' => 'main', 'workflow' => 'ci.yml', 'token_file' => "$root/token", 'php_bin' => PHP_BINARY, 'composer_bin' => '/usr/bin/composer', 'node_bin_dir' => '/usr/bin', 'url' => 'https://demo.example.com', 'keep_releases' => 3];
$old = str_repeat('a', 40).'-20260926000000-aaaaaaaa';
$new = str_repeat('b', 40).'-20260926000000-bbbbbbbb';
$reply = fn (int $status, string|false $body, string $release = '') => compact('status', 'body', 'release');
$ready = $reply(200, '{"status":"ok"}', $new);
$stale = $reply(200, '{"status":"ok"}', $old);
try {
    $test = new HealthFixture($config);
    $test->responses = [$ready];
    checkHealth($test->probe($new) && $test->requests === 1, 'Expected healthy release must pass immediately');

    $test = new HealthFixture($config);
    $test->responses = array_merge(array_fill(0, 25, $stale), [$ready]);
    checkHealth($test->probe($new) && $test->elapsed === 125.0, 'Allow a healthy cached release to converge after the usual 120-second realpath TTL');

    $test = new HealthFixture($config);
    $test->responses = array_fill(0, 31, $stale);
    checkHealth(!$test->probe($new) && $test->elapsed === 150.0, 'Never accept a persistently wrong release; bound the stale wait');

    $test = new HealthFixture(array_replace($config, ['health_stale_timeout_seconds' => 0]));
    $test->responses = [$stale];
    checkHealth(!$test->probe($new) && $test->elapsed === 0.0, 'Allow disabling the stale grace period');

    foreach ([
        $reply(429, '{"status":"ok"}', $new),
        $reply(503, '{"status":"unavailable"}', $new),
        $reply(302, '{"status":"ok"}', $new),
        $reply(0, false),
        $reply(200, 'fixture-body-do-not-log', $new),
        $reply(200, '{"status":"ok"}', 'fixture-header-do-not-log'),
        $reply(200, '{"status":"ok"}'),
    ] as $bad) {
        $test = new HealthFixture($config);
        $test->responses = array_fill(0, 5, $bad);
        checkHealth(!$test->probe($new) && $test->requests === 5 && $test->elapsed === 8.0, 'Unhealthy or unidentifiable responses must retain the short retry window');
    }

    $test = new HealthFixture($config);
    $test->responses = [$reply(429, false), $ready];
    checkHealth($test->probe($new), 'A transient HTTP failure may recover');

    $staticConfig = array_replace($config, ['profile' => 'vite-static', 'health_mode' => 'static']);
    $page = $reply(200, '<!doctype html><html><body>Fixture</body></html>');
    $test = new HealthFixture($staticConfig);
    $test->responses = [$reply(200, $old."\n"), $page, $reply(200, $new."\n"), $page];
    checkHealth($test->probe($new) && $test->elapsed === 5.0, 'Static marker and HTML must converge to the expected release');
    $test = new HealthFixture($staticConfig);
    $test->responses = array_merge(...array_fill(0, 5, [$reply(200, $new), $reply(503, '<html>error</html>')]));
    checkHealth(!$test->probe($new), 'Static HTML errors must not be accepted as a healthy page');

    foreach ([-1, 301, '150'] as $invalid) {
        $rejected = false;
        try { new HealthFixture(array_replace($config, ['health_stale_timeout_seconds' => $invalid])); }
        catch (RuntimeException) { $rejected = true; }
        checkHealth($rejected, 'Reject invalid stale timeout settings');
    }
    $log = file_get_contents("$root/logs/control.log");
    checkHealth(str_contains($log, '"http":429') && str_contains($log, 'other_healthy_release') && str_contains($log, $old), 'Record status and safe release identities for diagnosis');
    checkHealth(!str_contains($log, 'fixture-body-do-not-log') && !str_contains($log, 'fixture-header-do-not-log'), 'Never log arbitrary response bodies or headers');
    echo "Health checks passed: release convergence, strict identity/status, bounded waits, static readiness, private diagnostics.\n";
} finally {
    HostingDeployer::removeTree($root);
}
