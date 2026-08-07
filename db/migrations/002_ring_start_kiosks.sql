-- ============================================================
-- LogistiekStock — standaard startkiosk per ring
-- ============================================================
-- Tellen en vullen beginnen niet op dezelfde plek: bij het tellen kom je de
-- lift uit op de ene kiosk, bij het vullen rijd je met een pallet een andere
-- kant op. Dat is een eigenschap van de ring zelf, dus hoort het hier en niet
-- in de code.
--
-- Beide zijn optioneel: staat er niets, dan valt de app terug op de eerste
-- kiosk van de ring.

alter table rings
  add column if not exists count_start_kiosk_id uuid references kiosks(id) on delete set null,
  add column if not exists restock_start_kiosk_id uuid references kiosks(id) on delete set null;
