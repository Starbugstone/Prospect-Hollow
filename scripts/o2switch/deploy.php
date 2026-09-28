<?php
/** Install outside public/. Run: php deploy.php /absolute/config.json COMMAND [RELEASE_ID] */
declare(strict_types=1);

class HostingDeployer
{
    private array $state;
    private string $log;
    private $lock;

    public function __construct(protected array $config)
    {
        $config += ['profile' => 'symfony-vite', 'backend_dir' => 'backend', 'frontend_dir' => 'frontend', 'frontend_output' => 'dist', 'custom_build_script' => '', 'custom_prepare_script' => '', 'health_mode' => 'symfony', 'ssh_key' => '', 'health_stale_timeout_seconds' => 150];
        $this->config = $config;
        if (!is_int($config['health_stale_timeout_seconds']) || $config['health_stale_timeout_seconds'] < 0 || $config['health_stale_timeout_seconds'] > 300) throw new RuntimeException('health_stale_timeout_seconds must be an integer from 0 to 300.');
        if (!in_array($config['profile'], ['symfony-vite', 'vite-static', 'custom'], true) || !in_array($config['health_mode'], ['symfony', 'static'], true)) throw new RuntimeException('Unknown build profile or health mode.');
        foreach (['backend_dir', 'frontend_dir', 'frontend_output'] as $key) {
            if (!preg_match('~^(?:\.|[A-Za-z0-9_-]+(?:/[A-Za-z0-9_.-]+)*)$~D', $config[$key]) || str_contains($config[$key], '..')) throw new RuntimeException("Invalid relative path: $key");
        }
        foreach (['custom_build_script', 'custom_prepare_script'] as $key) {
            if ($config[$key] !== '' && (!str_starts_with(realpath($config[$key]) ?: '', $config['root'].'/control/') || !is_file($config[$key]))) throw new RuntimeException("$key must be an installed file under root/control.");
        }
        if ($config['profile'] === 'custom' && $config['custom_build_script'] === '') throw new RuntimeException('Custom profile requires custom_build_script.');
        if ($config['profile'] === 'symfony-vite' && $config['backend_dir'] === '.') throw new RuntimeException('For root-level PHP layouts, use a custom build recipe.');
        if ($config['profile'] === 'vite-static' && $config['health_mode'] !== 'static') throw new RuntimeException('vite-static requires static health mode.');
        $absolutePaths = ['root', 'repository_path', 'token_file', 'php_bin', 'composer_bin', 'node_bin_dir'];
        if ($config['ssh_key'] !== '') $absolutePaths[] = 'ssh_key';
        foreach ($absolutePaths as $key) {
            if (!isset($config[$key]) || !preg_match('~^/[A-Za-z0-9_./-]+$~D', $config[$key]) || str_contains($config[$key], '/..')) {
                throw new RuntimeException("Invalid absolute path: $key");
            }
        }
        if (!preg_match('~^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$~D', $config['github_repository'] ?? '')
            || !preg_match('~^[A-Za-z0-9_-]+$~D', $config['branch'] ?? '')
            || !preg_match('~^[A-Za-z0-9_.-]+\.ya?ml$~D', $config['workflow'] ?? '')
            || !preg_match('~^https://[A-Za-z0-9.-]+$~D', $config['url'] ?? '')
            || !is_int($config['keep_releases'] ?? null) || $config['keep_releases'] < 2 || $config['keep_releases'] > 10) {
            throw new RuntimeException('Invalid repository, branch, workflow, HTTPS URL or retention (2–10).');
        }
        $root = rtrim($config['root'], '/');
        if (realpath($root) !== $root || !is_dir($config['repository_path'])) {
            throw new RuntimeException('Create root and clone/connect the repository before running this tool. Root must be a real directory.');
        }
        $this->config['root'] = $root;
        foreach (['state', 'logs', 'builds', 'releases', 'shared'] as $dir) {
            if (is_link("$root/$dir")) {
                throw new RuntimeException("Refusing symlinked control directory: $dir");
            }
            if (!is_dir("$root/$dir") && !mkdir("$root/$dir", 0700)) {
                throw new RuntimeException("Cannot create $dir");
            }
        }
        $this->state = is_file("$root/state/state.json") ? self::readJson("$root/state/state.json") : [];
        $this->log = "$root/logs/control.log";
    }

