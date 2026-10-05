CREATE TABLE IF NOT EXISTS player_distinctions (player_id VARCHAR(64) NOT NULL, distinction_id VARCHAR(48) NOT NULL, awarded_at BIGINT NOT NULL, PRIMARY KEY(player_id,distinction_id), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT IGNORE INTO player_distinctions(player_id,distinction_id,awarded_at) SELECT id,'player-alpha',UNIX_TIMESTAMP() FROM players;
INSERT INTO schema_versions(version) VALUES (16);
