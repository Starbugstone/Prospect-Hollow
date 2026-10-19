ALTER TABLE towns ADD COLUMN sync_approval TEXT;
UPDATE towns SET force_sync=0;
INSERT INTO schema_versions(version) VALUES (23);
