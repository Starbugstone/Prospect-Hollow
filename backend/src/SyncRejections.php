<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;

/**
 * Uploads the save protection rejected, kept so an admin can compare the cloud save,
 * the server's replayed expectation and the upload after a desync. A town counts as
 * blocked while its latest rejection was made against its current revision.
 */
final class SyncRejections
{
    /** Kept per town: enough to compare a burst of retries without growing the table. */
    public const KEPT = 5;
    /** Days a rejection is kept at most; the daily cleanup removes older ones. */
    public const KEEP_DAYS = 30;
    /** Admin edits of one reset, at most. */
    private const MAX_CHANGES = 200;
    /** The latest rejection made against the town's current revision (milliseconds in SQL). */
    public const BLOCKED_AT = '(SELECT MAX(r.rejected_at) FROM town_sync_rejections r WHERE r.town_id=t.id AND r.revision=t.revision)';

    /** Runs after the rejected save rolled back, so the record outlives it. */
    public static function record(
        Connection $db,
        array $row,
        string $upload,
        ?array $expected,
        ApiError $error,
    ): void {
        $db->insert('town_sync_rejections', [
            'id' => bin2hex(random_bytes(16)),
            'town_id' => $row['id'],
            'rejected_at' => (int) floor(microtime(true) * 1000),
            'revision' => (int) $row['revision'],
            'code' => substr((string) ($error->details['code'] ?? 'save_rejected'), 0, 64),
            'field' => is_string($error->details['field'] ?? null)
                ? mb_substr($error->details['field'], 0, 255)
                : null,
            'message' => mb_substr($error->getMessage(), 0, 255),
            'cloud' => $row['profile'],
            'upload' => $upload,
            'expected' => $expected === null ? null : json_encode($expected, JSON_THROW_ON_ERROR),
        ]);
        $kept = $db->fetchFirstColumn(
            'SELECT id FROM town_sync_rejections WHERE town_id=? ORDER BY rejected_at DESC,id LIMIT ' .
                self::KEPT,
            [$row['id']],
        );
        $db->executeStatement(
            'DELETE FROM town_sync_rejections WHERE town_id=? AND id NOT IN (?)',
            [$row['id'], $kept],
            [ParameterType::STRING, ArrayParameterType::STRING],
        );
    }
    public static function expire(Connection $db): void
    {
        $db->executeStatement('DELETE FROM town_sync_rejections WHERE rejected_at<?', [
            (time() - self::KEEP_DAYS * 86400) * 1000,
        ]);
    }
    /** Newest first, without the saves. */
    public static function list(Connection $db, string $town): array
    {
        return array_map(
            fn($row) => self::summary($row),
            $db->fetchAllAssociative(
                'SELECT id,rejected_at,revision,code,field,message,expected IS NOT NULL AS replayed FROM town_sync_rejections WHERE town_id=? ORDER BY rejected_at DESC,id',
                [$town],
            ),
        );
    }
    public static function find(Connection $db, string $town, string $id): array
    {
        $row = $db->fetchAssociative(
            'SELECT * FROM town_sync_rejections WHERE town_id=? AND id=?',
            [$town, $id],
        );
        if (!$row) {
            throw new ApiError(404, 'That sync rejection is no longer kept.');
        }
        return $row;
    }
    public static function summary(array $row): array
    {
        return [
            'id' => $row['id'],
            'at' => intdiv((int) $row['rejected_at'], 1000),
            'revision' => (int) $row['revision'],
            'code' => $row['code'],
            'field' => $row['field'],
            'message' => $row['message'],
            'replayed' => (bool) ($row['replayed'] ?? $row['expected'] !== null),
        ];
    }
    /**
     * Applies admin edits, each a key path and a JSON value, to a normalized save. Keys
     * may be added to maps and lists may grow by one; the integrity journal stays the
     * server's own.
     */
    public static function edit(array $state, mixed $changes): array
    {
        if (
            !is_array($changes) ||
            !array_is_list($changes) ||
            count($changes) > self::MAX_CHANGES
        ) {
            throw new ApiError(422, 'Send the edited values as a list.');
        }
        foreach ($changes as $change) {
            $change = is_object($change) ? get_object_vars($change) : null;
            $path = $change['path'] ?? null;
            if (
                !is_array($change) ||
                array_diff(array_keys($change), ['path', 'value']) ||
                !array_key_exists('value', $change) ||
                !is_array($path) ||
                !array_is_list($path) ||
                $path === [] ||
                count($path) > 8 ||
                array_filter(
                    $path,
                    fn($key) => !is_string($key) || !preg_match('/^[A-Za-z0-9_-]{1,64}$/D', $key),
                ) ||
                $path[0] === 'integrity'
            ) {
                throw new ApiError(422, 'An edited value has an invalid path.');
            }
            $value = json_decode(
                json_encode($change['value'], JSON_THROW_ON_ERROR),
                true,
                32,
                JSON_THROW_ON_ERROR,
            );
            $target = &$state;
            foreach (array_slice($path, 0, -1) as $key) {
                if (!is_array($target) || !array_key_exists($key, $target)) {
                    throw new ApiError(
                        422,
                        'An edited value is not in this save: ' . implode('.', $path),
                    );
                }
                $target = &$target[$key];
            }
            $last = end($path);
            if (
                !is_array($target) ||
                (array_is_list($target) &&
                    $target !== [] &&
                    !(ctype_digit($last) && (int) $last <= count($target)))
            ) {
                throw new ApiError(
                    422,
                    'An edited value is not in this save: ' . implode('.', $path),
                );
            }
            $target[$last] = $value;
            unset($target);
        }
        return $state;
    }
}
