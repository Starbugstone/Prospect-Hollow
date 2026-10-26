CREATE INDEX helmet_finds_host ON helmet_finds(host_town_id,found_at);
INSERT INTO schema_versions(version) VALUES (22);
