/* Plain-node test for benchmarks.js — no dependencies, no build step.
   Run: node tests/benchmark.test.js */
"use strict";
var assert = require('assert');
var path = require('path');
global.window = global; // benchmarks.js attaches to window if present, else `this`
require(path.join(__dirname, '..', 'benchmarks.js'));
var B = global.GymBroBenchmark;

var pass = 0, fail = 0;
function test(name, fn){
  try{ fn(); pass++; console.log('  ok  - '+name); }
  catch(e){ fail++; console.log('FAIL  - '+name+'\n        '+e.message); }
}

console.log('1) Weight + Reps -> e1RM (Epley)');
test('60kg x 8 reps -> 76 kg (spec example)', function(){
  var e1 = B.calculateEstimated1RM(60, 8);
  assert.strictEqual(e1, 76);
});
test('100kg x 1 rep -> ~103.33 kg', function(){
  var e1 = B.calculateEstimated1RM(100, 1);
  assert.ok(Math.abs(e1 - 103.3333) < 0.001);
});
test('reps not an integer -> null', function(){
  assert.strictEqual(B.calculateEstimated1RM(60, 8.5), null);
});
test('weight <= 0 -> null', function(){
  assert.strictEqual(B.calculateEstimated1RM(0, 8), null);
  assert.strictEqual(B.calculateEstimated1RM(-5, 8), null);
});

console.log('2) e1RM -> Relative Strength');
test('76 / 80 -> 0.95x (spec example)', function(){
  var rs = B.calculateRelativeStrength(76, 80);
  assert.strictEqual(Math.round(rs*100)/100, 0.95);
});
test('bodyweight missing -> null', function(){
  assert.strictEqual(B.calculateRelativeStrength(76, null), null);
});

console.log('3) Benchmark matching (against a seeded fixture dataset, NOT the shipped empty one)');
var fixture = [
  {exerciseId:'bench_press', sex:'ชาย', bodyweightMinKg:70, bodyweightMaxKg:89,
   experienceLevel:'ออกกำลังกายประจำ', benchmarkLevel:'intermediate', benchmarkValueKg:80, unit:'kg',
   benchmarkSource:'test-fixture', sourceName:'unit test fixture', sourceUrl:null, lastUpdated:'2026-01-01'}
];
function withFixture(fn){
  var real = B.BENCHMARK_DATASET.slice();
  B.BENCHMARK_DATASET.length = 0;
  fixture.forEach(function(r){ B.BENCHMARK_DATASET.push(r); });
  try{ fn(); } finally { B.BENCHMARK_DATASET.length = 0; real.forEach(function(r){ B.BENCHMARK_DATASET.push(r); }); }
}
test('matches exercise+sex+bodyweight range+experience', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:80, experience:'ออกกำลังกายประจำ'});
    assert.ok(b);
    assert.strictEqual(b.benchmarkValueKg, 80);
  });
});
test('resolves via EXERCISE_BENCHMARK_KEY (hp4 -> bench_press)', function(){
  withFixture(function(){
    assert.strictEqual(B.resolveBenchmarkKey('hp4'), 'bench_press');
  });
});
test('bodyweight outside range -> null (no fabrication)', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:200, experience:'ออกกำลังกายประจำ'});
    assert.strictEqual(b, null);
  });
});
test('shipped dataset is empty (no invented numbers) -> always null until populated', function(){
  var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:80, experience:'ออกกำลังกายประจำ'});
  assert.strictEqual(b, null);
});

console.log('4) Performance classification (enum per PART 10)');
test('ratio < 0.90 -> LOWER_THAN_BENCHMARK (red)', function(){
  var lvl = B.getPerformanceLevel({e1rmKg:60, benchmark:{benchmarkValueKg:80}});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.LOWER_THAN_BENCHMARK);
  assert.strictEqual(lvl.icon, '🔴');
  assert.ok(lvl.label.length > 0, 'colour must always be paired with text (PART 15)');
});
test('ratio in [0.90,1.10] -> NEAR_BENCHMARK (yellow)', function(){
  var lvl = B.getPerformanceLevel({e1rmKg:76, benchmark:{benchmarkValueKg:80}});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.NEAR_BENCHMARK);
  assert.strictEqual(lvl.icon, '🟡');
});
test('ratio in (1.10,1.50] -> ABOVE_BENCHMARK (green)', function(){
  var lvl = B.getPerformanceLevel({e1rmKg:100, benchmark:{benchmarkValueKg:80}});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.ABOVE_BENCHMARK);
  assert.strictEqual(lvl.icon, '🟢');
});
test('ratio > 1.50 -> ADVANCED (purple)', function(){
  var lvl = B.getPerformanceLevel({e1rmKg:130, benchmark:{benchmarkValueKg:80}});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.ADVANCED);
  assert.strictEqual(lvl.icon, '🟣');
});
test('no wording implies the user is good/bad at lifting (PART 10)', function(){
  Object.keys(B.PERFORMANCE_PRESENTATION).forEach(function(k){
    var label = B.PERFORMANCE_PRESENTATION[k].label;
    assert.ok(label.indexOf('เก่ง') === -1, k + ' label must stay neutral');
  });
});
test('full-parameter signature does the benchmark lookup itself', function(){
  withFixture(function(){
    var lvl = B.getPerformanceLevel({
      exercise:'hp4', sex:'ชาย', bodyweightKg:80, experience:'ออกกำลังกายประจำ',
      e1rmKg:76, relativeStrength:0.95
    });
    assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.NEAR_BENCHMARK);
    assert.strictEqual(lvl.benchmark.benchmarkValueKg, 80);
  });
});

