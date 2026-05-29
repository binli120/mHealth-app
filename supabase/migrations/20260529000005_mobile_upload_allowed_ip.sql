-- =============================================================================
-- Migration: add allowed_ip to mobile_upload_sessions
-- @author: Bin Lee <blee@healthcompass.cloud>
--
-- Stores the client IP address captured when the session is created so that
-- the public upload endpoint can reject requests from a different device.
-- Null = no IP binding (legacy sessions or cases where IP is indeterminate).
-- =============================================================================

BEGIN;

ALTER TABLE public.mobile_upload_sessions
  ADD COLUMN IF NOT EXISTS allowed_ip TEXT;

COMMENT ON COLUMN public.mobile_upload_sessions.allowed_ip IS
  'Client IP captured at session creation. Upload requests from a different '
  'IP are rejected (403). NULL disables IP binding for this session.';

COMMIT;
