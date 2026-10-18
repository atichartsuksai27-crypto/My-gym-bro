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
   calculateBMRKatchMcArdle — BMR = 370 + 21.6 × มวลไร้ไขมัน (กก.)
   แม่นกว่า Mifflin สำหรับคนที่มีกล้ามเยอะ/ไขมันต่ำ เพราะ Mifflin ใช้น้ำหนักรวมโดยไม่แยกกล้ามกับไขมัน
   ใช้เฉพาะเมื่อผู้ใช้ "กรอก % ไขมันเอง" (3–60%) — % ที่ประมาณจากรูปร่าง/BMI กว้างเกินไป อาจเพี้ยนกว่า Mifflin
   คืน null ถ้าข้อมูลไม่ถูกต้อง
   ------------------------------------------------------------ */
var KATCH_BF_MIN = 3, KATCH_BF_MAX = 60;
function calculateBMRKatchMcArdle(weightKg, bodyFatPct){
  weightKg = Number(weightKg); bodyFatPct = Number(bodyFatPct);
  if(!(weightKg>0) || !(bodyFatPct>=KATCH_BF_MIN && bodyFatPct<=KATCH_BF_MAX)) return null;
  return 370 + 21.6 * (weightKg * (1 - bodyFatPct/100));
}
/* ------------------------------------------------------------
   BMI / น้ำหนักอ้างอิง (Adjusted Body Weight)
   Mifflin กับน้ำหนักรวมของคน BMI > 25 นับไขมันส่วนเกินเหมือนเนื้อเยื่อที่ใช้พลังงานเท่ากล้าม → TDEE สูงเกินจริง
   BMI > 25 จึงใช้ ABW = anchor + 0.4 × (น้ำหนักจริง − anchor)  (0.4 = สัดส่วนของน้ำหนักส่วนเกินที่ยังเผาผลาญ)
   anchor = น้ำหนักเป้าหมายถ้าอยู่ในช่วง BMI 18.5–25 และต่ำกว่าน้ำหนักจริง ไม่งั้น IBW (น้ำหนักที่ BMI 22 —
   ใช้ BMI แทนสูตร Devine เพราะ Devine อิงส่วนสูงฝรั่งและคิดค่าเพี้ยนกับคนตัวเล็ก)
   ------------------------------------------------------------ */
var BMI_ABW_THRESHOLD = 25, IBW_BMI = 22, ABW_FACTOR = 0.4;
function calculateBMI(weightKg, heightCm){
  weightKg = Number(weightKg); heightCm = Number(heightCm);
  if(!(weightKg>0) || !(heightCm>0)) return null;
  var m = heightCm/100;
  return weightKg/(m*m);
}
function idealBodyWeight(heightCm){
  heightCm = Number(heightCm);
  if(!(heightCm>0)) return null;
  var m = heightCm/100;
  return IBW_BMI*m*m;
}
/* คืน {kg, method:'actual'|'abw', bmi, anchorKg} — kg คือน้ำหนักที่ควรใช้คิด BMR/โปรตีน; null ถ้าข้อมูลไม่ครบ */
function referenceWeight(weightKg, heightCm, goalWeightKg){
  var bmi = calculateBMI(weightKg, heightCm);
  if(bmi==null) return null;
  weightKg = Number(weightKg);
  if(bmi <= BMI_ABW_THRESHOLD) return {kg: weightKg, method: 'actual', bmi: bmi, anchorKg: null};
  var goalBmi = calculateBMI(goalWeightKg, heightCm);
  var anchor = (goalBmi!=null && goalBmi>=18.5 && goalBmi<=BMI_ABW_THRESHOLD && Number(goalWeightKg) < weightKg)
    ? Number(goalWeightKg) : idealBodyWeight(heightCm);
  return {kg: anchor + ABW_FACTOR*(weightKg - anchor), method: 'abw', bmi: bmi, anchorKg: anchor};
}

