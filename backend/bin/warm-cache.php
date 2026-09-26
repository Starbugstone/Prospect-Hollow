<?php
declare(strict_types=1);
if (PHP_SAPI !== 'cli') exit(1);
require dirname(__DIR__).'/vendor/autoload.php';
if (is_file(dirname(__DIR__).'/.env.local')) {
    (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__).'/.env.local');
}
$kernel = new App\Kernel('prod', false);
$kernel->boot();
$kernel->getContainer()->get('cache_warmer')->warmUp($kernel->getCacheDir());
$kernel->shutdown();
echo "Production cache ready.\n";
