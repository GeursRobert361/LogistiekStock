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
