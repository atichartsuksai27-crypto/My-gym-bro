-- Realtime sync เว็บ <-> แอป native: รันไฟล์นี้ใน Supabase SQL Editor ครั้งเดียว (วางทั้งไฟล์ แล้วกด Run) — รันซ้ำได้ ไม่ error
-- เพิ่ม 4 ตารางเข้า publication supabase_realtime เพื่อให้ client ฟัง INSERT/UPDATE ได้
-- ความปลอดภัย: Realtime ใช้ RLS เดิม (ผู้ใช้ได้รับเฉพาะแถวที่ตัวเองอ่านได้) และ client ใส่ filter user_id=eq.<ตัวเอง> เพิ่มอีกชั้น
-- ตั้งใจไม่ตั้ง replica identity full: DELETE event ไม่ผ่าน RLS/filter ถ้า full จะส่งทั้งแถวของทุกคนให้ทุก subscriber
do $$
declare t text;
begin
  foreach t in array array['daily_logs','body_weights','programs','onboarding_state'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = t
    ) then
      execute format('alter publication supabase_realtime add table public.%I', t);
    end if;
  end loop;
end $$;
