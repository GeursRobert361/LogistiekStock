-- ============================================================
-- LogistiekStock — welke producten een satelliet uit een grote kiosk haalt
-- ============================================================
-- De satellietuitzondering geldt voor een precieze groep: de gekoelde
-- tray- en pakkendranken die tijdens een evenement uit een grote koeling
-- worden bijgehaald.
--
-- Waarom een kenmerk op het product en niet de categorie "Drank": die
-- categorie is te grof. Caprisun staat bij Ziggo Platform als gewone voorraad
-- en moet dus wél centraal aangevuld worden; witte wijn is geen tray uit een
-- koeling. Op categorie filteren zou die stilzwijgend uitsluiten, en dat is
-- precies het soort fout dat pas op een wedstrijddag opvalt.
--
-- False als standaard: een nieuw product doet niet ongemerkt mee aan een
-- uitzondering.

alter table products
  add column if not exists supplied_from_large_cooler_for_satellite boolean not null default false;
