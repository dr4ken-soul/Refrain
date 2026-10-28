-- Score provenance: how the current score was derived, and the confirmed
-- block behind a chain-derived score. SPEC_RESOLUTIONS.md requires the frozen
-- bundle to record the neutral initial score or the confirmed on-chain score.
SET LOCAL search_path TO refrain;

ALTER TABLE kol_scores ADD COLUMN IF NOT EXISTS origin text NOT NULL DEFAULT 'neutral'
    CHECK (origin IN ('neutral', 'chain'));
ALTER TABLE kol_scores ADD COLUMN IF NOT EXISTS block text;