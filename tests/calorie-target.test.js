/* Plain-node test for the calorie-target logic that lives in app.js (computeCalorieTarget / computeTargets / calorieTargetUpdate)
   ใช้ tests/app-harness.js โหลด app.js ทั้งไฟล์ใน vm — ไม่มี dependency, ไม่มี build step
   Run: node tests/calorie-target.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');
var C = global.GymBroCalc;

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
var computeTargets = H.ev('computeTargets'), ffmFromAnswers = H.ev('ffmFromAnswers'), plannedEx = H.ev('plannedExFromAnswers');
var buildSnapshot = H.ev('buildPlanSnapshot'), calorieTargetUpdate = H.ev('calorieTargetUpdate'), calorieTargetBanner = H.ev('calorieTargetBanner');

function plan(extra){
  var p = {manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null, trainDays:DAYS.slice(0, 5)};
  Object.keys(extra || {}).forEach(function(k){ p[k] = extra[k]; });
  return p;
}
/* P4: หญิง 24 ปี ฝึกมา 8 ปี นั่งโต๊ะ TDEE ≈ 1,753 ฝึก 5 วัน เลือกลดไขมัน "เข้มข้น" (ไม่กรอก % ไขมันเอง → FFM ประมาณจาก BMI/อายุ/เพศ) */
function p4(goal, extra){
  var a = {Q9:'หญิง', Q10:24, Q11:162.1, Q12:52, Q16:'นักกีฬา-เทรนมานาน', Q20:'ฟิตเนส-ยิม', Q22:'ครบมาก', Q36:'นั่งโต๊ะเป็นหลัก',
    Q2:DAYS.slice(0, 5), Q3:'45-60 นาที', Q1:goal, Q4a:'เข้มข้น', Q6:'ห่างปานกลาง'};
  Object.keys(extra || {}).forEach(function(k){ a[k] = extra[k]; });
  return a;
}
function eaOf(a, kcal){
  var ffm = ffmFromAnswers(a, parseFloat(a.Q12), a.Q9);
  return C.calculateEnergyAvailability(kcal, plannedEx(a, parseFloat(a.Q12)), ffm.ffm);
}

console.log('P4 — หญิง ฝึก 8 ปี TDEE ~1,753 ลดไขมันแบบเข้มข้น');
test('TDEE is ~1,753 and the intense cut never drops EA below 30 kcal/kg FFM', function(){
  H.setState({plan:plan(), answers:{}});
  var a = p4('ลดไขมัน'), t = computeTargets(a);
  assert.ok(Math.abs(t.tdee - 1753) <= 1, 'tdee '+t.tdee);
  assert.ok(t.kcal >= 1200);
  assert.ok(eaOf(a, t.kcal) >= C.EA_MIN_CUT - 1e-9, 'EA '+eaOf(a, t.kcal));
});
test('maintenance for the same person = TDEE + planned training kcal, not TDEE alone', function(){
  H.setState({plan:plan(), answers:{}});
  var a = p4('รักษาสุขภาพทั่วไป'), t = computeTargets(a), ex = plannedEx(a, 52);
  assert.ok(ex > 0);
  assert.strictEqual(t.kcal, Math.round(t.tdee + ex));
  assert.strictEqual(t.eaLimited, false);
  assert.ok(eaOf(a, t.kcal) >= C.EA_MIN_NON_CUT);
});
test('heavy training load: the cut is pushed UP to the EA minimum, flagged, and explained', function(){
  // cardio ทุกวัน 60 นาที → แคลฝึกสูง → หักตามเปอร์เซ็นต์แล้ว EA ต่ำกว่า 30
  var cd = {}; DAYS.forEach(function(d){ cd[d] = 60; });
  H.setState({plan:plan({trainDays:DAYS.slice(0, 6), cardioDays:DAYS.slice(), cardioMinByDay:cd}), answers:{}});
  // กรอก % ไขมันต่ำ (12%) → FFM สูง → พื้น EA สูงกว่าเป้า 25% ที่คิดได้
  var a = p4('ลดไขมัน', {Q2:DAYS.slice(), Q3:'มากกว่า 60 นาที', Q14:'ทราบ (กรอกตัวเลข)', Q14_val:12}), t = computeTargets(a), ex = plannedEx(a, 52);
  var ffm = ffmFromAnswers(a, 52, 'หญิง').ffm, minKcal = Math.ceil((30*ffm + ex)/10)*10;
  assert.strictEqual(t.eaLimited, true);
  assert.strictEqual(t.kcalFloored, true);
  assert.strictEqual(t.kcal, minKcal);
  assert.ok(eaOf(a, t.kcal) >= C.EA_MIN_CUT - 1e-9);
  assert.ok(/energy availability/.test(t.kcalDirection) && /FFM/.test(t.kcalDirection), t.kcalDirection);
  assert.ok(/ส่วนที่ขาดจริง/.test(t.kcalDirection), 'must say the real deficit is smaller than chosen');
});
test('guard never lowers a target that already passes EA (gain / maintenance stay as computed)', function(){
  H.setState({plan:plan(), answers:{}});
  ['เพิ่มกล้ามเนื้อ', 'รักษาสุขภาพทั่วไป'].forEach(function(g){
    var a = p4(g, {Q5b:'ได้ (เน้นสร้างกล้ามให้เร็ว)'}), t = computeTargets(a);
    assert.strictEqual(t.eaLimited, false, g);
    assert.strictEqual(t.kcalFloored, false, g);
  });
});

