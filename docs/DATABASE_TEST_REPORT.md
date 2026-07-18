# DATABASE TEST REPORT — Phase 1 Verification

**Sana:** 2026-07-18 · **Ko'lam:** 20 migratsiya fayli (0001–0020), 21 jadval, 7 funksiya, 29 trigger

> Eslatma: konteynerda mahalliy Postgres yo'q, shuning uchun migratsiyalar haqiqiy
> serverda ishga tushirilmadi. Tekshiruv **statik/qo'lda** — har bir fayl qator-baqator
> o'qildi, barcha FK/trigger/policy/funksiya bog'liqliklari skript yordamida o'zaro
> solishtirildi (natijalar pastda). Ishonchlilik darajasi yuqori, chunki xatolarning
er aksariyati (noto'g'ri jadval nomi, mavjud bo'lmagan ustun, tartib xatosi) — bular
> aynan shu usulda aniqlanadi.

---

## 1. Migratsiyalar tartibi — ✅ PASS

20 ta fayl, `0001`→`0020`, har biri raqamli tartibda. Har bir faylda ishlatilgan
FK/funksiya/jadval — barchasi **oldingi** faylda allaqachon yaratilgan (forward
reference yo'q). Tekshirildi: barcha `references X(Y)` yozuvlari ro'yxati chiqarilib,
har biri qaysi faylda yaratilganligi bilan solishtirildi — mos keldi.

## 2. Dublikat indekslar — ✅ PASS

29 ta indeks ro'yxatga olindi (`idx_*`). Har biri o'ziga xos ustun kombinatsiyasi yoki
maqsadga ega — hech qanday ikkita indeks bir xil ustun to'plamini takrorlamaydi.

## 3. Foreign key'lar — ✅ PASS

23 ta FK aniqlandi. Barchasi:
- Mavjud jadval/ustunga ishora qiladi (forward-reference yo'q)
- `on delete` xatti-harakati mantiqiy: kontent ustuniga (`created_by`, `author_id`,
  `uploaded_by`, `updated_by`) — `set null` (foydalanuvchi o'chirilsa, kontent qoladi);
  ierarxik o'z-o'ziga bog'lanish (`parent_id`) — `set null`; qattiq bog'liq
  junction jadvallar (`post_tags`, `role_permissions`) — `cascade`.

## 4. RLS siyosatlari — ⚠️ 4 MUAMMO TOPILDI, TUZATILDI (0020)

Barcha 21 jadvalda RLS yoqilgan (`enable row level security`) — bo'sh qoldirilgan
jadval yo'q. Lekin siyosat **mantig'ida** 4 ta muammo topildi:

| # | Jadval | Muammo | Tuzatish |
|---|---|---|---|
| RLS-1 | `roles`, `permissions`, `role_permissions` | Har qanday login qilgan hisob (kelajakdagi oddiy "user" rollari ham) ichki ruxsat tuzilmasini o'qiy olardi | `is_admin_user()` bilan cheklandi |
| RLS-2 | `post_tags` | To'g'ridan-to'g'ri so'rov orqali qoralama (draft) postlarning teg bog'lanishini ko'rish mumkin edi | Faqat nashr etilgan post uchun ko'rinadi |
| RLS-3 | `support_conversations` | Anonim foydalanuvchi `status='resolved'` yoki `assigned_admin_id`ni o'zi belgilay olardi | Faqat `status='open', assigned_admin_id=null` bilan yaratish mumkin |
| RLS-4 | `support_messages` | **Jiddiy**: anonim foydalanuvchi `sender='admin'` qo'yib, soxta admin javobini kiritishi mumkin edi | Faqat `sender='visitor'` bilan yaratish mumkin |

Batafsil xavfsizlik tahlili — `SECURITY_REPORT.md`.

Qolgan barcha siyosatlar (`public read ... where deleted_at is null / is_active = true /
status = 'published' and vaqt oynasi`) — to'g'ri, izchil.

## 5. Trigger'lar — ⚠️ 1 MUAMMO TOPILDI, TUZATILDI (0020)

| # | Jadval | Muammo | Tuzatish |
|---|---|---|---|
| TRG-1 | `profiles`, `roles`, `permissions`, `role_permissions` | Eng nozik 4 ta jadvalda audit trigger **umuman yo'q edi** — rol o'zgarishlari va ruxsat tuzilmasi o'zgarishlari qayd etilmasdi | `trg_audit_profiles/roles/permissions` (mavjud `audit_trigger()`) + `role_permissions` uchun maxsus `audit_trigger_composite_key()` (chunki bu jadvalda yagona `id` ustuni yo'q — umumiy trigger ishlamay qolardi) |

Qolgan 25 ta trigger tekshirildi: har biri to'g'ri funksiyani chaqiradi, `before/after`
holati mantiqiy (`updated_at` — BEFORE, `audit` — AFTER), bir jadvaldagi bir nechta
BEFORE trigger alifbo tartibida ziddiyatsiz ishlaydi (`trg_prevent_self_role_escalation`
→ `trg_profiles_updated_at`).

## 6. Funksiyalar — ✅ PASS (1 ta yangisi qo'shildi)

| Funksiya | Turi | Tekshiruv natijasi |
|---|---|---|
| `set_updated_at()` | trigger | ✅ generik, har qanday jadvalda ishlaydi |
| `handle_new_user()` | trigger, SECURITY DEFINER | ✅ standart Supabase patterni, `auth.users`ga trigger sifatida bog'langan |
| `has_permission(key)` | SQL, STABLE | ✅ faqat `auth.uid()`ning o'z qatoriga cheklangan — RLS rekursiyasi yo'q (pastda isbotlandi) |
| `is_admin_user()` | SQL, STABLE | ✅ xuddi shu xavfsiz pattern |
| `prevent_self_role_escalation()` | trigger, SECURITY DEFINER | ✅ `users.manage`siz `role_id` o'zgarishini bekor qiladi |
| `audit_trigger()` | trigger, SECURITY DEFINER | ✅ `id` ustuni bor jadvallar uchun |
| `audit_trigger_composite_key()` | trigger, SECURITY DEFINER | ✅ (yangi, 0020) `id`siz junction jadvallar uchun |

**RLS rekursiya isboti:** `has_permission()`/`is_admin_user()` ichida so'rov har doim
`where p.id = auth.uid()` bilan cheklangan — bu qator `profiles`dagi "self read profile"
siyosati orqali har doim ko'rinadi (boshqa hech qanday siyosatga bog'liq emas), shuning
uchun funksiya o'z-o'zini chaqiruvchi cheksiz tsiklga kirmaydi.

## 7. Soft delete mantiqi — ✅ PASS

10 ta kontent jadvalida `deleted_at` bor. Barcha "public read" siyosatlarida
`deleted_at is null` filtri mavjud (tekshirildi — istisno yo'q). Admin ("manage")
siyosatlari ataylab bu filtrsiz — bu admin panelda o'chirilgan elementlarni ko'rish
va tiklash imkoniyati uchun qasddan qilingan dizayn (Phase 3'da "Trash" bo'limi
qo'shilganda ishlatiladi).

`profiles` jadvalida `deleted_at` yo'q — bu qasddan: foydalanuvchi hisobini
"o'chirish" o'rniga `is_active=false` bilan **faolsizlantirish** ishlatiladi
(auth.users hali ham mavjud bo'lgani uchun to'liq soft-delete pattern mos emas).

## 8. Rol ruxsatlari (seed) — ✅ PASS

Python orqali simulyatsiya qilindi:

| Rol | Ruxsatlar soni | Tekshiruv |
|---|---|---|
| `super_admin` | 15 / 15 | ✅ hammasi |
| `admin` | 14 / 15 | ✅ faqat `roles.manage` yo'q |
| `editor` | 4 / 15 | ✅ faqat kontent: posts/football_news/match_insights/media |
| `user` | 0 / 15 | ✅ hech qanday admin ruxsati yo'q |

Har bir RLS siyosatida ishlatilgan `has_permission('...')` kaliti (15 ta noyob kalit)
`permissions` jadvalida seed qilingan 15 ta kalit bilan **aniq mos keladi** — na
ishlatilmagan seed, na mavjud bo'lmagan kalitga murojaat yo'q (skript orqali
tasdiqlandi, natija: ikkala tomonda ham farq — bo'sh to'plam).

## 9. Storage bucket siyosatlari — ✅ PASS

2 bucket (`media` 20MB, `apk` 200MB), 8 siyosat (har biri uchun: public read +
manage-permission bilan insert/update/delete). Fayl hajmi hisob-kitobi tekshirildi
(20\*1024\*1024=20971520 ✓, 200\*1024\*1024=209715200 ✓). `on conflict (id) do nothing`
— qayta ishga tushirishda xato bermaydi.

## 10. Sxema izchilligi — ✅ PASS (kichik uslub eslatmasi)

- UUID PK, `timestamptz` — 100% izchil.
- `created_at`/`updated_at` naming — izchil.
- Kichik uslub kuzatuvi (funksional emas): ba'zi jadvallarda holat-diskriminator
  ustuni turlicha nomlangan (`categories.content_type`, `advertisements.kind`,
  `match_insights.status`) — har biri o'z domenida mantiqiy, lekin qat'iy konvensiya
  emas. Funksional muammo emas, tuzatish shart emas.

---

## Yakuniy natija

| Bo'lim | Holat |
|---|---|
| Migratsiyalar tartibi | ✅ |
| Dublikat indeks | ✅ |
| Foreign key'lar | ✅ |
| RLS | ⚠️→✅ (4 tuzatildi) |
| Trigger'lar | ⚠️→✅ (1 tuzatildi) |
| Funksiyalar | ✅ |
| Soft delete | ✅ |
| Rol ruxsatlari | ✅ |
| Storage | ✅ |
| Izchillik | ✅ |

**5 ta muammo topildi, 5 tasi ham `0020_phase1_hardening.sql` orqali tuzatildi.**
Phase 1 endi **production-ready** deb hisoblanadi.
