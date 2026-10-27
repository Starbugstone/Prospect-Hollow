<?php
declare(strict_types=1);
namespace App;

use Doctrine\DBAL\ArrayParameterType;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\ParameterType;

/**
 * Sync events: uploads the save protection rejected or corrected, kept so an admin can
 * read the cause (the findings) and compare the cloud save, the server's replayed
 * expectation and the upload. A town counts as blocked while its latest rejection was
 * made against its current revision. A corrected upload was saved with the replay's
 * values; repeated corrections in the player's favour flag the town for review.
 */
final class SyncRejections
{
    public const REJECTED = 'rejected';
    public const CORRECTED = 'corrected';
    /** Corrections in the player's favour among the kept events that flag a town for review. */
    public const REVIEW_AFTER = 3;
    /** Kept per town: enough to compare a burst of retries without growing the table. */
    public const KEPT = 5;
    /** Days a rejection is kept at most; the daily cleanup removes older ones. */
    public const KEEP_DAYS = 30;
    /** Keep one immutable full comparison per revision during a retry burst. */
    public const THROTTLE_MS = 60000;
    /**
     * Full comparisons a town stores per window across revisions. An unchanged accepted
     * save raises the revision, so this caps alternating saves and refused uploads while
     * a genuine refusal after a newly accepted save is still captured at once.
     */
    public const WINDOW_CAPTURES = 2;
    /** Admin edits of one reset, at most. */
    private const MAX_CHANGES = 200;
    /** The latest rejection made against the town's current revision (milliseconds in SQL). */
    public const BLOCKED_AT = "(SELECT MAX(r.rejected_at) FROM town_sync_rejections r WHERE r.town_id=t.id AND r.revision=t.revision AND r.outcome='rejected')";
    /** Whether the kept events flag the town for review (1 or 0, in SQL). */
    public const REVIEW =
        "(CASE WHEN (SELECT COUNT(*) FROM town_sync_rejections r WHERE r.town_id=t.id AND r.outcome='corrected' AND r.favourable=1)>=" .
        self::REVIEW_AFTER .
        ' THEN 1 ELSE 0 END)';

    /** A refused upload's event: its error, and the action the replay stopped at. */
    public static function rejection(ApiError $error, ?string $build): array
    {
        $finding = $error->details['finding'] ?? null;
        if ($finding === null && isset($error->details['check'])) {
            $finding = array_intersect_key(
                $error->details,
                array_flip(['field', 'check', 'server', 'client']),
            );
        }
        return [
            'outcome' => self::REJECTED,
            'code' => (string) ($error->details['code'] ?? 'save_rejected'),
            'field' => is_string($error->details['field'] ?? null)
                ? $error->details['field']
                : null,
            'message' => $error->getMessage(),
            'findings' => $finding === null ? [] : [$finding],
            'build' => $build,
            'favourable' => false,
        ];
    }
    /** A corrected upload's event: saved with the replay's values, each listed. */
    public static function correction(array $findings, bool $favourable, ?string $build): array
    {
        // The comparison highlights the first value the server corrected.
        $values = array_values(array_filter($findings, fn($f) => $f['kind'] === 'value'));
        return [
            'outcome' => self::CORRECTED,
            'code' => 'save_corrected',
            'field' => $values[0]['field'] ?? null,
            'message' => 'The server replayed this upload and saved its own values.',
            'findings' => $findings,
            'build' => $build,
            'favourable' => $favourable,
        ];
    }
    /**
     * A rejection runs after the refused save rolled back, so the record outlives it; a
     * correction runs inside the save that stores the corrected revision.
     */
    public static function record(
        Connection $db,
        array $row,
        string $upload,
        ?array $expected,
        array $event,
    ): void {
        Database::retryOnDeadlock($db, function () use ($db, $row, $upload, $expected, $event) {
            // Recording happens after the failed save released its locks. Serialize
            // captures on the town so concurrent retries cannot each store a copy.
            if (
                !$db->fetchOne(
                    'SELECT id FROM towns WHERE id=? AND deleted_at IS NULL FOR UPDATE',
                    [$row['id']],
                )
            ) {
                return;
            }
            $now = (int) floor(microtime(true) * 1000);
            // Retries of a refused upload are throttled. A correction is an accepted save
            // at its own revision (bounded by the save rate limit and KEPT): always kept,
            // since it is the only way support can restore that upload.
            $recent = $db->fetchAssociative(
                "SELECT COUNT(*) AS captures, COALESCE(SUM(CASE WHEN revision=? THEN 1 ELSE 0 END),0) AS same FROM town_sync_rejections WHERE town_id=? AND rejected_at>? AND outcome='rejected'",
                [(int) $row['revision'], $row['id'], $now - self::THROTTLE_MS],
            );
            if (
                $event['outcome'] === self::REJECTED &&
                ((int) ($recent['same'] ?? 0) > 0 ||
                    (int) ($recent['captures'] ?? 0) >= self::WINDOW_CAPTURES)
            ) {
                // Keep the original reason with its original upload and expectation:
                // an admin may inspect or restore that exact comparison later.
                return;
            }
            $db->insert('town_sync_rejections', [
                'id' => bin2hex(random_bytes(16)),
                'town_id' => $row['id'],
                'rejected_at' => $now,
                'revision' => (int) $row['revision'],
                'outcome' => $event['outcome'],
                'code' => substr($event['code'], 0, 64),
                'field' => $event['field'] === null ? null : mb_substr($event['field'], 0, 255),
                'message' => mb_substr($event['message'], 0, 255),
                'findings' => $event['findings']
                    ? json_encode($event['findings'], JSON_THROW_ON_ERROR)
                    : null,
                'client_build' => $event['build'],
                'favourable' => (int) $event['favourable'],
                'cloud' => $row['profile'],
                'upload' => $upload,
                'expected' =>
                    $expected === null ? null : json_encode($expected, JSON_THROW_ON_ERROR),
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
        });
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
                'SELECT id,rejected_at,revision,outcome,code,field,message,findings,client_build,favourable,expected IS NOT NULL AS replayed FROM town_sync_rejections WHERE town_id=? ORDER BY rejected_at DESC,id',
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
        $build = $row['client_build'] ?? null;
        return [
            'id' => $row['id'],
            'at' => intdiv((int) $row['rejected_at'], 1000),
            'revision' => (int) $row['revision'],
            'outcome' => $row['outcome'] ?? self::REJECTED,
            'code' => $row['code'],
            'field' => $row['field'],
            'message' => $row['message'],
            'findings' => self::findings($row['findings'] ?? null),
            'clientBuild' => $build,
            // False when an older game with other save rules sent it; null when unknown.
            'sameRules' => SaveIntegrity::sameRules($build),
            'favourable' => (bool) ($row['favourable'] ?? false),
            'replayed' => (bool) ($row['replayed'] ?? $row['expected'] !== null),
        ];
    }
    /** Stored findings; a record that cannot be read never hides the rest of the log. */
    private static function findings(?string $json): array
    {
        try {
            $findings = json_decode($json ?? '[]', true, 64, JSON_THROW_ON_ERROR);
        } catch (\JsonException) {
            return [];
        }
        return is_array($findings) ? $findings : [];
    }
    /**
     * The town revision an admin can still reset from this event: a rejection's own
     * revision, or the corrected revision it saved (its revision plus one).
     */
    public static function resettable(array $row): int
    {
        return (int) $row['revision'] +
            (($row['outcome'] ?? self::REJECTED) === self::CORRECTED ? 1 : 0);
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
