CREATE TABLE IF NOT EXISTS player_profiles (player_id VARCHAR(64) PRIMARY KEY, display_name VARCHAR(96) NOT NULL DEFAULT '', visiting_town_id VARCHAR(36), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE, FOREIGN KEY (visiting_town_id) REFERENCES towns(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS visitor_visits (id VARCHAR(32) PRIMARY KEY, town_id VARCHAR(36) NOT NULL, visitor_key VARCHAR(64) NOT NULL, name VARCHAR(96) NOT NULL, origin_town_id VARCHAR(36), town_name VARCHAR(160), era VARCHAR(64) NOT NULL, arrived_at BIGINT NOT NULL, last_seen_at BIGINT NOT NULL, departed_at BIGINT, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE, FOREIGN KEY (origin_town_id) REFERENCES towns(id) ON DELETE SET NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE IF NOT EXISTS visitor_leases (token_hash VARCHAR(64) PRIMARY KEY, town_id VARCHAR(36) NOT NULL, visit_id VARCHAR(32), sequence BIGINT NOT NULL DEFAULT 0, expires_at BIGINT NOT NULL, ended INTEGER NOT NULL DEFAULT 0, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE, FOREIGN KEY (visit_id) REFERENCES visitor_visits(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX visitor_visits_history ON visitor_visits(town_id,arrived_at,id);
CREATE INDEX visitor_visits_identity ON visitor_visits(town_id,visitor_key,departed_at);
CREATE INDEX visitor_leases_visit ON visitor_leases(visit_id,expires_at);
DELETE FROM town_guests;
INSERT INTO schema_versions(version) VALUES (14);
