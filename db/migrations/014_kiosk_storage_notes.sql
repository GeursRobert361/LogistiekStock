-- Opmerkingen over waar voorraad bij een kiosk fysiek ligt.
--
-- "2 dozen achter in de kiosk", "onder elk luik 1 doos". Ze stonden als vaste
-- lijst in de code, gekoppeld op kiosknummer en productnaam. Dat werkte, maar
-- niemand op de vloer kon er iets aan veranderen: een doos die verhuist wachtte
-- op een deploy, en een hernoemd product liet de opmerking geruisloos
-- verdwijnen. Vanaf hier staan ze in de database, op id, en zijn ze te
-- wijzigen in Beheer › Opmerkingen.
--
-- Wat het níet is: een aanpassing van de norm. 401 heeft er vijf staan, waarvan
-- twee achterin — geen zeven. Geen enkele berekening kijkt hiernaar.
create table if not exists kiosk_storage_notes (
  id          uuid primary key default gen_random_uuid(),
  kiosk_id    uuid not null references kiosks(id) on delete cascade,
  product_id  uuid references products(id) on delete cascade,
  category_id uuid references product_categories(id) on delete cascade,
  note        text not null check (length(btrim(note)) > 0),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  -- Een regel gaat over één product óf over een hele categorie. Allebei zou
  -- twee opmerkingen op dezelfde regel zetten; geen van beide zou een regel
  -- opleveren die nergens te zien is en dus ook nergens weg te halen.
  constraint kiosk_storage_notes_one_target check (num_nonnulls(product_id, category_id) = 1)
);

-- Per kiosk hooguit één opmerking per product en één per categorie: twee
-- tegenstrijdige briefjes onder dezelfde regel helpen niemand.
create unique index if not exists kiosk_storage_notes_product_idx
  on kiosk_storage_notes(kiosk_id, product_id)
  where product_id is not null;
create unique index if not exists kiosk_storage_notes_category_idx
  on kiosk_storage_notes(kiosk_id, category_id)
  where category_id is not null;

create trigger kiosk_storage_notes_updated_at before update on kiosk_storage_notes
  for each row execute function set_updated_at();

-- De opmerkingen die tot nu toe in de code stonden, zodat er na deze migratie
-- niets van het telscherm verdwijnt. Deze lijst staat ook in
-- `src/lib/seed/storageNoteSeeds.ts` — daar voor demo-modus, hier voor
-- productie — en een test vergelijkt de twee regel voor regel.
--
-- De koppeling loopt hier nog wél op nummer en naam: dat is het enige wat een
-- migratie in handen heeft. Vindt hij een kiosk, product of categorie niet, dan
-- slaat hij die regel over in plaats van de hele migratie te laten klappen om
-- een briefje.
with seed(kiosk_number, product_name, category_name, note) as (
  values
    (401, 'Bierbekers 0,5'::text, null::text, '2 dozen achter in de kiosk'::text),
    (410, 'Bierbekers 0,5', null, '1 doos achter in de kiosk'),
    (426, 'Bierbekers 0,5', null, '1 doos achter in de kiosk'),
    (401, null, 'Chips', '3 op de plank, onder elk luik 1 doos'),
    (406, null, 'Chips', '3 dozen op het kratje, rest onder de balie'),
    (410, null, 'Chips', '3 op de plank, onder elk luik 1 doos'),
    (412, null, 'Chips', 'Onder de balie, 3 per vakje'),
    (414, null, 'Chips', 'Onder de balie, 3 per vakje'),
    (416, null, 'Chips', 'Onder elk luik 1 doos, rest op de plank'),
    (426, null, 'Chips', '3 op de plank, onder elk luik 1 doos'),
    (427, null, 'Chips', 'Onder de balie, 3 per vakje'),
    (429, null, 'Chips', 'Onder de balie, 3 per vakje'),
    (4201, null, 'Chips', 'In het magazijn'),
    (406, null, 'Post-mix', 'In het hok links van de kiosk'),
    (420, null, 'Post-mix', 'In het hok links van de kiosk')
)
insert into kiosk_storage_notes (kiosk_id, product_id, category_id, note)
select k.id, p.id, c.id, s.note
from seed s
join kiosks k on k.number = s.kiosk_number and k.deleted_at is null
left join products p on p.name = s.product_name and p.deleted_at is null
left join product_categories c on c.name = s.category_name
where (s.product_name is null or p.id is not null)
  and (s.category_name is null or c.id is not null)
on conflict do nothing;
