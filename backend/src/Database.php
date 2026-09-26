<?php
declare(strict_types=1);
namespace App;
use Doctrine\DBAL\Connection;
use Doctrine\DBAL\DriverManager;
use Doctrine\DBAL\Tools\DsnParser;
final class Database {
    private ?Connection $connection = null;
    public function get(): Connection {
        if ($this->connection) return $this->connection;
        $url=$_ENV['DATABASE_URL'] ?? getenv('DATABASE_URL');
        if (!is_string($url) || $url==='') throw new \RuntimeException('DATABASE_URL is required.');
        $params=(new DsnParser(['postgresql'=>'pdo_pgsql','postgres'=>'pdo_pgsql','mysql'=>'pdo_mysql']))->parse($url);
        if (!in_array($params['driver'] ?? '',['pdo_pgsql','pdo_mysql'],true)) throw new \RuntimeException('Use PostgreSQL or MySQL.');
        if ($params['driver']==='pdo_mysql') $params['charset']='utf8mb4';
        return $this->connection=DriverManager::getConnection($params);
    }
    public function migrate(): void {
        $db=$this->get();
        // Run once from the deployment CLI, never automatically in an HTTP request.
        $db->executeStatement('CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY)');
        $mysql=$db->getDatabasePlatform() instanceof \Doctrine\DBAL\Platforms\AbstractMySQLPlatform;
        $suffix=$mysql?'':'-postgresql';
        if($db->fetchOne('SELECT version FROM schema_versions WHERE version<10')) throw new \RuntimeException('This undeployed prototype schema must be replaced with a fresh database.');
        foreach([10=>'/schema'.$suffix.'.sql'] as $version=>$file) {
            if($db->fetchOne('SELECT version FROM schema_versions WHERE version=?',[$version]))continue;
            $schema=file_get_contents(dirname(__DIR__).$file);
            $apply=function() use($db,$schema): void {
                foreach(explode(';',$schema) as $statement)if(trim($statement)!=='')$db->executeStatement(trim($statement));
            };
            // MySQL DDL implicitly commits; PostgreSQL migrations are atomic.
            if($mysql)$apply();else $db->transactional($apply);
        }
    }
}
