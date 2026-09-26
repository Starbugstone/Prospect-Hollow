<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit(1);
require dirname(__DIR__).'/vendor/autoload.php';
if (is_file(dirname(__DIR__).'/.env.local')) (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__).'/.env.local');
$db=(new App\Database())->get();
$db->executeStatement('DELETE FROM limits WHERE until_at<?',[time()]);
$db->executeStatement('DELETE FROM login_intents WHERE expires_at<?',[time()]);
$db->executeStatement('DELETE FROM sessions WHERE expires_at<?',[time()]);
$db->executeStatement('DELETE FROM towns WHERE deleted_at IS NOT NULL AND deleted_at<?',[time()-30*86400]);
echo "Expired credentials and rate buckets removed.\n";
