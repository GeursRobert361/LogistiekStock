-- De evenementenagenda: wat er dit seizoen op de kalender staat.
--
-- Bewust los van `events`. Een agendaregel is een plan — een datum en een
-- tegenstander — en nog geen telbaar evenement met ringen, kiosken en een
-- status. Pas als er geteld gaat worden, wordt er een echt evenement van
-- gemaakt.
create table event_agenda (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  date        date not null,
  event_type  text not null default 'VOETBAL' check (event_type in ('VOETBAL','CONCERT','OVERIG')),
  notes       text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique(date, name)
);
create index on event_agenda(date);
create trigger event_agenda_updated_at before update on event_agenda
  for each row execute function set_updated_at();
