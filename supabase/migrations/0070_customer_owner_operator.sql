-- =====================================================================
--  KOP KASSA — 2-BOSQICH: MIJOZ <-> OPERATOR EGALIGI
--  Har mijoz bitta operatorga birikadi (owner). Ega birinchi BAJARILGAN
--  buyurtmada o'rnatiladi (server tomonda, status route), keyin
--  o'zgarmaydi. Bu migratsiya faqat ustun + indeks qo'shadi.
-- =====================================================================

alter table customers
  add column if not exists owner_operator_id uuid references profiles(id) on delete set null;

create index if not exists idx_customers_owner_operator on customers(owner_operator_id);
