/* สร้าง golden fixtures จากโค้ด JS ตัวจริง (calculations.js, benchmarks.js, generator ใน app.js)
   ให้เทสต์ Kotlin เทียบผลแบบตัวต่อตัว — รันใหม่ทุกครั้งที่แก้สูตรฝั่ง JS
   Run: node android-native/tools/make-golden.js */
"use strict";
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..', '..');
var OUT = path.join(__dirname, '..', 'app', 'src', 'test', 'resources', 'golden');

global.window = global;
require(path.join(ROOT, 'calculations.js'));
require(path.join(ROOT, 'benchmarks.js'));
var C = global.GymBroCalc, B = global.GymBroBenchmark;

/* app.js ผูกกับ DOM/localStorage จึง require ตรงๆ ไม่ได้ — ตัดเฉพาะช่วงที่เป็น logic ล้วนมารันใน vm
   ถ้า marker ไหนหาไม่เจอ ให้ล้มทันที (ดีกว่าได้ golden ผิดแบบเงียบๆ) */
var appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
function slice(startMarker, endMarker){
  var s = appSrc.indexOf(startMarker);
  if(s < 0) throw new Error('marker not found: ' + startMarker);
  var e = appSrc.indexOf(endMarker, s);
  if(e < 0) throw new Error('marker not found: ' + endMarker);
  return appSrc.slice(s, e);
}
var logicSrc = [
  slice('var DAYS = [', 'var BENCH = {'),
  slice('var EXERCISES = [', '/* ---------- state'),
  slice('function numberAnswered(v){', 'function catComplete('),
  slice('function bmiOf(w,h){', 'function kcalOk('),
  slice('function safetyGate(a){', '/* ---------- date helpers'),
  slice('function setCountFor(setsRepsStr){', 'var track = {'),
  slice('function pad2(n){', 'function setCountFor('),
  slice('function logFor(iso){', '/* ---------- เขียน log รายวัน'),
  slice('function dayItems(program, iso){', 'function esc(s){'),
  slice('function fmt1(n){', 'function currentView(){'),
  slice('function lastBestBefore(exId, iso){', '/* ---------- Strength Performance'),
  slice('function milestonesOf(p){', 'function renderProgress(){'),
  'function kcalOk(v, target){ return v!=null && target!=null && v >= target*0.9 && v <= target*1.1; }',
  'var track = {program:null, logs:{}, weights:{}};',
  slice('var CATEGORIES = [', 'var DAYS = ['),
  slice('var BENCH = {', 'var EXERCISES = ['),
  slice('function visibleQsFor(catId){', 'function numberAnswered(v){'),
  slice('function catComplete(catId){', 'function setField('),
  slice('function countAnswered(){', 'function readinessPanel('),
  'function persist(){} function render(){}',
].join('\n');
/* "วันนี้" ของโค้ด JS ถูกล็อกไว้ที่ __today เพื่อให้ผลคงที่ — new Date() ไม่มีอาร์กิวเมนต์คืนเที่ยงวันของ __today */
var RealDate = Date;
class FixedDate extends RealDate {
  constructor(...a){ if(a.length === 0) super(ctx.__today + 'T12:00:00'); else super(...a); }
  static now(){ return new RealDate(ctx.__today + 'T12:00:00').getTime(); }
}
var ctx = {GymBroCalc: C, GymBroBenchmark: B, state: null, Math: Math, JSON: JSON, Date: FixedDate, __today: '2026-10-03'};
vm.createContext(ctx);
vm.runInContext(logicSrc + '\nthis.__api = {inScope:inScope, sanityIssues:sanityIssues, computeTargets:computeTargets,' +
  ' safetyGate:safetyGate, selectionFor:selectionFor, splitFeasibility:splitFeasibility, effectiveSplit:effectiveSplit,' +
  ' assignSessions:assignSessions, weekdayAdjacencyWarning:weekdayAdjacencyWarning, buildPlanSnapshot:buildPlanSnapshot,' +
  ' setCountFor:setCountFor, bmiOf:bmiOf, bmiLabel:bmiLabel, PATTERNS:Object.keys(PATTERN_LABEL),' +
  ' visibleQsFor:visibleQsFor, catComplete:catComplete, countAnswered:countAnswered, countVisibleTotal:countVisibleTotal,' +
  ' setAnswer:setAnswer, QUESTIONS:QUESTIONS,' +
  ' setTrack:function(t){ track = t; }, sessionKeyFor:sessionKeyFor, dayItems:dayItems, dayCounts:dayCounts,' +
  ' dayStatus:dayStatus, streakOf:streakOf, weeklyAdherence:weeklyAdherence, weightSeries:weightSeries,' +
  ' exerciseHistory:exerciseHistory, bodyweightAsOf:bodyweightAsOf, lastBestBefore:lastBestBefore, milestonesOf:milestonesOf,' +
  ' catalog:{EXERCISES:EXERCISES, SPLIT_DEFS:SPLIT_DEFS, EXCLUSION_MAP:EXCLUSION_MAP, EXP_RANK:EXP_RANK, REP_SCHEME:REP_SCHEME,' +
  ' PATTERN_LABEL:PATTERN_LABEL, PATTERN_SHORT:PATTERN_SHORT, TIER_LABEL:TIER_LABEL, TIER_DESC:TIER_DESC,' +
  ' CATEGORIES:CATEGORIES, BENCH:BENCH, Q3_MIN:Q3_MIN, QUESTIONS:QUESTIONS.map(function(q){ return {id:q.id, cat:q.cat,' +
  ' kind:q.kind, main:q.main, label:q.label, options:q.options||[], note:q.note||null, branchFrom:q.branchFrom||null,' +
  ' required:!!q.required, unit:q.unit||null, exclusiveOption:q.exclusiveOption||null}; })}};', ctx);
