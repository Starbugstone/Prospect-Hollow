<?php
declare(strict_types=1);
namespace App;

/** Numbers as saves and the game store them in JSON. */
final class JsonNumber
{
    /** Number.MAX_SAFE_INTEGER: the largest whole number JSON keeps exactly in the game. */
    public const MAX_SAFE_INTEGER = 9007199254740991;

    /** A finite number of at least $min, as a decoded JSON number. */
    public static function finite(mixed $value, float $min = 0): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min;
    }
}
