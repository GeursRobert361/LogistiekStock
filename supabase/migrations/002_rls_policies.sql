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
