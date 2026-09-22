CREATE TABLE IF NOT EXISTS schema_versions (version INTEGER PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE players (id VARCHAR(64) PRIMARY KEY, email VARCHAR(254) UNIQUE, locale VARCHAR(2), profile LONGTEXT NOT NULL, revision BIGINT NOT NULL DEFAULT 0, created_at BIGINT NOT NULL, saved_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE sessions (token_hash VARCHAR(64) PRIMARY KEY, player_id VARCHAR(64) NOT NULL, csrf_hash VARCHAR(64) NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX sessions_player ON sessions(player_id);
CREATE TABLE login_intents (token_hash VARCHAR(64) PRIMARY KEY, email VARCHAR(254) NOT NULL, guest_id VARCHAR(64), session_hash VARCHAR(64), expires_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX intents_email ON login_intents(email);
CREATE INDEX intents_guest ON login_intents(guest_id);
CREATE TABLE identities (email_hash VARCHAR(64) PRIMARY KEY) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE actions (player_id VARCHAR(64) NOT NULL, action_id VARCHAR(64) NOT NULL, fingerprint VARCHAR(64) NOT NULL, response LONGTEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY(player_id,action_id), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE runs (id VARCHAR(64) PRIMARY KEY, player_id VARCHAR(64) NOT NULL, status VARCHAR(16) NOT NULL, state LONGTEXT NOT NULL, created_at BIGINT NOT NULL, expires_at BIGINT NOT NULL, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX runs_player ON runs(player_id,status);
CREATE TABLE ledger (player_id VARCHAR(64) NOT NULL, action_id VARCHAR(64) NOT NULL, reason VARCHAR(64) NOT NULL, before_state LONGTEXT NOT NULL, after_state LONGTEXT NOT NULL, created_at BIGINT NOT NULL, PRIMARY KEY(player_id,action_id), FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE TABLE limits (bucket VARCHAR(64) PRIMARY KEY, hits INTEGER NOT NULL, until_at BIGINT NOT NULL) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
CREATE INDEX limits_expiry ON limits(until_at);
INSERT INTO schema_versions(version) VALUES (1);
CREATE TABLE IF NOT EXISTS public_villages (id VARCHAR(32) PRIMARY KEY, player_id VARCHAR(64) NOT NULL UNIQUE, name VARCHAR(160) NOT NULL, era_rank INTEGER NOT NULL, building_score INTEGER NOT NULL, mines_cleared INTEGER NOT NULL, population INTEGER NOT NULL, appearance TEXT NOT NULL, FOREIGN KEY (player_id) REFERENCES players(id) ON DELETE CASCADE, INDEX public_villages_rank (era_rank DESC,building_score DESC,mines_cleared DESC,id ASC)) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_bin;
INSERT INTO schema_versions(version) VALUES (2);

INSERT INTO schema_versions(version) VALUES (3);
