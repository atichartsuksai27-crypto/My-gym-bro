-- Gymbro Daily — Supabase schema (Phase 1)
-- ------------------------------------------------------------
-- วิธีใช้: สร้างโปรเจกต์ที่ supabase.com แล้ววางไฟล์นี้ทั้งหมดใน
-- SQL Editor ของโปรเจกต์ (Dashboard → SQL Editor → New query) แล้วกด Run
-- รันครั้งเดียวตอนตั้งโปรเจกต์ใหม่ก็พอ
--
-- แนวคิดการออกแบบ: เก็บ payload เป็น jsonb ไม่ normalize ทุก field
-- เพื่อให้ shape ตรงกับ localStorage เดิมของ app.js เกือบทั้งหมด
-- (gymbro_program / gymbro_logs / gymbro_weights / gymbro_onb_proto)
-- ลดความเสี่ยงต้องรื้อ logic การคำนวณที่ผ่านการทดสอบมาแล้วในฝั่ง client
--
-- ทุกตารางผูกกับ auth.users(id) และเปิด Row Level Security (RLS) ไว้
-- ให้แต่ละคนเห็น/แก้ได้เฉพาะแถวของตัวเองเท่านั้น — นี่คือชั้นความปลอดภัยจริง
-- ไม่ใช่การซ่อน anon key (anon key ใส่ในโค้ด frontend ได้ตามปกติ)
-- ------------------------------------------------------------

-- 1) โปรแกรมที่ล็อกไว้ปัจจุบัน (mirror ของ gymbro_program)
-- คนละ 1 แถวต่อผู้ใช้ 1 คน (เหมือนของเดิมที่มีโปรแกรม active ได้ทีละอันเท่านั้น
-- แก้ไขแผน = เขียนทับแถวเดิม ไม่เก็บประวัติเวอร์ชันเก่า ตรงตามพฤติกรรมเดิม)
create table if not exists public.programs (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- 2) บันทึกประจำวัน (mirror ของ gymbro_logs ซึ่งเดิมเป็น dict คีย์ด้วยวันที่)
-- คนละ 1 แถวต่อผู้ใช้ต่อวัน
create table if not exists public.daily_logs (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  payload jsonb not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- 3) น้ำหนักตัวรายวัน (mirror ของ gymbro_weights)
create table if not exists public.body_weights (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  kg numeric not null,
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

-- 4) ความคืบหน้าแบบสอบถาม (mirror ของ gymbro_onb_proto)
-- คนละ 1 แถวต่อผู้ใช้ (resume ได้ถ้าตอบไม่จบ เหมือนของเดิม)
create table if not exists public.onboarding_state (
  user_id uuid primary key references auth.users(id) on delete cascade,
  payload jsonb not null,
  updated_at timestamptz not null default now()
);

-- ------------------------------------------------------------
-- Row Level Security — เปิดทุกตาราง + policy ให้เห็น/แก้ได้เฉพาะของตัวเอง
-- ------------------------------------------------------------
alter table public.programs enable row level security;
alter table public.daily_logs enable row level security;
alter table public.body_weights enable row level security;
alter table public.onboarding_state enable row level security;

create policy "own rows only" on public.programs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.daily_logs
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.body_weights
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

create policy "own rows only" on public.onboarding_state
  for all using (auth.uid() = user_id) with check (auth.uid() = user_id);

-- ------------------------------------------------------------
-- updated_at อัตโนมัติ (กันลืมอัปเดตตอน upsert จาก client)
-- ------------------------------------------------------------
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger trg_programs_updated_at before update on public.programs
  for each row execute function public.set_updated_at();
create trigger trg_daily_logs_updated_at before update on public.daily_logs
  for each row execute function public.set_updated_at();
create trigger trg_body_weights_updated_at before update on public.body_weights
  for each row execute function public.set_updated_at();
create trigger trg_onboarding_state_updated_at before update on public.onboarding_state
  for each row execute function public.set_updated_at();