console.log('BMI >= 30 — the EA gate is skipped at all three call sites (plan creation / calorieTargetUpdate / pgRecommend)');
/* ชาย 35 ปี 170 ซม. Recomp: น้ำหนัก 86.4 กก. = BMI 29.9, 86.7 = 30.0, 100 = 34.6 */
function man(goal, kg, extra){
  return Object.assign({Q9:'ชาย', Q10:35, Q11:170, Q12:kg, Q16:'นักกีฬา-เทรนมานาน', Q20:'ฟิตเนส-ยิม', Q22:'ครบมาก', Q36:'นั่งโต๊ะเป็นหลัก',
    Q2:DAYS.slice(0, 5), Q3:'45-60 นาที', Q1:goal, Q6:'ห่างปานกลาง', Q5b:'ได้ (เน้นสร้างกล้ามให้เร็ว)', Q37:7}, extra || {});
}
var RECOMP = 'Recomposition (ลด+เพิ่มพร้อมกัน)';
function macrosOk(t){
  assert.ok(t.carbG >= 0, 'carbG '+t.carbG);
  if(!t.macroClamped) assert.ok(Math.abs(t.proteinG*4 + t.fatG*9 + t.carbG*4 - t.kcal) <= 20, 'macros add up to kcal: '+JSON.stringify(t));
  else assert.strictEqual(t.carbG, 0, 'clamped means the target cannot cover protein + fat');
}
test('step 1 (plan creation): BMI 34.6 Recomp gets the table deficit (25%), not an EA push back to ~TDEE', function(){
  H.setState({plan:plan(), answers:{}});
  var a = man(RECOMP, 100), t = computeTargets(a), ex = plannedEx(a, 100), base = t.tdee + Math.round(ex);
  assert.strictEqual(t.eaLimited, false);
  assert.strictEqual(t.kcalFloored, false);
  assert.strictEqual(t.kcal, Math.round(base - Math.min(0.25*base, 800)));
  assert.ok(base - t.kcal >= 500, 'real deficit '+(base - t.kcal));
  assert.ok(!/energy availability/.test(t.kcalDirection), t.kcalDirection);
  assert.ok(t.kcal >= 1500);
  macrosOk(t);
  assert.ok(t.carbG < 250, 'carbs no longer ~323 g: '+t.carbG);
});
test('BMI 29.9 is gated (20% / EA push) but 30.0 is not (25% table, no EA note) — report the cliff', function(){
  H.setState({plan:plan(), answers:{}});
  var lo = computeTargets(man(RECOMP, 86.4)), hi = computeTargets(man(RECOMP, 86.7));
  assert.ok(/BMI 29\.9/.test(lo.kcalDirection) && /หัก 20%/.test(lo.kcalDirection));
  assert.ok(/BMI 30\.0/.test(hi.kcalDirection) && /หัก 25%/.test(hi.kcalDirection));
  assert.strictEqual(lo.eaLimited, true);
  assert.strictEqual(hi.eaLimited, false);
  assert.ok(!/energy availability/.test(hi.kcalDirection));
  assert.ok(lo.kcal > hi.kcal, '29.9 -> '+lo.kcal+' kcal, 30.0 -> '+hi.kcal+' kcal');
  macrosOk(lo); macrosOk(hi);
  console.log('        cliff: BMI 29.9 = '+lo.kcal+' kcal, BMI 30.0 = '+hi.kcal+' kcal (diff '+(lo.kcal - hi.kcal)+')');
});
test('every goal skips the gate at BMI >= 30 (fat loss, maintenance, muscle gain), still gated at 29.9 where it applied before', function(){
  H.setState({plan:plan(), answers:{}});
  ['ลดไขมัน', 'รักษาสุขภาพทั่วไป', 'เพิ่มกล้ามเนื้อ', RECOMP].forEach(function(g){
    var t = computeTargets(man(g, 100, {Q4a:'เข้มข้น'}));
    assert.strictEqual(t.eaLimited, false, g);
    assert.ok(!/energy availability/.test(t.kcalDirection), g);
    macrosOk(t);
  });
});
test('woman, fat loss, BMI 32: no EA push, sex floor 1200 kept; BMI 29.9 woman still gated', function(){
  H.setState({plan:plan(), answers:{}});
  var w = function(kg){ return p4('ลดไขมัน', {Q10:30, Q11:160, Q12:kg}); };
  var t = computeTargets(w(82));        // BMI 32.0
  assert.strictEqual(t.eaLimited, false);
  assert.ok(t.kcal >= 1200);
  assert.ok(!/energy availability/.test(t.kcalDirection));
  macrosOk(t);
  var low = computeTargets(w(76));      // BMI 29.7 → ยังใช้ด่าน: EA ต้องไม่ต่ำกว่า 30
  assert.ok(eaOf(w(76), low.kcal) >= C.EA_MIN_CUT - 1e-9, 'gate still active below BMI 30');
});
test('sex floor still wins when a skipped-gate cut would go below 1500 / 1200', function(){
  H.setState({plan:plan(), answers:{}});
  // ผู้หญิงตัวเล็กแต่ BMI >= 30 (ส่วนสูงน้อย) ฝึกเบา: เป้า 25% อาจต่ำกว่า 1200 → พื้นตามเพศต้องดันขึ้น
  var a = p4('Recomposition (ลด+เพิ่มพร้อมกัน)', {Q10:60, Q11:140, Q12:62, Q36:'นั่งโต๊ะเป็นหลัก', Q2:DAYS.slice(0, 2), Q3:'ต่ำกว่า 30 นาที'});
  H.setState({plan:plan({trainDays:DAYS.slice(0, 2)}), answers:{}});
  var t = computeTargets(a);
  assert.ok(C.calculateBMI(62, 140) >= 30);
  assert.ok(t.kcal >= 1200, 'kcal '+t.kcal);
  macrosOk(t);
});
test('macros stay valid when the skipped-gate target is low: carbG >= 0 and macroClamped reflects an impossible target', function(){
  var m = C.calculateMacros(1100, 100, 100);   // protein 200 g + fat 80 g = 1,520 kcal > 1,100
  assert.ok(m.carbG >= 0);
  assert.strictEqual(m.clamped, true);
  var ok = C.calculateMacros(2000, 100, 100);
  assert.strictEqual(ok.clamped, false);
  assert.ok(ok.carbG > 0);
});
test('step 2 (calorieTargetUpdate): an old plan at BMI 34.6 is offered the table target, never pushed back up by the gate', function(){
  H.setState({plan:plan(), answers:{}});
  var a = man(RECOMP, 100), t = computeTargets(a);
  H.setState({plan:plan(), answers:a});
  var p = H.plain(buildSnapshot(a));
  p.startWeight = 100; p.sex = 'ชาย'; p.goal = RECOMP; p.startDate = '2026-09-01'; p.planId = 'x';
  delete p.calcV; p.targets.kcal = 2700; p.targets.tdee = 2300;          // เป้าเก่าสูง → เสนอลด
  H.setTrack({program:p, logs:{}, weights:{}});
  var u = calorieTargetUpdate(p);
  assert.ok(u, 'offered');
  assert.strictEqual(u.kcal, t.kcal);
  assert.strictEqual(u.eaLimited, false);
  assert.strictEqual(u.floored, false);
  assert.ok(!/energy availability/.test(u.direction), u.direction);
});
test('step 3 (pgRecommend): repeated downward adjustments at BMI >= 30 are not blocked by the gate but never go below the sex floor', function(){
  var a = man(RECOMP, 100);
  H.setState({plan:plan(), answers:a});
  var p = H.plain(buildSnapshot(a));
  p.startWeight = 100; p.sex = 'ชาย'; p.goal = RECOMP; p.startDate = '2026-09-01'; p.planId = 'x';
  p.targets.kcal = 2400;
  H.setTrack({program:p, logs:{}, weights:{}});
  var pgRecommend = H.ev('pgRecommend'), ev = function(){ return {
    energy:{implied:1700, exAct:200}, weight:{level:'anomaly'}, persisted:true, refKg:100,
    plan:{c:-0.6, exPerDay:200}, strength:{level:'ok'}, causes:[], adh:{stressLog:[]}
  }; };
  var seen = [], blocked = 0, kcal = p.targets.kcal;
  for(var i = 0; i < 12; i++){
    p.targets.kcal = kcal;
    var out = pgRecommend(p, ev());
    if(out.eaBlocked) blocked++;
    if(out.kcal == null) break;
    assert.ok(kcal - out.kcal <= 150, 'step '+i+': '+kcal+' -> '+out.kcal);
    assert.ok(out.kcal >= 1500, 'sex floor: '+out.kcal);
    kcal = out.kcal; seen.push(kcal);
  }
  assert.strictEqual(blocked, 0, 'gate must not block at BMI >= 30');
  assert.ok(seen.length >= 3 && seen[seen.length - 1] < 2000, 'keeps lowering past the old EA minimum: '+seen.join(','));
  assert.ok(Math.min.apply(null, seen) >= 1500);
  assert.ok(seen[seen.length - 1] === 1500 || seen.length < 12, 'settles at the floor: '+seen.join(','));
});
test('step 3 control: BMI < 30 is still blocked by the gate (unchanged behaviour)', function(){
  var a = p4('รักษาสุขภาพทั่วไป', {Q12:52});
  H.setState({plan:plan(), answers:a});
  var p = H.plain(buildSnapshot(a)); p.startWeight = 52; p.sex = 'หญิง'; p.goal = 'รักษาสุขภาพทั่วไป'; p.startDate = '2026-09-01'; p.planId = 'x';
  p.targets.kcal = 1600; // ลดเป้าไป ~1450 จะต่ำกว่าพื้น EA 35 kcal/กก. FFM (~1530)
  H.setTrack({program:p, logs:{}, weights:{}});
  var out = H.ev('pgRecommend')(p, {energy:{implied:1500, exAct:200}, weight:{level:'anomaly'}, persisted:true, refKg:52,
    plan:{c:-0.5, exPerDay:200}, strength:{level:'ok'}, causes:[], adh:{stressLog:[]}});
  assert.ok(out.eaBlocked, 'normal-BMI woman is still protected');
});

