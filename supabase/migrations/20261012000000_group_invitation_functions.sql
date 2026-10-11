-- ============================================================
-- FUN TRACKER: SECURE GROUP INVITATIONS
-- ============================================================

-- Send an invitation to an existing user by username.
create or replace function public.send_group_invitation(
    p_group_id uuid,
    p_username text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_inviter_id uuid;
    v_invitee_id uuid;
    v_invitation_id uuid;
    v_username text;
begin
    v_inviter_id := auth.uid();

    if v_inviter_id is null then
        raise exception 'You must be signed in to send invitations';
    end if;

    v_username := lower(trim(p_username));

    if v_username is null or length(v_username) = 0 then
        raise exception 'Enter a username';
    end if;

    -- The inviter must belong to the target group.
    if not exists (
        select 1
        from public.group_members gm
        where gm.group_id = p_group_id
          and gm.user_id = v_inviter_id
    ) then
        raise exception 'You must be a member of this group to invite someone';
    end if;

    -- Resolve the existing username without exposing profile data.
    select p.id
    into v_invitee_id
    from public.profiles p
    where lower(p.username) = v_username;

    if v_invitee_id is null then
        raise exception 'No user found with that username';
    end if;

    if v_invitee_id = v_inviter_id then
        raise exception 'You cannot invite yourself';
    end if;

    if exists (
        select 1
        from public.group_members gm
        where gm.group_id = p_group_id
          and gm.user_id = v_invitee_id
    ) then
        raise exception 'This user is already a member of the group';
    end if;

    if exists (
        select 1
        from public.group_invitations gi
        where gi.group_id = p_group_id
          and gi.invitee_user_id = v_invitee_id
          and gi.status = 'pending'
    ) then
        raise exception 'An invitation is already pending for this user';
    end if;

    insert into public.group_invitations (
        group_id,
        inviter_user_id,
        invitee_user_id,
        status
    )
    values (
        p_group_id,
        v_inviter_id,
        v_invitee_id,
        'pending'
    )
    returning id into v_invitation_id;

    return v_invitation_id;
end;
$$;


-- Allow only the invited user to accept or decline.
create or replace function public.respond_to_group_invitation(
    p_invitation_id uuid,
    p_response text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
    v_user_id uuid;
    v_group_id uuid;
    v_status text;
    v_response text;
begin
    v_user_id := auth.uid();
    v_response := lower(trim(p_response));

    if v_user_id is null then
        raise exception 'You must be signed in to respond to invitations';
    end if;

    if v_response not in ('accepted', 'declined') then
        raise exception 'Response must be accepted or declined';
    end if;

    -- Lock the invitation so concurrent responses cannot race.
    select gi.group_id, gi.status
    into v_group_id, v_status
    from public.group_invitations gi
    where gi.id = p_invitation_id
      and gi.invitee_user_id = v_user_id
    for update;

    if not found then
        raise exception 'Invitation not found';
    end if;

    if v_status <> 'pending' then
        raise exception 'This invitation has already been answered';
    end if;

    update public.group_invitations
    set status = v_response,
        responded_at = now()
    where id = p_invitation_id;

    if v_response = 'accepted' then
        insert into public.group_members (
            group_id,
            user_id,
            role
        )
        values (
            v_group_id,
            v_user_id,
            'member'
        )
        on conflict (group_id, user_id) do nothing;
    end if;
end;
$$;


-- Do not allow anonymous or general public execution.
revoke all on function public.send_group_invitation(uuid, text)
from public;

revoke all on function public.respond_to_group_invitation(uuid, text)
from public;

grant execute on function public.send_group_invitation(uuid, text)
to authenticated;

grant execute on function public.respond_to_group_invitation(uuid, text)
to authenticated;