var A = ctx.__api;

/* สุ่มแบบ deterministic (seed คงที่) ให้ golden เหมือนเดิมทุกครั้งที่รัน */
var seed = 20261003;
function rnd(){ seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; }
function pick(arr){ return arr[Math.floor(rnd() * arr.length)]; }
function maybe(p, v){ return rnd() < p ? v : undefined; }
function subset(arr, p){ return arr.filter(function(){ return rnd() < p; }); }

var DAYS = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
var GOALS = ["ลดไขมัน","เพิ่มกล้ามเนื้อ","Recomposition (ลด+เพิ่มพร้อมกัน)","รักษาสุขภาพทั่วไป","เพิ่มความแข็งแรง-Performance","เดิน-วิ่ง (Cardio)"];
var EXP = ["มือใหม่","เคยออกบ้าง","ออกกำลังกายประจำ","นักกีฬา-เทรนมานาน"];
var HOME_EQUIP = ["ดัมเบล","บาร์เบล","ยางยืด","ม้านั่ง","บาร์โหน","สเต็ปเปอร์","ลูกบอลโยคะ","ลูกกลิ้งบริหารหน้าท้อง","เชือกกระโดด","ฮูลาฮูป","เสื่อโยคะ","ไม่มีอุปกรณ์เลย"];
var INJ = ["หลัง","เข่า","ไหล่","ข้อมือ","หัวใจ-หลอดเลือด","อื่นๆ ระบุ"];
var EX_IDS = ['sq1','sq2','sq3','sq3b','sq4','hg2','hg3','hg4','hp2a','hp3','hp4','hl2','hl4','vl1','vl4','vp3','vp4','co1','co3b','co4','bc2','tc3'];

/* ตัวเลขมาได้หลายรูป เหมือนค่าจริงจากช่อง input: number, string, string มีหน่วยต่อท้าย, ว่าง, ไม่ตอบ
   ส่วนใหญ่ (~85%) เป็นค่าสมจริงในช่วง [lo,hi] ที่เหลือเป็นค่าผิดปกติ/นอกช่วงเพื่อทดสอบ validation */
