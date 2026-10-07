ALTER TABLE visitor_visits ADD COLUMN signed_in INTEGER NOT NULL DEFAULT 0;
UPDATE visitor_visits SET signed_in=1 WHERE origin_town_id IS NOT NULL OR name<>'';
ALTER TABLE player_profiles ADD COLUMN anonymous_visits INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS email_changes (token_hash VARCHAR(64) PRIMARY KEY, player_id VARCHAR(64) NOT NULL, email VARCHAR(254) NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE);
CREATE INDEX email_changes_player ON email_changes(player_id);
CREATE TABLE IF NOT EXISTS town_travels (origin_town_id VARCHAR(36) NOT NULL, host_town_id VARCHAR(36) NOT NULL, visited_at BIGINT NOT NULL, PRIMARY KEY(origin_town_id,host_town_id), FOREIGN KEY (origin_town_id) REFERENCES towns(id) ON DELETE CASCADE);
INSERT INTO town_travels(origin_town_id,host_town_id,visited_at) SELECT v.origin_town_id,v.town_id,MIN(v.arrived_at) FROM visitor_visits v JOIN towns h ON h.id=v.town_id JOIN towns o ON o.id=v.origin_town_id WHERE h.player_id<>o.player_id AND NOT EXISTS (SELECT 1 FROM town_travels t WHERE t.origin_town_id=v.origin_town_id AND t.host_town_id=v.town_id) GROUP BY v.origin_town_id,v.town_id;
INSERT INTO schema_versions(version) VALUES (19);
