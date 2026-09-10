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

   ขั้นตอนการลบ (ทำครบทั้ง 3 ขั้น ห้ามข้าม):
     1) ลบแถวของ user คนนี้ "ทีละตาราง" ตรงๆ ด้วยสิทธิ์ service_role (USER_TABLES)
     2) ลบแถวใน auth.users ผ่าน Admin API
     3) ตรวจซ้ำทุกตาราง + ตรวจว่า user หายจริง ถ้ายังเหลืออะไรอยู่ = ตอบ error ทันที
        ห้ามตอบ ok:true เด็ดขาด (ไม่งั้นแอปจะบอกผู้ใช้ว่า "ลบเรียบร้อย" ทั้งที่ยังอยู่)

   หมายเหตุ: schema.sql ผูก "on delete cascade" ไว้ทุกตารางอยู่แล้ว ขั้นที่ 1 จึงซ้ำซ้อน
   ในทางทฤษฎี — แต่จงใจทำเองอยู่ดี เพราะ cascade จะทำงานก็ต่อเมื่อ FK ถูกตั้งไว้จริงใน
   ฐานข้อมูล ณ ตอนนั้น (ถ้าตารางไหนถูกสร้างใหม่/แก้ FK หลุดไปโดยไม่รู้ตัว ข้อมูลจะค้าง
   เงียบๆ) ขั้นที่ 3 คือด่านสุดท้ายที่ทำให้ "กดลบ = ลบจริง" ตรวจสอบได้เสมอ ไม่ใช่ความเชื่อ

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

/* ทุกตารางที่เก็บข้อมูลผูกกับผู้ใช้ (คีย์ด้วยคอลัมน์ user_id ทั้งหมด) — ถ้าเพิ่มตารางใหม่
   ที่ผูกกับ auth.users ในอนาคต ต้องเพิ่มชื่อตารางตรงนี้ด้วยเสมอ ไม่งั้นข้อมูลจะค้างหลังลบ
   บัญชี (account_deletion_feedback จงใจไม่อยู่ในลิสต์ — ไม่ผูกกับผู้ใช้ ดูคอมเมนต์บนไฟล์) */
const USER_TABLES = ['programs', 'daily_logs', 'body_weights', 'onboarding_state', 'coach_usage'];

function jsonResponse(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}
function jsonError(message, status){ return jsonResponse({error: message}, status); }

/* ---------- CORS ----------
   แอป native (Capacitor) เสิร์ฟหน้าเว็บจากในเครื่องด้วย origin "https://localhost"
   (Android) / "capacitor://localhost" (iOS) การเรียก API นี้จึงเป็น cross-origin เสมอ
   และมี header Authorization → เบราว์เซอร์ยิง preflight OPTIONS มาก่อนทุกครั้ง ถ้าไม่
   ตอบ CORS ให้ 2 origin นี้ คำขอลบบัญชีจากแอปจะถูกบล็อกตั้งแต่ยังไม่ถึงโค้ดข้างล่างเลย
   จำกัดเฉพาะ 2 ค่านี้เท่านั้น ไม่ใช้ "*" เพราะ endpoint นี้รับ token ผู้ใช้และลบข้อมูลถาวร
   (เว็บปกติเรียกแบบ same-origin อยู่แล้ว ไม่ต้องพึ่ง CORS) */
const ALLOWED_ORIGINS = ['https://localhost', 'capacitor://localhost'];

function withCors(res, request){
  var origin = request.headers.get('Origin') || '';
  if(ALLOWED_ORIGINS.indexOf(origin) === -1) return res;
  var headers = new Headers(res.headers);
  headers.set('Access-Control-Allow-Origin', origin);
  headers.set('Access-Control-Allow-Methods', 'POST, OPTIONS');
  headers.set('Access-Control-Allow-Headers', 'authorization, content-type');
  headers.set('Access-Control-Max-Age', '86400');
  headers.set('Vary', 'Origin');
  return new Response(res.body, {status: res.status, headers: headers});
}

export async function onRequestOptions(context){
  return withCors(new Response(null, {status: 204}), context.request);
}

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
  return withCors(await handleDelete(context), context.request);
}