function numLike(lo, hi, outLo, outHi){
  var realistic = rnd() < 0.85;
  var a = realistic ? lo : (outLo != null ? outLo : lo), b = realistic ? hi : (outHi != null ? outHi : hi);
  var v = Math.round((a + rnd() * (b - a)) * 10) / 10;
  var r = rnd();
  if(r < 0.50) return v;
  if(r < 0.85) return String(v);
  if(r < 0.89) return v + 'kg';
  if(r < 0.93) return '';
  if(r < 0.96) return undefined;
  return String(Math.round(v));
}

function randomAnswers(){
  var a = {
    Q9: maybe(0.95, pick(["ชาย","หญิง"])),
    Q1: maybe(0.95, rnd() < 0.85 ? pick(GOALS.slice(0, 4)) : pick(GOALS)),
    Q4a: maybe(0.7, pick(["เข้มข้น","ค่อยเป็นค่อยไป","ไม่แน่ใจให้ระบบแนะนำ"])),
    Q5b: maybe(0.7, pick(["ได้ (เน้นสร้างกล้ามให้เร็ว)","ไม่ได้ (อยากคุมไขมันไปด้วย)"])),
    Q6: maybe(0.7, pick(["ห่างมาก","ห่างปานกลาง","ใกล้เป้าหมายแล้ว"])),
    Q2: maybe(0.95, subset(DAYS, rnd())),
    Q3: maybe(0.9, pick(["น้อยกว่า 20 นาที","20-45 นาที","45-60 นาที","มากกว่า 60 นาที"])),
    Q10: numLike(15, 75, 0, 110),
    Q11: numLike(145, 200, 80, 260),
    Q12: numLike(40, 160, 10, 320),
    Q13: maybe(0.9, pick(["ระบุ","ยังไม่มีเป้าหมายตัวเลข"])),
    Q13_val: maybe(0.6, numLike(45, 120, 10, 320)),
    Q16: maybe(0.95, pick(EXP)),
    Q20: maybe(0.95, pick(["ที่บ้าน","ฟิตเนส-ยิม","ฟิตเนส-ยิม","กลางแจ้ง-สวนสาธารณะ","ผสมผสาน"])),
    Q21: maybe(0.8, subset(HOME_EQUIP, 0.35)),
    Q22: maybe(0.8, pick(["ครบมาก","ปานกลาง","จำกัด"])),
    Q24: maybe(0.8, pick(["เช้า","บ่าย","เย็น-ค่ำ","ไม่แน่นอนแล้วแต่วัน"])),
    Q25: maybe(0.9, pick(["มี","ไม่มี"])),
    Q26: maybe(0.7, subset(INJ, 0.3)),
    Q28: maybe(0.7, pick(["ได้รับอนุญาตแล้ว","ยังไม่ได้ปรึกษา","ปรึกษาแล้วแต่แพทย์ไม่อนุญาต"])),
    Q31: maybe(0.9, pick(["2 มื้อ","3 มื้อ","4-5 มื้อ","ไม่แน่นอน"])),
    Q36: maybe(0.9, pick(["นั่งโต๊ะเป็นหลัก","ยืน-เดินเยอะ","ใช้แรงงาน"])),
    Q37: numLike(4, 10, 0, 18),
    Q39: maybe(0.6, pick(["ต้องการ","ไม่ต้องการตอนนี้"])),
    Q43: maybe(0.9, pick(["น้อยกว่า 1 ลิตร","1-2 ลิตร","2-3 ลิตร","มากกว่า 3 ลิตร"]))
  };
  Object.keys(a).forEach(function(k){ if(a[k] === undefined) delete a[k]; });
  return a;
}
function randomPlan(){
  var plan = {manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null};
  if(rnd() < 0.3) plan.manualPick[pick(A.PATTERNS)] = pick(EX_IDS);
  if(rnd() < 0.3) plan.unlockedEx[pick(EX_IDS)] = true;
  if(rnd() < 0.3) plan.forceLowTier[pick(A.PATTERNS)] = true;
  if(rnd() < 0.3) plan.splitOverride = pick(['fullbody','ul','ppl','bro','nonexistent']);
  return plan;
}

