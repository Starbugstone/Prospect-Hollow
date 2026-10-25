<?php
declare(strict_types=1);
namespace App;
/** Configuration values: Symfony's loaded $_ENV first, then the process environment. */
final class Env
{
    public static function get(string $name): string|false
    {
        return $_ENV[$name] ?? getenv($name);
    }
    /** The secret that signs sessions, save checkpoints and receipts: at least 32 bytes. */
    public static function appSecret(): string
    {
        $secret = self::get('APP_SECRET');
        if (!is_string($secret) || strlen($secret) < 32) {
            throw new \RuntimeException('APP_SECRET must be at least 32 bytes.');
        }
        return $secret;
    }
}
