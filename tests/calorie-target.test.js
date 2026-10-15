/* Plain-node test for the calorie-target logic that lives in app.js (computeCalorieTarget / computeTargets)
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
var _unused = null;

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

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
