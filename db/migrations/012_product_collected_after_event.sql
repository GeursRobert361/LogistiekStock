-- ============================================================
-- LogistiekStock — producten die na elk evenement worden opgehaald
-- ============================================================
-- De GFT-bakken worden na afloop bij de kiosk weggehaald. De kiosk begint dus
-- elke keer met niets, en dan is tellen zinloos: het antwoord is altijd nul en
-- de behoefte altijd de volle norm.
--
-- Zulke producten horen daarom niet op de tellijst en altijd op de vullijst.
-- Een teller die er toch naar moet kijken telt vijftien keer per avond een nul
-- die niemand nodig heeft, en erger: als hij die regel overslaat blijft de
-- kiosktelling onafgerond hangen.
--
-- Dit is bewust geen bijzonder geval van "tekort berekenen". Er wordt niets
-- geteld, dus er is ook geen telregel om iets uit af te leiden; de behoefte
-- wordt er bij het goedkeuren apart bij gezet, op de norm van die kiosk. De
-- norm blijft dus gewoon in kiosk_product_standards staan — de vuller ziet hem
-- terug als "moet er staan".
--
-- False als standaard: een bestaand product verdwijnt niet ongemerkt van de
-- tellijst.

alter table products
  add column if not exists collected_after_event boolean not null default false;
