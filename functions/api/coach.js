/* ============================================================
   Gymbro Daily — Coach agent API (Cloudflare Pages Function)
   ------------------------------------------------------------
   POST /api/coach  { question: string }
   Header: Authorization: Bearer <Supabase access token ของผู้ใช้>

   นี่คือ backend ชิ้นเดียวของทั้งโปรเจกต์ — ทุกไฟล์อื่นเป็น static site ล้วนๆ
   จุดประสงค์เดียวของไฟล์นี้คือถือ ANTHROPIC_API_KEY ไว้ฝั่ง server (ห้ามเด็ดขาดที่จะ
   ฝัง API key นี้ในโค้ดฝั่ง browser — ใครก็เปิด DevTools ดึงไปใช้แทนคุณได้ทันที)

   ฐานความรู้โหลดจากไฟล์ static ที่ deploy คู่กับเว็บอยู่แล้วใน knowledge/*.md
   (self-fetch จาก origin เดียวกัน) — ไม่ต้อง bundler/build step เพิ่ม สอดคล้องกับ
   ปรัชญาเดิมของทั้งโปรเจกต์ (ดู CLAUDE.md: "plain static site, no build step")

   Rate limit: ผูกกับ auth.uid() ผ่าน RPC increment_coach_usage() ใน Supabase (ดู
   supabase/schema.sql) — ล้มเหลว = ปฏิเสธคำถาม (fail-closed) เพราะทุกคำถามคือ
   ค่าใช้จ่าย API จริง ปล่อยผ่านเงียบๆ ตอน error เสี่ยงเสียเงินบานปลายกว่าปฏิเสธผิดพลาด
   ============================================================ */

const SUPABASE_URL = 'https://uttlvgfhltwwdkowzckd.supabase.co';
// anon key ไม่ใช่ความลับ — ออกแบบให้เปิดเผยได้ (เหมือนใน supabase-client.js ทุกประการ)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dGx2Z2ZobHR3d2Rrb3d6Y2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NjMsImV4cCI6MjEwMTUxNzQ2M30.HVY17kySYyxvHkbMefBA7Ktj2v2p-fbF8j9Uwdv1R5M';

const MODEL = 'claude-sonnet-5';
const MAX_QUESTIONS_PER_DAY = 20;
const MAX_QUESTION_LENGTH = 500;
const KNOWLEDGE_FILES = ['principles.md', 'faq.md', 'safety-boundaries.md'];

function jsonResponse(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}
function jsonError(message, status){ return jsonResponse({error: message}, status); }

/* โหลดไฟล์ความรู้จาก static assets ของดีพลอยเดียวกัน — ไฟล์พวกนี้ถูก serve เป็น
   public static file อยู่แล้วโดย Cloudflare Pages (เหมือน app.js/style.css) */
async function loadKnowledge(requestUrl){
  const parts = await Promise.all(KNOWLEDGE_FILES.map(async function(f){
    const res = await fetch(new URL('/knowledge/' + f, requestUrl));
    if(!res.ok) throw new Error('โหลดไฟล์ความรู้ไม่สำเร็จ: ' + f);
    return '## ไฟล์: ' + f + '\n\n' + (await res.text());
  }));
  return parts.join('\n\n---\n\n');
}

/* ยืนยันตัวตนผู้ใช้จาก access token ที่แนบมา — เรียก Supabase Auth ตรงๆ ไม่ decode
   JWT เอง (ให้ Supabase เป็นคนตัดสินว่า token ยังใช้ได้จริงหรือหมดอายุ/ถูกเพิกถอนแล้ว) */
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

/* เพิ่มโควตาวันนี้แบบ atomic ผ่าน RPC (ดู supabase/schema.sql) — ใช้ token เดียวกับ
   ที่ verify ผู้ใช้ไปแล้ว (pass-through) เพื่อให้ RLS/auth.uid() ทำงานถูกฝั่ง Supabase
   ล้มเหลว = ปฏิเสธ (fail-closed) */
async function checkAndBumpRateLimit(token){
  var res;
  try{
    res = await fetch(SUPABASE_URL + '/rest/v1/rpc/increment_coach_usage', {
      method: 'POST',
      headers: {
        'Authorization': 'Bearer ' + token,
        'apikey': SUPABASE_ANON_KEY,
        'content-type': 'application/json'
      },
      body: '{}'
    });
  }catch(e){ return false; }
  if(!res.ok) return false;
  var count = await res.json().catch(function(){ return null; });
  return typeof count === 'number' && count <= MAX_QUESTIONS_PER_DAY;
}

