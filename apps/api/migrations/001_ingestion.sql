-- Ingestion tables only. Remaining product tables belong to later migrations.
CREATE SCHEMA IF NOT EXISTS refrain;
SET LOCAL search_path TO refrain;

CREATE TABLE IF NOT EXISTS sources (
    id uuid PRIMARY KEY,
    platform text NOT NULL DEFAULT 'telegram' CHECK (platform = 'telegram'),
    handle text NOT NULL UNIQUE,
    display_name text NOT NULL,
    role text NOT NULL CHECK (role IN ('core_signal', 'meme_radar', 'noisy_source', 'red_flag_specimen')),
    is_public boolean NOT NULL DEFAULT true CHECK (is_public),
    is_active boolean NOT NULL DEFAULT true,
    last_message_id bigint NOT NULL DEFAULT 0,
    source_hash text NOT NULL UNIQUE,
    created_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS sources_handle_casefold ON sources (lower(handle));

CREATE TABLE IF NOT EXISTS raw_posts (
    source_id uuid NOT NULL REFERENCES sources(id),
    telegram_message_id bigint NOT NULL CHECK (telegram_message_id > 0),
    posted_at timestamptz NOT NULL,
    edited_at timestamptz,
    text text NOT NULL,
    urls jsonb NOT NULL DEFAULT '[]',
    forwarded_from text,
    views integer,
    is_media_only boolean NOT NULL,
    content_hash text NOT NULL,
    ingest_mode text NOT NULL CHECK (ingest_mode IN ('live', 'replay')),
    ingested_at timestamptz NOT NULL DEFAULT now(),
    quote_text text,
    web_preview_title text,
    PRIMARY KEY (source_id, telegram_message_id)
);
CREATE INDEX IF NOT EXISTS raw_posts_source_posted ON raw_posts (source_id, posted_at DESC);
COMMENT ON TABLE refrain.raw_posts IS 'Ingested posts, replay imports included, real captured evidence only.';

-- Explicit additions preserve quoted text and link-preview titles for extraction.
-- Original posted_at is immutable during an edited-message upsert.
