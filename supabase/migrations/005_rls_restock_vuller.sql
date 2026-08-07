-- ============================================================
-- LogistiekStock — RLS bijstellen voor de vulronde
-- ============================================================
-- De policies uit 002 lieten een vuller zijn eigen werk niet afmaken. Alle
-- drie de gevallen blokkeren dezelfde keten: afleveren boekt af op de
-- behoefte en geeft de reservering vrij, zodat een restant weer in de
-- vulplanning verschijnt.

-- ─── Een klaarstaande ronde kunnen aannemen ────────────────────────────────
-- De oude policy eiste dat je al toegewezen was, terwijl het aannemen juist
-- de actie is die je toewijst. Een vuller kwam daardoor niet voorbij "Ronde
-- aannemen en starten".
drop policy if exists "restock_rounds_write" on restock_rounds;
create policy "restock_rounds_write" on restock_rounds
  for all using (
    created_by_id = auth.uid()
    or assigned_user_id = auth.uid()
    or auth_has_any_role(array['ADMIN', 'PLANNER'])
    -- Oppakken mag alleen bij een ronde die klaarstaat en nog vrij is.
    or (
      auth_has_role('VULLER')
      and assigned_user_id is null
      and status = 'READY'
    )
  );

-- ─── Levering afboeken op de behoefte ──────────────────────────────────────
-- Bij het registreren van een levering werkt de app delivered_packages en
-- reserved_packages bij. Zonder dit blijft een tekort openstaan ook als het
-- geleverd is.
--
-- Let op: RLS werkt per rij, niet per kolom. Een vuller kan hiermee in
-- theorie ook required_packages aanpassen. Beperken tot losse kolommen zou
-- een security definer-functie vragen, en dan zou de bijvulrekenkunde zowel
-- in TypeScript als in SQL bestaan. Dat weegt hier niet op tegen het risico:
-- alles gaat via de app en elke levering ligt vast in restock_deliveries.
drop policy if exists "restock_req_write" on restock_requirements;
create policy "restock_req_write" on restock_requirements
  for all using (auth_has_any_role(array['ADMIN', 'PLANNER', 'VULLER']));

-- ─── Reservering vrijgeven ─────────────────────────────────────────────────
-- Gebeurt bij elke levering en bij het afronden van een ronde. Zonder dit
-- blijft voorraad voor altijd gereserveerd staan op een afgeronde ronde.
drop policy if exists "sr_write" on stock_reservations;
create policy "sr_write" on stock_reservations
  for all using (auth_has_any_role(array['ADMIN', 'PLANNER', 'VULLER']));

-- ─── Leesbaarheid ──────────────────────────────────────────────────────────
-- Gedrag ongewijzigd; AND bond al sterker dan OR. Met haakjes is dat te zien
-- zonder de precedentieregels uit het hoofd te kennen.
drop policy if exists "count_sessions_update_teller" on count_sessions;
create policy "count_sessions_update_teller" on count_sessions
  for update using (
    (user_id = auth.uid() and status <> 'APPROVED')
    or auth_has_any_role(array['ADMIN', 'PLANNER'])
  );
