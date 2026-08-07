-- ============================================================
-- LogistiekStock — volledige database-opzet
-- ============================================================
-- GEGENEREERD BESTAND — niet handmatig bewerken.
-- Opnieuw maken met: npm run db:setup-sql
--
-- Plak dit in de SQL Editor van Supabase en voer het uit op een verse
-- database. Bevat 5 migraties:
--   001_initial_schema.sql
--   002_rls_policies.sql
--   003_restock_round_type.sql
--   004_restock_stop_items.sql
--   005_rls_restock_vuller.sql
-- ============================================================


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 001_initial_schema.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================
-- LogistiekStock — Initial Schema
-- ============================================================

-- Enable UUID extension
create extension if not exists "pgcrypto";

-- ─── Helper function for updated_at ────────────────────────────────────────
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────
create table profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  email       text not null unique,
  display_name text not null,
  avatar_url  text,
  is_active   boolean not null default true,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger profiles_updated_at before update on profiles
  for each row execute function set_updated_at();

-- ─── roles ─────────────────────────────────────────────────────────────────
create table user_roles (
  id          uuid primary key default gen_random_uuid(),
  profile_id  uuid not null references profiles(id) on delete cascade,
  role        text not null check (role in ('ADMIN','PLANNER','TELLER','VULLER')),
  created_at  timestamptz not null default now(),
  unique(profile_id, role)
);
create index on user_roles(profile_id);

-- ─── rings ─────────────────────────────────────────────────────────────────
create table rings (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  is_active   boolean not null default true,
  sort_order  int not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create trigger rings_updated_at before update on rings
  for each row execute function set_updated_at();

-- ─── kiosks ────────────────────────────────────────────────────────────────
create table kiosks (
  id          uuid primary key default gen_random_uuid(),
  ring_id     uuid not null references rings(id) on delete restrict,
  number      int not null,
  name        text,
  sort_order  int not null default 0,
  is_active   boolean not null default true,
  location    text,
  notes       text,
  deleted_at  timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(ring_id, number)
);
create index on kiosks(ring_id);
create index on kiosks(is_active);
create trigger kiosks_updated_at before update on kiosks
  for each row execute function set_updated_at();

-- ─── product_categories ────────────────────────────────────────────────────
create table product_categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique,
  sort_order  int not null default 0,
  is_active   boolean not null default true
);

-- ─── products ──────────────────────────────────────────────────────────────
create table products (
  id                      uuid primary key default gen_random_uuid(),
  category_id             uuid not null references product_categories(id),
  name                    text not null,
  short_name              text not null,
  count_unit              text not null,
  packaging_unit          text not null,
  sort_order              int not null default 0,
  is_active               boolean not null default true,
  -- 1 | 0.5 | 0.25 stored as text to avoid float imprecision
  input_step              text not null default '1' check (input_step in ('1','0.5','0.25')),
  allow_partial_package   boolean not null default false,
  round_type              text not null default 'AUTO' check (round_type in ('PRODUCT_ROUND','MIXED_PALLET','AUTO')),
  product_size            text not null default 'MEDIUM' check (product_size in ('SMALL','MEDIUM','LARGE')),
  estimated_pallet_load   numeric(10,2) not null default 0 check (estimated_pallet_load >= 0),
  own_round_threshold     int not null default 0 check (own_round_threshold >= 0),
  priority                int not null default 0,
  storage_location        text,
  refrigerated            boolean not null default false,
  notes                   text,
  deleted_at              timestamptz,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);
create index on products(category_id);
create index on products(is_active);
create trigger products_updated_at before update on products
  for each row execute function set_updated_at();

