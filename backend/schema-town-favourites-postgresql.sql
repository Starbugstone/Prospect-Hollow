CREATE TABLE IF NOT EXISTS town_favourites (player_id VARCHAR(64) NOT NULL, town_id VARCHAR(36) NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY(player_id,town_id), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE);
CREATE INDEX visitor_visits_visitor ON visitor_visits(visitor_key,town_id);
INSERT INTO schema_versions(version) VALUES (15);
