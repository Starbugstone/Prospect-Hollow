ALTER TABLE towns ADD COLUMN force_sync INTEGER NOT NULL DEFAULT 0;
CREATE TABLE IF NOT EXISTS town_sync_rejections (id VARCHAR(32) PRIMARY KEY, town_id VARCHAR(36) NOT NULL, rejected_at BIGINT NOT NULL, revision BIGINT NOT NULL, code VARCHAR(64) NOT NULL, field VARCHAR(255), message VARCHAR(255) NOT NULL, cloud TEXT NOT NULL, upload TEXT NOT NULL, expected TEXT, FOREIGN KEY (town_id) REFERENCES towns(id) ON DELETE CASCADE);
CREATE INDEX town_sync_rejections_town ON town_sync_rejections(town_id,rejected_at);
INSERT INTO schema_versions(version) VALUES (21);
