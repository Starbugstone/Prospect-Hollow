<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Tools\DsnParser;
final class Database
{
    /** Schema files by version; a ready release has applied the last one. */
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
    ];
    private ?Connection $connection = null;
    public static function latestVersion(): int
    {
        return array_key_last(self::MIGRATIONS);
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
        return $this->connection = DriverManager::getConnection($params);
    }
    public function migrate(): void
    {
        $db = $this->get();
        // Run once from the deployment CLI, never automatically in an HTTP request.
        $db->executeStatement(
            'CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY)',
        );
        $mysql = $this->isMySql();
        $suffix = $mysql ? '' : '-postgresql';
        if ($db->fetchOne('SELECT version FROM schema_versions WHERE version<10')) {
            throw new \RuntimeException(
                'This undeployed prototype schema must be replaced with a fresh database.',
            );
        }
        foreach (self::MIGRATIONS as $version => $file) {
            if ($db->fetchOne('SELECT version FROM schema_versions WHERE version=?', [$version])) {
                continue;
            }
            $schema = file_get_contents(dirname(__DIR__) . $file . $suffix . '.sql');
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
