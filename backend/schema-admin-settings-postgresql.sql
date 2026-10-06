CREATE TABLE IF NOT EXISTS admin_settings (name VARCHAR(40) PRIMARY KEY, value VARCHAR(255) NOT NULL);
INSERT INTO schema_versions(version) VALUES (18);
