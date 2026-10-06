<?php
// Exercise an interrupted initial install in isolated, randomly named tables.
// Never drop or alter the application's own tables, even on a shared test database.
$prefix = 'resume_' . bin2hex(random_bytes(5)) . '_';
$directory = sys_get_temp_dir() . '/' . $prefix;
mkdir($directory . '/src', 0700, true);
$source = file_get_contents(dirname(__DIR__) . '/src/Database.php');
$names = [
    'email_changes_player',
    'email_changes',
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
$file = $mysql ? 'schema.sql' : 'schema-postgresql.sql';
$schema = $rewrite(file_get_contents(dirname(__DIR__) . '/' . $file));
$visits = $mysql ? 'schema-visits.sql' : 'schema-visits-postgresql.sql';
file_put_contents(
    $directory . '/' . $visits,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $visits)),
);
$split = $mysql ? 'schema-saloon-guests.sql' : 'schema-saloon-guests-postgresql.sql';
file_put_contents(
    $directory . '/' . $split,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $split)),
);
$admin = $mysql ? 'schema-admin.sql' : 'schema-admin-postgresql.sql';
file_put_contents(
    $directory . '/' . $admin,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $admin)),
);
$live = $mysql ? 'schema-live-visitors.sql' : 'schema-live-visitors-postgresql.sql';
file_put_contents(
    $directory . '/' . $live,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $live)),
);
$favourites = $mysql ? 'schema-town-favourites.sql' : 'schema-town-favourites-postgresql.sql';
file_put_contents(
    $directory . '/' . $favourites,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $favourites)),
);
$distinctions = $mysql
    ? 'schema-player-distinctions.sql'
    : 'schema-player-distinctions-postgresql.sql';
file_put_contents(
    $directory . '/' . $distinctions,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $distinctions)),
);
$settings = $mysql ? 'schema-admin-settings.sql' : 'schema-admin-settings-postgresql.sql';
file_put_contents(
    $directory . '/' . $settings,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $settings)),
);
$revocations = $mysql
    ? 'schema-distinction-revocations.sql'
    : 'schema-distinction-revocations-postgresql.sql';
file_put_contents(
    $directory . '/' . $revocations,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $revocations)),
);
$playerData = $mysql ? 'schema-player-data.sql' : 'schema-player-data-postgresql.sql';
file_put_contents(
    $directory . '/' . $playerData,
    $rewrite(file_get_contents(dirname(__DIR__) . '/' . $playerData)),
);
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
            isset(
                array_change_key_case(
                    $connection
                        ->createSchemaManager()
                        ->listTableColumns($prefix . 'visitor_visits'),
                )['signed_in'],
            ),
        'email changes and signed-in visits installed, also when the migration is repeated',
    );
} finally {
    foreach (
        [
            'email_changes',
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
    @unlink($directory . '/' . $file);
    @unlink($directory . '/' . $visits);
    @unlink($directory . '/' . $split);
    @unlink($directory . '/' . $admin);
    @unlink($directory . '/' . $live);
    @unlink($directory . '/' . $favourites);
    @unlink($directory . '/' . $distinctions);
    @unlink($directory . '/' . $revocations);
    @unlink($directory . '/' . $settings);
    @unlink($directory . '/' . $playerData);
    unlink($directory . '/src/Database.php');
    rmdir($directory . '/src');
    rmdir($directory);
}
