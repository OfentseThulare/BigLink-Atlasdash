insert into public.companies (
  id,
  slug,
  legal_name,
  display_name,
  registration_number,
  vat_number
)
values
  (
    '00000000-0000-4000-8000-000000000001',
    'atlas',
    'Atlas Consulting Group (Pty) Ltd',
    'Atlas Consulting',
    null,
    null
  ),
  (
    '00000000-0000-4000-8000-000000000002',
    'big_link',
    'Big Link',
    'Big Link',
    null,
    null
  )
on conflict (id) do update
set slug = excluded.slug,
    legal_name = excluded.legal_name,
    display_name = excluded.display_name,
    registration_number = excluded.registration_number,
    vat_number = excluded.vat_number;
