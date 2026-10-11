create or replace function public.create_group(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_group_id uuid;
    v_group_name text;
begin
    v_user_id := auth.uid();

    if v_user_id is null then
        raise exception 'You must be signed in to create a group';
    end if;

    v_group_name := trim(p_name);

    if v_group_name is null
       or length(v_group_name) < 1
       or length(v_group_name) > 50 then
        raise exception 'Group name must be between 1 and 50 characters';
    end if;

    insert into public.groups (name, created_by)
    values (v_group_name, v_user_id)
    returning id into v_group_id;

    insert into public.group_members (group_id, user_id, role)
    values (v_group_id, v_user_id, 'owner');

    return v_group_id;
end;
$$;

revoke all on function public.create_group(text) from public;
grant execute on function public.create_group(text) to authenticated;
