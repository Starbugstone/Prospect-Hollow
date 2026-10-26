<?php
// Exercise an interrupted initial install in isolated, randomly named tables.
// Never drop or alter the application's own tables, even on a shared test database.
require __DIR__ . '/support.php';
$prefix = 'resume_' . bin2hex(random_bytes(5)) . '_';
$directory = sys_get_temp_dir() . '/' . $prefix;
mkdir($directory . '/src', 0700, true);
$source = file_get_contents(dirname(__DIR__) . '/src/Database.php');
$names = [
    'town_sync_rejections_town',
    'town_sync_rejections',
    'town_travels',
    'email_changes_player',
    'email_changes',
    'helmet_finds_host',
    'helmet_finds_town',
    'helmet_finds',
    'admin_settings',
    'player_distinction_revocations',
    'player_distinctions',
    'town_favourites',
    'visitor_visits_visitor',
    'player_profiles',
    'visitor_visits',
    'visitor_leases',
    'visitor_visits_history',
    'visitor_visits_identity',
    'visitor_leases_visit',
    'schema_versions',
    'players',
    'sessions',
    'login_intents',
    'identities',
    'limits',
    'town_visits',
    'saloon_collections',
    'town_guests',
    'towns',
    'town_history',
    'towns_owner',
    'towns_public',
    'sessions_player',
    'player_activity',
    'activity_days',
    'admins',
    'admin_sessions',
    'admin_audit',
    'activity_seen',
    'admin_sessions_admin',
    'players_created',
];
$rewrite = static function (string $sql) use ($names, $prefix): string {
    foreach ($names as $name) {
        $sql = preg_replace('/\b' . preg_quote($name, '/') . '\b/', $prefix . $name, $sql);
    }
    return $sql;
};
$source = str_replace('namespace App;', 'namespace MigrationResumeTest;', $rewrite($source));
file_put_contents($directory . '/src/Database.php', $source);
require $directory . '/src/Database.php';
$migration = new MigrationResumeTest\Database();
$connection = $migration->get();
$mysql =
    $connection->getDatabasePlatform() instanceof Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
