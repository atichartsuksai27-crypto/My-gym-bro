/* Plain-node test for the exercise library (คลังท่า) in app.js — LIBRARY_ALL / libraryGuideFor / libraryCautionsFor
   เทียบกับ android-native/.../domain/LibraryCatalog.kt (แหล่งข้อมูลต้นทาง) และยืนยันว่าตัวสร้างตารางไม่เห็นท่าเสริม
   Run: node tests/library.test.js */
"use strict";
var assert = require('assert');
var fs = require('fs');
var path = require('path');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var EXERCISES = H.plain(H.ev('EXERCISES'));
var ALL = H.plain(H.ev('LIBRARY_ALL'));
var EXTRA = H.plain(H.ev('LIBRARY_EXTRA'));
var RAW = H.plain(H.ev('LIBRARY_RAW_EXTRA'));
var ORDER = H.plain(H.ev('LIBRARY_GROUP_ORDER'));
var GROUP_LABEL = H.plain(H.ev('LIBRARY_GROUP_LABEL'));
var guideFor = H.ev('libraryGuideFor'), cautionsFor = H.ev('libraryCautionsFor'), byId = H.ev('libraryById');
var isLibraryOnly = H.ev('isLibraryOnly'), matches = H.ev('libraryMatches'), grouped = H.ev('libraryGrouped');
var isTimeBased = H.ev('libraryIsTimeBased'), defaultSetsReps = H.ev('libraryDefaultSetsReps');

var KT = fs.readFileSync(path.join(__dirname, '..', 'android-native/app/src/main/java/com/gymbrodaily/nativeapp/domain/LibraryCatalog.kt'), 'utf8');
var S = '"((?:[^"\\\\]|\\\\.)*)"';

test('ALL = 147 ท่า = EXERCISES 93 + ท่าเสริม 54 (จาก RAW 77 ตัดชื่อซ้ำ 23)', function(){
  assert.strictEqual(EXERCISES.length, 93);
  assert.strictEqual(RAW.length, 77);
  assert.strictEqual(EXTRA.length, 54);
  assert.strictEqual(ALL.length, 147);
});

test('ท่าเสริมไม่มีชื่อซ้ำกับ EXERCISES (ไม่สนตัวพิมพ์) และท่าที่ถูกตัดทั้ง 23 ท่าชื่อซ้ำจริง', function(){
  var names = EXERCISES.map(function(e){ return e.th.toLowerCase(); });
  EXTRA.forEach(function(x){ assert.ok(names.indexOf(x.th.toLowerCase()) < 0, x.id+' '+x.th); });
  var dropped = RAW.filter(function(x){ return !EXTRA.some(function(y){ return y.id === x.id; }); });
  assert.strictEqual(dropped.length, 23);
  dropped.forEach(function(x){ assert.ok(names.indexOf(x.th.toLowerCase()) > -1, x.id+' '+x.th); });
});

test('id ไม่ซ้ำกันทั้งคลัง และท่าเสริมขึ้นต้นด้วย x', function(){
  var seen = {};
  ALL.forEach(function(e){ assert.ok(!seen[e.id], 'dup '+e.id); seen[e.id] = 1; });
  EXTRA.forEach(function(e){ assert.ok(/^x/.test(e.id), e.id); assert.ok(isLibraryOnly(e.id)); });
  EXERCISES.forEach(function(e){ assert.ok(!isLibraryOnly(e.id), e.id); });
});

test('RAW_EXTRA ตรงกับ LibraryCatalog.kt ทุกฟิลด์ (ตรงตัวอักษร)', function(){
  var re = new RegExp('x\\('+S+', '+S+', (\\d), '+S+', '+S+', '+S+'\\)', 'g'), m, kt = [];
  while((m = re.exec(KT))) kt.push({id:m[1], pattern:m[2], tier:+m[3], equip:m[4], th:m[5], sub:m[6]});
  assert.deepStrictEqual(RAW, kt);
});

test('ตารางความเสี่ยงตรงกับ LibraryCatalog.kt', function(){
  var re = new RegExp(S+' to \\((\\d) to '+S+'\\)', 'g'), m, n = 0, unreachable = 0;
  while((m = re.exec(KT))){
    n++;
    var e = byId(m[1]);
    // RISK มี id ของท่าเสริมที่ถูกตัดเพราะชื่อซ้ำ (เช่น xhp8) — ใน Kotlin ก็เข้าไม่ถึงเหมือนกัน
    if(!e){ assert.ok(RAW.some(function(x){ return x.id === m[1]; }) && !isLibraryOnly(m[1]), 'unknown id in RISK: '+m[1]); unreachable++; continue; }
    var g = guideFor(e);
    assert.strictEqual(g.risk, +m[2], m[1]);
    assert.strictEqual(g.why, m[3], m[1]);
  }
  assert.strictEqual(n, Object.keys(H.ev('LIBRARY_RISK')).length);
  console.log('        (RISK '+n+' รายการ, เป็นท่าเสริมที่ถูกตัดซ้ำ '+unreachable+')');
});

