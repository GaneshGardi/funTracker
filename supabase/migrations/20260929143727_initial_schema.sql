-- ============================================================
-- FUN TRACKER — INITIAL DATABASE SCHEMA
-- ============================================================

-- UUID generation
create extension if not exists pgcrypto;


-- ============================================================
-- 1. PROFILES
-- ============================================================

create table public.profiles (
    id uuid primary key references auth.users(id) on delete cascade,

    username text not null,
    display_name text,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint username_not_empty
        check (length(trim(username)) >= 3)
);

-- Usernames are unique regardless of capitalization
create unique index profiles_username_unique_idx
    on public.profiles (lower(username));


-- ============================================================
-- 2. CALORIE GOALS
-- ============================================================

create table public.calorie_goals (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    daily_calories numeric(7,2) not null,

    -- Allows us to keep historical goal changes
    effective_at timestamptz not null default now(),

    created_at timestamptz not null default now(),

    constraint daily_calories_positive
        check (daily_calories > 0)
);

create index calorie_goals_user_effective_idx
    on public.calorie_goals (user_id, effective_at desc);


-- ============================================================
-- 3. FOODS
-- ============================================================

create table public.foods (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    serving_size numeric(10,2) not null,
    serving_unit text not null,

    calories numeric(10,2) not null,
    protein numeric(10,2) not null default 0,
    carbs numeric(10,2) not null default 0,
    fat numeric(10,2) not null default 0,
    fiber numeric(10,2) not null default 0,

    source text,

    is_active boolean not null default true,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint food_serving_size_positive
        check (serving_size > 0),

    constraint food_calories_non_negative
        check (calories >= 0),

    constraint food_protein_non_negative
        check (protein >= 0),

    constraint food_carbs_non_negative
        check (carbs >= 0),

    constraint food_fat_non_negative
        check (fat >= 0),

    constraint food_fiber_non_negative
        check (fiber >= 0)
);

create index foods_name_idx
    on public.foods (lower(name));


-- ============================================================
-- 4. FOOD LOGS
-- ============================================================

create table public.food_logs (
    id uuid primary key default gen_random_uuid(),

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    -- Nullable because an AI/manual entry may not match
    -- a food in our database.
    food_id uuid
        references public.foods(id)
        on delete set null,

    -- Snapshot of the food information at the time it was logged.
    -- This prevents historical logs from changing if the food
    -- database is updated later.
    food_name text not null,

    quantity numeric(10,2) not null,
    unit text not null,

    calories numeric(10,2) not null,
    protein numeric(10,2) not null default 0,
    carbs numeric(10,2) not null default 0,
    fat numeric(10,2) not null default 0,
    fiber numeric(10,2) not null default 0,

    -- The app will send the user's local calendar date.
    log_date date not null,

    -- How this food was added:
    -- manual / database / ai
    source text not null default 'manual',

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint food_log_quantity_positive
        check (quantity > 0),

    constraint food_log_calories_non_negative
        check (calories >= 0),

    constraint food_log_protein_non_negative
        check (protein >= 0),

    constraint food_log_carbs_non_negative
        check (carbs >= 0),

    constraint food_log_fat_non_negative
        check (fat >= 0),

    constraint food_log_fiber_non_negative
        check (fiber >= 0),

    constraint food_log_source_valid
        check (source in ('manual', 'database', 'ai'))
);

create index food_logs_user_date_idx
    on public.food_logs (user_id, log_date desc);

create index food_logs_food_idx
    on public.food_logs (food_id);


-- ============================================================
-- 5. GROUPS
-- ============================================================

create table public.groups (
    id uuid primary key default gen_random_uuid(),

    name text not null,

    created_by uuid not null
        references public.profiles(id)
        on delete cascade,

    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now(),

    constraint group_name_not_empty
        check (length(trim(name)) >= 1)
);


-- ============================================================
-- 6. GROUP MEMBERS
-- ============================================================

create table public.group_members (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.groups(id)
        on delete cascade,

    user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    role text not null default 'member',

    joined_at timestamptz not null default now(),

    constraint group_member_role_valid
        check (role in ('owner', 'member')),

    constraint unique_group_member
        unique (group_id, user_id)
);

create index group_members_group_idx
    on public.group_members (group_id);

create index group_members_user_idx
    on public.group_members (user_id);


-- ============================================================
-- 7. GROUP INVITATIONS
-- ============================================================

create table public.group_invitations (
    id uuid primary key default gen_random_uuid(),

    group_id uuid not null
        references public.groups(id)
        on delete cascade,

    inviter_user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    invitee_user_id uuid not null
        references public.profiles(id)
        on delete cascade,

    status text not null default 'pending',

    created_at timestamptz not null default now(),
    responded_at timestamptz,

    constraint invitation_status_valid
        check (status in ('pending', 'accepted', 'declined', 'cancelled'))
);

