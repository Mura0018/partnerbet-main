create table customers (
  id uuid primary key default gen_random_uuid(),
  phone text not null unique,
  password_hash text not null,
  full_name text,
  telegram_id bigint unique,
  created_at timestamptz not null default now()
);

create index customers_telegram_id_idx on customers (telegram_id);
