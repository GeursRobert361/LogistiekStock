-- ============================================================
-- LogistiekStock — hoe een telpunt zijn drank opslaat
-- ============================================================
-- Niet elk telpunt met drank in het assortiment heeft ook een drankvoorraad.
-- Een satelliet verkoopt water en Fuze Tea, maar heeft geen koeling: er staat
-- een werkvoorraad van één, en bijvullen gebeurt tijdens het evenement uit een
-- grote kiosk in de buurt. Een norm van 1 daar is dus geen tekort dat het
-- magazijn moet aanvullen.
--
-- Zonder dit onderscheid komt elke satelliet met elke drank in de centrale
-- bijvullijst, en dat is werk dat niemand uitvoert.
--
--   LARGE_COOLER  grote koeling; dranknorm is echte buffervoorraad
--   SATELLITE     geen buffer; drank komt uit een grote kiosk
--   SMALL_BAR     eigen kleine voorraad, wél centraal aan te vullen
--   NONE          geen normale drankvoorraad
--
-- NONE als standaard: wie niets weet over een telpunt gaat er niet vanuit dat
-- er een koeling staat.

alter table kiosks
  add column if not exists drink_storage_type text not null default 'NONE'
    check (drink_storage_type in ('LARGE_COOLER','SATELLITE','SMALL_BAR','NONE'));

-- Uit welke grote kiosk een satelliet zijn drank haalt. Blijft voorlopig leeg:
-- de bronrelaties zijn nog niet vastgesteld en raden helpt niemand.
alter table kiosks
  add column if not exists drink_source_kiosk_id uuid
    references kiosks(id) on delete set null;

create index if not exists kiosks_drink_storage_type_idx on kiosks(drink_storage_type);
