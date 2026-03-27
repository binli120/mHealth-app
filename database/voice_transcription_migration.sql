-- Voice transcription columns for sw_direct_messages
-- Stores Web Speech API transcription text and detected language code

ALTER TABLE public.sw_direct_messages
  ADD COLUMN IF NOT EXISTS transcription TEXT,
  ADD COLUMN IF NOT EXISTS transcription_lang VARCHAR(10);
