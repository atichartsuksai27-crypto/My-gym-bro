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

   ตัวคูณนี้คือ "กิจกรรมในชีวิตประจำวันนอกเวลาออกกำลังกาย" (TDEE ของระบบไม่รวมการฝึก —
   แคลจากการฝึกตามแผน/ที่ทำจริงบวกแยกทีหลังเสมอ ดู computeCalorieTarget/แถบไขมันใน app.js)
   ใช้ค่า PAL ของ FAO/WHO/UNU (2004): sedentary/light lifestyle 1.40–1.69, active 1.70–1.99
     นั่งโต๊ะ = 1.40 (ขอบล่างของกลุ่ม sedentary), ยืน-เดินเยอะ = 1.55 (กลางกลุ่ม), ใช้แรงงาน = 1.75 (ขอบล่างของกลุ่ม active)
   เดิมใช้ 1.2/1.375/1.55 ของตาราง Harris-Benedict ซึ่ง "รวมการออกกำลังกายแล้ว" — พอใช้เป็นฐานแล้วบวกแคลฝึกแยก
   เป้าแคลอรี่จึงต่ำเกินจริง (BMR × 1.2 ≈ คนนอนติดเตียง) ค่าใหม่ใกล้ค่าประมาณพลังงานของ USDA สำหรับคนไม่ออกกำลังกาย
   ------------------------------------------------------------ */
var ACTIVITY_FACTORS = {
  sedentary: 1.40,          // นั่งโต๊ะเป็นหลัก
  lightly_active: 1.55,     // ยืน-เดินเยอะ
  moderately_active: 1.75   // ใช้แรงงาน
};

/* คำตอบ Q36 (ลักษณะงาน/กิจกรรมนอกเวลาออกกำลังกาย) → ระดับกิจกรรมกลางข้างบน
   ถ้าวันหลังเพิ่มตัวเลือกในแบบสอบถาม เพิ่มบรรทัดตรงนี้กับตารางข้างบนจุดเดียวจบ */
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

/* ------------------------------------------------------------
   Energy availability (EA) — เกณฑ์ IOC RED-S: EA = (แคลที่กิน − แคลจากการออกกำลังกาย) / มวลไร้ไขมัน (FFM, กก.)
   ต่ำกว่า ~30 kcal/กก. FFM เสี่ยงประจำเดือนผิดปกติ/มวลกระดูกลด/ฮอร์โมนเสีย; 45 = สมดุลพลังงานปกติ
   EA_MIN_CUT = พื้นระหว่างลดไขมัน, EA_MIN_NON_CUT = พื้นสำหรับเป้าที่ไม่ได้ตั้งใจให้ขาด (รักษา/Recomp/เพิ่มกล้าม)
   คืน null ถ้าข้อมูลไม่ครบ/ไม่ถูกต้อง — ไม่คืน 0 กลบ error
   ------------------------------------------------------------ */
var EA_MIN_CUT = 30, EA_MIN_NON_CUT = 35;
function calculateFFM(weightKg, bodyFatPct){
  weightKg = Number(weightKg); bodyFatPct = Number(bodyFatPct);
  if(!(weightKg>0) || !(bodyFatPct>=0 && bodyFatPct<100)) return null;
  return weightKg * (1 - bodyFatPct/100);
}
function calculateEnergyAvailability(a, b, c){
  var intakeKcal, exerciseKcal, ffmKg;
  if(a && typeof a==='object'){ intakeKcal = a.intakeKcal; exerciseKcal = a.exerciseKcal; ffmKg = a.ffmKg; }
  else { intakeKcal = a; exerciseKcal = b; ffmKg = c; }
  if(intakeKcal==null || intakeKcal==='') return null; // Number(null) = 0 จะกลายเป็น "กิน 0 kcal" เงียบ ๆ
  intakeKcal = Number(intakeKcal); exerciseKcal = Number(exerciseKcal) || 0; ffmKg = Number(ffmKg);
  if(!(intakeKcal>=0) || !(ffmKg>0)) return null;
  return (intakeKcal - exerciseKcal) / ffmKg;
}
/* แคลต่ำสุดที่กินได้โดย EA ไม่ต่ำกว่า minEA (ใช้ตัดสินก่อนลดเป้า) */
function minIntakeForEA(minEA, exerciseKcal, ffmKg){
  minEA = Number(minEA); exerciseKcal = Number(exerciseKcal) || 0; ffmKg = Number(ffmKg);
  if(!(minEA>0) || !(ffmKg>0)) return null;
  return minEA*ffmKg + exerciseKcal;
}

global.GymBroCalc = {
  calculateBMR: calculateBMR,
  calculateTDEE: calculateTDEE,
  calculateFFM: calculateFFM,
  calculateEnergyAvailability: calculateEnergyAvailability,
  minIntakeForEA: minIntakeForEA,
  EA_MIN_CUT: EA_MIN_CUT,
  EA_MIN_NON_CUT: EA_MIN_NON_CUT,
  getActivityFactor: getActivityFactor,
  activityFactorFromQ36: activityFactorFromQ36,
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  Q36_ACTIVITY_LEVEL: Q36_ACTIVITY_LEVEL
};

})(typeof window!=='undefined' ? window : this);
