-- Welk evenement hiervoor kwam.
--
-- Nodig om verbruik te kunnen berekenen: wat er tijdens een evenement is
-- verkocht blijkt pas uit de telling vóór het volgende. De koppeling wordt bij
-- het aanmaken automatisch gelegd op het laatste eerdere evenement, maar staat
-- als kolom vast zodat een handmatige correctie mogelijk blijft.
alter table events add column if not exists previous_event_id uuid
  references events(id) on delete set null;
create index if not exists events_previous_event_id_idx on events(previous_event_id);
