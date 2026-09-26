<?php
declare(strict_types=1);
if (PHP_SAPI!=='cli') exit(1);
try {
    require dirname(__DIR__).'/vendor/autoload.php';
    if (is_file(dirname(__DIR__).'/.env.local')) (new Symfony\Component\Dotenv\Dotenv())->load(dirname(__DIR__).'/.env.local');
    (new App\Database())->get()->fetchOne('SELECT 1');
    exit(0);
} catch (\Throwable) { fwrite(STDERR,"Database unavailable.\n"); exit(1); }
