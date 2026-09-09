/* คัดลอกไฟล์เว็บจากรากโปรเจกต์ (../) เข้ามาที่ mobile/www/ ตรงๆ ไม่มี build/bundle/แก้ไข
   เนื้อหาใดๆ ทั้งสิ้น — โครงสร้างเดิมของเว็บ (index.html/app.js/calculations.js/
   benchmarks.js/style.css/supabase-client.js) ยังคงเป็น single source of truth อยู่ที่
   รากโปรเจกต์เหมือนเดิม ไฟล์ในโฟลเดอร์นี้เป็นแค่สำเนาที่ generate ขึ้นมาให้ Capacitor
   เอาไปฝังใน native project เท่านั้น (www/ ถูก .gitignore ไว้ ไม่ commit)
   รันด้วย: npm run sync-web (หรือ npm run cap:sync เพื่อ sync-web แล้วตามด้วย cap sync) */
"use strict";
var fs = require("fs");
var path = require("path");

var ROOT = path.join(__dirname, "..", "..");   // รากโปรเจกต์ (d:\Gym bro)
var OUT = path.join(__dirname, "..", "www");   // mobile/www

// รายชื่อไฟล์เว็บที่ index.html ใช้จริง — คัดลอกแบบ 1:1 ไม่ต้องเดา ไม่ต้อง glob
// ทั้งโฟลเดอร์ (กัน supabase/, functions/, tests/, knowledge/ ฯลฯ หลุดติดไปโดยไม่ตั้งใจ)
var FILES = [
  "index.html",
  "style.css",
  "app.js",
  "calculations.js",
  "benchmarks.js",
  "supabase-client.js"
];

function copyOne(name){
  var src = path.join(ROOT, name);
  var dest = path.join(OUT, name);
  if(!fs.existsSync(src)){
    console.error("[sync-web] MISSING at project root, skipped: " + name);
    return false;
  }
  fs.copyFileSync(src, dest);
  console.log("[sync-web] copied " + name);
  return true;
}

fs.mkdirSync(OUT, { recursive: true });
var ok = true;
FILES.forEach(function(name){ if(!copyOne(name)) ok = false; });
if(!ok){
  console.error("[sync-web] เสร็จแบบมีไฟล์ขาดหาย ตรวจชื่อไฟล์ด้านบนอีกครั้ง");
  process.exit(1);
}
console.log("[sync-web] done -> " + OUT);
