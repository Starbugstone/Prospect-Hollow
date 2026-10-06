ALTER TABLE visitor_visits ADD COLUMN signed_in INTEGER NOT NULL DEFAULT 0;
UPDATE visitor_visits SET signed_in=1 WHERE origin_town_id IS NOT NULL OR name<>'';
ALTER TABLE player_profiles ADD COLUMN anonymous_visits INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS email_changes (token_hash VARCHAR(64) PRIMARY KEY, player_id VARCHAR(64) NOT NULL, email VARCHAR(254) NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE);
CREATE INDEX email_changes_player ON email_changes(player_id);
INSERT INTO schema_versions(version) VALUES (19);
