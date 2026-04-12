-- Feature Flags Schema
-- Supports per-environment and per-user-group overrides

CREATE TABLE IF NOT EXISTS feature_flags (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  key           TEXT NOT NULL UNIQUE,          -- e.g. "benefit.snap", "benefit.section8"
  label         TEXT NOT NULL,                 -- Human-readable name
  description   TEXT,
  enabled       BOOLEAN NOT NULL DEFAULT true, -- Global default
  category      TEXT NOT NULL DEFAULT 'general', -- 'benefit_program' | 'ui' | 'integration' | 'general'
  metadata      JSONB DEFAULT '{}',            -- extra config if needed
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Per-environment overrides (environment = 'development' | 'staging' | 'production')
CREATE TABLE IF NOT EXISTS feature_flag_env_overrides (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  flag_id     UUID NOT NULL REFERENCES feature_flags(id) ON DELETE CASCADE,
  environment TEXT NOT NULL,
  enabled     BOOLEAN NOT NULL,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (flag_id, environment)
);

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS feature_flags_updated_at ON feature_flags;
CREATE TRIGGER feature_flags_updated_at
  BEFORE UPDATE ON feature_flags
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

DROP TRIGGER IF EXISTS feature_flag_env_overrides_updated_at ON feature_flag_env_overrides;
CREATE TRIGGER feature_flag_env_overrides_updated_at
  BEFORE UPDATE ON feature_flag_env_overrides
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

-- Seed default flags for all benefit programs and integrations
INSERT INTO feature_flags (key, label, description, enabled, category) VALUES
  ('benefit.masshealth',  'MassHealth',              'MassHealth program eligibility evaluation',          true,  'benefit_program'),
  ('benefit.msp',         'Medicare Savings Program', 'MSP eligibility evaluation',                        true,  'benefit_program'),
  ('benefit.snap',        'SNAP / Food Stamps',       'SNAP eligibility evaluation',                       true,  'benefit_program'),
  ('benefit.eitc',        'Earned Income Tax Credit', 'EITC eligibility evaluation',                       true,  'benefit_program'),
  ('benefit.section8',    'Section 8 Housing',        'Section 8 / HCV eligibility evaluation',            true,  'benefit_program'),
  ('benefit.childcare',   'Childcare Assistance',     'CCAP eligibility evaluation',                       true,  'benefit_program'),
  ('benefit.liheap',      'LIHEAP Energy Assistance', 'Low Income Home Energy Assistance Program',         true,  'benefit_program'),
  ('benefit.wic',         'WIC',                      'Women, Infants, and Children program',              true,  'benefit_program'),
  ('benefit.tafdc',       'TAFDC',                    'Transitional Aid to Families with Dependent Children', true, 'benefit_program'),
  ('benefit.eaedc',       'EAEDC',                    'Emergency Aid to the Elderly, Disabled and Children', true, 'benefit_program'),
  ('integration.ollama',  'AI Chat (Ollama)',          'Conversational AI chat via Ollama/llama3.2',        true,  'integration'),
  ('integration.resend',  'Email Notifications',      'Transactional email via Resend',                    true,  'integration'),
  ('ui.benefit_stack',    'Benefit Stack Page',        'Cross-program benefit orchestration UI',            true,  'ui'),
  ('ui.prescreener',      'Pre-Screener',              'Eligibility pre-screener tool',                     true,  'ui'),
  ('ui.voice_input',      'Voice Input',               'Voice transcription for form filling',              true,  'ui')
ON CONFLICT (key) DO NOTHING;
