/* Plain-node test for calculations.js (BMR / TDEE) — no dependencies, no build step.
   Run: node tests/calculations.test.js */
"use strict";
var assert = require('assert');
var path = require('path');
global.window = global;
require(path.join(__dirname, '..', 'calculations.js'));
var C = global.GymBroCalc;

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

console.log('BMR — Mifflin-St Jeor (PART 25)');
test('Male 80kg / 180cm / 30y -> 1780', function(){
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, age:30, sex:'ชาย'}), 1780);
});
test('Female 60kg / 165cm / 30y -> 1320.25', function(){
  assert.strictEqual(C.calculateBMR({weightKg:60, heightCm:165, age:30, sex:'หญิง'}), 1320.25);
});
test('positional args give the identical result (backward compatible)', function(){
  assert.strictEqual(C.calculateBMR(80, 180, 30, 'ชาย'), C.calculateBMR({weightKg:80, heightCm:180, age:30, sex:'ชาย'}));
});
test('string inputs from form fields are coerced, not rounded first', function(){
  assert.strictEqual(C.calculateBMR({weightKg:'80.4', heightCm:'180.6', age:'30', sex:'ชาย'}), 10*80.4 + 6.25*180.6 - 5*30 + 5);
});

console.log('TDEE — BMR x Activity Factor (PART 25)');
test('1780 x 1.55 -> 2759', function(){
  assert.strictEqual(C.calculateTDEE({bmr:1780, activityFactor:1.55}), 2759);
});
test('1320.25 x 1.375 -> 1815.34375', function(){
  assert.strictEqual(C.calculateTDEE({bmr:1320.25, activityFactor:1.375}), 1815.34375);
});

console.log('Activity factor mapping (PART 2) — one central table');
test('all five levels present with the exact spec values', function(){
  assert.strictEqual(C.ACTIVITY_FACTORS.sedentary, 1.20);
  assert.strictEqual(C.ACTIVITY_FACTORS.lightly_active, 1.375);
  assert.strictEqual(C.ACTIVITY_FACTORS.moderately_active, 1.55);
  assert.strictEqual(C.ACTIVITY_FACTORS.very_active, 1.725);
  assert.strictEqual(C.ACTIVITY_FACTORS.extremely_active, 1.90);
});
test('Q36 answers map through the central table (unchanged values)', function(){
  assert.strictEqual(C.activityFactorFromQ36('นั่งโต๊ะเป็นหลัก'), 1.20);
  assert.strictEqual(C.activityFactorFromQ36('ยืน-เดินเยอะ'), 1.375);
  assert.strictEqual(C.activityFactorFromQ36('ใช้แรงงาน'), 1.55);
});
test('unknown Q36 answer -> null (no silent default)', function(){
  assert.strictEqual(C.activityFactorFromQ36('อะไรก็ไม่รู้'), null);
  assert.strictEqual(C.activityFactorFromQ36(undefined), null);
});
test('unknown activity level -> null', function(){
  assert.strictEqual(C.getActivityFactor('super_active'), null);
  assert.strictEqual(C.getActivityFactor(null), null);
});

console.log('Validation (PART 20) — never return 0 to mask missing data');
test('missing weight -> null', function(){
  assert.strictEqual(C.calculateBMR({heightCm:180, age:30, sex:'ชาย'}), null);
});
test('missing height -> null', function(){
  assert.strictEqual(C.calculateBMR({weightKg:80, age:30, sex:'ชาย'}), null);
});
test('missing / zero / negative age -> null', function(){
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, sex:'ชาย'}), null);
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, age:0, sex:'ชาย'}), null);
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, age:-5, sex:'ชาย'}), null);
});
test('invalid sex -> null', function(){
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, age:30, sex:'other'}), null);
  assert.strictEqual(C.calculateBMR({weightKg:80, heightCm:180, age:30}), null);
});
test('TDEE with null bmr or invalid activity factor -> null', function(){
  assert.strictEqual(C.calculateTDEE({bmr:null, activityFactor:1.55}), null);
  assert.strictEqual(C.calculateTDEE({bmr:1780, activityFactor:0}), null);
  assert.strictEqual(C.calculateTDEE({bmr:1780, activityFactor:null}), null);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
