/* โหลด app.js ทั้งไฟล์ใน vm ที่มี DOM ปลอม เพื่อเรียกฟังก์ชันภายใน (computeTargets, calorieTargetUpdate ฯลฯ) ตรง ๆ ในเทสต์
   วิธีเดียวกับ android-native/tools/make-golden.js (แทรก hook eval ก่อนบรรทัดปิด IIFE) — ไม่มี dependency, ไม่มี build step
   ใช้: var H = require('./app-harness'); H.setState({...}); H.ev('computeTargets')(answers) */
"use strict";
var fs = require('fs');
var path = require('path');
var vm = require('vm');

var ROOT = path.join(__dirname, '..');
global.window = global;
require(path.join(ROOT, 'calculations.js'));
require(path.join(ROOT, 'benchmarks.js'));

var RealDate = Date;
var ctx;
class FixedDate extends RealDate {
  constructor(...a){ if(a.length === 0) super(ctx.__today + 'T12:00:00'); else super(...a); }
  static now(){ return new RealDate(ctx.__today + 'T12:00:00').getTime(); }
}
function domStub(){
  var p;
  p = new Proxy(function(){ return p; }, {
    get: function(t, k){ if(k === Symbol.toPrimitive) return function(){ return ''; }; if(k === 'length') return 0; return p; },
    apply: function(){ return p; }
  });
  return p;
}
var lsStore = {};
ctx = {
  GymBroCalc: global.GymBroCalc, GymBroBenchmark: global.GymBroBenchmark, console: console, Math: Math, JSON: JSON, Date: FixedDate, __today: '2026-10-15',
  document: domStub(), history: domStub(), navigator: {userAgent: ''}, location: {href: '', search: '', hash: ''},
  localStorage: {getItem: function(k){ return k in lsStore ? lsStore[k] : null; }, setItem: function(k, v){ lsStore[k] = String(v); }, removeItem: function(k){ delete lsStore[k]; }},
  setTimeout: function(){ return 0; }, clearTimeout: function(){}, setInterval: function(){ return 0; }, clearInterval: function(){},
  requestAnimationFrame: function(){}, matchMedia: function(){ return {matches: false, addEventListener: function(){}}; },
  addEventListener: function(){}, fetch: function(){ return new Promise(function(){}); },
  scrollTo: function(){}, scrollY: 0, innerWidth: 400, innerHeight: 800
};
ctx.window = ctx;
vm.createContext(ctx);
var appSrc = fs.readFileSync(path.join(ROOT, 'app.js'), 'utf8');
var iifeEnd = appSrc.lastIndexOf('})();');
if(iifeEnd < 0) throw new Error('app.js: ไม่พบบรรทัดปิด IIFE');
vm.runInContext(appSrc.slice(0, iifeEnd) + 'window.__ev = function(s){ return eval(s); };\n' + appSrc.slice(iifeEnd), ctx, {filename: 'app.js'});

var ev = ctx.__ev;
module.exports = {
  ev: ev,
  setToday: function(iso){ ctx.__today = iso; },
  setState: ev('(function(v){ state = v; })'),
  getState: ev('(function(){ return state; })'),
  /* ตั้ง track (program/logs/weights) ที่ฟังก์ชันอ่านเป้า/น้ำหนักล่าสุดใช้ */
  setTrack: ev('(function(t){ track.program = t.program; track.logs = t.logs || {}; track.weights = t.weights || {}; })'),
  plain: function(x){ return JSON.parse(JSON.stringify(x === undefined ? null : x)); }
};