/* จุดเข้าเดียวสำหรับ BMR ของโปรไฟล์ผู้ใช้: ข้อมูลพื้นฐานต้องครบก่อน (ไม่งั้น null เหมือนเดิม)
   1) มี bodyFatPct ที่ผู้ใช้กรอกเอง → Katch-McArdle (คิดจากมวลไร้ไขมันอยู่แล้ว ไม่ต้องปรับน้ำหนัก)
   2) ไม่งั้น Mifflin-St Jeor ด้วยน้ำหนักอ้างอิง: BMI ≤ 25 = น้ำหนักจริง, BMI > 25 = ABW (ดู referenceWeight)
   รับ object {weightKg, heightCm, age, sex, bodyFatPct, goalWeightKg}  bodyFatPct/goalWeightKg ว่าง/null = ไม่ได้กรอก */
function calculateBMRForProfile(p){
  var mifflin = calculateBMR(p);
  if(mifflin==null) return null;
  if(p.bodyFatPct!=null && p.bodyFatPct!==''){
    var katch = calculateBMRKatchMcArdle(p.weightKg, p.bodyFatPct);
    if(katch!=null) return katch;
  }
  var ref = referenceWeight(p.weightKg, p.heightCm, p.goalWeightKg);
  if(!ref || ref.method==='actual') return mifflin;
  return calculateBMR(ref.kg, p.heightCm, p.age, p.sex);
}

/* ------------------------------------------------------------
   recompDeficit — % ที่หักจากพลังงานที่ใช้ (และเพดาน kcal) ของ Recomposition แปรตาม BMI
   คนผอม/สมส่วนต้องขาดน้อยเพื่อไม่เสียกล้าม คนอ้วนมีพลังงานสะสมมาก recomp ได้แม้ขาดมาก
   ช่วง 22–24.9 ไม่ได้ระบุในโจทย์ — ใช้ค่ากลางระหว่างสองช่วงข้างเคียง (12%, 400 kcal)
   ------------------------------------------------------------ */
var RECOMP_DEFICIT_TIERS = [
  {maxBmi: 22,       pct: 0.08, cap: 300},
  {maxBmi: 25,       pct: 0.12, cap: 400},
  {maxBmi: 30,       pct: 0.20, cap: 500},
  {maxBmi: Infinity, pct: 0.25, cap: 800}
];
function recompDeficit(bmi){
  bmi = Number(bmi);
  if(!(bmi>0)) return null;
  for(var i=0; i<RECOMP_DEFICIT_TIERS.length; i++){
    if(bmi < RECOMP_DEFICIT_TIERS[i].maxBmi) return RECOMP_DEFICIT_TIERS[i];
  }
  return RECOMP_DEFICIT_TIERS[RECOMP_DEFICIT_TIERS.length-1];
}

/* ------------------------------------------------------------
   calculateMacros — คิดเป็นกรัมตามลำดับ ไม่ใช่แบ่งเปอร์เซ็นต์ (กันคาร์บเฟ้อเมื่อแคลรวมสูง)
     1) โปรตีน = 2.0 g × proteinRefKg      (น้ำหนักเป้า/IBW สำหรับ BMI > 25 — ผู้เรียกเป็นคนเลือก)
     2) ไขมัน  = 0.8 g × fatRefKg (น้ำหนักปัจจุบัน) แล้วบีบให้อยู่ใน 20–30% ของแคลรวม
     3) คาร์บ  = (kcal − โปรตีน×4 − ไขมัน×9) / 4  — ได้ส่วนที่เหลือทั้งหมด
   ถ้าคาร์บเหลือต่ำกว่า CARB_MIN_G ให้ถอยทีละขั้น (ไม่ดันคาร์บขึ้นจนรวมเกินเป้าแบบเดิม):
     a) ลดไขมันลงถึงพื้น 20%  b) ลดโปรตีนลงถึง 1.6 g/kg  c) คาร์บ = ส่วนที่เหลือ (ต่ำสุด 0 ไม่ติดลบ)
   clamped = true เมื่อต้องถอยข้อใดข้อหนึ่ง
   kcal ว่าง → คืนแค่โปรตีน (ไม่ fabricate ไขมัน/คาร์บ)
   ------------------------------------------------------------ */
