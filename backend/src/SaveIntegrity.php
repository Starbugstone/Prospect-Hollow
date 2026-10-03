<?php
declare(strict_types=1);
namespace App;

/**
 * Replays the economy journal when a cloud town has an authoritative checkpoint.
 * Puzzle measurements are claims, not proof that a puzzle was played. Historical
 * saves are accepted once as migration baselines. Money plausibility is observed
 * separately by default; it is an estimate, not an earnings or move allowance.
 */
final class SaveIntegrity
{
    private array $rules;
    private const CLOCK_SKEW_MS = 300000;
    public function __construct(?array $rules = null)
    {
        if ($rules === null) {
            $path = dirname(__DIR__) . '/content/save-rules.json';
            $rules = is_file($path)
                ? json_decode(file_get_contents($path), true, 64, JSON_THROW_ON_ERROR)
                : [];
        }
        $this->rules = $rules;
    }
    private static function invalid(string $field): never
    {
        throw new ApiError(
            422,
            'This save contains incompatible progress. Your local copy and the last cloud save are safe.',
            ['code' => 'save_integrity_invalid', 'field' => $field],
        );
    }
    private static function incompatible(): never
    {
        throw new ApiError(
            422,
            'This town needs compatible game rules before it can sync. Your local copy and the last cloud save are safe.',
            ['code' => 'save_rules_unsupported'],
        );
    }
    private static function mismatch(string $field): never
    {
        throw new ApiError(
            422,
            'This progress could not be reconciled with its cloud checkpoint. Your local copy and the last cloud save are safe.',
            ['code' => 'save_integrity_mismatch', 'field' => $field],
        );
    }
    private function ready(): void
    {
        foreach (
            [
                'eraOrder',
                'eras',
                'buildings',
                'powers',
                'rewards',
                'shop',
                'levels',
                'chapters',
                'economy',
                'defaultProfile',
            ]
            as $key
        ) {
            if (!isset($this->rules[$key])) {
                self::incompatible();
            }
        }
        if (
            ($this->rules['version'] ?? null) !== 1 ||
            !self::integer($this->rules['eraBuildingLevels'] ?? null, 1)
        ) {
            self::incompatible();
        }
        foreach ($this->rules['eraOrder'] as $id) {
            if (!is_string($id) || !is_array($this->rules['eras'][$id] ?? null)) {
                self::incompatible();
            }
            $era = $this->rules['eras'][$id];
            foreach (
                ['enabled', 'style', 'incident', 'waterworks', 'farmCapacity', 'buildingOffers']
                as $key
            ) {
                if (!array_key_exists($key, $era)) {
                    self::incompatible();
                }
            }
            if (
                !is_bool($era['enabled']) ||
                !is_array($era['waterworks']) ||
                !is_array($era['farmCapacity']) ||
                !is_array($era['buildingOffers'])
            ) {
                self::incompatible();
            }
        }
        foreach ($this->rules['levels'] as $level) {
            if (!is_array($level)) {
                self::incompatible();
            }
            if (!array_key_exists('compatibleTargets', $level)) {
                continue;
            }
            if (!is_array($level['compatibleTargets'])) {
                self::incompatible();
            }
            foreach ($level['compatibleTargets'] as $targets) {
                if (!is_array($targets)) {
                    self::incompatible();
                }
                foreach (['chestTarget', 'starScoreTarget', 'speedTargetMs'] as $field) {
                    if (!self::number($targets[$field] ?? null)) {
                        self::incompatible();
                    }
                }
            }
        }
    }
    private static function integer(mixed $value, int $min = 0, int $max = 9007199254740991): bool
    {
        return is_int($value) && $value >= $min && $value <= $max;
    }
    private static function number(mixed $value, float $min = 0): bool
    {
        return (is_int($value) || is_float($value)) && is_finite((float) $value) && $value >= $min;
    }
    private static function associative(mixed $value): bool
    {
        return is_array($value) && ($value === [] || !array_is_list($value));
    }
    private static function arrayOf(object $value): array
    {
        return json_decode(json_encode($value, JSON_THROW_ON_ERROR), true, 64, JSON_THROW_ON_ERROR);
    }
    private static function canonical(mixed $value): mixed
    {
        if (!is_array($value)) {
            return $value;
        }
        if (!array_is_list($value)) {
            ksort($value);
        }
        foreach ($value as &$entry) {
            $entry = self::canonical($entry);
        }
        return $value;
    }
    private static function same(mixed $a, mixed $b): bool
    {
        return json_encode(self::canonical($a), JSON_THROW_ON_ERROR) ===
            json_encode(self::canonical($b), JSON_THROW_ON_ERROR);
    }
    private static function difference(mixed $expected, mixed $actual, string $path): string
    {
        if (is_array($expected) && is_array($actual)) {
            foreach (array_unique([...array_keys($expected), ...array_keys($actual)]) as $key) {
                if (!array_key_exists($key, $expected) || !array_key_exists($key, $actual)) {
                    return $path . '.' . $key;
                }
                if (!self::same($expected[$key], $actual[$key])) {
                    return self::difference($expected[$key], $actual[$key], $path . '.' . $key);
                }
            }
        }
        return $path;
    }
    /** Validate catalog IDs and actual storage/progression ranges, including old tiers. */
    public function validate(object $profile): void
    {
        $this->ready();
        $p = self::arrayOf($profile);
        $town = $p['town'] ?? null;
        if (
            !is_array($town) ||
            !self::associative($town['buildings'] ?? null) ||
            !is_string($town['era'] ?? null) ||
            !is_array($p['powers'] ?? null) ||
            !self::associative($p['records'] ?? null) ||
            !self::associative($p['continuousRecords'] ?? null)
        ) {
            self::invalid('profile');
        }
        if (!self::integer($town['coins'] ?? null)) {
            self::invalid('town.coins');
        }
        if (
            !isset($this->rules['eras'][$town['era']]) ||
            !$this->rules['eras'][$town['era']]['enabled']
        ) {
            self::incompatible();
        }
        foreach ($town['buildings'] as $id => $level) {
            $definition = $this->rules['buildings'][$id] ?? null;
            if (!$definition) {
                self::incompatible();
            }
            $maximum = empty($town['progressionVersion'])
                ? $definition['legacyMaxLevel']
                : $definition['maxLevel'];
            if (!self::integer($level, 0, $maximum)) {
                self::invalid('town.buildings.' . $id);
            }
        }
        foreach (['buildingEras', 'buildingEraLevels', 'projects'] as $key) {
            if (array_key_exists($key, $town) && !self::associative($town[$key])) {
                self::invalid('town.' . $key);
            }
        }
        foreach ($town['buildingEras'] ?? [] as $id => $era) {
            if (!is_string($era)) {
                self::invalid('town.buildingEras.' . $id);
            }
            if (!isset($this->rules['buildings'][$id], $this->rules['eras'][$era])) {
                self::incompatible();
            }
            if ($this->eraIndex($era) > $this->eraIndex($town['era'])) {
                self::invalid('town.buildingEras.' . $id);
            }
        }
        foreach ($town['buildingEraLevels'] ?? [] as $id => $level) {
            if (!isset($this->rules['buildings'][$id])) {
                self::incompatible();
            }
            if (!self::integer($level, 0, $this->rules['eraBuildingLevels'])) {
                self::invalid('town.buildingEraLevels.' . $id);
            }
        }
        $powerIds = [];
        foreach ($p['powers'] as $power) {
            if (
                !is_array($power) ||
                !is_string($power['id'] ?? null) ||
                !self::integer($power['quantity'] ?? null)
            ) {
                self::invalid('powers');
            }
            $id = $power['id'] === 'hammer' ? 'tnt' : $power['id'];
            if (!in_array($id, $this->rules['powers'], true)) {
                self::incompatible();
            }
            if (isset($powerIds[$id])) {
                self::invalid('powers');
            }
            $powerIds[$id] = true;
        }
        foreach (
            ['builderHammers', 'issuedRun', 'settledRun', 'shopVisit', 'chestsWithoutBuilderHammer']
            as $key
        ) {
            if (array_key_exists($key, $p) && !self::integer($p[$key])) {
                self::invalid($key);
            }
        }
        if (($p['settledRun'] ?? 0) > ($p['issuedRun'] ?? 0)) {
            self::invalid('settledRun');
        }
        foreach (['completedRuns', 'saloonVisitAt'] as $key) {
            if (array_key_exists($key, $town) && !self::integer($town[$key])) {
                self::invalid('town.' . $key);
            }
        }
        foreach (['records', 'continuousRecords'] as $key) {
            foreach ($p[$key] as $id => $record) {
                if (!isset($this->rules['levels'][$id])) {
                    self::incompatible();
                }
                if (!is_array($record)) {
                    self::invalid($key . '.' . $id);
                }
                if (isset($record['score']) && !self::number($record['score'])) {
                    self::invalid($key . '.' . $id . '.score');
                }
                if ($key === 'records' && !self::integer($record['stars'] ?? null, 1, 3)) {
                    self::invalid('records.' . $id . '.stars');
                }
                if (
                    isset($record['bestTimeMs']) &&
                    !self::number($record['bestTimeMs'], 0.000001)
                ) {
                    self::invalid('records.' . $id . '.bestTimeMs');
                }
                if (
                    $key === 'continuousRecords' &&
                    !self::integer(
                        $record['coins'] ?? null,
                        0,
                        $this->rules['rewards']['continuousCoinCap'],
                    )
                ) {
                    self::invalid('continuousRecords.' . $id . '.coins');
                }
            }
        }
        foreach ($town['projects'] ?? [] as $id => $project) {
            if (!isset($this->rules['buildings'][$id])) {
                self::incompatible();
            }
            if (
                !is_array($project) ||
                ($project['id'] ?? null) !== $id ||
                !self::integer($project['stage'] ?? null, 1) ||
                !self::integer($project['required'] ?? null, 1, 5) ||
                !self::integer($project['wins'] ?? null, 0, $project['required'])
            ) {
                self::invalid('town.projects.' . $id);
            }
            if (($project['type'] ?? null) === 'modernization') {
                foreach (['fromEra', 'targetEra'] as $key) {
                    if (!is_string($project[$key] ?? null)) {
                        self::invalid('town.projects.' . $id . '.' . $key);
                    }
                    if (!isset($this->rules['eras'][$project[$key]])) {
                        self::incompatible();
                    }
                }
            } elseif (
                $project['stage'] !== ($town['buildings'][$id] ?? 0) + 1 ||
                $project['stage'] > $this->rules['buildings'][$id]['legacyMaxLevel']
            ) {
                self::invalid('town.projects.' . $id . '.stage');
            }
        }
        if (array_key_exists('pendingChests', $p) && !is_array($p['pendingChests'])) {
            self::invalid('pendingChests');
        }
        $sources = [];
        foreach ($p['pendingChests'] ?? [] as $chest) {
            if (
                !is_array($chest) ||
                !is_string($chest['id'] ?? null) ||
                !self::integer($chest['runId'] ?? null, 1) ||
                $chest['runId'] !== ($p['settledRun'] ?? 0) ||
                !in_array($chest['source'] ?? null, ['completion', 'score', 'speed'], true) ||
                !self::integer($chest['levelId'] ?? null, 1) ||
                !isset($this->rules['levels'][$chest['levelId']]) ||
                !in_array($chest['economyVersion'] ?? 1, [1, 2], true) ||
                !is_array($chest['items'] ?? null) ||
                count($chest['items']) !== 1 ||
                !is_array($chest['items'][0] ?? null) ||
                !is_string($chest['items'][0]['id'] ?? null) ||
                !$this->reward(
                    $chest['items'][0]['id'],
                    (int) $chest['levelId'],
                    (int) ($chest['economyVersion'] ?? 1),
                )
            ) {
                self::invalid('pendingChests');
            }
            $key = $chest['runId'] . '-' . $chest['source'];
            if (isset($sources[$key])) {
                self::invalid('pendingChests');
            }
            $sources[$key] = true;
        }
        if (array_key_exists('income', $town)) {
            if (!is_array($town['income'])) {
                self::invalid('town.income');
            }
            foreach (['stored', 'remainder'] as $key) {
                if (!self::integer($town['income'][$key] ?? null)) {
                    self::invalid('town.income.' . $key);
                }
            }
            if (($town['income']['at'] ?? null) !== null && !self::integer($town['income']['at'])) {
                self::invalid('town.income.at');
            }
            if ($town['income']['remainder'] >= $this->rules['economy']['hourMs']) {
                self::invalid('town.income.remainder');
            }
        }
        if (
            array_key_exists('forge', $town) &&
            (!is_array($town['forge']) ||
                !self::integer($town['forge']['progress'] ?? null, 0, 19) ||
                !self::integer($town['forge']['charge'] ?? null, 0, 1))
        ) {
            self::invalid('town.forge');
        }
        if (array_key_exists('events', $town) && !self::associative($town['events'])) {
            self::invalid('town.events');
        }
        foreach ($town['events'] ?? [] as $event) {
            if (
                !is_array($event) ||
                !self::integer($event['id'] ?? null, 1) ||
                !self::integer($event['loss'] ?? null) ||
                !self::integer($event['gangSize'] ?? null, 1) ||
                !self::integer($event['sheriffLevel'] ?? null) ||
                !is_bool($event['seen'] ?? null)
            ) {
                self::invalid('town.events');
            }
        }
        if (array_key_exists('shopStock', $p)) {
            if (!is_array($p['shopStock'])) {
                self::invalid('shopStock');
            }
            $ids = [];
            foreach ($p['shopStock'] as $offer) {
                if (
                    !is_array($offer) ||
                    !is_string($offer['id'] ?? null) ||
                    !in_array($offer['id'], $this->rules['powers'], true) ||
                    !is_bool($offer['sold'] ?? null) ||
                    isset($ids[$offer['id']])
                ) {
                    self::invalid('shopStock');
                }
                $ids[$offer['id']] = true;
            }
        }
        if (
            array_key_exists('vipReceipts', $p) &&
            (!is_array($p['vipReceipts']) ||
                array_filter($p['vipReceipts'], fn($key) => !is_string($key) || strlen($key) > 160))
        ) {
            self::invalid('vipReceipts');
        }
        if (array_key_exists('lastCollections', $town)) {
            if (!self::associative($town['lastCollections'])) {
                self::invalid('town.lastCollections');
            }
            foreach ($town['lastCollections'] as $id => $at) {
                if (
                    !array_key_exists(
                        $id,
                        $this->rules['defaultProfile']['town']['lastCollections'],
                    )
                ) {
                    self::incompatible();
                }
                if ($at !== null && !self::integer($at)) {
                    self::invalid('town.lastCollections.' . $id);
                }
            }
        }
        if (
            array_key_exists('nextRaidRun', $town) &&
            $town['nextRaidRun'] !== null &&
            !self::integer($town['nextRaidRun'])
        ) {
            self::invalid('town.nextRaidRun');
        }
    }
    private function eraIndex(string $id): int
    {
        $index = array_search($id, $this->rules['eraOrder'], true);
        return $index === false ? -1 : $index;
    }
    private function normalized(array $profile): array
    {
        $defaults = $this->rules['defaultProfile'];
        $p = array_replace($defaults, $profile);
        $p['town'] = array_replace($defaults['town'], $profile['town']);
        foreach (['buildings', 'buildingEras', 'buildingEraLevels', 'lastCollections'] as $key) {
            $p['town'][$key] = array_replace($defaults['town'][$key], $profile['town'][$key] ?? []);
        }
        foreach ($this->rules['buildings'] as $id => $building) {
            $p['town']['buildings'][$id] = min(
                $building['maxLevel'],
                $p['town']['buildings'][$id] ?? 0,
            );
        }
        if (empty($profile['town']['progressionVersion'])) {
            foreach ($p['town']['projects'] as $id => $project) {
                $building = $this->rules['buildings'][$id];
                if ($building['legacyMaxLevel'] === $building['maxLevel']) {
                    continue;
                }
                if (($project['type'] ?? null) === 'modernization') {
                    $p['town']['projects'][$id]['stage'] = min(
                        $project['stage'],
                        $building['maxLevel'],
                    );
                } elseif (
                    $project['stage'] > $building['maxLevel'] &&
                    $project['stage'] <= $building['legacyMaxLevel'] &&
                    $project['stage'] === ($profile['town']['buildings'][$id] ?? 0) + 1 &&
                    $project['required'] === 1 &&
                    self::integer($project['wins'], 0, 1)
                ) {
                    $p['town']['coins'] = (int) min(
                        9007199254740991,
                        $p['town']['coins'] +
                            ($building['legacyUpgradeCosts'][$project['stage'] - 1] ?? 0),
                    );
                    unset($p['town']['projects'][$id]);
                }
            }
        }
        $powers = array_fill_keys($this->rules['powers'], 0);
        foreach ($profile['powers'] ?? [] as $power) {
            $powers[$power['id'] === 'hammer' ? 'tnt' : $power['id']] = $power['quantity'];
        }
        $overflow = max(0, $p['builderHammers'] - $this->rules['rewards']['hammerCapacity']);
        $p['builderHammers'] = min($p['builderHammers'], $this->rules['rewards']['hammerCapacity']);
        $capacity = $this->powerCapacity($p['town']);
        foreach ($powers as &$quantity) {
            $overflow += max(0, $quantity - $capacity);
            $quantity = min($quantity, $capacity);
        }
        unset($quantity);
        $p['town']['coins'] = (int) min(
            9007199254740991,
            $p['town']['coins'] + $overflow * $this->rules['rewards']['overflowCoins'],
        );
        $p['powers'] = $powers;
        $p['chestsWithoutBuilderHammer'] = min(9, $p['chestsWithoutBuilderHammer']);
        $this->settleForge($p['town']);
        return $p;
    }
    private function protected(array $p): array
    {
        $top = [
            'records',
            'continuousRecords',
            'builderHammers',
            'chestsWithoutBuilderHammer',
            'issuedRun',
            'settledRun',
            'shopVisit',
            'vipReceipts',
        ];
        $result = [];
        foreach ($top as $key) {
            $result[$key] = $p[$key];
        }
        $result['powers'] = $p['powers'];
        foreach ($result['records'] as &$record) {
            $record = array_intersect_key($record, array_flip(['score', 'stars', 'bestTimeMs']));
        }
        foreach ($result['continuousRecords'] as &$record) {
            $record = array_intersect_key($record, array_flip(['score', 'coins']));
        }
        $result['shopStock'] = array_map(
            fn($offer) => ['id' => $offer['id'], 'sold' => $offer['sold'] === true],
            $p['shopStock'],
        );
        $result['pendingChests'] = array_map(
            fn($chest) => [
                'id' => $chest['id'],
                'runId' => $chest['runId'],
                'source' => $chest['source'],
                'levelId' => $chest['levelId'],
                'economyVersion' => $chest['economyVersion'] ?? 1,
                'rewardId' => $chest['items'][0]['id'],
            ],
            $p['pendingChests'],
        );
        foreach (
            [
                'coins',
                'era',
                'buildings',
                'buildingEras',
                'buildingEraLevels',
                'projects',
                'completedRuns',
                'forge',
                'saloonVisitAt',
                'income',
                'lastCollections',
                'events',
                'nextRaidRun',
            ]
            as $key
        ) {
            $result['town'][$key] = $p['town'][$key];
        }
        return $result;
    }
    private function journal(mixed $value): ?array
    {
        if ($value === null) {
            return null;
        }
        if (
            is_array($value) &&
            self::integer($value['version'] ?? null, 1) &&
            $value['version'] !== 1
        ) {
            throw new ApiError(
                422,
                'This journal needs a compatible game version before it can sync. Your local copy and the last cloud save are safe.',
                ['code' => 'save_integrity_unsupported'],
            );
        }
        if (
            !is_array($value) ||
            ($value['version'] ?? null) !== 1 ||
            !is_string($value['epoch'] ?? null) ||
            !preg_match(
                '/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',
                $value['epoch'],
            ) ||
            !self::integer($value['baseSequence'] ?? null) ||
            !is_array($value['actions'] ?? null)
        ) {
            self::invalid('integrity');
        }
        $sequence = $value['baseSequence'];
        $ids = [];
        foreach ($value['actions'] as $action) {
            if (
                !is_array($action) ||
                !self::integer($action['sequence'] ?? null, 1) ||
                $action['sequence'] !== $sequence + 1 ||
                !is_string($action['id'] ?? null) ||
                !preg_match(
                    '/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D',
                    $action['id'],
                ) ||
                isset($ids[$action['id']]) ||
                !is_string($action['kind'] ?? null) ||
                !is_array($action['data'] ?? null)
            ) {
                self::invalid('integrity.actions');
            }
            $sequence = $action['sequence'];
            $ids[$action['id']] = true;
        }
        return $value;
    }
    public static function receipt(object $profile): ?array
    {
        $journal = $profile->integrity ?? null;
        if (!($journal instanceof \stdClass) || ($journal->version ?? null) !== 1) {
            return null;
        }
        $receipt = [
            'version' => 1,
            'epoch' => $journal->epoch,
            'ackSequence' => $journal->baseSequence,
            'status' => $journal->status ?? 'tracked',
        ];
        if (is_string($journal->checkpoint ?? null)) {
            $receipt['checkpoint'] = $journal->checkpoint;
        }
        $check = $journal->context->moneyBudget->lastCheck ?? null;
        if ($check instanceof \stdClass) {
            $receipt['moneyBudget'] = get_object_vars($check);
        }
        return $receipt;
    }
    private function signedCheckpoint(
        array $state,
        array $context,
        string $epoch,
        int $sequence,
        string $townId,
    ): string {
        $state = array_intersect_key(
            $state,
            array_flip([
                'records',
                'continuousRecords',
                'powers',
                'builderHammers',
                'chestsWithoutBuilderHammer',
                'issuedRun',
                'settledRun',
                'shopVisit',
                'shopStock',
                'pendingChests',
                'vipReceipts',
                'town',
            ]),
        );
        $state['town'] = array_intersect_key(
            $state['town'],
            array_flip([
                'coins',
                'era',
                'buildings',
                'buildingEras',
                'buildingEraLevels',
                'projects',
                'completedRuns',
                'forge',
                'saloonVisitAt',
                'income',
                'lastCollections',
                'events',
                'nextRaidRun',
                'transition',
            ]),
        );
        $payload = json_encode(
            [
                'version' => 1,
                'townId' => $townId,
                'epoch' => $epoch,
                'sequence' => $sequence,
                'state' => $state,
                'context' => $context,
            ],
            JSON_THROW_ON_ERROR,
        );
        if (strlen($payload) > 1048576) {
            throw new ApiError(
                413,
                'A town checkpoint must be smaller than 1 MB. Your local copy is safe.',
            );
        }
        $body = rtrim(strtr(base64_encode(gzcompress($payload, 6)), '+/', '-_'), '=');
        $secret = Env::get('APP_SECRET');
        if (!is_string($secret) || strlen($secret) < 32) {
            throw new \RuntimeException('Save checkpoints need the configured application secret.');
        }
        return $body .
            '.' .
            hash_hmac('sha256', 'prospect-hollow:save-checkpoint:v1:' . $body, $secret);
    }
    private function readCheckpoint(mixed $token, string $townId): ?array
    {
        if (!is_string($token) || strlen($token) > 1048576) {
            return null;
        }
        $parts = explode('.', $token);
        if (
            count($parts) !== 2 ||
            !preg_match('/^[a-zA-Z0-9_-]+$/D', $parts[0]) ||
            !preg_match('/^[a-f0-9]{64}$/D', $parts[1])
        ) {
            return null;
        }
        $secret = Env::get('APP_SECRET');
        if (
            !is_string($secret) ||
            !hash_equals(
                hash_hmac('sha256', 'prospect-hollow:save-checkpoint:v1:' . $parts[0], $secret),
                $parts[1],
            )
        ) {
            return null;
        }
        $compressed = base64_decode(strtr($parts[0], '-_', '+/'), true);
        if ($compressed === false) {
            return null;
        }
        $decoded = @gzuncompress($compressed, 1048576);
        if ($decoded === false) {
            return null;
        }
        try {
            $payload = json_decode($decoded, true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return null;
        }
        if (
            ($payload['version'] ?? null) !== 1 ||
            ($payload['townId'] ?? null) !== $townId ||
            !is_array($payload['state'] ?? null) ||
            !is_array($payload['context'] ?? null) ||
            !self::integer($payload['sequence'] ?? null) ||
            !is_string($payload['epoch'] ?? null)
        ) {
            return null;
        }
        return $payload;
    }
    private function seal(
        array $incoming,
        array $context,
        string $epoch,
        int $ack,
        string $status,
        string $townId,
    ): object {
        $incoming['integrity'] = [
            'version' => 1,
            'epoch' => $epoch,
            'baseSequence' => $ack,
            'actions' => [],
            'status' => $status,
            'context' => $context,
        ];
        $incoming['integrity']['checkpoint'] = $this->signedCheckpoint(
            $this->normalized($incoming),
            $context,
            $epoch,
            $ack,
            $townId,
        );
        // PHP's associative decode loses the distinction between {} and []. Keep
        // the wire schema explicit so an untouched cloud backup can upload again.
        foreach (['records', 'continuousRecords'] as $key) {
            $incoming[$key] = (object) $incoming[$key];
        }
        foreach (
            [
                'buildings',
                'buildingEras',
                'buildingEraLevels',
                'projects',
                'events',
                'lastCollections',
            ]
            as $key
        ) {
            if (isset($incoming['town'][$key])) {
                $incoming['town'][$key] = (object) $incoming['town'][$key];
            }
        }
        $json = json_encode($incoming, JSON_THROW_ON_ERROR);
        if (strlen($json) > 1048576) {
            throw new ApiError(
                413,
                'A town save including its recovery checkpoint must be smaller than 1 MB. Your local copy is safe.',
            );
        }
        return json_decode($json, false, 64, JSON_THROW_ON_ERROR);
    }
    /** The caller holds the account transaction lock before comparing checkpoints. */
    public function accept(
        object $profile,
        ?object $previous,
        int $now,
        bool $resolve = false,
        array $history = [],
        string $townId = '',
        ?int $previousServerAt = null,
    ): object {
        $this->validate($profile);
        $incoming = self::arrayOf($profile);
        $journal = $this->journal($incoming['integrity'] ?? null);
        $old = $previous ? self::arrayOf($previous) : null;
        $anchor = $old ? $this->journal($old['integrity'] ?? null) : null;
        if (!$anchor) {
            if (!$journal) {
                return $profile;
            }
            $ack = $journal['baseSequence'] + count($journal['actions']);
            $clientAt = self::integer($journal['clientAt'] ?? null) ? $journal['clientAt'] : $now;
            $context = ['clockOffset' => $clientAt - $now];
            // Enrollment may happen during an offline puzzle. Its existing rewards
            // form the unverified baseline, while run identity and continuous credit
            // must survive pruning so the next normal receipt can still reconcile.
            foreach ($journal['actions'] as $action) {
                $data = $action['data'];
                if (
                    $action['kind'] === 'run-start' &&
                    self::integer($data['runId'] ?? null, 1) &&
                    in_array($data['mode'] ?? null, ['normal', 'continuous'], true)
                ) {
                    $context['run'] = [
                        'runId' => $data['runId'],
                        'mode' => $data['mode'],
                        'levelId' => $data['levelId'] ?? null,
                        'credited' => 0,
                    ];
                } elseif (
                    $action['kind'] === 'continuous' &&
                    isset($context['run']) &&
                    $context['run']['runId'] === ($data['runId'] ?? null) &&
                    self::integer($data['levelId'] ?? null, 1) &&
                    isset($this->rules['levels'][$data['levelId']]) &&
                    self::integer($data['jewels'] ?? null)
                ) {
                    $context['run']['credited'] = max(
                        $context['run']['credited'],
                        min(
                            $this->rules['rewards']['continuousCoinCap'],
                            floor($data['jewels'] / 10) *
                                $this->rules['levels'][$data['levelId']]['miningMultiplier'],
                        ),
                    );
                } elseif (
                    $action['kind'] === 'victory' &&
                    isset($context['run']) &&
                    $context['run']['runId'] === ($data['runId'] ?? null)
                ) {
                    unset($context['run']);
                }
            }
            if (
                isset($context['run']) &&
                ($context['run']['runId'] !== ($incoming['issuedRun'] ?? 0) ||
                    $context['run']['runId'] <= ($incoming['settledRun'] ?? 0))
            ) {
                unset($context['run']);
            }
            $context = $this->moneyContext($context, null, $now, null, []);
            return $this->seal($incoming, $context, $journal['epoch'], $ack, 'baseline', $townId);
        }
        if (!$journal) {
            if ($resolve) {
                foreach ($history as $entry) {
                    if (
                        self::same(
                            $this->protected($this->normalized(self::arrayOf($entry))),
                            $this->protected($this->normalized($incoming)),
                        )
                    ) {
                        return $this->seal(
                            $incoming,
                            $this->moneyContext(
                                $anchor['context'] ?? [],
                                $anchor['context'] ?? [],
                                $now,
                                $previousServerAt,
                                [],
                            ),
                            $anchor['epoch'],
                            $anchor['baseSequence'],
                            'baseline',
                            $townId,
                        );
                    }
                }
            }
            self::mismatch('integrity');
        }
        $candidate = $old;
        $checkpoint = $anchor;
        $historical = false;
        $signedState = null;
        if ($resolve && isset($journal['checkpoint'])) {
            $signed = $this->readCheckpoint($journal['checkpoint'], $townId);
            if (
                !$signed ||
                $signed['epoch'] !== $journal['epoch'] ||
                $signed['sequence'] !== $journal['baseSequence']
            ) {
                self::mismatch('recovery.checkpoint');
            }
            $signedProfile = $signed['state'];
            $signedProfile['powers'] = array_map(
                fn($id, $quantity) => ['id' => $id, 'quantity' => $quantity],
                array_keys($signedProfile['powers']),
                array_values($signedProfile['powers']),
            );
            // A signed older backup gains newly introduced zero-level plots through
            // the same defaults as the client; adding an era must not break recovery.
            $signedState = $this->normalized($signedProfile);
            $checkpoint = ['baseSequence' => $signed['sequence'], 'context' => $signed['context']];
            $historical = true;
        }
        if (
            $journal['epoch'] !== $anchor['epoch'] ||
            $journal['baseSequence'] > $anchor['baseSequence']
        ) {
            if (!$resolve) {
                self::mismatch('integrity.epoch');
            }
            if ($signedState === null) {
                $candidate = null;
            } else {
                $candidate = $old;
            }
            foreach ([$previous, ...$history] as $entry) {
                if (
                    self::same(
                        $this->protected($this->normalized(self::arrayOf($entry))),
                        $this->protected($this->normalized($incoming)),
                    )
                ) {
                    $candidate = self::arrayOf($entry);
                    break;
                }
            }
            if (!$candidate) {
                self::mismatch('recovery');
            }
            // An exact known snapshot may rotate the journal; invented epochs cannot.
            if ($signedState === null) {
                return $this->seal(
                    $incoming,
                    $this->moneyContext(
                        $candidate['integrity']['context'] ?? ($anchor['context'] ?? []),
                        $anchor['context'] ?? [],
                        $now,
                        $previousServerAt,
                        [],
                    ),
                    $journal['epoch'],
                    $journal['baseSequence'] + count($journal['actions']),
                    'tracked',
                    $townId,
                );
            }
        }
        if (
            $signedState === null &&
            $journal['baseSequence'] < $anchor['baseSequence'] &&
            $resolve
        ) {
            foreach ($history as $entry) {
                $data = self::arrayOf($entry);
                $meta = $data['integrity'] ?? null;
                if (
                    ($meta['epoch'] ?? null) === $journal['epoch'] &&
                    ($meta['baseSequence'] ?? null) === $journal['baseSequence']
                ) {
                    $candidate = $data;
                    $checkpoint = $meta;
                    $historical = true;
                    break;
                }
            }
        }
        $state = $signedState ?? $this->normalized($candidate);
        $context = $checkpoint['context'] ?? [];
        $ack = $checkpoint['baseSequence'];
        // An older pre-guard signature retains the latest allowance. Its historical
        // money is unverified; only its newly replayed sources are charged here.
        $context['moneyGross'] ??= $anchor['context']['moneyBudget']['highWater'] ?? 0;
        $sources = ['mintedCoins' => 0, 'reservedCoins' => 0, 'maxMultiplier' => 1];
        foreach ($journal['actions'] as $action) {
            if ($action['sequence'] <= $ack) {
                continue;
            }
            if ($action['sequence'] !== $ack + 1) {
                self::mismatch('integrity.sequence');
            }
            $this->applyAccounted(
                $state,
                $context,
                $action['kind'],
                $action['data'],
                $now,
                $sources,
            );
            $ack = $action['sequence'];
        }
        if (
            !$historical &&
            $journal['baseSequence'] + count($journal['actions']) < $anchor['baseSequence']
        ) {
            self::mismatch('integrity.sequence');
        }
        $target = $this->normalized($incoming);
        // Continuous best scores are statistics. Once credited coins stop changing,
        // the frontend saves improvements without generating redundant coin actions.
        // A first score that earned no coins has no command either, and a later run
        // can reach the same upload, so it is accepted for any level open to replay.
        foreach ($target['continuousRecords'] as $level => $record) {
            if (
                isset($state['continuousRecords'][$level]) &&
                $record['coins'] === $state['continuousRecords'][$level]['coins'] &&
                ($record['score'] ?? 0) >= ($state['continuousRecords'][$level]['score'] ?? 0)
            ) {
                $state['continuousRecords'][$level]['score'] = $record['score'];
            } elseif (
                !isset($state['continuousRecords'][$level]) &&
                $record['coins'] === 0 &&
                $state['town']['buildings']['museum'] &&
                $this->unlocked($state, (int) $level)
            ) {
                $state['continuousRecords'][$level] = $record;
            }
        }
        // UI accrual is deliberately not journaled on every frame. Recalculate the
        // final reserve at its checkpoint, within the trusted server clock envelope.
        $at = $target['town']['income']['at'] ?? null;
        if ($at !== null && $at !== ($state['town']['income']['at'] ?? null)) {
            $this->accrue($state, $context, $at, $now);
        }
        $actual = $this->protected($target);
        $expected = $this->protected($state);
        foreach ($expected as $field => $value) {
            if (!self::same($actual[$field], $value)) {
                self::mismatch(self::difference($value, $actual[$field], $field));
            }
        }
        $context = $this->moneyContext(
            $context,
            $anchor['context'] ?? [],
            $now,
            $previousServerAt,
            $sources,
        );
        return $this->seal(
            $incoming,
            $context,
            $journal['epoch'],
            $historical ? $ack : max($anchor['baseSequence'], $ack),
            'tracked',
            $townId,
        );
    }
    /** Only for a historical row selected by an authorized server-side operation. */
    public function restoreKnownCheckpoint(
        object $historical,
        object $latest,
        int $now,
        string $townId,
        ?int $previousServerAt = null,
    ): object {
        $incoming = self::arrayOf($historical);
        $current = self::arrayOf($latest);
        $anchor = $this->journal($current['integrity'] ?? null);
        // Preserve pre-integrity admin recovery, including old diagnostic records
        // which were never enrolled under the current gameplay validation rules.
        if (!$anchor) {
            return $historical;
        }
        $this->ready();
        $journal = $this->journal($incoming['integrity'] ?? null);
        if (!$journal) {
            // Pre-integrity diagnostics are not earned completions. Use the same
            // record normalization as the frontend before sealing this old branch,
            // so loading it cannot leave an unplayable or unsyncable checkpoint.
            $records = [];
            foreach ($this->rules['levels'] as $id => $definition) {
                $record = $incoming['records'][$id] ?? null;
                $stars = $record['stars'] ?? null;
                if (
                    !is_array($record) ||
                    !self::number($record['score'] ?? null, -PHP_FLOAT_MAX) ||
                    !self::number($stars, 1) ||
                    $stars > 3 ||
                    floor($stars) != (float) $stars
                ) {
                    continue;
                }
                $records[$id] = ['score' => max(0, $record['score']), 'stars' => (int) $stars];
                if (self::number($record['bestTimeMs'] ?? null, 0.000001)) {
                    $records[$id]['bestTimeMs'] = $record['bestTimeMs'];
                }
            }
            $incoming['records'] = $records;
        }
        $context = $journal['context'] ?? ['clockOffset' => $anchor['context']['clockOffset'] ?? 0];
        $context = $this->moneyContext(
            $context,
            $anchor['context'] ?? [],
            $now,
            $previousServerAt,
            [],
            new MoneyBudget('observe'),
        );
        return $this->seal(
            $incoming,
            $context,
            $journal['epoch'] ?? $anchor['epoch'],
            $journal['baseSequence'] ?? $anchor['baseSequence'],
            $journal ? 'tracked' : 'baseline',
            $townId,
        );
    }
    private function moneyContext(
        array $branch,
        ?array $latest,
        int $now,
        ?int $previousServerAt,
        array $sources,
        ?MoneyBudget $budget = null,
    ): array {
        $branch['moneyGross'] ??= $latest['moneyBudget']['highWater'] ?? 0;
        $branch['moneyBudget'] = ($budget ?? new MoneyBudget())->reconcile(
            $latest['moneyBudget'] ?? null,
            (float) $branch['moneyGross'],
            $now,
            $previousServerAt,
            $sources,
        );
        return $branch;
    }
    private function bountyEntitlement(?array $event): int
    {
        if (
            !$event ||
            $event['seen'] ||
            in_array($event['kind'] ?? 'bandits', ['workshop-fire', 'storm-cleanup'], true) ||
            $event['outcome'] !== 'protected' ||
            $event['loss'] !== 0
        ) {
            return 0;
        }
        return min($event['gangSize'], $event['sheriffLevel'] * 2) *
            $this->rules['economy']['bountyPerCaptured'];
    }
    private function chestEntitlement(array $chest): int
    {
        // A later choice can differ from the rolled drop. Reserve the largest legal
        // catalog cash choice, with the chest's original economy version preserved.
        $maximum = 0;
        foreach (
            [...$this->rules['rewards']['chestDrops'], ...$this->rules['rewards']['coinTiers']]
            as $entry
        ) {
            $reward = $this->reward($entry['id'], $chest['levelId'], $chest['economyVersion'] ?? 1);
            $cash =
                $reward['kind'] === 'coins'
                    ? $reward['quantity']
                    : $reward['quantity'] * $this->rules['rewards']['overflowCoins'];
            $maximum = max($maximum, $cash);
        }
        return $maximum;
    }
    private function applyAccounted(
        array &$state,
        array &$context,
        string $kind,
        array $data,
        int $now,
        array &$sources,
    ): void {
        $coins = $state['town']['coins'];
        $pending = array_column($state['pendingChests'], 'id');
        $bounty = $this->bountyEntitlement(
            $state['town']['events']['dusty-trail-visitors'] ?? null,
        );
        $this->apply($state, $context, $kind, $data, $now);
        $minted = 0;
        $reserved = 0;
        $cost = 0.0;
        $multiplier = 1;
        if (in_array($kind, ['victory', 'continuous', 'vip-spend'], true)) {
            if ($kind !== 'vip-spend') {
                $multiplier = max(1, $this->rules['levels'][$data['levelId']]['miningMultiplier']);
            }
            // These actions only add wallet money. Unlike a batch wallet delta,
            // this source delta cannot be hidden by later purchases or losses.
            $minted = max(0, $state['town']['coins'] - $coins);
            $cost = $minted / $multiplier;
        }
        foreach ($state['pendingChests'] as $chest) {
            if (!in_array($chest['id'], $pending, true)) {
                $cash = $this->chestEntitlement($chest);
                $factor = max(1, $this->rules['levels'][$chest['levelId']]['miningMultiplier']);
                $reserved += $cash;
                $cost += $cash / $factor;
                $multiplier = max($multiplier, $factor);
            }
        }
        // Newly protected encounters and later protection upgrades create bounty
        // entitlements. Seeing an accepted encounter merely transfers that value.
        $newBounty = max(
            0,
            $this->bountyEntitlement($state['town']['events']['dusty-trail-visitors'] ?? null) -
                $bounty,
        );
        $reserved += $newBounty;
        $cost += $newBounty;
        $context['moneyGross'] += $cost;
        $sources['mintedCoins'] += $minted;
        $sources['reservedCoins'] += $reserved;
        if ($cost > 0) {
            $sources['maxMultiplier'] = max($sources['maxMultiplier'], $multiplier);
        }
    }
    private function powerCapacity(array $town): int
    {
        $r = $this->rules['rewards'];
        return $r['bonusCapacities'][min(3, $town['buildings']['armory'] ?? 0)] +
            ($town['buildings']['garage'] ?? 0) * $r['garageCapacityPerLevel'];
    }
    private function reward(string $id, int $level = 1, int $version = 2): ?array
    {
        foreach (
            [...$this->rules['rewards']['chestDrops'], ...$this->rules['rewards']['coinTiers']]
            as $entry
        ) {
            if ($entry['id'] === $id) {
                return [
                    'id' => $id,
                    'kind' => $entry['kind'],
                    'quantity' =>
                        $entry['kind'] === 'coins'
                            ? (int) floor(
                                ($this->rules['levels'][$level]['chestCoins'][$version] ?? 0) *
                                    ($entry['scale'] ?? 1) +
                                    0.5,
                            )
                            : $entry['quantity'],
                ];
            }
        }
        return null;
    }
    private function addCoins(array &$state, int|float $coins): void
    {
        $state['town']['coins'] = (int) min(9007199254740991, $state['town']['coins'] + $coins);
    }
    private function grant(array &$state, array $reward): void
    {
        $quantity = $reward['quantity'];
        $overflow = 0;
        if ($reward['kind'] === 'coins') {
            $this->addCoins($state, $quantity);
            return;
        }
        if ($reward['kind'] === 'builder-hammer') {
            $accepted = min(
                $quantity,
                max(0, $this->rules['rewards']['hammerCapacity'] - $state['builderHammers']),
            );
            $state['builderHammers'] += $accepted;
            $overflow = $quantity - $accepted;
        } elseif ($reward['kind'] === 'power' && isset($state['powers'][$reward['id']])) {
            $accepted = min(
                $quantity,
                max(0, $this->powerCapacity($state['town']) - $state['powers'][$reward['id']]),
            );
            $state['powers'][$reward['id']] += $accepted;
            $overflow = $quantity - $accepted;
        } else {
            self::mismatch('reward');
        }
        $this->addCoins($state, $overflow * $this->rules['rewards']['overflowCoins']);
    }
    private function unlocked(array $state, int $level): bool
    {
        if (!isset($this->rules['levels'][$level])) {
            return false;
        }
        for ($id = 1; $id <= $this->rules['levelCount']; $id++) {
            if (!isset($state['records'][$id])) {
                return $level <= $id;
            }
        }
        return true;
    }
    private function chapter(array $records): int
    {
        $chapter = 0;
        foreach ($this->rules['chapters'] as $definition) {
            $start = $chapter * $this->rules['levelsPerChapter'] + 1;
            for ($id = $start; $id < $start + $this->rules['levelsPerChapter']; $id++) {
                if (!isset($records[$id])) {
                    return $chapter;
                }
            }
            $chapter++;
        }
        return $chapter;
    }
    private function count(mixed $value, string $field): int
    {
        if (!self::integer($value)) {
            self::mismatch($field);
        }
        return $value;
    }
    private function metric(mixed $value, string $field): int|float
    {
        if (!self::number($value)) {
            self::mismatch($field);
        }
        return $value;
    }
    private function payout(array $d, int $level): int
    {
        $e = $this->rules['economy'];
        $subtotal =
            $this->count($d['jewels'] ?? 0, 'jewels') +
            $this->count($d['bonusGems'] ?? 0, 'bonusGems') * $e['bonusGemCoins'];
        foreach (
            ['comboCounts' => $e['comboCoinStep'], 'multiMatchCounts' => $e['multiMatchCoinStep']]
            as $key => $step
        ) {
            foreach ($d[$key] ?? [] as $tier => $count) {
                if (!ctype_digit((string) $tier) || !self::integer($count)) {
                    self::mismatch($key);
                }
                if ((int) $tier >= 2) {
                    $subtotal += min(9007199254740991, $count * ((int) $tier - 1) * $step);
                }
            }
        }
        return (int) min(
            9007199254740991,
            $subtotal * $this->rules['levels'][$level]['miningMultiplier'],
        );
    }
    private function apply(array &$s, array &$context, string $kind, array $d, int $now): void
    {
        // Reject malformed nested data before using any supplied value as an array
        // key or calling a typed calculator, so hostile input remains a safe 422.
        $stringFields = match ($kind) {
            'power-spend', 'shop-buy' => ['itemId'],
            'building-buy', 'building-finish', 'building-hammer' => ['buildingId'],
            'chest-claim' => ['chestId'],
            'vip-spend' => ['key', 'buildingId'],
            'era-advance' => ['expectedEra'],
            default => [],
        };
        foreach ($stringFields as $key) {
            if (!is_string($d[$key] ?? null)) {
                self::mismatch($kind . '.' . $key);
            }
        }
        if ($kind === 'victory') {
            if (!is_array($d['chests'] ?? null)) {
                self::mismatch('victory.chests');
            }
            foreach ($d['chests'] as $chest) {
                if (
                    !is_array($chest) ||
                    !is_string($chest['source'] ?? null) ||
                    !is_string($chest['rewardId'] ?? null)
                ) {
                    self::mismatch('victory.chests');
                }
            }
            foreach (['comboCounts', 'multiMatchCounts'] as $key) {
                if (isset($d[$key]) && !is_array($d[$key])) {
                    self::mismatch($key);
                }
            }
            if (isset($d['chooseRewards']) && !is_bool($d['chooseRewards'])) {
                self::mismatch('chooseRewards');
            }
        }
        switch ($kind) {
            case 'run-start':
                $run = $this->count($d['runId'] ?? null, 'runId');
                $mode = $d['mode'] ?? 'normal';
                $level = $d['levelId'] ?? null;
                if (
                    $run !== $s['issuedRun'] + 1 ||
                    !in_array($mode, ['normal', 'continuous'], true) ||
                    ($mode === 'continuous' &&
                        (!self::integer($level, 1) ||
                            !$this->unlocked($s, $level) ||
                            !$s['town']['buildings']['museum']))
                ) {
                    self::mismatch('run-start');
                }
                if (
                    $level !== null &&
                    (!self::integer($level, 1) ||
                        !$this->unlocked($s, $level) ||
                        ($mode === 'normal' &&
                            isset($s['records'][$level]) &&
                            !$s['town']['buildings']['museum']))
                ) {
                    self::mismatch('run-start.levelId');
                }
                if ($s['pendingChests']) {
                    self::mismatch('pendingChests');
                }
                $s['issuedRun'] = $run;
                $context['run'] = [
                    'runId' => $run,
                    'mode' => $mode,
                    'levelId' => $level,
                    'credited' => 0,
                ];
                break;
            case 'victory':
                $this->victory($s, $context, $d, $now);
                break;
            case 'continuous':
                $level = $this->count($d['levelId'] ?? null, 'levelId');
                $run = $context['run'] ?? null;
                if (
                    !$run ||
                    $run['runId'] !== ($d['runId'] ?? null) ||
                    $run['mode'] !== 'continuous' ||
                    $run['levelId'] !== $level ||
                    !$this->unlocked($s, $level)
                ) {
                    self::mismatch('continuous');
                }
                $previous = $s['continuousRecords'][$level] ?? ['coins' => 0, 'score' => 0];
                $cap = $this->rules['rewards']['continuousCoinCap'];
                $earned = min(
                    $cap,
                    floor($this->count($d['jewels'] ?? null, 'jewels') / 10) *
                        $this->rules['levels'][$level]['miningMultiplier'],
                );
                $delta = min($cap - $previous['coins'], max(0, $earned - $run['credited']));
                $context['run']['credited'] = max($run['credited'], $earned);
                $s['continuousRecords'][$level] = [
                    'coins' => (int) ($previous['coins'] + $delta),
                    'score' => max($previous['score'], $this->metric($d['score'] ?? null, 'score')),
                ];
                $this->addCoins($s, $delta);
                break;
            case 'power-spend':
                $id = $d['itemId'] ?? '';
                if (!isset($s['powers'][$id]) || $s['powers'][$id] < 1) {
                    self::mismatch('power-spend');
                }
                $s['powers'][$id]--;
                break;
            case 'shop-buy':
                $id = $d['itemId'] ?? '';
                $item = null;
                foreach ($this->rules['shop']['items'] as $entry) {
                    if ($entry['id'] === $id) {
                        $item = $entry;
                    }
                }
                $offer = array_search($id, array_column($s['shopStock'], 'id'), true);
                if (
                    !$item ||
                    !$s['town']['buildings']['shop'] ||
                    $s['shopVisit'] !== ($d['visit'] ?? null) ||
                    $offer === false ||
                    $s['shopStock'][$offer]['sold'] ||
                    $s['town']['coins'] < $item['price'] ||
                    $s['powers'][$id] >= $this->powerCapacity($s['town'])
                ) {
                    self::mismatch('shop-buy');
                }
                $s['town']['coins'] -= $item['price'];
                $this->grant($s, $item);
                $s['shopStock'][$offer]['sold'] = true;
                break;
            case 'shop-stock':
                $this->stock($s, $d['stock'] ?? null, $d['visit'] ?? null, false);
                break;
            case 'chest-claim':
                $index = array_search(
                    $d['chestId'] ?? '',
                    array_column($s['pendingChests'], 'id'),
                    true,
                );
                if ($index === false) {
                    self::mismatch('chest-claim');
                }
                $chest = $s['pendingChests'][$index];
                $selection = $d['selection'] ?? null;
                $allFull = $s['builderHammers'] >= $this->rules['rewards']['hammerCapacity'];
                foreach ($s['powers'] as $quantity) {
                    $allFull = $allFull && $quantity >= $this->powerCapacity($s['town']);
                }
                $chosen =
                    is_string($selection) &&
                    (!in_array($selection, ['coins-small', 'coins-big'], true) || $allFull)
                        ? $this->reward(
                            $selection,
                            $chest['levelId'],
                            $chest['economyVersion'] ?? 1,
                        )
                        : null;
                $this->grant(
                    $s,
                    $chosen ??
                        $this->reward(
                            $chest['items'][0]['id'],
                            $chest['levelId'],
                            $chest['economyVersion'] ?? 1,
                        ),
                );
                array_splice($s['pendingChests'], $index, 1);
                break;
            case 'forge-collect':
                $this->clock($d['at'] ?? null, $context, $now);
                if (
                    !$s['town']['buildings']['blacksmith'] ||
                    $s['town']['forge']['charge'] !== 1 ||
                    $s['powers']['tnt'] >= $this->powerCapacity($s['town']) ||
                    $this->cooldown($s['town'], 'blacksmith', $d['at'])
                ) {
                    self::mismatch('forge-collect');
                }
                $s['town']['forge'] = ['progress' => 0, 'charge' => 0];
                $s['town']['lastCollections']['blacksmith'] = $d['at'];
                $s['powers']['tnt']++;
                break;
            case 'saloon-collect':
                $this->accrue($s, $context, $d['at'] ?? null, $now);
                if (
                    !$s['town']['buildings']['saloon'] ||
                    $this->cooldown($s['town'], 'saloon', $d['at'])
                ) {
                    self::mismatch('saloon-collect');
                }
                $coins = min(
                    $s['town']['income']['stored'],
                    9007199254740991 - $s['town']['coins'],
                );
                if (!$coins) {
                    self::mismatch('saloon-collect');
                }
                $s['town']['income']['stored'] -= $coins;
                $this->addCoins($s, $coins);
                $s['town']['lastCollections']['saloon'] = $d['at'];
                break;
            case 'saloon-visitor':
                $visit = $this->count($d['visitAt'] ?? null, 'visitAt');
                if ($visit <= $s['town']['saloonVisitAt']) {
                    self::mismatch('saloon-visitor');
                }
                if ($s['town']['buildings']['saloon']) {
                    $this->accrue($s, $context, $d['at'] ?? null, $now);
                    $coins = min(
                        $s['town']['income']['stored'],
                        $this->incomeRate($s['town']),
                        9007199254740991 - $s['town']['coins'],
                    );
                    $this->addCoins($s, $coins);
                    $s['town']['income']['stored'] -= $coins;
                }
                $s['town']['saloonVisitAt'] = $visit;
                break;
            case 'vip-spend':
                $key = $d['key'] ?? null;
                $id = $d['buildingId'] ?? '';
                if (
                    !is_string($key) ||
                    strlen($key) > 160 ||
                    !preg_match('/^.{1,149}:[01]$/D', $key) ||
                    in_array($key, $s['vipReceipts'], true) ||
                    !in_array($id, $this->rules['economy']['vipBuildings'], true) ||
                    !($s['town']['buildings'][$id] ?? 0) ||
                    isset($s['town']['projects'][$id])
                ) {
                    self::mismatch('vip-spend');
                }
                $this->addCoins($s, $this->rules['economy']['vipSpend']);
                $s['vipReceipts'] = array_slice([...$s['vipReceipts'], $key], -64);
                break;
            case 'building-buy':
            case 'building-finish':
            case 'building-hammer':
                $this->building($s, $context, $kind, $d, $now);
                break;
            case 'raid-encounter':
                $this->encounter($s, $context, $d, $now);
                break;
            case 'raid-bell':
                $event = &$s['town']['events']['dusty-trail-visitors'];
                if (
                    !$event ||
                    $event['id'] !== ($d['raidId'] ?? null) ||
                    $event['seen'] ||
                    !empty($event['bellRung']) ||
                    $event['loss'] <= 0 ||
                    $s['town']['buildings']['square'] < 4
                ) {
                    self::mismatch('raid-bell');
                }
                $loss = (int) floor($event['loss'] / 2);
                $this->addCoins($s, $event['loss'] - $loss);
                $event['loss'] = $loss;
                $event['bellRung'] = true;
                $event['outcome'] = $loss ? 'stolen' : 'harmless';
                break;
            case 'raid-seen':
                $event = &$s['town']['events']['dusty-trail-visitors'];
                if (!$event || $event['id'] !== ($d['raidId'] ?? null) || $event['seen']) {
                    self::mismatch('raid-seen');
                }
                $kind = $event['kind'] ?? 'bandits';
                $bounty =
                    !in_array($kind, ['workshop-fire', 'storm-cleanup'], true) &&
                    $event['outcome'] === 'protected' &&
                    $event['loss'] === 0
                        ? min($event['gangSize'], $event['sheriffLevel'] * 2) *
                            $this->rules['economy']['bountyPerCaptured']
                        : 0;
                $bounty = min($bounty, 9007199254740991 - $s['town']['coins']);
                $event['seen'] = true;
                $event['bounty'] = $bounty;
                $this->addCoins($s, $bounty);
                break;
            case 'era-advance':
                $this->advanceEra($s, $d);
                break;
            case 'income-start':
                // An older town's earning saloon gets its first income checkpoint.
                if ($s['town']['income']['at'] !== null || !$this->incomeRate($s['town'])) {
                    self::mismatch('income-start');
                }
                $this->accrue($s, $context, $d['at'] ?? null, $now);
                break;
            default:
                self::incompatible();
        }
    }
    private function victoryTargets(array $definition, array $receipt): array
    {
        // Old boards can finish after a content deployment. Their thresholds are
        // accepted only as a complete tuple archived in the server's own catalog;
        // client-provided values never define an additional reward rule.
        $played = [
            $receipt['target'] ?? null,
            $receipt['starTarget'] ?? null,
            $receipt['speedTargetMs'] ?? null,
        ];
        foreach ($definition['compatibleTargets'] ?? [] as $targets) {
            if (
                self::same($played, [
                    $targets['chestTarget'],
                    $targets['starScoreTarget'],
                    $targets['speedTargetMs'],
                ])
            ) {
                return $targets;
            }
        }
        return $definition;
    }
    private function victory(array &$s, array &$context, array $d, int $now): void
    {
        $level = $this->count($d['levelId'] ?? null, 'levelId');
        $run = $this->count($d['runId'] ?? null, 'runId');
        $active = $context['run'] ?? null;
        if (!$active && $run === $s['issuedRun'] + 1) {
            $s['issuedRun'] = $run;
        }
        if (
            !$this->unlocked($s, $level) ||
            $run !== $s['issuedRun'] ||
            $run <= $s['settledRun'] ||
            ($active && ($active['runId'] !== $run || $active['mode'] === 'continuous'))
        ) {
            self::mismatch('victory');
        }
        if ($active && $active['levelId'] !== null && $active['levelId'] !== $level) {
            self::mismatch('victory.levelId');
        }
        if (isset($s['records'][$level]) && !$s['town']['buildings']['museum']) {
            self::mismatch('victory.replay');
        }
        $definition = $this->rules['levels'][$level];
        $targets = $this->victoryTargets($definition, $d);
        $score = $this->metric($d['score'] ?? null, 'score');
        $combo = $this->metric($d['combo'] ?? 0, 'combo');
        $elapsed = $d['elapsedMs'] ?? null;
        if ($elapsed !== null && !self::number($elapsed)) {
            self::mismatch('elapsedMs');
        }
        $target = $targets['starScoreTarget'];
        $stars =
            1 +
            (int) ($target > 0 && $score >= $target) +
            (int) ($combo >= $this->rules['economy']['starCascadeTarget'] ||
                ($target > 0 &&
                    $score >= ceil($target * $this->rules['economy']['starScoreMultiplier'])));
        $previous = $s['records'][$level] ?? [];
        $oldChapter = $this->chapter($s['records']);
        $s['records'][$level] = [
            'score' => max($previous['score'] ?? 0, $score),
            'stars' => max($previous['stars'] ?? 0, $stars),
        ];
        if ($elapsed > 0) {
            $s['records'][$level]['bestTimeMs'] = min($previous['bestTimeMs'] ?? INF, $elapsed);
        } elseif (isset($previous['bestTimeMs'])) {
            $s['records'][$level]['bestTimeMs'] = $previous['bestTimeMs'];
        }
        $this->accrue($s, $context, $d['at'] ?? null, $now);
        $s['town']['completedRuns'] = min(9007199254740991, $s['town']['completedRuns'] + 1);
        foreach ($s['town']['projects'] as &$project) {
            $project['wins'] = min(2, $project['required'], $project['wins'] + 1);
        }
        unset($project);
        $this->advanceForge($s['town']);
        $newChapter = $this->chapter($s['records']);
        if ($newChapter > $oldChapter) {
            $chapter = $this->rules['chapters'][$newChapter - 1];
            $gift = $chapter['gift'];
            if ($s['powers'][$gift['id']] >= $this->powerCapacity($s['town'])) {
                $this->addCoins($s, $chapter['overflowCoins']);
            } else {
                $this->grant($s, $gift);
            }
        }
        $scored = $targets['chestTarget'] > 0 && $score >= $targets['chestTarget'];
        $fast =
            $elapsed > 0 && $targets['speedTargetMs'] > 0 && $elapsed <= $targets['speedTargetMs'];
        $sources = array_values(
            array_filter([
                $scored ? 'score' : ($fast ? null : 'completion'),
                $fast ? 'speed' : null,
            ]),
        );
        if (!is_array($d['chests'] ?? null) || array_column($d['chests'], 'source') !== $sources) {
            self::mismatch('victory.chests');
        }
        foreach ($d['chests'] as $claim) {
            $reward = $this->reward(
                $claim['rewardId'] ?? '',
                $level,
                $this->rules['rewards']['chestEconomyVersion'],
            );
            if (!$reward || in_array($reward['id'], ['coins-small', 'coins-big'], true)) {
                self::mismatch('victory.chests');
            }
            if ($s['chestsWithoutBuilderHammer'] < 9 && $reward['kind'] !== 'coins') {
                $reserved = count(
                    array_filter(
                        $s['pendingChests'],
                        fn($chest) => $chest['items'][0]['id'] === $reward['id'],
                    ),
                );
                $quantity =
                    $reward['kind'] === 'builder-hammer'
                        ? $s['builderHammers']
                        : $s['powers'][$reward['id']];
                $capacity =
                    $reward['kind'] === 'builder-hammer'
                        ? $this->rules['rewards']['hammerCapacity']
                        : $this->powerCapacity($s['town']);
                if ($quantity + $reserved >= $capacity) {
                    self::mismatch('victory.chests');
                }
            }
            if ($s['chestsWithoutBuilderHammer'] >= 9) {
                $reserved = count(
                    array_filter(
                        $s['pendingChests'],
                        fn($chest) => $chest['items'][0]['id'] === 'builder-hammer',
                    ),
                );
                $forced =
                    $s['builderHammers'] + $reserved < $this->rules['rewards']['hammerCapacity']
                        ? 'builder-hammer'
                        : 'coins';
                if ($reward['id'] !== $forced) {
                    self::mismatch('victory.chests');
                }
            }
            $s['chestsWithoutBuilderHammer'] =
                $reward['kind'] === 'builder-hammer'
                    ? 0
                    : min(9, $s['chestsWithoutBuilderHammer'] + 1);
            if ($d['chooseRewards'] ?? false) {
                $s['pendingChests'][] = [
                    'id' => $run . '-' . $claim['source'],
                    'runId' => $run,
                    'levelId' => $level,
                    'economyVersion' => $this->rules['rewards']['chestEconomyVersion'],
                    'source' => $claim['source'],
                    'items' => [$reward],
                ];
            } else {
                $this->grant($s, $reward);
            }
        }
        $this->addCoins($s, $this->payout($d, $level));
        $s['settledRun'] = $run;
        unset($context['run']);
        $this->stock($s, $d['shopStock'] ?? null, $d['shopVisit'] ?? null, true);
    }
    private function clock(mixed $at, array $context, int $now): int
    {
        if (!self::integer($at)) {
            self::mismatch('at');
        }
        if ($at > $now + ($context['clockOffset'] ?? 0) + self::CLOCK_SKEW_MS) {
            throw new ApiError(
                422,
                'The device clock is ahead of this cloud checkpoint. Your local progress and the last cloud save are safe. Check the clock before retrying.',
                ['code' => 'save_clock_mismatch'],
            );
        }
        return $at;
    }
    private function accrue(array &$s, array &$context, mixed $at, int $now): void
    {
        $at = $this->clock($at, $context, $now);
        $town = &$s['town'];
        $income = &$town['income'];
        if ($income['at'] !== null && $at <= $income['at']) {
            return;
        }
        $e = $this->rules['economy'];
        $rate = $this->incomeRate($town);
        $elapsed =
            $income['at'] === null
                ? 0
                : min($at - $income['at'], $e['incomeHoursCap'] * $e['hourMs']);
        $credit = $elapsed * $rate + $income['remainder'];
        $capacity = $rate * $e['incomeHoursCap'];
        $earned = max(0, min(floor($credit / $e['hourMs']), $capacity - $income['stored']));
        $income = [
            'at' => $at,
            'stored' => (int) ($income['stored'] + $earned),
            'remainder' =>
                $income['stored'] + $earned >= $capacity ? 0 : (int) fmod($credit, $e['hourMs']),
        ];
    }
    private function service(array $town, string $id): int
    {
        return $this->rules['buildings'][$id]['serviceLevels'][$town['buildings'][$id] ?? 0] ?? 0;
    }
    /**
     * Mirrors townNeeds() in src/game/town/TownNeeds.js from the exported needs terms.
     *
     * @return array{population: int, happiness: int}
     */
    private function populationStats(array $town): array
    {
        $supply = ['water' => 0, 'food' => 0, 'housing' => 0, 'visitors' => 0, 'comfort' => 0];
        foreach ($this->rules['needs']['terms'] as $term) {
            foreach ($term['ids'] as $id) {
                $supply[$term['stat']] += $this->needValue($town, $term, $id);
            }
        }
        $rules = $this->rules['needs']['happiness'];
        $demand = $supply['housing'] + $supply['visitors'];
        $supplied = $demand ? min(1, $supply['water'] / $demand, $supply['food'] / $demand) : 0;
        $comfort = $demand
            ? min(1, $supply['comfort'] / ($demand * $rules['comfortPerPerson']))
            : 0;
        $happiness = (int) floor(
            $supplied * ($rules['needs'] + $rules['comfort'] * $comfort) + 0.5,
        );
        $resident = min($supply['housing'], $supply['water'], $supply['food']);
        $welcome = min(
            1,
            max(
                0,
                ($happiness - $rules['visitorsFrom']) /
                    ($rules['visitorsFull'] - $rules['visitorsFrom']),
            ),
        );
        $visitor = min(
            (int) floor($supply['visitors'] * $welcome),
            max(0, $supply['water'] - $resident),
            max(0, $supply['food'] - $resident),
        );
        return ['population' => $resident + $visitor, 'happiness' => $happiness];
    }
    private function needValue(array $town, array $term, string $id): int
    {
        $built = $town['buildings'][$id] ?? 0;
        if (isset($term['eraTiers'])) {
            if (!$built) {
                return 0;
            }
            $tier = min(2, max(0, ($town['buildingEraLevels'][$id] ?: 1) - 1));
            $era = $town['buildingEras'][$id] ?? null;
            return (int) ($this->rules['eras'][$era][$term['eraTiers']][$tier] ?? 0);
        }
        if (isset($term['table'])) {
            return (int) ($term['table'][$built] ?? 0);
        }
        $level = !empty($term['service']) ? $this->service($town, $id) : $built;
        return $term['per'] *
            min($term['max'] ?? PHP_INT_MAX, max(0, $level + ($term['offset'] ?? 0)));
    }
    private function incomeRate(array $town): int
    {
        $stats = $this->populationStats($town);
        return (int) floor(
            (2.25 *
                ($town['buildings']['saloon'] ?? 0) *
                $stats['population'] *
                (100 + 1.25 * $stats['happiness']) *
                (1 + ($town['buildings']['diner'] ?? 0) * 0.05)) /
                100,
        );
    }
    private function cooldown(array $town, string $id, int $at): bool
    {
        $last = $town['lastCollections'][$id] ?? null;
        return $last !== null && $at - $last < $this->rules['economy']['collectionCooldownMs'];
    }
    private function advanceForge(array &$town): void
    {
        if (!$town['buildings']['blacksmith'] || $town['forge']['charge']) {
            return;
        }
        $town['forge']['progress']++;
        if (
            $town['forge']['progress'] >=
            ($this->rules['economy']['forgeRuns'][$town['buildings']['blacksmith'] - 1] ?? 6)
        ) {
            $town['forge'] = ['progress' => 0, 'charge' => 1];
        }
    }
    private function offer(array $town, string $id): ?array
    {
        $definition = $this->rules['buildings'][$id] ?? null;
        if (
            !$definition ||
            $this->eraIndex($definition['introducedEra']) > $this->eraIndex($town['era']) ||
            isset($town['projects'][$id])
        ) {
            return null;
        }
        $stage = $town['buildings'][$id];
        if (!$stage) {
            foreach ($definition['unlock'] as $unlock) {
                if (($town['buildings'][$unlock['id']] ?? 0) < $unlock['level']) {
                    return null;
                }
            }
        }
        $offers = $this->rules['eras'][$town['era']]['buildingOffers'][$id] ?? null;
        if (!$offers) {
            return null;
        }
        if (isset($offers['normal'][$stage])) {
            $offer = $offers['normal'][$stage];
        } else {
            if (
                $stage !== $definition['maxLevel'] ||
                $this->eraIndex($definition['introducedEra']) >= $this->eraIndex($town['era'])
            ) {
                return null;
            }
            $level =
                $town['buildingEras'][$id] === $town['era']
                    ? ($town['buildingEraLevels'][$id] ?:
                    1)
                    : 0;
            $offer = $offers['modernization'][$level] ?? null;
            if (!$offer) {
                return null;
            }
            $offer['type'] = 'modernization';
        }
        if (!empty($offer['requiresPower']) && !($town['buildings']['powerHouse'] ?? 0)) {
            return null;
        }
        if (!$town['projects'] && !array_filter($town['buildings'])) {
            $offer['cost'] = 0;
        }
        return $offer;
    }
    private function building(array &$s, array &$context, string $kind, array $d, int $now): void
    {
        $id = $d['buildingId'] ?? '';
        if (!isset($this->rules['buildings'][$id])) {
            self::mismatch('building');
        }
        $this->accrue($s, $context, $d['at'] ?? null, $now);
        $town = &$s['town'];
        if ($kind === 'building-finish') {
            $project = $town['projects'][$id] ?? null;
            if (
                !$project ||
                $project['stage'] !== ($d['expectedStage'] ?? null) ||
                $project['wins'] < min(2, $project['required'])
            ) {
                self::mismatch('building-finish');
            }
            if (($project['type'] ?? null) === 'modernization') {
                $town['buildingEras'][$id] = $project['targetEra'];
                $town['buildingEraLevels'][$id] = $project['eraLevel'] ?? 1;
            } else {
                $town['buildings'][$id] = $project['stage'];
                $town['buildingEras'][$id] = $project['targetEra'] ?? $town['era'];
                $town['buildingEraLevels'][$id] =
                    $town['era'] === 'frontier' ? 0 : $project['stage'];
            }
            unset($town['projects'][$id]);
            $this->reinforce($s);
            $this->settleForge($town);
            $this->stock($s, $d['shopStock'] ?? null, $d['shopVisit'] ?? null, false);
            return;
        }
        $offer = $this->offer($town, $id);
        if (!$offer || $offer['stage'] !== ($d['expectedStage'] ?? null)) {
            self::mismatch($kind);
        }
        $modern = ($offer['type'] ?? null) === 'modernization';
        if ($kind === 'building-hammer') {
            if ($s['builderHammers'] < 1) {
                self::mismatch($kind);
            }
            $s['builderHammers']--;
            $town['buildings'][$id] = $modern ? $town['buildings'][$id] : $offer['stage'] + 1;
            $town['buildingEras'][$id] = $town['era'];
            $town['buildingEraLevels'][$id] =
                $offer['eraLevel'] ?? ($town['era'] === 'frontier' ? 0 : $offer['stage'] + 1);
            $this->reinforce($s);
            $this->settleForge($town);
        } else {
            if ($town['coins'] < $offer['cost']) {
                self::mismatch($kind);
            }
            $town['coins'] -= $offer['cost'];
            if ($modern) {
                $town['projects'][$id] = [
                    'id' => $id,
                    'type' => 'modernization',
                    'stage' => $offer['stage'],
                    'fromEra' => $town['buildingEras'][$id],
                    'targetEra' => $town['era'],
                    'eraLevel' => $offer['eraLevel'],
                    'wins' => 0,
                    'required' => $offer['runs'],
                    'cost' => $offer['cost'],
                ];
            } elseif (!$offer['runs']) {
                $town['buildings'][$id] = $offer['stage'] + 1;
                $town['buildingEras'][$id] = $town['era'];
            } else {
                $town['projects'][$id] = [
                    'id' => $id,
                    'stage' => $offer['stage'] + 1,
                    'wins' => 0,
                    'required' => $offer['runs'],
                ];
            }
        }
        $this->stock($s, $d['shopStock'] ?? null, $d['shopVisit'] ?? null, false);
    }
    private function settleForge(array &$town): void
    {
        if (
            $town['buildings']['blacksmith'] &&
            !$town['forge']['charge'] &&
            $town['forge']['progress'] >=
                ($this->rules['economy']['forgeRuns'][$town['buildings']['blacksmith'] - 1] ?? 6)
        ) {
            $town['forge'] = ['progress' => 0, 'charge' => 1];
        }
    }
    private function stock(array &$s, mixed $stock, mixed $visit, bool $refresh): void
    {
        if (!$s['town']['buildings']['shop']) {
            return;
        }
        $slots = $this->rules['shop']['slotsByStage'][$s['town']['buildings']['shop']];
        $changes = $refresh || count($s['shopStock']) < $slots;
        if (!$changes) {
            return;
        }
        if (!is_array($stock) || count($stock) !== $slots || $visit !== $s['shopVisit'] + 1) {
            self::mismatch('shopStock');
        }
        $ids = [];
        foreach ($stock as $entry) {
            if (
                !is_array($entry) ||
                !in_array($entry['id'] ?? null, $this->rules['powers'], true) ||
                isset($ids[$entry['id']]) ||
                !is_bool($entry['sold'] ?? null)
            ) {
                self::mismatch('shopStock');
            }
            $ids[$entry['id']] = true;
        }
        if (!$refresh) {
            foreach ($s['shopStock'] as $entry) {
                $index = array_search($entry['id'], array_column($stock, 'id'), true);
                if ($index === false || $stock[$index]['sold'] !== $entry['sold']) {
                    self::mismatch('shopStock');
                }
            }
            foreach ($stock as $entry) {
                if (
                    !in_array($entry['id'], array_column($s['shopStock'], 'id'), true) &&
                    $entry['sold']
                ) {
                    self::mismatch('shopStock');
                }
            }
        }
        if ($refresh && array_filter($stock, fn($entry) => $entry['sold'])) {
            self::mismatch('shopStock');
        }
        $s['shopStock'] = $stock;
        $s['shopVisit'] = $visit;
    }
    private function protection(array $town, int $riders, string $kind): float
    {
        if (in_array($kind, ['workshop-fire', 'storm-cleanup'], true)) {
            return $this->rules['economy']['fireProtectionByLevel'][
                min(3, max(0, $town['buildings']['fireStation'] ?? 0))
            ];
        }
        return (min($riders, ($town['buildings']['sheriff'] ?? 0) * 2) +
            min($riders, ($town['buildings']['bank'] ?? 0) * 2)) /
            ($riders * 2);
    }
    private function encounter(array &$s, array &$context, array $d, int $now): void
    {
        $this->accrue($s, $context, $d['at'] ?? null, $now);
        $town = &$s['town'];
        $prior = $town['events']['dusty-trail-visitors'] ?? null;
        $built = $town['buildings'];
        $kind = $this->rules['eras'][$town['era']]['incident'];
        $event = $d['event'] ?? null;
        $next = $d['nextRaidRun'] ?? null;
        $population = $this->populationStats($town)['population'];
        $ready =
            $population > 0 &&
            self::integer($town['nextRaidRun']) &&
            $town['completedRuns'] >= $town['nextRaidRun'] &&
            (!$prior || $prior['seen']) &&
            ($town['era'] !== 'river-rail' || $built['railDepot'] > 0 || $built['riverPort'] > 0) &&
            ($town['era'] !== 'industrial' || $built['powerHouse'] > 0 || $built['mill'] > 0);
        if ($ready) {
            $development = array_sum($built);
            $riders =
                $development >= 70
                    ? 10
                    : ($development >= 50
                        ? 8
                        : ($development >= 30
                            ? 6
                            : ($development >= 16
                                ? 4
                                : 2)));
            $protection = $this->protection($town, $riders, $kind);
            $loss =
                $protection === 1.0
                    ? 0
                    : min(
                        30,
                        ceil(5 * $riders * (1 - $protection)),
                        floor($town['coins'] / 10),
                        max(0, $town['coins'] - 50),
                    );
            $expected = [
                'id' => ($prior['id'] ?? 0) + 1,
                'atRun' => $town['completedRuns'],
                'gangSize' => $riders,
                'sheriffLevel' => $built['sheriff'],
                'bankLevel' => $built['bank'],
                'outcome' => $protection === 1.0 ? 'protected' : ($loss ? 'stolen' : 'harmless'),
                'loss' => (int) $loss,
                'seen' => false,
            ];
            if ($kind !== 'bandits') {
                $expected['kind'] = $kind;
                $expected['fireStationLevel'] = $built['fireStation'];
            }
            $target = null;
            foreach ($this->rules['economy']['incidentTargets'][$kind] as $id) {
                if ($built[$id]) {
                    $target = $id;
                    break;
                }
            }
            $expected['targets'] = [
                ...$kind === 'bandits' ? ['mine'] : [],
                ...$target ? [$target] : [],
            ];
            if (!self::same($event, $expected)) {
                self::mismatch('raid-encounter');
            }
            $town['events']['dusty-trail-visitors'] = $expected;
            $town['coins'] -= (int) $loss;
            $town['nextRaidRun'] = null;
        } elseif ($event !== null && !self::same($event, $prior)) {
            self::mismatch('raid-encounter');
        }
        if ($town['nextRaidRun'] === null && $population > 0) {
            [$min, $max] = $this->rules['economy']['raidIntervalByEra'][$town['era']];
            if (
                !self::integer(
                    $next,
                    min(9007199254740991, $town['completedRuns'] + $min),
                    min(9007199254740991, $town['completedRuns'] + $max),
                )
            ) {
                self::mismatch('nextRaidRun');
            }
            $town['nextRaidRun'] = $next;
        } elseif ($next !== $town['nextRaidRun']) {
            self::mismatch('nextRaidRun');
        }
    }
    private function reinforce(array &$s): void
    {
        $town = &$s['town'];
        if (!isset($town['events']['dusty-trail-visitors'])) {
            return;
        }
        $event = &$town['events']['dusty-trail-visitors'];
        if ($event['seen']) {
            return;
        }
        $kind = $event['kind'] ?? 'bandits';
        if (in_array($kind, ['workshop-fire', 'storm-cleanup'], true)) {
            $level = max($event['fireStationLevel'] ?? 0, $town['buildings']['fireStation']);
            if ($level === ($event['fireStationLevel'] ?? null)) {
                return;
            }
            $event['fireStationLevel'] = $level;
            $defenses = ['fireStation' => $level];
        } else {
            $sheriff = max($event['sheriffLevel'], $town['buildings']['sheriff']);
            $bank = max($event['bankLevel'] ?? 0, $town['buildings']['bank']);
            if ($sheriff === $event['sheriffLevel'] && $bank === ($event['bankLevel'] ?? 0)) {
                return;
            }
            $event['sheriffLevel'] = $sheriff;
            $event['bankLevel'] = $bank;
            $defenses = ['sheriff' => $sheriff, 'bank' => $bank];
        }
        // The shared calculation returns a float: PHP divides evenly divisible integers
        // to int 1, and full cover must still equal 1.0 for a 'protected' outcome.
        $protection = $this->protection(['buildings' => $defenses], $event['gangSize'], $kind);
        $remaining = ceil(5 * $event['gangSize'] * (1 - $protection));
        $loss = min(
            $event['loss'],
            !empty($event['bellRung']) ? floor($remaining / 2) : $remaining,
        );
        $this->addCoins($s, $event['loss'] - $loss);
        $event['loss'] = (int) $loss;
        $event['outcome'] = $protection === 1.0 ? 'protected' : ($loss ? 'stolen' : 'harmless');
    }
    private function advanceEra(array &$s, array $d): void
    {
        $town = &$s['town'];
        $index = $this->eraIndex($town['era']);
        $next = $this->rules['eraOrder'][$index + 1] ?? null;
        // Watching the era cinematic is not journaled, so a replayed checkpoint may
        // still show the last transition pending; the game itself waits for it.
        if (
            ($d['expectedEra'] ?? null) !== $town['era'] ||
            !$next ||
            !$this->rules['eras'][$next]['enabled'] ||
            (!empty($town['events']['dusty-trail-visitors']) &&
                !$town['events']['dusty-trail-visitors']['seen']) ||
            !$this->eraComplete($town)
        ) {
            self::mismatch('era-advance');
        }
        $town['era'] = $next;
    }
    /**
     * Every required plot of the town's current era is fully built and modernized, as
     * isEraComplete() in TownEras.js. Also reads a saved, unnormalized town (honours).
     */
    public function eraComplete(array $town): bool
    {
        if (
            !is_string($town['era'] ?? null) ||
            !is_array($this->rules['eraOrder'] ?? null) ||
            !is_array($this->rules['buildings'] ?? null)
        ) {
            return false;
        }
        $index = $this->eraIndex($town['era']);
        if ($index < 0) {
            return false;
        }
        foreach ($this->rules['buildings'] as $id => $definition) {
            if (
                !$definition['requiredForEraCompletion'] ||
                $this->eraIndex($definition['introducedEra']) > $index
            ) {
                continue;
            }
            // Normalized replay state is already clamped; older saves keep legacy levels.
            $level = $town['buildings'][$id] ?? 0;
            $level = is_int($level) ? min($definition['maxLevel'], $level) : 0;
            $eraLevel =
                $town['era'] === 'frontier' || $definition['introducedEra'] === $town['era']
                    ? $level
                    : (($town['buildingEras'][$id] ?? null) === $town['era']
                        ? ($town['buildingEraLevels'][$id] ?? 0 ?:
                        1)
                        : 0);
            if (
                $level !== $definition['maxLevel'] ||
                isset($town['projects'][$id]) ||
                ($town['era'] !== 'frontier' && $eraLevel !== $this->rules['eraBuildingLevels'])
            ) {
                return false;
            }
        }
        return true;
    }
    /** The level's current star score target, or null without a usable one. */
    public function starScoreTarget(int $level): int|float|null
    {
        $target = $this->rules['levels'][$level]['starScoreTarget'] ?? null;
        return self::number($target) && $target > 0 ? $target : null;
    }
}
