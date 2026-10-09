-- ขั้นที่ 1 CRM: รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว (วางทั้งไฟล์ แล้วกด Run) — รันซ้ำได้ ไม่ error
-- ------------------------------------------------------------
-- 7) CRM profile (ขั้นที่ 1) — ข้อมูลติดต่อ/การใช้งานระดับบัญชีเท่านั้น
-- ตั้งใจ "ไม่เก็บ" ข้อมูลสุขภาพ (น้ำหนัก บันทึกฝึก ไขมัน อาการบาดเจ็บ) ในตารางนี้ — เป็นข้อมูลอ่อนไหวตาม PDPA
-- ต้องมี consent แยกต่างหากก่อนจะเอาไปใช้ทำการตลาด (ดูขั้นที่ 2: marketing_consent)
-- คนละ 1 แถวต่อผู้ใช้ ผูก on delete cascade เหมือนตารางอื่น และอยู่ใน USER_TABLES ของ
-- functions/api/delete-account.js แล้ว (ลบบัญชี = แถวนี้หายด้วย)
-- ------------------------------------------------------------
create table if not exists public.crm_profiles (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now(),
  last_active_at timestamptz not null default now(),
  platform text,
  app_version text,
  marketing_consent boolean not null default false,
  consent_at timestamptz,
  consent_version text,
  updated_at timestamptz not null default now()
);
alter table public.crm_profiles enable row level security;

-- ผู้ใช้อ่านแถวตัวเองได้ (ไว้โชว์สถานะ consent ในหน้าตั้งค่า) แต่ "ไม่มี" policy insert/update/delete
-- การเขียนทำผ่านฟังก์ชันด้านล่างเท่านั้น กันผู้ใช้แก้ค่าเอง (เช่น ปลอมวันที่ consent)
drop policy if exists "read own" on public.crm_profiles;
create policy "read own" on public.crm_profiles
  for select using (auth.uid() = user_id);

drop trigger if exists trg_crm_profiles_updated_at on public.crm_profiles;
create trigger trg_crm_profiles_updated_at before update on public.crm_profiles
  for each row execute function public.set_updated_at();

-- เรียกตอนเปิดแอป: สร้างแถวถ้ายังไม่มี และอัปเดตเวลาใช้งานล่าสุด
-- ใช้ auth.uid() จาก JWT เสมอ ไม่รับ user_id เป็นพารามิเตอร์ (เหตุผลเดียวกับ increment_coach_usage)
create or replace function public.touch_crm_profile(p_platform text default null, p_app_version text default null)
returns void
language sql
security definer
set search_path = public
as $$
  insert into public.crm_profiles (user_id, last_active_at, platform, app_version)
  values (auth.uid(), now(), left(p_platform, 20), left(p_app_version, 20))
  on conflict (user_id) do update
    set last_active_at = now(),
        platform = coalesce(left(p_platform, 20), public.crm_profiles.platform),
        app_version = coalesce(left(p_app_version, 20), public.crm_profiles.app_version);
$$;

grant execute on function public.touch_crm_profile(text, text) to authenticated;
