/* Plain-node test: วันฝึกที่ระบบเลือกให้อัตโนมัติต้องมีวันพักเสมอ และไม่เกินเพดานของแต่ละแบบ (SPLIT_DEFS.maxDays)
   เดิม freeTrainDays ไม่มีเพดาน: PPL/Bro ที่ว่าง 7 วันได้ฝึกครบ 7 วันโดยไม่มีวันพัก, Upper/Lower ได้ 6 วันโดยวนเซสชันซ้ำ
   Run: node tests/train-days.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
var SPLITS = H.plain(H.ev('SPLIT_DEFS'));
var planTrainDays = H.ev('planTrainDays'), bestSchedule = H.ev('bestSchedule'), trainDayBlockMsg = H.ev('trainDayBlockMsg');
var effectiveSplit = H.ev('effectiveSplit'), schedDraftNext = H.ev('schedDraftNext');

function setup(a, split){
  H.setState({answers:a, plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:split || null,
    trainDays:null, cardioDays:[], cardioMinByDay:{}, intensity:{}}});
}
var EXPECT_MAX = {fullbody:3, ul:4, ppl:6, bro:5};

Object.keys(EXPECT_MAX).forEach(function(k){
  test(k+': ว่าง 7 วัน → ฝึกไม่เกิน '+EXPECT_MAX[k]+' วัน มีวันพัก และไม่มีกลุ่มกล้ามเนื้อชนกันวันติดกัน', function(){
    var a = {Q2:DAYS.slice(), Q16:'นักกีฬา-เทรนมานาน'};
    setup(a, k);
    var days = planTrainDays(a);
    assert.ok(days.length <= EXPECT_MAX[k], 'ได้ '+days.length+' วัน');
    assert.ok(days.length < 7, 'ไม่มีวันพัก');
    assert.strictEqual(bestSchedule(SPLITS[k].sessions, days).hard, 0);
  });
});

test('ppl ว่าง 7 วัน → 6 วัน ใช้ Push/Pull/Legs A และ B อย่างละ 1 ครั้ง (ไม่วนซ้ำ)', function(){
  var a = {Q2:DAYS.slice(), Q16:'นักกีฬา-เทรนมานาน'};
  setup(a, 'ppl');
  var used = H.plain(bestSchedule(SPLITS.ppl.sessions, planTrainDays(a)).list.map(function(x){ return x.session; })).sort();
  assert.deepStrictEqual(used, SPLITS.ppl.sessions.map(function(s){ return s.key; }).sort());
});

test('bro ว่าง 7 วัน → แต่ละกลุ่มกล้ามเนื้อ 1 วัน (เดิมขา/หลังโดน 2 วัน)', function(){
  var a = {Q2:DAYS.slice(), Q16:'นักกีฬา-เทรนมานาน'};
  setup(a, 'bro');
  var used = bestSchedule(SPLITS.bro.sessions, planTrainDays(a)).list.map(function(x){ return x.session; });
  assert.strictEqual(used.length, 5);
  assert.strictEqual(new Set(used).size, 5);
});

test('Q19 (อยากฝึกกี่วัน) เป็นเพดานของวันฝึกอัตโนมัติ', function(){
  var a = {Q2:DAYS.slice(), Q16:'ออกกำลังกายประจำ', Q19:'4'};
  setup(a, 'ppl');
  assert.strictEqual(planTrainDays(a).length, 4);
});

test('Q19 น้อยกว่าขั้นต่ำของ Bro → ระบบไม่แนะนำ Bro Split', function(){
  var a = {Q2:DAYS.slice(), Q16:'นักกีฬา-เทรนมานาน', Q19:'3'};
  setup(a, null);
  assert.notStrictEqual(effectiveSplit(a), 'bro');
});

test('Q19 น้อยกว่าขั้นต่ำแต่เลือก Bro เอง → ใช้ขั้นต่ำ 5 วัน (แผนยังสร้างได้)', function(){
  var a = {Q2:DAYS.slice(), Q16:'นักกีฬา-เทรนมานาน', Q19:'3'};
  setup(a, 'bro');
  assert.strictEqual(planTrainDays(a).length, 5);
});

test('เลือกวันเองเกินเพดาน → ถูกห้ามพร้อมข้อความ', function(){
  var msg = trainDayBlockMsg(SPLITS.ppl.sessions, DAYS.slice(0, 6), DAYS[6], 'ppl');
  assert.ok(msg && msg.indexOf('ไม่เกิน 6 วัน') > -1, String(msg));
});

test('แก้วันฝึกของโปรแกรมที่ใช้อยู่ให้เกินเพดาน → บันทึกไม่ได้', function(){
  var a = {Q2:DAYS.slice()};
  setup(a, 'ppl');
  var p = {splitKey:'ppl', splitLabel:'Push / Pull / Legs', days:DAYS.slice(0, 6), availableDays:DAYS.slice(),
    sessions:SPLITS.ppl.sessions.map(function(s){ return {key:s.key, exercises:s.patterns.map(function(pt){ return {pattern:pt.split('@')[0]}; })}; })};
  var res = schedDraftNext(p, {days:DAYS.slice(), cardioDays:[], cardioMinByDay:{}});
  assert.ok(res.error && res.error.indexOf('ไม่เกิน 6 วัน') > -1, JSON.stringify(res.error));
});

console.log('\n'+pass+' passed, '+fail+' failed');
process.exit(fail ? 1 : 0);
