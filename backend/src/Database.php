<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\Configuration;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Exception\DeadlockException;
use Doctrine\DBAL\Tools\DsnParser;
final class Database
{
    /**
     * Schema files by version; a ready release has applied every one of them.
     *
     * Migrations are additive: they add tables, indexes and nullable or defaulted columns,
     * and never drop, rename or retype anything an earlier release reads. An earlier
     * release therefore still runs on a database a later one migrated, which keeps
     * `rollback RELEASE_ID` working. backend/tests/release-health.php checks the rule.
     */
    private const MIGRATIONS = [
        10 => '/schema',
        11 => '/schema-visits',
        12 => '/schema-saloon-guests',
        13 => '/schema-admin',
        14 => '/schema-live-visitors',
        15 => '/schema-town-favourites',
        // Grants Alpha Player to every account that exists when this release is deployed.
        16 => '/schema-player-distinctions',
        // Distinctions an admin removed (a cheater), kept apart so a mass grant skips them.
        17 => '/schema-distinction-revocations',
        // Admin settings, starting with how long the activity log is kept.
        18 => '/schema-admin-settings',
        // Signed-in visits recorded as such, private visits and confirmed email changes.
        19 => '/schema-player-data',
        // Space helmets found while visiting, redeemed by the finder's own town.
        20 => '/schema-helmet-finds',
        // Uploads the save protection rejected, for the admin sync log, and the admin's
        // one-shot acceptance of a town's next upload.
        21 => '/schema-force-sync',
        // The share-link view and a find check a host town's latest helmet find.
        22 => '/schema-helmet-host',
        // Expiring approvals bound to a reviewed rejected upload; retire boolean overrides.
        23 => '/schema-sync-approval',
    ];
    /** Tries of one outermost transaction, the first included, before a deadlock surfaces. */
    public const DEADLOCK_ATTEMPTS = 4;
    private ?Connection $connection = null;
    /** Tests may wrap the driver, for example to inject a deadlock. */
    public function __construct(private readonly ?Configuration $configuration = null) {}
    /**
     * Replays work only when the database rolled back this entire transaction, a few times
     * with a short random pause, then lets the last deadlock reach the caller.
     * @template T
     * @param \Closure(Connection): T $work
     * @return T
     */
    public static function retryOnDeadlock(Connection $db, \Closure $work): mixed
    {
        // A nested caller cannot replay work whose outer transaction was aborted.
        if ($db->getTransactionNestingLevel() > 0) {
            return $db->transactional($work);
        }
        for ($attempt = 1; ; $attempt++) {
            try {
                return $db->transactional($work);
            } catch (DeadlockException $error) {
                if ($attempt >= self::DEADLOCK_ATTEMPTS) {
                    throw $error;
                }
                // The winner commits during the pause: 5 to 20 ms, then up to 40 and 80 ms.
                // A random length keeps the aborted requests from meeting again in step.
                usleep(random_int(5000, 20000 << ($attempt - 1)));
            }
        }
    }
    public static function latestVersion(): int
    {
        return array_key_last(self::MIGRATIONS);
    }
    /** @return array<int, string> schema file stems by version, oldest first */
    public static function migrations(): array
    {
        return self::MIGRATIONS;
    }
    /**
     * Ready once every migration this release knows is applied. Newer versions from a
     * later release are accepted because migrations are additive.
     */
    public static function schemaReady(Connection $db): bool
    {
        $applied = array_map(
            'intval',
            $db->fetchFirstColumn('SELECT version FROM schema_versions WHERE version >= ?', [
                array_key_first(self::MIGRATIONS),
            ]),
        );
        return !array_diff(array_keys(self::MIGRATIONS), $applied);
    }
    /**
     * Every migration's schema file for MySQL or PostgreSQL, in order, relative to the
     * backend directory.
     * @return list<string>
     */
    public static function migrationFiles(bool $mysql): array
    {
        return array_map(
            fn(string $name) => self::schemaFile($name, $mysql),
            array_values(self::MIGRATIONS),
        );
    }
    private static function schemaFile(string $name, bool $mysql): string
    {
        return ltrim($name, '/') . ($mysql ? '' : '-postgresql') . '.sql';
    }
    public function isMySql(): bool
    {
        return $this->get()->getDatabasePlatform() instanceof
            \Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
    }
    public function get(): Connection
    {
        if ($this->connection) {
            return $this->connection;
        }
        $url = \App\Env::get('DATABASE_URL');
        if (!is_string($url) || $url === '') {
            throw new \RuntimeException('DATABASE_URL is required.');
        }
        $params = (new DsnParser([
            'postgresql' => 'pdo_pgsql',
            'postgres' => 'pdo_pgsql',
            'mysql' => 'pdo_mysql',
        ]))->parse($url);
        if (!in_array($params['driver'] ?? '', ['pdo_pgsql', 'pdo_mysql'], true)) {
            throw new \RuntimeException('Use PostgreSQL or MySQL.');
        }
        if ($params['driver'] === 'pdo_mysql') {
            $params['charset'] = 'utf8mb4';
        }
        return $this->connection = DriverManager::getConnection($params, $this->configuration);
    }
    public function migrate(): void
    {
        $db = $this->get();
        // Run once from the deployment CLI, never automatically in an HTTP request.
        $db->executeStatement(
            'CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY)',
        );
        $mysql = $this->isMySql();
        if ($db->fetchOne('SELECT version FROM schema_versions WHERE version<10')) {
            throw new \RuntimeException(
                'This undeployed prototype schema must be replaced with a fresh database.',
            );
        }
        foreach (self::MIGRATIONS as $version => $file) {
            if ($db->fetchOne('SELECT version FROM schema_versions WHERE version=?', [$version])) {
                continue;
            }
            $schema = file_get_contents(dirname(__DIR__) . '/' . self::schemaFile($file, $mysql));
            $apply = function () use ($db, $schema): void {
                foreach (explode(';', $schema) as $statement) {
                    $statement = trim($statement);
                    if ($statement === '') {
                        continue;
                    }
                    // MySQL can commit DDL before an interrupted install records its version.
                    // Tables are idempotent; indexes and added columns need a portable
                    // existence check.
                    if (preg_match('/^CREATE INDEX (\w+) ON (\w+)\(/i', $statement, $index)) {
                        $indexes = $db->createSchemaManager()->listTableIndexes($index[2]);
                        if (isset($indexes[strtolower($index[1])])) {
                            continue;
                        }
                    }
                    if (preg_match('/^ALTER TABLE (\w+) ADD COLUMN (\w+) /i', $statement, $add)) {
                        $columns = $db->createSchemaManager()->listTableColumns($add[1]);
                        if (isset(array_change_key_case($columns)[strtolower($add[2])])) {
                            continue;
                        }
                    }
                    $db->executeStatement($statement);
                }
            };
            // MySQL DDL implicitly commits; PostgreSQL migrations are atomic.
            if ($mysql) {
                $apply();
            } else {
                $db->transactional($apply);
            }
        }
    }
}