    public static function readJson(string $path): array
    {
        return json_decode(file_get_contents($path), true, 512, JSON_THROW_ON_ERROR);
    }

    public function command(string $command, ?string $argument = null): void
    {
        $root = $this->config['root'];
        $this->lock = fopen("$root/deploy.lock", 'c');
        if (!flock($this->lock, LOCK_EX | LOCK_NB)) {
            echo "Another deployment command holds the lock; skipping.\n";
            return;
        }
        // Reload after acquiring the lock. All state writers use this same lock.
        $this->state = is_file("$root/state/state.json") ? self::readJson("$root/state/state.json") : [];
        try {
            switch ($command) {
                case 'status':
                    echo json_encode(['enabled' => is_file("$root/state/enabled"), 'current' => $this->current(), 'state' => $this->state], JSON_PRETTY_PRINT)."\n";
                    break;
                case 'enable':
                    file_put_contents("$root/state/enabled", "enabled\n");
                    echo "Automatic polling enabled.\n";
                    break;
                case 'disable':
                    $this->disable();
                    echo "Automatic polling disabled.\n";
                    break;
                case 'check':
                    $this->preflight();
                    $sha = $this->head();
                    echo "Git access works. CI for $sha: ".($this->approved($sha) ? 'passed' : 'not yet eligible')."\n";
                    break;
                case 'poll':
                    if (!is_file("$root/state/enabled")) {
                        return;
                    }
                    $this->deploy(false);
                    break;
                case 'deploy':
                case 'retry':
                    $this->deploy($command === 'retry');
                    break;
                case 'rollback':
                    $this->disable(); // Prevent the next cron tick from undoing the rollback.
                    $this->rollback($argument ?? '');
                    break;
                default:
                    throw new RuntimeException('Commands: check, status, deploy, retry, enable, disable, poll, rollback RELEASE_ID');
            }
        } finally {
            flock($this->lock, LOCK_UN);
            fclose($this->lock);
        }
    }

    protected function preflight(): void
    {
        $root = $this->config['root'];
        if ($this->config['profile'] === 'symfony-vite' && !is_file("$root/shared/.env.local")) {
            throw new RuntimeException('Missing shared/.env.local; copy the production example and configure it.');
        }
        $secrets = [$this->config['token_file']];
        if ($this->config['ssh_key'] !== '') $secrets[] = $this->config['ssh_key'];
        if ($this->config['profile'] === 'symfony-vite') $secrets[] = "$root/shared/.env.local";
        foreach ($secrets as $secret) {
            if (!is_file($secret) || (fileperms($secret) & 0077) !== 0) {
                throw new RuntimeException('Secret files must exist with owner-only permissions (chmod 600).');
            }
        }
        if ($this->config['profile'] === 'symfony-vite') {
        $this->run([$this->config['php_bin'], '-r', 'foreach (["pdo_mysql","intl","dom","xml","openssl"] as $e) { if (!extension_loaded($e)) { fwrite(STDERR, "Missing extension: $e\n"); exit(1); } }']);
        $this->run([$this->config['php_bin'], $this->config['composer_bin'], '--version']);
        }
        if (!filter_var(ini_get('allow_url_fopen'), FILTER_VALIDATE_BOOLEAN)) throw new RuntimeException('Enable allow_url_fopen for verified HTTPS API requests.');
        $this->run(['node', '--version']);
        $this->run(['npm', '--version']);
        $this->run(['git', '--version']);
        $this->run(['tar', '--version']);
    }

