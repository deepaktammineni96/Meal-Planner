create extension if not exists pgcrypto;

create table if not exists public.recipes (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.recipe_ingredients (
  id uuid primary key default gen_random_uuid(),
  recipe_id uuid not null references public.recipes(id) on delete cascade,
  quantity text not null default '',
  name text not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.plans (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  week_start date not null,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.meals (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  recipe_id uuid references public.recipes(id) on delete set null,
  day text not null,
  meal_type text not null,
  recipe_snapshot jsonb,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.shopping_overrides (
  id uuid primary key default gen_random_uuid(),
  plan_id uuid not null references public.plans(id) on delete cascade,
  label text not null default '',
  quantity text not null default '',
  checked boolean not null default false,
  source text not null default 'From recipes',
  source_key text,
  removed boolean not null default false,
  updated boolean not null default false,
  position integer not null default 0,
  created_at timestamptz not null default now()
);

create table if not exists public.app_preferences (
  key text primary key,
  value text
);

alter table public.recipes add column if not exists position integer not null default 0;
alter table public.recipe_ingredients add column if not exists position integer not null default 0;
alter table public.plans add column if not exists position integer not null default 0;
alter table public.meals add column if not exists position integer not null default 0;
alter table public.shopping_overrides add column if not exists position integer not null default 0;

alter table public.recipes enable row level security;
alter table public.recipe_ingredients enable row level security;
alter table public.plans enable row level security;
alter table public.meals enable row level security;
alter table public.shopping_overrides enable row level security;
alter table public.app_preferences enable row level security;

drop policy if exists "public read recipes" on public.recipes;
drop policy if exists "public write recipes" on public.recipes;
drop policy if exists "public read recipe ingredients" on public.recipe_ingredients;
drop policy if exists "public write recipe ingredients" on public.recipe_ingredients;
drop policy if exists "public read plans" on public.plans;
drop policy if exists "public write plans" on public.plans;
drop policy if exists "public read meals" on public.meals;
drop policy if exists "public write meals" on public.meals;
drop policy if exists "public read shopping overrides" on public.shopping_overrides;
drop policy if exists "public write shopping overrides" on public.shopping_overrides;
drop policy if exists "public read app preferences" on public.app_preferences;
drop policy if exists "public write app preferences" on public.app_preferences;

create policy "public read recipes" on public.recipes for select using (true);
create policy "public write recipes" on public.recipes for all using (true) with check (true);
create policy "public read recipe ingredients" on public.recipe_ingredients for select using (true);
create policy "public write recipe ingredients" on public.recipe_ingredients for all using (true) with check (true);
create policy "public read plans" on public.plans for select using (true);
create policy "public write plans" on public.plans for all using (true) with check (true);
create policy "public read meals" on public.meals for select using (true);
create policy "public write meals" on public.meals for all using (true) with check (true);
create policy "public read shopping overrides" on public.shopping_overrides for select using (true);
create policy "public write shopping overrides" on public.shopping_overrides for all using (true) with check (true);
create policy "public read app preferences" on public.app_preferences for select using (true);
create policy "public write app preferences" on public.app_preferences for all using (true) with check (true);

create or replace function public.get_app_state()
returns jsonb
language sql
security definer
set search_path = public
as $$
  select jsonb_build_object(
    'recipes', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', r.id,
        'name', r.name,
        'ingredients', coalesce((
          select jsonb_agg(jsonb_build_object(
            'quantity', ri.quantity,
            'name', ri.name
          ) order by ri.position, ri.created_at)
          from public.recipe_ingredients ri
          where ri.recipe_id = r.id
        ), '[]'::jsonb)
      ) order by r.position, r.created_at desc)
      from public.recipes r
    ), '[]'::jsonb),
    'plans', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'weekStart', p.week_start,
        'meals', coalesce((
          select jsonb_agg(jsonb_strip_nulls(jsonb_build_object(
            'id', m.id,
            'recipeId', m.recipe_id,
            'day', m.day,
            'mealType', m.meal_type,
            'recipeSnapshot', m.recipe_snapshot
          )) order by m.position, m.created_at)
          from public.meals m
          where m.plan_id = p.id
        ), '[]'::jsonb),
        'shoppingOverrides', coalesce((
          select jsonb_agg(jsonb_build_object(
            'id', so.id,
            'label', so.label,
            'quantity', so.quantity,
            'checked', so.checked,
            'source', so.source,
            'sourceKey', so.source_key,
            'removed', so.removed,
            'updated', so.updated
          ) order by so.position, so.created_at)
          from public.shopping_overrides so
          where so.plan_id = p.id
        ), '[]'::jsonb)
      ) order by p.week_start, p.position, p.created_at)
      from public.plans p
    ), '[]'::jsonb),
    'activePlanId', (select value from public.app_preferences where key = 'activePlanId')
  );
$$;

