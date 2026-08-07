-- ============================================================
-- LogistiekStock — vulronde-type
-- ============================================================
-- Een vulronde is óf een productronde (één product, veel kiosken) óf een
-- gemengde pallet (meerdere producten). Dat onderscheid stuurt de planning en
-- het afleverscherm, dus het hoort op de ronde zelf te staan.

alter table restock_rounds
  add column if not exists round_type text not null default 'MIXED_PALLET'
    check (round_type in ('PRODUCT_ROUND', 'MIXED_PALLET'));

-- Bestaande rondes met precies één product zijn productrondes.
update restock_rounds r
set round_type = 'PRODUCT_ROUND'
where (select count(*) from restock_round_items i where i.restock_round_id = r.id) = 1;

create index if not exists restock_rounds_status_idx on restock_rounds(status);