async function handleDelete(context){
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

  var admin = {
    'apikey': env.SUPABASE_SERVICE_ROLE_KEY,
    'Authorization': 'Bearer ' + env.SUPABASE_SERVICE_ROLE_KEY
  };
  var filter = '?user_id=eq.' + encodeURIComponent(user.id);

  // ---- ขั้นที่ 1: ลบแถวของผู้ใช้คนนี้ทุกตารางตรงๆ ด้วยสิทธิ์ service_role (ข้าม RLS) ----
  // Prefer: return=representation เพื่อให้ Supabase คืนแถวที่ลบไปจริงกลับมา นับจำนวนได้
  // ล้มเหลวตารางไหน = หยุดทันที ไม่ลบ auth user ต่อ (ถ้าลบ user ไปแล้วแต่ข้อมูลค้าง จะไม่มี
  // ทางลบข้อมูลที่ค้างนั้นได้อีกเลยเพราะไม่เหลือ user ให้อ้างอิง — กลายเป็นขยะถาวรในฐานข้อมูล)
  var deleted = {};
  for(const table of USER_TABLES){
    var res;
    try{
      res = await fetch(SUPABASE_URL + '/rest/v1/' + table + filter, {
        method: 'DELETE',
        headers: Object.assign({'Prefer': 'return=representation'}, admin)
      });
    }catch(e){ return jsonError('เชื่อมต่อฐานข้อมูลไม่สำเร็จตอนลบตาราง ' + table + ' ลองใหม่อีกครั้ง', 502); }
    if(!res.ok){
      var tErr = await res.text().catch(function(){ return ''; });
      console.error('delete ' + table + ' failed ' + res.status + ': ' + tErr); // `wrangler pages deployment tail`
      return jsonError('ลบข้อมูลในตาราง ' + table + ' ไม่สำเร็จ (' + res.status + ') ยังไม่ได้ลบบัญชี ลองใหม่อีกครั้ง', 502);
    }
    var rows = await res.json().catch(function(){ return []; });
    deleted[table] = Array.isArray(rows) ? rows.length : 0;
  }

  // ---- ขั้นที่ 2: ลบแถวใน auth.users (ต้องผ่าน Admin API เท่านั้น) ----
  var delRes;
  try{
    delRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + user.id, {
      method: 'DELETE',
      headers: admin
    });
  }catch(e){ return jsonError('เชื่อมต่อระบบลบบัญชีไม่สำเร็จ ลองใหม่อีกครั้ง', 502); }

  if(!delRes.ok){
    var errText = await delRes.text().catch(function(){ return ''; });
    console.error('Supabase admin delete user failed ' + delRes.status + ': ' + errText);
    return jsonError('ลบบัญชีไม่สำเร็จ (' + delRes.status + ')', 502);
  }

  // ---- ขั้นที่ 3: ตรวจซ้ำว่าไม่เหลืออะไรจริงๆ ----
  // อ่านด้วย service_role (เห็นทุกแถวข้าม RLS) ถ้ายังเจอแถวไหนค้าง = ตอบ error ไม่ตอบ ok
  var leftover = [];
  for(const table of USER_TABLES){
    var chk;
    try{
      chk = await fetch(SUPABASE_URL + '/rest/v1/' + table + filter + '&select=user_id&limit=1', {headers: admin});
    }catch(e){ continue; } // ตรวจไม่ได้ ≠ ลบไม่สำเร็จ — ขั้นที่ 1 ตอบ 2xx ไปแล้ว ไม่ต้องตกใจ
    if(!chk.ok) continue;
    var remain = await chk.json().catch(function(){ return []; });
    if(Array.isArray(remain) && remain.length > 0) leftover.push(table);
  }

  var userGone = true;
  try{
    var uRes = await fetch(SUPABASE_URL + '/auth/v1/admin/users/' + user.id, {headers: admin});
    userGone = (uRes.status === 404); // 200 = ยังอยู่ (เช่นโดน soft delete แทนที่จะลบจริง)
  }catch(e){ /* ตรวจไม่ได้ ให้ผ่าน — Admin API ตอบ 2xx ตอนลบไปแล้ว */ }

  if(leftover.length > 0 || !userGone){
    console.error('post-delete verification failed: leftover=' + leftover.join(',') + ' userGone=' + userGone);
    return jsonError('ลบบัญชีไม่สมบูรณ์ ยังมีข้อมูลค้างอยู่ในระบบ (' +
      (leftover.length ? leftover.join(', ') : 'บัญชีผู้ใช้') + ') กรุณาลองใหม่หรือติดต่อผู้ดูแลระบบ', 500);
  }

  return jsonResponse({ok: true, deleted: deleted});
}

/* method อื่นที่ไม่ใช่ POST — ตอบ 405 ตรงๆ แทนที่จะปล่อยให้ Pages ตอบ 404 ทั่วไป */
export async function onRequestGet(){ return jsonError('ใช้ POST เท่านั้น', 405); }