    protected function head(): string
    {
        $repo = $this->config['repository_path'];
        $origin = trim($this->run(['git', '-C', $repo, 'remote', 'get-url', 'origin'], true));
        $name = preg_quote($this->config['github_repository'], '~');
        if (!preg_match('~^(?:git@github\.com:|ssh://git@github\.com/|https://github\.com/)'.$name.'(?:\.git)?$~iD', $origin)) {
            throw new RuntimeException('origin must point to the configured GitHub repository, without embedded credentials.');
        }
        $this->run(['git', '-C', $repo, 'fetch', '--no-tags', 'origin', 'refs/heads/'.$this->config['branch']]);
        $sha = trim($this->run(['git', '-C', $repo, 'rev-parse', 'FETCH_HEAD^{commit}'], true));
        if (!preg_match('/^[a-f0-9]{40}$/D', $sha)) {
            throw new RuntimeException('Invalid fetched commit.');
        }
        return $sha;
    }

    public static function eligible(array $run, array $config, string $sha): bool
    {
        return ($run['head_sha'] ?? '') === $sha
            && ($run['head_branch'] ?? '') === $config['branch']
            && ($run['event'] ?? '') === 'push'
            && ($run['status'] ?? '') === 'completed'
            && ($run['conclusion'] ?? '') === 'success'
            && strcasecmp($run['head_repository']['full_name'] ?? '', $config['github_repository']) === 0;
    }

    protected function approved(string $sha): bool
    {
        // Do not filter by success: a newer failed/re-running attempt must block deployment.
        $query = http_build_query(['branch' => $this->config['branch'], 'event' => 'push', 'head_sha' => $sha, 'per_page' => 1]);
        $result = $this->github('/actions/workflows/'.rawurlencode($this->config['workflow']).'/runs?'.$query);
        return self::eligible($result['workflow_runs'][0] ?? [], $this->config, $sha);
    }

