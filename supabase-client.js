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

/* ---------- auth ---------- */
function signUp(email, password){ return client.auth.signUp({email:email, password:password}); }
function signIn(email, password){ return client.auth.signInWithPassword({email:email, password:password}); }
function signOut(){ return client.auth.signOut(); }
function getSession(){ return client.auth.getSession(); }
function onAuthChange(cb){ return client.auth.onAuthStateChange(cb); }

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
  signUp: signUp, signIn: signIn, signOut: signOut,
  getSession: getSession, onAuthChange: onAuthChange,
  pushProgram: pushProgram, pullProgram: pullProgram,
  pushOnboarding: pushOnboarding, pullOnboarding: pullOnboarding,
  pushDailyLog: pushDailyLog, pullDailyLogs: pullDailyLogs,
  pushWeight: pushWeight, pullWeights: pullWeights
};

})(typeof window!=='undefined' ? window : this);
