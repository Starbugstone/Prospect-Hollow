<?php
declare(strict_types=1);
namespace App;

/** Bounded appearance data and optional, server-priced landmark purchases. */
final class TownPersonalisation
{
    /**
     * The sites the game sold before purchase receipts carried a `monumentVersion`
     * (2026-10-06 to 2026-10-08, preprod only): unversioned receipts can come from them
     * alone. Historical and fixed; a site added later never joins it.
     */
    private const UNVERSIONED_SITES = [
        'meadow',
        'monument',
        'motor-court',
        'arts-court',
        'horizon',
        'light-court',
        'stargazer-lawn',
        'homecoming-green',
    ];
    public static function catalog(): array
    {
        return PublicTown::schema()['personalisation'];
    }
    private static function colour(mixed $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9a-f]{6}$/iD', $value) === 1;
    }
    public static function normalize(mixed $saved, ?array $catalog = null): object
    {
        $c = $catalog ?? self::catalog();
        $saved = is_object($saved) ? $saved : new \stdClass();
        $result = (object) [
            'version' => 3,
            'crest' => null,
            'areas' => new \stdClass(),
            'areaLevels' => new \stdClass(),
            'construction' => new \stdClass(),
            'plaques' => new \stdClass(),
        ];
        $crest = $saved->crest ?? null;
        if (
            is_object($crest) &&
            in_array($crest->shape ?? null, $c['shapes'], true) &&
            in_array($crest->pattern ?? null, $c['patterns'], true) &&
            in_array($crest->emblem ?? null, $c['emblems'], true) &&
            self::colour($crest->primary ?? null) &&
            self::colour($crest->secondary ?? null)
        ) {
            $result->crest = (object) [
                'shape' => $crest->shape,
                'pattern' => $crest->pattern,
                'emblem' => $crest->emblem,
                'primary' => strtolower($crest->primary),
                'secondary' => strtolower($crest->secondary),
                'emblemColour' => self::colour($crest->emblemColour ?? null)
                    ? strtolower($crest->emblemColour)
                    : $c['defaultEmblemColour'],
            ];
        }
        // Keep only the mine display; retired palettes/frontages never return on reload.
        $plaque = $saved->plaques->mine ?? null;
        if (is_string($plaque) && preg_match('/^[a-z0-9-]{1,80}$/D', $plaque)) {
            $result->plaques->mine = $plaque;
        }
        foreach ($c['areas'] as $area) {
            $id = $area['id'];
            $slots = $saved->areas->$id ?? null;
            $valid = array_map(
                fn($slot) => is_array($slots) &&
                in_array($slots[$slot] ?? null, $area['choices'], true)
                    ? $slots[$slot]
                    : null,
                array_keys($area['positions']),
            );
            if (array_filter($valid)) {
                $result->areas->$id = $valid;
                $level = $saved->areaLevels->$id ?? 1;
                $result->areaLevels->$id = $area['timeless']
                    ? 1
                    : (is_int($level) &&
                    $level >= 1 &&
                    $level <= $c['monumentProgression']['legacyLimit']
                        ? $level
                        : 1);
                // Cosmetic construction of the latest paid level, as the client keeps it.
                // Progress past a shortened build stays ready to unveil.
                $shown = $result->areaLevels->$id;
                $levels = $c['monumentProgression']['levels'];
                $work = $saved->construction->$id ?? null;
                if (
                    is_object($work) &&
                    ($work->level ?? null) === $shown &&
                    $shown <= ($area['timeless'] ? 1 : count($levels)) &&
                    is_int($work->wins ?? null) &&
                    $work->wins >= 0
                ) {
                    $result->construction->$id = (object) [
                        'level' => $shown,
                        'wins' => min($work->wins, $levels[$shown - 1]['puzzles']),
                    ];
                }
            }
        }
        return $result;
    }
    /** Preserve supported appearance when an old client omits it. */
    public static function keep(object $profile, ?object $previous): object
    {
        $town = $profile->town;
        $old = $previous ? self::normalize($previous->town->personalisation ?? null) : null;
        $p = self::normalize($town->personalisation ?? $old);
        $town->personalisation = $p;
        return $profile;
    }
    /**
     * Whether a site's `opens` is met, as areaOpensMet in townLandmarks.js: a finished
     * building level, or a stage paid for at any one of several sites. Both only ever rise,
     * so an open site never closes. An opening this server does not know stays closed.
     *
     * @param array<string, mixed> $town
     * @param array<string, mixed> $catalog
     */
    public static function opens(array $town, mixed $opens, array $catalog): bool
    {
        if ($opens === null) {
            return true;
        }
        if (!is_array($opens) || !is_int($opens['level'] ?? null)) {
            return false;
        }
        if (is_string($opens['building'] ?? null)) {
            return ($town['buildings'][$opens['building']] ?? 0) >= $opens['level'];
        }
        if (!is_array($opens['sites'] ?? null)) {
            return false;
        }
        foreach ($opens['sites'] as $site) {
            if (is_string($site) && self::boughtLevel($town, $site, $catalog) >= $opens['level']) {
                return true;
            }
        }
        return false;
    }
    /**
     * The stage paid for at a site, 0 until a valid design is bought, as areaBoughtLevel.
     *
     * @param array<string, mixed> $town
     * @param array<string, mixed> $catalog
     */
    private static function boughtLevel(array $town, string $id, array $catalog): int
    {
        $choice = $town['personalisation']['areas'][$id][0] ?? null;
        foreach ($catalog['areas'] as $area) {
            if ($area['id'] === $id && in_array($choice, $area['choices'], true)) {
                $level = $town['personalisation']['areaLevels'][$id] ?? 1;
                return is_int($level) && $level >= 1 ? $level : 1;
            }
        }
        return 0;
    }
    /** Replay a purchase against server-owned prices; return null for stale/invalid commands. */
    public static function purchase(array $town, array $command, array $eraOrder): ?array
    {
        $catalog = self::catalog();
        $id = $command['id'] ?? null;
        $choice = $command['value'] ?? null;
        if (!is_string($id) || !is_string($choice) || ($command['slot'] ?? null) !== 0) {
            return null;
        }
        $area = null;
        foreach ($catalog['areas'] as $candidate) {
            if ($candidate['id'] === $id) {
                $area = $candidate;
            }
        }
        if (
            !$area ||
            !in_array($area['currency'] ?? 'coins', ['coins', 'moonstones'], true) ||
            !in_array($choice, $area['choices'], true)
        ) {
            return null;
        }
        $now = array_search($town['era'], $eraOrder, true);
        $intro = array_search($area['era'], $eraOrder, true);
        if ($now === false || $intro === false || $now < $intro) {
            return null;
        }
        if (!self::opens($town, $area['opens'] ?? null, $catalog)) {
            return null;
        }
        $current = $town['personalisation']['areas'][$id][0] ?? null;
        $stage = $current ? $town['personalisation']['areaLevels'][$id] ?? 1 : 0;
        if (
            ($command['expectedChoice'] ?? null) !== $current ||
            ($command['expectedLevel'] ?? null) !== $stage
        ) {
            return null;
        }
        // Unversioned offline receipts retain the original prices and era ceilings, at the
        // sites that sold on those terms.
        $version = $command['monumentVersion'] ?? 1;
        $progression = $catalog['monumentProgression'];
        if (
            !in_array($version, [1, 2, $progression['version']], true) ||
            ($version === 1 && !in_array($id, self::UNVERSIONED_SITES, true))
        ) {
            return null;
        }
        // No terms raise a site past its progression; old terms also kept their era ceiling.
        $length = $area['timeless'] ? 1 : count($progression['levels']);
        $maximum = $version === 1 ? min($length, 1 + $now - $intro) : $length;
        // A site keeps its first monument; timeless masterpieces are complete.
        if ($current && ($area['timeless'] || $current !== $choice || $stage >= $maximum)) {
            return null;
        }
        $level = $area['timeless'] ? 1 : $stage + 1;
        $definition = null;
        foreach ($catalog['landmarks'] as $candidate) {
            if ($candidate['id'] === $choice) {
                $definition = $candidate;
            }
        }
        if (!$definition) {
            return null;
        }
        $multiplier =
            $version === 1 || $area['timeless']
                ? $level
                : $progression['levels'][$level - 1]['multiplier'];
        $price = $definition['price'] * $multiplier;
        // The exported explicit schedule applies only to current terms. Version 2
        // outbox entries keep their historical base prices and multiplier curve.
        if ($version === $progression['version'] && array_key_exists('levelPrices', $area)) {
            $prices = $area['levelPrices'];
            if (
                !is_array($prices) ||
                !array_is_list($prices) ||
                count($prices) !== ($area['timeless'] ? 1 : count($progression['levels']))
            ) {
                return null;
            }
            foreach ($prices as $amount) {
                if (!is_int($amount) || $amount < 0 || $amount > JsonNumber::MAX_SAFE_INTEGER) {
                    return null;
                }
            }
            $price = $prices[$level - 1];
        }
        $currency = $area['currency'] ?? 'coins';
        // New resource sites never replay the historical coin-only pricing model.
        // Receipt terms are evidence, never an authority over the exported catalog.
        if (
            ($currency !== 'coins' && $version === 1) ||
            (array_key_exists('currency', $command) && $command['currency'] !== $currency) ||
            (array_key_exists('price', $command) && $command['price'] !== $price) ||
            ($town[$currency] ?? 0) < $price
        ) {
            return null;
        }
        $town[$currency] -= $price;
        $town['personalisation']['areas'][$id] = [$choice];
        $town['personalisation']['areaLevels'][$id] = $level;
        return $town;
    }
    public static function publish(object $town, ?object $honours, array $schema): object
    {
        $p = self::normalize($town->personalisation ?? null, $schema['personalisation']);
        foreach ($p->plaques as $id => $plaque) {
            if (
                !isset($honours->earned->$plaque) &&
                !isset($schema['honours']['playerDistinctions'][$plaque])
            ) {
                unset($p->plaques->$id);
            }
        }
        return $p;
    }
}
