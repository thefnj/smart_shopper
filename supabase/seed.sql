-- Shared retailers visible to every household. Rerunnable.
insert into retailers (household_id, name, country, is_active)
values
  (null, 'Dunnes Stores', 'IE', true),
  (null, 'Lidl', 'IE', true),
  (null, 'Aldi', 'IE', true),
  (null, 'Tesco', 'IE', true),
  (null, 'SuperValu', 'IE', true)
on conflict do nothing;