create index group_invitations_invitee_idx
    on public.group_invitations (invitee_user_id, status);

create index group_invitations_group_idx
    on public.group_invitations (group_id);

-- Only one pending invitation for the same person
-- in the same group.
create unique index pending_group_invitation_unique_idx
    on public.group_invitations (group_id, invitee_user_id)
    where status = 'pending';


-- ============================================================
-- 8. UPDATED_AT TRIGGER
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
    new.updated_at = now();
    return new;
end;
$$;


create trigger profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();


create trigger foods_updated_at
before update on public.foods
for each row
execute function public.set_updated_at();


create trigger food_logs_updated_at
before update on public.food_logs
for each row
execute function public.set_updated_at();


create trigger groups_updated_at
before update on public.groups
for each row
execute function public.set_updated_at();


-- ============================================================
-- 9. ROW LEVEL SECURITY
-- ============================================================

alter table public.profiles enable row level security;
alter table public.calorie_goals enable row level security;
alter table public.foods enable row level security;
alter table public.food_logs enable row level security;
alter table public.groups enable row level security;
alter table public.group_members enable row level security;
alter table public.group_invitations enable row level security;


-- ============================================================
-- 10. PROFILE POLICIES
-- ============================================================

create policy "Users can view their own profile"
on public.profiles
for select
to authenticated
using (auth.uid() = id);


create policy "Users can create their own profile"
on public.profiles
for insert
to authenticated
with check (auth.uid() = id);


create policy "Users can update their own profile"
on public.profiles
for update
to authenticated
using (auth.uid() = id)
with check (auth.uid() = id);


-- ============================================================
-- 11. CALORIE GOAL POLICIES
-- ============================================================

create policy "Users can view their own calorie goals"
on public.calorie_goals
for select
to authenticated
using (auth.uid() = user_id);


create policy "Users can create their own calorie goals"
on public.calorie_goals
for insert
to authenticated
with check (auth.uid() = user_id);


create policy "Users can update their own calorie goals"
on public.calorie_goals
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


create policy "Users can delete their own calorie goals"
on public.calorie_goals
for delete
to authenticated
using (auth.uid() = user_id);


-- ============================================================
-- 12. FOOD DATABASE POLICIES
-- ============================================================

-- Everyone who is logged in can read the food database.
create policy "Authenticated users can view foods"
on public.foods
for select
to authenticated
using (is_active = true);


-- We will keep the global food database protected.
-- Food insertion/update will later happen through
-- controlled server-side functions/admin operations.


-- ============================================================
-- 13. FOOD LOG POLICIES
-- ============================================================

create policy "Users can view their own food logs"
on public.food_logs
for select
to authenticated
using (auth.uid() = user_id);


create policy "Users can create their own food logs"
on public.food_logs
for insert
to authenticated
with check (auth.uid() = user_id);


create policy "Users can update their own food logs"
on public.food_logs
for update
to authenticated
using (auth.uid() = user_id)
with check (auth.uid() = user_id);


create policy "Users can delete their own food logs"
on public.food_logs
for delete
to authenticated
using (auth.uid() = user_id);


-- ============================================================
-- 14. GROUP POLICIES
-- ============================================================

create policy "Users can view groups they belong to"
on public.groups
for select
to authenticated
using (
    exists (
        select 1
        from public.group_members gm
        where gm.group_id = groups.id
        and gm.user_id = auth.uid()
    )
);


create policy "Users can create groups"
on public.groups
for insert
to authenticated
with check (auth.uid() = created_by);


create policy "Group owners can update groups"
on public.groups
for update
to authenticated
using (auth.uid() = created_by)
with check (auth.uid() = created_by);


create policy "Group owners can delete groups"
on public.groups
for delete
to authenticated
using (auth.uid() = created_by);


-- ============================================================
-- 15. GROUP MEMBER POLICIES
-- ============================================================

create policy "Users can view their group memberships"
on public.group_members
for select
to authenticated
using (
    exists (
        select 1
        from public.group_members own_membership
        where own_membership.group_id = group_members.group_id
        and own_membership.user_id = auth.uid()
    )
);


-- Membership changes will be handled through secure
-- server-side functions.
-- Direct INSERT/UPDATE/DELETE access is intentionally
-- not granted to normal clients.


-- ============================================================
-- 16. GROUP INVITATION POLICIES
-- ============================================================

create policy "Users can view invitations involving them"
on public.group_invitations
for select
to authenticated
using (
    auth.uid() = inviter_user_id
    or auth.uid() = invitee_user_id
);


-- Invitation creation and response will be handled through
-- secure server-side functions.


-- ============================================================
-- END OF INITIAL SCHEMA
-- ============================================================ 