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

console.log('Katch-McArdle — only when body fat is typed in');
test('BMR = 370 + 21.6 x FFM', function(){
  // 80 กก. ไขมัน 15% → FFM 68 → 370 + 1468.8
  assert.ok(Math.abs(C.calculateBMRKatchMcArdle(80, 15) - 1838.8) < 1e-9);
});
test('out-of-range or missing body fat -> null', function(){
  assert.strictEqual(C.calculateBMRKatchMcArdle(80, 2.9), null);
  assert.strictEqual(C.calculateBMRKatchMcArdle(80, 60.1), null);
  assert.strictEqual(C.calculateBMRKatchMcArdle(0, 15), null);
  assert.strictEqual(C.calculateBMRKatchMcArdle(80, null), null);
});
test('profile BMR: typed body fat -> Katch, otherwise Mifflin', function(){
  var base = {weightKg:80, heightCm:180, age:30, sex:'ชาย'};
  assert.strictEqual(C.calculateBMRForProfile(base), 1780);
  assert.strictEqual(C.calculateBMRForProfile({weightKg:80, heightCm:180, age:30, sex:'ชาย', bodyFatPct:null}), 1780);
  assert.strictEqual(C.calculateBMRForProfile({weightKg:80, heightCm:180, age:30, sex:'ชาย', bodyFatPct:''}), 1780);
  assert.ok(Math.abs(C.calculateBMRForProfile({weightKg:80, heightCm:180, age:30, sex:'ชาย', bodyFatPct:15}) - 1838.8) < 1e-9);
});
test('profile BMR: invalid body fat falls back to Mifflin; incomplete profile stays null', function(){
  assert.strictEqual(C.calculateBMRForProfile({weightKg:80, heightCm:180, age:30, sex:'ชาย', bodyFatPct:99}), 1780);
  assert.strictEqual(C.calculateBMRForProfile({weightKg:80, age:30, sex:'ชาย', bodyFatPct:15}), null);
  assert.strictEqual(C.calculateBMRForProfile({weightKg:80, heightCm:180, age:30, sex:'other', bodyFatPct:15}), null);
});
test('Katch is higher for a lean lifter and lower for a high-fat user than Mifflin', function(){
  var lean = {weightKg:80, heightCm:180, age:30, sex:'ชาย'}, fat = {weightKg:120, heightCm:175, age:40, sex:'ชาย'};
  assert.ok(C.calculateBMRForProfile(Object.assign({bodyFatPct:10}, lean)) > C.calculateBMR(lean));
  assert.ok(C.calculateBMRForProfile(Object.assign({bodyFatPct:40}, fat)) < C.calculateBMR(fat));
});

console.log('Activity factor mapping (PART 2) — one central table');
test('non-exercise activity levels use FAO/WHO PAL values', function(){
  assert.strictEqual(C.ACTIVITY_FACTORS.sedentary, 1.40);
  assert.strictEqual(C.ACTIVITY_FACTORS.lightly_active, 1.55);
  assert.strictEqual(C.ACTIVITY_FACTORS.moderately_active, 1.75);
  assert.deepStrictEqual(Object.keys(C.ACTIVITY_FACTORS).sort(), ['lightly_active','moderately_active','sedentary']);
});
test('Q36 answers map through the central table', function(){
  assert.strictEqual(C.activityFactorFromQ36('นั่งโต๊ะเป็นหลัก'), 1.40);
  assert.strictEqual(C.activityFactorFromQ36('ยืน-เดินเยอะ'), 1.55);
  assert.strictEqual(C.activityFactorFromQ36('ใช้แรงงาน'), 1.75);
});
test('desk-job TDEE (exercise excluded) lands near the USDA sedentary estimate', function(){
  // ชาย 30 ปี 180 ซม. 80 กก. → USDA sedentary ~2,400 · หญิง 30 ปี 165 ซม. 60 กก. → ~1,800
  var m = C.calculateTDEE(C.calculateBMR(80, 180, 30, 'ชาย'), C.activityFactorFromQ36('นั่งโต๊ะเป็นหลัก'));
  var f = C.calculateTDEE(C.calculateBMR(60, 165, 30, 'หญิง'), C.activityFactorFromQ36('นั่งโต๊ะเป็นหลัก'));
  assert.ok(m > 2300 && m < 2600, 'male '+m);
  assert.ok(f > 1700 && f < 1950, 'female '+f);
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

console.log('Energy availability — IOC RED-S (F-02)');
test('FFM = weight x (1 - bf%)', function(){
  assert.strictEqual(C.calculateFFM(60, 25), 45);
  assert.strictEqual(C.calculateFFM(60, 100), null);
  assert.strictEqual(C.calculateFFM(0, 20), null);
});
test('EA = (intake - exercise) / FFM', function(){
  assert.strictEqual(C.calculateEnergyAvailability({intakeKcal:1450, exerciseKcal:200, ffmKg:50}), 25);
  assert.strictEqual(C.calculateEnergyAvailability(2000, 0, 50), 40);
});
test('EA with missing/invalid FFM or intake -> null', function(){
  assert.strictEqual(C.calculateEnergyAvailability({intakeKcal:1500, exerciseKcal:100, ffmKg:0}), null);
  assert.strictEqual(C.calculateEnergyAvailability({intakeKcal:null, exerciseKcal:100, ffmKg:50}), null);
});
test('minIntakeForEA gives the intake that lands exactly on the threshold', function(){
  var min = C.minIntakeForEA(C.EA_MIN_NON_CUT, 200, 45);
  assert.strictEqual(min, 35*45 + 200);
  assert.strictEqual(C.calculateEnergyAvailability(min, 200, 45), 35);
  assert.ok(C.EA_MIN_CUT < C.EA_MIN_NON_CUT);
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
