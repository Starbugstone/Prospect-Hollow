<?php
declare(strict_types=1);
namespace App;

/** Bounded appearance data and optional, server-priced landmark purchases. */
final class TownPersonalisation
{
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
        if (!$area || !in_array($choice, $area['choices'], true)) {
            return null;
        }
        $now = array_search($town['era'], $eraOrder, true);
        $intro = array_search($area['era'], $eraOrder, true);
        if ($now === false || $intro === false || $now < $intro) {
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
        // Unversioned offline receipts retain the original prices and era ceilings.
        $version = $command['monumentVersion'] ?? 1;
        $progression = $catalog['monumentProgression'];
        if (!in_array($version, [1, $progression['version']], true)) {
            return null;
        }
        $maximum = $version === 1 ? 1 + $now - $intro : count($progression['levels']);
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
        if ($town['coins'] < $price) {
            return null;
        }
        $town['coins'] -= $price;
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