var PROTEIN_G_PER_KG = 2.0, PROTEIN_MIN_G_PER_KG = 1.6, FAT_G_PER_KG = 0.8;
var FAT_MIN_PCT = 0.20, FAT_MAX_PCT = 0.30, CARB_MIN_G = 50;
function calculateMacros(kcal, proteinRefKg, fatRefKg){
  proteinRefKg = Number(proteinRefKg);
  fatRefKg = Number(fatRefKg) > 0 ? Number(fatRefKg) : proteinRefKg;
  var hasRef = proteinRefKg > 0;
  var proteinG = hasRef ? PROTEIN_G_PER_KG*proteinRefKg : 0;
  if(kcal==null || kcal==='' || !isFinite(Number(kcal))){
    return {proteinG: hasRef ? Math.round(proteinG) : null, fatG: null, carbG: null, clamped: false};
  }
  kcal = Number(kcal);
  var fatMinG = kcal*FAT_MIN_PCT/9, fatMaxG = kcal*FAT_MAX_PCT/9;
  var fatG = fatRefKg > 0 ? Math.min(fatMaxG, Math.max(fatMinG, FAT_G_PER_KG*fatRefKg)) : kcal*0.25/9; // ไม่รู้น้ำหนัก = กลางช่วง
  function carbsLeft(){ return (kcal - proteinG*4 - fatG*9)/4; }
  var clamped = false;
  if(carbsLeft() < CARB_MIN_G && fatG > fatMinG){
    fatG = Math.max(fatMinG, fatG - (CARB_MIN_G - carbsLeft())*4/9); clamped = true;
  }
  if(carbsLeft() < CARB_MIN_G && hasRef){
    var proteinMinG = PROTEIN_MIN_G_PER_KG*proteinRefKg;
    if(proteinG > proteinMinG){ proteinG = Math.max(proteinMinG, proteinG - (CARB_MIN_G - carbsLeft())); clamped = true; }
  }
  if(carbsLeft() < CARB_MIN_G) clamped = true;
  var carbG = Math.max(0, carbsLeft());
  return {proteinG: hasRef ? Math.round(proteinG) : null, fatG: Math.round(fatG), carbG: Math.round(carbG), clamped: clamped};
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
/* BMI (น้ำหนักจริง) ตั้งแต่ค่านี้ขึ้นไปข้ามด่าน EA — ขอบเดียวกับช่วง Recomp สุดท้ายของ recompDeficit (bmi < 30 ใช้ 20%/500, ≥ 30 ใช้ 25%/800) */
var EA_SKIP_BMI = 30;
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
/* ด่านกลางของ energy availability — ใช้ทั้งตอนสร้างแผน (computeCalorieTarget), ตอนเสนอเป้าใหม่ให้แผนเก่า (calorieTargetUpdate)
   และตอนปรับเป้าตามผลจริง (pgRecommend) ไม่ให้สามที่เขียนสูตรซ้ำกันเอง
   ดันเป้าขึ้นได้อย่างเดียว ห้ามลด: เป้าที่ EA ผ่านอยู่แล้ว (รวมเป้ารักษา/เพิ่มกล้ามที่สูงอยู่แล้ว) คืนเท่าเดิมเป๊ะ
   เกณฑ์: ลดไขมัน = EA_MIN_CUT, เป้าอื่น = EA_MIN_NON_CUT
   maxKcal (ไม่บังคับ) = เพดานที่ห้ามดันขึ้นไปเกิน — ตอนสร้างแผนคือพลังงานที่ใช้รวมการฝึก (ไม่บังคับให้กินเกินที่ใช้),
   ตอนปรับเป้าคือเป้าเดิม; ไม่ส่ง = ดันถึง minKcal เต็ม ๆ
   minKcal ปัดขึ้นเป็นหลัก 10 kcal (ค่าที่แสดงให้ผู้ใช้เห็น) — blocked = ก่อนดัน kcal ต่ำกว่า minKcal (ไม่ว่าดันได้จริงหรือไม่)
   bmi (ไม่บังคับ, คิดจากน้ำหนักจริง — ตัวเดียวกับที่ recompDeficit ใช้เลือกช่วง) ≥ EA_SKIP_BMI (30) = ข้ามด่านทุกเป้าหมาย:
   FFM ของคน BMI สูงมากจนเกณฑ์ kcal/กก. FFM ดันเป้ากลับเกือบเท่าพลังงานที่ใช้ ทำให้ตาราง deficit ไม่มีผล (ตัวอย่าง BMI 34.6 Recomp หัก 25% → ขาดจริง ~12 kcal)
   พื้นขั้นต่ำตามเพศ 1,500/1,200 ที่ผู้เรียกใส่เองยังอยู่ — ข้ามแล้วคืน {kcal เดิม, blocked:false, skipped:true} (ไม่ดันขึ้น ไม่บล็อกการลด)
   ไม่ส่ง bmi / คิดไม่ได้ = ใช้ด่านตามเดิม
   คืน {kcal, blocked, ea, minKcal, minEA, skipped} โดย ea = EA ของ kcal ที่ส่งเข้ามา (ก่อนดัน)
   คืน null ถ้าข้อมูลไม่ครบ (kcal ว่าง/ไม่ใช่ตัวเลข, FFM ≤ 0) — ไม่คืน 0 หรือผ่านเงียบ ๆ */
function applyEaGuard(kcal, goal, exPerDay, ffmKg, maxKcal, bmi){
  if(kcal==null || kcal==='') return null;
  kcal = Number(kcal);
  if(!isFinite(kcal)) return null;
  var minEA = goal==='ลดไขมัน' ? EA_MIN_CUT : EA_MIN_NON_CUT;
  var raw = minIntakeForEA(minEA, exPerDay, ffmKg);
  var ea = calculateEnergyAvailability(kcal, exPerDay, ffmKg);
  if(raw==null || ea==null) return null;
  var minKcal = Math.ceil(raw/10)*10;
  if(bmi!=null && bmi!=='' && Number(bmi) >= EA_SKIP_BMI) return {kcal: kcal, blocked: false, ea: ea, minKcal: minKcal, minEA: minEA, skipped: true};
  var blocked = kcal < minKcal, out = kcal;
  if(blocked){
    var cap = (maxKcal!=null && maxKcal!=='' && isFinite(Number(maxKcal))) ? Number(maxKcal) : minKcal;
    out = Math.max(kcal, Math.min(minKcal, cap));
  }
  return {kcal: out, blocked: blocked, ea: ea, minKcal: minKcal, minEA: minEA, skipped: false};
}

global.GymBroCalc = {
  calculateBMR: calculateBMR,
  calculateBMRKatchMcArdle: calculateBMRKatchMcArdle,
  calculateBMRForProfile: calculateBMRForProfile,
  calculateBMI: calculateBMI,
  idealBodyWeight: idealBodyWeight,
  referenceWeight: referenceWeight,
  recompDeficit: recompDeficit,
  calculateMacros: calculateMacros,
  calculateTDEE: calculateTDEE,
  calculateFFM: calculateFFM,
  calculateEnergyAvailability: calculateEnergyAvailability,
  minIntakeForEA: minIntakeForEA,
  applyEaGuard: applyEaGuard,
  EA_MIN_CUT: EA_MIN_CUT,
  EA_MIN_NON_CUT: EA_MIN_NON_CUT,
  EA_SKIP_BMI: EA_SKIP_BMI,
  getActivityFactor: getActivityFactor,
  activityFactorFromQ36: activityFactorFromQ36,
  ACTIVITY_FACTORS: ACTIVITY_FACTORS,
  Q36_ACTIVITY_LEVEL: Q36_ACTIVITY_LEVEL
};

})(typeof window!=='undefined' ? window : this);
