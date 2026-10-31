-- Confirmed RefrainLedger events and resumable indexer position.
CREATE TABLE IF NOT EXISTS ledger_chain_events (
    tx_hash text NOT NULL,
    log_index integer NOT NULL,
    block_number bigint NOT NULL,
    block_hash text NOT NULL,
    contract_address text NOT NULL,
    event_name text NOT NULL,
    event_data jsonb NOT NULL,
    indexed_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (tx_hash, log_index)
);
CREATE INDEX IF NOT EXISTS ledger_chain_events_block
    ON ledger_chain_events (block_number, log_index);

CREATE TABLE IF NOT EXISTS chain_indexer_state (
    contract_address text PRIMARY KEY,
    next_block bigint NOT NULL,
    updated_at timestamptz NOT NULL DEFAULT now()
);
