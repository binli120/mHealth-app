-- Add extracted_data to mobile_verify_sessions for AAMVA auto-fill
-- @author Bin Lee

ALTER TABLE public.mobile_verify_sessions
  ADD COLUMN IF NOT EXISTS extracted_data JSONB;

COMMENT ON COLUMN public.mobile_verify_sessions.extracted_data IS
  'Parsed AAMVA fields for profile auto-fill. No sensitive PII — license number and DOB excluded.
   Shape: {"firstName":"JOHN","lastName":"SMITH","addressLine1":"123 MAIN ST","city":"BOSTON","state":"MA","zip":"02101"}';
