-- ============================================================
-- LogistiekStock — Sixpacks heet Biertrays
-- ============================================================
-- De catalogus noemt dit product sinds c83cf53 "Biertrays"; het gaat om dozen
-- met biertrays en de oude naam liet tellers naar losse sixpacks zoeken. Het
-- seed-id bleef `sixpacks`, in de veronderstelling dat daarmee dezelfde rij
-- bedoeld blijft.
--
-- Dat klopt niet: de koppeling tussen seed en database loopt via de naam (zie
-- `resolveProductIds` in src/lib/seed/dbIds.ts). Een hernoeming in de code
-- alleen laat de levende rij "Sixpacks" dus buiten beeld — de sync zou zijn
-- normen als vreemd beschouwen, uitschakelen, en nieuwe normen wegschrijven op
-- een andere rij. Precies wat migratie 009 voor de drankproducten al voorkwam.
-- Door hier eerst de bestaande rij te hernoemen blijft het dezelfde id, en
-- blijven zijn normen en historie eraan hangen.
--
-- In productie staat al een verwijderde rij met de naam "Biertrays" uit een
-- eerdere ronde. Die blijft met rust: `resolveProductIds` laat een levende rij
-- van een verwijderde naamgenoot winnen, dus na deze hernoeming wijst
-- `sixpacks` naar de rij die de normen draagt.
--
-- De where-voorwaarde maakt dit herhaalbaar: een tweede keer draaien doet
-- niets.

update products set name = 'Biertrays', short_name = 'Biertrays'
 where name = 'Sixpacks' and deleted_at is null;
