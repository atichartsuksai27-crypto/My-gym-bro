/* ============================================================
   Gymbro Daily — Supabase client (เลเยอร์ sync เสริม)
   ------------------------------------------------------------
   ไฟล์นี้เป็นแค่ตัวห่อ Supabase client + CRUD ดิบๆ เท่านั้น ไม่มี business
   logic ใดๆ ของแอป (ไม่ตัดสินใจว่าเมื่อไหร่ควร push/pull — app.js เป็นคนเรียก)
   ต้องโหลด supabase-js (UMD build) ก่อนไฟล์นี้เสมอ

   anon key ด้านล่างตั้งใจฝังในโค้ด frontend ตรงๆ — ปลอดภัยเพราะ Supabase
   ออกแบบให้ค่านี้เปิดเผยได้ (เทียบเท่า public API key) ความปลอดภัยจริงมาจาก
   Row Level Security (RLS) ที่ตั้งไว้ใน supabase/schema.sql ไม่ใช่การซ่อนค่านี้
   ============================================================ */
(function(global){
"use strict";

var SUPABASE_URL = 'https://uttlvgfhltwwdkowzckd.supabase.co';
var SUPABASE_ANON_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dGx2Z2ZobHR3d2Rrb3d6Y2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NjMsImV4cCI6MjEwMTUxNzQ2M30.HVY17kySYyxvHkbMefBA7Ktj2v2p-fbF8j9Uwdv1R5M';

var client = null;
try{
  if(global.supabase && typeof global.supabase.createClient==='function'){
    client = global.supabase.createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  }
}catch(e){ client = null; }

function isReady(){ return !!client; }

/* ---------- auth ----------
   Google เท่านั้น (ตัดอีเมล/รหัสผ่านออกแล้ว — กันอีเมลปลอมได้ฟรีโดย Google เอง ไม่ต้อง
   พึ่ง SMTP/SMS ที่มีค่าใช้จ่ายและขีดจำกัดตามที่เจอมาก่อนหน้า) */
function signOut(){ return client.auth.signOut(); }
function getSession(){ return client.auth.getSession(); }
function onAuthChange(cb){ return client.auth.onAuthStateChange(cb); }

/* isNative: true เฉพาะตอนรันในแอป Capacitor (Android/iOS) — Capacitor inject
   window.Capacitor ให้อัตโนมัติตอนรันจริงบนเครื่อง ไม่มีทางเจอค่านี้ตอนเปิดผ่านเว็บ
   ปกติเลย ใช้เช็คเพื่อแยกเส้นทาง auth ของ native ออกจากเว็บเท่านั้น ไม่กระทบเว็บ */
function isNative(){
  return typeof global.Capacitor !== 'undefined' && !!global.Capacitor.isNativePlatform && global.Capacitor.isNativePlatform();
}
/* ต้องตั้งค่า URL นี้ไว้ใน Supabase Dashboard ด้วย: Authentication > URL Configuration
   > Redirect URLs > เพิ่ม gymbrodaily://auth-callback (ดู mobile/android AndroidManifest.xml
   และ mobile/ios Info.plist ที่ประกาศ custom scheme "gymbrodaily" ไว้คู่กัน) */
var NATIVE_REDIRECT = 'gymbrodaily://auth-callback';

/* signInWithGoogle บนเว็บ: redirect ทั้งหน้าไป Google แล้วกลับมาที่ origin เดิมพร้อม session
   (พฤติกรรมเดิม ไม่เปลี่ยน) — ต้องตั้งค่า Google provider ที่ Supabase Dashboard ก่อน
   (Client ID/Secret จาก Google Cloud Console) ไม่ต้องใช้ค่าลับใดๆ ในโค้ดฝั่งนี้เลย
   ความลับอยู่ใน Supabase ทั้งหมด

   บนแอป native: ทำแบบเดียวกันไม่ได้ เพราะ 1) WebView ของแอปไม่มี origin ที่ Google ยิง
   callback กลับมาถึงได้ 2) Google บล็อกการ sign-in ที่ทำ "ในตัว" embedded WebView ตรงๆ
   (error "disallowed_useragent") — ต้องเปิดหน้า Google ด้วยเบราว์เซอร์ระบบแยกต่างหาก
   (@capacitor/browser: SFSafariViewController/Chrome Custom Tabs ไม่ใช่ WebView ของแอป)
   แล้วให้ Supabase redirect กลับมาที่ custom URL scheme ของแอปแทน (NATIVE_REDIRECT)
   ฝั่ง OS จะส่ง deep link นั้นกลับเข้าแอปเป็น event 'appUrlOpen' (ดัก+แกะ token ที่
   handleNativeAuthCallback ด้านล่าง, ผูก listener ไว้ที่ app.js boot()) */
function signInWithGoogle(){
  if(!isNative()){
    return client.auth.signInWithOAuth({provider:'google', options:{redirectTo: global.location.origin}});
  }
  return client.auth.signInWithOAuth({
    provider:'google',
    options:{redirectTo: NATIVE_REDIRECT, skipBrowserRedirect:true}
  }).then(function(res){
    if(res.error || !res.data || !res.data.url) return res;
    return global.Capacitor.Plugins.Browser.open({url: res.data.url}).then(function(){ return res; });
  });
}

/* handleNativeAuthCallback: เรียกจาก app.js ตอนดัก event 'appUrlOpen' ได้ URL ของ deep
   link กลับมา (รูปแบบ gymbrodaily://auth-callback#access_token=...&refresh_token=...
   — Supabase ใส่ token ไว้ใน URL fragment ตาม flow แบบ implicit ที่ใช้อยู่) แกะออกมา
   ตั้ง session เอง เพราะ native ไม่ได้เดินเส้นทาง redirect ปกติที่ supabase-js ดักจับเองได้
   บนเว็บ — ไม่ใช่ URL/ไม่มี token ที่ต้องการ = เงียบไว้เฉยๆ ไม่ใช่ error (อาจเป็น deep
   link อื่นในอนาคตที่ไม่เกี่ยวกับ auth) */
function handleNativeAuthCallback(url){
  if(!url || url.indexOf(NATIVE_REDIRECT) !== 0) return;
  var hashIdx = url.indexOf('#');
  if(hashIdx===-1) return;
  var params = new URLSearchParams(url.slice(hashIdx+1));
  var access_token = params.get('access_token');
  var refresh_token = params.get('refresh_token');
  if(!access_token || !refresh_token) return;
  client.auth.setSession({access_token:access_token, refresh_token:refresh_token});
  if(global.Capacitor && global.Capacitor.Plugins && global.Capacitor.Plugins.Browser){
    global.Capacitor.Plugins.Browser.close();
  }
}

/* ---------- data sync (best-effort — ผู้เรียกเป็นคนตัดสินใจว่าจะ .catch ยังไง) ----------
   ทุกฟังก์ชันคืน Supabase's thenable ตรงๆ (ไม่ครอบ try/catch ที่นี่) เพื่อให้ผู้เรียก
   ควบคุม error handling เองได้เต็มที่ (เช่น เงียบไว้เฉยๆ ตอน background sync) */
function pushProgram(userId, payload){
  return client.from('programs').upsert({user_id:userId, payload:payload}, {onConflict:'user_id'});
}
function pullProgram(userId){
  return client.from('programs').select('payload').eq('user_id', userId).maybeSingle();
}
function pushOnboarding(userId, payload){
  return client.from('onboarding_state').upsert({user_id:userId, payload:payload}, {onConflict:'user_id'});
}
function pullOnboarding(userId){
  return client.from('onboarding_state').select('payload').eq('user_id', userId).maybeSingle();
}
function pushDailyLog(userId, dateISO, payload){
  return client.from('daily_logs').upsert({user_id:userId, log_date:dateISO, payload:payload}, {onConflict:'user_id,log_date'});
}
function pullDailyLogs(userId){
  return client.from('daily_logs').select('log_date,payload').eq('user_id', userId);
}
function pushWeight(userId, dateISO, kg){
  return client.from('body_weights').upsert({user_id:userId, log_date:dateISO, kg:kg}, {onConflict:'user_id,log_date'});
}
function pullWeights(userId){
  return client.from('body_weights').select('log_date,kg').eq('user_id', userId);
}

global.GymBroSync = {
  isReady: isReady,
  signOut: signOut,
  getSession: getSession, onAuthChange: onAuthChange,
  signInWithGoogle: signInWithGoogle, handleNativeAuthCallback: handleNativeAuthCallback,
  pushProgram: pushProgram, pullProgram: pullProgram,
  pushOnboarding: pushOnboarding, pullOnboarding: pullOnboarding,
  pushDailyLog: pushDailyLog, pullDailyLogs: pullDailyLogs,
  pushWeight: pushWeight, pullWeights: pullWeights
};

})(typeof window!=='undefined' ? window : this);
