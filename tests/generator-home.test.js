/* Plain-node test: ตัวสร้างแผนฝั่ง "ที่บ้าน" ต้องเคารพอุปกรณ์เสริมตามตัวเลือก Q21 ใน onboarding (HOME_NEEDS)
   Run: node tests/generator-home.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var DAYS = ['จันทร์','อังคาร','พุธ','พฤหัสบดี','ศุกร์','เสาร์','อาทิตย์'];
var NONE = 'ไม่มีอุปกรณ์เลย';
var selectionFor = H.ev('selectionFor'), homeNeedMissing = H.ev('homeNeedMissing');
var NEEDS = H.plain(H.ev('HOME_NEEDS'));
var OPTIONAL = H.plain(H.ev('OPTIONAL_PATTERNS'));
var SPLITS = H.plain(H.ev('SPLIT_DEFS'));
var SLOTS = [];
Object.keys(SPLITS).forEach(function(k){ SPLITS[k].sessions.forEach(function(s){ s.patterns.forEach(function(p){ if(SLOTS.indexOf(p) < 0) SLOTS.push(p); }); }); });
var GEN_NEED_IDS = Object.keys(NEEDS).filter(function(id){ return !/^x/.test(id); }); // ท่าที่ตัวสร้างแผนมองเห็น (EXERCISES)

function answers(loc, q21, exp){
  var a = {Q9:'ชาย', Q10:30, Q11:175, Q12:78, Q16:exp || 'เคยออกบ้าง', Q20:loc, Q36:'นั่งโต๊ะเป็นหลัก',
    Q2:DAYS.slice(0, 5), Q3:'45-60 นาที', Q1:'เพิ่มกล้ามเนื้อ', Q25:'ไม่มี'};
  if(loc === 'ที่บ้าน') a.Q21 = q21; else a.Q22 = 'ครบมาก';
  return a;
}
function picks(a){
  H.setState({plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null, trainDays:DAYS.slice(0, 5)}, answers:a});
  var out = {};
  SLOTS.forEach(function(s){ var p = selectionFor(s, a).picked; out[s] = p ? p.id : null; });
  return out;
}
function ids(o){ return Object.keys(o).map(function(k){ return o[k]; }).filter(Boolean); }

test('homeNeedMissing: ไม่ใช่ที่บ้านใช้ได้เสมอ / ที่บ้านต้องมีอุปกรณ์เสริมจริงใน Q21', function(){
  assert.strictEqual(homeNeedMissing('hp3', answers('ฟิตเนส-ยิม')), null);
  assert.strictEqual(homeNeedMissing('hp3', answers('ที่บ้าน', ['ดัมเบล'])), 'ม้านั่ง');
  assert.strictEqual(homeNeedMissing('hp3', answers('ที่บ้าน', ['ดัมเบล', 'ม้านั่ง'])), null);
  assert.strictEqual(homeNeedMissing('sq2', answers('ที่บ้าน', [NONE])), null);
  assert.strictEqual(homeNeedMissing('hp3', answers('ที่บ้าน', undefined)), 'ม้านั่ง');
});

test('ที่บ้านมีแค่ดัมเบล: ไม่ได้ท่าที่ต้องใช้ม้านั่งในทุกระดับประสบการณ์', function(){
  ['มือใหม่', 'เคยออกบ้าง', 'ออกกำลังกายประจำ', 'นักกีฬา-เทรนมานาน'].forEach(function(exp){
    var got = ids(picks(answers('ที่บ้าน', ['ดัมเบล'], exp)));
    got.forEach(function(id){ assert.ok(GEN_NEED_IDS.indexOf(id) < 0, exp+' ได้ '+id+' ที่ต้องใช้ '+NEEDS[id]); });
  });
});

test('ที่บ้าน "ไม่มีอุปกรณ์เลย": ไม่ได้ Bench Dip / ท่าที่ต้องมีม้านั่ง และทุกกลุ่มหลักยังมีท่า', function(){
  ['มือใหม่', 'นักกีฬา-เทรนมานาน'].forEach(function(exp){
    var p = picks(answers('ที่บ้าน', [NONE], exp));
    ids(p).forEach(function(id){ assert.ok(GEN_NEED_IDS.indexOf(id) < 0, id); });
    SLOTS.forEach(function(s){
      if(OPTIONAL.indexOf(s.split('@')[0]) < 0) assert.ok(p[s], exp+': กลุ่มหลัก '+s+' ไม่มีท่า');
    });
  });
});

test('ที่บ้านมีดัมเบล + ม้านั่ง: ได้เบนช์เพรส/อินไคลน์เพรสดัมเบลเหมือนเดิม', function(){
  var p = picks(answers('ที่บ้าน', ['ดัมเบล', 'ม้านั่ง'], 'เคยออกบ้าง'));
  assert.strictEqual(p.hpush, 'hp3');
  assert.strictEqual(p.incline, 'ic3');
});

test('ทุกตัวเลือก Q21 เดี่ยวๆ × ทุกระดับ: กลุ่มหลักที่ไม่ใช่ท่าเสริมไม่ว่างเปล่าเพราะกติกาใหม่เมื่อเทียบกับไม่มีอุปกรณ์เลย', function(){
  var Q21 = H.plain(H.ev('libraryQ21Options')());
  ['มือใหม่', 'เคยออกบ้าง', 'นักกีฬา-เทรนมานาน'].forEach(function(exp){
    Q21.forEach(function(opt){
      var p = picks(answers('ที่บ้าน', [opt], exp));
      SLOTS.forEach(function(s){
        if(OPTIONAL.indexOf(s.split('@')[0]) < 0) assert.ok(p[s], exp+' / '+opt+': กลุ่มหลัก '+s+' ไม่มีท่า');
      });
    });
  });
});

test('ยิมไม่เปลี่ยน: ยิมระดับ "ครบมาก" ยังได้ hp3 (ไม่มีกติกาม้านั่ง) และไม่มี needMissing', function(){
  var p = picks(answers('ฟิตเนส-ยิม', null, 'เคยออกบ้าง'));
  assert.strictEqual(p.hpush, 'hp3');
  assert.strictEqual(p.incline, 'ic3');
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