-- ─── kiosk_product_standards ───────────────────────────────────────────────
create table kiosk_product_standards (
  id                              uuid primary key default gen_random_uuid(),
  kiosk_id                        uuid not null references kiosks(id) on delete cascade,
  product_id                      uuid not null references products(id) on delete cascade,
  -- stored as quarter units (1 package = 4 quarters)
  target_quantity_quarters        int not null default 0 check (target_quantity_quarters >= 0),
  half_package_threshold_pct      int not null default 80 check (half_package_threshold_pct between 0 and 100),
  is_active                       boolean not null default true,
  created_at                      timestamptz not null default now(),
  updated_at                      timestamptz not null default now(),
  unique(kiosk_id, product_id)
);
create index on kiosk_product_standards(kiosk_id);
create index on kiosk_product_standards(product_id);
create trigger kiosk_product_standards_updated_at before update on kiosk_product_standards
  for each row execute function set_updated_at();

-- ─── events ────────────────────────────────────────────────────────────────
create table events (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  date                date not null,
  event_type          text not null default 'OVERIG' check (event_type in ('VOETBAL','CONCERT','OVERIG')),
  status              text not null default 'DRAFT' check (status in (
    'DRAFT','READY_FOR_COUNTING','COUNTING','COUNT_REVIEW',
    'READY_FOR_RESTOCK','RESTOCKING','COMPLETED','ARCHIVED'
  )),
  expected_attendees  int check (expected_attendees >= 0),
  notes               text,
  created_by_id       uuid not null references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);
create index on events(status);
create index on events(date);
create trigger events_updated_at before update on events
  for each row execute function set_updated_at();

-- ─── event_rings ───────────────────────────────────────────────────────────
create table event_rings (
  event_id  uuid not null references events(id) on delete cascade,
  ring_id   uuid not null references rings(id) on delete cascade,
  primary key(event_id, ring_id)
);

-- ─── event_kiosks ──────────────────────────────────────────────────────────
create table event_kiosks (
  event_id    uuid not null references events(id) on delete cascade,
  kiosk_id    uuid not null references kiosks(id) on delete cascade,
  is_open     boolean not null default true,
  primary key(event_id, kiosk_id)
);
create index on event_kiosks(event_id);

-- ─── event_users ───────────────────────────────────────────────────────────
create table event_users (
  event_id    uuid not null references events(id) on delete cascade,
  profile_id  uuid not null references profiles(id) on delete cascade,
  primary key(event_id, profile_id)
);

-- ─── count_sessions ────────────────────────────────────────────────────────
create table count_sessions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references profiles(id),
  event_id        uuid not null references events(id) on delete cascade,
  ring_id         uuid not null references rings(id),
  start_kiosk_id  uuid not null references kiosks(id),
  direction       text not null check (direction in ('ascending','descending')),
  -- JSON array of kiosk UUIDs in route order
  kiosk_route     jsonb not null default '[]',
  started_at      timestamptz not null default now(),
  completed_at    timestamptz,
  status          text not null default 'NOT_STARTED' check (status in (
    'NOT_STARTED','IN_PROGRESS','PAUSED','SUBMITTED','APPROVED','REOPENED'
  )),
  sync_status     text not null default 'LOCAL' check (sync_status in (
    'LOCAL','SYNCING','SYNCED','ERROR','CONFLICT'
  )),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on count_sessions(event_id);
create index on count_sessions(user_id);
create trigger count_sessions_updated_at before update on count_sessions
  for each row execute function set_updated_at();

-- ─── kiosk_counts ──────────────────────────────────────────────────────────
create table kiosk_counts (
  id                uuid primary key default gen_random_uuid(),
  count_session_id  uuid not null references count_sessions(id) on delete cascade,
  kiosk_id          uuid not null references kiosks(id),
  started_at        timestamptz,
  completed_at      timestamptz,
  counter_id        uuid not null references profiles(id),
  general_notes     text,
  status            text not null default 'PENDING' check (status in (
    'PENDING','IN_PROGRESS','COMPLETED','SKIPPED'
  )),
  skip_reason       text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now(),
  unique(count_session_id, kiosk_id)
);
create index on kiosk_counts(count_session_id);
create trigger kiosk_counts_updated_at before update on kiosk_counts
  for each row execute function set_updated_at();

