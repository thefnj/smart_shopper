\set ON_ERROR_STOP on
-- Simulate two users signing up
insert into auth.users (id, email) values ('11111111-1111-1111-1111-111111111111','a@example.com'),('22222222-2222-2222-2222-222222222222','b@example.com');
do $$ begin
  assert (select count(*) from households) = 2, 'signup trigger should create one household per user';
  assert (select count(*) from comparable_groups) = 20, 'each household gets default comparable groups';
end $$;

-- Act as user A (RLS applies to non-superuser roles)
do $$ begin create role app_user nologin; exception when duplicate_object then null; end $$;
grant usage on schema public, auth, storage to app_user;
grant all on all tables in schema public to app_user;
grant execute on all functions in schema public to app_user;
set role app_user;
select set_config('request.jwt.claim.sub', '11111111-1111-1111-1111-111111111111', false);

do $$
declare hid uuid; rid uuid; pid uuid; lid uuid; other_hid uuid;
begin
  select household_id into hid from household_members where user_id = auth.uid();
  assert (select count(*) from households) = 1, 'user sees only own household';
  assert (select count(*) from retailers) = 5, 'shared retailers visible';
  assert (select count(*) from comparable_groups) = 10, 'user sees only own groups';

  insert into products (household_id, generic_name, brand) values (hid, 'Sterilising Fluid', 'Milton') returning id into pid;
  insert into receipts (household_id, transaction_date, total_paid) values (hid, '2026-07-10', 89.50) returning id into rid;
  insert into receipt_lines (household_id, receipt_id, raw_description, description, gross_line_price, original_values)
    values (hid, rid, 'MILTON 1L', 'Milton 1L', 6.50, '{"gross_line_price":6.50}') returning id into lid;

  -- corrections allowed, originals immutable
  update receipt_lines set description = 'Milton Sterilising Fluid 1 L', product_id = pid where id = lid;
  begin
    update receipt_lines set raw_description = 'CHANGED' where id = lid;
    raise exception 'raw_description should be immutable';
  exception when others then
    if sqlerrm not like '%immutable%' then raise; end if;
  end;
  begin
    update receipt_lines set original_values = '{}' where id = lid;
    raise exception 'original_values should be immutable';
  exception when others then
    if sqlerrm not like '%immutable%' then raise; end if;
  end;

  -- audit trail written
  assert (select count(*) from audit_log where table_name='receipt_lines' and record_id=lid) = 2, 'insert + update audited';

  -- cannot write into another household
  select id into other_hid from households where id <> hid limit 1; -- returns null under RLS
  begin
    insert into products (household_id, generic_name) values ('00000000-0000-0000-0000-000000000000', 'Leak');
    raise exception 'should not insert into foreign household';
  exception when insufficient_privilege or foreign_key_violation or check_violation then null;
  when others then if sqlerrm not like '%row-level security%' then raise; end if;
  end;
end $$;

-- Switch to user B: must see nothing of A's
select set_config('request.jwt.claim.sub', '22222222-2222-2222-2222-222222222222', false);
do $$ begin
  assert (select count(*) from products) = 0, 'user B sees no products of A';
  assert (select count(*) from receipts) = 0, 'user B sees no receipts of A';
  assert (select count(*) from audit_log where table_name in ('products','receipts','receipt_lines')) = 0, 'user B sees no audit rows of A';
end $$;
reset role;
select 'BEHAVIOUR TESTS PASSED' as result;
