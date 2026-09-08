/* ============================================================
   Gymbro Daily — Exercise movement animations (SVG + SMIL)
   ------------------------------------------------------------
   ภาพเคลื่อนไหว SVG แบบวนลูป 1 ชิ้นต่อ "รูปแบบการเคลื่อนไหว" (pattern) ไม่ใช่ต่อท่า —
   ทุกท่าใน EXERCISES มี pattern อยู่แล้ว (squat/hinge/hpush/hpull/vpush/vpull/core/
   biceps/triceps) จึงครอบคลุมทุกท่าโดยอัตโนมัติ

   สำคัญ (ความซื่อสัตย์ต่อผู้ใช้): นี่คือภาพ "ลักษณะการเคลื่อนไหวโดยรวม" ของกลุ่มท่า
   ไม่ใช่คลิปสอนฟอร์มที่ถูกต้องเป๊ะรายท่า — UI ต้องกำกับข้อความนี้ไว้เสมอ (ดู demoModalHTML
   ใน app.js) เพื่อไม่ให้ผู้ใช้เข้าใจผิดว่าเป็นคู่มือฟอร์มจริง

   ใช้ SMIL (<animateTransform>) ฝังในตัว SVG — เริ่มเล่นเองตอนถูก inject เข้า DOM
   ไม่ต้องมี CSS keyframe/JS เพิ่ม ไม่พึ่งไลบรารีภายนอก (สอดคล้อง static-site, no build)
   สี stroke ใช้ currentColor -> ปรับตามธีม light/dark ผ่าน CSS ที่ครอบ

   เปิดเผย API ผ่าน global เดียว: window.GymBroExerciseAnim
   ============================================================ */
