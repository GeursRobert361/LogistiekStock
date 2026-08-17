-- Een voorraadnorm die iemand zelf in Beheer heeft gezet.
--
-- De stamdata-sync trekt de tweede ring gelijk met de aangeleverde lijsten die
-- in de code staan. Dat klopt voor alles wat van papier komt, maar niet voor
-- een correctie die op de vloer is bedacht: die werd bij de eerstvolgende sync
-- stilzwijgend teruggezet, en dan loopt dezelfde kiosk op dezelfde wedstrijd
-- opnieuw leeg op hetzelfde product.
--
-- Staat hier een tijdstip, dan is deze norm met de hand gezet. De sync laat hem
-- dan met rust en meldt hem apart, zodat het verschil met de papieren lijst
-- zichtbaar blijft in plaats van weg te zakken.
--
-- Bewust een tijdstip en geen vinkje: bij een verschil met de lijst wil je
-- weten wat het nieuwst is.
alter table kiosk_product_standards
  add column if not exists manually_set_at timestamptz;

-- De sync vraagt hier bij elke run naar, en alleen naar de rijen die gezet zijn.
create index if not exists kiosk_product_standards_manually_set_idx
  on kiosk_product_standards(manually_set_at)
  where manually_set_at is not null;
