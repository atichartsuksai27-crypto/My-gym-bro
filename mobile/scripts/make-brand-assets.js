/* สร้าง app icon + splash ทุกขนาดที่ Android/iOS ต้องการ ด้วยโค้ดล้วนๆ
   ------------------------------------------------------------------
   ไม่พึ่งไลบรารีภายนอกและไม่พึ่งไฟล์ภาพต้นฉบับจากที่อื่น — เขียน PNG เองผ่าน zlib ที่มากับ Node
   (เข้ากับโปรเจกต์นี้ที่ไม่มี build step / ไม่มี dependency ฝั่งเว็บ) และเพราะมาร์คถูกนิยาม
   เป็น "สูตร" ไม่ใช่บิตแมป จึง render ตรงที่ความละเอียดจริงของทุกไฟล์ คมกว่าการย่อจากรูปเดียว
   (ทางเลือกมาตรฐานคือ @capacitor/assets แต่ต้องพึ่ง sharp ซึ่งเป็น native binary + install script)

   ถ้าจะเปลี่ยนสีแบรนด์: แก้ COLORS ให้ตรงกับตัวแปรใน style.css แล้วรันใหม่
   ถ้าจะเปลี่ยนรูปมาร์ค: แก้ฟังก์ชัน dumbbell()

   รัน: npm run brand   (จากโฟลเดอร์ mobile/)

   เขียนทับไฟล์เหล่านี้ (ขนาดตรงกับที่ Capacitor scaffold ไว้เป๊ะๆ ไม่แตะโครงสร้าง/XML อื่น
   ยกเว้นสีพื้น adaptive icon ที่ values/ic_launcher_background.xml):
     android  mipmap-ทุก dpi: ic_launcher.png, ic_launcher_round.png, ic_launcher_foreground.png
              drawable-xxx/splash.png (+ ชุด -night ที่เพิ่มใหม่ สำหรับธีมมืดบนเครื่องรุ่นเก่า)
     ios      Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png
              Assets.xcassets/Splash.imageset/splash-2732x2732*.png
     assets/  ไฟล์ต้นฉบับ 1024/2732 เก็บไว้ให้ดู/ส่งต่อ (Play Store ขอ icon 512 ด้วย)

   หมายเหตุ: Android 12+ (API 31+) ไม่ใช้ splash.png แล้ว ระบบ generate หน้า splash จาก
   launcher icon + สีพื้นให้เอง ดังนั้น icon ที่ถูกต้อง = splash ที่ถูกต้องบนเครื่องสมัยใหม่
   ส่วน splash.png ยังจำเป็นกับ API 30 ลงไป
*/
"use strict";
var fs = require("fs");
var path = require("path");
var zlib = require("zlib");

/* สีเดียวกับตัวแปรใน style.css */
var COLORS = {
  accent:     [0x25, 0x63, 0xeb], // --accent (light)
  accentDark: [0x5b, 0x8d, 0xef], // --accent (dark)
  ink:        [0xff, 0xff, 0xff], // --accent-ink
  bgLight:    [0xfa, 0xfa, 0xfa], // --bg (light)
  bgDark:     [0x12, 0x12, 0x12]  // --bg (dark)
};
function hex(rgb){
  return "#" + rgb.map(function(v){ return ("0"+v.toString(16)).slice(-2).toUpperCase(); }).join("");
}

