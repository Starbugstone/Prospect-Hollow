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
}
