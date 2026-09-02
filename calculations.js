/* ============================================================
   Gymbro Daily — Energy calculations layer (BMR / TDEE)
   ------------------------------------------------------------
   Single source of truth ของสูตรพลังงานทั้งระบบ (PART 1/2/19)
   flow นี้คือสาย "โภชนาการ": Questionnaire → User Profile → BMR → TDEE →
   Target Calories → Program Generator  (แยกจากสายความแข็งแรงใน benchmarks.js
   โดยตั้งใจ ตาม PART 18 — สองสายนี้ต้องไม่ผูก dependency กันโดยไม่จำเป็น)

   app.js เป็น consumer เท่านั้น: computeTDEE() เรียกผ่านสองฟังก์ชันนี้
   ห้ามเขียนสูตร BMR/TDEE ซ้ำที่ไหนอีกในระบบ

   เปิดเผย API ผ่าน global เดียว: window.GymBroCalc
   ============================================================ */
(function(global){
"use strict";

/* ------------------------------------------------------------
   Activity Factor — mapping กลางชุดเดียวของทั้งระบบ (PART 2)
   ห้าม hard-code ตัวเลขคนละชุดในแต่ละหน้า
   ------------------------------------------------------------ */
var ACTIVITY_FACTORS = {
  sedentary: 1.20,          // Sedentary / ไม่ค่อยออกกำลังกาย
  lightly_active: 1.375,    // Lightly Active / ออกกำลังกายเบา
  moderately_active: 1.55,  // Moderately Active / ออกกำลังกายปานกลาง
  very_active: 1.725,       // Very Active / ออกกำลังกายหนัก
  extremely_active: 1.90    // Extremely Active / ออกกำลังกายหนักมาก
};

/* คำตอบ Q36 (ลักษณะงาน/กิจกรรมนอกเวลาออกกำลังกาย) → ระดับกิจกรรมกลางข้างบน
   แบบสอบถามปัจจุบันมี 3 ตัวเลือก (ไม่แตะ Questionnaire ตาม PART 22/27) จึงยังไม่มี
   ทางเลือกที่ map ไป very_active / extremely_active — แต่ mapping กลางรองรับไว้แล้ว
   ถ้าวันหลังเพิ่มตัวเลือกในแบบสอบถาม เพิ่มบรรทัดตรงนี้จุดเดียวจบ */
var Q36_ACTIVITY_LEVEL = {
  'นั่งโต๊ะเป็นหลัก': 'sedentary',
  'ยืน-เดินเยอะ': 'lightly_active',
  'ใช้แรงงาน': 'moderately_active'
};

/* คืน activity factor จากชื่อระดับกลาง — ไม่รู้จัก = null (ห้ามเดา/ห้าม default เงียบ ๆ) */
function getActivityFactor(level){
  if(level==null) return null;
  if(Object.prototype.hasOwnProperty.call(ACTIVITY_FACTORS, level)) return ACTIVITY_FACTORS[level];
  return null;
}
/* คืน activity factor จากคำตอบ Q36 โดยตรง (ผ่าน mapping กลางเสมอ) */
function activityFactorFromQ36(answer){
  var level = Q36_ACTIVITY_LEVEL[answer];
  return level ? getActivityFactor(level) : null;
}

/* ------------------------------------------------------------
   calculateBMR — สูตร Mifflin-St Jeor (PART 1)
     ชาย  : (10 × kg) + (6.25 × cm) − (5 × age) + 5
     หญิง : (10 × kg) + (6.25 × cm) − (5 × age) − 161
   รับได้ทั้ง object ({weightKg, heightCm, age, sex}) และ positional
   (weightKg, heightCm, age, sex) เพื่อไม่ให้ call site เดิมพัง
   คืน null ถ้าข้อมูลไม่ครบ/ไม่ถูกต้อง — ห้ามคืน 0 เพื่อกลบ error (PART 20)
   ไม่ปัดเศษ: ค่าที่คืนคือค่าดิบสำหรับคำนวณต่อ ปัดเศษเฉพาะตอนแสดงผลเท่านั้น
   ------------------------------------------------------------ */
function calculateBMR(a, b, c, d){
  var weightKg, heightCm, age, sex;
  if(a && typeof a==='object'){
    weightKg = a.weightKg; heightCm = a.heightCm; age = a.age; sex = a.sex;
  } else {
    weightKg = a; heightCm = b; age = c; sex = d;
  }
  weightKg = Number(weightKg);
  heightCm = Number(heightCm);
  age = Number(age);
  if(!(weightKg>0) || !(heightCm>0) || !(age>0)) return null;
  if(sex!=='ชาย' && sex!=='หญิง') return null; // ใช้ค่าเดียวกับคำตอบ Q9 ตรง ๆ
  var base = 10*weightKg + 6.25*heightCm - 5*age;
  return sex==='ชาย' ? base+5 : base-161;
}

/* ------------------------------------------------------------
   calculateTDEE — TDEE = BMR × Activity Factor (PART 2)
   รับได้ทั้ง object ({bmr, activityFactor}) และ positional (bmr, activityFactor)
   คืน null ถ้า bmr หรือ activityFactor ไม่ถูกต้อง
   ------------------------------------------------------------ */
function calculateTDEE(a, b){
  var bmr, activityFactor;
  if(a && typeof a==='object'){
    bmr = a.bmr; activityFactor = a.activityFactor;
  } else {
    bmr = a; activityFactor = b;
  }
  bmr = Number(bmr);
  activityFactor = Number(activityFactor);
  if(!(bmr>0)) return null;
  if(!(activityFactor>0)) return null;
  return bmr * activityFactor;
}

global.GymBroCalc = {
  calculateBMR: calculateBMR,
  calculateTDEE: calculateTDEE,
  getActivityFactor: getActivityFactor,
  activityFactorFromQ36: activityFactorFromQ36,
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  Q36_ACTIVITY_LEVEL: Q36_ACTIVITY_LEVEL
};

})(typeof window!=='undefined' ? window : this);
