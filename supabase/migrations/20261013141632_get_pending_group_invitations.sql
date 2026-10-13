
CREATE OR REPLACE FUNCTION public.get_pending_group_invitations()
RETURNS TABLE (
    invitation_id uuid,
    group_id uuid,
    group_name text,
    inviter_user_id uuid,
    inviter_username text,
    inviter_display_name text,
    invitation_created_at timestamptz
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = ''
AS $$
    SELECT
        gi.id,
        gi.group_id,
        g.name,
        gi.inviter_user_id,
        p.username,
        p.display_name,
        gi.created_at
    FROM public.group_invitations AS gi
    JOIN public.groups AS g
        ON g.id = gi.group_id
    JOIN public.profiles AS p
        ON p.id = gi.inviter_user_id
    WHERE gi.invitee_user_id = (SELECT auth.uid())
      AND gi.status = 'pending'
      AND auth.uid() IS NOT NULL
    ORDER BY gi.created_at DESC;
$$;

REVOKE ALL
ON FUNCTION public.get_pending_group_invitations()
FROM PUBLIC;

GRANT EXECUTE
ON FUNCTION public.get_pending_group_invitations()
TO authenticated;
