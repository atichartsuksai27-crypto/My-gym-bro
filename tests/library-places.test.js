/* Plain-node test: คลังท่าแยกตามสถานที่ (ยิม / ที่บ้าน) ต้องตรงกับ onboarding (Q20 / Q21 / Q22)
   Run: node tests/library-places.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

var ALL = H.plain(H.ev('LIBRARY_ALL'));
var byId = H.ev('libraryById');
var homeOk = H.ev('libraryHomeOk'), gymOk = H.ev('libraryGymOk'), libFilter = H.ev('libraryFilter');
var Q21 = H.plain(H.ev('libraryQ21Options')());
var NEEDS = H.plain(H.ev('LIBRARY_HOME_NEEDS'));
var NONE = 'ไม่มีอุปกรณ์เลย';
function ids(list){ return list.map(function(e){ return e.id; }); }
function home(owned){ return ALL.filter(function(e){ return homeOk(e, owned); }); }

test('ตัวเลือกอุปกรณ์ที่บ้านอ่านจาก Q21 ใน onboarding ตรงๆ (12 ตัวเลือก รวม "ไม่มีอุปกรณ์เลย")', function(){
  assert.strictEqual(Q21.length, 12);
  assert.ok(Q21.indexOf(NONE) > -1);
  assert.deepStrictEqual(H.plain(H.ev('libraryHomeKit')()), Q21.filter(function(o){ return o !== NONE; }));
});

test('ที่บ้าน "ไม่มีอุปกรณ์เลย" = เฉพาะท่าน้ำหนักตัวที่ไม่ต้องใช้อุปกรณ์เสริม (ไม่มีเบนช์ดิป/เชือกกระโดด/ดัมเบล)', function(){
  var got = home([NONE]);
  got.forEach(function(e){ assert.strictEqual(e.equip, 'bodyweight', e.id); assert.ok(!NEEDS[e.id], e.id); });
  assert.ok(ids(got).indexOf('tc2') < 0 && ids(got).indexOf('xcd6') < 0);
  assert.strictEqual(got.length, ALL.filter(function(e){ return e.equip === 'bodyweight' && !NEEDS[e.id]; }).length);
});

test('ที่บ้านมีแค่ดัมเบล ไม่ได้ท่าที่ต้องใช้ม้านั่ง; เพิ่มม้านั่งแล้วจึงได้', function(){
  var d = ids(home(['ดัมเบล']));
  ['hp3','ic3','fl3','lg3','gl2b','xbc3'].forEach(function(id){ assert.ok(d.indexOf(id) < 0, id+' ไม่ควรมีถ้าไม่มีม้านั่ง'); });
  assert.ok(d.indexOf('hg2') > -1 && d.indexOf('bc2') > -1);
  var d2 = ids(home(['ดัมเบล','ม้านั่ง']));
  ['hp3','ic3','fl3','lg3','gl2b','xbc3'].forEach(function(id){ assert.ok(d2.indexOf(id) > -1, id); });
  assert.ok(d2.indexOf('hp4') < 0);
});

test('ที่บ้านไม่เห็นเครื่อง/เคเบิล/เคตเทิลเบลล์; ปลดล็อกตามอุปกรณ์ของ Q21', function(){
  var kit = Q21.filter(function(o){ return o !== NONE; });
  home(kit).forEach(function(e){ assert.ok(['machine','cable','kettlebell'].indexOf(e.equip) < 0, e.id); });
  assert.ok(ids(home(['บาร์เบล'])).indexOf('sq4') > -1);
  assert.ok(ids(home(['บาร์โหน'])).indexOf('vl4') > -1);
  assert.ok(ids(home(['สเต็ปเปอร์'])).indexOf('sq3b') > -1);
  assert.ok(ids(home(['ลูกบอลโยคะ'])).indexOf('hg3b') > -1);
  assert.ok(ids(home(['ลูกกลิ้งบริหารหน้าท้อง'])).indexOf('co3b') > -1);
  assert.ok(ids(home(['เชือกกระโดด'])).indexOf('xcd6') > -1);
});

test('LIBRARY_HOME_NEEDS: ทุก id มีในคลัง และอุปกรณ์เสริมเป็นตัวเลือกจริงใน Q21', function(){
  Object.keys(NEEDS).forEach(function(id){
    assert.ok(byId(id), 'ไม่มีท่า '+id);
    assert.ok(Q21.indexOf(NEEDS[id]) > -1, id+' ต้องการ '+NEEDS[id]+' ซึ่งไม่อยู่ใน Q21');
  });
});

test('ยิม = อุปกรณ์ระดับ "ครบมาก" ของตัวสร้างแผน + เคตเทิลเบลล์; ไม่มีท่าที่ต้องใช้สเต็ปเปอร์/ลูกบอล/ล้อโรล', function(){
  var allowed = H.plain(H.ev('equipAllowed')('ครบมาก'));
  ALL.forEach(function(e){ assert.strictEqual(gymOk(e), allowed.indexOf(e.equip) > -1 || e.equip === 'kettlebell', e.id); });
  assert.ok(!gymOk(byId('sq3b')) && !gymOk(byId('hg3b')) && !gymOk(byId('co3b')));
});

test('ตัวกรองสถานที่: place=gym/home/all และ homeOwned ทำงานร่วมกับกลุ่ม/ค้นหา', function(){
  var mine = {};
  var gym = libFilter({place:'gym'}, mine), hm = libFilter({place:'home', homeOwned:[NONE]}, mine), all = libFilter({place:'all'}, mine);
  assert.strictEqual(all.length, 147);
  assert.strictEqual(gym.length, ALL.filter(function(e){ return gymOk(e); }).length);
  assert.strictEqual(hm.length, home([NONE]).length);
  assert.strictEqual(libFilter({}, mine).length, 147);
  var core = libFilter({place:'home', homeOwned:[NONE], group:'core', query:'plank'}, mine);
  core.forEach(function(e){ assert.strictEqual(e.pattern, 'core'); });
  assert.ok(core.length > 0);
});

test('ป้ายสถานที่: ท่าเครื่อง = ยิม, ท่าน้ำหนักตัว = ยิม · ที่บ้าน, สเต็ปเปอร์ = ที่บ้าน', function(){
  var label = H.ev('libraryPlaceLabel');
  assert.strictEqual(label(byId('sq3')), 'ยิม');
  assert.strictEqual(label(byId('sq1')), 'ยิม · ที่บ้าน');
  assert.strictEqual(label(byId('sq3b')), 'ที่บ้าน');
});

test('onboarding ↔ คลัง: ตัวเลือกใน Q21 ที่ยังไม่มีท่าในคลัง = ยางยืด / ฮูลาฮูป / เสื่อโยคะ', function(){
  var unlocks = H.ev('libraryOptionUnlocks');
  var empty = Q21.filter(function(o){ return o !== NONE && !unlocks(o); });
  assert.deepStrictEqual(empty, ['ยางยืด', 'ฮูลาฮูป', 'เสื่อโยคะ']);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
