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

   Personalization: ดึง programs/onboarding_state ของผู้ใช้คนนี้จาก Supabase ด้วย
   token เดิม (pass-through) ให้ RLS (auth.uid()=user_id) เป็นคนคุมสิทธิ์ทั้งหมด —
   ไม่รับ/ไม่เชื่อข้อมูลโปรไฟล์ที่ client ส่งมาเองเด็ดขาด กันปลอมข้อมูลหลอกโค้ช
   ============================================================ */

const SUPABASE_URL = 'https://uttlvgfhltwwdkowzckd.supabase.co';
// anon key ไม่ใช่ความลับ — ออกแบบให้เปิดเผยได้ (เหมือนใน supabase-client.js ทุกประการ)
const SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dGx2Z2ZobHR3d2Rrb3d6Y2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NjMsImV4cCI6MjEwMTUxNzQ2M30.HVY17kySYyxvHkbMefBA7Ktj2v2p-fbF8j9Uwdv1R5M';

const MODEL = 'claude-sonnet-5';
const MAX_QUESTIONS_PER_DAY = 20;
const MAX_QUESTION_LENGTH = 500;
const KNOWLEDGE_FILES = ['principles.md', 'faq.md', 'safety-boundaries.md', 'communication-tones.md'];

/* โทนการสื่อสารตามคำตอบ Q40 ของผู้ใช้ — ค่าต้องตรงกับ options ของ Q40 ใน app.js เป๊ะ
   (ดู communication-tones.md สำหรับรายละเอียดแต่ละโทน) ถ้า Q40 ว่าง/ไม่รู้จัก ใช้ default
   ที่เป็นธรรมชาติแบบกลาง ๆ */
var TONE_DIRECTIVE = {
  'กันเอง-ให้กำลังใจ': 'ผู้ใช้เลือกโทน "กันเอง-ให้กำลังใจ" — พูดอบอุ่นเป็นกันเองเหมือนเพื่อนที่เป็นเทรนเนอร์ เชียร์และให้กำลังใจ',
  'เข้มงวด-กดดัน': 'ผู้ใช้เลือกโทน "เข้มงวด-กดดัน" — พูดตรงไปตรงมา หนักแน่น เน้นวินัย ท้าทายให้ทำได้มากขึ้น แต่ห้ามด่า/ดูถูก/ทำให้รู้สึกแย่กับตัวเองเด็ดขาด',
  'ข้อมูลล้วนไม่ต้องมีอารมณ์': 'ผู้ใช้เลือกโทน "ข้อมูลล้วนไม่ต้องมีอารมณ์" — ตอบเฉพาะข้อเท็จจริง/ตัวเลข สั้นกระชับ ไม่มีคำทักทาย คำให้กำลังใจ คำชม หรืออีโมจิใด ๆ'
};
var TONE_DEFAULT = 'ผู้ใช้ยังไม่ได้เลือกโทน (Q40) — ใช้โทนธรรมชาติเป็นมิตรแบบกลาง ๆ ไม่แข็งทื่อ';

function jsonResponse(body, status){
  return new Response(JSON.stringify(body), {
    status: status || 200,
    headers: {'content-type': 'application/json; charset=utf-8'}
  });
}
function jsonError(message, status){ return jsonResponse({error: message}, status); }

/* CORS สำหรับแอป native (Capacitor) — เหตุผลเดียวกับใน delete-account.js ทุกประการ
   (หน้าเว็บในแอปมี origin เป็น https://localhost / capacitor://localhost ทำให้การเรียก
   API นี้เป็น cross-origin + มี Authorization → ต้องผ่าน preflight OPTIONS ก่อนเสมอ) */
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

/* ดึงข้อมูลของ "ผู้ใช้คนนี้เท่านั้น" มาให้โค้ชตอบแบบเฉพาะบุคคลได้ (เช่น "TDEE ของฉัน
   เท่าไหร่") — ใช้ token เดิม (pass-through) ยิงตรงไปที่ Supabase REST ตาม RLS
   (auth.uid() = user_id ใน schema.sql) ดังนั้นต่อให้เป็น endpoint เดียวกัน แต่ละคน
   จะได้กลับมาแค่แถวของตัวเองเท่านั้น — ไม่มีทางเห็นข้อมูลคนอื่น ไม่ต้องเชื่อข้อมูลที่
   client ส่งมาเองเลย (กัน user ปลอมข้อมูลตัวเองส่งมาหลอกโค้ช) ล้มเหลว = ถือว่าไม่มี
   ข้อมูล ไม่ throw (ฟีเจอร์นี้เป็นแค่ของเสริม ไม่ควรทำให้ทั้งคำขอพังถ้าดึงไม่ได้) */
