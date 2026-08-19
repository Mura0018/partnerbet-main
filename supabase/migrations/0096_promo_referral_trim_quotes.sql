-- =====================================================================
--  0096 — promo_referral.description: ortiqcha qo'shtirnoqlarni tozalash
--  Admin matn boshi/oxiriga "..." kiritib qo'ygan edi. Yozish endi buni
--  tozalaydi (referral API), lekin BAZADAGI mavjud qiymatni ham tuzatamiz.
--  Idempotent — toza qiymatda hech narsa o'zgarmaydi.
-- =====================================================================

update site_settings
set value = jsonb_set(
  value,
  '{description}',
  to_jsonb( btrim( btrim(value->>'description'), '"''' ) )
)
where key = 'promo_referral'
  and value ? 'description'
  and value->>'description' is not null;
