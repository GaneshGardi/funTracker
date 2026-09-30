alter table public.profiles
  add column birth_date date,
  add column gender text,
  add column height_cm numeric(5,2),
  add column weight_kg numeric(5,2),
  add column goal text;

alter table public.profiles
  add constraint profiles_gender_check
  check (
    gender is null
    or gender in ('male', 'female', 'other', 'prefer_not_to_say')
  );

alter table public.profiles
  add constraint profiles_goal_check
  check (
    goal is null
    or goal in ('lose', 'maintain', 'gain')
  );

alter table public.profiles
  add constraint profiles_height_check
  check (
    height_cm is null
    or height_cm > 0
  );

alter table public.profiles
  add constraint profiles_weight_check
  check (
    weight_kg is null
    or weight_kg > 0
  );