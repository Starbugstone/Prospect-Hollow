<?php
// Exercise an interrupted initial install in isolated, randomly named tables.
// Never drop or alter the application's own tables, even on a shared test database.
$prefix='resume_'.bin2hex(random_bytes(5)).'_';
$directory=sys_get_temp_dir().'/'.$prefix;
mkdir($directory.'/src',0700,true);
$source=file_get_contents(dirname(__DIR__).'/src/Database.php');
$names=['schema_versions','players','sessions','login_intents','identities','limits','town_visits','towns','town_history','towns_owner','towns_public','sessions_player'];
$rewrite=static function(string $sql)use($names,$prefix):string {
 foreach($names as $name)$sql=preg_replace('/\b'.preg_quote($name,'/').'\b/',$prefix.$name,$sql);
 return $sql;
};
$source=str_replace('namespace App;', 'namespace MigrationResumeTest;', $rewrite($source));
file_put_contents($directory.'/src/Database.php',$source);
require $directory.'/src/Database.php';
$migration=new MigrationResumeTest\Database();$connection=$migration->get();
$mysql=$connection->getDatabasePlatform() instanceof Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
$file=$mysql?'schema.sql':'schema-postgresql.sql';
$schema=$rewrite(file_get_contents(dirname(__DIR__).'/'.$file));
$visits=$mysql?'schema-visits.sql':'schema-visits-postgresql.sql';
file_put_contents($directory.'/'.$visits,$rewrite(file_get_contents(dirname(__DIR__).'/'.$visits)));
try {
 $statements=explode(';',$schema);
 file_put_contents($directory.'/'.$file,implode(';',array_slice($statements,0,5)).'; INVALID_MIGRATION_STATEMENT;');
 try {$migration->migrate();throw new RuntimeException('Injected migration failure was ignored.');}
 catch(Doctrine\DBAL\Exception $expected) {}
 check($connection->createSchemaManager()->tablesExist([$prefix.'players'])===$mysql,'partial MySQL DDL survives while PostgreSQL rolls back');
 if($mysql)$connection->insert($prefix.'players',['id'=>'kept','email'=>'resume@example.test','created_at'=>1]);
 file_put_contents($directory.'/'.$file,$schema);
 $migration->migrate();
 check((int)$connection->fetchOne('SELECT MAX(version) FROM '.$prefix.'schema_versions')===11,'interrupted migration can resume');
 if($mysql)check($connection->fetchOne('SELECT id FROM '.$prefix.'players')==='kept','retry preserves existing rows');
 // Also model a crash after every DDL statement but before the final version marker.
 $connection->executeStatement('DELETE FROM '.$prefix.'schema_versions');
 $migration->migrate();$migration->migrate();
 check(count($connection->createSchemaManager()->listTableIndexes($prefix.'towns'))>=4,'retry preserves required indexes');
 check($connection->createSchemaManager()->tablesExist([$prefix.'town_visits']),'visit table installed after the initial schema');
} finally {
 foreach(['town_visits','town_history','towns','sessions','players','login_intents','identities','limits','schema_versions'] as $name)$connection->executeStatement('DROP TABLE IF EXISTS '.$prefix.$name);
 @unlink($directory.'/'.$file);@unlink($directory.'/'.$visits);unlink($directory.'/src/Database.php');rmdir($directory.'/src');rmdir($directory);
}
