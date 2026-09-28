CREATE TABLE IF NOT EXISTS town_visits (town_id VARCHAR(36) PRIMARY KEY, saloon_at BIGINT, guest_name VARCHAR(160), guest_at BIGINT, FOREIGN KEY(town_id) REFERENCES towns(id) ON DELETE CASCADE);
INSERT INTO schema_versions(version) VALUES (11);