function plain(x){ return JSON.parse(JSON.stringify(x === undefined ? null : x)); }

/* ---------- generator cases ---------- */
var GENERATOR_CASES = 1500;
var generatorCases = [];
for(var i = 0; i < GENERATOR_CASES; i++){
  var a = randomAnswers();
  var plan = randomPlan();
  var planIn = plain(plan);
  ctx.state = {plan: plan};
  var picks = {};
  A.PATTERNS.forEach(function(p){
    var sel = A.selectionFor(p, a);
    picks[p] = sel.picked ? sel.picked.id : null;
  });
  var feas = A.splitFeasibility(a);
  var split = A.effectiveSplit(a); // อาจเคลียร์ splitOverride ทิ้งถ้าไม่ eligible (side effect เดิมของ JS)
  generatorCases.push({
    answers: a,
    plan: planIn,
    expected: plain({
      inScope: A.inScope(a),
      sanityIssues: A.sanityIssues(a),
      safetyGate: A.safetyGate(a),
      targets: A.computeTargets(a),
      picks: picks,
      splitFeasibility: feas,
      effectiveSplit: split,
      planAfter: plan,
      adjacencyWarning: A.weekdayAdjacencyWarning(a.Q2),
      snapshot: A.buildPlanSnapshot(a)
    })
  });
}

/* ---------- calculations / benchmark cases ---------- */
var calcCases = [];
for(var j = 0; j < 300; j++){
  var w = numLike(-10, 200), h = numLike(-10, 230), age = numLike(-5, 100);
  var sex = pick(['ชาย','หญิง','other',undefined]);
  var q36 = pick(['นั่งโต๊ะเป็นหลัก','ยืน-เดินเยอะ','ใช้แรงงาน','???',undefined]);
  var bmr = C.calculateBMR({weightKg:w, heightCm:h, age:age, sex:sex});
  var f = C.activityFactorFromQ36(q36);
  calcCases.push({
    input: plain({weightKg:w===undefined?null:w, heightCm:h===undefined?null:h, age:age===undefined?null:age, sex:sex===undefined?null:sex, q36:q36===undefined?null:q36}),
    expected: plain({bmr: bmr, factor: f, tdee: C.calculateTDEE({bmr:bmr, activityFactor:f})})
  });
}

var benchCases = [];
for(var k = 0; k < 300; k++){
  var wt = pick([0, -5, 20, 42.5, 60, 100, 140, null]);
  var reps = pick([0, 1, 5, 8, 8.5, 12, 13, 20, null]);
  var bw = pick([0, 55, 80, 120, null]);
  var e1 = B.calculateEstimated1RM(wt, reps);
  var bench = pick([null, 60, 80, 100, 0]);
  var hist = rnd() < 0.2 ? [] : [{date:'2026-07-01', e1rm: pick([0, 50, 70, 76, 90])}, {date:'2026-08-01', e1rm: pick([0, 60, 76, 76.03, 80])}];
  var sets = [];
  var nSets = Math.floor(rnd() * 5);
  for(var s = 0; s < nSets; s++) sets.push(rnd() < 0.15 ? null : {weight: pick([null, 0, 20, 40, 60, 100]), reps: pick([null, 0, 3, 5, 8, 12, 15, 20, 7.5])});
  var perf = B.getPerformanceLevel({e1rmKg: e1, benchmark: bench==null ? null : {benchmarkValueKg: bench}});
  var exercise = pick(['hp4','sq1',null,'bench_press']), vSex = pick(['ชาย','x']);
  benchCases.push({
    input: plain({weight: wt, reps: reps, bodyweight: bw, benchmarkValueKg: bench, history: hist, sets: sets, exercise: exercise, sex: vSex}),
    expected: plain({
      e1rm: e1,
      relativeStrength: B.calculateRelativeStrength(e1, bw),
      performanceLevel: perf.level,
      performanceRatio: perf.ratio === undefined ? null : perf.ratio,
      progress: B.calculatePersonalProgress(e1, hist),
      assessment: B.pickAssessmentSet(sets),
      validation: B.validateBenchmarkInput({weightKg: wt, reps: reps, bodyweightKg: bw, exercise: exercise, sex: vSex})
    })
  });
}