console.log('5) Personal Progress (must be independent of Benchmark)');
test('70kg -> 76kg e1RM = +8.5714% progress, regardless of benchmark status', function(){
  var hist = [{date:'2026-08-01', e1rm:70}];
  var prog = B.calculatePersonalProgress(76, hist);
  assert.strictEqual(prog.deltaPct, 8.6);            // rounded for display
  assert.ok(Math.abs(prog.deltaPctRaw - 8.571428) < 0.0001); // raw value kept
  assert.strictEqual(prog.direction, 'up');
});
test('still below benchmark AND progressing are both reportable at once (not merged)', function(){
  var perf = B.getPerformanceLevel({e1rmKg:76, benchmark:{benchmarkValueKg:100}});
  var prog = B.calculatePersonalProgress(76, [{date:'2026-08-01', e1rm:70}]);
  assert.strictEqual(perf.level, B.PERFORMANCE_LEVEL.LOWER_THAN_BENCHMARK); // still below benchmark
  assert.strictEqual(prog.direction, 'up');                                 // yet personally improving
});

console.log('6) No benchmark available');
test('getPerformanceLevel with no matching benchmark -> NO_BENCHMARK, never LOWER_THAN_BENCHMARK', function(){
  var lvl = B.getPerformanceLevel({e1rmKg:76, benchmark:null});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.NO_BENCHMARK);
  assert.strictEqual(lvl.hasBenchmark, false);
  assert.strictEqual(lvl.label, 'ยังไม่มี Benchmark สำหรับข้อมูลนี้');
});
test('unmapped exercise (machine/isolation) -> NO_BENCHMARK, not a guessed comparison', function(){
  var lvl = B.getPerformanceLevel({exercise:'sq3', sex:'ชาย', bodyweightKg:80, experience:'ออกกำลังกายประจำ', e1rmKg:200});
  assert.strictEqual(lvl.level, B.PERFORMANCE_LEVEL.NO_BENCHMARK);
});

console.log('7) Incomplete / invalid data');
test('getStrengthBenchmark missing sex -> null', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', bodyweightKg:80, experience:'ออกกำลังกายประจำ'});
    assert.strictEqual(b, null);
  });
});
test('getStrengthBenchmark missing experience -> null', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:80});
    assert.strictEqual(b, null);
  });
});
test('validateBenchmarkInput flags every missing field', function(){
  var v = B.validateBenchmarkInput({});
  assert.strictEqual(v.valid, false);
  assert.ok(v.issues.length >= 5);
});
test('pickAssessmentSet ignores null/incomplete sets, does not crash', function(){
  var pick = B.pickAssessmentSet([null, {weight:null,reps:8}, {weight:60,reps:0}, {weight:60,reps:8}]);
  assert.ok(pick);
  assert.strictEqual(pick.e1rm, 76);
});
test('pickAssessmentSet with zero valid sets -> null (not 0)', function(){
  var pick = B.pickAssessmentSet([null, {weight:null,reps:null}]);
  assert.strictEqual(pick, null);
});

console.log('8) Different sex must not share a benchmark match');
test('female bodyweight/experience combo not present in male-only fixture -> null', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'หญิง', bodyweightKg:80, experience:'ออกกำลังกายประจำ'});
    assert.strictEqual(b, null);
  });
});

console.log('9) Different bodyweight must not share a benchmark match outside its range');
test('bodyweight 69 (just under 70-89 range) -> null', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:69, experience:'ออกกำลังกายประจำ'});
    assert.strictEqual(b, null);
  });
});
test('bodyweight 89 (upper bound, inclusive) -> matches', function(){
  withFixture(function(){
    var b = B.getStrengthBenchmark({exercise:'hp4', sex:'ชาย', bodyweightKg:89, experience:'ออกกำลังกายประจำ'});
    assert.ok(b);
  });
});

console.log('10) Historical workout / low-confidence high-rep sets');
test('pickAssessmentSet prefers the <=12-rep set with highest e1RM over a higher-rep set', function(){
  // set A: 40kg x 20 reps -> e1RM 66.67 (unreliable, high reps)
  // set B: 60kg x 5 reps  -> e1RM 70    (reliable, <=12 reps) - should win even though e1RM is close
  var pick = B.pickAssessmentSet([{weight:40,reps:20},{weight:60,reps:5}]);
  assert.strictEqual(pick.weight, 60);
  assert.strictEqual(pick.lowConfidence, false);
});
test('all sets >12 reps -> still returns best, flagged lowConfidence:true', function(){
  var pick = B.pickAssessmentSet([{weight:20,reps:20},{weight:25,reps:18}]);
  assert.ok(pick);
  assert.strictEqual(pick.lowConfidence, true);
});
test('calculatePersonalProgress over multi-entry history uses most recent prior entry as baseline by default', function(){
  var hist = [{date:'2026-06-01', e1rm:60}, {date:'2026-07-01', e1rm:70}];
  var prog = B.calculatePersonalProgress(76, hist);
  assert.strictEqual(prog.baselineDate, '2026-07-01'); // latest prior, not the oldest
});

console.log('\n' + pass + ' passed, ' + fail + ' failed');
process.exit(fail ? 1 : 0);
