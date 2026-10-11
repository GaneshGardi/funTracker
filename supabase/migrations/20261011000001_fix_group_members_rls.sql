
-- Check membership without recursively invoking the group_members RLS policy.
-- The function checks only the currently authenticated user's membership.

create or replace function public.is_group_member(p_group_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
    select exists (
        select 1
        from public.group_members gm
        where gm.group_id = p_group_id
          and gm.user_id = (select auth.uid())
    );
$$;

-- Only authenticated users may invoke this helper.
revoke all on function public.is_group_member(uuid) from public;
grant execute on function public.is_group_member(uuid) to authenticated;

-- Replace the self-referencing policy.
drop policy if exists "Users can view their group memberships"
on public.group_members;

create policy "Users can view their group memberships"
on public.group_members
for select
to authenticated
using (
    public.is_group_member(group_id)
);
