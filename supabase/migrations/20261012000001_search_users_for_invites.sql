
-- Search for users by username or display name.
-- Return only the minimum information needed for invitations.

create or replace function public.search_users_for_invites(
    p_search text
)
returns table (
    user_id uuid,
    username text,
    display_name text
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        p.id,
        p.username,
        p.display_name
    from public.profiles p
    where auth.uid() is not null
      and length(trim(coalesce(p_search, ''))) >= 2
      and p.id <> (select auth.uid())
      and (
          p.username ilike '%' || trim(p_search) || '%'
          or coalesce(p.display_name, '') ilike '%' || trim(p_search) || '%'
      )
    order by
        case
            when lower(p.username) = lower(trim(p_search)) then 0
            when lower(p.username) like lower(trim(p_search)) || '%' then 1
            else 2
        end,
        p.username
    limit 10;
$$;

revoke all on function public.search_users_for_invites(text)
from public;

grant execute on function public.search_users_for_invites(text)
to authenticated;
