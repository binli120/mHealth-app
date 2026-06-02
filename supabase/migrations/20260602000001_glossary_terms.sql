-- supabase/migrations/20260602000001_glossary_terms.sql

CREATE TABLE IF NOT EXISTS public.glossary_terms (
  id              UUID         PRIMARY KEY DEFAULT gen_random_uuid(),
  slug            TEXT         UNIQUE NOT NULL,
  term_en         TEXT         NOT NULL,
  definition_en   TEXT         NOT NULL,
  definition_es   TEXT,
  definition_zh_cn TEXT,
  definition_ht   TEXT,
  definition_pt_br TEXT,
  definition_vi   TEXT,
  category        TEXT         NOT NULL CHECK (category IN ('program','insurance','aca','medical')),
  aliases         TEXT[]       NOT NULL DEFAULT '{}',
  related_slugs   TEXT[]       NOT NULL DEFAULT '{}',
  created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
  updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS glossary_terms_category_idx ON public.glossary_terms (category);

-- Trigger to keep updated_at fresh
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END; $$;

DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger WHERE tgname = 'glossary_terms_updated_at'
  ) THEN
    CREATE TRIGGER glossary_terms_updated_at
    BEFORE UPDATE ON public.glossary_terms
    FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();
  END IF;
END $$;
