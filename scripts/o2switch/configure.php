<?php
/** First-time, interactive hosting configuration. Never accepts secret arguments. */
declare(strict_types=1);
require_once __DIR__.'/deploy.php';

class HostingSetup
{
    public function __construct(private string $root) {}

    protected function ask(string $label, string $default = '', bool $secret = false): string
    {
        fwrite(STDERR, $label.($default !== '' ? " [$default]" : '').': ');
        if ($secret) {
            // Bash read restores terminal echo even when interrupted. The value travels
            // through a pipe, never argv, an environment variable, or shell history.
            $process = proc_open(['bash', '-c', 'set +x; IFS= read -r -s value || exit 1; printf "%s" "$value"'],
                [0 => STDIN, 1 => ['pipe', 'w'], 2 => STDERR], $pipes);
            if (!is_resource($process)) throw new RuntimeException('Cannot open hidden input.');
            $value = stream_get_contents($pipes[1]);
            fclose($pipes[1]);
            $status = proc_close($process);
            fwrite(STDERR, "\n");
            if ($status !== 0 || $value === false) throw new RuntimeException('Input cancelled.');
        } else {
            $line = fgets(STDIN);
            if ($line === false) throw new RuntimeException('Input cancelled.');
            $value = trim($line);
        }
        return $value === '' ? $default : $value;
    }

    protected function save(string $path, string $contents): void
    {
        $temporary = tempnam(dirname($path), '.setup-');
        if ($temporary === false) throw new RuntimeException('Cannot create private configuration.');
        try {
            if (!chmod($temporary, 0600) || file_put_contents($temporary, $contents) === false || !rename($temporary, $path)) {
                throw new RuntimeException('Cannot save private configuration.');
            }
        } finally {
            if (is_file($temporary)) unlink($temporary);
        }
    }