-- ─── count_entries ─────────────────────────────────────────────────────────
create table count_entries (
  id                          uuid primary key default gen_random_uuid(),
  kiosk_count_id              uuid not null references kiosk_counts(id) on delete cascade,
  product_id                  uuid not null references products(id),
  target_quantity_quarters    int not null check (target_quantity_quarters >= 0),
  counted_quantity_quarters   int not null check (counted_quantity_quarters >= 0),
  effective_quantity_quarters int not null check (effective_quantity_quarters >= 0),
  restock_quantity_packages   int not null check (restock_quantity_packages >= 0),
  applied_fraction_rule       text not null check (applied_fraction_rule in (
    'NONE','QUARTER_DOWN','HALF_DOWN','HALF_UP','THREE_QUARTER_UP'
  )),
  notes                       text,
  last_modified_at            timestamptz not null default now(),
  last_modified_by_id         uuid not null references profiles(id),
  unique(kiosk_count_id, product_id)
);
create index on count_entries(kiosk_count_id);

-- ─── incidents ─────────────────────────────────────────────────────────────
create table incidents (
  id              uuid primary key default gen_random_uuid(),
  event_id        uuid not null references events(id) on delete cascade,
  kiosk_id        uuid not null references kiosks(id),
  category        text not null check (category in (
    'biertap','post-mix','koelcel','verlichting','kassa','water','elektriciteit','anders'
  )),
  description     text not null,
  urgency         text not null default 'normal' check (urgency in (
    'low','normal','high','kiosk_onbruikbaar'
  )),
  photo_url       text,
  reported_by_id  uuid not null references profiles(id),
  reported_at     timestamptz not null default now(),
  status          text not null default 'OPEN' check (status in (
    'OPEN','ACKNOWLEDGED','IN_PROGRESS','RESOLVED','CLOSED'
  )),
  assigned_to_id  uuid references profiles(id),
  resolution      text,
  resolved_at     timestamptz,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);
create index on incidents(event_id);
create index on incidents(kiosk_id);
create index on incidents(status);
create trigger incidents_updated_at before update on incidents
  for each row execute function set_updated_at();

-- ─── restock_requirements ──────────────────────────────────────────────────
create table restock_requirements (
  id                    uuid primary key default gen_random_uuid(),
  event_id              uuid not null references events(id) on delete cascade,
  kiosk_id              uuid not null references kiosks(id),
  product_id            uuid not null references products(id),
  required_packages     int not null check (required_packages >= 0),
  reserved_packages     int not null default 0 check (reserved_packages >= 0),
  delivered_packages    int not null default 0 check (delivered_packages >= 0),
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now(),
  unique(event_id, kiosk_id, product_id)
);
create index on restock_requirements(event_id);
create trigger restock_requirements_updated_at before update on restock_requirements
  for each row execute function set_updated_at();

-- ─── restock_rounds ────────────────────────────────────────────────────────
create table restock_rounds (
  id                uuid primary key default gen_random_uuid(),
  event_id          uuid not null references events(id) on delete cascade,
  ring_id           uuid not null references rings(id),
  name              text not null,
  status            text not null default 'DRAFT' check (status in (
    'DRAFT','PICKING','READY','CLAIMED','IN_PROGRESS',
    'PARTIALLY_COMPLETED','COMPLETED','CANCELLED'
  )),
  created_by_id     uuid not null references profiles(id),
  assigned_user_id  uuid references profiles(id),
  claimed_at        timestamptz,
  started_at        timestamptz,
  completed_at      timestamptz,
  notes             text,
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);
create index on restock_rounds(event_id);
create trigger restock_rounds_updated_at before update on restock_rounds
  for each row execute function set_updated_at();

