-- ============================================================
-- 017: Season Config table for scraper + per-year Eurovision URLs
-- ============================================================

CREATE TABLE IF NOT EXISTS season_config (
  id             UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  year           INT NOT NULL,
  event_key      TEXT NOT NULL UNIQUE,   -- e.g. '2025_grand_final'
  scrape_url     TEXT,                   -- Eurovision TV page URL
  scraper_active BOOLEAN NOT NULL DEFAULT false,
  countries_json JSONB,                  -- [{rank, id, name, points}, ...]
  last_scraped_at TIMESTAMPTZ,
  created_at     TIMESTAMPTZ DEFAULT now()
);

-- Seed known years
INSERT INTO season_config (year, event_key, scrape_url, scraper_active) VALUES
  (2025, '2025_grand_final', 'https://eurovision.tv/event/basel-2025/grand-final',    false),
  (2024, '2024_grand_final', 'https://eurovision.tv/event/malmo-2024/grand-final',    false),
  (2026, '2026_grand_final', 'https://eurovision.tv/event/vienna-2026/grand-final',   false)
ON CONFLICT (event_key) DO NOTHING;

-- RLS: only service role writes; everyone can read
ALTER TABLE season_config ENABLE ROW LEVEL SECURITY;
CREATE POLICY "season_config_read_all" ON season_config FOR SELECT USING (true);