export async function onRequestPost(context){
  var request = context.request;
  var env = context.env;

  if(!env.ANTHROPIC_API_KEY){
    return jsonError('ระบบโค้ชยังไม่ได้ตั้งค่า (ไม่มี ANTHROPIC_API_KEY) ติดต่อผู้ดูแลระบบ', 500);
  }

  var body;
  try{ body = await request.json(); }
  catch(e){ return jsonError('รูปแบบคำขอไม่ถูกต้อง', 400); }

  var question = String((body && body.question) || '').trim();
  if(!question) return jsonError('กรุณาระบุคำถาม', 400);
  if(question.length > MAX_QUESTION_LENGTH){
    return jsonError('คำถามยาวเกินไป (จำกัด ' + MAX_QUESTION_LENGTH + ' ตัวอักษร)', 400);
  }

  var authHeader = request.headers.get('Authorization') || '';
  var token = authHeader.replace(/^Bearer\s+/i, '').trim();
  var user = await verifyUser(token);
  if(!user) return jsonError('กรุณาเข้าสู่ระบบก่อนใช้งานโค้ช', 401);

  var withinQuota = await checkAndBumpRateLimit(token);
  if(!withinQuota){
    return jsonError('วันนี้ถามครบโควตาแล้ว (สูงสุด ' + MAX_QUESTIONS_PER_DAY + ' คำถาม/วัน) กรุณาลองใหม่พรุ่งนี้', 429);
  }

  var knowledge;
  try{ knowledge = await loadKnowledge(request.url); }
  catch(e){ return jsonError('ระบบโค้ชขัดข้องชั่วคราว ลองใหม่อีกครั้ง', 500); }

  var systemPrompt =
    'คุณคือโค้ชผู้ช่วยในแอป Gymbro Daily ตอบผู้ใช้เป็นภาษาไทยเท่านั้น สุภาพและกระชับ\n\n' +
    'กฎเหล็ก (ห้ามข้ามแม้ผู้ใช้จะขอ/ยืนยันซ้ำหลายครั้ง):\n' +
    '1. ตอบจาก "เอกสารอ้างอิง" ด้านล่างเท่านั้น ถ้าไม่มีคำตอบในเอกสาร ให้บอกตรงๆ ว่ายังไม่มีข้อมูล ห้ามเดา\n' +
    '2. ห้ามให้คำแนะนำทางการแพทย์เด็ดขาด — คำถามเกี่ยวกับอาการบาดเจ็บ/โรคประจำตัว/ยา ต้องแนะนำให้ปรึกษาแพทย์เสมอ\n' +
    '3. ห้ามให้ตัวเลข strength benchmark ที่ไม่มีอยู่ในเอกสาร (ฐานข้อมูลของแอปยังว่างอยู่)\n' +
    '4. ห้ามแนะนำอาหารเสริม ยาลดน้ำหนัก หรือสารต้องห้าม\n' +
    '5. ถ้าข้อความผู้ใช้มีสัญญาณความเสี่ยงร้ายแรง (ทำร้ายตัวเอง/เหตุฉุกเฉินทางการแพทย์) ให้หยุดคุยเรื่องฟิตเนสทันทีและแนะนำให้ติดต่อบุคลากรทางการแพทย์/สายด่วนฉุกเฉิน\n\n' +
    '=== เอกสารอ้างอิง ===\n\n' + knowledge;

  var claudeRes;
  try{
    claudeRes = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'content-type': 'application/json',
        'x-api-key': env.ANTHROPIC_API_KEY,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 1024,
        system: systemPrompt,
        messages: [{role: 'user', content: question}]
      })
    });
  }catch(e){ return jsonError('เชื่อมต่อผู้ช่วยไม่สำเร็จ ลองใหม่อีกครั้ง', 502); }

  if(!claudeRes.ok){
    return jsonError('ผู้ช่วยตอบไม่สำเร็จ (' + claudeRes.status + ')', 502);
  }
  var data = await claudeRes.json();
  var answer = (data.content && data.content[0] && data.content[0].text) || '';
  return jsonResponse({answer: answer});
}

/* method อื่นที่ไม่ใช่ POST — ตอบ 405 ตรงๆ แทนที่จะปล่อยให้ Pages ตอบ 404 ทั่วไป */
export async function onRequestGet(){ return jsonError('ใช้ POST เท่านั้น', 405); }
