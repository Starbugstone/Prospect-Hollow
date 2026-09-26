<?php
/** No hosting/network access. Exercise state transitions with fake build/health boundaries. */
declare(strict_types=1);
require __DIR__.'/../../scripts/o2switch/deploy.php';

function verify(bool $condition, string $message): void {
    if (!$condition) throw new RuntimeException($message);
}
class FixtureDeployer extends HostingDeployer
{
    public string $sha;
    public bool $ci = true;
    public bool $failBuild = false;
    public bool $health = true;
    public bool $stale = false;
    public int $builds = 0;
    protected function preflight(): void {}
    protected function head(): string { return $this->sha; }
    protected function approved(string $sha): bool { return $this->ci; }
    protected function build(string $sha, string $id): void {
        ++$this->builds;
        if ($this->failBuild) throw new RuntimeException('Simulated build failure');
        mkdir($this->config['root']."/releases/$id", 0700);
        if ($this->stale) $this->sha = str_repeat('f', 40);
    }
    protected function prepare(string $id): void {}
    protected function healthy(string $id): bool { return $this->health; }
}
class GitFixtureDeployer extends HostingDeployer
{
    public function fetch(): string { return $this->head(); }
    public function execute(array $command): string { return $this->run($command, true); }
}
$root = sys_get_temp_dir().'/hosting-test-'.bin2hex(random_bytes(6));
mkdir($root);
$config = ['root' => $root, 'repository_path' => $root, 'github_repository' => 'owner/repo', 'branch' => 'main', 'workflow' => 'ci.yml', 'token_file' => "$root/token", 'php_bin' => PHP_BINARY, 'composer_bin' => '/usr/bin/composer', 'node_bin_dir' => '/usr/bin', 'url' => 'https://demo.example.com', 'keep_releases' => 3];
$readState = fn () => HostingDeployer::readJson("$root/state/state.json");
$current = fn () => readlink("$root/current");
try {
    $deployer = new FixtureDeployer($config);
    $deployer->sha = str_repeat('a', 40);
    $deployer->command('poll');
    verify($deployer->builds === 0, 'Default must be disabled');
    $deployer->command('enable');
    $deployer->ci = false;
    $deployer->command('poll');
    verify($deployer->builds === 0, 'Failed CI must block build');
    $deployer->ci = true;
    $deployer->command('poll');
    $first = $current();
    $deployer->command('poll');
    verify($deployer->builds === 1, 'Repeated poll must be idempotent');
    $deployer->sha = str_repeat('b', 40);
    $deployer->failBuild = true;
    try { $deployer->command('poll'); } catch (RuntimeException) {}
    verify($current() === $first && $readState()['attempt']['status'] === 'failed', 'Build failure must preserve current');
    $deployer->command('poll');
    verify($deployer->builds === 2, 'Failed commit must not automatically retry');
    $deployer->failBuild = false;
    $deployer->command('retry');
    $second = $current();
    verify($second !== $first, 'Explicit retry must build same commit');
    $deployer->sha = str_repeat('c', 40);
    $deployer->health = false;
    try { $deployer->command('poll'); } catch (RuntimeException) {}
    verify($current() === $second, 'Bad health must restore prior code');
    $deployer->health = true;
    $deployer->stale = true;
    $deployer->sha = str_repeat('d', 40);
    try { $deployer->command('poll'); } catch (RuntimeException) {}
    verify($current() === $second, 'New main commit during build must prevent activation');
    $deployer->stale = false;
    foreach (['1', '2', '3', '4'] as $char) {
        $deployer->sha = str_repeat($char, 40);
        $deployer->command('poll');
    }
    $releases = $readState()['successful'];
    verify(count($releases) === 3 && count(glob("$root/releases/*")) === 3, 'Retention must keep exactly three successful builds');
    $deployer->command('rollback', $releases[1]);
    verify(basename($current()) === $releases[1] && !is_file("$root/state/enabled"), 'Rollback must pause automatic deploys');
    $lock = fopen("$root/deploy.lock", 'c');
    flock($lock, LOCK_EX);
    $before = $deployer->builds;
    (new FixtureDeployer($config))->command('deploy');
    verify($deployer->builds === $before, 'Lock must prevent concurrent deployment');
    flock($lock, LOCK_UN); fclose($lock);
    $good = ['head_sha' => str_repeat('a', 40), 'head_branch' => 'main', 'event' => 'push', 'status' => 'completed', 'conclusion' => 'success', 'head_repository' => ['full_name' => 'owner/repo']];
    verify(HostingDeployer::eligible($good, $config, $good['head_sha']), 'Trusted run must pass');
    foreach (['event' => 'pull_request', 'status' => 'in_progress', 'conclusion' => 'failure', 'head_sha' => str_repeat('b', 40), 'head_branch' => 'other', 'head_repository' => ['full_name' => 'fork/repo']] as $key => $value) {
        verify(!HostingDeployer::eligible(array_replace($good, [$key => $value]), $config, $good['head_sha']), "Must reject $key mismatch");
    }
    $outside = "$root/outside"; mkdir($outside); file_put_contents("$outside/keep", 'safe');
    $tree = "$root/tree"; mkdir($tree); symlink($outside, "$tree/link");
    HostingDeployer::removeTree($tree);
    verify(is_file("$outside/keep"), 'Cleanup must not follow symlinks');

    // Exercise real Git fetch through a local SSH stand-in, with no network access.
    // This catches the deployer dropping a repository's explicitly selected key.
    $bin = "$root/bin";
    mkdir($bin);
    symlink(PHP_BINARY, "$bin/php");
    $origin = "$root/origin";
    $checkout = "$root/checkout";
    mkdir($checkout);
    $identity = "$root/project-key";
    file_put_contents($identity, 'test fixture, not an SSH key');
    chmod($identity, 0600);
    file_put_contents("$bin/ssh", "#!/bin/sh\nprintf '%s\\n' \"\$@\" > ".escapeshellarg("$root/ssh-args")."\nexec git upload-pack ".escapeshellarg($origin)."\n");
    chmod("$bin/ssh", 0700);
    $gitConfig = array_replace($config, ['repository_path' => $checkout, 'php_bin' => "$bin/php", 'node_bin_dir' => $bin, 'ssh_key' => $identity]);
    $gitDeployer = new GitFixtureDeployer($gitConfig);
    $gitDeployer->execute(['git', 'init', '--initial-branch=main', $origin]);
    $gitDeployer->execute(['git', '-C', $origin, '-c', 'user.name=Fixture', '-c', 'user.email=fixture@example.com', 'commit', '--allow-empty', '-m', 'Fixture']);
    $expectedSha = trim($gitDeployer->execute(['git', '-C', $origin, 'rev-parse', 'HEAD']));
    $gitDeployer->execute(['git', 'init', $checkout]);
    $gitDeployer->execute(['git', '-C', $checkout, 'remote', 'add', 'origin', 'ssh://git@github.com/owner/repo.git']);
    // A per-repository SSH command must not defeat the deployer's strict flags/key.
    $gitDeployer->execute(['git', '-C', $checkout, 'config', 'core.sshCommand', 'false']);
    verify($gitDeployer->fetch() === $expectedSha, 'Fetch with a dedicated key must retrieve the expected commit');
    $sshArguments = file("$root/ssh-args", FILE_IGNORE_NEW_LINES);
    foreach (['BatchMode=yes', 'StrictHostKeyChecking=yes', 'IdentitiesOnly=yes', '-i', $identity] as $argument) {
        verify(in_array($argument, $sshArguments, true), "SSH fetch must use $argument");
    }
    foreach (['relative-key', '/tmp/../key', '/tmp/key;echo'] as $invalidKey) {
        $rejected = false;
        try { new GitFixtureDeployer(array_replace($gitConfig, ['ssh_key' => $invalidKey])); }
        catch (RuntimeException) { $rejected = true; }
        verify($rejected, 'Invalid SSH key paths must be rejected');
    }
    $defaultDeployer = new GitFixtureDeployer(array_replace($gitConfig, ['ssh_key' => '']));
    verify($defaultDeployer->fetch() === $expectedSha, 'Default SSH identity behavior must still work');
    verify(!in_array('-i', file("$root/ssh-args", FILE_IGNORE_NEW_LINES), true), 'Empty ssh_key must leave identity selection to SSH');
    echo "Hosting deployer tests passed.\n";
} finally {
    HostingDeployer::removeTree($root);
}