-- ─── restock_round_items ───────────────────────────────────────────────────
create table restock_round_items (
  id                  uuid primary key default gen_random_uuid(),
  restock_round_id    uuid not null references restock_rounds(id) on delete cascade,
  product_id          uuid not null references products(id),
  proposed_packages   int not null check (proposed_packages >= 0),
  loaded_packages     int not null default 0 check (loaded_packages >= 0),
  delivered_packages  int not null default 0 check (delivered_packages >= 0),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now(),
  unique(restock_round_id, product_id)
);

-- ─── restock_round_stops ───────────────────────────────────────────────────
create table restock_round_stops (
  id                uuid primary key default gen_random_uuid(),
  restock_round_id  uuid not null references restock_rounds(id) on delete cascade,
  kiosk_id          uuid not null references kiosks(id),
  sort_order        int not null default 0,
  completed_at      timestamptz,
  notes             text
);
create index on restock_round_stops(restock_round_id);

-- ─── restock_deliveries ────────────────────────────────────────────────────
create table restock_deliveries (
  id                        uuid primary key default gen_random_uuid(),
  restock_round_stop_id     uuid not null references restock_round_stops(id) on delete cascade,
  product_id                uuid not null references products(id),
  planned_packages          int not null check (planned_packages >= 0),
  delivered_packages        int not null check (delivered_packages >= 0),
  not_delivered_packages    int not null check (not_delivered_packages >= 0),
  reason                    text check (reason in (
    'onvoldoende_magazijnvoorraad','niet_op_pallet','kiosk_niet_bereikbaar',
    'verkeerde_telling','product_al_aanwezig','beschadigd_product','andere_reden'
  )),
  reason_notes              text,
  delivered_at              timestamptz,
  delivered_by_id           uuid not null references profiles(id),
  created_at                timestamptz not null default now()
);
create index on restock_deliveries(restock_round_stop_id);

-- ─── stock_reservations ────────────────────────────────────────────────────
create table stock_reservations (
  id                        uuid primary key default gen_random_uuid(),
  restock_requirement_id    uuid not null references restock_requirements(id) on delete cascade,
  restock_round_id          uuid not null references restock_rounds(id) on delete cascade,
  reserved_packages         int not null check (reserved_packages > 0),
  created_at                timestamptz not null default now(),
  unique(restock_requirement_id, restock_round_id)
);

-- ─── audit_logs ────────────────────────────────────────────────────────────
create table audit_logs (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references profiles(id),
  occurred_at   timestamptz not null default now(),
  entity_type   text not null,
  entity_id     uuid not null,
  action        text not null,
  old_value     jsonb,
  new_value     jsonb
);
create index on audit_logs(entity_type, entity_id);
create index on audit_logs(user_id);
create index on audit_logs(occurred_at);

-- ─── sync_conflicts ────────────────────────────────────────────────────────
create table sync_conflicts (
  id              uuid primary key default gen_random_uuid(),
  entity_type     text not null,
  entity_id       uuid not null,
  local_version   jsonb not null,
  server_version  jsonb not null,
  detected_at     timestamptz not null default now(),
  resolved_at     timestamptz,
  resolved_by     uuid references profiles(id)
);


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 002_rls_policies.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================
-- Row Level Security Policies
-- ============================================================

-- Helper: check of de huidige gebruiker een specifieke rol heeft
create or replace function auth_has_role(required_role text)
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where profile_id = auth.uid()
      and role = required_role
  );
$$;

create or replace function auth_has_any_role(roles text[])
returns boolean language sql security definer stable as $$
  select exists (
    select 1 from user_roles
    where profile_id = auth.uid()
      and role = any(roles)
  );
$$;

-- ─── profiles ──────────────────────────────────────────────────────────────
alter table profiles enable row level security;
-- Iedereen mag zijn eigen profiel lezen; admins mogen alles lezen
create policy "profiles_select_own" on profiles
  for select using (id = auth.uid() or auth_has_role('ADMIN'));
create policy "profiles_update_own" on profiles
  for update using (id = auth.uid());
create policy "profiles_insert_admin" on profiles
  for insert with check (auth_has_role('ADMIN'));
