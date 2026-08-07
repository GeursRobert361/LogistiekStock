-- ============================================================
-- LogistiekStock — eigen naam voor een kiosk
-- ============================================================
-- Niet elk telpunt heeft een gewoon nummer. De cubes tegenover kiosk 120 zijn
-- drie losse hokjes met een eigen assortiment; op de vloer heten ze
-- "120 Cubes". Het nummer blijft nodig voor de volgorde en de uniciteit, maar
-- wat er op het scherm staat is dit label.
--
-- Leeg laten betekent: gewoon "Kiosk <nummer>".

alter table kiosks
  add column if not exists label text;
