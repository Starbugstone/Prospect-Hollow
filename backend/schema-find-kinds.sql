ALTER TABLE helmet_finds ADD COLUMN kind VARCHAR(32) NOT NULL DEFAULT 'helmet';
INSERT INTO schema_versions(version) VALUES (25);
