-- Arena Ascent backend schema (Postgres)
CREATE TABLE IF NOT EXISTS rounds (
  round_id      BIGINT PRIMARY KEY,          -- on-chain round id
  game_id       TEXT NOT NULL,               -- GameModule id, e.g. 2026-08-target-rush
  state         INT  NOT NULL DEFAULT 0,     -- mirrors on-chain enum
  live_start    TIMESTAMPTZ,                 -- scheduled window open
  live_end      TIMESTAMPTZ,                 -- scheduled window close
  live_opened_at TIMESTAMPTZ,                -- actual go-live moment; starts the 60s join window
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS entrants (
  round_id      BIGINT NOT NULL REFERENCES rounds(round_id),
  address       TEXT   NOT NULL,             -- lowercase 0x
  tx_hash       TEXT,                        -- entry tx (from chain watcher)
  entry_ip      TEXT,                        -- anti-abuse hint (set at SIWE login)
  funding_hint  TEXT,                        -- optional: first funder of the wallet
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (round_id, address)
);

CREATE TABLE IF NOT EXISTS sessions (
  id            BIGSERIAL PRIMARY KEY,
  round_id      BIGINT NOT NULL,
  address       TEXT   NOT NULL,
  seed          TEXT   NOT NULL,
  started_at    TIMESTAMPTZ,
  completed_at  TIMESTAMPTZ,
  input_log     JSONB  NOT NULL DEFAULT '[]'::jsonb,
  score         BIGINT,                      -- authoritative, set by computeScore
  score_detail  JSONB,
  disqualified  BOOLEAN NOT NULL DEFAULT FALSE, -- operator DQ (cheating etc.)
  dq_reason     TEXT,
  UNIQUE (round_id, address)                 -- exactly one attempt
);

CREATE TABLE IF NOT EXISTS settlements (
  round_id      BIGINT PRIMARY KEY,
  winner        TEXT,
  approved_by   TEXT,
  approved_at   TIMESTAMPTZ,
  tx_hash       TEXT
);

CREATE INDEX IF NOT EXISTS idx_sessions_round_score ON sessions (round_id, score DESC NULLS LAST);