test('21 กลุ่ม ลำดับ = PATTERN_ORDER + biceps/triceps/delts/calves/cardio (ไม่ซ้ำ) ทุกกลุ่มมีท่าและมีชื่อ', function(){
  assert.strictEqual(ORDER.length, 21);
  assert.deepStrictEqual(ORDER.slice(0, 18), Object.keys(H.plain(H.ev('PATTERN_LABEL'))));
  assert.deepStrictEqual(ORDER.slice(18), ['delts', 'calves', 'cardio']);
  ORDER.forEach(function(g){
    assert.ok(GROUP_LABEL[g], 'label '+g);
    assert.ok(ALL.some(function(e){ return e.pattern === g; }), 'empty '+g);
  });
  ALL.forEach(function(e){ assert.ok(ORDER.indexOf(e.pattern) > -1, e.id+' '+e.pattern); });
});

test('จำนวนท่าต่อกลุ่มตรงกับ exercise-library.md', function(){
  var want = {'Squat Pattern':15, 'Lunge':6, 'Hinge Pattern':10, 'Glute':7, 'Leg Curl':6, 'Calf':6, 'Horizontal Push':7,
    'Incline Push':5, 'Chest Fly':4, 'Vertical Push':7, 'Lateral Raise':4, 'Rear Delt':4, 'Horizontal Pull':9, 'Vertical Pull':9,
    'Core':11, 'Oblique':5, 'Biceps':10, 'Triceps':9, 'Delts & Traps':4, 'Calves':2, 'Cardio':7};
  var got = {};
  ORDER.forEach(function(g){ got[GROUP_LABEL[g].split(' — ')[0]] = ALL.filter(function(e){ return e.pattern === g; }).length; });
  assert.deepStrictEqual(got, want);
});

test('guideFor: sq4 เสี่ยงสูง, vl4 เสี่ยงปานกลาง, sq1 เสี่ยงต่ำ (why ว่าง)', function(){
  var g = guideFor(byId('sq4'));
  assert.strictEqual(g.risk, 2); assert.strictEqual(g.riskLabel, 'เสี่ยงสูง');
  assert.strictEqual(g.suits, 'สำหรับผู้ฝึกขั้นสูง ควรมีเทรนเนอร์หรือคนช่วยดูแลตอนเริ่มทำ');
  assert.deepStrictEqual(H.plain(g.tips), ['บาร์เบลน้ำหนักหนัก ควรมีคนช่วยสปอตหรือตั้งเซฟตี้บาร์ก่อนเริ่มเซ็ต',
    'ให้เข่าชี้ไปทางเดียวกับปลายเท้า และไม่ปล่อยเข่าบิดเข้าด้านใน']);
  g = guideFor(byId('vl4'));
  assert.strictEqual(g.risk, 1); assert.strictEqual(g.riskLabel, 'เสี่ยงปานกลาง');
  assert.strictEqual(g.why, 'ต้องรับน้ำหนักตัวทั้งหมด ไหล่และข้อศอกรับแรงมาก ไม่เหมาะกับคนที่ยังดึงน้ำหนักตัวไม่ไหว');
  g = guideFor(byId('sq1'));
  assert.strictEqual(g.risk, 0); assert.strictEqual(g.riskLabel, 'เสี่ยงต่ำ'); assert.strictEqual(g.why, '');
  assert.strictEqual(g.suits, 'เหมาะกับมือใหม่ หรือคนที่กลับมาออกกำลังกายหลังหยุดไปนาน');
});

test('guideFor: tips ตัดค่าที่ไม่มี (stepper/yogaball/abroller ไม่มี tip อุปกรณ์, glute ไม่มี tip กลุ่ม)', function(){
  assert.deepStrictEqual(H.plain(guideFor(byId('hg3b')).tips), []);              // yogaball + glute
  assert.deepStrictEqual(H.plain(guideFor(byId('sq3b')).tips), ['ให้เข่าชี้ไปทางเดียวกับปลายเท้า และไม่ปล่อยเข่าบิดเข้าด้านใน']); // stepper + squat
  assert.strictEqual(guideFor(byId('xcd7')).tips.length, 2);
});

