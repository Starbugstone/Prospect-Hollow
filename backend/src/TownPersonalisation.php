<?php
declare(strict_types=1);
namespace App;

/** Bounded appearance data and optional, server-priced landmark purchases. */
final class TownPersonalisation
{
    public static function catalog(): array
    {
        static $catalog;
        return $catalog ??= json_decode(
            file_get_contents(dirname(__DIR__) . '/content/public-schema.json'),
            true,
            64,
            JSON_THROW_ON_ERROR,
        )['personalisation'];
    }
    private static function colour(mixed $value): bool
    {
        return is_string($value) && preg_match('/^#[0-9a-f]{6}$/iD', $value) === 1;
    }
    private static function colours(mixed $value, array $groups): object
    {
        $result = new \stdClass();
        if (!is_object($value)) {
            return $result;
        }
        foreach ($groups as $group) {
            if (self::colour($value->$group ?? null)) {
                $result->$group = strtolower($value->$group);
            }
        }
        return $result;
    }
    public static function normalize(mixed $saved, object $town, ?array $catalog = null): object
    {
        $c = $catalog ?? self::catalog();
        $saved = is_object($saved) ? $saved : new \stdClass();
        $result = (object) [
            'version' => 1,
            'crest' => null,
            'paint' => new \stdClass(),
            'clothing' => self::colours($saved->clothing ?? null, $c['clothing']),
            'choices' => new \stdClass(),
            'areas' => new \stdClass(),
            'areaLevels' => new \stdClass(),
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
            ];
        }
        foreach ($c['buildings'] as $id) {
            $paint = self::colours($saved->paint->$id ?? null, $c['paint']);
            if (count((array) $paint)) {
                $result->paint->$id = $paint;
            }
            if (isset($c['choices'][$id])) {
                $choice = $saved->choices->$id ?? null;
                if ($choice !== 'original' && in_array($choice, $c['choices'][$id], true)) {
                    $result->choices->$id = $choice;
                }
            }
            $plaque = $saved->plaques->$id ?? null;
            if (is_string($plaque) && preg_match('/^[a-z0-9-]{1,80}$/D', $plaque)) {
                $result->plaques->$id = $plaque;
            }
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
                    $level <= 3 * (count($c['eras']) - array_search($area['era'], $c['eras'], true))
                        ? $level
                        : 1);
            }
        }
        return $result;
    }
    /** An old client or a history restore cannot replace a settled design. */
    public static function keep(object $profile, ?object $previous): object
    {
        $town = $profile->town;
        $old = $previous
            ? self::normalize($previous->town->personalisation ?? null, $previous->town)
            : null;
        $p = self::normalize($town->personalisation ?? $old, $town);
        if ($old) {
            foreach (self::catalog()['choices'] as $id => $_choices) {
                $choice = $old->choices->$id ?? 'original';
                if (
                    ($previous->town->buildings->$id ?? 0) > 0 ||
                    isset($previous->town->projects->$id)
                ) {
                    if ($choice === 'original') {
                        unset($p->choices->$id);
                    } else {
                        $p->choices->$id = $choice;
                    }
                }
            }
        }
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
        if (
            $current &&
            ($area['timeless']
                ? $current === $choice
                : $current !== $choice || $stage >= 3 * (1 + $now - $intro))
        ) {
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
        $price =
            $definition['price'] * ($current && !$area['timeless'] ? 1 + intdiv($level - 1, 3) : 1);
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
        $p = self::normalize($town->personalisation ?? null, $town, $schema['personalisation']);
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
