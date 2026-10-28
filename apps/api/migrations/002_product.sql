-- Product tables: calls, cases, rulesets, verdicts, paper positions and scores.
CREATE SCHEMA IF NOT EXISTS refrain;
SET LOCAL search_path TO refrain;

CREATE TABLE IF NOT EXISTS calls (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES sources(id),
    telegram_message_id bigint NOT NULL,
    asset_key text,
    chain text,
    contract_address text,
    ticker text,
    pair text,
    direction text NOT NULL CHECK (direction IN ('long', 'short', 'spot_buy', 'close', 'mention')),
    entry_price numeric,
    stop_price numeric,
    target_price numeric,
    conviction integer CHECK (conviction BETWEEN 0 AND 100),
    urgency integer CHECK (urgency BETWEEN 0 AND 100),
    sentiment text CHECK (sentiment IN ('bullish', 'bearish', 'neutral')),
    narrative_tags text[] NOT NULL DEFAULT '{}',
    parser text NOT NULL CHECK (parser IN ('structured', 'address', 'cashtag', 'url', 'llm', 'skip')),
    span_start integer,
    span_end integer,
    is_advertisement boolean NOT NULL DEFAULT false,
    filter_reason text,
    duplicate_of uuid REFERENCES calls(id),
    extraction_confidence numeric,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS calls_asset_created ON calls (asset_key, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_source_created ON calls (source_id, created_at DESC);
CREATE INDEX IF NOT EXISTS calls_message ON calls (source_id, telegram_message_id);

CREATE TABLE IF NOT EXISTS convergence_events (
    id uuid PRIMARY KEY,
    case_kind text NOT NULL DEFAULT 'convergence' CHECK (case_kind IN ('convergence', 'individual_call')),
    level text CHECK (level IN ('asset', 'narrative') OR level IS NULL),
    asset_key text,
    narrative_key text,
    window_started_at timestamptz,
    window_closed_at timestamptz,
    call_ids uuid[] NOT NULL DEFAULT '{}',
    independent_voice_count integer NOT NULL DEFAULT 0,
    timing_spread_seconds integer,
    weighted_conviction numeric,
    status text NOT NULL DEFAULT 'candidate' CHECK (status IN ('candidate', 'filed', 'settled')),
    bundle_hash text UNIQUE,
    bundle jsonb,
    bundle_canonical text,
    created_at timestamptz NOT NULL DEFAULT now(),
    CHECK (case_kind = 'individual_call' OR (level IS NOT NULL AND (asset_key IS NOT NULL OR narrative_key IS NOT NULL)))
);
CREATE INDEX IF NOT EXISTS convergence_status_created ON convergence_events (status, created_at);

CREATE TABLE IF NOT EXISTS rulesets (
    version integer PRIMARY KEY,
    config jsonb NOT NULL,
    ruleset_hash text NOT NULL UNIQUE,
    is_active boolean NOT NULL DEFAULT false,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS verdicts (
    event_id uuid PRIMARY KEY REFERENCES convergence_events(id),
    decision text NOT NULL CHECK (decision IN ('approved', 'rejected', 'deferred')),
    reason_code text NOT NULL,
    rule_results jsonb NOT NULL,
    explanation text,
    entry_price numeric,
    case_kind text NOT NULL DEFAULT 'convergence' CHECK (case_kind IN ('convergence', 'individual_call')),
    contributions jsonb NOT NULL DEFAULT '[]',
    cre_run_ref text,
    chain_tx_hash text,
    filed_at timestamptz
);

CREATE TABLE IF NOT EXISTS paper_positions (
    id bigint PRIMARY KEY,
    event_id uuid NOT NULL REFERENCES convergence_events(id),
    case_kind text NOT NULL DEFAULT 'convergence' CHECK (case_kind IN ('convergence', 'individual_call')),
    asset_key text NOT NULL,
    direction text NOT NULL,
    entry_price numeric NOT NULL,
    size_units bigint NOT NULL,
    stop_price numeric NOT NULL,
    target_price numeric NOT NULL,
    opened_at timestamptz NOT NULL,
    expires_at timestamptz NOT NULL,
    exit_price numeric,
    exit_reason text CHECK (exit_reason IN ('target', 'stop', 'expiry')),
    pnl_units bigint,
    status text NOT NULL DEFAULT 'open' CHECK (status IN ('open', 'settled')),
    contributions jsonb NOT NULL DEFAULT '[]',
    open_tx_hash text,
    settle_tx_hash text
);
CREATE INDEX IF NOT EXISTS paper_positions_status_expires ON paper_positions (status, expires_at);

CREATE TABLE IF NOT EXISTS kol_scores (
    source_id uuid PRIMARY KEY REFERENCES sources(id),
    score numeric NOT NULL DEFAULT 50.00 CHECK (score >= 0 AND score <= 100),
    calls_tracked integer NOT NULL DEFAULT 0,
    wins integer NOT NULL DEFAULT 0,
    losses integer NOT NULL DEFAULT 0,
    expired integer NOT NULL DEFAULT 0,
    promotion_flags integer NOT NULL DEFAULT 0,
    updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS score_history (
    id uuid PRIMARY KEY,
    source_id uuid NOT NULL REFERENCES sources(id),
    position_id bigint,
    delta numeric NOT NULL,
    reason text NOT NULL,
    chain_tx_hash text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS call_outcomes (
    call_id uuid PRIMARY KEY REFERENCES calls(id),
    result text NOT NULL CHECK (result IN ('target', 'stop', 'expired', 'open')),
    exit_price numeric,
    checked_until timestamptz NOT NULL,
    source_pair jsonb NOT NULL
);

COMMENT ON TABLE refrain.convergence_events IS 'Candidate and filed cases. convergence and individual_call kinds share this table.';
COMMENT ON COLUMN refrain.verdicts.contributions IS 'Ledger contributor commitments: sourceHash, callHash, conviction.';
