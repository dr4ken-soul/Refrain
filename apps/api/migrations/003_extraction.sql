-- Extraction evidence extensions: frozen target lists, exit links, classifications and cache.
SET LOCAL search_path TO refrain;

CREATE TABLE IF NOT EXISTS post_classifications (
    source_id uuid NOT NULL REFERENCES sources(id),
    telegram_message_id bigint NOT NULL,
    is_advertisement boolean NOT NULL DEFAULT false,
    filter_reason text,
    referral_markers jsonb NOT NULL DEFAULT '[]',
    scheduled_call jsonb,
    extraction_version text NOT NULL DEFAULT 'v1',
    classified_at timestamptz NOT NULL DEFAULT now(),
    PRIMARY KEY (source_id, telegram_message_id)
);

CREATE TABLE IF NOT EXISTS llm_cache (
    cache_key text PRIMARY KEY,
    response jsonb NOT NULL,
    model text NOT NULL,
    created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE calls ADD COLUMN IF NOT EXISTS targets jsonb NOT NULL DEFAULT '[]';
ALTER TABLE calls ADD COLUMN IF NOT EXISTS closes_call uuid REFERENCES calls(id);
