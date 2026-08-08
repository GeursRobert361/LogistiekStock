-- ============================================================
-- LogistiekStock — invarianten op de bijvulbehoefte
-- ============================================================
-- Een behoefte kent drie getallen: hoeveel er nodig is, hoeveel er voor
-- vastligt op een pallet, en hoeveel er werkelijk is afgeleverd. Samen mogen
-- gereserveerd en geleverd nooit meer zijn dan er nodig is — anders belooft de
-- planning voorraad die er niet is.
--
-- Tot nu toe werd dat alleen in de applicatie bewaakt, en juist daar zat het
-- lek: twee gelijktijdige rondes konden dezelfde ruimte tweemaal claimen. Het
-- reserveren gebeurt inmiddels in één transactie met een slot op de rij; deze
-- controle is het vangnet daaronder.

-- ─── Bestaande gegevens eerst rechtzetten ──────────────────────────────────
-- Alleen reserveringen worden bijgesteld. Wat geleverd is blijft staan: dat is
-- een vastgelegd feit van de vloer, geen planning. De applicatie houdt
-- geleverd al binnen het benodigde aantal, dus dit klemt hooguit een
-- reservering die door de oude race te hoog was uitgevallen.
update restock_requirements
   set reserved_packages = greatest(0, required_packages - delivered_packages)
 where reserved_packages > greatest(0, required_packages - delivered_packages);

-- ─── En daarna vastleggen ──────────────────────────────────────────────────
-- Idempotent: bij een tweede run bestaat de constraint al.
do $$
begin
  if not exists (
    select 1 from pg_constraint
     where conname = 'restock_requirements_within_required'
       and conrelid = 'restock_requirements'::regclass
  ) then
    alter table restock_requirements
      add constraint restock_requirements_within_required
      check (reserved_packages + delivered_packages <= required_packages);
  end if;
end
$$;

-- Reserveren zoekt op (evenement, kiosk, product). De unieke sleutel dekt dat
-- al, maar niet de variant waarbij op een reeks kiosken tegelijk wordt
-- vergrendeld.
create index if not exists restock_requirements_event_kiosk_idx
  on restock_requirements(event_id, kiosk_id);
