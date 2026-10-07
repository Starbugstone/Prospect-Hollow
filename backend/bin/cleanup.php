<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') {
    exit(1);
}
require dirname(__DIR__) . '/vendor/autoload.php';
if (is_file(dirname(__DIR__) . '/.env.local')) {
    (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__) . '/.env.local');
}
$db = (new App\Database())->get();
$db->executeStatement('DELETE FROM limits WHERE until_at<?', [time()]);
$db->executeStatement('DELETE FROM login_intents WHERE expires_at<?', [time()]);
$db->executeStatement('DELETE FROM sessions WHERE expires_at<?', [time()]);
$db->executeStatement('DELETE FROM towns WHERE deleted_at IS NOT NULL AND deleted_at<?', [
    time() - 30 * 86400,
]);
$db->executeStatement('DELETE FROM admin_sessions WHERE expires_at<? OR used_at<?', [
    time(),
    time() - 3600,
]);
// Space-helmet finds are redeemed within this window and only rest the finder for 12 hours.
$db->executeStatement('DELETE FROM helmet_finds WHERE found_at<?', [
    time() - App\PublicTown::HELMET_KEEP,
]);
// Daily active-player marks feed the admin charts; keep 90 days.
$db->executeStatement('DELETE FROM activity_days WHERE day<?', [intdiv(time(), 86400) - 90]);
// The admin activity log keeps its retention (three months unless changed in the panel).
App\AdminService::expireAudit($db);
echo "Expired credentials, rate buckets and old activity log entries removed.\n";