// Every migration file Database.php applies, renamed into the isolated tables.
$files = App\Database::migrationFiles($mysql);
foreach ($files as $name) {
    $sql = file_get_contents(dirname(__DIR__) . '/' . $name);
    // A table or index left out of $names would be created or changed for real.
    preg_match_all(
        '/CREATE (?:UNIQUE )?(?:TABLE|INDEX)(?: IF NOT EXISTS)? (\w+)/i',
        $sql,
        $created,
    );
    foreach ($created[1] as $table) {
        if (!in_array(strtolower($table), $names, true)) {
            throw new RuntimeException("Add $table from $name to the isolated names.");
        }
    }
    file_put_contents($directory . '/' . $name, $rewrite($sql));
}
$file = $files[0];
$schema = file_get_contents($directory . '/' . $file);
$syncApproval = $mysql ? 'schema-sync-approval.sql' : 'schema-sync-approval-postgresql.sql';
if (!in_array($syncApproval, $files, true)) {
    throw new RuntimeException('The approval migration this test interrupts is not listed.');
}
$approvalSchema = file_get_contents($directory . '/' . $syncApproval);
try {
    $statements = explode(';', $schema);
    file_put_contents(
        $directory . '/' . $file,
        implode(';', array_slice($statements, 0, 5)) . '; INVALID_MIGRATION_STATEMENT;',
    );
    try {
        $migration->migrate();
        throw new RuntimeException('Injected migration failure was ignored.');
    } catch (Doctrine\DBAL\Exception $expected) {
    }
    check(
        $connection->createSchemaManager()->tablesExist([$prefix . 'players']) === $mysql,
        'partial MySQL DDL survives while PostgreSQL rolls back',
    );
    if ($mysql) {
        $connection->insert($prefix . 'players', [
            'id' => 'kept',
            'email' => 'resume@example.test',
            'created_at' => 1,
        ]);
    }
    file_put_contents($directory . '/' . $file, $schema);
    $migration->migrate();
    check(
        (int) $connection->fetchOne('SELECT MAX(version) FROM ' . $prefix . 'schema_versions') ===
            App\Database::latestVersion(),
        'interrupted migration can resume',
    );
    if ($mysql) {
        check(
            $connection->fetchOne('SELECT id FROM ' . $prefix . 'players') === 'kept',
            'retry preserves existing rows',
        );
    }
    if (!$mysql) {
        // PostgreSQL rolled back the first attempt, so this account joins afterwards.
        $connection->insert($prefix . 'players', [
            'id' => 'kept',
            'email' => 'resume@example.test',
            'created_at' => 1,
        ]);
    }
    // A deployed v22 town can still have the old indefinite boolean set. Model a
    // crash after the new column DDL, before clearing that flag and recording v23.
    $connection->insert($prefix . 'towns', [
        'id' => 'legacy-approval',
        'player_id' => 'kept',
        'name' => 'Legacy',
        'normalized_name' => 'legacy',
        'revision' => 1,
        'profile' => '{}',
        'saved_at' => 1,
        'public_id' => str_repeat('a', 32),
        'force_sync' => 1,
    ]);
    $connection->executeStatement('DELETE FROM ' . $prefix . 'schema_versions WHERE version=23');
    $connection->executeStatement('ALTER TABLE ' . $prefix . 'towns DROP COLUMN sync_approval');
    file_put_contents(
        $directory . '/' . $syncApproval,
        explode(';', $approvalSchema)[0] . '; INVALID_APPROVAL_MIGRATION;',
    );
    try {
        $migration->migrate();
        throw new RuntimeException('Injected approval migration failure was ignored.');
    } catch (Doctrine\DBAL\Exception $expected) {
    }
    check(
        isset(
            $connection->createSchemaManager()->listTableColumns($prefix . 'towns')[
                'sync_approval'
            ],
        ) === $mysql,
        'approval DDL resumes after MySQL commit or PostgreSQL rollback',
    );
    file_put_contents($directory . '/' . $syncApproval, $approvalSchema);
    $migration->migrate();
    $legacy = $connection->fetchAssociative(
        'SELECT force_sync,sync_approval FROM ' . $prefix . 'towns WHERE id=?',
        ['legacy-approval'],
    );
    check(
        (int) $legacy['force_sync'] === 0 && $legacy['sync_approval'] === null,
        'v23 expires deployed boolean approvals on resume',
    );
    // Also model a crash after every DDL statement but before the final version marker.
    $connection->executeStatement('DELETE FROM ' . $prefix . 'schema_versions');
    $migration->migrate();
    $migration->migrate();
    check(
        $connection->fetchAllAssociative(
            'SELECT player_id,distinction_id FROM ' . $prefix . 'player_distinctions',
        ) === [['player_id' => 'kept', 'distinction_id' => 'player-alpha']],
        'existing accounts receive Alpha Player once, also when the migration is repeated',
    );
    check(
        count($connection->createSchemaManager()->listTableIndexes($prefix . 'towns')) >= 4,
        'retry preserves required indexes',
    );
    check(
        $connection
            ->createSchemaManager()
            ->tablesExist([$prefix . 'saloon_collections', $prefix . 'town_guests']) &&
            !$connection->createSchemaManager()->tablesExist([$prefix . 'town_visits']),
        'saloon and guest tables replace the combined visit table',
    );
    check(
        $connection
            ->createSchemaManager()
            ->tablesExist([
                $prefix . 'player_activity',
                $prefix . 'activity_days',
                $prefix . 'admins',
                $prefix . 'admin_sessions',
                $prefix . 'admin_audit',
            ]),
        'admin and activity tables installed',
    );
    check(
        $connection
            ->createSchemaManager()
            ->tablesExist([
                $prefix . 'player_profiles',
                $prefix . 'visitor_visits',
                $prefix . 'visitor_leases',
            ]),
        'public profiles and live visitor history installed',
    );
    check(
        $connection->createSchemaManager()->tablesExist([$prefix . 'town_favourites']),
        'town favourites installed',
    );
    check(
        $connection
            ->createSchemaManager()
            ->tablesExist([$prefix . 'player_distinction_revocations']),
        'distinction revocations installed',
    );
    check(
        $connection->createSchemaManager()->tablesExist([$prefix . 'admin_settings']),
        'admin settings installed',
    );
    check(
        $connection->createSchemaManager()->tablesExist([$prefix . 'email_changes']) &&
            $connection->createSchemaManager()->tablesExist([$prefix . 'town_travels']) &&
            isset(
                array_change_key_case(
                    $connection
                        ->createSchemaManager()
                        ->listTableColumns($prefix . 'visitor_visits'),
                )['signed_in'],
            ),
        'email changes and signed-in visits installed, also when the migration is repeated',
    );
    check(
        $connection->createSchemaManager()->tablesExist([$prefix . 'helmet_finds']) &&
            isset(
                $connection->createSchemaManager()->listTableIndexes($prefix . 'helmet_finds')[
                    $prefix . 'helmet_finds_host'
                ],
            ),
        'space-helmet finds installed with their host index, also when the migration is repeated',
    );
} finally {
    foreach (
        [
            'town_sync_rejections',
            'town_travels',
            'email_changes',
            'helmet_finds',
            'admin_settings',
            'player_distinction_revocations',
            'player_distinctions',
            'town_favourites',
            'visitor_leases',
            'visitor_visits',
            'player_profiles',
            'admin_sessions',
            'admin_audit',
            'admins',
            'activity_days',
            'player_activity',
            'town_visits',
            'saloon_collections',
            'town_guests',
            'town_history',
            'towns',
            'sessions',
            'players',
            'login_intents',
            'identities',
            'limits',
            'schema_versions',
        ]
        as $name
    ) {
        $connection->executeStatement('DROP TABLE IF EXISTS ' . $prefix . $name);
    }
    foreach ($files as $name) {
        @unlink($directory . '/' . $name);
    }
    unlink($directory . '/src/Database.php');
    rmdir($directory . '/src');
    rmdir($directory);
}
echo "Migration resume checks passed ($count assertions).\n";