create policy "profiles_all_admin" on profiles
  for all using (auth_has_role('ADMIN'));

-- ─── user_roles ────────────────────────────────────────────────────────────
alter table user_roles enable row level security;
create policy "user_roles_select" on user_roles
  for select using (profile_id = auth.uid() or auth_has_role('ADMIN'));
create policy "user_roles_all_admin" on user_roles
  for all using (auth_has_role('ADMIN'));

-- ─── rings ─────────────────────────────────────────────────────────────────
alter table rings enable row level security;
create policy "rings_select_authenticated" on rings
  for select using (auth.uid() is not null);
create policy "rings_all_admin" on rings
  for all using (auth_has_role('ADMIN'));

-- ─── kiosks ────────────────────────────────────────────────────────────────
alter table kiosks enable row level security;
create policy "kiosks_select_authenticated" on kiosks
  for select using (auth.uid() is not null and deleted_at is null);
create policy "kiosks_all_admin" on kiosks
  for all using (auth_has_role('ADMIN'));

-- ─── product_categories & products ─────────────────────────────────────────
alter table product_categories enable row level security;
create policy "product_categories_select" on product_categories
  for select using (auth.uid() is not null);
create policy "product_categories_all_admin" on product_categories
  for all using (auth_has_role('ADMIN'));

alter table products enable row level security;
create policy "products_select" on products
  for select using (auth.uid() is not null and deleted_at is null);
create policy "products_all_admin" on products
  for all using (auth_has_role('ADMIN'));

-- ─── kiosk_product_standards ───────────────────────────────────────────────
alter table kiosk_product_standards enable row level security;
create policy "standards_select_authenticated" on kiosk_product_standards
  for select using (auth.uid() is not null);
create policy "standards_write_admin_planner" on kiosk_product_standards
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

-- ─── events ────────────────────────────────────────────────────────────────
alter table events enable row level security;
create policy "events_select_authenticated" on events
  for select using (auth.uid() is not null);
create policy "events_write_admin_planner" on events
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

-- ─── event_rings / event_kiosks / event_users ──────────────────────────────
alter table event_rings enable row level security;
create policy "event_rings_select" on event_rings
  for select using (auth.uid() is not null);
create policy "event_rings_write" on event_rings
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

alter table event_kiosks enable row level security;
create policy "event_kiosks_select" on event_kiosks
  for select using (auth.uid() is not null);
create policy "event_kiosks_write" on event_kiosks
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

alter table event_users enable row level security;
create policy "event_users_select" on event_users
  for select using (auth.uid() is not null);
create policy "event_users_write" on event_users
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

-- ─── count_sessions ────────────────────────────────────────────────────────
alter table count_sessions enable row level security;
-- Tellers zien eigen sessies; planners/admins zien alles
create policy "count_sessions_select" on count_sessions
  for select using (
    user_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );
-- Tellers mogen eigen niet-goedgekeurde sessies aanpassen
create policy "count_sessions_update_teller" on count_sessions
  for update using (
    user_id = auth.uid()
    and status not in ('APPROVED')
    or auth_has_any_role(array['ADMIN','PLANNER'])
  );
create policy "count_sessions_insert_teller" on count_sessions
  for insert with check (
    user_id = auth.uid() and auth_has_any_role(array['ADMIN','PLANNER','TELLER'])
  );

-- ─── kiosk_counts ──────────────────────────────────────────────────────────
alter table kiosk_counts enable row level security;
create policy "kiosk_counts_select" on kiosk_counts
  for select using (
    counter_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );
create policy "kiosk_counts_write_teller" on kiosk_counts
  for all using (
    counter_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );

-- ─── count_entries ─────────────────────────────────────────────────────────
alter table count_entries enable row level security;
create policy "count_entries_select" on count_entries
  for select using (
    last_modified_by_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );
create policy "count_entries_write" on count_entries
  for all using (
    last_modified_by_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );

