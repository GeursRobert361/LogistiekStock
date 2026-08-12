-- ============================================================
-- LogistiekStock — productnamen gelijk aan de bestellijst
-- ============================================================
-- De catalogus gebruikte inkoopnamen ("Chaudfontaine Blauw"), de vloer gebruikt
-- de namen van de bestellijst ("Water Blauw"). Wie telt leest de lijst, dus die
-- namen horen in de app te staan.
--
-- Waarom dit een migratie is en niet alleen een wijziging in de seed: de seed
-- koppelt producten op naam. Een hernoeming in de code alleen zou dus een
-- nieuwe productrij aanmaken en de oude uitschakelen — met alle bestaande
-- tellingen aan het verkeerde product. Door hier eerst de bestaande rij te
-- hernoemen blijft het dezelfde id, en blijft de historie kloppen.
--
-- De where-voorwaarde maakt dit herhaalbaar: een tweede keer draaien doet
-- niets.

update products set name = 'Water Blauw', short_name = 'Water Blauw'
 where name = 'Chaudfontaine Blauw';

update products set name = 'Water Rood', short_name = 'Water Rood'
 where name = 'Chaudfontaine Rood';

update products set name = 'Heineken 0.0'
 where name = 'Heineken 0.0%';

update products set name = 'Radler 2.0'
 where name = 'Radler 2.0%';

update products set name = 'Bacardi Lime & Lemonade', short_name = 'Bac. Lime'
 where name = 'Bacardi Lemon';

update products set name = 'Stelz Ice Tea'
 where name = 'Stelz Icetea';

update products set name = 'Jack Daniels Cola'
 where name = 'Jack Daniels';

update products set name = 'Red Bull', short_name = 'Red Bull'
 where name = 'Redbull';

-- De bestellijst geeft sausflessen een norm van 15. Dat is een aantal flessen;
-- vijftien pakken saus staat in geen enkele kiosk. De teller hoort de eenheid
-- te zien die hij vasthoudt.
update products set count_unit = 'fles', packaging_unit = 'flessen'
 where name in ('Mayo Flessen', 'Ketchup Flessen', 'Mosterd Flessen');
