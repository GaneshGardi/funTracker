create or replace function public.get_group_daily_progress(
    p_group_id uuid,
    p_log_date date
)
returns table (
    user_id uuid,
    username text,
    display_name text,
    calories_consumed numeric,
    daily_calorie_goal numeric
)
language sql
stable
security definer
set search_path = ''
as $$
    select
        gm.user_id,
        p.username,
        p.display_name,

        coalesce(
            (
                select sum(fl.calories)
                from public.food_logs as fl
                where fl.user_id = gm.user_id
                  and fl.log_date = p_log_date
            ),
            0::numeric
        ) as calories_consumed,

        (
            select cg.daily_calories
            from public.calorie_goals as cg
            where cg.user_id = gm.user_id
            order by cg.effective_at desc, cg.created_at desc
            limit 1
        ) as daily_calorie_goal

    from public.group_members as gm
    join public.profiles as p
      on p.id = gm.user_id

    where gm.group_id = p_group_id
      and auth.uid() is not null
      and public.is_group_member(p_group_id)

    order by lower(coalesce(p.display_name, p.username)), lower(p.username);
$$;

revoke all
on function public.get_group_daily_progress(uuid, date)
from public;

grant execute
on function public.get_group_daily_progress(uuid, date)
to authenticated;
