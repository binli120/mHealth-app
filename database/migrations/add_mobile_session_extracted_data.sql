/**
 * @author Bin Lee
 * Adds extracted_data to mobile_verify_sessions so the desktop can receive
 * parsed AAMVA fields (name, address) after a phone scan and auto-fill the profile.
 * No sensitive PII is stored — license number and DOB are excluded.
 */
ALTER TABLE mobile_verify_sessions
  ADD COLUMN IF NOT EXISTS extracted_data JSONB;
-- Example shape:
-- { "firstName":"JOHN","lastName":"SMITH","addressLine1":"123 MAIN ST","city":"BOSTON","state":"MA","zip":"02101" }