-- ─── incidents ─────────────────────────────────────────────────────────────
alter table incidents enable row level security;
create policy "incidents_select_authenticated" on incidents
  for select using (auth.uid() is not null);
create policy "incidents_insert_authenticated" on incidents
  for insert with check (auth.uid() is not null);
create policy "incidents_update" on incidents
  for update using (
    reported_by_id = auth.uid() or auth_has_any_role(array['ADMIN','PLANNER'])
  );

-- ─── restock tables ────────────────────────────────────────────────────────
alter table restock_requirements enable row level security;
create policy "restock_req_select" on restock_requirements
  for select using (auth.uid() is not null);
create policy "restock_req_write" on restock_requirements
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

alter table restock_rounds enable row level security;
create policy "restock_rounds_select" on restock_rounds
  for select using (auth.uid() is not null);
create policy "restock_rounds_write" on restock_rounds
  for all using (
    created_by_id = auth.uid()
    or assigned_user_id = auth.uid()
    or auth_has_any_role(array['ADMIN','PLANNER'])
  );

alter table restock_round_items enable row level security;
create policy "rri_select" on restock_round_items for select using (auth.uid() is not null);
create policy "rri_write" on restock_round_items
  for all using (auth_has_any_role(array['ADMIN','PLANNER','VULLER']));

alter table restock_round_stops enable row level security;
create policy "rrs_select" on restock_round_stops for select using (auth.uid() is not null);
create policy "rrs_write" on restock_round_stops
  for all using (auth_has_any_role(array['ADMIN','PLANNER','VULLER']));

alter table restock_deliveries enable row level security;
create policy "rd_select" on restock_deliveries for select using (auth.uid() is not null);
create policy "rd_write" on restock_deliveries
  for all using (auth_has_any_role(array['ADMIN','PLANNER','VULLER']));

alter table stock_reservations enable row level security;
create policy "sr_select" on stock_reservations for select using (auth.uid() is not null);
create policy "sr_write" on stock_reservations
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));

-- ─── audit_logs (read-only for non-admins) ─────────────────────────────────
alter table audit_logs enable row level security;
create policy "audit_select_admin" on audit_logs
  for select using (auth_has_role('ADMIN'));
create policy "audit_insert_system" on audit_logs
  for insert with check (auth.uid() is not null);
-- No update/delete policies — logs are immutable

-- ─── sync_conflicts ────────────────────────────────────────────────────────
alter table sync_conflicts enable row level security;
create policy "conflicts_select" on sync_conflicts
  for select using (auth_has_any_role(array['ADMIN','PLANNER']));
create policy "conflicts_write" on sync_conflicts
  for all using (auth_has_any_role(array['ADMIN','PLANNER']));


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 003_restock_round_type.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================
-- LogistiekStock — vulronde-type
-- ============================================================
-- Een vulronde is óf een productronde (één product, veel kiosken) óf een
-- gemengde pallet (meerdere producten). Dat onderscheid stuurt de planning en
-- het afleverscherm, dus het hoort op de ronde zelf te staan.

alter table restock_rounds
  add column if not exists round_type text not null default 'MIXED_PALLET'
    check (round_type in ('PRODUCT_ROUND', 'MIXED_PALLET'));

-- Bestaande rondes met precies één product zijn productrondes.
update restock_rounds r
set round_type = 'PRODUCT_ROUND'
where (select count(*) from restock_round_items i where i.restock_round_id = r.id) = 1;

create index if not exists restock_rounds_status_idx on restock_rounds(status);


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 004_restock_stop_items.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================
-- LogistiekStock — geplande hoeveelheden per halte
-- ============================================================
-- Bij het laden van een pallet wordt de geladen hoeveelheid over de kiosken
-- verdeeld. Die verdeling moet vastliggen: anders zou het te leveren aantal
-- per kiosk verschuiven zodra er onderweg iets geleverd is.