test('cautionsFor: ท่าเดิมใช้ EXCLUSION_MAP, ท่าเสริมใช้ EXTRA_CAUTION', function(){
  assert.deepStrictEqual(H.plain(cautionsFor('sq4')), ['เข่า', 'หลัง', 'หัวใจ-หลอดเลือด']); // F-03: เพิ่ม 'หลัง'
  assert.deepStrictEqual(H.plain(cautionsFor('bc4')), ['หลัง', 'ข้อมือ', 'หัวใจ-หลอดเลือด']);
  assert.deepStrictEqual(H.plain(cautionsFor('sq1')), []);
  assert.deepStrictEqual(H.plain(cautionsFor('xcd7')), ['เข่า', 'ไหล่', 'หลัง', 'ข้อมือ', 'หัวใจ-หลอดเลือด']);
  assert.deepStrictEqual(H.plain(cautionsFor('xhg7')), ['หลัง', 'ข้อมือ', 'หัวใจ-หลอดเลือด']);
  assert.deepStrictEqual(H.plain(cautionsFor('xsq1')), []);
});

test('isTimeBased / defaultSetsReps', function(){
  assert.strictEqual(isTimeBased(byId('co1')), true);   // timed เดิม
  assert.strictEqual(isTimeBased(byId('co3b')), false); // core เดิมที่ไม่ timed
  assert.strictEqual(isTimeBased(byId('xsq1')), true);  // Wall Sit
  assert.ok(byId("xco2") && byId("xco2").pattern === "core"); assert.strictEqual(isTimeBased(byId("xco2")), true); // core ท่าเสริม = จับเวลา
  assert.strictEqual(byId("xco3"), null); // Side Plank ซ้ำกับ ob1 จึงถูกตัด
  assert.strictEqual(defaultSetsReps(byId('xcd1'), 'ลดไขมัน'), '3 x 60 วิ');
  assert.strictEqual(defaultSetsReps(byId('co1'), 'เพิ่มกล้ามเนื้อ'), '3 x 30-45 วิ');
  assert.strictEqual(defaultSetsReps(byId('sq2'), 'เพิ่มกล้ามเนื้อ'), '3-4 x 8-12');
  assert.strictEqual(defaultSetsReps(byId('sq2'), null), '3 x 10-12');
});

test('ค้นหา: contains ไม่สนตัวพิมพ์ ใน 4 ฟิลด์ / ช่องว่างล้วน = ไม่กรอง', function(){
  assert.ok(matches(byId('sq4'), '  barbell BACK '));        // th
  assert.ok(matches(byId('sq4'), 'สควอทบาร์'));               // sub
  assert.ok(matches(byId('sq4'), 'ต้นขาหน้า'));               // GROUP_LABEL
  assert.ok(matches(byId('sq4'), 'บาร์เบล'));                 // EQUIP_LABEL
  assert.ok(matches(byId('sq4'), '   '));
  assert.ok(!matches(byId('sq1'), 'ดัมเบล'));
});

test('จัดกลุ่ม: ตามลำดับกลุ่ม เรียงตาม tier ในกลุ่ม', function(){
  var gs = H.plain(grouped(ALL));
  assert.deepStrictEqual(gs.map(function(x){ return x.g; }), ORDER);
  gs.forEach(function(x){ for(var i=1; i<x.items.length; i++) assert.ok(x.items[i-1].tier <= x.items[i].tier, x.g); });
});

test('ตัวสร้างตารางไม่เห็นท่าเสริม: แผนที่สร้างใหม่ไม่มี id ขึ้นต้น x', function(){
  var DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
  [['ฟิตเนส-ยิม','ครบมาก'], ['ที่บ้าน', null]].forEach(function(loc){
    var a = {Q9:'ชาย', Q10:30, Q11:175, Q12:78, Q16:'นักกีฬา-เทรนมานาน', Q20:loc[0], Q22:loc[1], Q21:['ดัมเบล','ไม่มีอุปกรณ์เลย'].slice(0,1),
      Q36:'นั่งโต๊ะเป็นหลัก', Q2:DAYS.slice(0, 5), Q3:'45-60 นาที', Q1:'เพิ่มกล้ามเนื้อ'};
    H.setState({plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null, trainDays:DAYS.slice(0, 5)}, answers:a});
    var snap = H.plain(H.ev('buildPlanSnapshot')(a));
    snap.sessions.forEach(function(s){ s.exercises.forEach(function(e){ assert.ok(!/^x/.test(e.id), s.key+' '+e.id); }); });
  });
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
