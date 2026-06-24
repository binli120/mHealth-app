-- Fix mutable search_path on touch_applications_updated_at.
-- Without SET search_path, a malicious user could manipulate the path to
-- redirect function calls to shadow objects in another schema.
CREATE OR REPLACE FUNCTION public.touch_applications_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql SET search_path = public AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;