console.log('calorieTargetUpdate — banner for plans made before the current formula');
/* แผนเก่า: เป้าล็อกด้วยสูตรเก่า (TDEE ล้วน) — สร้าง snapshot ปัจจุบันแล้วลดเป้า/TDEE ลงเป็นของเก่า */
function oldPlan(goal, extraAnswers, mutate){
  H.setState({plan:plan(), answers:{}});
  var a = p4(goal, Object.assign({Q5b:'ได้ (เน้นสร้างกล้ามให้เร็ว)', Q37:7}, extraAnswers || {}));
  H.setState({plan:plan(), answers:a});
  var p = H.plain(buildSnapshot(a));
  p.startWeight = 52; p.sex = 'หญิง'; p.goal = goal; p.startDate = '2026-09-01'; p.planId = 'x';
  p.targets.tdee = 1500; p.targets.kcal = goal==='เพิ่มกล้ามเนื้อ' ? 1800 : 1500; // ค่าเก่า (TDEE ล้วน ตัวคูณกิจกรรมเก่า)
  delete p.calcV;
  if(mutate) mutate(p);
  H.setTrack({program:p, logs:{}, weights:{}});
  return p;
}
test('maintenance / muscle-gain plans on the old formula are offered a HIGHER target', function(){
  ['รักษาสุขภาพทั่วไป', 'เพิ่มกล้ามเนื้อ'].forEach(function(g){
    var p = oldPlan(g), u = calorieTargetUpdate(p);
    assert.ok(u, g);
    assert.ok(u.kcal >= p.targets.kcal + 50, g+' '+u.kcal);
    assert.ok(/เดิมเป้าไม่รวมแคลที่เผาจากการฝึก/.test(calorieTargetBanner(p)), g);
  });
});
test('Recomp plan whose old target was higher is offered a LOWER target with the Recomp wording', function(){
  var p = oldPlan('Recomposition (ลด+เพิ่มพร้อมกัน)', {}, function(q){ q.targets.kcal = 2600; q.targets.tdee = 2200; });
  var u = calorieTargetUpdate(p);
  assert.ok(u && u.kcal < p.targets.kcal - 50, JSON.stringify(u));
  assert.ok(/กินขาดเล็กน้อยเสมอ/.test(calorieTargetBanner(p)));
});
var CALC_VERSION = H.ev('CALC_VERSION');
test('seen flag is tied to the formula version: no flag / legacy boolean / targetFormulaSeenV = current / targetFormulaSeenV = older', function(){
  // 1) ไม่มีธง → เสนอ
  assert.ok(calorieTargetUpdate(oldPlan('รักษาสุขภาพทั่วไป')), 'no flag');
  // 2) ธงบูลีนเก่า (ไม่มี V) = ข้ามไว้ตอนรุ่น 2 → CALC_VERSION > 2 เสนออีกครั้ง
  ['targetFormulaSeen', 'recompTargetSeen', 'calcTargetSeen'].forEach(function(flag){
    var p = oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q[flag] = true; });
    assert.ok(CALC_VERSION > 2);
    assert.ok(calorieTargetUpdate(p), 'legacy '+flag+' must resurface at CALC_VERSION '+CALC_VERSION);
  });
  // 3) targetFormulaSeenV = รุ่นปัจจุบัน → ไม่เสนอ (ไม่ว่าธงบูลีนจะมีหรือไม่)
  assert.strictEqual(calorieTargetUpdate(oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q.targetFormulaSeenV = CALC_VERSION; })), null, 'V = current');
  assert.strictEqual(calorieTargetUpdate(oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q.targetFormulaSeen = true; q.targetFormulaSeenV = CALC_VERSION; })), null, 'V = current + bool');
  // 4) targetFormulaSeenV = รุ่นเก่ากว่า → เสนออีกครั้ง แม้ธงบูลีนเป็น true (ที่เว็บเขียนคู่กันเสมอ)
  assert.ok(calorieTargetUpdate(oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q.targetFormulaSeen = true; q.targetFormulaSeenV = CALC_VERSION - 1; })), 'V = older');
});
test('the calorie-skip handler in app.js stamps both targetFormulaSeen and targetFormulaSeenV = CALC_VERSION', function(){
  // handler อยู่ใน click-dispatcher ที่เรียกผ่าน harness ไม่ได้ — ตรวจที่ซอร์ส (Kotlin ตรวจ CalorieTargetUpdate.skipped ตรง ๆ)
  var src = require('fs').readFileSync(require('path').join(__dirname, '..', 'app.js'), 'utf8');
  var m = /act==='calorie-skip'\)\{([^\n]*)\}/.exec(src);
  assert.ok(m, 'calorie-skip handler not found');
  assert.ok(/targetFormulaSeen\s*=\s*true/.test(m[1]) && /targetFormulaSeenV\s*=\s*CALC_VERSION/.test(m[1]), m[1]);
});
test('plans PG already adjusted, plans stamped with the current formula, and differences < 50 kcal are skipped', function(){
  var adj = oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q.pg = {adjustments:[{date:'2026-10-01', fromKcal:1500, toKcal:1600}]}; });
  assert.strictEqual(calorieTargetUpdate(adj), null);
  var cur = oldPlan('รักษาสุขภาพทั่วไป', {}, function(q){ q.calcV = CALC_VERSION; });
  assert.strictEqual(calorieTargetUpdate(cur), null);
  var p = oldPlan('รักษาสุขภาพทั่วไป'), u = calorieTargetUpdate(p);
  p.targets.kcal = u.kcal + 49;
  assert.strictEqual(calorieTargetUpdate(p), null);
  p.targets.kcal = u.kcal + 50;
  assert.ok(calorieTargetUpdate(p));
});
test('a proposed LOWER target goes through the EA guard (never offered below the EA minimum, never above the old target)', function(){
  // หญิงอายุ 70 ตัวเล็ก รูปร่างผอมมาก (FFM ประมาณสูงเทียบ TDEE) — เป้ารักษาน้ำหนัก = base < EA min 35 → ต้องดันขึ้น
  var extra = {Q10:70, Q11:150, Q12:45, Q0:'10-14', Q2:DAYS.slice(0, 2)};
  H.setState({plan:plan({trainDays:DAYS.slice(0, 2)}), answers:{}});
  var p = oldPlan('รักษาสุขภาพทั่วไป', extra, function(q){ q.targets.kcal = 2400; q.targets.tdee = 2300; q.startWeight = 45; });
  var a = Object.assign({}, p4('รักษาสุขภาพทั่วไป', extra));
  var u = calorieTargetUpdate(p);
  assert.ok(u, 'expected an offer');
  var ex = H.ev('pgPlannedExPerDay')(p, 45), ffm = ffmFromAnswers(a, 45, 'หญิง').ffm;
  assert.ok(u.kcal < 2400);
  assert.ok(u.kcal >= Math.ceil((C.EA_MIN_NON_CUT*ffm + ex)/10)*10 - 1e-9, 'offered '+u.kcal+' below EA min');
  assert.strictEqual(u.eaLimited, true);
  assert.ok(/ไม่ลดต่ำกว่า/.test(u.direction));
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
