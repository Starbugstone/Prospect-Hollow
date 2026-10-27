ALTER TABLE town_sync_rejections ADD COLUMN outcome VARCHAR(16) NOT NULL DEFAULT 'rejected';
ALTER TABLE town_sync_rejections ADD COLUMN findings LONGTEXT;
ALTER TABLE town_sync_rejections ADD COLUMN client_build VARCHAR(64);
ALTER TABLE town_sync_rejections ADD COLUMN favourable INTEGER NOT NULL DEFAULT 0;
ALTER TABLE towns ADD COLUMN sync_correction LONGTEXT;
INSERT INTO schema_versions(version) VALUES (24);
