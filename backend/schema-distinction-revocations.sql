CREATE TABLE IF NOT EXISTS player_distinction_revocations (player_id VARCHAR(64) NOT NULL, distinction_id VARCHAR(48) NOT NULL, revoked_at BIGINT NOT NULL, PRIMARY KEY(player_id,distinction_id), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO schema_versions(version) VALUES (17);