/* ---------- tracking cases (สถานะวัน / สตรีค / % ทำตามแผน / ประวัติท่า / milestone) ---------- */
function isoOf(d){ return d.getFullYear() + '-' + String(d.getMonth()+1).padStart(2,'0') + '-' + String(d.getDate()).padStart(2,'0'); }
var TODAYS = ['2026-10-03', '2026-03-01', '2025-12-31', '2026-02-28', '2026-06-15'];
var TRACKING_CASES = 120;
var trackingCases = [];
for(var t = 0; t < TRACKING_CASES; t++){
  var ta = randomAnswers();
  if(rnd() < 0.9) ta.Q2 = subset(DAYS, 0.5);
  ctx.state = {plan: randomPlan(), answers: ta};
  var program = plain(A.buildPlanSnapshot(ta));
  var today = pick(TODAYS);
  ctx.__today = today;
  var todayD = new RealDate(today + 'T12:00:00');
  var isoOff = function(n){ var d = new RealDate(todayD.getTime()); d.setDate(d.getDate() + n); return isoOf(d); };
  if(rnd() < 0.95) program.startDate = isoOff(-Math.floor(rnd() * 60));
  program.planId = 'p' + t;
  if(rnd() < 0.15) delete program.targets;      // โปรแกรมรุ่นเก่า → targetsOf ใช้ computeTargets(คำตอบ)
  if(rnd() < 0.10) delete program.startWeight;

  var exIds = [];
  program.sessions.forEach(function(s){ s.exercises.forEach(function(e){ if(exIds.indexOf(e.id) < 0) exIds.push(e.id); }); });
  var logs = {}, weights = {};
  for(var off = -70; off <= 3; off++){
    var d = isoOff(off);
    if(rnd() < 0.45){
      var exs = {};
      exIds.concat(['sq1']).forEach(function(id){
        if(rnd() < 0.5) return;
        var sets = [];
        var ns = Math.floor(rnd() * 4);
        for(var k = 0; k < ns; k++) sets.push(rnd() < 0.1 ? null : {weight: pick([null, 0, 10, 22.5, 40, 60, 80, 100]), reps: pick([null, 0, 3, 5, 8, 10, 12, 15])});
        exs[id] = {sets: sets, done: rnd() < 0.6};
      });
      var meals = [];
      var nm = Math.floor(rnd() * 5);
      for(var m = 0; m < nm; m++) meals[m] = pick([true, false, null]);
      logs[d] = {
        date: d, sessionKey: null, planId: program.planId, exercises: exs, completed: rnd() < 0.5,
        nutrition: {proteinG: pick([undefined, null, 50, 120, 180]), kcal: pick([undefined, null, 1500, 2000, 2400, 3000]),
                    waterL: pick([undefined, null, 1, 2.5, 3.5]), meals: meals},
        sleep: {hours: pick([undefined, null, 4, 6.5, 7, 8, 25, -1]), hygiene: rnd() < 0.3},
        updatedAt: '2026-01-01T00:00:00.000Z'
      };
    }
    if(rnd() < 0.3) weights[d] = {date: d, kg: Math.round((55 + rnd() * 50) * 10) / 10};
  }
  logs = plain(logs);
  A.setTrack({program: program, logs: logs, weights: weights});
  var days = [];
  for(var o = -75; o <= 10; o++){
    var di = isoOff(o);
    var c = A.dayCounts(program, di);
    var day = {iso: di, sessionKey: A.sessionKeyFor(program, di), status: A.dayStatus(program, di), done: c.done, total: c.total};
    if(o >= -10 && o <= 0) day.items = A.dayItems(program, di);
    days.push(day);
  }
  var histories = {}, lastBest = {};
  exIds.concat(['sq1']).forEach(function(id){
    histories[id] = A.exerciseHistory(id);
    var q = isoOff(-Math.floor(rnd() * 40));
    lastBest[id] = {iso: q, entry: A.lastBestBefore(id, q)};
  });
  var bwChecks = [isoOff(-80), isoOff(-30), isoOff(0)].map(function(di){ return {iso: di, kg: A.bodyweightAsOf(di)}; });
  trackingCases.push({
    today: today, answers: ta, program: program, logs: logs, weights: weights,
    expected: plain({
      days: days, streak: A.streakOf(program), adherence: A.weeklyAdherence(program, 8),
      weightSeries: A.weightSeries(), histories: histories, lastBest: lastBest, bodyweight: bwChecks,
      milestones: A.milestonesOf(program)
    })
  });
}

