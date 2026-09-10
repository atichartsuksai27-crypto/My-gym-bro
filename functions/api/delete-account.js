/* ============================================================
   Gymbro Daily — Delete account API (Cloudflare Pages Function)
   ------------------------------------------------------------
   POST /api/delete-account  { reason: string }
   Header: Authorization: Bearer <Supabase access token ของผู้ใช้>

   ต้องใช้ Supabase Service Role key (env.SUPABASE_SERVICE_ROLE_KEY) เพราะลบแถวใน
   auth.users ได้เฉพาะผ่าน Admin API เท่านั้น — anon key (ตัวเดียวกับที่ฝังในโค้ด
   frontend ได้ตามปกติ) ทำแบบนี้ไม่ได้ไม่ว่ากรณีใด ห้ามเด็ดขาดที่จะฝัง service role
   key นี้ในโค้ดฝั่ง browser (สิทธิ์เทียบเท่า admin เต็มระบบ ข้าม RLS ได้หมดทุกตาราง)
   ต้องตั้งเป็น environment variable/secret ในฝั่ง Cloudflare Pages เท่านั้น
   (Cloudflare dashboard → โปรเจกต์นี้ → Settings → Environment variables →
   เพิ่ม SUPABASE_SERVICE_ROLE_KEY แบบ "Encrypt" — หาค่าได้จาก Supabase dashboard →
   Project Settings → API → service_role secret)

   ลบ auth user สำเร็จ = ทุกตาราง (programs/daily_logs/body_weights/
   onboarding_state/coach_usage) หายไปพร้อมกันอัตโนมัติทันทีผ่าน "on delete cascade"
   ที่ตั้งไว้ใน supabase/schema.sql อยู่แล้ว — endpoint นี้จึงไม่ต้องลบทีละตารางเอง

   เหตุผลที่ลบบัญชี ("reason") ถูกบันทึกไว้ที่ตาราง account_deletion_feedback ก่อน
   ลบบัญชีเสมอ — ตารางนั้นไม่ผูกกับ auth.users เลย (เก็บแค่เหตุผลล้วนๆ ไม่ระบุตัวตน)
   เพื่อให้ยังใช้วิเคราะห์ churn ได้แม้บัญชีจะถูกลบไปแล้วก็ตาม
   ============================================================ */

const SUPABASE_URL = 'https://uttlvgfhltwwdkowzckd.supabase.co';
// anon key ไม่ใช่ความลับ — ออกแบบให้เปิดเผยได้ (เหมือนใน supabase-client.js ทุกประการ)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dGx2Z2ZobHR3d2Rrb3d6Y2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NjMsImV4cCI6MjEwMTUxNzQ2M30.HVY17kySYyxvHkbMefBA7Ktj2v2p-fbF8j9Uwdv1R5M';

/* ต้องตรงกับ ACCOUNT_DELETE_REASONS ใน app.js เป๊ะทุกตัวอักษร — ตรวจซ้ำฝั่ง server
   เองด้วย ไม่เชื่อ client เฉยๆ (ป้องกันข้อความมั่ว/ยาวเกินไปหลุดเข้าตารางสถิติ) */
const ALLOWED_REASONS = [
  'ไม่ได้ใช้งานแอปแล้ว',
  'เจอแอป/บริการอื่นที่ดีกว่า',
  'ฟีเจอร์ไม่ตรงกับที่ต้องการ',
  'ใช้งานยาก/ซับซ้อนเกินไป',
  'กังวลเรื่องความเป็นส่วนตัวของข้อมูล',
  'เจอปัญหา/บั๊กทางเทคนิคบ่อย',
  'อื่นๆ'
];

function jsonResponse(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}
function jsonError(message, status){ return jsonResponse({error: message}, status); }

/* ยืนยันตัวตนผู้ใช้จาก access token ที่แนบมา — เรียก Supabase Auth ตรงๆ (เหมือน
   coach.js) ไม่ decode JWT เอง ให้ Supabase ตัดสินว่า token ยังใช้ได้จริงหรือไม่ */
async function verifyUser(token){
  if(!token) return null;
  var res;
  try{
    res = await fetch(SUPABASE_URL + '/auth/v1/user', {
      headers: {'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON_KEY}
    });
  }catch(e){ return null; }
  if(!res.ok) return null;
  var user = await res.json().catch(function(){ return null; });
  return (user && user.id) ? user : null;
}

export async function onRequestPost(context){
  var request = context.request;
  var env = context.env;

  if(!env.SUPABASE_SERVICE_ROLE_KEY){
    return jsonError('ระบบลบบัญชียังไม่ได้ตั้งค่า (ไม่มี SUPABASE_SERVICE_ROLE_KEY) ติดต่อผู้ดูแลระบบ', 500);
  }

  var body;
  try{ body = await request.json(); }
  catch(e){ return jsonError('รูปแบบคำขอไม่ถูกต้อง', 400); }

  var reason = String((body && body.reason) || '').trim();
  if(ALLOWED_REASONS.indexOf(reason) === -1){
    return jsonError('กรุณาเลือกเหตุผลจากตัวเลือกที่กำหนด', 400);
  }

  var authHeader = request.headers.get('Authorization') || '';
  var token = authHeader.replace(/^Bearer\s+/i, '').trim();
  var user = await verifyUser(token);
  if(!user) return jsonError('กรุณาเข้าสู่ระบบก่อนลบบัญชี', 401);

  // บันทึกเหตุผลไว้ก่อนลบบัญชีเสมอ (ไม่ผูกกับผู้ใช้คนนี้เลย ดูคอมเมนต์บนไฟล์) —
  // ล้มเหลวไม่ throw ต่อ เพราะการลบบัญชีสำคัญกว่าการเก็บสถิติ ไม่ควรบล็อกผู้ใช้เพราะ
  // insert สถิติผิดพลาด
  try{
    await fetch(SUPABASE_URL + '/rest/v1/account_deletion_feedback', {
      method: 'POST',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY,
        'content-type': 'application/json'
      },
      body: JSON.stringify({reason: reason})
    });
  }catch(e){ /* เงียบไว้ ไม่บล็อกการลบบัญชีต่อ */ }

  var delRes;
  try{
    delRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + user.id, {
      method: 'DELETE',
      headers: {
        'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
        'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
      }
    });
  }catch(e){ return jsonError('เชื่อมต่อระบบลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง', 502); }

  if(!delRes.ok){
    var errText = await delRes.text().catch(function(){ return ''; });
    console.error('Supabase admin delete user failed ' + delRes.status + ': ' + errText); // `wrangler pages deployment tail`
    return jsonError('ลบบัญชีไม่สำเร็จ (' + delRes.status + ')', 502);
  }

  return jsonResponse({ok: true});
}

/* method อื่นที่ไม่ใช่ POST — ตอบ 405 ตรงๆ แทนที่จะปล่อยให้ Pages ตอบ 404 ทั่วไป */
export async function onRequestGet(){ return jsonError('ใช้ POST เท่านั้น', 405); }