/* ---------- PNG encoder (RGBA 8-bit) ---------- */
var CRC_TABLE = (function(){
  var t = new Int32Array(256), c, n, k;
  for(n=0; n<256; n++){
    c = n;
    for(k=0; k<8; k++) c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    t[n] = c;
  }
  return t;
})();
function crc32(buf){
  var c = -1;
  for(var i=0; i<buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  return (c ^ -1) >>> 0;
}
function chunk(type, data){
  var len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0);
  var body = Buffer.concat([Buffer.from(type, "ascii"), data]);
  var crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(body), 0);
  return Buffer.concat([len, body, crc]);
}
function encodePNG(rgba, w, h){
  var raw = Buffer.alloc((w*4 + 1) * h);
  for(var y=0; y<h; y++){
    raw[y*(w*4+1)] = 0;                                    // filter type 0 (none)
    rgba.copy(raw, y*(w*4+1)+1, y*w*4, y*w*4 + w*4);
  }
  var ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4);
  ihdr[8] = 8;   // bit depth
  ihdr[9] = 6;   // color type RGBA
  return Buffer.concat([
    Buffer.from([0x89,0x50,0x4e,0x47,0x0d,0x0a,0x1a,0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", zlib.deflateSync(raw, {level:9})),
    chunk("IEND", Buffer.alloc(0))
  ]);
}

/* ---------- canvas + anti-alias แบบ supersample 4x4 ---------- */
function Canvas(w, h, bg){
  this.w = w; this.h = h;
  this.buf = Buffer.alloc(w*h*4);
  if(bg){                                   // ไม่ส่ง bg = พื้นโปร่งใส
    for(var i=0; i<w*h; i++){
      this.buf[i*4]=bg[0]; this.buf[i*4+1]=bg[1]; this.buf[i*4+2]=bg[2]; this.buf[i*4+3]=255;
    }
  }
}
Canvas.prototype.blend = function(x, y, rgb, a){
  if(a <= 0) return;
  var i = (y*this.w + x) * 4;
  var da = this.buf[i+3] / 255;
  var outA = a + da*(1-a);
  for(var c=0; c<3; c++){
    var src = rgb[c]/255, dst = this.buf[i+c]/255;
    this.buf[i+c] = Math.round(((src*a + dst*da*(1-a)) / outA) * 255);
  }
  this.buf[i+3] = Math.round(outA*255);
};
/* วาด union ของ rounded rect หลายก้อน — supersample เฉพาะกรอบที่ครอบคลุมจริง
   (สำคัญกับผืนใหญ่อย่าง splash 2732px ไม่งั้นช้ามาก) */
Canvas.prototype.draw = function(rects, rgb){
  var S = 4;
  var minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  rects.forEach(function(r){
    minX = Math.min(minX, r.cx - r.w/2); maxX = Math.max(maxX, r.cx + r.w/2);
    minY = Math.min(minY, r.cy - r.h/2); maxY = Math.max(maxY, r.cy + r.h/2);
  });
  var x0 = Math.max(0, Math.floor(minX)-1), x1 = Math.min(this.w-1, Math.ceil(maxX)+1);
  var y0 = Math.max(0, Math.floor(minY)-1), y1 = Math.min(this.h-1, Math.ceil(maxY)+1);
  function inside(px, py){
    for(var k=0; k<rects.length; k++){
      var r = rects[k];
      var dx = Math.max(Math.abs(px - r.cx) - (r.w/2 - r.r), 0);
      var dy = Math.max(Math.abs(py - r.cy) - (r.h/2 - r.r), 0);
      if(dx*dx + dy*dy <= r.r*r.r) return true;
    }
    return false;
  }
  for(var y=y0; y<=y1; y++){
    for(var x=x0; x<=x1; x++){
      var hit = 0;
      for(var sy=0; sy<S; sy++) for(var sx=0; sx<S; sx++){
        if(inside(x + (sx+0.5)/S, y + (sy+0.5)/S)) hit++;
      }
      if(hit) this.blend(x, y, rgb, hit/(S*S));
    }
  }
};

/* ---------- รูปทรง ---------- */
/* ดัมเบลล์กึ่งกลางผืน — scale = ความกว้างมาร์คเทียบด้านสั้นของผืน */
function dumbbell(w, h, scale){
  var cx = w/2, cy = h/2;
  var u = (Math.min(w, h) * scale) / 664;      // 664 = ความกว้างมาร์คในหน่วยออกแบบ
  function R(ox, oy, rw, rh, r){
    return {cx:cx + ox*u, cy:cy + oy*u, w:rw*u, h:rh*u, r:r*u};
  }
  return [
    R(-296, 0,  72, 180, 26),   // ปลายซ้ายนอกสุด
    R(-206, 0, 108, 300, 34),   // แผ่นน้ำหนักซ้าย
    R(   0, 0, 304,  76, 32),   // คานกลาง
    R( 206, 0, 108, 300, 34),   // แผ่นน้ำหนักขวา
    R( 296, 0,  72, 180, 26)    // ปลายขวานอกสุด
  ];
}
/* วงกลมเต็มผืน = rounded rect ที่รัศมี = ครึ่งด้าน */
function circle(size){
  return [{cx:size/2, cy:size/2, w:size, h:size, r:size/2}];
}

/* ---------- ตัวสร้างภาพแต่ละแบบ ---------- */
function iconFull(size){                       // เต็มใบ พื้น accent + ดัมเบลล์ขาว (iOS ห้ามมี alpha)
  var c = new Canvas(size, size, COLORS.accent);
  c.draw(dumbbell(size, size, 0.66), COLORS.ink);
  return c;
}
function iconRound(size){                      // วงกลม accent + ดัมเบลล์ขาว พื้นโปร่ง
  var c = new Canvas(size, size, null);
  c.draw(circle(size), COLORS.accent);
  c.draw(dumbbell(size, size, 0.60), COLORS.ink);
  return c;
}
function iconForeground(size){                 // ชั้นหน้าของ adaptive icon — ต้องอยู่ในโซนปลอดภัย
  var c = new Canvas(size, size, null);        // (Android ครอบหน้ากากกินขอบนอกราว 1/3 ของผืน)
  c.draw(dumbbell(size, size, 0.50), COLORS.ink);
  return c;
}
function splash(w, h, dark, scale){
  var c = new Canvas(w, h, dark ? COLORS.bgDark : COLORS.bgLight);
  c.draw(dumbbell(w, h, scale), dark ? COLORS.accentDark : COLORS.accent);
  return c;
}

/* ---------- เขียนไฟล์ ---------- */
var MOBILE = path.join(__dirname, "..");
var count = 0;
function write(relPath, canvas){
  var file = path.join(MOBILE, relPath);
  fs.mkdirSync(path.dirname(file), {recursive:true});
  fs.writeFileSync(file, encodePNG(canvas.buf, canvas.w, canvas.h));
  count++;
  console.log("  " + (canvas.w + "x" + canvas.h).padEnd(11) + relPath.split(path.sep).join("/"));
}

console.log("[brand] ไฟล์ต้นฉบับ (assets/)");
write(path.join("assets", "icon.png"),            iconFull(1024));
write(path.join("assets", "icon-foreground.png"), iconForeground(1024));
write(path.join("assets", "icon-background.png"), new Canvas(1024, 1024, COLORS.accent));
write(path.join("assets", "icon-512.png"),        iconFull(512));   // Play Store ขอขนาดนี้ตอนส่งแอป
write(path.join("assets", "splash.png"),          splash(2732, 2732, false, 0.22));
write(path.join("assets", "splash-dark.png"),     splash(2732, 2732, true,  0.22));

console.log("[brand] Android launcher icon");
var RES = path.join("android", "app", "src", "main", "res");
[["mdpi",48,108],["hdpi",72,162],["xhdpi",96,216],["xxhdpi",144,324],["xxxhdpi",192,432]]
.forEach(function(d){
  var dpi = d[0], legacy = d[1], fg = d[2];
  write(path.join(RES, "mipmap-"+dpi, "ic_launcher.png"),            iconFull(legacy));
  write(path.join(RES, "mipmap-"+dpi, "ic_launcher_round.png"),      iconRound(legacy));
  write(path.join(RES, "mipmap-"+dpi, "ic_launcher_foreground.png"), iconForeground(fg));
});

console.log("[brand] Android splash (API 30 ลงไป — 12+ ใช้ launcher icon แทน)");
var SPLASHES = [
  ["drawable",              480,  320],
  ["drawable-land-mdpi",    480,  320],
  ["drawable-land-hdpi",    800,  480],
  ["drawable-land-xhdpi",  1280,  720],
  ["drawable-land-xxhdpi", 1600,  960],
  ["drawable-land-xxxhdpi",1920, 1280],
  ["drawable-port-mdpi",    320,  480],
  ["drawable-port-hdpi",    480,  800],
  ["drawable-port-xhdpi",   720, 1280],
  ["drawable-port-xxhdpi",  960, 1600],
  ["drawable-port-xxxhdpi",1280, 1920]
];
SPLASHES.forEach(function(s){
  write(path.join(RES, s[0], "splash.png"), splash(s[1], s[2], false, 0.34));
  /* ชุดธีมมืด: Android เลือก -night ให้เองเมื่อเปิดโหมดมืด ไม่ต้องแก้ XML ใดๆ
     ลำดับ qualifier ห้ามสลับ — ต้องเป็น orientation → night → density
     (drawable-land-night-hdpi ถูก, drawable-night-land-hdpi ผิด build ไม่ผ่าน) */
  var night = s[0] === "drawable"
    ? "drawable-night"
    : s[0].replace(/^(drawable-(?:land|port))-/, "$1-night-");
  write(path.join(RES, night, "splash.png"), splash(s[1], s[2], true, 0.34));
});

console.log("[brand] iOS");
var XC = path.join("ios", "App", "App", "Assets.xcassets");
write(path.join(XC, "AppIcon.appiconset", "AppIcon-512@2x.png"), iconFull(1024));
["splash-2732x2732.png", "splash-2732x2732-1.png", "splash-2732x2732-2.png"].forEach(function(n){
  write(path.join(XC, "Splash.imageset", n), splash(2732, 2732, false, 0.22));
});

/* สีพื้นชั้นหลังของ adaptive icon — mipmap-anydpi-v26/ic_launcher.xml อ้าง @color ตัวนี้อยู่
   (default ของ Capacitor เป็น #FFFFFF ทำให้ดัมเบลล์ขาวหายไปกับพื้น) */
var COLOR_XML = path.join(MOBILE, RES, "values", "ic_launcher_background.xml");
fs.writeFileSync(COLOR_XML,
  '<?xml version="1.0" encoding="utf-8"?>\n' +
  "<resources>\n" +
  '    <color name="ic_launcher_background">' + hex(COLORS.accent) + "</color>\n" +
  "</resources>\n");
console.log("[brand] adaptive icon background -> " + hex(COLORS.accent));

console.log("[brand] done — " + count + " ไฟล์");
