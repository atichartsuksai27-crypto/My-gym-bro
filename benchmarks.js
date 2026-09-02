/* ============================================================
   Gymbro Daily — Strength Performance Benchmark layer
   ------------------------------------------------------------
   เลเยอร์เสริมที่แยกจาก workout tracking เดิมโดยตั้งใจ (ไฟล์นี้ไม่แก้ Questionnaire,
   Program Generator, Split Picker, Checklist, Workout Logging, Personal Best,
   หรือ Progress ของเดิมเลย — app.js เรียกใช้ function ในไฟล์นี้เป็น "consumer" เท่านั้น)

   ทุกจุดในระบบที่ต้องคำนวณ e1RM / Relative Strength / จับคู่ Benchmark / จัดระดับ
   Performance / Personal Progress ต้องเรียกผ่าน function ในไฟล์นี้เท่านั้น
   ห้ามเขียน logic พวกนี้ซ้ำใน UI แต่ละหน้า

   เปิดเผย API ผ่าน global เดียว: window.GymBroBenchmark
   ============================================================ */
(function(global){
"use strict";

/* ------------------------------------------------------------
   1) Estimated 1RM (e1RM) — สูตร Epley
   e1RM = weightKg × (1 + reps / 30)
   ค่าที่ผู้ใช้บันทึกจริง (weight/reps) ไม่ถูกแก้ไขที่ไหนเลย — e1RM เป็นค่าคำนวณเพิ่ม
   ที่ derive ใหม่จากของจริงทุกครั้งที่ต้องใช้ (ไม่มีการเก็บทับ ไม่มีทางที่ historical
   data จะหายเพราะไปคำนวณค่าเดียวปัจจุบันทับของเก่า)
   ------------------------------------------------------------ */
function calculateEstimated1RM(weightKg, reps){
  weightKg = Number(weightKg);
  reps = Number(reps);
  if(!(weightKg>0)) return null;
  if(!Number.isInteger(reps) || reps<=0) return null; // reps ต้องเป็นจำนวนเต็ม > 0
  return weightKg * (1 + reps/30);
}

/* ------------------------------------------------------------
   2) Relative Strength = e1RM / bodyweight
   ------------------------------------------------------------ */
function calculateRelativeStrength(a, b){
  var e1rmKg, bodyweightKg;
  if(a && typeof a==='object'){ e1rmKg = a.e1rmKg; bodyweightKg = a.bodyweightKg; }
  else { e1rmKg = a; bodyweightKg = b; }
  e1rmKg = Number(e1rmKg);
  bodyweightKg = Number(bodyweightKg);
  if(!(e1rmKg>0) || !(bodyweightKg>0)) return null;
  return e1rmKg / bodyweightKg;
}

/* ------------------------------------------------------------
   ท่าไหนใน EXERCISES (app.js) จับคู่กับ benchmark key ไหน
   แยกออกมาจาก EXERCISES เดิมโดยตั้งใจ (ไม่แก้ array เดิมใน app.js เลย) — เพิ่ม/ลบ
   mapping ได้ที่จุดเดียวนี้โดยไม่กระทบ Program Generator
   เฉพาะท่าหลัก (บาร์เบล/ท่า compound มาตรฐาน) เท่านั้นที่มักมี published strength
   standard ให้เทียบ — ท่าเครื่อง/เคเบิล/ไอโซเลชันไม่ผูก key ไว้ (จะได้ "ยังไม่มี
   Benchmark สำหรับข้อมูลนี้" เสมอ ซึ่งถูกต้องแล้วเพราะไม่มี standard ที่เทียบกันได้จริง)
   ------------------------------------------------------------ */
var EXERCISE_BENCHMARK_KEY = {
  sq4: 'back_squat',      // Barbell Back Squat
  hg4: 'deadlift',        // Barbell Deadlift
  hp4: 'bench_press',     // Barbell Bench Press
  vp4: 'overhead_press',  // Barbell Overhead Press
  hl4: 'barbell_row',     // Barbell Bent-over Row
  vl4: 'pull_up'          // Pull-up (bodyweight แต่ standard วัดคนละแบบ — reps/added weight)
};
function resolveBenchmarkKey(exercise){
  if(exercise==null || exercise==='') return null;
  return Object.prototype.hasOwnProperty.call(EXERCISE_BENCHMARK_KEY, exercise)
    ? EXERCISE_BENCHMARK_KEY[exercise]
    : exercise; // เผื่อเรียกด้วย benchmark key ตรงๆ (เช่นตอนเทส หรือจาก dataset ภายนอกที่ import มาแล้ว)
}

/* ------------------------------------------------------------
   3) Benchmark dataset — เว้นว่างไว้โดยตั้งใจ
   ค้นใน codebase แล้ว (grep "benchmark" ทั้งโปรเจกต์) ไม่พบตัวเลข strength standard
   อยู่ที่ไหนเลย จึง "ห้ามเดาตัวเลขมาตรฐานขึ้นมาเอง" ตามที่สั่ง — array นี้จึงว่าง
   จนกว่าจะมี dataset ที่มี source ตรวจสอบได้จริงมาใส่ (เช่นจากเทรนเนอร์/งานวิจัยที่
   อ้างอิงได้) ระบบทั้งหมด (getStrengthBenchmark ฯลฯ) ออกแบบให้ทำงานถูกต้องทันทีที่
   array นี้มีข้อมูล โดยไม่ต้องแก้โค้ดที่อื่นเลย

   schema ของแต่ละ entry (ทุก field จำเป็น ยกเว้น sourceUrl):
   {
     exerciseId: string,        // ตรงกับ key ฝั่งขวาใน EXERCISE_BENCHMARK_KEY เช่น 'bench_press'
     sex: 'ชาย' | 'หญิง',        // ใช้ค่าเดียวกับคำตอบ Q9 ในแบบสอบถามตรงๆ (ไม่แปลภาษา
                                 // เพื่อลดจุดเสี่ยง bug จากการ map ค่าไปมา)
     bodyweightMinKg: Number,   // ช่วงน้ำหนักตัว (kg) — inclusive ทั้งสองด้าน
     bodyweightMaxKg: Number,
     experienceLevel: 'มือใหม่' | 'เคยออกบ้าง' | 'ออกกำลังกายประจำ' | 'นักกีฬา-เทรนมานาน', // ใช้ค่าเดียวกับ Q16
     benchmarkLevel: string,    // ป้ายกำกับของ entry นี้ในชุด standard ต้นทาง (เช่น "intermediate")
                                 // เก็บไว้เพื่อสืบย้อนกลับไป source เท่านั้น ไม่ใช่ตัวตัดสิน
                                 // performance level ที่แสดงผลให้ผู้ใช้
     benchmarkValueKg: Number,  // ค่ามาตรฐาน e1RM ของกลุ่มนี้ (kg)
     unit: 'kg',
     benchmarkSource: string,   // ประเภทของแหล่งข้อมูล เช่น 'published-standard' | 'internal-testing'
     sourceName: string,        // ชื่อแหล่งอ้างอิงแบบเต็ม (ต้องระบุเสมอ ตรวจสอบย้อนกลับได้)
     sourceUrl: string|null,    // ลิงก์อ้างอิง ถ้ามี
     lastUpdated: string        // 'YYYY-MM-DD'
   }
   ------------------------------------------------------------ */
var BENCHMARK_DATASET = [];

/* แถบเปอร์เซ็นต์สำหรับแปลง ratio (ค่าผู้ใช้ / benchmark.e1rmKg) เป็นระดับ 4 ขั้น
   นี่คือค่าตั้งต้นด้าน UX ของ "ระยะห่างจาก benchmark" เท่านั้น ไม่ใช่ตัวเลขจาก source
   งานวิจัยใดๆ — ตัวเลขที่ต้องมี source คือ benchmark.e1rmKg เพียงอย่างเดียว (ดู
   benchmarkSource/sourceName/sourceUrl ข้างบน) ปรับแถบนี้ได้ที่จุดเดียวนี้จุดเดียว */
var PERFORMANCE_BAND = { belowMax: 0.90, nearMax: 1.10, aboveMax: 1.50 };

/* ระดับผลลัพธ์ (PART 10) — ใช้ enum ชุดนี้ชุดเดียวทั้งระบบ
   ถ้อยคำเป็นกลาง ไม่มีคำว่าเก่ง/ไม่เก่ง และทุกระดับมีข้อความกำกับคู่กับสีเสมอ
   (PART 15: ห้ามสื่อความหมายด้วยสีอย่างเดียว) */
var PERFORMANCE_LEVEL = {
  LOWER_THAN_BENCHMARK: 'LOWER_THAN_BENCHMARK',
  NEAR_BENCHMARK: 'NEAR_BENCHMARK',
  ABOVE_BENCHMARK: 'ABOVE_BENCHMARK',
  ADVANCED: 'ADVANCED',
  NO_BENCHMARK: 'NO_BENCHMARK',
  INSUFFICIENT_DATA: 'INSUFFICIENT_DATA'
};
var PERFORMANCE_PRESENTATION = {
  LOWER_THAN_BENCHMARK: {label:'ต่ำกว่า Benchmark',   icon:'🔴', cssClass:'below'},
  NEAR_BENCHMARK:       {label:'ใกล้เคียง Benchmark', icon:'🟡', cssClass:'near'},
  ABOVE_BENCHMARK:      {label:'สูงกว่า Benchmark',   icon:'🟢', cssClass:'above'},
  ADVANCED:             {label:'ระดับ Advanced',      icon:'🟣', cssClass:'advanced'},
  NO_BENCHMARK:         {label:'ยังไม่มี Benchmark สำหรับข้อมูลนี้', icon:'⚪', cssClass:'none'},
  INSUFFICIENT_DATA:    {label:'ข้อมูลไม่ครบสำหรับประเมิน Performance', icon:'⚪', cssClass:'none'}
};

/* ------------------------------------------------------------
   getStrengthBenchmark — หา benchmark entry ที่ตรงกับผู้ใช้ที่สุด
   ต้องมีครบ: exercise ที่รู้จัก (ผ่าน EXERCISE_BENCHMARK_KEY หรือ key ตรงๆ),
   sex, bodyweightKg > 0, experience — ถ้าขาดอย่างใดอย่างหนึ่ง หรือไม่มี entry ที่
   bodyweight ตกอยู่ใน range คืน null (ห้ามเดา/ห้ามใช้ entry ใกล้เคียงแทน)
   ------------------------------------------------------------ */
function getStrengthBenchmark(params){
  params = params || {};
  var key = resolveBenchmarkKey(params.exercise != null ? params.exercise : params.exerciseId);
  var bw = Number(params.bodyweightKg);
  var experience = params.experience != null ? params.experience : params.experienceLevel;
  if(!key) return null;
  if(params.sex!=='ชาย' && params.sex!=='หญิง') return null;
  if(!(bw>0)) return null;
  if(!experience) return null;
  var rows = BENCHMARK_DATASET.filter(function(b){
    return b.exerciseId===key && b.sex===params.sex && b.experienceLevel===experience &&
      bw>=Number(b.bodyweightMinKg) && bw<=Number(b.bodyweightMaxKg);
  });
  return rows.length ? rows[0] : null;
}

/* ------------------------------------------------------------
   4) getPerformanceLevel — จัดระดับ e1RM ของผู้ใช้เทียบกับ benchmark (PART 10)
   รับได้ 2 แบบ:
     - ส่ง benchmark ที่หามาแล้วเข้ามาเอง: {e1rmKg, benchmark}
     - ส่งข้อมูลผู้ใช้ให้ไปหา benchmark เอง: {exercise, sex, bodyweightKg, experience,
       e1rmKg, relativeStrength}
   ไม่มี benchmark ที่ match -> level NO_BENCHMARK เสมอ ห้ามตกไปเป็น LOWER_THAN_BENCHMARK
   ------------------------------------------------------------ */
function getPerformanceLevel(input){
  input = input || {};
  var e1rmKg = Number(input.e1rmKg);
  function present(levelKey, extra){
    var p = PERFORMANCE_PRESENTATION[levelKey];
    var out = {
      level: levelKey,
      label: p.label,
      icon: p.icon,
      cssClass: p.cssClass,
      hasBenchmark: levelKey!==PERFORMANCE_LEVEL.NO_BENCHMARK && levelKey!==PERFORMANCE_LEVEL.INSUFFICIENT_DATA
    };
    if(extra) Object.keys(extra).forEach(function(k){ out[k]=extra[k]; });
    return out;
  }
  if(!(e1rmKg>0)) return present(PERFORMANCE_LEVEL.INSUFFICIENT_DATA);

  var benchmark = input.benchmark;
  if(benchmark===undefined){
    // ไม่ได้ส่ง benchmark มา -> หาให้จากข้อมูลผู้ใช้ (single lookup path เดียวกับข้างบน)
    benchmark = getStrengthBenchmark({
      exercise: input.exercise != null ? input.exercise : input.exerciseId,
      sex: input.sex,
      bodyweightKg: input.bodyweightKg,
      experience: input.experience != null ? input.experience : input.experienceLevel
    });
  }
  if(!benchmark) return present(PERFORMANCE_LEVEL.NO_BENCHMARK);

  var ratio = e1rmKg / Number(benchmark.benchmarkValueKg);
  if(!(ratio>0)) return present(PERFORMANCE_LEVEL.NO_BENCHMARK); // benchmark เสีย/ไม่มีตัวเลข = ถือว่าไม่มี
  var levelKey;
  if(ratio < PERFORMANCE_BAND.belowMax) levelKey = PERFORMANCE_LEVEL.LOWER_THAN_BENCHMARK;
  else if(ratio <= PERFORMANCE_BAND.nearMax) levelKey = PERFORMANCE_LEVEL.NEAR_BENCHMARK;
  else if(ratio <= PERFORMANCE_BAND.aboveMax) levelKey = PERFORMANCE_LEVEL.ABOVE_BENCHMARK;
  else levelKey = PERFORMANCE_LEVEL.ADVANCED;
  return present(levelKey, {ratio: ratio, benchmark: benchmark});
}

/* ------------------------------------------------------------
   5) getPersonalProgress — เทียบกับ performance เดิมของผู้ใช้คนเดียวกัน (คนละเรื่อง
   กับ benchmark โดยสิ้นเชิง ห้ามปนกัน — ดูคอมเมนต์บนสุดของไฟล์)
   baseline เริ่มต้น = รายการ e1RM ล่าสุดก่อนหน้ารายการปัจจุบัน (เทียบกับ "ครั้งก่อน")
   ระบุ opts.baselineEntry เองได้ถ้าต้องการเทียบกับช่วงอื่น (เช่นเมื่อ ~30 วันก่อน)
   historyEntries: [{date, e1rm}, ...] เรียงวันที่เก่า->ใหม่ (ใช้ผลจาก exerciseHistory()
   ของ app.js ได้ตรงๆ)
   ------------------------------------------------------------ */
function calculatePersonalProgress(currentE1rm, historyEntries, opts){
  opts = opts || {};
  currentE1rm = Number(currentE1rm);
  if(!(currentE1rm>0) || !Array.isArray(historyEntries) || !historyEntries.length) return null;
  var baselineEntry = opts.baselineEntry || historyEntries[historyEntries.length-1];
  var baseline = baselineEntry ? Number(baselineEntry.e1rm) : NaN;
  if(!(baseline>0)) return null;
  var deltaKg = currentE1rm - baseline;
  var deltaPct = (deltaKg/baseline)*100;
  return {
    baselineDate: baselineEntry.date,
    baselineE1rm: Math.round(baseline*10)/10,
    currentE1rm: Math.round(currentE1rm*10)/10,
    deltaKg: Math.round(deltaKg*10)/10,
    deltaPct: Math.round(deltaPct*10)/10,
    // ค่าดิบไม่ปัดเศษ เก็บไว้ให้ผู้เรียกที่ต้องการความละเอียด (ปัดเศษเฉพาะตอนแสดงผล)
    deltaKgRaw: deltaKg,
    deltaPctRaw: deltaPct,
    direction: deltaKg>0.05 ? 'up' : (deltaKg<-0.05 ? 'down' : 'flat')
  };
}

/* ------------------------------------------------------------
   6) pickAssessmentSet — อย่าประเมินจาก set เดียวแบบมั่วๆ
   ให้เซ็ตที่ reps อยู่ในช่วง 1-12 ครั้ง (สูตร Epley แม่นสุดในช่วงนี้) ที่ e1RM สูงสุด
   เป็นตัวแทนของวันนั้น ถ้าทุกเซ็ตที่บันทึกไว้ reps>12 หมด (ไม่มีเซ็ตในช่วงที่แม่นยำเลย)
   ยังคำนวณให้แต่ติด lowConfidence:true เพื่อให้ UI เตือนผู้ใช้แทนที่จะซ่อนไปเฉยๆ
   sets: [{weight, reps}, ...] ของ exercise เดียวในวันเดียว (null/ค่าไม่ครบข้ามได้)
   ------------------------------------------------------------ */
var RELIABLE_REP_MAX = 12;
function pickAssessmentSet(sets){
  var valid = (sets||[]).map(function(s){
    if(!s) return null;
    var e1 = calculateEstimated1RM(s.weight, s.reps);
    if(e1==null) return null;
    return {weight:Number(s.weight), reps:Number(s.reps), e1rm:e1};
  }).filter(Boolean);
  if(!valid.length) return null;
  var reliable = valid.filter(function(v){ return v.reps<=RELIABLE_REP_MAX; });
  var pool = reliable.length ? reliable : valid;
  var best = pool.reduce(function(a,b){ return b.e1rm>a.e1rm ? b : a; });
  return {weight:best.weight, reps:best.reps, e1rm:best.e1rm, lowConfidence: best.reps>RELIABLE_REP_MAX};
}

/* ------------------------------------------------------------
   7) Data integrity — ใช้ตรวจก่อนเรียก getStrengthBenchmark จาก UI ได้ (ไม่บังคับ
   เพราะ getStrengthBenchmark เองก็ปฏิเสธข้อมูลไม่ครบอยู่แล้ว แต่เผื่อ UI อยากเช็คก่อน
   เพื่อโชว์ข้อความที่ต่างกันไปตามจุดที่ขาด)
   ------------------------------------------------------------ */
function validateBenchmarkInput(params){
  params = params || {};
  var issues = [];
  if(!(Number(params.weightKg)>0)) issues.push('weight ต้องมากกว่า 0');
  if(!Number.isInteger(Number(params.reps)) || Number(params.reps)<=0) issues.push('reps ต้องเป็นจำนวนเต็มมากกว่า 0');
  if(!(Number(params.bodyweightKg)>0)) issues.push('bodyweight ต้องมากกว่า 0');
  if(!resolveBenchmarkKey(params.exercise)) issues.push('exercise ไม่รู้จักในระบบ');
  if(params.sex!=='ชาย' && params.sex!=='หญิง') issues.push('ต้องมีข้อมูลเพศก่อนใช้ benchmark');
  return {valid: issues.length===0, issues: issues};
}

global.GymBroBenchmark = {
  calculateEstimated1RM: calculateEstimated1RM,
  calculateRelativeStrength: calculateRelativeStrength,
  getStrengthBenchmark: getStrengthBenchmark,
  getPerformanceLevel: getPerformanceLevel,
  calculatePersonalProgress: calculatePersonalProgress,
  getPersonalProgress: calculatePersonalProgress, // ชื่อเดิม เก็บไว้เพื่อความเข้ากันได้
  pickAssessmentSet: pickAssessmentSet,
  resolveBenchmarkKey: resolveBenchmarkKey,
  validateBenchmarkInput: validateBenchmarkInput,
  EXERCISE_BENCHMARK_KEY: EXERCISE_BENCHMARK_KEY,
  BENCHMARK_DATASET: BENCHMARK_DATASET,
  PERFORMANCE_BAND: PERFORMANCE_BAND,
  PERFORMANCE_LEVEL: PERFORMANCE_LEVEL,
  PERFORMANCE_PRESENTATION: PERFORMANCE_PRESENTATION
};

})(typeof window!=='undefined' ? window : this);
