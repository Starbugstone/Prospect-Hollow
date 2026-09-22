UPDATE public_villages SET era_rank=CASE JSON_UNQUOTE(JSON_EXTRACT(appearance, '$.era'))
    WHEN 'frontier' THEN 0 WHEN 'river-rail' THEN 1 WHEN 'industrial' THEN 2
    WHEN 'post-war' THEN 3 WHEN 'motor-age' THEN 4 WHEN 'aviation' THEN 5
    WHEN 'broadcast' THEN 6 WHEN 'contemporary' THEN 7 ELSE era_rank END;
INSERT INTO schema_versions(version) VALUES (3);
