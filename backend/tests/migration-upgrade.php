<?php
declare(strict_types=1);
require dirname(__DIR__).'/vendor/autoload.php';
use App\{Content,Database};
$url=getenv('TEST_DATABASE_URL');if(!$url)throw new RuntimeException('Set TEST_DATABASE_URL to an empty disposable database.');
$_ENV['DATABASE_URL']=$url;$database=new Database();$db=$database->get();
if($db->createSchemaManager()->tablesExist(['players']))throw new RuntimeException('Upgrade test requires an empty disposable database.');
$mysql=$db->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
$schema=file_get_contents(dirname(__DIR__).($mysql?'/schema.sql':'/schema-postgresql.sql'));
$legacy=explode('CREATE TABLE IF NOT EXISTS public_villages',$schema)[0];
foreach(explode(';',$legacy) as $sql)if(trim($sql)!=='')$db->executeStatement(trim($sql));
$id='migration-'.bin2hex(random_bytes(10));$profile=(new Content())->fresh();unset($profile['community']);$profile['town']['coins']=12567;
$json=json_encode($profile,JSON_THROW_ON_ERROR);$db->insert('players',['id'=>$id,'profile'=>$json,'revision'=>7,'created_at'=>time(),'saved_at'=>time()]);
try {
 $database->migrate();$database->migrate();
 if(!$db->fetchOne('SELECT version FROM schema_versions WHERE version=2'))throw new RuntimeException('Missing community migration');
 $saved=$db->fetchAssociative('SELECT profile,revision FROM players WHERE id=?',[$id]);
 if($saved['profile']!==$json||(int)$saved['revision']!==7)throw new RuntimeException('Upgrade rewrote a private save');
 if((int)$db->fetchOne('SELECT COUNT(*) FROM public_villages')!==0)throw new RuntimeException('Upgrade published a village without consent');
 // A previously listed Contemporary village used rank 5 before two eras were inserted.
 $db->insert('public_villages',['id'=>str_repeat('a',32),'player_id'=>$id,'name'=>'Upgrade test','era_rank'=>5,'building_score'=>10,'mines_cleared'=>20,'population'=>5,'appearance'=>json_encode(['era'=>'contemporary'])]);
 $db->delete('schema_versions',['version'=>3]);$database->migrate();$database->migrate();
 if((int)$db->fetchOne('SELECT era_rank FROM public_villages WHERE player_id=?',[$id])!==7)throw new RuntimeException('Existing Contemporary village rank was not upgraded');
 if($db->fetchOne('SELECT profile FROM players WHERE id=?',[$id])!==$json)throw new RuntimeException('Rank migration changed private progress');
 echo "Era rank upgrade preserves existing Contemporary villages and private progress.\n";
 echo "Version 1 upgrade preserves private saves, defaults to unlisted and is repeatable.\n";
} finally {$db->delete('players',['id'=>$id]);}
