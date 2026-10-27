
create or replace function public.get_group_weekly_history(
    p_group_id uuid,
    p_start_date date,
    p_end_date date,
    p_timezone text default 'Asia/Kolkata'
)
returns table (
    user_id uuid,
    username text,
    display_name text,
    log_date date,
    calories_consumed numeric,
    daily_calorie_goal numeric
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
    -- Only authenticated members of this group may view its history.
    if auth.uid() is null
       or not public.is_group_member(p_group_id) then
        raise exception 'Not authorized to view this group'
            using errcode = '42501';
    end if;

    -- This endpoint is specifically for seven calendar days.
    if p_start_date is null
       or p_end_date is null
       or p_end_date - p_start_date <> 6 then
        raise exception 'Start and end dates must cover exactly seven days'
            using errcode = '22023';
    end if;

    -- Validate the timezone before using it to interpret goal dates.
    if not exists (
        select 1
        from pg_catalog.pg_timezone_names
        where name = p_timezone
    ) then
        raise exception 'Invalid timezone'
            using errcode = '22023';
    end if;

    return query
    select
        gm.user_id,
        p.username,
        p.display_name,
        day_series.day_timestamp::date as log_date,

        coalesce(
            (
                select sum(fl.calories)
                from public.food_logs as fl
                where fl.user_id = gm.user_id
                  and fl.log_date = day_series.day_timestamp::date
            ),
            0::numeric
        ) as calories_consumed,

        (
            select cg.daily_calories
            from public.calorie_goals as cg
            where cg.user_id = gm.user_id
              and cg.effective_at <
                  (
                      (day_series.day_timestamp::date + 1)::timestamp
                      at time zone p_timezone
                  )
            order by cg.effective_at desc, cg.created_at desc
            limit 1
        ) as daily_calorie_goal

    from public.group_members as gm
    join public.profiles as p
      on p.id = gm.user_id

    cross join generate_series(
        p_start_date::timestamp,
        p_end_date::timestamp,
        interval '1 day'
    ) as day_series(day_timestamp)

    where gm.group_id = p_group_id

    order by
        day_series.day_timestamp::date desc,
        lower(coalesce(p.display_name, p.username)),
        lower(p.username);
end;
$$;

revoke all
on function public.get_group_weekly_history(uuid, date, date, text)
from public;

grant execute
on function public.get_group_weekly_history(uuid, date, date, text)
to authenticated;