    protected function github(string $path, ?array $data = null): array
    {
        $token = trim(file_get_contents($this->config['token_file']));
        if (!preg_match('/^[A-Za-z0-9_]+$/D', $token)) {
            throw new RuntimeException('Invalid GitHub token file.');
        }
        $context = stream_context_create(['http' => [
            'method' => $data === null ? 'GET' : 'POST', 'timeout' => 30, 'ignore_errors' => true, 'follow_location' => 0,
            'header' => "Authorization: Bearer $token\r\nAccept: application/vnd.github+json\r\nUser-Agent: launchpad-host-deployer\r\nX-GitHub-Api-Version: 2022-11-28\r\nContent-Type: application/json\r\n",
            'content' => $data === null ? '' : json_encode($data, JSON_THROW_ON_ERROR),
        ], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $body = @file_get_contents('https://api.github.com/repos/'.$this->config['github_repository'].$path, false, $context, 0, 2_000_000);
        if ($body === false || !preg_match('~^HTTP/\S+ 2\d\d ~', $http_response_header[0] ?? '')) {
            throw new RuntimeException('GitHub API request failed; check token permissions, expiry, rate limits and HTTPS access.');
        }
        return json_decode($body, true, 512, JSON_THROW_ON_ERROR);
    }

    private function deploy(bool $retry): void
    {
        $root = $this->config['root'];
        $sha = $this->head();
        if (($this->state['attempt']['sha'] ?? null) === $sha && !$retry) {
            return;
        }
        if (!$this->approved($sha)) {
            echo "Waiting for successful push CI on $sha.\n";
            return;
        }
        $this->preflight();
        // Clear interrupted build work while holding the deployment lock.
        foreach (new FilesystemIterator("$root/builds") as $entry) self::removeTree($entry->getPathname());
        $id = $sha.'-'.gmdate('YmdHis').'-'.bin2hex(random_bytes(4));
        $this->log = "$root/logs/$id.log";
        $this->state['attempt'] = ['sha' => $sha, 'id' => $id, 'status' => 'building', 'started_at' => gmdate(DATE_ATOM)];
        $this->save(); // A killed process will not cause unlimited automatic retries.
        $deployment = null;
        $previous = $this->current();
        $completed = false;
        try {
            if ($this->config['report_github'] ?? false) {
                $deployment = $this->github('/deployments', ['ref' => $sha, 'auto_merge' => false, 'required_contexts' => [], 'environment' => 'production', 'description' => 'o2switch server build'])['id'];
                $this->report($deployment, 'in_progress');
            }
            $this->build($sha, $id);
            if ($this->head() !== $sha || !$this->approved($sha)) {
                throw new RuntimeException('Branch or CI changed during the build; refusing to activate a stale commit.');
            }
            $this->prepare($id);
            $this->switchAndCheck($id);
            $this->atomicJson("$root/releases/$id/deployment.json", ['sha' => $sha, 'id' => $id, 'deployed_at' => gmdate(DATE_ATOM)]);
            $this->state['successful'] = array_merge([$id], $this->state['successful'] ?? []);
            $this->state['attempt']['status'] = 'success';
            $this->save();
            $completed = true;
            $this->report($deployment, 'success');
            echo "Deployed $id\n";
        } catch (Throwable $e) {
            if (!$completed && $this->current() === $id) {
                if ($previous !== null) $this->switchTo($previous);
                else unlink("$root/current");
            }
            $this->state['successful'] = array_values(array_diff($this->state['successful'] ?? [], [$id]));
            $this->state['attempt']['status'] = 'failed';
            $this->save();
            $this->report($deployment, 'failure');
            throw $e;
        } finally {
            self::removeTree("$root/builds/$id");
            self::removeTree("$root/builds/composer-cache");
            if ($this->current() !== $id && !in_array($id, $this->state['successful'] ?? [], true)) {
                self::removeTree("$root/releases/$id");
            }
            try { $this->prune(); } catch (Throwable) { echo "Warning: cleanup failed; inspect disk space and private directories.\n"; }
        }
    }

    protected function build(string $sha, string $id): void
    {
        $root = $this->config['root'];
        $work = "$root/builds/$id";
        mkdir($work, 0700);
        $archive = "$root/builds/$id.tar";
        try {
            $this->run(['git', '-C', $this->config['repository_path'], 'archive', '--format=tar', '--output='.$archive, $sha]);
            $this->run(['tar', '-xf', $archive, '-C', $work]);
        } finally {
            if (is_file($archive)) unlink($archive);
        }
        $destination = "$root/releases/$id";
        $frontend = "$work/".$this->config['frontend_dir'];
        $backend = "$work/".$this->config['backend_dir'];
        if ($this->config['profile'] === 'custom') {
            $this->run(['bash', $this->config['custom_build_script'], $work, $destination, $this->config['php_bin'], $this->config['composer_bin']], false, $work);
        } else {
            if ($this->config['profile'] === 'symfony-vite') {
                $this->run([$this->config['php_bin'], $this->config['composer_bin'], 'install', '--no-dev', '--prefer-dist', '--no-interaction', '--no-scripts', '--optimize-autoloader'], false, $backend);
            }
            $this->run(['npm', 'ci', '--include=dev', '--cache', "$work/npm-cache"], false, $frontend);
            $this->run(['npm', 'run', 'build'], false, $frontend);
            $output = "$frontend/".$this->config['frontend_output'];
            if ($this->config['profile'] === 'symfony-vite') {
                $this->run(['cp', '-R', "$output/.", "$backend/public/"]);
                if (!rename($backend, $destination)) throw new RuntimeException('Cannot move build into releases.');
            } else {
                mkdir("$destination/public", 0750, true);
                $this->run(['cp', '-R', "$output/.", "$destination/public/"]);
                // A framework-neutral static SPA fallback; preserve a supplied .htaccess.
                if (!is_file("$destination/public/.htaccess")) {
                    file_put_contents("$destination/public/.htaccess", "Options -Indexes -MultiViews\nDirectoryIndex index.html\nRewriteEngine On\nRewriteRule ^\\.well-known/acme-challenge/[A-Za-z0-9_-]+$ - [END]\nRewriteRule (^|/)\\. - [F,L]\nRewriteCond %{REQUEST_FILENAME} -f [OR]\nRewriteCond %{REQUEST_FILENAME} -d\nRewriteRule ^ - [L]\nRewriteRule ^ index.html [L]\n");
                }
            }
        }
        if (!is_file("$destination/public/index.html") || is_link($destination) || is_link("$destination/public")) {
            throw new RuntimeException('Build must produce a real release directory with public/index.html.');
        }
        file_put_contents("$root/releases/$id/public/release.txt", $id."\n");
        $this->run(['chmod', '-R', 'u=rwX,g=rX,o=', "$root/releases/$id"]);
        // Static web workers need to traverse release parents and read public assets.
        // Keep application internals private; reject public symlinks before chmod.
        chmod($destination, 0755);
        chmod("$destination/public", 0755);
        $publicFiles = new RecursiveIteratorIterator(new RecursiveDirectoryIterator("$destination/public", FilesystemIterator::SKIP_DOTS), RecursiveIteratorIterator::SELF_FIRST);
        foreach ($publicFiles as $file) {
            if ($file->isLink()) throw new RuntimeException('Public output must not contain symlinks.');
            chmod($file->getPathname(), $file->isDir() ? 0755 : 0644);
        }
    }

    protected function prepare(string $id): void
    {
        $release = $this->config['root']."/releases/$id";
        if ($this->config['profile'] === 'custom') {
            if ($this->config['custom_prepare_script'] !== '') $this->run(['bash', $this->config['custom_prepare_script'], $release, $this->config['root'].'/shared', $this->config['php_bin']], false, $release);
            return;
        }
        if ($this->config['profile'] === 'vite-static') return;
        if (!symlink($this->config['root'].'/shared/.env.local', "$release/.env.local")) {
            throw new RuntimeException('Cannot link application configuration.');
        }
        foreach ([['doctrine:migrations:migrate', '--no-interaction', '--allow-no-migration'], ['cache:clear'], ['cache:warmup']] as $args) {
            $this->run(array_merge([$this->config['php_bin'], 'bin/console'], $args), false, $release);
        }
    }

    protected function healthy(string $id): bool
    {
        $deadline = $this->healthNow() + $this->config['health_stale_timeout_seconds'];
        $failures = 0;
        for ($attempt = 1; ; ++$attempt) {
            $nonce = bin2hex(random_bytes(6));
            if ($this->config['health_mode'] === 'static') {
                $marker = $this->healthRequest('/release.txt?check='.$nonce, 256);
                $page = $this->healthRequest('/?check='.$nonce, 262144);
                $version = trim($marker['body'] ?: '');
                $status = ['marker' => $marker['status'], 'page' => $page['status']];
                $appOk = $marker['status'] === 200 && $page['status'] === 200 && str_contains(strtolower($page['body'] ?: ''), '<html');
            } else {
                $health = $this->healthRequest('/api/health?check='.$nonce, 1024);
                $version = $health['release'];
                $status = $health['status'];
                $appOk = $status === 200 && json_decode($health['body'] ?: '', true) === ['status' => 'ok'];
            }
            // Never log arbitrary response bodies or header contents: they may contain secrets.
            if (!preg_match('/^[a-f0-9]{40}-[0-9]{14}-[a-f0-9]{8}$/D', $version)) $version = '';
            $ready = $appOk && $version === $id;
            $otherHealthyRelease = $appOk && $version !== '' && $version !== $id;
            file_put_contents($this->log, 'Health probe '.json_encode([
                'attempt' => $attempt, 'http' => $status, 'app_ok' => $appOk,
                'expected_release' => $id, 'observed_release' => $version ?: null,
                'result' => $ready ? 'ready' : ($otherHealthyRelease ? 'other_healthy_release' : 'unhealthy'),
            ], JSON_UNESCAPED_SLASHES)."\n", FILE_APPEND);
            if ($ready) return true;
            if ($otherHealthyRelease) {
                // A worker may cache the previous symlink target. It must eventually
                // serve the requested release; a healthy old version never counts as success.
                $remaining = $deadline - $this->healthNow();
                if ($remaining <= 0) return false;
                $this->healthPause((int) min(5, ceil($remaining)));
            } else {
                if (++$failures >= 5) return false;
                $this->healthPause(2);
            }
        }
    }

    /** Verified HTTPS with bounded reads; HTTP 0 means no HTTP response was received. */
    protected function healthRequest(string $path, int $limit): array
    {
        $context = stream_context_create(['http' => ['timeout' => 10, 'follow_location' => 0, 'ignore_errors' => true, 'header' => "Cache-Control: no-cache\r\n"], 'ssl' => ['verify_peer' => true, 'verify_peer_name' => true]]);
        $http_response_header = [];
        $body = @file_get_contents($this->config['url'].$path, false, $context, 0, $limit);
        preg_match('~^HTTP/\S+ (\d{3})(?: |$)~', $http_response_header[0] ?? '', $match);
        $version = '';
        foreach ($http_response_header as $header) {
            if (stripos($header, 'X-Release-Id:') === 0) $version = trim(substr($header, 13));
        }
        return ['status' => (int) ($match[1] ?? 0), 'body' => $body, 'release' => $version];
    }

    protected function healthNow(): float { return microtime(true); }
    protected function healthPause(int $seconds): void { sleep($seconds); }

    private function switchAndCheck(string $id): void
    {
        $previous = $this->current();
        $this->switchTo($id);
        if (!$this->healthy($id)) {
            if ($previous !== null) $this->switchTo($previous);
            else unlink($this->config['root'].'/current');
            throw new RuntimeException('Health check failed; prior code restored. Database changes are NOT reverted.');
        }
    }

    private function rollback(string $id): void
    {
        if (!in_array($id, $this->state['successful'] ?? [], true) || !is_file($this->config['root']."/releases/$id/deployment.json")) {
            throw new RuntimeException('Choose an existing successful release ID from status. Polling is now disabled.');
        }
        $this->switchAndCheck($id);
        echo "Rolled back to $id. Polling remains disabled; database unchanged.\n";
    }

    private function current(): ?string
    {
        $path = $this->config['root'].'/current';
        if (!is_link($path)) {
            if (file_exists($path)) throw new RuntimeException('current must be a symlink, not a real directory.');
            return null;
        }
        $target = readlink($path);
        if (dirname($target) !== $this->config['root'].'/releases' || !preg_match('/^[a-f0-9]{40}-[0-9]{14}-[a-f0-9]{8}$/D', basename($target))) {
            throw new RuntimeException('current points outside this deployer\'s managed releases.');
        }
        return basename($target);
    }

    private function switchTo(string $id): void
    {
        $root = $this->config['root'];
        $temp = "$root/current.".bin2hex(random_bytes(6));
        if (!symlink("$root/releases/$id", $temp) || !rename($temp, "$root/current")) {
            throw new RuntimeException('Atomic symlink switch failed.');
        }
    }

    private function prune(): void
    {
        $root = $this->config['root'];
        $all = array_values(array_unique($this->state['successful'] ?? []));
        $keep = array_slice(array_values(array_unique(array_filter(array_merge([$this->current()], $all)))), 0, $this->config['keep_releases']);
        foreach (new FilesystemIterator("$root/releases") as $entry) {
            $id = $entry->getFilename();
            if (preg_match('/^[a-f0-9]{40}-[0-9]{14}-[a-f0-9]{8}$/D', $id) && !in_array($id, $keep, true)) self::removeTree($entry->getPathname());
        }
        $this->state['successful'] = array_values(array_filter($keep, fn ($id) => is_file("$root/releases/$id/deployment.json")));
        $this->save();
        // Bound retained diagnostic files. Build logs are separately capped per process.
        $logs = glob("$root/logs/*.log");
        usort($logs, fn ($a, $b) => filemtime($b) <=> filemtime($a));
        foreach (array_slice($logs, 20) as $log) if ($log !== $this->log) unlink($log);
    }

    protected function run(array $command, bool $capture = false, ?string $cwd = null): string
    {
        $environment = getenv();
        foreach (['APP_SECRET', 'DATABASE_URL', 'GITHUB_TOKEN', 'GH_TOKEN'] as $key) unset($environment[$key]);
        $environment['APP_ENV'] = 'prod';
        $environment['APP_DEBUG'] = '0';
        $environment['GIT_TERMINAL_PROMPT'] = '0';
        $environment['GIT_SSH_COMMAND'] = 'ssh -o BatchMode=yes -o StrictHostKeyChecking=yes -o ConnectTimeout=15';
        if ($this->config['ssh_key'] !== '') {
            $environment['GIT_SSH_COMMAND'] .= ' -o IdentitiesOnly=yes -i '.escapeshellarg($this->config['ssh_key']);
        }
        $environment['PATH'] = dirname($this->config['php_bin']).':'.$this->config['node_bin_dir'].':'.($environment['PATH'] ?? '/usr/local/bin:/usr/bin:/bin');
        $environment['COMPOSER_CACHE_DIR'] = $this->config['root'].'/builds/composer-cache';
        $process = proc_open($command, [0 => ['file', '/dev/null', 'r'], 1 => ['pipe', 'w'], 2 => ['pipe', 'w']], $pipes, $cwd, $environment);
        if (!is_resource($process)) throw new RuntimeException('Cannot start build command.');
        $output = '';
        clearstatcache(true, $this->log);
        $written = is_file($this->log) ? filesize($this->log) : 0;
        $streams = [1 => $pipes[1], 2 => $pipes[2]];
        foreach ($streams as $stream) stream_set_blocking($stream, false);
        while ($streams) {
            $read = array_values($streams);
            $write = $except = null;
            if (stream_select($read, $write, $except, 1) === false) break;
            foreach ($read as $stream) {
                $chunk = fread($stream, 8192);
                if ($capture && $stream === $pipes[1]) {
                    if (strlen($output) < 262144) $output .= $chunk;
                } elseif ($written < 2_000_000) {
                    $chunk = substr($chunk, 0, 2_000_000 - $written);
                    file_put_contents($this->log, $chunk, FILE_APPEND);
                    $written += strlen($chunk);
                }
            }
            foreach ($streams as $index => $stream) {
                if (feof($stream)) { fclose($stream); unset($streams[$index]); }
            }
        }
        if (proc_close($process) !== 0) throw new RuntimeException('Command failed: '.basename($command[0]).'; see private hosting logs.');
        return $output;
    }

    private function report(?int $deployment, string $status): void
    {
        if ($deployment === null) return;
        try {
            $this->github("/deployments/$deployment/statuses", ['state' => $status, 'environment_url' => $this->config['url'], 'description' => 'o2switch: '.$status]);
        } catch (Throwable) {
            echo "Warning: GitHub status reporting failed; inspect local deployment status.\n";
        }
    }

    private function disable(): void
    {
        $path = $this->config['root'].'/state/enabled';
        if (is_file($path)) unlink($path);
    }

    private function save(): void
    {
        $this->atomicJson($this->config['root'].'/state/state.json', $this->state);
    }

    private function atomicJson(string $path, array $data): void
    {
        $temp = $path.'.tmp';
        if (file_put_contents($temp, json_encode($data, JSON_PRETTY_PRINT | JSON_THROW_ON_ERROR)."\n") === false || !rename($temp, $path)) {
            throw new RuntimeException('Cannot save deployment state.');
        }
    }

    public static function removeTree(string $path): void
    {
        if (is_link($path) || is_file($path)) { unlink($path); return; }
        if (!is_dir($path)) return;
        foreach (new FilesystemIterator($path) as $item) self::removeTree($item->getPathname());
        rmdir($path);
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    umask(0027);
    try {
        if (PHP_SAPI !== 'cli') throw new RuntimeException('CLI only.');
        $path = $argv[1] ?? '';
        if (!is_file($path) || (fileperms($path) & 0077) !== 0) throw new RuntimeException('Supply a private config.json with chmod 600.');
        (new HostingDeployer(HostingDeployer::readJson($path)))->command($argv[2] ?? 'status', $argv[3] ?? null);
    } catch (Throwable $e) {
        fwrite(STDERR, gmdate(DATE_ATOM).' '.$e->getMessage()."\n");
        exit(1);
    }
}
