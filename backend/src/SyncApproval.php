<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\Connection;

/** A one-shot exception for the exact rejected profile an admin reviewed. */
final class SyncApproval
{
    public const SECONDS = 86400;

    /** Ignore object key order, but preserve list order and every profile field. */
    public static function fingerprint(string $json): string
    {
        $sort = function (mixed $value) use (&$sort): mixed {
            if ($value instanceof \stdClass) {
                $fields = get_object_vars($value);
                ksort($fields, SORT_STRING);
                return (object) array_map($sort, $fields);
            }
            return is_array($value) ? array_map($sort, $value) : $value;
        };
        return hash(
            'sha256',
            json_encode(
                $sort(json_decode($json, false, 64, JSON_THROW_ON_ERROR)),
                JSON_THROW_ON_ERROR,
            ),
        );
    }

    public static function issue(array $town, array $rejection): array
    {
        if ((int) $rejection['revision'] !== (int) $town['revision']) {
            throw new ApiError(
                409,
                'The town saved again. Compare a rejection at its current revision.',
            );
        }
        return [
            'townId' => $town['id'],
            'playerId' => $town['player_id'],
            'rejectionId' => $rejection['id'],
            'rejectedAt' => intdiv((int) $rejection['rejected_at'], 1000),
            'revision' => (int) $town['revision'],
            'profileHash' => self::fingerprint($rejection['upload']),
            'expiresAt' => time() + self::SECONDS,
        ];
    }

    /** Also used by the admin UI so a stale exception is never shown as armed. */
    public static function view(Connection $db, array $town): array
    {
        $approval = json_decode($town['sync_approval'] ?? 'null', true, 64, JSON_THROW_ON_ERROR);
        $status = 'none';
        if ($approval !== null) {
            $status = 'pending';
            if ($approval['expiresAt'] <= time()) {
                $status = 'expired';
            } elseif (
                $approval['townId'] !== $town['id'] ||
                $approval['playerId'] !== $town['player_id'] ||
                $approval['revision'] !== (int) $town['revision'] ||
                ($town['deleted_at'] ?? null) !== null ||
                !$db->fetchOne(
                    'SELECT 1 FROM town_sync_rejections WHERE town_id=? AND id=? AND revision=?',
                    [$town['id'], $approval['rejectionId'], $approval['revision']],
                )
            ) {
                $status = 'stale';
            }
        }
        return [
            'forceSync' => $status === 'pending',
            'forceSyncUntil' => $approval['expiresAt'] ?? null,
            'syncApproval' =>
                $approval === null
                    ? null
                    : [
                        'status' => $status,
                        'rejectionId' => $approval['rejectionId'],
                        'rejectedAt' => $approval['rejectedAt'],
                        'revision' => $approval['revision'],
                        'profileHash' => $approval['profileHash'],
                    ],
        ];
    }

    public static function matches(Connection $db, array $town, string $profile): bool
    {
        $view = self::view($db, $town);
        return $view['forceSync'] &&
            hash_equals($view['syncApproval']['profileHash'], self::fingerprint($profile));
    }

    public static function clear(): array
    {
        return ['force_sync' => 0, 'sync_approval' => null];
    }
}
