/* Plain-node test for EXCLUSION_MAP (F-03): ท่าที่ล็อกตามอาการบาดเจ็บ และผลต่อตัวเลือกท่าในแผน
   Run: node tests/exclusion.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var MAP = H.plain(H.ev('EXCLUSION_MAP'));
var selectionFor = H.ev('selectionFor');
var DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
function answers(inj, extra){
  var a = {Q9:'ชาย', Q10:30, Q11:175, Q12:78, Q16:'นักกีฬา-เทรนมานาน', Q20:'ฟิตเนส-ยิม', Q22:'ครบมาก', Q36:'นั่งโต๊ะเป็นหลัก',
    Q2:DAYS.slice(0, 5), Q3:'45-60 นาที', Q1:'เพิ่มกล้ามเนื้อ', Q25:'มี', Q26:inj};
  Object.keys(extra || {}).forEach(function(k){ a[k] = extra[k]; });
  return a;
}
function pick(slot, a){
  H.setState({plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null, trainDays:DAYS.slice(0, 5)}, answers:a});
  var p = selectionFor(slot, a).picked;
  return p ? p.id : null;
}

test('F-03: ท่าที่เพิ่มอยู่ในรายการล็อกของอาการนั้นจริง', function(){
  var want = {
    'หลัง': ['sq4','hl4','hl3','hg2','vp4','cf4'],
    'ไหล่': ['vp1b','vp1','vp2','tc2','vl3'],
    'ข้อมือ': ['vp1b','tc2','co3b']
  };
  Object.keys(want).forEach(function(inj){
    want[inj].forEach(function(id){ assert.ok(MAP[inj].indexOf(id) > -1, inj+' ควรล็อก '+id); });
  });
});

test('F-03: ทุก id ในรายการมีอยู่ใน EXERCISES และไม่ซ้ำในรายการเดียวกัน', function(){
  var ids = H.plain(H.ev('EXERCISES')).map(function(e){ return e.id; });
  Object.keys(MAP).forEach(function(inj){
    var seen = {};
    MAP[inj].forEach(function(id){
      assert.ok(ids.indexOf(id) > -1, inj+': ไม่มี id '+id);
      assert.ok(!seen[id], inj+': id ซ้ำ '+id);
      seen[id] = 1;
    });
  });
});

test('คนเจ็บหลังระดับนักกีฬา (ยิม) ไม่ได้ Back Squat / Barbell Row / Overhead Press / RDL ดัมเบล', function(){
  var a = answers(['หลัง']);
  ['squat','hinge','hpull','vpush'].forEach(function(slot){
    var id = pick(slot, a);
    assert.ok(['sq4','hg4','hl4','hl3','hg2','vp4'].indexOf(id) < 0, slot+' ได้ '+id);
  });
  assert.notStrictEqual(pick('calf', a), 'cf4');
});

test('คนเจ็บไหล่ฝึกที่บ้าน ไม่ได้ Pike Push-up / Bench Dip', function(){
  var a = answers(['ไหล่'], {Q20:'ที่บ้าน', Q22:null, Q21:['ไม่มีอุปกรณ์เลย']});
  assert.notStrictEqual(pick('vpush', a), 'vp1b');
  assert.notStrictEqual(pick('triceps', a), 'tc2');
});

test('คนเจ็บข้อมือ ไม่ได้ Pike Push-up / Bench Dip / Ab Wheel', function(){
  var a = answers(['ข้อมือ'], {Q20:'ที่บ้าน', Q22:null, Q21:['ไม่มีอุปกรณ์เลย']});
  ['vpush','triceps','core'].forEach(function(slot){
    assert.ok(['vp1b','tc2','co3b'].indexOf(pick(slot, a)) < 0, slot);
  });
});

test('ไม่มีอาการบาดเจ็บ: ผลเลือกท่าไม่เปลี่ยน (นักกีฬา ยิม ได้ Back Squat / Overhead Press)', function(){
  var a = answers([], {Q25:'ไม่มี'});
  assert.strictEqual(pick('squat', a), 'sq4');
  assert.strictEqual(pick('vpush', a), 'vp4');
});

test('บันทึกพฤติกรรมที่ตามมา: คนเจ็บไหล่ไม่เหลือท่า vpush เลย (ล็อกครบ 5 ท่า) จนกว่าจะปลดล็อกเอง', function(){
  var a = answers(['ไหล่']);
  assert.strictEqual(pick('vpush', a), null);
  // ปลดล็อกท่าเดียวแล้วต้องเลือกได้ท่านั้น
  H.setState({plan:{manualPick:{}, unlockedEx:{vp1:true}, forceLowTier:{}, splitOverride:null, trainDays:DAYS.slice(0, 5)}, answers:a});
  var p = selectionFor('vpush', a).picked;
  assert.ok(p && p.id === 'vp1');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
