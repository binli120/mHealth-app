-- Fix SECURITY DEFINER on help_user_badge view.
-- Rewrite to avoid querying auth.users directly; derive user_id from
-- user_roles (which already references auth.users) so the view can run
-- as the invoking user without needing elevated permissions.
CREATE OR REPLACE VIEW public.help_user_badge
WITH (security_invoker = true)
AS
SELECT
  ur.user_id,
  CASE
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur2
      JOIN public.roles r ON r.id = ur2.role_id
      WHERE ur2.user_id = ur.user_id AND r.name = 'admin'
    ) THEN 'admin'
    WHEN EXISTS (
      SELECT 1 FROM public.user_roles ur2
      JOIN public.roles r ON r.id = ur2.role_id
      WHERE ur2.user_id = ur.user_id
        AND r.name IN ('social_worker','reviewer','case_reviewer','supervisor')
    ) THEN 'professional'
    ELSE NULL
  END AS badge_type
FROM (SELECT DISTINCT user_id FROM public.user_roles) ur;
