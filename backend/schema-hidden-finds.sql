CREATE TABLE IF NOT EXISTS hidden_finds (player_id VARCHAR(64) NOT NULL, kind VARCHAR(32) NOT NULL, found_at BIGINT NOT NULL, town_id VARCHAR(36) NOT NULL, host_town_id VARCHAR(36), PRIMARY KEY(player_id,kind,found_at), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE, FOREIGN KEY (host_town_id) REFERENCES towns(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX hidden_finds_town ON hidden_finds(town_id,kind,found_at);
CREATE INDEX hidden_finds_host ON hidden_finds(host_town_id,kind,found_at);
INSERT INTO hidden_finds(player_id,kind,found_at,town_id,host_town_id) SELECT h.player_id,h.kind,h.found_at,h.town_id,h.host_town_id FROM helmet_finds h WHERE h.kind<>'helmet' AND NOT EXISTS (SELECT 1 FROM hidden_finds f WHERE f.player_id=h.player_id AND f.kind=h.kind AND f.found_at=h.found_at);
DELETE h FROM helmet_finds h WHERE h.kind<>'helmet' AND EXISTS (SELECT 1 FROM hidden_finds f WHERE f.player_id=h.player_id AND f.kind=h.kind AND f.found_at=h.found_at);
INSERT INTO schema_versions(version) VALUES (26);