    public function run(): void
    {
        $root = $this->root;
        if (realpath($root) !== $root || !preg_match('~^/home/[A-Za-z0-9_/-]+$~D', $root)) {
            throw new RuntimeException('Use the installed absolute project root under /home, without a trailing slash.');
        }
        foreach (['control', 'shared', 'state', 'logs', 'builds'] as $directory) {
            if (!is_dir("$root/$directory") || is_link("$root/$directory") || (fileperms("$root/$directory") & 0077) !== 0) {
                throw new RuntimeException('Run install.sh first; setup directories must be private and not symlinks.');
            }
        }
        foreach (['control/config.json', 'shared/.env.local', 'shared/github-token', 'deploy.lock'] as $path) {
            if (is_link("$root/$path")) throw new RuntimeException('Refusing symlinked setup files.');
        }
        $lock = fopen("$root/deploy.lock", 'c');
        if (!$lock || !flock($lock, LOCK_EX | LOCK_NB)) throw new RuntimeException('A deployment command is running; try setup later.');
        try {
            $configPath = "$root/control/config.json";
            $config = HostingDeployer::readJson($configPath);
            if (!str_starts_with($config['root'] ?? '', '/home/CPANEL_USER/') || is_file("$root/state/enabled") || is_file("$root/state/state.json")) {
                throw new RuntimeException('Already configured or deployed. Existing configuration and secrets were left unchanged; use the maintenance guide.');
            }
            $config['root'] = $root;
            $config['token_file'] = "$root/shared/github-token";
            $config['php_bin'] = PHP_BINARY;
            $config['github_repository'] = $this->ask('GitHub repository (OWNER/REPOSITORY)');
            $account = '/home/'.explode('/', $root)[2];
            $config['repository_path'] = $this->ask('Existing Git checkout', "$account/repositories/".basename($root));
            $config['url'] = $this->ask('Site URL (https://domain, no trailing slash)');
            $access = $this->ask('Git access: public-https or private-ssh', 'private-ssh');
            if (!in_array($access, ['public-https', 'private-ssh'], true)) throw new RuntimeException('Choose public-https or private-ssh.');
            $config['ssh_key'] = $access === 'private-ssh' ? $this->ask('Private SSH key path', "$account/.ssh/".basename($root).'_deploy') : '';
            $config['branch'] = $this->ask('Deployment branch', 'main');
            $config['workflow'] = $this->ask('CI workflow filename', 'ci.yml');
            $config['profile'] = $this->ask('Build profile: symfony-vite or vite-static', 'symfony-vite');
            if (!in_array($config['profile'], ['symfony-vite', 'vite-static'], true)) throw new RuntimeException('Use the build-profile guide for custom hooks.');
            $config['health_mode'] = $config['profile'] === 'symfony-vite' ? 'symfony' : 'static';
            $config['frontend_dir'] = $this->ask('Frontend directory relative to checkout', 'frontend');
            $config['frontend_output'] = $this->ask('Build output relative to frontend', 'dist');
            $config['node_bin_dir'] = $this->ask('Node/npm binary directory', '/opt/alt/alt-nodejs24/root/usr/bin');
            $config['composer_bin'] = '/usr/local/bin/composer';
            if ($config['profile'] === 'symfony-vite') {
                $config['backend_dir'] = $this->ask('Backend directory relative to checkout', 'backend');
                $config['composer_bin'] = $this->ask('Composer PHP executable/PHAR', '/usr/local/bin/composer');
            }
            new HostingDeployer($config); // Validate fields before asking for secrets.
            if (!is_executable($config['node_bin_dir'].'/node') || !is_executable($config['node_bin_dir'].'/npm')) {
                throw new RuntimeException('Node and npm must exist in the configured directory.');
            }
            if ($config['ssh_key'] !== '' && (!is_file($config['ssh_key']) || (fileperms($config['ssh_key']) & 0077) !== 0)) {
                throw new RuntimeException('SSH key must exist with owner-only permissions.');
            }
            $envPath = "$root/shared/.env.local";
            $examplePath = __DIR__.'/app.env.example';
            $needsEnv = $config['profile'] === 'symfony-vite'
                && (!is_file($envPath) || file_get_contents($envPath) === file_get_contents($examplePath));
            $env = null;
            if ($needsEnv) {
                $database = $this->ask('Full database name (including cPanel prefix)');
                $user = $this->ask('Full database user (may differ from database name)');
                $host = $this->ask('Database hostname', 'localhost');
                $port = $this->ask('Database port', '3306');
                if ($database === '' || $user === '' || !preg_match('/^[A-Za-z0-9.-]+$/D', $host)
                    || !ctype_digit($port) || (int)$port < 1 || (int)$port > 65535) throw new RuntimeException('Invalid database identifiers, hostname or port.');
                $password = $this->ask('Database password (hidden)', '', true);
                if ($password === '') throw new RuntimeException('Empty database password; nothing saved.');
                $url = 'mysql://'.rawurlencode($user).':'.rawurlencode($password).'@'.$host.':'.$port.'/'.rawurlencode($database).'?charset=utf8mb4';
                $env = "APP_ENV=prod\nAPP_DEBUG=0\nAPP_SECRET=".bin2hex(random_bytes(32))."\nDEFAULT_URI=".$config['url']."\nDATABASE_URL=\"$url\"\n";
            }
            $token = null;
            if (!is_file($config['token_file'])) {
                $token = $this->ask('GitHub Actions read token (hidden; required for both repository types)', '', true);
                if (!preg_match('/^[A-Za-z0-9_]+$/D', $token)) throw new RuntimeException('Empty or invalid token; nothing saved.');
            }
            foreach ([$envPath, $config['token_file']] as $path) {
                if (is_file($path) && (fileperms($path) & 0077) !== 0) throw new RuntimeException('Existing secret files must have owner-only permissions.');
            }
            // Save config last: an interrupted setup can be rerun and preserves saved secrets.
            if ($env !== null) $this->save($envPath, $env);
            if ($token !== null) $this->save($config['token_file'], "$token\n");
            $this->save($configPath, json_encode($config, JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR)."\n");
            echo "Saved private configuration. Existing credentials were preserved. Polling remains disabled.\n";
            echo "Document root: $root/current/public\n";
            echo 'Preflight: '.PHP_BINARY." $root/control/deploy.php $root/control/config.json check\n";
            echo "After a verified manual deployment, enable polling and add this cPanel cron command (every minute):\n";
            echo '/bin/bash '.$root.'/control/run.sh '.PHP_BINARY." poll\n";
        } finally {
            flock($lock, LOCK_UN);
            fclose($lock);
        }
    }
}

if (realpath($_SERVER['SCRIPT_FILENAME'] ?? '') === __FILE__) {
    umask(0077);
    try {
        if (PHP_SAPI !== 'cli' || !stream_isatty(STDIN) || count($argv) !== 2) {
            throw new RuntimeException('Run interactively: /actual/php configure.php /home/USER/apps/PROJECT (no secret arguments).');
        }
        (new HostingSetup($argv[1]))->run();
    } catch (Throwable $error) {
        // Validation errors never include submitted secret values.
        fwrite(STDERR, $error->getMessage()."\n");
        exit(1);
    }
}
