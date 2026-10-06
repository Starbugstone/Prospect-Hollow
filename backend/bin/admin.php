<?php
declare(strict_types=1);
// Server-side admin account management: create the first admin, or recover a locked-out one.
// Also grants event player distinctions (docs/honours.md), such as Beta Player.
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require dirname(__DIR__) . '/vendor/autoload.php';
if (is_file(dirname(__DIR__) . '/.env.local')) {
    (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__) . '/.env.local');
}
$database = new App\Database();
$auth = new App\Auth($database);
$admins = new App\AdminAuth($database, $auth);
[$command, $username] = [$argv[1] ?? '', $argv[2] ?? ''];
$temporary = function (array $result) use ($auth): void {
    echo "Temporary password for {$result['username']} (shown once): {$result['password']}\n";
    echo 'Sign in at ' . $auth->origin() . "/admin, then choose a new password.\n";
};
try {
    match ($command) {
        'list' => array_map(
            fn($a) => printf(
                "%-32s %s%s\n",
                $a['username'],
                $a['authenticator'] ? 'authenticator on' : 'authenticator not set up',
                $a['mustChangePassword'] ? ', must change password' : '',
            ),
            $admins->all(),
        ),
        'create' => $temporary($admins->create(App\AdminAuth::SERVER, $username)),
        'reset-password' => $temporary(
            $admins->resetPassword(App\AdminAuth::SERVER, $admins->find($username)['id']),
        ),
        'reset-authenticator' => $admins->resetAuthenticator(
            App\AdminAuth::SERVER,
            $admins->find($username)['id'],
        ) &&
            (print "Authenticator removed for $username. They set up a new one at their next sign-in.\n"),
        'delete' => $admins->delete(App\AdminAuth::SERVER, $admins->find($username)['id']) &&
            (print "Admin $username deleted.\n"),
        // Every current account, or one player ID; a player who holds it keeps the first date.
        'award-distinction' => printf(
            "%s granted to %d player(s).\n",
            $username,
            App\PlayerDistinctions::load()->award($database->get(), $username, $argv[3] ?? null),
        ),
        default => throw new InvalidArgumentException(
            'Usage: php bin/admin.php list | create USERNAME | reset-password USERNAME | reset-authenticator USERNAME | delete USERNAME | award-distinction DISTINCTION_ID [PLAYER_ID]',
        ),
    };
} catch (App\ApiError $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(1);
} catch (InvalidArgumentException $e) {
    fwrite(STDERR, $e->getMessage() . "\n");
    exit(2);
}
