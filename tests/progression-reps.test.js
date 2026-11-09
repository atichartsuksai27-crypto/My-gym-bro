/* Plain-node test: จำนวนครั้งต่อเซ็ตเทียบช่วงเป้า × ปุ่ม "แรงเหลือหลังเล่น" → น้ำหนักครั้งหน้า (planFrom / repsSignal)
   Run: node tests/progression-reps.test.js */
"use strict";
var assert = require('assert');
var H = require('./app-harness');

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

H.setTrack({program:{sessions:[], equipSteps:{}}, logs:{}, weights:{}});
var planFrom = H.ev('planFrom'), repsSignal = H.ev('repsSignal'), setVerdict = H.ev('setVerdict'), progRecord = H.ev('progRecord');

// บาร์เบลขั้นละ 2.5 กก. (รวมสองข้าง) ท่าส่วนบน — ช่วงเป้า 4-8 (โหมดเข้มข้น)
var BB = {id:'hp4', pattern:'hpush', equip:'barbell', setsReps:'2 x 4-8', timeBased:false};
function S(){ return Array.prototype.slice.call(arguments).map(function(r){ return {weight:60, reps:r}; }); }
function plan(ex, sets, feel, prog, symptom){ return H.plain(planFrom(ex, sets, feel || null, prog || null, symptom || null)); }
function weights(p){ return p.sets.map(function(s){ return s.weight; }); }

test('setVerdict: ขอบช่วงเป้า 4-8', function(){
  var rr = {lo:4, hi:8};
  assert.strictEqual(setVerdict(3, rr), 'low');
  assert.strictEqual(setVerdict(4, rr), 'in');
  assert.strictEqual(setVerdict(8, rr), 'in');
  assert.strictEqual(setVerdict(9, rr), 'high');
  assert.strictEqual(setVerdict(null, rr), null);
});

test('เกินช่วง (เซ็ตแรก 10 ครั้งจาก 4-8) → น้ำหนักเบาไป เพิ่ม แม้เลือก "พอดี" หรือไม่เลือกความรู้สึก', function(){
  ['ok', null, 'more'].forEach(function(feel){
    var p = plan(BB, S(10, 9, 8), feel);
    assert.strictEqual(p.change.kind, 'weight', 'feel='+feel);
    assert.deepStrictEqual(weights(p), [62.5, 62.5], 'feel='+feel);
    assert.ok(/เกินช่วงเป้า 4–8/.test(p.note) && /เบาไป/.test(p.note), p.note);
  });
});

test('อยู่ในช่วง (6 ครั้ง) → พอดี: "พอดี" = คงเดิม แต่ "ยกเพิ่มได้อีก" ยังเพิ่มตามกติกาเดิม', function(){
  var ok = plan(BB, S(6, 5, 4), 'ok');
  assert.strictEqual(ok.change, null);
  assert.deepStrictEqual(weights(ok), [60, 60]);
  var more = plan(BB, S(6, 6), 'more');
  assert.strictEqual(more.change.kind, 'weight');
  assert.deepStrictEqual(weights(more), [62.5, 62.5]);
});

test('ต่ำกว่าช่วง → หนักไป ลด: ขาด 1 ครั้งลดเล็กน้อย / ขาด 2 ลดมากขึ้น / ขาด 3+ ลดมากสุด (ไม่เกิน ~20%)', function(){
  var one = plan(BB, S(3, 3), 'ok');
  assert.strictEqual(one.change.kind, 'down'); assert.deepStrictEqual(weights(one), [57.5, 57.5]); assert.strictEqual(one.change.dec, 2.5);
  var two = plan(BB, S(2, 2), 'ok');
  assert.deepStrictEqual(weights(two), [55, 55]); assert.strictEqual(two.change.dec, 5);
  var three = plan(BB, S(1, 1), 'ok');
  assert.deepStrictEqual(weights(three), [50, 50]); assert.strictEqual(three.change.dec, 10);
  assert.ok(three.change.dec <= 60 * 0.2 + 1e-9);
  assert.ok(/ลดเล็กน้อย/.test(one.note) && /ลดมากหน่อย/.test(two.note));
  // ลดแล้วจำนวนครั้งเป้าหมายอยู่ในช่วง
  three.sets.forEach(function(s){ assert.ok(s.reps >= 4 && s.reps <= 8); });
});

test('ขัดกับความรู้สึก: ทำได้ 3 ครั้งแต่เลือก "ยกเพิ่มได้อีก" → ระบบเชื่อจำนวนครั้ง (ลด) และบอกผู้ใช้', function(){
  var p = plan(BB, S(3, 3), 'more');
  assert.strictEqual(p.change.kind, 'down');
  assert.ok(/ขัดกับความรู้สึก/.test(p.note));
});

