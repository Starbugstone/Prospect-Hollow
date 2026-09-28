<?php
/** Exercise each real target's CI gate without network, builds or host access. */
declare(strict_types=1);
require __DIR__.'/../../scripts/o2switch/deploy.php';

class RoutingFixtureDeployer extends HostingDeployer
{
    public array $run;
    public int $builds = 0;
    protected function preflight(): void {}
    protected function head(): string { return str_repeat('a', 40); }
    protected function github(string $path, ?array $data = null): array {
        $expected = '/actions/workflows/'.$this->config['workflow'].'/runs?';
        if (!str_starts_with($path, $expected)) throw new RuntimeException('Wrong workflow request');
        parse_str(substr($path, strlen($expected)), $query);
        if ($query !== ['branch' => $this->config['branch'], 'event' => 'push', 'head_sha' => $this->head(), 'per_page' => '1']) {
            throw new RuntimeException('CI lookup must select the target branch, push event and exact SHA');
        }
        return ['workflow_runs' => [$this->run]];
    }
    protected function build(string $sha, string $id): void {
        ++$this->builds;
        mkdir($this->config['root']."/releases/$id", 0700);
    }
    protected function prepare(string $id): void {}
    protected function healthy(string $id): bool { return true; }
}

$root = sys_get_temp_dir().'/hosting-routing-'.bin2hex(random_bytes(6));
mkdir($root);
try {
    foreach (['preprod' => 'preprod', 'production' => 'main'] as $target => $branch) {
        $site = "$root/$target";
        mkdir($site);
        mkdir("$site/control");
        foreach (['build-prospect.sh', 'prepare-prospect.sh'] as $hook) file_put_contents("$site/control/$hook", 'fixture');
        $config = HostingDeployer::readJson(__DIR__."/../../scripts/o2switch/$target.config.example.json");
        if ($config['branch'] !== $branch) throw new RuntimeException('Wrong branch in target definition');
        $config = array_replace($config, [
            'root' => $site, 'repository_path' => $site, 'token_file' => "$site/token",
            'php_bin' => PHP_BINARY, 'composer_bin' => '/usr/bin/composer', 'node_bin_dir' => '/usr/bin',
            'custom_build_script' => "$site/control/build-prospect.sh", 'custom_prepare_script' => "$site/control/prepare-prospect.sh",
        ]);
        $deployer = new RoutingFixtureDeployer($config);
        $good = ['head_sha' => str_repeat('a', 40), 'head_branch' => $branch, 'event' => 'push', 'status' => 'completed', 'conclusion' => 'success', 'head_repository' => ['full_name' => $config['github_repository']]];
        $deployer->command('enable');
        foreach (['main', 'preprod', 'develop'] as $candidate) {
            if ($candidate === $branch) continue;
            $deployer->run = array_replace($good, ['head_branch' => $candidate]);
            $deployer->command('poll');
            if ($deployer->builds !== 0 || is_link("$site/current")) throw new RuntimeException("$candidate CI must not deploy $target, even with an identical SHA");
        }
        foreach (['event' => 'pull_request', 'conclusion' => 'failure', 'status' => 'in_progress', 'head_sha' => str_repeat('b', 40), 'head_repository' => ['full_name' => 'fork/Prospect-Hollow']] as $key => $value) {
            $deployer->run = array_replace($good, [$key => $value]);
            $deployer->command('poll');
            if ($deployer->builds !== 0) throw new RuntimeException("Invalid $key must not authorize $target");
        }
        $deployer->run = $good;
        $deployer->command('poll');
        if ($deployer->builds !== 1 || !str_starts_with(readlink("$site/current"), "$site/releases/")) throw new RuntimeException("Trusted $branch push must deploy only $target");
    }
    echo "Production/preprod branch routing passed.\n";
} finally {
    HostingDeployer::removeTree($root);
}