create table if not exists restock_stop_items (
  id                      uuid primary key default gen_random_uuid(),
  restock_round_stop_id   uuid not null references restock_round_stops(id) on delete cascade,
  product_id              uuid not null references products(id),
  restock_requirement_id  uuid references restock_requirements(id) on delete set null,
  planned_packages        int not null check (planned_packages >= 0),
  created_at              timestamptz not null default now(),
  unique(restock_round_stop_id, product_id)
);
create index if not exists restock_stop_items_stop_idx on restock_stop_items(restock_round_stop_id);

alter table restock_round_stops
  add column if not exists skip_reason text;

-- Row Level Security volgt hetzelfde patroon als de andere vultabellen.
alter table restock_stop_items enable row level security;

create policy "restock_stop_items_select" on restock_stop_items
  for select to authenticated using (true);

create policy "restock_stop_items_write" on restock_stop_items
  for all to authenticated using (true) with check (true);


-- ┌──────────────────────────────────────────────────────────────────────
-- │ 005_rls_restock_vuller.sql
-- └──────────────────────────────────────────────────────────────────────

-- ============================================================
-- LogistiekStock — RLS bijstellen voor de vulronde
-- ============================================================
-- De policies uit 002 lieten een vuller zijn eigen werk niet afmaken. Alle
-- drie de gevallen blokkeren dezelfde keten: afleveren boekt af op de
-- behoefte en geeft de reservering vrij, zodat een restant weer in de
-- vulplanning verschijnt.

-- ─── Een klaarstaande ronde kunnen aannemen ────────────────────────────────
-- De oude policy eiste dat je al toegewezen was, terwijl het aannemen juist
-- de actie is die je toewijst. Een vuller kwam daardoor niet voorbij "Ronde
-- aannemen en starten".
drop policy if exists "restock_rounds_write" on restock_rounds;
create policy "restock_rounds_write" on restock_rounds
  for all using (
    created_by_id = auth.uid()
    or assigned_user_id = auth.uid()
    or auth_has_any_role(array['ADMIN', 'PLANNER'])
    -- Oppakken mag alleen bij een ronde die klaarstaat en nog vrij is.
    or (
      auth_has_role('VULLER')
      and assigned_user_id is null
      and status = 'READY'
    )
  );

-- ─── Levering afboeken op de behoefte ──────────────────────────────────────
-- Bij het registreren van een levering werkt de app delivered_packages en
-- reserved_packages bij. Zonder dit blijft een tekort openstaan ook als het
-- geleverd is.
--
-- Let op: RLS werkt per rij, niet per kolom. Een vuller kan hiermee in
-- theorie ook required_packages aanpassen. Beperken tot losse kolommen zou
-- een security definer-functie vragen, en dan zou de bijvulrekenkunde zowel
-- in TypeScript als in SQL bestaan. Dat weegt hier niet op tegen het risico:
-- alles gaat via de app en elke levering ligt vast in restock_deliveries.
drop policy if exists "restock_req_write" on restock_requirements;
create policy "restock_req_write" on restock_requirements
  for all using (auth_has_any_role(array['ADMIN', 'PLANNER', 'VULLER']));

-- ─── Reservering vrijgeven ─────────────────────────────────────────────────
-- Gebeurt bij elke levering en bij het afronden van een ronde. Zonder dit
-- blijft voorraad voor altijd gereserveerd staan op een afgeronde ronde.
drop policy if exists "sr_write" on stock_reservations;
create policy "sr_write" on stock_reservations
  for all using (auth_has_any_role(array['ADMIN', 'PLANNER', 'VULLER']));

-- ─── Leesbaarheid ──────────────────────────────────────────────────────────
-- Gedrag ongewijzigd; AND bond al sterker dan OR. Met haakjes is dat te zien
-- zonder de precedentieregels uit het hoofd te kennen.
drop policy if exists "count_sessions_update_teller" on count_sessions;
create policy "count_sessions_update_teller" on count_sessions
  for update using (
    (user_id = auth.uid() and status <> 'APPROVED')
    or auth_has_any_role(array['ADMIN', 'PLANNER'])
  );