test('ขัดกัน: เซ็ตแรกเกินช่วงแต่เลือก "หนักไป" → ไม่เพิ่ม (hold) ไม่ลดเอง', function(){
  var p = plan(BB, S(10, 9), 'hard');
  assert.strictEqual(p.change.kind, 'hold');
  assert.deepStrictEqual(weights(p), [60, 60]);
});

test('เกินช่วงแต่บันทึกอาการบาดเจ็บ → ไม่เพิ่ม รอให้หายก่อน; ต่ำกว่าช่วงยังลดได้', function(){
  var sym = {level:'caution', text:'ปวดไหล่'};
  var up = plan(BB, S(10, 9), 'ok', null, sym);
  assert.strictEqual(up.change.kind, 'hold'); assert.ok(/ยังไม่เพิ่ม/.test(up.note));
  var down = plan(BB, S(3, 3), 'ok', null, sym);
  assert.strictEqual(down.change.kind, 'down');
});

test('เซ็ตแรกอยู่ในช่วงแต่เซ็ตท้ายตก (6,5,3) → แจ้งล้าเร็ว ไม่ปรับน้ำหนัก', function(){
  var sig = H.plain(repsSignal(BB, S(6, 5, 3)));
  assert.strictEqual(sig.verdict, 'ok'); assert.strictEqual(sig.fatigue, true); assert.strictEqual(sig.lastReps, 3);
  assert.strictEqual(plan(BB, S(6, 5, 3), 'ok').change, null);
});

test('ดูภาพรวมทุกเซ็ต ไม่ใช่เซ็ตแรกเซ็ตเดียว: เซ็ตแรกต่ำ/สูงแต่ภาพรวมอยู่ในช่วง = พอดี', function(){
  // เซ็ตแรกต่ำกว่าช่วง (3) แต่เซ็ตที่เหลืออยู่ในช่วง → ไม่ใช่หนักไป
  assert.strictEqual(H.plain(repsSignal(BB, S(3, 6, 6))).verdict, 'ok');
  assert.strictEqual(plan(BB, S(3, 6, 6), 'ok').change, null);
  // เซ็ตแรกเกินช่วง (10) แต่เซ็ตที่เหลืออยู่ในช่วง และค่าเฉลี่ยไม่เกิน → ไม่ใช่เบาไป
  assert.strictEqual(H.plain(repsSignal(BB, S(10, 8, 6))).verdict, 'ok');
  assert.strictEqual(plan(BB, S(10, 8, 6), 'ok').change, null);
});

test('ภาพรวมหนักไป: เฉลี่ยต่ำกว่าช่วง หรือเกินครึ่งของเซ็ตต่ำกว่าช่วง (แม้เซ็ตแรกจะดี)', function(){
  assert.strictEqual(H.plain(repsSignal(BB, S(5, 3, 3))).verdict, 'heavy'); // 2 จาก 3 เซ็ตต่ำกว่าช่วง
  assert.strictEqual(H.plain(repsSignal(BB, S(4, 3, 3))).verdict, 'heavy'); // เฉลี่ย 3.3 < 4
  assert.strictEqual(plan(BB, S(5, 3, 3), 'ok').change.kind, 'down');
  assert.strictEqual(H.plain(repsSignal(BB, S(6, 5, 3))).verdict, 'ok');     // 1 จาก 3 ต่ำกว่าช่วง แต่ภาพรวมในช่วง
});

test('ภาพรวมเบาไป: เฉลี่ยเกินช่วงบนและไม่มีเซ็ตไหนต่ำกว่าช่วงล่าง; ถ้ามีเซ็ตต่ำกว่าช่วง (10,9,3) = ไม่เพิ่ม', function(){
  assert.strictEqual(H.plain(repsSignal(BB, S(10, 9, 9))).verdict, 'light');
  assert.strictEqual(H.plain(repsSignal(BB, S(10, 10, 6))).verdict, 'light'); // เฉลี่ย 8.67 > 8
  var mixed = {id:'hp4', pattern:'hpush', equip:'barbell', setsReps:'3 x 4-8', timeBased:false};
  assert.strictEqual(H.plain(repsSignal(mixed, S(10, 9, 3))).verdict, 'ok');  // เซ็ตหนึ่งต่ำกว่าช่วง → ไม่ใช่เบาไป
  assert.strictEqual(plan(mixed, S(10, 9, 3), 'ok').change, null);
  assert.strictEqual(plan(mixed, S(10, 9, 3), 'more').change.kind, 'hold'); // ด่านเดิม: บางเซ็ตทำไม่ถึงขั้นต่ำ
});

