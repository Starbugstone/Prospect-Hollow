CREATE TABLE IF NOT EXISTS helmet_finds (player_id VARCHAR(64) NOT NULL, found_at BIGINT NOT NULL, town_id VARCHAR(36) NOT NULL, host_town_id VARCHAR(36), PRIMARY KEY(player_id,found_at), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE, FOREIGN KEY (host_town_id) REFERENCES towns(id) ON DELETE SET NULL);
CREATE INDEX helmet_finds_town ON helmet_finds(town_id,found_at);
INSERT INTO schema_versions(version) VALUES (20);