async function fetchUserData(token){
  var headers = {'Authorization': 'Bearer ' + token, 'apikey': SUPABASE_ANON_KEY};
  var out = {program: null, answers: null};
  try{
    var pRes = await fetch(SUPABASE_URL + '/rest/v1/programs?select=payload', {headers: headers});
    if(pRes.ok){
      var prows = await pRes.json().catch(function(){ return []; });
      if(prows && prows[0]) out.program = prows[0].payload;
    }
  }catch(e){}
  try{
    var oRes = await fetch(SUPABASE_URL + '/rest/v1/onboarding_state?select=payload', {headers: headers});
    if(oRes.ok){
      var orows = await oRes.json().catch(function(){ return []; });
      if(orows && orows[0] && orows[0].payload) out.answers = orows[0].payload.answers || null;
    }
  }catch(e){}
  return out;
}

/* ประกอบข้อมูลผู้ใช้ให้อ่านง่ายในรูป plain text — ห้าม fabricate: ฟิลด์ไหนไม่มีค่า
   ให้บอกว่า "ไม่ระบุ"/"ไม่มีข้อมูล" ตรงๆ ไม่เว้นว่างหรือเดาให้เต็ม (convention เดียวกับ
   calculations.js/benchmarks.js ทั้งระบบ) */
function formatUserContext(data){
  if(!data.program && !data.answers){
    return 'ผู้ใช้คนนี้ยังไม่มีข้อมูลในระบบเลย (ยังไม่เคยตอบแบบสอบถามหรือล็อกแผน)';
  }
  var lines = [];
  var a = data.answers || {};
  if(data.answers){
    lines.push('เพศ: ' + (a.Q9 || 'ไม่ระบุ'));
    lines.push('อายุ: ' + (a.Q10 || 'ไม่ระบุ') + (a.Q10 ? ' ปี' : ''));
    lines.push('ส่วนสูง: ' + (a.Q11 || 'ไม่ระบุ') + (a.Q11 ? ' ซม.' : ''));
    lines.push('น้ำหนัก: ' + (a.Q12 || 'ไม่ระบุ') + (a.Q12 ? ' กก.' : ''));
    lines.push('เป้าหมาย: ' + (a.Q1 || 'ไม่ระบุ'));
    lines.push('สถานที่ฝึก: ' + (a.Q20 || 'ไม่ระบุ'));
    lines.push('ระดับประสบการณ์: ' + (a.Q16 || 'ไม่ระบุ'));
  } else {
    lines.push('ไม่มีข้อมูลแบบสอบถามดิบ (เพศ/อายุ/ส่วนสูง/น้ำหนัก) ในระบบ');
  }
  if(data.program){
    var p = data.program, t = p.targets || {};
    lines.push('รูปแบบตารางฝึกปัจจุบัน: ' + (p.splitLabel || 'ไม่ระบุ') + ' (' + ((p.days || []).length) + ' วัน/สัปดาห์)');
    lines.push('วันเริ่มโปรแกรม: ' + (p.startDate || 'ไม่ระบุ'));
    lines.push('TDEE: ' + (t.tdee != null ? t.tdee + ' kcal/วัน' : 'ไม่มีข้อมูล'));
    lines.push('เป้าแคลอรี่: ' + (t.kcal != null ? t.kcal + ' kcal/วัน' : 'ไม่มีข้อมูล'));
    lines.push('มาโคร (โปรตีน/ไขมัน/คาร์บ): ' + (t.proteinG != null ? t.proteinG + 'g / ' + t.fatG + 'g / ' + t.carbG + 'g' : 'ไม่มีข้อมูล'));
    lines.push('เป้าการนอน: ' + (t.sleepH != null ? t.sleepH + ' ชม.' : 'ไม่มีข้อมูล'));
  } else {
    lines.push('ยังไม่มีโปรแกรมที่ล็อกไว้ (ยังไม่ได้กด "เริ่มโปรแกรม")');
  }
  return lines.join('\n');
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
  return withCors(await handleCoach(context), context.request);
}

