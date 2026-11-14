/* Plain-node test: แผงสรุปหน้า "วันนี้" (todayStats) — Volume / Sets / Consistency คำนวณจาก log
   Run: node tests/today-stats.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

// 2026-10-15 = วันพฤหัสบดี  สัปดาห์นั้น = จันทร์ 12 ถึง อาทิตย์ 18
var DAYS = H.plain(H.ev('DAYS'));
var MON = DAYS[0], THU = DAYS[3], SAT = DAYS[5];
var program = {
  startDate:'2026-09-01', days:[MON, THU, SAT], dayToSession:{}, equipSteps:{},
  sessions:[{key:'A', exercises:[
    {id:'bench', setsReps:'3 x 5-8', equip:'barbell', pattern:'hpush'},
    {id:'pushup', setsReps:'2 x 10-15', equip:'bodyweight', pattern:'hpush'}
  ]}]
};
program.dayToSession[MON] = 'A'; program.dayToSession[THU] = 'A'; program.dayToSession[SAT] = 'A';
function W(w, r){ return {weight:w, reps:r}; }
function rings(logs, iso){
  H.setTrack({program:program, logs:logs, weights:{}});
  return H.plain(H.ev('todayStats')(program, iso || '2026-10-15'));
}

test('ยังไม่บันทึกอะไร: ค่าเป็นศูนย์ เป้าเซ็ตมาจากแผน ไม่มีเป้า volume', function(){
  var r = rings({});
  assert.deepStrictEqual(r.sets, {value:0, target:5, pct:0});
  assert.deepStrictEqual(r.volume, {value:0, target:null, pct:0});
  assert.deepStrictEqual(r.consist, {value:0, target:3, pct:0});
});

test('volume เทียบกับครั้งล่าสุดของท่าเดียวกัน และนับเฉพาะเซ็ตที่มีน้ำหนัก', function(){
  var r = rings({
    '2026-10-12': {completed:true, exercises:{bench:{sets:[W(60,5), W(60,5), W(60,5)]}, pushup:{sets:[W(null,12), W(null,12)]}}},
    '2026-10-15': {exercises:{bench:{sets:[W(60,5), W(60,4)]}, pushup:{sets:[W(null,12)]}}}
  });
  assert.strictEqual(r.volume.target, 900);
  assert.strictEqual(r.volume.value, 540);
  assert.strictEqual(r.volume.pct, 0.6);
  assert.deepStrictEqual(r.sets, {value:3, target:5, pct:0.6});
  assert.deepStrictEqual(r.groups, [{n:3, done:2}, {n:2, done:1}]);
});

test('เซ็ตเกินแผนไม่ทำให้วงเกิน 100% และ volume เกินครั้งก่อนถูกตรึงที่ 1', function(){
  var r = rings({
    '2026-10-12': {completed:true, exercises:{bench:{sets:[W(60,5)]}}},
    '2026-10-15': {exercises:{bench:{sets:[W(60,5), W(60,5), W(60,5), W(60,5)]}, pushup:{sets:[W(null,10), W(null,10)]}}}
  });
  assert.deepStrictEqual(r.sets, {value:5, target:5, pct:1});
  assert.strictEqual(r.volume.value, 1200);
  assert.strictEqual(r.volume.pct, 1);
});

test('consistency นับเฉพาะวันฝึกที่บันทึกครบในสัปดาห์เดียวกัน', function(){
  var r = rings({
    '2026-10-10': {completed:true, exercises:{}},            // เสาร์สัปดาห์ก่อน — ไม่นับ
    '2026-10-12': {completed:true, exercises:{}},            // จันทร์ — นับ
    '2026-10-13': {completed:true, exercises:{}},            // อังคาร ไม่ใช่วันฝึก — ไม่นับ
    '2026-10-15': {exercises:{bench:{sets:[W(60,5)]}}}       // ยังไม่ครบ — ไม่นับ
  });
  assert.strictEqual(r.consist.value, 1);
  assert.strictEqual(r.consist.target, 3);
  // จ=ครบ, อ=พัก, พ=พัก, พฤ=วันนี้ (ยังไม่ครบ ไม่ถือว่าพลาด), ศ=พัก, ส=ยังไม่ถึง, อา=พัก
  assert.deepStrictEqual(r.week.map(function(d){ return d.done ? 'done' : d.missed ? 'missed' : d.planned ? 'plan' : 'rest'; }),
    ['done','rest','rest','plan','rest','plan','rest']);
  assert.strictEqual(r.week[3].today, true);
});

test('วันฝึกที่ผ่านไปแล้วและไม่ได้บันทึกครบ = พลาด', function(){
  var r = rings({}, '2026-10-17');
  assert.deepStrictEqual(r.week.map(function(d){ return d.missed; }), [true,false,false,true,false,false,false]);
});

test('วันพัก: ไม่มีเป้าเซ็ต/volume แต่ consistency ยังคำนวณ', function(){
  var r = rings({'2026-10-12': {completed:true, exercises:{}}}, '2026-10-14');
  assert.deepStrictEqual(r.sets, {value:0, target:null, pct:0});
  assert.deepStrictEqual(r.volume, {value:0, target:null, pct:0});
  assert.strictEqual(r.consist.value, 1);
});

console.log('\n'+pass+' passed, '+fail+' failed');
if(fail) process.exit(1);