/* ---------- questions cases (คำถามที่แสดง / ตอบครบหรือยัง / การกดตัวเลือก) ---------- */
var questionCases = [];
for(var qi = 0; qi < 400; qi++){
  var qa = randomAnswers();
  if(rnd() < 0.3) qa.Q4b = pick(["ระบุตัวเลข", "ยังไม่มีเป้าหมายชัดเจน", ""]);
  if(rnd() < 0.3) qa.Q5a = subset(["อก","หลัง","ขา","ไหล่","แขน","ไม่เน้นส่วนไหนเป็นพิเศษ"], 0.4);
  if(rnd() < 0.3) qa.Q29 = pick(["ทั่วไป","มังสวิรัติ","วีแกน","ฮาลาล"]);
  if(rnd() < 0.2) qa.Q30 = pick(["", "กุ้ง"]);
  var before = plain(qa);
  ctx.state = {plan: randomPlan(), answers: qa};
  var vis = {}, complete = {};
  for(var c = 1; c <= 9; c++){
    vis[c] = A.visibleQsFor(c).map(function(q){ return q.id; });
    complete[c] = A.catComplete(c);
  }
  /* กดตัวเลือกสุ่ม 6 ครั้ง (single/multi) แล้วเก็บคำตอบสุดท้าย */
  var ops = [];
  var choosable = A.QUESTIONS.filter(function(q){ return q.kind === 'single' || q.kind === 'multi'; });
  for(var k = 0; k < 6; k++){
    var q = pick(choosable);
    var val = pick(q.options);
    ops.push({id: q.id, value: val});
    A.setAnswer(q.id, val, q.kind);
  }
  questionCases.push({
    answers: before, ops: ops,
    expected: plain({visible: vis, complete: complete, answered: (ctx.state.answers = before, A.countAnswered()),
      visibleTotal: A.countVisibleTotal(), afterOps: qa})
  });
}

fs.mkdirSync(OUT, {recursive: true});
fs.writeFileSync(path.join(OUT, 'tracking.json'), JSON.stringify(trackingCases));
fs.writeFileSync(path.join(OUT, 'questions.json'), JSON.stringify(questionCases));
fs.writeFileSync(path.join(OUT, 'generator.json'), JSON.stringify(generatorCases));
fs.writeFileSync(path.join(OUT, 'calculations.json'), JSON.stringify(calcCases));
fs.writeFileSync(path.join(OUT, 'benchmarks.json'), JSON.stringify(benchCases));
fs.writeFileSync(path.join(OUT, 'catalog.json'), JSON.stringify([plain(A.catalog)]));
console.log('golden: ' + generatorCases.length + ' generator, ' + calcCases.length + ' calc, ' + benchCases.length + ' benchmark cases -> ' + OUT);