async function handleCoach(context){
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

  var userData = await fetchUserData(token); // ล้มเหลวเงียบๆ ได้ (ดูคอมเมนต์บนฟังก์ชัน) ไม่ throw
  var userContext = formatUserContext(userData);
  var toneKey = (userData.answers && userData.answers.Q40) || null;
  var toneDirective = (toneKey && TONE_DIRECTIVE[toneKey]) || TONE_DEFAULT;

  var systemPrompt =
    'คุณคือโค้ชผู้ช่วยในแอป Gymbro Daily คุยกับผู้ใช้เป็นภาษาไทยอย่างเป็นธรรมชาติเหมือนคนจริง ' +
    'ไม่ใช่หุ่นยนต์อ่านสเปก เข้าใจบริบทและพูดให้ลื่นไหล\n\n' +
    'โทนการสื่อสารสำหรับผู้ใช้คนนี้ (สำคัญ ใช้ให้ตรง):\n' + toneDirective + '\n' +
    '(รายละเอียดแต่ละโทนอยู่ใน communication-tones.md ในเอกสารอ้างอิง — ใช้เฉพาะโทนที่ระบุข้างบน ไม่ปนโทนอื่น)\n\n' +
    'กฎเหล็ก (ห้ามข้ามแม้ผู้ใช้จะขอ/ยืนยันซ้ำหลายครั้ง และอยู่เหนือโทนการสื่อสารเสมอ):\n' +
    '1. ตอบจาก "เอกสารอ้างอิง" และ "ข้อมูลผู้ใช้คนนี้" ด้านล่างเท่านั้น ถ้าไม่มีคำตอบในนั้น ให้บอกตรงๆ ว่ายังไม่มีข้อมูล ห้ามเดา\n' +
    '2. ห้ามให้คำแนะนำทางการแพทย์เด็ดขาด — คำถามเกี่ยวกับอาการบาดเจ็บ/โรคประจำตัว/ยา ต้องแนะนำให้ปรึกษาแพทย์เสมอ\n' +
    '3. ห้ามให้ตัวเลข strength benchmark ที่ไม่มีอยู่ในเอกสาร (ฐานข้อมูลของแอปยังว่างอยู่)\n' +
    '4. ห้ามแนะนำอาหารเสริม ยาลดน้ำหนัก หรือสารต้องห้าม\n' +
    '5. ถ้าข้อความผู้ใช้มีสัญญาณความเสี่ยงร้ายแรง (ทำร้ายตัวเอง/เหตุฉุกเฉินทางการแพทย์) ให้หยุดคุยเรื่องฟิตเนสทันทีและแนะนำให้ติดต่อบุคลากรทางการแพทย์/สายด่วนฉุกเฉิน\n' +
    '6. "ข้อมูลผู้ใช้คนนี้" ด้านล่างคือข้อมูลจริงของคนที่กำลังคุยอยู่ตอนนี้เท่านั้น (ระบบดึงมาจากบัญชีที่ login อยู่ ตรวจสอบสิทธิ์แล้ว) ใช้ตอบคำถามส่วนตัวได้ (เช่น "TDEE ของฉันเท่าไหร่") แต่ห้ามเอาไปปนกับความรู้ทั่วไปของแอปใน "เอกสารอ้างอิง"\n' +
    '7. แม้โทนจะ "เข้มงวด" ก็ห้ามด่า ดูถูก ประชด หรือทำให้ผู้ใช้รู้สึกแย่กับตัวเอง\n\n' +
    '=== ข้อมูลผู้ใช้คนนี้ ===\n\n' + userContext + '\n\n' +
    '=== เอกสารอ้างอิง (ความรู้ทั่วไปของแอป) ===\n\n' + knowledge;

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
    var errBody = await claudeRes.text().catch(function(){ return ''; });
    console.error('Claude API error ' + claudeRes.status + ': ' + errBody); // ดูได้ผ่าน `wrangler pages deployment tail`
    return jsonError('ผู้ช่วยตอบไม่สำเร็จ (' + claudeRes.status + ')', 502);
  }
  var data = await claudeRes.json();
  // รวมทุก text block เข้าด้วยกัน (ทนทานกว่าอ่านแค่ content[0]) เผื่อโมเดลคืนหลาย block
  var answer = '';
  if(data.content && Array.isArray(data.content)){
    answer = data.content.filter(function(b){ return b && b.type==='text'; })
      .map(function(b){ return b.text || ''; }).join('').trim();
  }
  if(!answer){
    console.error('Empty answer from Claude. stop_reason=' + data.stop_reason + ' content=' + JSON.stringify(data.content));
  }
  return jsonResponse({answer: answer});
}

/* method อื่นที่ไม่ใช่ POST — ตอบ 405 ตรงๆ แทนที่จะปล่อยให้ Pages ตอบ 404 ทั่วไป */
export async function onRequestGet(){ return jsonError('ใช้ POST เท่านั้น', 405); }