(function(global){
"use strict";

var COMMON = 'fill="none" stroke="currentColor" stroke-width="6" stroke-linecap="round" stroke-linejoin="round"';
var HEAD = function(cx, cy){ return '<circle cx="'+cx+'" cy="'+cy+'" r="9" '+COMMON+'/>'; };
function svg(inner){
  return '<svg class="move-anim" viewBox="0 0 140 140" xmlns="http://www.w3.org/2000/svg" role="img">'+inner+'</svg>';
}
var DUR = '1.8s';
function anim(type, values, extra){
  return '<animateTransform attributeName="transform" type="'+type+'" values="'+values+'" '+
    'keyTimes="0;0.5;1" dur="'+DUR+'" repeatCount="indefinite" '+(extra||'')+'/>';
}

/* squat — ทั้งตัวย่อลง-ขึ้น (bob) แขนยื่นหน้าเพื่อถ่วง */
var SQUAT = svg(
  '<g>'+ anim('translate','0 0;0 24;0 0') +
    HEAD(70,30)+
    '<line x1="70" y1="39" x2="70" y2="72" '+COMMON+'/>'+      // torso
    '<line x1="70" y1="48" x2="98" y2="46" '+COMMON+'/>'+      // arms forward
    '<line x1="70" y1="72" x2="56" y2="96" '+COMMON+'/>'+      // L thigh
    '<line x1="56" y1="96" x2="56" y2="118" '+COMMON+'/>'+     // L shin
    '<line x1="70" y1="72" x2="84" y2="96" '+COMMON+'/>'+      // R thigh
    '<line x1="84" y1="96" x2="84" y2="118" '+COMMON+'/>'+     // R shin
    '<line x1="48" y1="118" x2="64" y2="118" '+COMMON+'/>'+    // L foot
    '<line x1="76" y1="118" x2="92" y2="118" '+COMMON+'/>'+    // R foot
  '</g>'
);

/* hinge — ก้มพับที่สะโพก หลังตรง สะโพกถอยหลัง ขาเกือบตรง */
var HINGE = svg(
  '<line x1="80" y1="80" x2="80" y2="120" '+COMMON+'/>'+       // leg (fixed)
  '<line x1="66" y1="120" x2="94" y2="120" '+COMMON+'/>'+      // foot
  '<g>'+ anim('rotate','0 80 80;-62 80 80;0 80 80') +
    HEAD(80,34)+
    '<line x1="80" y1="43" x2="80" y2="80" '+COMMON+'/>'+      // torso hinging at hip(80,80)
    '<line x1="80" y1="52" x2="80" y2="86" '+COMMON+'/>'+      // arm hanging
  '</g>'
);

/* vpush — ดันแขนขึ้นเหนือศีรษะ (shoulder press) แขนสองข้างกางแล้วดันขึ้น */
var VPUSH = svg(
  HEAD(70,34)+
  '<line x1="70" y1="43" x2="70" y2="86" '+COMMON+'/>'+        // torso
  '<line x1="60" y1="110" x2="70" y2="86" '+COMMON+'/>'+       // L leg
  '<line x1="80" y1="110" x2="70" y2="86" '+COMMON+'/>'+       // R leg
  '<g>'+ anim('rotate','40 70 52;0 70 52;40 70 52') +
    '<line x1="70" y1="52" x2="44" y2="40" '+COMMON+'/>'+      // L arm up
  '</g>'+
  '<g>'+ anim('rotate','-40 70 52;0 70 52;-40 70 52') +
    '<line x1="70" y1="52" x2="96" y2="40" '+COMMON+'/>'+      // R arm up
  '</g>'
);

/* vpull — ดึงลงจากเหนือศีรษะ (pulldown/pull-up) แขนกางบนแล้วดึงลงข้างลำตัว */
var VPULL = svg(
  HEAD(70,40)+
  '<line x1="70" y1="49" x2="70" y2="92" '+COMMON+'/>'+        // torso
  '<line x1="60" y1="116" x2="70" y2="92" '+COMMON+'/>'+       // L leg
  '<line x1="80" y1="116" x2="70" y2="92" '+COMMON+'/>'+       // R leg
  '<g>'+ anim('rotate','0 70 56;42 70 56;0 70 56') +
    '<line x1="70" y1="56" x2="46" y2="26" '+COMMON+'/>'+      // L arm overhead -> pull down
  '</g>'+
  '<g>'+ anim('rotate','0 70 56;-42 70 56;0 70 56') +
    '<line x1="70" y1="56" x2="94" y2="26" '+COMMON+'/>'+      // R arm overhead -> pull down
  '</g>'
);

/* hpush — ดันไปข้างหน้า (มุมข้าง) มือยื่นออก-ดึงกลับ */
var HPUSH = svg(
  HEAD(56,40)+
  '<line x1="56" y1="49" x2="56" y2="92" '+COMMON+'/>'+        // torso
  '<line x1="46" y1="116" x2="56" y2="92" '+COMMON+'/>'+       // L leg
  '<line x1="66" y1="116" x2="56" y2="92" '+COMMON+'/>'+       // R leg
  '<g>'+ anim('translate','0 0;24 0;0 0') +
    '<line x1="56" y1="58" x2="86" y2="58" '+COMMON+'/>'+      // arm pushing forward
  '</g>'
);

/* hpull — พายเข้าหาลำตัว (row, มุมข้าง) มือดึงกลับ-ยื่นออก */
var HPULL = svg(
  HEAD(56,40)+
  '<line x1="56" y1="49" x2="56" y2="92" '+COMMON+'/>'+        // torso
  '<line x1="46" y1="116" x2="56" y2="92" '+COMMON+'/>'+       // L leg
  '<line x1="66" y1="116" x2="56" y2="92" '+COMMON+'/>'+       // R leg
  '<g>'+ anim('translate','24 0;0 0;24 0') +
    '<line x1="56" y1="58" x2="86" y2="58" '+COMMON+'/>'+      // arm pulling back
  '</g>'
);

/* core — ครันช์ (นอนแล้วม้วนตัวขึ้น) ลำตัวหมุนขึ้นที่สะโพก */
var CORE = svg(
  '<line x1="96" y1="104" x2="70" y2="104" '+COMMON+'/>'+      // hip-to-knee (thigh on floor-ish)
  '<line x1="70" y1="104" x2="66" y2="80" '+COMMON+'/>'+       // shin up (bent knee)
  '<g>'+ anim('rotate','0 96 104;-42 96 104;0 96 104') +
    '<line x1="96" y1="104" x2="52" y2="104" '+COMMON+'/>'+    // torso lying -> curl up
    HEAD(44,104)+
  '</g>'
);

/* biceps — งอศอก ยกปลายแขนขึ้น (ต้นแขนอยู่กับที่) */
var BICEPS = svg(
  HEAD(70,32)+
  '<line x1="70" y1="41" x2="70" y2="86" '+COMMON+'/>'+        // torso
  '<line x1="60" y1="112" x2="70" y2="86" '+COMMON+'/>'+       // L leg
  '<line x1="80" y1="112" x2="70" y2="86" '+COMMON+'/>'+       // R leg
  '<line x1="70" y1="52" x2="70" y2="80" '+COMMON+'/>'+        // upper arm (fixed)
  '<g>'+ anim('rotate','0 70 80;-125 70 80;0 70 80') +
    '<line x1="70" y1="80" x2="70" y2="106" '+COMMON+'/>'+     // forearm down -> curl up
  '</g>'
);

/* triceps — เหยียดศอก ดันปลายแขนลง (ต้นแขนอยู่กับที่) */
var TRICEPS = svg(
  HEAD(70,32)+
  '<line x1="70" y1="41" x2="70" y2="86" '+COMMON+'/>'+        // torso
  '<line x1="60" y1="112" x2="70" y2="86" '+COMMON+'/>'+       // L leg
  '<line x1="80" y1="112" x2="70" y2="86" '+COMMON+'/>'+       // R leg
  '<line x1="70" y1="52" x2="70" y2="80" '+COMMON+'/>'+        // upper arm (fixed)
  '<g>'+ anim('rotate','-115 70 80;0 70 80;-115 70 80') +
    '<line x1="70" y1="80" x2="70" y2="106" '+COMMON+'/>'+     // forearm bent -> extend down
  '</g>'
);

var PATTERN_SVG = {
  squat: SQUAT, hinge: HINGE,
  vpush: VPUSH, vpull: VPULL,
  hpush: HPUSH, hpull: HPULL,
  core: CORE, biceps: BICEPS, triceps: TRICEPS
};

/* คืน SVG ของ pattern — ไม่รู้จัก pattern = null (ให้ UI จัดการเคสไม่มีภาพเอง ไม่เดา) */
function svgFor(pattern){
  return Object.prototype.hasOwnProperty.call(PATTERN_SVG, pattern) ? PATTERN_SVG[pattern] : null;
}

global.GymBroExerciseAnim = { svgFor: svgFor, PATTERN_SVG: PATTERN_SVG };

})(typeof window!=='undefined' ? window : this);
