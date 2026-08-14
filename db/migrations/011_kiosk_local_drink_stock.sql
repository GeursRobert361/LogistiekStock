-- ============================================================
-- LogistiekStock — telpunten met een eigen drankvoorraad
-- ============================================================
-- `drink_storage_type` is een vuistregel: alleen een grote koeling houdt echte
-- drankvoorraad, een satelliet haalt tijdens het evenement bij uit een grote
-- kiosk in de buurt. Die regel klopt voor bijna elk telpunt.
--
-- Voor Ziggo Platform niet. Daar is een eigen stocklijst aangeleverd met echte
-- aantallen per drankproduct — één tray Heineken 0.0, twee trays Stelz, twee
-- pakken Fuze Tea. Dat is voorraad die geteld moet worden en die bij een tekort
-- gewoon door het magazijn aangevuld hoort te worden.
--
-- Waarom niet simpelweg 'LARGE_COOLER' invullen: er staat daar geen grote
-- koeling. Een opslagtype dat liegt over de vloer neemt later een andere
-- beslissing mee de verkeerde kant op — de indeling van de drankronde
-- bijvoorbeeld, die op datzelfde veld kijkt. En de volgende uitzondering zou
-- weer een nieuw verzonnen opslagtype kosten.
--
-- Vandaar een eigen kenmerk: een expliciete lokale stocklijst wint van de
-- generieke regel op het opslagtype. Komt er een tweede locatie bij, dan is dat
-- één vinkje.
--
-- False als standaard: een telpunt doet niet ongemerkt mee aan een uitzondering.
-- De waarde voor Ziggo Platform komt uit de gerichte tweede-ringsync en niet
-- uit deze migratie, zodat stamdata uit één bron blijft komen.

alter table kiosks
  add column if not exists keeps_own_drink_stock boolean not null default false;