create or replace function public.save_app_state(p_state jsonb)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_recipe jsonb;
  v_ingredient jsonb;
  v_plan jsonb;
  v_meal jsonb;
  v_override jsonb;
  v_position integer;
  v_recipe_position integer;
  v_plan_position integer;
  v_meal_position integer;
  v_override_position integer;
begin
  delete from public.shopping_overrides where true;
  delete from public.meals where true;
  delete from public.recipe_ingredients where true;
  delete from public.recipes where true;
  delete from public.plans where true;
  delete from public.app_preferences where key = 'activePlanId';

  v_recipe_position := 0;
  for v_recipe in select * from jsonb_array_elements(coalesce(p_state -> 'recipes', '[]'::jsonb)) loop
    insert into public.recipes (id, name, position)
    values ((v_recipe ->> 'id')::uuid, v_recipe ->> 'name', v_recipe_position);

    v_position := 0;
    for v_ingredient in select * from jsonb_array_elements(coalesce(v_recipe -> 'ingredients', '[]'::jsonb)) loop
      insert into public.recipe_ingredients (recipe_id, quantity, name, position)
      values (
        (v_recipe ->> 'id')::uuid,
        coalesce(v_ingredient ->> 'quantity', ''),
        coalesce(v_ingredient ->> 'name', ''),
        v_position
      );
      v_position := v_position + 1;
    end loop;
    v_recipe_position := v_recipe_position + 1;
  end loop;

  v_plan_position := 0;
  for v_plan in select * from jsonb_array_elements(coalesce(p_state -> 'plans', '[]'::jsonb)) loop
    insert into public.plans (id, name, week_start, position)
    values ((v_plan ->> 'id')::uuid, v_plan ->> 'name', (v_plan ->> 'weekStart')::date, v_plan_position);

    v_meal_position := 0;
    for v_meal in select * from jsonb_array_elements(coalesce(v_plan -> 'meals', '[]'::jsonb)) loop
      insert into public.meals (id, plan_id, recipe_id, day, meal_type, recipe_snapshot, position)
      values (
        (v_meal ->> 'id')::uuid,
        (v_plan ->> 'id')::uuid,
        nullif(v_meal ->> 'recipeId', '')::uuid,
        v_meal ->> 'day',
        v_meal ->> 'mealType',
        v_meal -> 'recipeSnapshot',
        v_meal_position
      );
      v_meal_position := v_meal_position + 1;
    end loop;

    v_override_position := 0;
    for v_override in select * from jsonb_array_elements(coalesce(v_plan -> 'shoppingOverrides', '[]'::jsonb)) loop
      insert into public.shopping_overrides (id, plan_id, label, quantity, checked, source, source_key, removed, updated, position)
      values (
        (v_override ->> 'id')::uuid,
        (v_plan ->> 'id')::uuid,
        coalesce(v_override ->> 'label', ''),
        coalesce(v_override ->> 'quantity', ''),
        coalesce((v_override ->> 'checked')::boolean, false),
        coalesce(v_override ->> 'source', 'From recipes'),
        nullif(v_override ->> 'sourceKey', ''),
        coalesce((v_override ->> 'removed')::boolean, false),
        coalesce((v_override ->> 'updated')::boolean, false),
        v_override_position
      );
      v_override_position := v_override_position + 1;
    end loop;
    v_plan_position := v_plan_position + 1;
  end loop;

  insert into public.app_preferences (key, value)
  values ('activePlanId', p_state ->> 'activePlanId');
end;
$$;

create or replace function public.get_shopping_recipe_items(p_plan_id uuid)
returns table (
  source_key text,
  label text,
  entries jsonb
)
language sql
security definer
set search_path = public
as $$
  with meal_ingredients as (
    select
      lower(trim(ri.name)) as source_key,
      trim(ri.name) as label,
      jsonb_build_object('quantity', ri.quantity, 'name', ri.name) as entry
    from public.meals m
    join public.recipe_ingredients ri on ri.recipe_id = m.recipe_id
    where m.plan_id = p_plan_id
      and ri.name <> ''

    union all

    select
      lower(trim(snapshot_ingredient ->> 'name')) as source_key,
      trim(snapshot_ingredient ->> 'name') as label,
      jsonb_build_object(
        'quantity', coalesce(snapshot_ingredient ->> 'quantity', ''),
        'name', coalesce(snapshot_ingredient ->> 'name', '')
      ) as entry
    from public.meals m
    cross join lateral jsonb_array_elements(coalesce(m.recipe_snapshot -> 'ingredients', '[]'::jsonb)) snapshot_ingredient
    where m.plan_id = p_plan_id
      and coalesce(snapshot_ingredient ->> 'name', '') <> ''
  )
  select
    meal_ingredients.source_key,
    min(meal_ingredients.label) as label,
    jsonb_agg(meal_ingredients.entry) as entries
  from meal_ingredients
  where meal_ingredients.source_key <> ''
  group by meal_ingredients.source_key
  order by min(meal_ingredients.label);
$$;