test('สรุปภาพรวมเป็นข้อความ (จำนวนเซ็ตต่ำกว่า/ในช่วง/เกิน + ค่าเฉลี่ย)', function(){
  assert.strictEqual(H.ev('sigSummary')(repsSignal(BB, S(6, 5, 3))), '3 เซ็ต เฉลี่ย 4.7 ครั้ง (ต่ำกว่าช่วง 1 · ในช่วง 2)');
});

test('นับเฉพาะเซ็ตที่ใช้น้ำหนักจริง (≥ 80% ของน้ำหนักสูงสุด) — เซ็ตวอร์มเบา ๆ ไม่ถูกนับ', function(){
  var sets = [{weight:40, reps:12}, {weight:60, reps:3}, {weight:60, reps:3}];
  var sig = H.plain(repsSignal(BB, sets));
  assert.strictEqual(sig.sets, 2); assert.strictEqual(sig.avg, 3); assert.strictEqual(sig.verdict, 'heavy');
  assert.strictEqual(H.plain(repsSignal(BB, [{weight:60, reps:6}, {weight:50, reps:6}])).sets, 2); // เบากว่าเล็กน้อย (≥ 80%) ยังนับรวม
});

test('เพิ่งขึ้นน้ำหนักแล้วหนักไป → กลับไปน้ำหนักที่เคยทำได้ (ถ้าต่ำกว่าการลดตามสัดส่วน)', function(){
  var p = plan(BB, S(3, 3), 'ok', {kind:'weight', from:55, to:60});
  assert.strictEqual(p.change.kind, 'down');
  assert.deepStrictEqual(weights(p), [55, 55]);
  assert.ok(/กลับไปน้ำหนักที่เคยทำได้/.test(p.note));
});

test('ลดต่อไม่ได้ (น้ำหนักเท่าขั้นของอุปกรณ์) → ใช้กติกาเดิม ไม่ติดลบ', function(){
  var tiny = {id:'x1', pattern:'hpush', equip:'machine', setsReps:'2 x 4-8', timeBased:false}; // เครื่อง ขั้นละ 5 กก.
  var p = plan(tiny, [{weight:5, reps:2}, {weight:5, reps:2}], 'ok');
  p.sets.forEach(function(s){ assert.ok(s.weight > 0); });
  assert.notStrictEqual(p.change && p.change.kind, 'down');
});

test('ท่าน้ำหนักตัว/จับเวลาไม่ใช้กติกานี้ (signal = null) และผลเท่าเดิม', function(){
  var bw = {id:'hp2a', pattern:'hpush', equip:'bodyweight', setsReps:'3 x 8-12', timeBased:false};
  assert.strictEqual(repsSignal(bw, [{weight:null, reps:3}, {weight:null, reps:3}]), null);
  var p = plan(bw, [{weight:null, reps:12}, {weight:null, reps:12}, {weight:null, reps:12}], 'more');
  assert.strictEqual(p.change.kind, 'reps');
  var timed = {id:'co1', pattern:'core', equip:'bodyweight', setsReps:'3 x 30-45 วิ', timeBased:true};
  assert.strictEqual(repsSignal(timed, [{weight:30, reps:null}]), null);
});

test('ช่วงเป้าปกติ 8-12: 10 ครั้งอยู่ในช่วง (ไม่ใช่เบาไป) · 14 ครั้งเกินช่วง · 6 ครั้งต่ำกว่าช่วง', function(){
  var DB = {id:'hp3', pattern:'hpush', equip:'barbell', setsReps:'3 x 8-12', timeBased:false};
  assert.strictEqual(plan(DB, S(10, 10, 9), 'ok').change, null);
  assert.strictEqual(plan(DB, S(14, 12, 12), 'ok').change.kind, 'weight');
  assert.strictEqual(plan(DB, S(6, 6, 6), 'ok').change.kind, 'down');
});

test('progRecord บันทึกการลด (kind=down) เพื่อใช้ต่อในครั้งถัดไป และไม่ใช่การเพิ่ม', function(){
  var p = planFrom(BB, S(3, 3), 'ok', null, null);
  var rec = H.plain(progRecord(p));
  assert.strictEqual(rec.kind, 'down'); assert.strictEqual(rec.from, 60); assert.strictEqual(rec.to, 57.5);
  assert.strictEqual(H.ev('isUpChange')(p), false);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
