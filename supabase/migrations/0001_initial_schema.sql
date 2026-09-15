-- Smart Shopper: initial schema
-- Rerunnable: every statement is guarded so the file can be applied more than once.
-- All money and quantities are NUMERIC. Never float.

create extension if not exists "pgcrypto";

-- ---------------------------------------------------------------------------
-- Enumerated types
-- ---------------------------------------------------------------------------
do $$ begin
  create type member_role as enum ('owner', 'member');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_status as enum ('draft', 'needs_review', 'approved');
exception when duplicate_object then null; end $$;

do $$ begin
  create type extraction_status as enum ('none', 'pending', 'extracted', 'failed', 'manual');
exception when duplicate_object then null; end $$;

do $$ begin
  create type discount_type as enum (
    'item_promotion',   -- price cut on one line
    'multibuy',         -- 2 for €3 style, may span lines
    'basket_voucher',   -- €10 off €50 etc.
    'loyalty',          -- Lidl Plus, Clubcard style
    'manual'            -- entered by the user with no receipt evidence
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type allocation_method as enum ('proportional', 'single_line', 'manual', 'unallocated');
exception when duplicate_object then null; end $$;

-- Base units used for comparison. Everything is normalised to one of these.
do $$ begin
  create type base_unit as enum ('g', 'ml', 'each');
exception when duplicate_object then null; end $$;

-- Units a product can be entered in. Converted to base_unit by the app.
do $$ begin
  create type measurement_unit as enum ('g', 'kg', 'ml', 'l', 'each');
exception when duplicate_object then null; end $$;

do $$ begin
  create type review_reason as enum (
    'unclear_description',
    'missing_product_mapping',
    'missing_pack_count',
    'missing_weight_or_volume',
    'unknown_unit',
    'uncertain_price',
    'uncertain_discount',
    'does_not_reconcile',
    'possible_duplicate',
    'missing_comparable_group',
    'voucher_eligibility_uncertain',
    'missing_date',
    'missing_retailer',
    'imported_needs_check'
  );
exception when duplicate_object then null; end $$;

do $$ begin
  create type exclusion_reason as enum (
    'deposit',
    'non_grocery',
    'one_off_household',
    'non_recurring',
    'insufficient_data',
    'user_choice'
  );
exception when duplicate_object then null; end $$;

-- ---------------------------------------------------------------------------
-- Households and membership
-- ---------------------------------------------------------------------------
create table if not exists households (
  id uuid primary key default gen_random_uuid(),
  name text not null default 'Home',
  currency char(3) not null default 'EUR',
  locale text not null default 'en-IE',
  timezone text not null default 'Europe/Dublin',
  freshness_days integer not null default 60 check (freshness_days > 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists household_members (
  user_id uuid not null references auth.users (id) on delete cascade,
  household_id uuid not null references households (id) on delete cascade,
  email text,
  role member_role not null default 'member',
  created_at timestamptz not null default now(),
  primary key (user_id, household_id)
);
create index if not exists household_members_household_idx on household_members (household_id);

-- Returns the household ids the calling user belongs to. Used by every RLS policy.
create or replace function current_household_ids()
returns setof uuid
language sql
stable
security definer
set search_path = public
as $$
  select household_id from household_members where user_id = auth.uid();
$$;

-- ---------------------------------------------------------------------------
-- Retailers (household_id null = shared seed row visible to everyone)
-- ---------------------------------------------------------------------------
create table if not exists retailers (
  id uuid primary key default gen_random_uuid(),
  household_id uuid references households (id) on delete cascade,
  name text not null,
  country char(2) not null default 'IE',
  is_active boolean not null default true,
  external_id text,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists retailers_shared_name_idx
  on retailers (lower(name)) where household_id is null;
create unique index if not exists retailers_household_name_idx
  on retailers (household_id, lower(name)) where household_id is not null;

-- ---------------------------------------------------------------------------
-- Comparable groups
-- ---------------------------------------------------------------------------
create table if not exists comparable_groups (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  name text not null,
  base_unit base_unit not null,
  -- How many base units make one display unit, e.g. 100 for "per 100 g", 1000 for "per litre", 1 for "per egg"
  display_unit_quantity numeric(12,4) not null default 1 check (display_unit_quantity > 0),
  display_unit_label text not null,                -- "100 g", "litre", "egg", "nappy"
  -- Attribute definitions that matter for this group, e.g.
  -- [{"key":"egg_size","label":"Egg size","values":["medium","large","mixed","unknown"]},
  --  {"key":"free_range","label":"Free range","values":["yes","no","unknown"]}]
  comparison_attributes jsonb not null default '[]'::jsonb,
  -- If true, products with differing attribute values may still be shown side by side (with the difference displayed).
  allow_cross_attribute_comparison boolean not null default true,
  external_id text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists comparable_groups_name_idx on comparable_groups (household_id, lower(name));

-- ---------------------------------------------------------------------------
-- Products (normalised, reusable)
-- ---------------------------------------------------------------------------
create table if not exists products (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  generic_name text not null,             -- "Sterilising Fluid", never "Milton Sterilising Fluid"
  brand text,                             -- "Milton"
  variant text,                           -- "Crunchy", "Citrus"
  category text,                          -- "Household", "Dairy". Not the comparable group.
  comparable_group_id uuid references comparable_groups (id) on delete set null,
  pack_count numeric(12,4) check (pack_count is null or pack_count > 0),          -- 10 (eggs), 4 (cans)
  amount_per_item numeric(14,4) check (amount_per_item is null or amount_per_item > 0), -- 330 (ml per can)
  measurement_unit measurement_unit,      -- unit of amount_per_item
  -- Total quantity in the comparable group's base unit. Maintained by the app from the fields above.
  -- Null means "comparison unavailable". Never guessed.
  total_comparable_quantity numeric(16,4) check (total_comparable_quantity is null or total_comparable_quantity > 0),
  attributes jsonb not null default '{}'::jsonb,   -- {"egg_size":"large","free_range":"yes"}
  barcode text,
  is_recurring boolean not null default true,
  include_in_analysis boolean not null default true,
  exclusion_reason exclusion_reason,
  review_required boolean not null default false,
  review_reasons review_reason[] not null default '{}',
  external_id text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists products_household_idx on products (household_id);
create index if not exists products_group_idx on products (comparable_group_id);
create index if not exists products_external_idx on products (household_id, external_id);
create index if not exists products_name_idx on products using gin (to_tsvector('simple', coalesce(generic_name,'') || ' ' || coalesce(brand,'') || ' ' || coalesce(variant,'')));

-- ---------------------------------------------------------------------------
-- Receipts
-- ---------------------------------------------------------------------------
create table if not exists receipts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  retailer_id uuid references retailers (id) on delete set null,
  store_location text,
  transaction_date date,
  transaction_time time,
  reference_number text,
  image_path text,                          -- path inside the private "receipts" storage bucket
  extraction_status extraction_status not null default 'none',
  raw_extracted_text text,                  -- exact text returned by extraction, never edited
  extraction_payload jsonb,                 -- structured extraction result, never edited
  review_status review_status not null default 'draft',
  review_reasons review_reason[] not null default '{}',
  -- Totals as printed on the receipt. Entered/extracted, then reconciled against lines.
  subtotal_before_discounts numeric(12,2),
  item_discounts_total numeric(12,2) not null default 0,
  basket_discounts_total numeric(12,2) not null default 0,
  deposits_total numeric(12,2) not null default 0,
  total_paid numeric(12,2),
  -- Eligible merchandise subtotal used for voucher allocation. Computed, stored for audit.
  voucher_eligible_subtotal numeric(12,2),
  -- basket_discounts_total / voucher_eligible_subtotal. 0.2000 for €10 off €50.
  voucher_efficiency numeric(8,6),
  reconciliation_difference numeric(12,2),  -- computed total minus total_paid. 0 when balanced.
  approval_note text,                       -- required when approved with a non-zero difference
  external_id text,
  notes text,
  archived_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipts_household_date_idx on receipts (household_id, transaction_date desc);
create index if not exists receipts_duplicate_idx on receipts (household_id, retailer_id, transaction_date, total_paid);
create index if not exists receipts_reference_idx on receipts (household_id, reference_number);

-- ---------------------------------------------------------------------------
-- Receipt lines
-- ---------------------------------------------------------------------------
create table if not exists receipt_lines (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  receipt_id uuid not null references receipts (id) on delete cascade,
  line_number integer not null default 0,
  raw_description text,                       -- exact text from receipt, never changed
  description text,                           -- cleaned/interpreted, editable
  quantity numeric(12,4) not null default 1 check (quantity > 0),
  listed_unit_price numeric(12,4),            -- price per unit as printed, if present
  gross_line_price numeric(12,2),             -- quantity x price before any discount
  item_discount numeric(12,2) not null default 0,
  -- gross_line_price - item_discount. Stored, not generated, so imports can carry the printed value.
  net_line_price numeric(12,2),
  allocated_basket_discount numeric(12,4) not null default 0,   -- exact share of basket vouchers
  effective_line_price numeric(12,4),          -- net_line_price - allocated_basket_discount
  deposit_amount numeric(12,2) not null default 0,
  product_id uuid references products (id) on delete set null,
  is_deposit boolean not null default false,
  voucher_eligible boolean not null default true,
  include_in_analysis boolean not null default true,
  exclusion_reason exclusion_reason,
  is_promotion boolean not null default false,
  extraction_confidence numeric(4,3) check (extraction_confidence is null or (extraction_confidence >= 0 and extraction_confidence <= 1)),
  review_required boolean not null default false,
  review_reasons review_reason[] not null default '{}',
  -- Values as first extracted or imported. Written once, never updated.
  original_values jsonb,
  -- Every manual correction appended here: [{"at":..,"by":..,"field":..,"from":..,"to":..}]
  corrections jsonb not null default '[]'::jsonb,
  external_id text,
  user_notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipt_lines_receipt_idx on receipt_lines (receipt_id, line_number);
create index if not exists receipt_lines_product_idx on receipt_lines (product_id);
create index if not exists receipt_lines_household_idx on receipt_lines (household_id);

-- ---------------------------------------------------------------------------
-- Discounts and vouchers
-- ---------------------------------------------------------------------------
create table if not exists receipt_discounts (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  receipt_id uuid not null references receipts (id) on delete cascade,
  receipt_line_id uuid references receipt_lines (id) on delete set null,   -- set for line-level promotions
  discount_type discount_type not null,
  description text,
  value numeric(12,2) not null check (value >= 0),
  minimum_spend numeric(12,2),
  eligible_subtotal numeric(12,2),
  allocation_method allocation_method not null default 'proportional',
  eligibility_uncertain boolean not null default false,
  notes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index if not exists receipt_discounts_receipt_idx on receipt_discounts (receipt_id);

-- ---------------------------------------------------------------------------
-- Receipt aliases: raw retailer description -> product
-- ---------------------------------------------------------------------------
create table if not exists receipt_aliases (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  retailer_id uuid references retailers (id) on delete cascade,
  raw_description text not null,
  normalised_description text generated always as (upper(regexp_replace(trim(raw_description), '\s+', ' ', 'g'))) stored,
  product_id uuid not null references products (id) on delete cascade,
  confidence numeric(4,3) not null default 1 check (confidence >= 0 and confidence <= 1),
  confirmed_by_user boolean not null default false,
  confirmed_at timestamptz,
  times_used integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index if not exists receipt_aliases_unique_idx
  on receipt_aliases (household_id, coalesce(retailer_id, '00000000-0000-0000-0000-000000000000'::uuid), normalised_description);

-- ---------------------------------------------------------------------------
-- Import batches (for CSV/spreadsheet migration traceability)
-- ---------------------------------------------------------------------------
create table if not exists import_batches (
  id uuid primary key default gen_random_uuid(),
  household_id uuid not null references households (id) on delete cascade,
  source text not null,                   -- "google-sheets-prototype", "csv"
  entity text not null,                   -- "products", "receipts", ...
  file_name text,
  row_count integer not null default 0,
  imported_count integer not null default 0,
  error_count integer not null default 0,
  error_report jsonb not null default '[]'::jsonb,
  created_by uuid references auth.users (id),
  created_at timestamptz not null default now()
);

-- ---------------------------------------------------------------------------
-- Audit log
-- ---------------------------------------------------------------------------
create table if not exists audit_log (
  id bigint generated always as identity primary key,
  household_id uuid,
  table_name text not null,
  record_id uuid not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  changed_by uuid,
  old_values jsonb,
  new_values jsonb,
  created_at timestamptz not null default now()
);
create index if not exists audit_log_record_idx on audit_log (table_name, record_id);
create index if not exists audit_log_household_idx on audit_log (household_id, created_at desc);

-- ---------------------------------------------------------------------------
-- Triggers: updated_at, audit, original_values protection
-- ---------------------------------------------------------------------------
create or replace function set_updated_at()
returns trigger language plpgsql as $$
begin
  new.updated_at = now();
  return new;
end $$;

create or replace function write_audit_log()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
  rid uuid;
begin
  if tg_op = 'DELETE' then
    hid := old.household_id; rid := old.id;
    insert into audit_log (household_id, table_name, record_id, action, changed_by, old_values)
    values (hid, tg_table_name, rid, 'delete', auth.uid(), to_jsonb(old));
    return old;
  elsif tg_op = 'UPDATE' then
    hid := new.household_id; rid := new.id;
    if to_jsonb(old) - 'updated_at' = to_jsonb(new) - 'updated_at' then
      return new;
    end if;
    insert into audit_log (household_id, table_name, record_id, action, changed_by, old_values, new_values)
    values (hid, tg_table_name, rid, 'update', auth.uid(), to_jsonb(old), to_jsonb(new));
    return new;
  else
    hid := new.household_id; rid := new.id;
    insert into audit_log (household_id, table_name, record_id, action, changed_by, new_values)
    values (hid, tg_table_name, rid, 'insert', auth.uid(), to_jsonb(new));
    return new;
  end if;
end $$;

-- Original extracted data is immutable once written.
create or replace function protect_original_values()
returns trigger language plpgsql as $$
begin
  if old.original_values is not null and new.original_values is distinct from old.original_values then
    raise exception 'original_values is immutable once set (receipt_lines.id=%)', old.id;
  end if;
  if tg_table_name = 'receipt_lines' and old.raw_description is not null
     and new.raw_description is distinct from old.raw_description then
    raise exception 'raw_description is immutable once set (receipt_lines.id=%)', old.id;
  end if;
  return new;
end $$;

create or replace function protect_receipt_originals()
returns trigger language plpgsql as $$
begin
  if old.raw_extracted_text is not null and new.raw_extracted_text is distinct from old.raw_extracted_text then
    raise exception 'raw_extracted_text is immutable once set (receipts.id=%)', old.id;
  end if;
  if old.extraction_payload is not null and new.extraction_payload is distinct from old.extraction_payload then
    raise exception 'extraction_payload is immutable once set (receipts.id=%)', old.id;
  end if;
  return new;
end $$;

do $$
declare t text;
begin
  foreach t in array array['households','retailers','comparable_groups','products','receipts','receipt_lines','receipt_discounts','receipt_aliases'] loop
    execute format('drop trigger if exists %I_set_updated_at on %I', t, t);
    execute format('create trigger %I_set_updated_at before update on %I for each row execute function set_updated_at()', t, t);
  end loop;
  foreach t in array array['comparable_groups','products','receipts','receipt_lines','receipt_discounts','receipt_aliases'] loop
    execute format('drop trigger if exists %I_audit on %I', t, t);
    execute format('create trigger %I_audit after insert or update or delete on %I for each row execute function write_audit_log()', t, t);
  end loop;
end $$;

drop trigger if exists receipt_lines_protect_originals on receipt_lines;
create trigger receipt_lines_protect_originals before update on receipt_lines
  for each row execute function protect_original_values();

drop trigger if exists receipts_protect_originals on receipts;
create trigger receipts_protect_originals before update on receipts
  for each row execute function protect_receipt_originals();

-- ---------------------------------------------------------------------------
-- New user bootstrap: create a household, membership and default comparable groups
-- ---------------------------------------------------------------------------
create or replace function seed_household_defaults(p_household_id uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into comparable_groups (household_id, name, base_unit, display_unit_quantity, display_unit_label, comparison_attributes)
  values
    (p_household_id, 'Eggs', 'each', 1, 'egg',
      '[{"key":"egg_size","label":"Egg size","values":["medium","large","jumbo","mixed","unknown"]},
        {"key":"free_range","label":"Free range","values":["yes","no","unknown"]},
        {"key":"organic","label":"Organic","values":["yes","no","unknown"]}]'::jsonb),
    (p_household_id, 'Milk', 'ml', 1000, 'litre',
      '[{"key":"fat","label":"Fat content","values":["whole","low_fat","skimmed","unknown"]}]'::jsonb),
    (p_household_id, 'Peanut Butter', 'g', 100, '100 g',
      '[{"key":"texture","label":"Texture","values":["smooth","crunchy","unknown"]}]'::jsonb),
    (p_household_id, 'Sterilising Fluid', 'ml', 100, '100 ml', '[]'::jsonb),
    (p_household_id, 'Breakfast Cereal', 'g', 100, '100 g', '[]'::jsonb),
    (p_household_id, 'Nappies', 'each', 1, 'nappy',
      '[{"key":"size","label":"Size","values":["1","2","3","4","5","6","unknown"]}]'::jsonb),
    (p_household_id, 'Dishwasher Tablets', 'each', 1, 'tablet', '[]'::jsonb),
    (p_household_id, 'Butter', 'g', 100, '100 g', '[]'::jsonb),
    (p_household_id, 'Chicken Breast', 'g', 100, '100 g', '[]'::jsonb),
    (p_household_id, 'Bananas', 'g', 1000, 'kg', '[]'::jsonb)
  on conflict do nothing;
end $$;

create or replace function handle_new_user()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  hid uuid;
begin
  insert into households (name) values ('Home') returning id into hid;
  insert into household_members (user_id, household_id, email, role)
  values (new.id, hid, new.email, 'owner');
  perform seed_household_defaults(hid);
  return new;
end $$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function handle_new_user();

-- ---------------------------------------------------------------------------
-- Row-level security
-- ---------------------------------------------------------------------------
alter table households enable row level security;
alter table household_members enable row level security;
alter table retailers enable row level security;
alter table comparable_groups enable row level security;
alter table products enable row level security;
alter table receipts enable row level security;
alter table receipt_lines enable row level security;
alter table receipt_discounts enable row level security;
alter table receipt_aliases enable row level security;
alter table import_batches enable row level security;
alter table audit_log enable row level security;

drop policy if exists households_select on households;
create policy households_select on households for select using (id in (select current_household_ids()));
drop policy if exists households_update on households;
create policy households_update on households for update using (id in (select current_household_ids()));

drop policy if exists household_members_select on household_members;
create policy household_members_select on household_members for select using (household_id in (select current_household_ids()));

drop policy if exists retailers_select on retailers;
create policy retailers_select on retailers for select using (household_id is null or household_id in (select current_household_ids()));
drop policy if exists retailers_modify on retailers;
create policy retailers_modify on retailers for all
  using (household_id in (select current_household_ids()))
  with check (household_id in (select current_household_ids()));

do $$
declare t text;
begin
  foreach t in array array['comparable_groups','products','receipts','receipt_lines','receipt_discounts','receipt_aliases','import_batches'] loop
    execute format('drop policy if exists %I_household_all on %I', t, t);
    execute format(
      'create policy %I_household_all on %I for all using (household_id in (select current_household_ids())) with check (household_id in (select current_household_ids()))',
      t, t);
  end loop;
end $$;

drop policy if exists audit_log_select on audit_log;
create policy audit_log_select on audit_log for select using (household_id in (select current_household_ids()));

-- ---------------------------------------------------------------------------
-- Private storage bucket for receipt images. Path convention: <household_id>/<receipt_id>/<file>
-- ---------------------------------------------------------------------------
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('receipts', 'receipts', false, 10485760, array['image/jpeg','image/png','image/heic','image/webp','application/pdf'])
on conflict (id) do update set public = false, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists receipts_bucket_household on storage.objects;
create policy receipts_bucket_household on storage.objects for all
  using (bucket_id = 'receipts' and (storage.foldername(name))[1]::uuid in (select current_household_ids()))
  with check (bucket_id = 'receipts' and (storage.foldername(name))[1]::uuid in (select current_household_ids()));
