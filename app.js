(function(){
"use strict";

/* ============================================================
   Gymbro Daily — เว็บไซต์แบบสแตนด์อโลน (static site)
   พอร์ตมาจากต้นแบบ Claude Artifact เดิม ตัดการพึ่งพาระบบ Artifact ออกทั้งหมด
   ข้อมูลทั้งหมดเก็บใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น (ยังไม่มี backend/บัญชีผู้ใช้):
     gymbro_program   → แผนที่ล็อกไว้ตอนกด "เริ่มโปรแกรม" (สแนปช็อตของตาราง + เป้าหมายโภชนาการ/การนอน)
     gymbro_logs      → บันทึกรายวันทั้งหมด { "YYYY-MM-DD": {...} }
     gymbro_weights   → น้ำหนักตัวที่ชั่งแต่ละวัน { "YYYY-MM-DD": {date, kg} }
     gymbro_onb_proto → ความคืบหน้าของแบบสอบถามระหว่างตอบ (resume ได้ถ้าปิดแท็บกลางคัน)
   นี่คือ UI/UX แบบพื้นฐาน (ยังไม่ได้ผ่านการออกแบบจริง) — คลาส CSS ตั้งใจทำให้เรียบง่ายและคงที่
   เพื่อรอนำไปออกแบบใหม่ทีหลังโดยไม่ต้องแก้โครงสร้าง HTML/JS นี้
   ============================================================ */

function lsGet(key, fallback){
  try{
    var v = localStorage.getItem(key);
    return v==null ? fallback : JSON.parse(v);
  }catch(e){ return fallback; }
}
function lsSet(key, val){
  try{ localStorage.setItem(key, JSON.stringify(val)); return true; }
  catch(e){ return false; }
}
function lsRemove(key){ try{ localStorage.removeItem(key); }catch(e){} }

var STORAGE_OK = (function(){
  try{ var k="__gymbro_probe__"; localStorage.setItem(k,"1"); localStorage.removeItem(k); return true; }
  catch(e){ return false; }
})();

/* ---------- multi-user (Supabase) — เลเยอร์ sync บนของเดิม ----------
   local-first เสมอ: อ่าน/เขียนหน้าเว็บยังใช้ localStorage แบบเดิมทุกจุด ไม่บล็อก
   UI รอ network เลย — sync ขึ้น Supabase เป็น background fire-and-forget
   หลัง localStorage เขียนสำเร็จแล้วเท่านั้น ถ้า Supabase โหลดไม่ได้ (ออฟไลน์/บล็อก)
   แอปยังใช้งานได้ปกติแบบเดิมเป๊ะ (local-only) — ไม่มีอะไรพังถ้า GymBroSync ไม่พร้อม */
var auth = {session:null, ready:false};
var authState = {error:null, busy:false};
function syncOn(){ return syncAvailable() && !!auth.session; }

var CATEGORIES = [
  {id:1, name:"เป้าหมาย + Time Feasibility", short:"เป้าหมาย"},
  {id:2, name:"ข้อมูลร่างกาย", short:"ร่างกาย"},
  {id:3, name:"ประสบการณ์ออกกำลังกาย", short:"ประสบการณ์"},
  {id:4, name:"สภาพแวดล้อมการฝึก", short:"สภาพแวดล้อม"},
  {id:5, name:"ช่วงเวลาที่สะดวก", short:"ช่วงเวลา"},
  {id:6, name:"สุขภาพและข้อจำกัด", short:"สุขภาพ"},
  {id:7, name:"โภชนาการและอาหาร", short:"โภชนาการ"},
  {id:8, name:"ไลฟ์สไตล์และการพักฟื้น", short:"ไลฟ์สไตล์"},
  {id:9, name:"Preference การใช้แอป", short:"Preference"}
];

var DAYS = ["จันทร์","อังคาร","พุธ","พฤหัสบดี","ศุกร์","เสาร์","อาทิตย์"];
var DAYS_SHORT = ["จ","อ","พ","พฤ","ศ","ส","อา"];

var BENCH = {
  "ลดไขมัน":               {days:[4,5],  mins:[45,60], label:"4-5 วัน/สัปดาห์ ครั้งละ 45-60 นาที"},
  "เพิ่มกล้ามเนื้อ":         {days:[4,6],  mins:[45,75], label:"4-6 วัน/สัปดาห์ ครั้งละ 45-75 นาที"},
  "Recomposition (ลด+เพิ่มพร้อมกัน)": {days:[4,5], mins:[45,60], label:"4-5 วัน/สัปดาห์ ครั้งละ 45-60 นาที"},
  "รักษาสุขภาพทั่วไป":       {days:[3,3],  mins:[30,45], label:"3 วัน/สัปดาห์ ครั้งละ 30-45 นาที"},
  "เพิ่มความแข็งแรง-Performance": {days:[3,5], mins:[60,90], label:"3-5 วัน/สัปดาห์ ครั้งละ 60-90 นาที"},
  "เดิน-วิ่ง (Cardio)":      {days:[3,5],  mins:[20,45], label:"3-5 วัน/สัปดาห์ ครั้งละ 20-45 นาที"}
};
var Q3_MIN = {"น้อยกว่า 20 นาที":15, "20-45 นาที":32, "45-60 นาที":52, "มากกว่า 60 นาที":70};

/* ลำดับตั้งใจ: Q9(เพศ) → Q0(เลือกรูปร่าง/ไขมันด้วยภาพ) → Q2/Q3(วัน/เวลาที่มี) → Q1(เป้าหมาย)
   — ทั้งหมดอยู่ใน cat:1 เดียวกัน (แสดงหน้าเดียวกันเสมอ) ลำดับใน array นี้คือลำดับที่ขึ้น
   จริงบนจอ ต้องรู้เพศ (Q9) ก่อนถึงจะเลือกชุดภาพถูก (Q0) — Q9 ย้ายมาจาก cat:2 เดิม
   (a.Q9 ยังเป็น data key เดิม โค้ดจุดอื่นที่อ่าน a.Q9 ไม่ต้องแก้อะไร)
   Q0 ที่เลือกไว้ใช้แนะนำเป้าหมายที่เข้ากันใน Q1 ด้วย (ดู BODYFAT_GOAL_MAP) — เป็นแค่
   คำแนะนำ ไม่บังคับเลือกตาม กดเป้าหมายอื่นได้ปกติเสมอ */
var QUESTIONS = [
  {id:"Q9", cat:1, kind:"single", main:true, label:"เพศ", options:["ชาย","หญิง"], visible:function(){return true;}},

  {id:"Q0", cat:1, kind:"bodyfat", main:true, label:"เลือกรูปร่างที่ใกล้เคียงกับคุณตอนนี้",
    visible:function(a){return a.Q9==="ชาย" || a.Q9==="หญิง";}},

  {id:"Q2", cat:1, kind:"multi", main:true, label:"วันไหนบ้างที่คุณว่างสำหรับออกกำลังกาย?",
    options:DAYS, note:"multi-select — เลือกได้หลายวัน", visible:function(){return true;}},

  {id:"Q3", cat:1, kind:"single", main:true, label:"โดยเฉลี่ยแต่ละครั้งคุณมีเวลาเท่าไหร่?",
    options:["น้อยกว่า 20 นาที","20-45 นาที","45-60 นาที","มากกว่า 60 นาที"], visible:function(){return true;}},

  {id:"Q1", cat:1, kind:"single", main:true, label:"เป้าหมายหลักของคุณตอนนี้คืออะไร?",
    options:Object.keys(BENCH), visible:function(){return true;}},

  {id:"Q4a", cat:1, kind:"single", main:false, branchFrom:"Q1 = ลดไขมัน",
    label:"ต้องการลดแบบเข้มข้น (deficit สูง) หรือค่อยเป็นค่อยไป?",
    options:["เข้มข้น","ค่อยเป็นค่อยไป","ไม่แน่ใจให้ระบบแนะนำ"],
    visible:function(a){return a.Q1==="ลดไขมัน";}},
  {id:"Q4b", cat:1, kind:"single", main:false, branchFrom:"Q1 = ลดไขมัน",
    label:"มีเป้าหมายน้ำหนัก/เปอร์เซ็นต์ไขมันที่อยากถึงไหม?",
    options:["ระบุตัวเลข","ยังไม่มีเป้าหมายชัดเจน"],
    visible:function(a){return a.Q1==="ลดไขมัน";}},
  {id:"Q4c", cat:1, kind:"single", main:false, branchFrom:"Q1 = ลดไขมัน",
    label:"เคยลดน้ำหนักแล้วกลับมาอ้วนซ้ำ (yo-yo) บ่อยไหม?",
    options:["บ่อย","เคยครั้งสองครั้ง","ไม่เคย"],
    visible:function(a){return a.Q1==="ลดไขมัน";}},

  {id:"Q5a", cat:1, kind:"multi", main:false, branchFrom:"Q1 = เพิ่มกล้ามเนื้อ",
    label:"เน้นส่วนไหนเป็นพิเศษไหม?", note:"multi-select — เลือกได้หลายส่วน",
    options:["อก","หลัง","ขา","ไหล่","แขน","ไม่เน้นส่วนไหนเป็นพิเศษ"],
    exclusiveOption:"ไม่เน้นส่วนไหนเป็นพิเศษ", // เลือกตัวนี้แล้วเลือกส่วนอื่นพร้อมกันไม่ได้ (และกลับกัน)
    visible:function(a){return a.Q1==="เพิ่มกล้ามเนื้อ";}},
  {id:"Q5b", cat:1, kind:"single", main:false, branchFrom:"Q1 = เพิ่มกล้ามเนื้อ",
    label:"ยอมรับไขมันขึ้นเล็กน้อยระหว่างสร้างกล้ามได้ไหม?",
    options:["ได้ (เน้นสร้างกล้ามให้เร็ว)","ไม่ได้ (อยากคุมไขมันไปด้วย)"],
    visible:function(a){return a.Q1==="เพิ่มกล้ามเนื้อ";}},

  {id:"Q6", cat:1, kind:"single", main:false, branchFrom:"Q1 = Recomposition",
    label:"น้ำหนักและรูปร่างตอนนี้ใกล้เคียงเป้าหมายแค่ไหน?",
    options:["ห่างมาก","ห่างปานกลาง","ใกล้เป้าหมายแล้ว"],
    visible:function(a){return a.Q1==="Recomposition (ลด+เพิ่มพร้อมกัน)";}},

  {id:"Q7", cat:1, kind:"single", main:false, branchFrom:"Q1 = เพิ่มความแข็งแรง/Performance",
    label:"เน้นแบบไหน?",
    options:["แรงสูงสุด (max strength)","กำลังระเบิด (power)","ความทนทานกล้ามเนื้อ (endurance)"],
    visible:function(a){return a.Q1==="เพิ่มความแข็งแรง-Performance";}},

  {id:"Q10", cat:2, kind:"number", main:true, required:true, label:"อายุ", unit:"ปี", visible:function(){return true;}},
  {id:"Q11", cat:2, kind:"number", main:true, required:true, label:"ส่วนสูง", unit:"cm", visible:function(){return true;}},
  {id:"Q12", cat:2, kind:"number", main:true, required:true, label:"น้ำหนักปัจจุบัน", unit:"kg", visible:function(){return true;}},
  {id:"Q13", cat:2, kind:"single", main:true, label:"น้ำหนักเป้าหมาย (ถ้ามี)",
    options:["ระบุ","ยังไม่มีเป้าหมายตัวเลข"], visible:function(){return true;}},
  {id:"Q14", cat:2, kind:"single", main:true, label:"ทราบเปอร์เซ็นต์ไขมันตัวเองไหม?",
    options:["ทราบ (กรอกตัวเลข)","ไม่ทราบแต่มีรอบเอว-รอบคอ-รอบสะโพกให้คำนวณ","ไม่ทราบและไม่กรอกตอนนี้"],
    visible:function(){return true;}},
  {id:"Q15", cat:2, kind:"single", main:false, branchFrom:"น้ำหนักปัจจุบัน vs เป้าหมาย ต่างกัน >15%",
    label:"เคยปรึกษาแพทย์เกี่ยวกับการเปลี่ยนแปลงน้ำหนักนี้หรือยัง?",
    options:["ปรึกษาแล้ว","ยังไม่ได้ปรึกษา","ไม่จำเป็นในกรณีของฉัน"],
    visible:function(a){
      var cur=parseFloat(a.Q12), tgt=parseFloat(a.Q13_val);
      if(a.Q13!=="ระบุ" || !cur || !tgt) return false;
      return Math.abs(cur-tgt)/cur > 0.15;
    }},

  {id:"Q16", cat:3, kind:"single", main:true, label:"ระดับประสบการณ์ปัจจุบัน?",
    options:["มือใหม่","เคยออกบ้าง","ออกกำลังกายประจำ","นักกีฬา-เทรนมานาน"], visible:function(){return true;}},
  {id:"Q17", cat:3, kind:"single", main:false, branchFrom:"Q16 = ออกกำลังกายประจำ/นักกีฬา",
    label:"โปรแกรมปัจจุบันเป็นรูปแบบไหน?",
    options:["Push-Pull-Legs","Full body","Bro split","อื่นๆ","ไม่มีโปรแกรมชัดเจน"],
    visible:function(a){return a.Q16==="ออกกำลังกายประจำ"||a.Q16==="นักกีฬา-เทรนมานาน";}},
  {id:"Q18", cat:3, kind:"single", main:false, branchFrom:"Q16 = ออกกำลังกายประจำ/นักกีฬา",
    label:"รู้ค่า 1RM โดยประมาณของ squat/bench/deadlift ไหม?",
    options:["รู้ (กรอกตัวเลข)","ไม่รู้"],
    visible:function(a){return a.Q16==="ออกกำลังกายประจำ"||a.Q16==="นักกีฬา-เทรนมานาน";}},
  {id:"Q19", cat:3, kind:"number", main:false, branchFrom:"Q16 = ออกกำลังกายประจำ/นักกีฬา", unit:"วัน/สัปดาห์",
    label:"ต้องการออกกำลังกายกี่วัน/สัปดาห์? (รวมทั้ง weight และ cardio)",
    visible:function(a){return a.Q16==="ออกกำลังกายประจำ"||a.Q16==="นักกีฬา-เทรนมานาน";}},

  {id:"Q20", cat:4, kind:"single", main:true, label:"ปกติออกกำลังกายที่ไหน?",
    options:["ที่บ้าน","ฟิตเนส-ยิม","กลางแจ้ง-สวนสาธารณะ","ผสมผสาน"], visible:function(){return true;}},
  {id:"Q21", cat:4, kind:"multi", main:false, branchFrom:"Q20 = ที่บ้าน / ผสมผสาน",
    label:"มีอุปกรณ์อะไรบ้าง?", note:"multi-select",
    options:["ดัมเบล","บาร์เบล","ยางยืด","ม้านั่ง","บาร์โหน","สเต็ปเปอร์","ลูกบอลโยคะ",
      "ลูกกลิ้งบริหารหน้าท้อง","เชือกกระโดด","ฮูลาฮูป","เสื่อโยคะ","ไม่มีอุปกรณ์เลย"],
    exclusiveOption:"ไม่มีอุปกรณ์เลย", // N-01: เลือกตัวนี้แล้วต้องเลือกอุปกรณ์อื่นพร้อมกันไม่ได้
    visible:function(a){return a.Q20==="ที่บ้าน"||a.Q20==="ผสมผสาน";}},
  {id:"Q22", cat:4, kind:"single", main:false, branchFrom:"Q20 = ฟิตเนส-ยิม / ผสมผสาน",
    label:"ยิมที่ใช้มีอุปกรณ์ครบไหม?",
    options:["ครบมาก","ปานกลาง","จำกัด"],
    visible:function(a){return a.Q20==="ฟิตเนส-ยิม"||a.Q20==="ผสมผสาน";}},

  {id:"Q24", cat:5, kind:"single", main:true, label:"ช่วงเวลาไหนที่สะดวกออกกำลังกายที่สุด?",
    options:["เช้า","บ่าย","เย็น-ค่ำ","ไม่แน่นอนแล้วแต่วัน"], visible:function(){return true;}},

  {id:"Q25", cat:6, kind:"single", main:true,
    label:"มีอาการบาดเจ็บ, โรคประจำตัว, หรือข้อจำกัดทางร่างกายที่ส่งผลต่อการออกกำลังกายหรือไม่?",
    options:["มี","ไม่มี"], visible:function(){return true;}},
  {id:"Q26", cat:6, kind:"multi", main:false, branchFrom:"Q25 = มี", note:"multi-select",
    label:"ตำแหน่ง/ลักษณะอาการ?",
    options:["หลัง","เข่า","ไหล่","ข้อมือ","หัวใจ-หลอดเลือด","อื่นๆ ระบุ"],
    visible:function(a){return a.Q25==="มี";}},
  {id:"Q27", cat:6, kind:"text", main:false, branchFrom:"Q25 = มี",
    label:"มีท่าหรือการเคลื่อนไหวที่ต้องหลีกเลี่ยงไหม?",
    visible:function(a){return a.Q25==="มี";}},
  {id:"Q28", cat:6, kind:"single", main:false, branchFrom:"Q25 = มี",
    label:"ได้รับอนุญาตจากแพทย์ให้ออกกำลังกายแล้วหรือยัง?",
    options:["ได้รับอนุญาตแล้ว","ยังไม่ได้ปรึกษา","ปรึกษาแล้วแต่แพทย์ไม่อนุญาต"],
    visible:function(a){return a.Q25==="มี";}},

  {id:"Q29", cat:7, kind:"single", main:true, label:"รูปแบบการกิน?",
    options:["ทั่วไป","มังสวิรัติ","วีแกน","ฮาลาล"], visible:function(){return true;}},
  {id:"Q30", cat:7, kind:"text", main:true, label:"อาหารที่แพ้หรือกินไม่ได้?", visible:function(){return true;}},
  {id:"Q31", cat:7, kind:"single", main:true, label:"จำนวนมื้อที่สะดวกทำต่อวัน?",
    options:["2 มื้อ","3 มื้อ","4-5 มื้อ","ไม่แน่นอน"], visible:function(){return true;}},
  {id:"Q32", cat:7, kind:"single", main:true, label:"งบประมาณค่าอาหารโดยประมาณ?",
    options:["ประหยัด","ปานกลาง","ไม่จำกัด"], visible:function(){return true;}},
  {id:"Q34", cat:7, kind:"single", main:false, branchFrom:"Q29 = มังสวิรัติ/วีแกน",
    label:"แหล่งโปรตีนทดแทนที่กินได้/สะดวกซื้อ?",
    options:["ถั่ว","เต้าหู้","เวย์จากพืช","อื่นๆ"],
    visible:function(a){return a.Q29==="มังสวิรัติ"||a.Q29==="วีแกน";}},
  {id:"Q35", cat:7, kind:"single", main:true, label:"ชอบทำอาหารเองหรือสั่งสำเร็จรูปเป็นหลัก?",
    options:["ทำเอง","สั่งสำเร็จรูป","ผสมกัน"], visible:function(){return true;}},
  {id:"Q43", cat:7, kind:"single", main:true, label:"ปริมาณน้ำที่ดื่มต่อวันโดยประมาณ?",
    options:["น้อยกว่า 1 ลิตร","1-2 ลิตร","2-3 ลิตร","มากกว่า 3 ลิตร"], visible:function(){return true;}},
  {id:"Q44", cat:7, kind:"single", main:true, label:"กินอาหารเสริมประเภทเวย์โปรตีน (whey protein) อยู่แล้วหรือไม่?",
    options:["กินอยู่แล้วเป็นประจำ","กินบ้างบางครั้ง","ไม่ได้กิน","ไม่แน่ใจว่าคืออะไร"], visible:function(){return true;}},

  {id:"Q36", cat:8, kind:"single", main:true, label:"ลักษณะงาน/กิจกรรมนอกเวลาออกกำลังกาย?",
    options:["นั่งโต๊ะเป็นหลัก","ยืน-เดินเยอะ","ใช้แรงงาน"], visible:function(){return true;}},
  {id:"Q37", cat:8, kind:"number", main:true, required:true, unit:"ชม./คืน", label:"ชั่วโมงนอนเฉลี่ยต่อคืน?", visible:function(){return true;}},
  {id:"Q39", cat:8, kind:"single", main:false, branchFrom:"Q37 < 6 ชม.",
    label:"ต้องการคำแนะนำ sleep hygiene เบื้องต้นในแอปด้วยไหม?",
    options:["ต้องการ","ไม่ต้องการตอนนี้"],
    visible:function(a){var h=parseFloat(a.Q37); return !!h && h<6;}},

  {id:"Q40", cat:9, kind:"single", main:true, label:"สไตล์การแจ้งเตือน/coaching ที่ชอบ?",
    options:["เข้มงวด-กดดัน","กันเอง-ให้กำลังใจ","ข้อมูลล้วนไม่ต้องมีอารมณ์"], visible:function(){return true;}},
  {id:"Q41", cat:9, kind:"single", main:true, label:"อยากมี community/challenge ร่วมกับคนอื่นไหม?",
    options:["อยาก","ไม่อยาก","ยังไม่แน่ใจ"], visible:function(){return true;}},
  {id:"Q42", cat:9, kind:"single", main:true, label:"วิธีติดตามผลที่อยากใช้?",
    options:["ตัวเลขน้ำหนัก","ความแข็งแรงที่ยกได้","ทั้งสองอย่าง"], visible:function(){return true;}}
];

/* ============================================================
   GENERATOR — Split-Feasibility Filter + Default Exercise Selection
   (ตัวเลข sets/reps/tier ยังเป็น placeholder รอผู้เชี่ยวชาญ review)
   ============================================================ */
var EXERCISES = [
  {id:'sq1',pattern:'squat',tier:1,equip:'bodyweight',th:'Bodyweight Squat',sub:'สควอทน้ำหนักตัว'},
  {id:'sq2',pattern:'squat',tier:2,equip:'dumbbell',th:'Goblet Squat',sub:'สควอทถือดัมเบล'},
  {id:'sq3',pattern:'squat',tier:3,equip:'machine',th:'45-Degree Leg Press',sub:'เลกเพรสมุมเอียง 45 องศา (แบบที่พบบ่อยที่สุดในยิม)'},
  {id:'sq3c',pattern:'squat',tier:3,equip:'machine',th:'Horizontal Leg Press',sub:'เลกเพรสแนวนอน (นั่งดันไปข้างหน้า)'},
  {id:'sq3d',pattern:'squat',tier:3,equip:'machine',th:'Vertical Leg Press',sub:'เลกเพรสแนวตั้ง (นอนหงายดันขึ้นเหนือตัว)'},
  {id:'sq3b',pattern:'squat',tier:3,equip:'stepper',th:'Step-up',sub:'ก้าวขึ้น-ลงสเต็ปเปอร์ (ทางเลือกที่บ้านแทนเครื่องเลกเพรส)'},
  {id:'sq4',pattern:'squat',tier:4,equip:'barbell',th:'Barbell Back Squat',sub:'สควอทบาร์เบล'},

  {id:'hg1b',pattern:'hinge',tier:1,equip:'bodyweight',th:'Single-Leg RDL (น้ำหนักตัว)',sub:'ก้มสะโพกขาเดียวน้ำหนักตัว'},
  {id:'hg2',pattern:'hinge',tier:2,equip:'dumbbell',th:'Romanian Deadlift (Dumbbell)',sub:'RDL ดัมเบล'},
  {id:'hg3c',pattern:'hinge',tier:3,equip:'machine',th:'45-Degree Back Extension',sub:'เครื่องเหยียดหลัง 45 องศา (หลังล่าง/ก้น/หลังขา)'},
  {id:'hg3d',pattern:'hinge',tier:3,equip:'cable',th:'Cable Pull-through',sub:'ดึงเคเบิลลอดขา'},
  {id:'hg4',pattern:'hinge',tier:4,equip:'barbell',th:'Barbell Deadlift',sub:'เดดลิฟต์บาร์เบล'},

  {id:'hg1',pattern:'glute',tier:1,equip:'bodyweight',th:'Glute Bridge',sub:'สะพานสะโพก'},
  {id:'gl2',pattern:'glute',tier:2,equip:'bodyweight',th:'Single-Leg Glute Bridge',sub:'สะพานสะโพกขาเดียว'},
  {id:'gl2b',pattern:'glute',tier:2,equip:'dumbbell',th:'Dumbbell Hip Thrust',sub:'ฮิปทรัสต์ถือดัมเบล'},
  {id:'gl2c',pattern:'glute',tier:2,equip:'cable',th:'Cable Glute Kickback',sub:'เตะขาไปด้านหลังด้วยเคเบิล'},
  {id:'hg3',pattern:'glute',tier:3,equip:'machine',th:'Hip Thrust Machine',sub:'เครื่องฮิปทรัสต์'},
  {id:'hg3b',pattern:'glute',tier:3,equip:'yogaball',th:'Stability Ball Hip Thrust',sub:'สะพานสะโพกบนลูกบอลโยคะ (ทางเลือกที่บ้านแทนเครื่องฮิปทรัสต์)'},
  {id:'gl4',pattern:'glute',tier:4,equip:'barbell',th:'Barbell Hip Thrust',sub:'ฮิปทรัสต์บาร์เบล'},

  {id:'lg1',pattern:'lunge',tier:1,equip:'bodyweight',th:'Reverse Lunge',sub:'ลันจ์ถอยหลังน้ำหนักตัว'},
  {id:'lg2',pattern:'lunge',tier:2,equip:'dumbbell',th:'Dumbbell Split Squat',sub:'สปลิทสควอทถือดัมเบล'},
  {id:'lg2b',pattern:'lunge',tier:2,equip:'bodyweight',th:'Walking Lunge',sub:'ลันจ์เดินน้ำหนักตัว'},
  {id:'lg3',pattern:'lunge',tier:3,equip:'dumbbell',th:'Bulgarian Split Squat (Dumbbell)',sub:'บัลแกเรียนสปลิทสควอท (วางเท้าหลังบนม้านั่ง)'},
  {id:'lg3b',pattern:'lunge',tier:3,equip:'machine',th:'Smith Machine Split Squat',sub:'สปลิทสควอทในเครื่องสมิท'},
  {id:'lg4',pattern:'lunge',tier:4,equip:'barbell',th:'Barbell Walking Lunge',sub:'ลันจ์เดินแบกบาร์เบล'},

  {id:'lc1',pattern:'legcurl',tier:1,equip:'bodyweight',th:'Towel Slider Leg Curl',sub:'นอนหงายงอเข่าดึงผ้าขนหนูบนพื้นลื่น'},
  {id:'lc2',pattern:'legcurl',tier:2,equip:'machine',th:'Lying Leg Curl Machine',sub:'เครื่องงอเข่านอนคว่ำ'},
  {id:'lc2b',pattern:'legcurl',tier:2,equip:'yogaball',th:'Stability Ball Leg Curl',sub:'งอเข่าบนลูกบอลโยคะ'},
  {id:'lc3',pattern:'legcurl',tier:3,equip:'machine',th:'Seated Leg Curl Machine',sub:'เครื่องงอเข่านั่ง'},
  {id:'lc3b',pattern:'legcurl',tier:3,equip:'dumbbell',th:'Prone Dumbbell Leg Curl',sub:'นอนคว่ำหนีบดัมเบลงอเข่า'},
  {id:'lc4',pattern:'legcurl',tier:4,equip:'bodyweight',th:'Nordic Hamstring Curl',sub:'นอร์ดิกเคิร์ล (ต้องมีที่ล็อกข้อเท้า)'},

  {id:'cf1',pattern:'calf',tier:1,equip:'bodyweight',th:'Standing Calf Raise',sub:'เขย่งปลายเท้าน้ำหนักตัว'},
  {id:'cf2',pattern:'calf',tier:2,equip:'bodyweight',th:'Single-Leg Calf Raise',sub:'เขย่งปลายเท้าขาเดียว'},
  {id:'cf2b',pattern:'calf',tier:2,equip:'dumbbell',th:'Dumbbell Calf Raise',sub:'เขย่งปลายเท้าถือดัมเบล'},
  {id:'cf3',pattern:'calf',tier:3,equip:'machine',th:'Seated Calf Raise Machine',sub:'เครื่องเขย่งน่องแบบนั่ง (เน้นน่องชั้นใน)'},
  {id:'cf3b',pattern:'calf',tier:3,equip:'machine',th:'Leg Press Calf Raise',sub:'เขย่งน่องบนเครื่องเลกเพรส'},
  {id:'cf4',pattern:'calf',tier:4,equip:'barbell',th:'Barbell Standing Calf Raise',sub:'เขย่งน่องแบกบาร์เบล'},

  {id:'hp1',pattern:'hpush',tier:1,equip:'bodyweight',th:'Wall Push-up',sub:'พุชอัพกำแพง'},
  {id:'hp2a',pattern:'hpush',tier:2,equip:'bodyweight',th:'Knee Push-up',sub:'พุชอัพคุกเข่า'},
  {id:'hp2b',pattern:'hpush',tier:2,equip:'machine',th:'Chest Press Machine',sub:'เครื่องเชสต์เพรส'},
  {id:'hp3',pattern:'hpush',tier:3,equip:'dumbbell',th:'Dumbbell Bench Press',sub:'เบนช์เพรสดัมเบล'},
  {id:'hp4',pattern:'hpush',tier:4,equip:'barbell',th:'Barbell Bench Press',sub:'เบนช์เพรสบาร์เบล'},

  {id:'ic1',pattern:'incline',tier:1,equip:'cable',th:'Low-to-High Cable Fly (น้ำหนักเบา)',sub:'ดึงเคเบิลจากล่างขึ้นบน เน้นอกบน'},
  {id:'ic2',pattern:'incline',tier:2,equip:'machine',th:'Incline Chest Press Machine',sub:'เครื่องดันอกแบบเอียงขึ้น เน้นอกบน'},
  {id:'ic3',pattern:'incline',tier:3,equip:'dumbbell',th:'Incline Dumbbell Press',sub:'ดันดัมเบลบนม้านั่งเอียง เน้นอกบน'},
  {id:'ic3b',pattern:'incline',tier:3,equip:'bodyweight',th:'Decline Push-up',sub:'พุชอัพยกเท้าสูง เน้นอกบน'},
  {id:'ic4',pattern:'incline',tier:4,equip:'barbell',th:'Incline Barbell Bench Press',sub:'เบนช์เพรสบาร์เบลม้านั่งเอียง'},

  {id:'fl1',pattern:'chestfly',tier:1,equip:'cable',th:'Cable Fly (น้ำหนักเบา)',sub:'กางแขนหนีบอกด้วยเคเบิลเบา'},
  {id:'fl2',pattern:'chestfly',tier:2,equip:'machine',th:'Pec Deck Machine',sub:'เครื่องหนีบอก'},
  {id:'fl3',pattern:'chestfly',tier:3,equip:'dumbbell',th:'Dumbbell Fly',sub:'นอนกางแขนดัมเบล'},
  {id:'fl3b',pattern:'chestfly',tier:3,equip:'cable',th:'Cable Crossover',sub:'ไขว้เคเบิลหนีบอก'},

  {id:'hl1',pattern:'hpull',tier:1,equip:'cable',th:'Seated Cable Row (น้ำหนักเบา)',sub:'พายเคเบิลนั่งเบา'},
  {id:'hl1b',pattern:'hpull',tier:1,equip:'bodyweight',th:'Superman',sub:'เหยียดหลังท่าซุปเปอร์แมน (ไม่ใช้อุปกรณ์)'},
  {id:'hl2',pattern:'hpull',tier:2,equip:'cable',th:'Seated Cable Row',sub:'พายเคเบิลนั่ง'},
  {id:'hl3',pattern:'hpull',tier:3,equip:'dumbbell',th:'Dumbbell Bent-over Row',sub:'ก้มพายดัมเบล'},
  {id:'hl4',pattern:'hpull',tier:4,equip:'barbell',th:'Barbell Bent-over Row',sub:'ก้มพายบาร์เบล'},

  {id:'vl0',pattern:'vpull',tier:1,equip:'bodyweight',th:'Prone Lat Pull (น้ำหนักตัว)',sub:'นอนคว่ำ ยกอกเล็กน้อย ดึงศอกลงข้างลำตัวบีบปีกหลัง (ทางเลือกเมื่อไม่มีบาร์โหน/เครื่อง)'},
  {id:'vl1',pattern:'vpull',tier:1,equip:'machine',th:'Assisted Pull-up Machine',sub:'ดึงข้อช่วยเครื่อง'},
  {id:'vl2',pattern:'vpull',tier:2,equip:'machine',th:'Lat Pulldown',sub:'ดึงลัทดาวน์'},
  {id:'vl3',pattern:'vpull',tier:3,equip:'dumbbell',th:'Dumbbell Pullover',sub:'พูลโอเวอร์ดัมเบล'},
  {id:'vl4',pattern:'vpull',tier:4,equip:'pullupbar',th:'Pull-up',sub:'ดึงข้อ (ต้องมีบาร์โหน)'},

  {id:'vp1',pattern:'vpush',tier:1,equip:'machine',th:'Shoulder Press Machine (น้ำหนักเบา)',sub:'เครื่องดันไหล่เบา'},
  {id:'vp1b',pattern:'vpush',tier:1,equip:'bodyweight',th:'Pike Push-up',sub:'พุชอัพท่าไพค์ เน้นไหล่ (ไม่ใช้อุปกรณ์)'},
  {id:'vp2',pattern:'vpush',tier:2,equip:'machine',th:'Shoulder Press Machine',sub:'เครื่องดันไหล่'},
  {id:'vp3',pattern:'vpush',tier:3,equip:'dumbbell',th:'Dumbbell Shoulder Press',sub:'ดันไหล่ดัมเบล'},
  {id:'vp4',pattern:'vpush',tier:4,equip:'barbell',th:'Barbell Overhead Press',sub:'ดันไหล่บาร์เบลเหนือศีรษะ'},

  {id:'lr1',pattern:'latraise',tier:1,equip:'bodyweight',th:'Lateral Raise (ขวดน้ำ)',sub:'ยกแขนด้านข้างด้วยขวดน้ำ/ของในบ้าน'},
  {id:'lr2',pattern:'latraise',tier:2,equip:'dumbbell',th:'Dumbbell Lateral Raise',sub:'ยกดัมเบลด้านข้าง เน้นไหล่ข้าง'},
  {id:'lr3',pattern:'latraise',tier:3,equip:'cable',th:'Cable Lateral Raise',sub:'ยกเคเบิลด้านข้าง'},
  {id:'lr3b',pattern:'latraise',tier:3,equip:'machine',th:'Machine Lateral Raise',sub:'เครื่องยกไหล่ด้านข้าง'},

  {id:'rd1',pattern:'reardelt',tier:1,equip:'bodyweight',th:'Prone Y-T-W Raise',sub:'นอนคว่ำยกแขนเป็นตัว Y-T-W (ไหล่หลัง/หลังบน)'},
  {id:'rd2',pattern:'reardelt',tier:2,equip:'machine',th:'Reverse Pec Deck',sub:'เครื่องกางแขนไปด้านหลัง เน้นไหล่หลัง'},
  {id:'rd2b',pattern:'reardelt',tier:2,equip:'cable',th:'Face Pull',sub:'ดึงเชือกเคเบิลเข้าหาหน้า'},
  {id:'rd3',pattern:'reardelt',tier:3,equip:'dumbbell',th:'Dumbbell Reverse Fly',sub:'ก้มตัวกางแขนดัมเบล เน้นไหล่หลัง'},

  {id:'co1',pattern:'core',tier:1,equip:'bodyweight',timed:true,th:'Plank',sub:'แพลงก์'},
  {id:'co2',pattern:'core',tier:2,equip:'bodyweight',timed:true,th:'Dead Bug',sub:'เดดบั๊ก'},
  {id:'co3c',pattern:'core',tier:3,equip:'cable',th:'Cable Crunch',sub:'คุกเข่าครันช์ด้วยเคเบิล'},
  {id:'co3b',pattern:'core',tier:3,equip:'abroller',th:'Ab Wheel Rollout',sub:'ล้อโรลหน้าท้อง'},
  {id:'co4',pattern:'core',tier:4,equip:'pullupbar',th:'Hanging Leg Raise',sub:'ยกขาห้อยตัว (ต้องมีบาร์โหน)'},

  {id:'ob1',pattern:'oblique',tier:1,equip:'bodyweight',timed:true,th:'Side Plank',sub:'แพลงก์ด้านข้าง'},
  {id:'ob2',pattern:'oblique',tier:2,equip:'bodyweight',th:'Bicycle Crunch',sub:'ครันช์ปั่นจักรยาน'},
  {id:'co3',pattern:'oblique',tier:3,equip:'cable',th:'Cable Woodchopper',sub:'วู้ดช็อปเปอร์เคเบิล'},
  {id:'ob3',pattern:'oblique',tier:3,equip:'cable',timed:true,th:'Pallof Press',sub:'ดันเคเบิลต้านการบิดลำตัว'},
  {id:'ob4',pattern:'oblique',tier:4,equip:'pullupbar',th:'Hanging Oblique Knee Raise',sub:'ห้อยตัวยกเข่าเฉียงข้าง (ต้องมีบาร์โหน)'},

  {id:'bc0',pattern:'biceps',tier:1,equip:'bodyweight',th:'Towel Bicep Curl',sub:'เหยียบผ้าขนหนูแล้วงอแขนดึงต้านแรงขาตัวเอง (ไม่ใช้อุปกรณ์)'},
  {id:'bc1',pattern:'biceps',tier:1,equip:'cable',th:'Cable Curl (น้ำหนักเบา)',sub:'ดึงเคเบิลกล้ามแขนหน้าเบา'},
  {id:'bc2',pattern:'biceps',tier:2,equip:'dumbbell',th:'Dumbbell Bicep Curl',sub:'เคิร์ลดัมเบล'},
  {id:'bc3',pattern:'biceps',tier:3,equip:'machine',th:'Preacher Curl Machine',sub:'เครื่องเคิร์ลพักแขน'},
  {id:'bc4',pattern:'biceps',tier:4,equip:'barbell',th:'Barbell Curl',sub:'เคิร์ลบาร์เบล'},

  {id:'tc1',pattern:'triceps',tier:1,equip:'cable',th:'Cable Tricep Pushdown (น้ำหนักเบา)',sub:'กดเคเบิลกล้ามแขนหลังเบา'},
  {id:'tc2',pattern:'triceps',tier:2,equip:'bodyweight',th:'Bench Dip',sub:'ดิปเก้าอี้'},
  {id:'tc3',pattern:'triceps',tier:3,equip:'dumbbell',th:'Overhead Dumbbell Tricep Extension',sub:'เหยียดแขนเหนือศีรษะดัมเบล'},
  {id:'tc4',pattern:'triceps',tier:4,equip:'barbell',th:'Close-Grip Barbell Bench Press',sub:'เบนช์เพรสจับแคบบาร์เบล'}
];

var TIER_ORDER = [1,2,3,4];
var TIER_LABEL = {1:'เบาสุด / เริ่มต้น', 2:'ปานกลาง', 3:'ค่อนข้างหนัก', 4:'หนักสุด / ต้องมีพื้นฐาน'};
var TIER_DESC = {
  1:'ใช้ทักษะ/แรงน้อยที่สุดในกลุ่มท่านี้ เหมาะกับผู้เริ่มต้นหรือกำลังฟื้นจากอาการบาดเจ็บ',
  2:'เพิ่มแรงต้านหรือความซับซ้อนขึ้นอีกขั้นจาก Tier 1',
  3:'ต้องการความมั่นคง/ทักษะควบคุมน้ำหนักที่ดีขึ้น',
  4:'ใช้แรง/ทักษะควบคุมมากที่สุดในกลุ่มท่านี้'
};
function tierBadge(tier){
  return '<span class="tier-badge" title="Tier '+tier+' — '+TIER_LABEL[tier]+': '+TIER_DESC[tier]+' (สเกล 1=เบาสุด, 4=หนักสุด)">Tier '+tier+'</span>';
}

var PATTERN_LABEL = {
  squat:'Squat Pattern — ต้นขาหน้า / ก้น', lunge:'Lunge — ขาทีละข้าง / ก้น', hinge:'Hinge Pattern — หลังขา / หลังล่าง',
  glute:'Glute — กล้ามก้น', legcurl:'Leg Curl — หลังขา (งอเข่า)', calf:'Calf — น่อง',
  hpush:'Horizontal Push — อกกลาง / ไหล่หน้า / ไทรเซป', incline:'Incline Push — อกบน', chestfly:'Chest Fly — อก (แยกส่วน)',
  vpush:'Vertical Push — ไหล่หน้า', latraise:'Lateral Raise — ไหล่ข้าง', reardelt:'Rear Delt — ไหล่หลัง / หลังบน',
  hpull:'Horizontal Pull — หลังกลาง', vpull:'Vertical Pull — หลังกว้าง / ไบเซป',
  core:'Core — หน้าท้อง', oblique:'Oblique — ท้องด้านข้าง / ต้านการบิด',
  biceps:'Biceps — กล้ามแขนหน้า', triceps:'Triceps — กล้ามแขนหลัง'
};
var PATTERN_SHORT = {
  squat:'ต้นขาหน้า', lunge:'ขาทีละข้าง', hinge:'หลังขา/หลังล่าง', glute:'ก้น', legcurl:'หลังขา (งอเข่า)', calf:'น่อง',
  hpush:'อกกลาง', incline:'อกบน', chestfly:'อก (แยกส่วน)', vpush:'ไหล่หน้า', latraise:'ไหล่ข้าง', reardelt:'ไหล่หลัง',
  hpull:'หลังกลาง', vpull:'หลังกว้าง', core:'หน้าท้อง', oblique:'ท้องด้านข้าง', biceps:'แขนหน้า', triceps:'แขนหลัง'
};
/* ท่าเสริม (accessory) — ถ้าอุปกรณ์ไม่พอให้ข้ามได้โดยไม่ขึ้นเตือนสีแดงเหมือนท่าหลัก */
var OPTIONAL_PATTERNS = ['lunge','glute','legcurl','calf','incline','chestfly','latraise','reardelt','oblique','biceps','triceps'];
var TIMED_PATTERNS = ['core','oblique']; // กลุ่มแกนกลาง: พัก 30-60 วิ ไม่มีแบบเข้มข้น — จับเวลาเฉพาะท่าที่มี timed:true
var SMALL_PATTERNS = ['latraise','reardelt','calf'];

var EXCLUSION_MAP = {
  'เข่า':['sq3','sq3c','sq3d','sq4','sq3b','lg2b','lg3','lg3b','lg4','lc4','cf3b'], // เลกเพรสทุกมุม/Step-up/ลันจ์ที่ลงน้ำหนักเข่ามาก/นอร์ดิก
  'ไหล่':['vp3','vp4','tc3','tc4','ic3','ic4','fl3','fl3b','lr2','lr3','lr3b'],
  'หลัง':['hg3','hg4','bc4','hg3b','co3b','hg3c','gl4','lg4','co3c','ob2'], // co3b (Ab Wheel) โหลดหลังส่วนล่างมากถ้าคุมฟอร์มไม่ดี
  'ข้อมือ':['hp2a','hp3','hp4','bc4','tc4','ic3','ic3b','ic4'],
  'หัวใจ-หลอดเลือด':['sq4','hg4','hp4','vp4','hl4','bc4','tc4','ic4','gl4','lg4','cf4']
};

/* เซสชันหมุนเวียนตามลำดับวันฝึกในสัปดาห์ (A → B → C → A ...) ให้ท่าไม่ซ้ำเดิมทุกวันและครอบคลุม
   กล้ามเนื้อทุกส่วนในสัปดาห์ให้มากที่สุด — เซสชันแรกๆ ของแต่ละแบบถูกจัดให้ครอบคลุมมากสุดก่อน
   เผื่อคนที่ฝึกน้อยวัน · "ท่า@2" = ท่าตัวเลือกที่สองของรูปแบบเดียวกัน (ไม่ซ้ำกับท่าแรก) */
var SPLIT_DEFS = {
  fullbody: {
    key:'fullbody', label:'Full Body', minDays:1, minRank:0,
    desc:'ฝึกทั้งตัวทุกครั้ง แต่หมุนเวียนท่า A/B/C ในแต่ละวันให้โดนกล้ามเนื้อครบทุกส่วนในสัปดาห์ — ปลอดภัยสุดสำหรับมือใหม่ ต้องการวันว่างน้อยสุด',
    sessions:[
      {key:'Full Body A', patterns:['squat','hpush','hpull','hinge','latraise','triceps','core']},
      {key:'Full Body B', patterns:['lunge','incline','vpull','glute','reardelt','biceps','oblique']},
      {key:'Full Body C', patterns:['squat@2','vpush','vpull@2','legcurl','chestfly','calf','core@2']}
    ]
  },
  ul: {
    key:'ul', label:'Upper / Lower', minDays:4, minRank:1,
    desc:'แยกวันบนตัว (Upper) กับล่างตัว (Lower) สลับกัน แต่ละฝั่งมี 2 ชุดท่า (A/B) ครบทุกส่วนใน 4 วัน — ต้องมีวันว่างอย่างน้อย 4 วัน/สัปดาห์',
    sessions:[
      {key:'Upper A', patterns:['hpush','hpull','vpush','latraise','triceps']},
      {key:'Lower A', patterns:['squat','hinge','calf','core']},
      {key:'Upper B', patterns:['incline','vpull','chestfly','reardelt','biceps']},
      {key:'Lower B', patterns:['lunge','glute','legcurl','oblique']}
    ]
  },
  ppl: {
    key:'ppl', label:'Push / Pull / Legs', minDays:3, minRank:2,
    desc:'แยกวันดัน (Push) ดึง (Pull) และขา (Legs) หมุนวนกัน ชุด A ครอบคลุมเกือบครบใน 3 วัน ชุด B เปลี่ยนท่าให้หลากหลายขึ้นเมื่อฝึกเกิน 3 วัน',
    sessions:[
      {key:'Push A', patterns:['hpush','incline','vpush','latraise','triceps']},
      {key:'Pull A', patterns:['vpull','hpull','reardelt','biceps']},
      {key:'Legs A', patterns:['squat','hinge','lunge','legcurl','calf','core']},
      {key:'Push B', patterns:['incline','hpush@2','chestfly','latraise','triceps@2']},
      {key:'Pull B', patterns:['hpull@2','vpull@2','reardelt','biceps@2']},
      {key:'Legs B', patterns:['squat@2','hinge@2','glute','legcurl','calf','oblique']}
    ]
  },
  bro: {
    key:'bro', label:'Bro Split (แยกกล้ามเนื้อรายวัน)', minDays:5, minRank:3,
    desc:'แยกกล้ามเนื้อแต่ละกลุ่มเป็นวันของตัวเอง (อก/หลัง/ไหล่/ขา/แขน) แต่ละวันมีหลายท่าครบทุกมัด โวลุ่มต่อครั้งสูงสุด แต่แต่ละกลุ่มได้ฝึก ~1 ครั้ง/สัปดาห์ — ต้องมีวันว่างอย่างน้อย 5 วัน/สัปดาห์',
    sessions:[
      {key:'อก (Chest)', patterns:['hpush','incline','chestfly','hpush@2']},
      {key:'หลัง (Back)', patterns:['vpull','hpull','vpull@2','hpull@2']},
      {key:'ไหล่ (Shoulders)', patterns:['vpush','latraise','reardelt','vpush@2']},
      {key:'ขา (Legs)', patterns:['squat','hinge','lunge','glute','legcurl','calf']},
      {key:'แขน (Arms)', patterns:['biceps','triceps','biceps@2','triceps@2','core','oblique']}
    ]
  }
};
function slotBase(slot){ return String(slot).split('@')[0]; }
function sessionKeys(sessions){ return sessions.map(function(se){ return se.key; }); }
var EXP_RANK = {'มือใหม่':0,'เคยออกบ้าง':1,'ออกกำลังกายประจำ':2,'นักกีฬา-เทรนมานาน':3};

var REP_SCHEME = {
  'เพิ่มกล้ามเนื้อ': '3-4 x 8-12',
  'Recomposition (ลด+เพิ่มพร้อมกัน)': '3-4 x 10-12',
  'รักษาสุขภาพทั่วไป': '3 x 10-12'
};
function repSchemeFor(goal){ return REP_SCHEME[goal] || '3 x 10-12'; }

/* ---------- state (คำตอบแบบสอบถาม + การเลือกท่า + หน้าที่เปิดอยู่) ---------- */
var PERSIST_ONBOARDING_STATE = true;
function freshState(){
  return {step:0, answers:{}, mode:null, nav:'today', editPlan:false,
          plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null,
                trainDays:null, cardioDays:[], cardioMinByDay:{}, intensity:{}}};
}
function loadPlanSchedule(dst, src){
  dst.intensity = (src.intensity && typeof src.intensity==='object') ? src.intensity : {};
  dst.trainDays = Array.isArray(src.trainDays) ? src.trainDays : null;
  dst.cardioDays = Array.isArray(src.cardioDays) ? src.cardioDays : [];
  dst.cardioMinByDay = (src.cardioMinByDay && typeof src.cardioMinByDay==='object') ? src.cardioMinByDay : {};
}
var CARDIO_DEFAULT_MIN = 30;
/* นาที cardio ตามแผนของวันในสัปดาห์นั้น (แผนเก่าที่มีค่าเดียวทั้งสัปดาห์ใช้ cardioMinutes) */
function cardioMinFor(program, wd){
  var m = program.cardioMinByDay && program.cardioMinByDay[wd];
  return m>0 ? m : (program.cardioMinutes || CARDIO_DEFAULT_MIN);
}
function cardioTargetOn(program, iso){ return cardioMinFor(program, thaiWeekdayOfDate(parseISO(iso))); }
function minsForDays(minByDay, days){
  var out = {};
  days.forEach(function(d){ out[d] = (minByDay||{})[d] || CARDIO_DEFAULT_MIN; });
  return out;
}
var state = freshState();
if(PERSIST_ONBOARDING_STATE){
  var saved = lsGet("gymbro_onb_proto", null);
  if(saved && typeof saved==="object"){
    state.step = saved.step||0;
    state.answers = saved.answers||{};
    state.mode = saved.mode || null;
    state.nav = saved.nav || 'today';
    if(saved.plan && typeof saved.plan==="object"){
      state.plan.manualPick = saved.plan.manualPick || {};
      state.plan.unlockedEx = saved.plan.unlockedEx || {};
      state.plan.forceLowTier = saved.plan.forceLowTier || {};
      state.plan.splitOverride = saved.plan.splitOverride || null;
      loadPlanSchedule(state.plan, saved.plan);
    }
  }
}
function persist(){
  if(!PERSIST_ONBOARDING_STATE) return;
  lsSet("gymbro_onb_proto", state);
  if(syncOn()) Promise.resolve(GymBroSync.pushOnboarding(auth.session.user.id, state)).catch(function(){});
}

function visibleQsFor(catId){
  return QUESTIONS.filter(function(q){return q.cat===catId && q.visible(state.answers);});
}
/* คำถามชนิด number ที่ต้องตอบก่อนไปหมวดถัดไป (แยกจาก "main" ซึ่งเป็นแค่การจัดกลุ่ม
   คำถามหลัก/รอง ไม่ใช่ตัวบอกว่าบังคับตอบหรือไม่) — คืนค่า true เมื่อกรอกเป็นตัวเลขจริง
   ไม่ว่าง ไม่ตรวจช่วงค่า (ช่วงค่าตรวจอีกทีที่ sanityIssues ก่อนกดเริ่มโปรแกรม) */
function numberAnswered(v){
  return v!=null && v!=="" && !isNaN(parseFloat(v));
}
function catComplete(catId){
  return visibleQsFor(catId).every(function(q){
    if(q.kind==="single") return !!state.answers[q.id];
    if(q.kind==="multi") return Array.isArray(state.answers[q.id]) && state.answers[q.id].length>0;
    if(q.kind==="number" && q.required) return numberAnswered(state.answers[q.id]);
    return true;
  });
}
function setAnswer(id, val, kind){
  if(kind==="multi"){
    var arr = state.answers[id] ? state.answers[id].slice() : [];
    var i = arr.indexOf(val);
    if(i>-1) arr.splice(i,1); else arr.push(val);
    // N-01: ตัวเลือกที่ตั้งเป็น exclusiveOption (เช่น "ไม่มีอุปกรณ์เลย") ต้องเลือกพร้อม
    // ตัวเลือกอื่นในกลุ่มเดียวกันไม่ได้ — เลือกตัวนี้ให้ล้างตัวอื่น, เลือกตัวอื่นให้ล้างตัวนี้
    var qDef = QUESTIONS.filter(function(q){return q.id===id;})[0];
    var exOpt = qDef && qDef.exclusiveOption;
    if(exOpt && i<=-1){ // i<=-1 หมายถึง "เพิ่งเลือกเพิ่ม" (ก่อนหน้านี้ยังไม่ได้เลือก val นี้)
      if(val===exOpt) arr = [exOpt]; // เพิ่งเปิด exclusive option -> ล้างตัวอื่นทั้งหมด
      else { var ei=arr.indexOf(exOpt); if(ei>-1) arr.splice(ei,1); } // เพิ่งเปิดตัวอื่น -> เอา exclusive ออก
    }
    state.answers[id]=arr;
  } else {
    state.answers[id] = (state.answers[id]===val) ? undefined : val;
  }
  persist(); render();
}
function setField(id, val){ state.answers[id]=val; persist(); render(); }

/* ---------- generator calculations ---------- */
function bmiOf(w,h){ return w/((h/100)*(h/100)); }
function bmiLabel(b){ if(b<18.5) return 'ต่ำกว่าเกณฑ์'; if(b<23) return 'ปกติ'; if(b<25) return 'ท้วม'; if(b<30) return 'อ้วนระดับ 1'; return 'อ้วนระดับ 2'; }

var SUPPORTED_GOALS = ["ลดไขมัน","เพิ่มกล้ามเนื้อ","Recomposition (ลด+เพิ่มพร้อมกัน)","รักษาสุขภาพทั่วไป"];
var SUPPORTED_LOCATIONS = ["ฟิตเนส-ยิม","ที่บ้าน"]; // เพิ่ม "ที่บ้าน" เข้ามารองรับแล้ว — กลางแจ้ง/ผสมผสาน ยังไม่รองรับ
function inScope(a){ return SUPPORTED_GOALS.indexOf(a.Q1)>-1 && SUPPORTED_LOCATIONS.indexOf(a.Q20)>-1; }

function sanityIssues(a){
  var issues=[];
  function checkNum(label, val, lo, hi){
    var n = parseFloat(val);
    if(val==null || val==="" || isNaN(n)){ issues.push(label+'ยังไม่ได้กรอก'); return; }
    if(n<lo || n>hi) issues.push(label+'อยู่นอกช่วงที่เป็นไปได้จริง ('+lo+'-'+hi+')');
  }
  checkNum('อายุ ', a.Q10, 10, 100);
  checkNum('ส่วนสูง ', a.Q11, 100, 250);
  checkNum('น้ำหนักปัจจุบัน ', a.Q12, 20, 300);
  if(a.Q13==="ระบุ") checkNum('น้ำหนักเป้าหมาย ', a.Q13_val, 20, 300);
  // C-01/C-02: เช็คซ้ำที่ด่านสุดท้ายก่อนกด "เริ่มโปรแกรม" ด้วย เผื่อผู้ใช้ย้อนไปแก้ผ่าน
  // rail navigation (ข้าม catComplete() ของ "ถัดไป" ได้) แล้วเผลอเคลียร์ Q37 ทิ้ง
  checkNum('ชั่วโมงนอนเฉลี่ย ', a.Q37, 1, 16);
  return issues;
}

/* ---------- BMR/TDEE ----------
   สูตรจริงอยู่ใน calculations.js (GymBroCalc) จุดเดียวของทั้งระบบ — ที่นี่เป็นแค่
   adapter ที่แปลงคำตอบแบบสอบถาม (Q9/Q10/Q11/Q12/Q36) ไปเป็น input ของสูตร
   ห้ามเขียนสูตร BMR/TDEE ซ้ำที่ไฟล์นี้หรือที่อื่นเด็ดขาด */
function computeTDEE(a){
  var bmr = GymBroCalc.calculateBMR({
    weightKg: a.Q12,   // น้ำหนักตัว (kg)
    heightCm: a.Q11,   // ส่วนสูง (cm)
    age: a.Q10,        // อายุ (ปี)
    sex: a.Q9          // 'ชาย' | 'หญิง'
  });
  var factor = GymBroCalc.activityFactorFromQ36(a.Q36); // null ถ้า Q36 ยังไม่ตอบ/ไม่รู้จัก
  return GymBroCalc.calculateTDEE({bmr: bmr, activityFactor: factor}); // null ถ้าข้อมูลไม่ครบ
}
/* อัปเดตตามหลักการที่บันทึกไว้ที่ D:\Obsidian\coach-knowledge\หลักการ.md (หัวข้อ
   "เป้าแคลอรี่ต่อวัน") — เพิ่ม "เพดานสัมบูรณ์" (kcal คงที่) กำกับเปอร์เซ็นต์ในทุกเส้นทาง
   ที่หลักการระบุไว้ชัดเจน: ลดไขมัน = max(TDEE×pct, TDEE−cap) กันตัดแคลอรี่โหดเกินไปตอน
   TDEE สูง, เพิ่มกล้ามเนื้อ = min(TDEE×pct, TDEE+cap) กันยัด surplus บวมเกินไป
   เส้นทางที่หลักการไม่ได้ระบุไว้ (Q4a/Q5b ยังไม่ตอบ หรือตอบ "ไม่แน่ใจให้ระบบแนะนำ")
   คงค่า multiplier เดิมไว้แบบไม่มีเพดานแยก — ไม่ fabricate กฎที่แหล่งอ้างอิงไม่ได้เขียนไว้ */
function computeCalorieTarget(tdee, a){
  var goal = a.Q1;
  var floor = a.Q9==='ชาย' ? 1500 : (a.Q9==='หญิง' ? 1200 : null);
  if(tdee==null || isNaN(tdee)){
    return {kcal:null, floored:false, floor:floor, direction:'ข้อมูลไม่ครบ — กรอกเพศ/อายุ/ส่วนสูง/น้ำหนัก/กิจกรรมให้ครบก่อน'};
  }
  var target, directionLabel;
  if(goal==='ลดไขมัน'){
    if(a.Q4a==='เข้มข้น'){
      target = Math.max(tdee*0.75, tdee-1000);
      directionLabel = 'ลดไขมัน (เข้มข้น — หัก 25% แต่ไม่เกิน 1,000 kcal)';
    } else if(a.Q4a==='ค่อยเป็นค่อยไป'){
      target = Math.max(tdee*0.85, tdee-500);
      directionLabel = 'ลดไขมัน (ค่อยเป็นค่อยไป — หัก 15% แต่ไม่เกิน 500 kcal)';
    } else {
      target = tdee*0.80; // "ไม่แน่ใจให้ระบบแนะนำ"/ยังไม่ตอบ — หลักการยังไม่ระบุเพดานแยก
      directionLabel = 'ลดไขมัน (deficit 20%)';
    }
  } else if(goal==='เพิ่มกล้ามเนื้อ'){
    if(a.Q5b==='ได้ (เน้นสร้างกล้ามให้เร็ว)'){
      target = Math.min(tdee*1.15, tdee+500);
      directionLabel = 'เพิ่มกล้ามเนื้อ (รับไขมันได้ — เพิ่ม 15% แต่ไม่เกิน +500 kcal)';
    } else if(a.Q5b==='ไม่ได้ (อยากคุมไขมันไปด้วย)'){
      target = Math.min(tdee*1.08, tdee+300);
      directionLabel = 'เพิ่มกล้ามเนื้อ (คุมไขมัน — เพิ่ม 8% แต่ไม่เกิน +300 kcal)';
    } else {
      target = tdee*1.10; // ยังไม่ตอบ Q5b — หลักการยังไม่ระบุเพดานแยก
      directionLabel = 'เพิ่มกล้ามเนื้อ (surplus 10%)';
    }
  } else if(goal==='Recomposition (ลด+เพิ่มพร้อมกัน)'){
    if(a.Q6==='ห่างมาก'){
      target = Math.max(tdee*0.92, tdee-300);
      directionLabel = 'Recomposition (ห่างเป้ามาก — หัก 8% แต่ไม่เกิน 300 kcal)';
    } else if(a.Q6==='ใกล้เป้าหมายแล้ว'){
      target = Math.min(tdee*1.03, tdee+150);
      directionLabel = 'Recomposition (ใกล้เป้าแล้ว — เพิ่ม 3% แต่ไม่เกิน +150 kcal)';
    } else {
      target = tdee*1.0; // "ห่างปานกลาง" หรือยังไม่ตอบ Q6 — maintenance ตรงตัว
      directionLabel = 'Recomposition (ห่างปานกลาง — maintenance)';
    }
  } else {
    target = tdee*1.0;
    directionLabel = 'รักษาน้ำหนัก (maintenance)';
  }
  // ด่านสุดท้ายเสมอตามหลักการ: Final Target = max(Target, Floor) — เช็คหลังคำนวณ
  // เปอร์เซ็นต์+เพดานข้างบนเสร็จหมดแล้วเท่านั้น ไม่ผูกกับทิศทาง (deficit/surplus) อีกต่อไป
  var floored = floor!=null && target < floor;
  return {kcal: floored?floor:target, floored:floored, floor:floor, direction:directionLabel};
}
function computeMacro(kcal, weightKg){
  var proteinG = (weightKg>0) ? Math.round(2.0*weightKg) : null;
  if(kcal==null || isNaN(kcal)){
    return {proteinG:proteinG, fatG:null, carbG:null, clamped:false}; // ไม่ fabricate fat/carb ถ้าไม่มีเป้าแคลอรี่
  }
  var proteinKcal = (proteinG||0)*4;
  var fatKcal = kcal*0.28;
  var fatG = Math.round(fatKcal/9);
  var carbKcal = kcal - proteinKcal - fatKcal;
  var clamped = false;
  if(carbKcal < 200){ carbKcal = 200; clamped = true; }
  var carbG = Math.round(carbKcal/4);
  return {proteinG:proteinG, fatG:fatG, carbG:carbG, clamped:clamped};
}

var MEALS_MAP = {'2 มื้อ':2,'3 มื้อ':3,'4-5 มื้อ':4,'ไม่แน่นอน':3};
var WATER_NOW = {'น้อยกว่า 1 ลิตร':0.8,'1-2 ลิตร':1.5,'2-3 ลิตร':2.5,'มากกว่า 3 ลิตร':3.2};
function computeTargets(a){
  var w = parseFloat(a.Q12);
  var hasWeight = w>0;
  var tdee = computeTDEE(a); // null ถ้าข้อมูลไม่ครบ/ไม่ถูกต้อง — ไม่ fabricate ค่า
  var cal = computeCalorieTarget(tdee, a);
  var macro = computeMacro(cal.kcal, hasWeight?w:null);
  var water = hasWeight ? Math.min(4.0, Math.max(1.5, Math.round(w*0.035*10)/10)) : null;
  var already = WATER_NOW[a.Q43];
  if(water!=null && already && already > water) water = Math.min(4.0, already);
  // C-01: ห้าม fabricate เป้าหมายนอนเป็น 7 ชม. เงียบๆ ถ้า Q37 ไม่ได้ตอบจริง —
  // numberAnswered() แยก "ไม่ตอบ" ออกจาก "ตอบเป็น 7" ให้ชัดเจน คืน null ถ้าไม่มีคำตอบ
  var hasSleepAnswer = numberAnswered(a.Q37);
  var sleepH = hasSleepAnswer ? Math.min(9, Math.max(7, parseFloat(a.Q37))) : null;
  return {
    tdee: (tdee==null||isNaN(tdee)) ? null : Math.round(tdee), // ปัดเศษเฉพาะตอนแสดงผลเท่านั้น
    kcal: (cal.kcal==null||isNaN(cal.kcal)) ? null : Math.round(cal.kcal),
    kcalDirection: cal.direction,
    kcalFloored: cal.floored,
    incomplete: (tdee==null || isNaN(tdee)),
    proteinG: macro.proteinG, fatG: macro.fatG, carbG: macro.carbG, macroClamped: macro.clamped,
    waterL: water,
    meals: MEALS_MAP[a.Q31] || 3,
    sleepH: sleepH,
    sleepHygiene: a.Q39==='ต้องการ',
    goalWeight: (a.Q13==='ระบุ' && a.Q13_val) ? parseFloat(a.Q13_val) : null
  };
}

function kcalOk(v, target){ return v!=null && target!=null && v >= target*0.9 && v <= target*1.1; }
function fmtKcal(v){ return (v==null || isNaN(v)) ? 'ข้อมูลไม่ครบ' : v.toLocaleString(); }
function fmtHours(v){ return (v==null || isNaN(v)) ? 'ยังไม่ได้ตั้งเป้า (Q37 ยังไม่ได้ตอบ)' : fmt1(v)+' ชม.'; }

function safetyGate(a){
  if(a.Q25==='มี' && a.Q28 && a.Q28!=='ได้รับอนุญาตแล้ว'){
    return {blocked:true, reason: a.Q28==='ปรึกษาแล้วแต่แพทย์ไม่อนุญาต'
      ? 'คุณระบุว่าปรึกษาแพทย์แล้วและยังไม่ได้รับอนุญาตให้ออกกำลังกาย — ด้วยเหตุผลด้านความปลอดภัย ระบบจะไม่สร้างตารางออกกำลังกายให้จนกว่าจะได้รับอนุญาตจากแพทย์'
      : 'คุณระบุว่ามีอาการบาดเจ็บ/โรคประจำตัว แต่ยังไม่ได้ปรึกษาแพทย์ — ด้วยเหตุผลด้านความปลอดภัย ระบบจะยังไม่สร้างตารางออกกำลังกายให้จนกว่าคุณจะปรึกษาแพทย์และได้รับอนุญาตก่อน'};
  }
  return {blocked:false};
}
function equipAllowed(level){
  // 'pullupbar' รวมอยู่ในทุกระดับ (เดิม Pull-up/Hanging Leg Raise ถูก tag เป็น 'bodyweight'
  // ซึ่งอยู่ในทุกระดับอยู่แล้ว — ใส่ไว้ที่นี่เพื่อคงพฤติกรรมเดิมของยิมทุกประการ ไม่ใช่การเพิ่มสิทธิ์ใหม่)
  if(level==='ครบมาก') return ['bodyweight','dumbbell','machine','barbell','cable','pullupbar'];
  if(level==='ปานกลาง') return ['bodyweight','dumbbell','machine','cable','pullupbar'];
  return ['bodyweight','dumbbell','pullupbar'];
}
/* ที่บ้าน: ต่างจากยิมตรงที่ไม่มีคำถามระดับอุปกรณ์ (Q22) ให้ใช้ — ต้องอ่าน Q21 (รายการ
   อุปกรณ์ที่มีจริง) ตรงๆ แทน ไม่มี default "ครบมาก" แบบยิม เพราะจะเดาเกินจริงว่ามีอุปกรณ์
   "ยางยืด"/"ม้านั่ง"/"เชือกกระโดด"/"ฮูลาฮูป"/"เสื่อโยคะ" ยังไม่มี equip type ให้จับคู่ใน
   ฐานข้อมูลท่า (เป็นอุปกรณ์คาร์ดิโอ/รองพื้น ไม่ใช่อุปกรณ์เวทเทรนนิ่งที่ตรงกับ pattern ไหน
   เลย) จึงยังไม่มีผลต่อ allowed[] ตอนนี้ — เป็นข้อจำกัดที่รู้อยู่แล้ว ไม่ใช่บั๊ก
   "สเต็ปเปอร์"/"ลูกบอลโยคะ"/"ลูกกลิ้งบริหารหน้าท้อง" ผูก equip จริงแล้ว (sq3b/hg3b/co3b) —
   เติมช่องว่าง tier 3 ของ squat/hinge/core ที่บ้านที่เดิมไม่มีทางไปถึงเลย (tier 3 เดิม
   ใช้ machine/cable ซึ่งเป็นอุปกรณ์ยิมเท่านั้น) */
function equipAllowedHome(q21){
  var list = Array.isArray(q21) ? q21 : [];
  var allowed = ['bodyweight'];
  if(list.indexOf('ไม่มีอุปกรณ์เลย')>-1) return allowed;
  if(list.indexOf('ดัมเบล')>-1) allowed.push('dumbbell');
  if(list.indexOf('บาร์เบล')>-1) allowed.push('barbell');
  if(list.indexOf('บาร์โหน')>-1) allowed.push('pullupbar');
  if(list.indexOf('สเต็ปเปอร์')>-1) allowed.push('stepper');
  if(list.indexOf('ลูกบอลโยคะ')>-1) allowed.push('yogaball');
  if(list.indexOf('ลูกกลิ้งบริหารหน้าท้อง')>-1) allowed.push('abroller');
  return allowed;
}
/* จุดเดียวที่ตัดสินว่า pattern ไหนใช้อุปกรณ์ชุดไหนได้ — แยกตามสถานที่ (Q20) ตอนนี้รองรับ
   ฟิตเนส-ยิม (เดิม) กับ ที่บ้าน (ใหม่) เท่านั้น กลางแจ้ง/ผสมผสาน ยังใช้ค่า default ของยิมไปก่อน
   จนกว่าจะออกแบบคำถามอุปกรณ์ของสองเส้นทางนั้นเพิ่ม */
function allowedEquipFor(a){
  if(a.Q20==='ที่บ้าน') return equipAllowedHome(a.Q21);
  return equipAllowed(a.Q22||'ครบมาก');
}
function targetTier(exp){
  return {'มือใหม่':2,'เคยออกบ้าง':3,'ออกกำลังกายประจำ':3,'นักกีฬา-เทรนมานาน':4}[exp] || 2;
}
function candidatesFor(pattern, a){
  var allowed = allowedEquipFor(a);
  var injuries = a.Q26||[];
  return EXERCISES.filter(function(e){return e.pattern===pattern;}).map(function(e){
    var lockedBy = injuries.filter(function(inj){ return (EXCLUSION_MAP[inj]||[]).indexOf(e.id)>-1; });
    var manuallyUnlocked = !!state.plan.unlockedEx[e.id];
    return {
      id:e.id, pattern:e.pattern, tier:e.tier, equip:e.equip, th:e.th, sub:e.sub, timed:!!e.timed,
      equipOk: allowed.indexOf(e.equip)>-1,
      locked: lockedBy.length>0 && !manuallyUnlocked,
      lockedBy: lockedBy
    };
  });
}
function tieBreak(list){
  var m = list.filter(function(e){return e.equip==='machine';});
  return m.length ? m[0] : list[0];
}
function pickByTier(eligible, tTier){
  if(!eligible.length) return null;
  var exact = eligible.filter(function(e){return e.tier===tTier;});
  if(exact.length) return tieBreak(exact);
  var below = eligible.filter(function(e){return e.tier<tTier;}).sort(function(a,b){return b.tier-a.tier;});
  if(below.length){ var t=below[0].tier; return tieBreak(below.filter(function(e){return e.tier===t;})); }
  var above = eligible.filter(function(e){return e.tier>tTier;}).sort(function(a,b){return a.tier-b.tier;});
  if(above.length){ var t2=above[0].tier; return tieBreak(above.filter(function(e){return e.tier===t2;})); }
  return null;
}
/* slot = ชื่อรูปแบบท่า หรือ "รูปแบบ@2" (ตัวเลือกที่สองที่ไม่ซ้ำท่าแรก ถ้ามีให้เลือก) */
function selectionFor(slot, a){
  var base = slotBase(slot);
  var all = candidatesFor(base, a);
  var eligible = all.filter(function(e){return e.equipOk && !e.locked;});
  if(slot!==base){
    var primary = selectionFor(base, a).picked;
    var others = primary ? eligible.filter(function(e){ return e.id!==primary.id; }) : eligible;
    if(others.length) eligible = others;
  }
  var forceLow = !!state.plan.forceLowTier[base];
  var tTier = forceLow ? 1 : targetTier(a.Q16);
  var manual = state.plan.manualPick[slot];
  var picked = null;
  if(manual){
    var m = all.filter(function(e){return e.id===manual && e.equipOk && !e.locked;})[0];
    if(m) picked = m;
  }
  if(!picked) picked = pickByTier(eligible, tTier);
  return {picked:picked, all:all};
}
function splitFeasibility(a){
  var n = (a.Q2||[]).length;
  var rank = EXP_RANK[a.Q16]!=null ? EXP_RANK[a.Q16] : 0;
  var out = {};
  Object.keys(SPLIT_DEFS).forEach(function(key){
    var def = SPLIT_DEFS[key];
    var eligible = n >= def.minDays;
    out[key] = { eligible: eligible, recommended: eligible && rank >= def.minRank, minDays: def.minDays };
  });
  return out;
}
function autoSplit(a){
  var f = splitFeasibility(a);
  if(f.bro.eligible && f.bro.recommended) return 'bro';
  if(f.ppl.eligible && f.ppl.recommended) return 'ppl';
  if(f.ul.eligible && f.ul.recommended) return 'ul';
  return 'fullbody';
}
function effectiveSplit(a){
  var f = splitFeasibility(a);
  if(state.plan.splitOverride && f[state.plan.splitOverride] && f[state.plan.splitOverride].eligible) return state.plan.splitOverride;
  if(state.plan.splitOverride && (!f[state.plan.splitOverride] || !f[state.plan.splitOverride].eligible)) state.plan.splitOverride = null;
  return autoSplit(a);
}
/* ---------- จัดเซสชันลงวัน: กล้ามเนื้อกลุ่มเดียวกันต้องไม่โดนในวันติดกัน ----------
   กลุ่มหลักของแต่ละท่า (core/oblique ฟื้นตัวเร็ว ไม่นับ) — 2 เซสชันที่มีกลุ่มหลักร่วมกัน "ชนกัน" ห้ามอยู่วันติดกัน
   (ต้องพัก ~48 ชม.) ส่วนกลุ่มรอง (เช่น ต้นแขนหลังตอนดันอก) ใช้แค่จัดลำดับให้ซ้อนกันน้อยที่สุด
   วันติดกันนับข้ามสัปดาห์ด้วย (อาทิตย์ → จันทร์ เพราะตารางวนซ้ำทุกสัปดาห์) */
var PATTERN_GROUP = {hpush:'chest', incline:'chest', chestfly:'chest', vpush:'shoulders', latraise:'shoulders', reardelt:'reardelt',
  hpull:'back', vpull:'back', biceps:'biceps', triceps:'triceps',
  squat:'legs', lunge:'legs', hinge:'legs', glute:'legs', legcurl:'legs', calf:'legs'};
var PATTERN_GROUP2 = {hpush:['triceps','shoulders'], incline:['shoulders','triceps'], vpush:['triceps'], hpull:['biceps','reardelt'], vpull:['biceps']};
var GROUP_LABEL = {chest:'อก', shoulders:'ไหล่', reardelt:'ไหล่หลัง', back:'หลัง', biceps:'ต้นแขนหน้า', triceps:'ต้นแขนหลัง', legs:'ขา'};
function sessionGroups(se, withSecondary){
  var out = [];
  sessionMuscles(se).forEach(function(p){
    [PATTERN_GROUP[p]].concat(withSecondary ? (PATTERN_GROUP2[p]||[]) : []).forEach(function(g){ if(g && out.indexOf(g)===-1) out.push(g); });
  });
  return out;
}
function sharedGroups(a, b){ return a.filter(function(x){ return b.indexOf(x)>-1; }); }
function weekOrder(days){ return DAYS.filter(function(d){ return (days||[]).indexOf(d)>-1; }); }
/* คู่วันฝึกที่ติดกัน (ตำแหน่งในรายการเรียงตามสัปดาห์) รวมอาทิตย์ → จันทร์ */
function adjacentPairs(sorted){
  var idx = sorted.map(function(d){ return DAYS.indexOf(d); }), out = [];
  idx.forEach(function(x, k){ var j = idx.indexOf((x+1)%7); if(j>-1 && j!==k) out.push([k, j]); });
  return out;
}
var _schedCache = {};
/* หาการจัดเซสชันที่ดีที่สุด: ชนกันน้อยสุด → กลุ่มรองซ้อนน้อยสุด → ใกล้ลำดับ A,B,C เดิมที่สุด
   แต่ละเซสชันถูกใช้เท่า ๆ กัน (ต่างกันไม่เกิน 1 ครั้ง) ถ้าวันน้อยกว่าจำนวนเซสชันใช้เซสชันแรก ๆ ตามลำดับ */
function bestSchedule(sessions, days){
  var sorted = weekOrder(days), n = sorted.length;
  var cand = (sessions||[]).slice(0, n < (sessions||[]).length ? n : (sessions||[]).length), m = cand.length;
  if(!n || !m) return {list:[], hard:0, soft:0, clash:null};
  var P = cand.map(function(s){ return sessionGroups(s, false); }), A = cand.map(function(s){ return sessionGroups(s, true); });
  var ck = cand.map(function(s, i){ return s.key+':'+P[i].join(',')+'/'+A[i].join(','); }).join('|')+'#'+sorted.join(',');
  if(_schedCache[ck]) return _schedCache[ck];
  var back = sorted.map(function(){ return []; });
  adjacentPairs(sorted).forEach(function(pr){ back[Math.max(pr[0], pr[1])].push(Math.min(pr[0], pr[1])); });
  var lo = Math.floor(n/m), hi = Math.ceil(n/m), cnt = cand.map(function(){ return 0; }), cur = [], best = null;
  function worse(h, s, d){ return best && (h > best.hard || (h===best.hard && (s > best.soft || (s===best.soft && d >= best.diff)))); }
  (function rec(pos, h, s, d){
    if(worse(h, s, d)) return;
    if(pos===n){
      if(cnt.every(function(c){ return c >= lo; })) best = {hard:h, soft:s, diff:d, pick:cur.slice()};
      return;
    }
    for(var i=0; i<m; i++){
      if(cnt[i] >= hi) continue;
      var dh = 0, ds = 0;
      back[pos].forEach(function(q){ dh += sharedGroups(P[cur[q]], P[i]).length ? 1 : 0; ds += sharedGroups(A[cur[q]], A[i]).length; });
      cur[pos] = i; cnt[i]++;
      rec(pos+1, h+dh, s+ds, d+(i===pos%m ? 0 : 1));
      cnt[i]--;
    }
  })(0, 0, 0, 0);
  var list = sorted.map(function(d, k){ return {day:d, session:cand[best.pick[k]].key}; }), clash = null;
  adjacentPairs(sorted).some(function(pr){ // pr = [วันก่อน, วันถัดไป]
    var g = sharedGroups(P[best.pick[pr[0]]], P[best.pick[pr[1]]]);
    if(g.length) clash = {from:sorted[pr[0]], to:sorted[pr[1]], groups:g};
    return !!clash;
  });
  return (_schedCache[ck] = {list:list, hard:best.hard, soft:best.soft, clash:clash});
}
function assignSessions(splitKey, days){ return bestSchedule(SPLIT_DEFS[splitKey].sessions, days).list; }
function clashText(c){
  return c.groups.map(function(g){ return GROUP_LABEL[g]||g; }).join('/')+'ถูกฝึกในวันติดกัน ('+c.from+' → '+c.to+')';
}
/* ชุดวันฝึกที่มากที่สุดจากวันว่างที่ไม่มีวันติดกันชนกัน — เท่ากันให้เลือกแบบที่ซ้อนกลุ่มรองน้อย และเว้นระยะห่างมากกว่า */
var _freeCache = {};
function freeTrainDays(sessions, avail){
  var days = weekOrder(avail), ck = (sessions||[]).map(function(s){ return s.key; }).join('|')+'#'+days.join(',');
  if(_freeCache[ck]) return _freeCache[ck];
  var best = null;
  for(var mask=1; mask < (1<<days.length); mask++){
    var pick = days.filter(function(d, i){ return mask & (1<<i); });
    var r = bestSchedule(sessions, pick);
    if(r.hard) continue;
    var sc = [pick.length, -r.soft, -adjacentPairs(pick).length];
    if(!best || sc[0]>best.sc[0] || (sc[0]===best.sc[0] && (sc[1]>best.sc[1] || (sc[1]===best.sc[1] && sc[2]>best.sc[2])))) best = {sc:sc, days:pick};
  }
  return (_freeCache[ck] = best ? best.days : []);
}
/* วันว่าง (Q2) = วันที่ "เลือกได้" เท่านั้น วันฝึก/วัน cardio จริงเลือกแยกในหน้าตรวจแผน */
function minTrainDays(splitKey, a){
  var base = splitKey==='fullbody' ? Math.min(2, (a.Q2||[]).length) : SPLIT_DEFS[splitKey].minDays;
  return Math.min(base, freeTrainDays(SPLIT_DEFS[splitKey].sessions, a.Q2).length);
}
function inAvailable(days, a){
  var avail = a.Q2||[];
  return DAYS.filter(function(d){ return avail.indexOf(d)>-1 && (days||[]).indexOf(d)>-1; });
}
/* ยังไม่ได้เลือกวันเอง = ใช้ชุดวันที่มากที่สุดที่ไม่มีกล้ามเนื้อกลุ่มเดียวกันโดนในวันติดกัน */
function planTrainDays(a){
  var td = state.plan.trainDays;
  return td ? inAvailable(td, a) : inAvailable(freeTrainDays(SPLIT_DEFS[effectiveSplit(a)].sessions, a.Q2), a);
}
function planCardioDays(a){ return inAvailable(state.plan.cardioDays, a); }
function weekdayAdjacencyWarning(days){
  var idx = (days||[]).map(function(d){return DAYS.indexOf(d);}).sort(function(x,y){return x-y;});
  for(var i=0;i<idx.length;i++){
    var x = idx[i], y = idx[(i+1)%idx.length];
    if(((y-x+7)%7)===1 && idx.length>1) return true;
  }
  return false;
}

/* ---------- date helpers ---------- */
function pad2(n){ return (n<10?"0":"")+n; }
function fmtDateISO(d){ return d.getFullYear()+"-"+pad2(d.getMonth()+1)+"-"+pad2(d.getDate()); }
function parseISO(s){ var p=String(s).split("-").map(Number); return new Date(p[0],p[1]-1,p[2]); }
function todayISO(){ return fmtDateISO(new Date()); }
function thaiWeekdayOfDate(d){ return DAYS[(d.getDay()+6)%7]; }
function addDays(d, n){ var x=new Date(d.getFullYear(), d.getMonth(), d.getDate()); x.setDate(x.getDate()+n); return x; }
function startOfWeek(d){ return addDays(d, -((d.getDay()+6)%7)); }
var TH_MONTHS = ["ม.ค.","ก.พ.","มี.ค.","เม.ย.","พ.ค.","มิ.ย.","ก.ค.","ส.ค.","ก.ย.","ต.ค.","พ.ย.","ธ.ค."];
var TH_MONTHS_FULL = ["มกราคม","กุมภาพันธ์","มีนาคม","เมษายน","พฤษภาคม","มิถุนายน","กรกฎาคม","สิงหาคม","กันยายน","ตุลาคม","พฤศจิกายน","ธันวาคม"];
function monthLabelTH(y,m){ return TH_MONTHS_FULL[m]+" "+(y+543); }
function shortDateTH(iso){ var d=parseISO(iso); return d.getDate()+" "+TH_MONTHS[d.getMonth()]; }
function longDateTH(iso){ var d=parseISO(iso); return thaiWeekdayOfDate(d)+"ที่ "+d.getDate()+" "+TH_MONTHS_FULL[d.getMonth()]+" "+(d.getFullYear()+543); }
function daysBetween(isoA, isoB){ return Math.round((parseISO(isoB)-parseISO(isoA))/86400000); }
function setCountFor(setsRepsStr){
  var m = /^(\d+)(?:-(\d+))?\s*x/.exec(setsRepsStr||"");
  if(!m) return 3;
  return parseInt(m[2]||m[1],10) || 3;
}

/* ---------- plan snapshot ---------- */
function buildPlanSnapshot(a){
  var split = effectiveSplit(a);
  var splitDef = SPLIT_DEFS[split];
  var trainDays = planTrainDays(a);
  var dayToSession = {};
  assignSessions(split, trainDays).forEach(function(x){ dayToSession[x.day]=x.session; });
  var sessions = splitDef.sessions.map(function(se){
    var exercises = se.patterns.map(function(slot){
      var sel = selectionFor(slot, a);
      if(!sel.picked) return null;
      var p = slotBase(slot);
      return {
        pattern:p, slot:slot, id:sel.picked.id, th:sel.picked.th, sub:sel.picked.sub, tier:sel.picked.tier,
        equip:sel.picked.equip, // sectionWorkout ใช้แยกท่า bodyweight (ซ่อนช่องน้ำหนัก)
        setsReps: setsRepsFor(slot, sel.picked, a),
        intensity: planIntense(slot, sel.picked) ? 'intense' : 'normal',
        timeBased: !!sel.picked.timed
      };
    }).filter(Boolean);
    return {key:se.key, exercises:exercises};
  });
  return {
    splitKey:split, splitLabel:splitDef.label, goal:a.Q1,
    days:trainDays, dayToSession:dayToSession, sessions:sessions,
    availableDays:(a.Q2||[]).slice(),
    cardioDays:planCardioDays(a), cardioMinByDay:minsForDays(state.plan.cardioMinByDay, planCardioDays(a)),
    minutesEstimate:a.Q3||'45-60 นาที',
    trainTime:a.Q24||'ไม่แน่นอนแล้วแต่วัน',
    targets: computeTargets(a),
    startWeight: parseFloat(a.Q12)||null,
    exp: a.Q16||null, sex: a.Q9||null // ใช้ตั้งกรอบ Progression & Goal (แผนเก่าที่ไม่มีค่านี้ใช้คำตอบแบบสอบถามแทน)
  };
}

/* ============================================================
   ข้อมูลจาก localStorage — โหลดครั้งเดียวตอนเปิดหน้า แล้วเขียนทับทุกครั้งที่บันทึก
   ============================================================ */
var track = {
  program: lsGet("gymbro_program", null),
  logs: lsGet("gymbro_logs", {}),
  weights: lsGet("gymbro_weights", {}),
  viewMonth:null, weekStart:null,
  openDate:null, openSets:{}, saveStatus:'', openSwap:null,
  schedTab:'week', editing:false, progressEx:null, openBench:{}, sleepHoursError:{},
  demoExercise:null, // โมดัลภาพเคลื่อนไหวท่าในหน้าตรวจแผน (null = ปิด)
  histOpen:null, histDays:14, finalizedThrough:null, schedDraft:null, fatOpen:false,
  openSym:{}, openFood:{}, foodErr:{},
  pgMore:false, pgOpen:false, pgCrit:false, pgChecks:{}, pgResetAsk:false // กรอบแผน Progression & Goal: เปิดรายละเอียด / เปิดเกณฑ์ / ติ๊กตรวจข้อมูล
};
function persistProgram(){
  var ok = lsSet("gymbro_program", track.program);
  if(ok && syncOn()) Promise.resolve(GymBroSync.pushProgram(auth.session.user.id, track.program)).catch(function(){});
  return ok;
}
function persistLogs(){ return lsSet("gymbro_logs", track.logs); }
function persistWeights(){ return lsSet("gymbro_weights", track.weights); }

/* ---------- อ่าน log ของวันหนึ่ง ---------- */
function logFor(iso){ return track.logs[iso] || null; }
function weightFor(iso){ var w = track.weights[iso]; return w && w.kg!=null ? w.kg : null; }
/* น้ำหนักตัวล่าสุดที่รู้ ณ วันที่ iso (เอาบันทึกน้ำหนักที่ใกล้ iso ที่สุดแต่ไม่เกิน iso —
   ใช้สำหรับ Relative Strength ให้สะท้อนน้ำหนักตัวจริงช่วงนั้น แม่นกว่าใช้ค่าตอนทำ
   แบบสอบถามครั้งเดียวตายตัว) ถ้ายังไม่เคยชั่งน้ำหนักเลย fallback ไปน้ำหนักตอนเริ่มโปรแกรม */
function bodyweightAsOf(iso){
  var keys = Object.keys(track.weights).filter(function(k){
    return track.weights[k] && track.weights[k].kg!=null && k<=iso;
  }).sort();
  if(keys.length) return Number(track.weights[keys[keys.length-1]].kg);
  var p = track.program;
  return (p && p.startWeight!=null) ? Number(p.startWeight) : null;
}

function sessionKeyFor(program, iso){
  var wd = thaiWeekdayOfDate(parseISO(iso));
  if((program.days||[]).indexOf(wd)===-1) return null;
  return program.dayToSession[wd] || null;
}
function cardioPlannedFor(program, iso){
  return (program.cardioDays||[]).indexOf(thaiWeekdayOfDate(parseISO(iso)))>-1;
}
function cardioMinutesOn(iso){
  var c = (logFor(iso)||{}).cardio;
  return c && c.minutes>0 ? c.minutes : null;
}
/* ชื่อวัน = สิ่งที่วันนั้นมีจริง (เซสชันตามตาราง / Cardio ตามแผนหรือที่บันทึกเพิ่ม)
   ส่วนที่ผ่านวันไปแล้วแต่ไม่สำเร็จ ติด missed เพื่อแสดงเป็นตัวแดง */
function dayActivity(program, iso){
  var today = todayISO();
  var past = iso < today && iso >= (program.startDate||today);
  var sKey = sessionKeyFor(program, iso);
  var planned = cardioPlannedFor(program, iso);
  var mins = cardioMinutesOn(iso);
  var parts = [];
  if(sKey) parts.push({label:sKey, missed: past && !sessionDone(program, iso)});
  if(planned || mins) parts.push({label:'Cardio'+(mins? ' '+mins+' นาที' : ''), missed: past && planned && !mins});
  return parts;
}
function dayParts(program, iso){
  var lg = logFor(iso);
  return (lg && lg.final && lg.final.parts) ? lg.final.parts : dayActivity(program, iso);
}
function dayLabelHTML(program, iso, restLabel){
  var parts = dayParts(program, iso);
  if(!parts.length) return esc(restLabel||'พัก');
  return parts.map(function(x){
    return x.missed ? '<span class="act-miss" title="ไม่สำเร็จ">'+esc(x.label)+'</span>' : esc(x.label);
  }).join(' + ');
}
function sessionDefFor(program, sKey){
  if(!sKey) return null;
  var found = (program.sessions||[]).filter(function(s){return s.key===sKey;})[0];
  return found || null;
}
/* ---------- Warm-up set: บันทึกเป็นข้อมูลเท่านั้น ไม่นับความครบ/สตรีค/สีแดง ----------
   ท่า compound ที่ใช้น้ำหนักท่าแรกของเซสชัน 3 เซ็ต (40/60/80%), compound ถัดไป 2 เซ็ต (60/80%),
   ท่า isolation 1 เซ็ต (50%), ท่าน้ำหนักตัว 1 เซ็ตแบบเบา, core จับเวลาไม่ต้องวอร์ม */
var WARMUP_COMPOUND = ['squat','lunge','hinge','glute','hpush','incline','hpull','vpush','vpull'];
var WARMUP_WEIGHTED = ['barbell','dumbbell','machine','cable'];
/* ---------- ความเข้มข้นรายท่า (ทั่วไป/เข้มข้น) + เวลาพัก ----------
   เข้มข้น = 2 เซ็ต × 4-8 ครั้งจนหมดแรง ด้วยน้ำหนักที่สูงขึ้น (~79-88% ของ 1RM) เฉพาะท่าที่ใช้น้ำหนัก
   ท่าน้ำหนักตัวและ core เป็นแบบทั่วไปเสมอ */
var INTENSE_SCHEME = '2 x 4-8';
var INTENSE_WARNING = 'ต้องคุมฟอร์มให้ดีและเล่นให้ถูกต้องทุกครั้ง เนื่องจากใช้น้ำหนักสูงจึงอาจเสี่ยงบาดเจ็บได้';
function intensityEligible(ex){
  return !!ex && TIMED_PATTERNS.indexOf(ex.pattern)===-1 && SMALL_PATTERNS.indexOf(ex.pattern)===-1 && WARMUP_WEIGHTED.indexOf(ex.equip)>-1;
}
function isIntense(ex){ return intensityEligible(ex) && ex.intensity==='intense'; }
function planIntense(slot, ex){ return intensityEligible(ex) && (state.plan.intensity||{})[slot]==='intense'; }
function setsRepsFor(slot, ex, a){
  var base = slotBase(slot);
  if(TIMED_PATTERNS.indexOf(base)>-1) return (ex && ex.timed) ? '3 x 30-45 วิ' : '3 x 10-15';
  if(planIntense(slot, ex)) return INTENSE_SCHEME;
  if(SMALL_PATTERNS.indexOf(base)>-1) return '3 x 12-15';
  return repSchemeFor(a.Q1);
}
function restFor(ex){
  if(isIntense(ex)) return {set:'3-5 นาที', next:'3-5 นาที'};
  if(ex.timeBased || TIMED_PATTERNS.indexOf(ex.pattern)>-1) return {set:'30-60 วินาที', next:'2-3 นาที'};
  if(WARMUP_WEIGHTED.indexOf(ex.equip)===-1 || WARMUP_COMPOUND.indexOf(ex.pattern)===-1) return {set:'60-90 วินาที', next:'2-3 นาที'};
  return {set:'90-120 วินาที', next:'2-3 นาที'};
}
function warmupStepsFor(sess){
  var out = {}, firstHeavy = true;
  (sess ? sess.exercises : []).forEach(function(ex){
    var steps;
    if(ex.timeBased) steps = [];
    else if(WARMUP_WEIGHTED.indexOf(ex.equip)===-1) steps = [{pct:null, reps:'6-8', note:'แบบเบา/ช่วงสั้นกว่าเซ็ตจริง'}];
    else if(WARMUP_COMPOUND.indexOf(ex.pattern)===-1) steps = [{pct:0.5, reps:'10-12'}];
    else if(firstHeavy){ steps = [{pct:0.4, reps:'8-10'},{pct:0.6, reps:'5'},{pct:0.8, reps:'2-3'}]; firstHeavy = false; }
    else steps = [{pct:0.6, reps:'5'},{pct:0.8, reps:'2-3'}];
    out[ex.id] = steps;
  });
  return out;
}
function warmupKg(refKg, pct, equip){
  if(!refKg || !pct) return null;
  var step = equip==='dumbbell' ? 1 : 2.5;
  var kg = Math.round(refKg*pct/step)*step;
  if(equip==='barbell') kg = Math.max(20, kg);
  return Math.max(step, kg);
}
function warmupSummary(program, iso){
  var sess = sessionDefFor(program, sessionKeyFor(program, iso));
  var steps = warmupStepsFor(sess), exData = (logFor(iso)||{}).exercises || {};
  var byEx = [], done = 0, total = 0;
  (sess ? sess.exercises : []).forEach(function(ex){
    var n = steps[ex.id].length;
    if(!n) return;
    var flags = (exData[ex.id]||{}).warmup || [];
    var d = 0;
    for(var i=0;i<n;i++){ if(flags[i]) d++; }
    byEx.push({label:ex.th, done:d, total:n});
    done += d; total += n;
  });
  return {done:done, total:total, byEx:byEx};
}
/* ---------- แถบไขมัน (ชักเย่อ): TDEE − แคลที่กินจริง สะสมรายวัน ครบ ±7,700 kcal = ไขมัน ∓1 กก. แล้วเริ่มที่ 0 ใหม่ ----------
   1 กก. ไขมันในร่างกาย ≈ 7,700 kcal (เนื้อเยื่อไขมันมีไขมันจริง ~85% × 9 kcal/g) นับเฉพาะวันที่จบแล้ว (ก่อนวันนี้) และกรอกแคลอรี่ไว้ */
var FAT_KCAL_PER_KG = 7700;
var FAT_BAR_GOALS = ['ลดไขมัน', 'Recomposition (ลด+เพิ่มพร้อมกัน)'];
function fatBarEnabled(program){ return !!program && FAT_BAR_GOALS.indexOf(program.goal)>-1; }
function dayEnergy(program, iso){
  var lg = logFor(iso);
  if(lg && lg.final && lg.final.energy) return lg.final.energy;
  var kcal = lg && lg.nutrition ? lg.nutrition.kcal : null;
  var tdee = targetsOf(program).tdee;
  return (kcal!=null && tdee!=null) ? {kcal:kcal, tdee:tdee} : null;
}
function fatTug(program){
  var today = todayISO(), acc = 0, gains = [], losses = [], days = [];
  Object.keys(track.logs).filter(function(d){ return d < today; }).sort().forEach(function(iso){
    var en = dayEnergy(program, iso);
    if(!en) return;
    var bal = en.tdee - en.kcal; // + = กินขาด (ขวา/เขียว), − = กินเกิน (ซ้าย/แดง)
    acc += bal;
    var ev = null;
    if(acc >= FAT_KCAL_PER_KG){ losses.push(iso); acc = 0; ev = 'loss'; }
    else if(acc <= -FAT_KCAL_PER_KG){ gains.push(iso); acc = 0; ev = 'gain'; }
    days.push({date:iso, kcal:en.kcal, tdee:en.tdee, bal:bal, ev:ev});
  });
  return {acc:acc, gains:gains, losses:losses, days:days};
}
function fatSeen(){ var s = lsGet('gymbro_fat_seen', null); return (s && typeof s==='object') ? s : {gains:0, losses:0}; }
function targetsOf(program){
  return (program && program.targets) ? program.targets : computeTargets(state.answers);
}

/* ============================================================
   กรอบแผน Progression & Goal — ถ้าทำตามแผน ผลควรออกมาในกรอบไหน และผลจริงหลุดกรอบผิดปกติหรือไม่
   ------------------------------------------------------------
   ประเมินเป็น "รอบ": เริ่มที่วันเริ่มแผน หรือวันที่ปรับเป้า/เริ่มเก็บข้อมูลใหม่ (program.pg.evalFrom)
   ผลที่หลุดกรอบนับเป็น "ผิดปกติ" เฉพาะเมื่อทำตามแผนถึงเกณฑ์ — ถ้าทำตามแผนไม่ถึง ผลยังสะท้อนแผนไม่ได้
   ยกเว้นข้อ "การกินที่บันทึก vs น้ำหนักจริง" ซึ่งตรวจความสอดคล้องของข้อมูลเอง ไม่ขึ้นกับการทำตามเป้า
   ระดับ: ข้อมูลไม่พอ → ตามแผน → เฝ้าระวัง → ผิดปกติ (ให้ผู้ใช้ตรวจข้อมูลที่บันทึก) → ควรปรับแผน (ผู้ใช้ยืนยันแล้วว่าข้อมูลถูก)
   ตัวเลขกรอบเป็นค่าประมาณจากแนวทางทั่วไป ไม่ใช่การรับประกันผล
   ============================================================ */
var PG_WINDOW = 21;      // วันย้อนหลังที่ใช้หาแนวโน้มน้ำหนักและสมดุลพลังงาน
var PG_STR_WINDOW = 28;  // วันย้อนหลังที่ใช้หาแนวโน้มความแข็งแรง
var PG_EARLY_DAYS = 21;  // 3 สัปดาห์แรกของรอบ น้ำ/ไกลโคเจนทำให้น้ำหนักเปลี่ยนเร็วผิดปกติได้ — ยังไม่ตัดสินว่าผิดปกติ
/* น้ำหนักที่ควรเพิ่มต่อเดือนช่วงเพิ่มกล้าม (% น้ำหนักตัว) ตามประสบการณ์ มือใหม่ → นักกีฬา (แนวทางของ Helms et al.) */
var PG_GAIN_PCT_MONTH = [[1.0,1.5],[0.75,1.25],[0.5,1.0],[0.25,0.5]];
/* e1RM ที่ควรเพิ่มต่อ 4 สัปดาห์ (%) ตามประสบการณ์ — มือใหม่พัฒนาเร็ว ระดับสูงช้าลงมาก (ค่าประมาณ) */
var PG_STR_PCT_4W = [[4,10],[3,7],[1.5,4],[0.5,2]];
var PG_LEVELS = {
  na:{n:0, label:'ข้อมูลยังไม่พอประเมิน', icon:'⚪'},
  ok:{n:1, label:'เป็นไปตามแผน', icon:'🟢'},
  watch:{n:2, label:'เฝ้าระวัง', icon:'🟡'},
  anomaly:{n:3, label:'ผิดปกติ — ตรวจสอบข้อมูล', icon:'🟠'},
  adjust:{n:4, label:'ควรปรับแผน', icon:'🔴'}
};
function pgWorse(a, b){ return PG_LEVELS[b].n > PG_LEVELS[a].n ? b : a; }
function pgState(p){ return (p && p.pg) || {}; }
function pgAnchorDate(p){ var f = pgState(p).evalFrom; return (f && f > p.startDate) ? f : p.startDate; }
function pgExpRank(p){ var r = EXP_RANK[p.exp || state.answers.Q16]; return r!=null ? r : 0; }
function pgSex(p){ return p.sex || state.answers.Q9 || null; }
function nextISO(iso){ return fmtDateISO(addDays(parseISO(iso), 1)); }
function mean(arr){ return arr.length ? arr.reduce(function(s, x){ return s + x; }, 0)/arr.length : null; }
function pgRate(x){ return (x>0 ? '+' : (x<0 ? '−' : ''))+Math.abs(x).toFixed(2); }
function pgPct(x){ return (x>0 ? '+' : (x<0 ? '−' : ''))+Math.abs(x).toFixed(1)+'%'; }
/* เส้นตรงที่ fit ดีที่สุด (least squares) + standard error ของความชัน — ใช้แยกแนวโน้มจริงออกจากความแกว่งรายวัน */
function linreg(pts){
  var n = pts.length;
  if(n<2) return null;
  var mx = 0, my = 0;
  pts.forEach(function(q){ mx += q.x; my += q.y; });
  mx /= n; my /= n;
  var sxx = 0, sxy = 0;
  pts.forEach(function(q){ sxx += (q.x-mx)*(q.x-mx); sxy += (q.x-mx)*(q.y-my); });
  if(!sxx) return null;
  var b = sxy/sxx, a = my - b*mx, sse = 0;
  pts.forEach(function(q){ var r = q.y - (a + b*q.x); sse += r*r; });
  return {a:a, b:b, se: n>2 ? Math.sqrt(sse/(n-2)/sxx) : 0, n:n};
}
function sessionDone(p, iso){
  var lg = logFor(iso) || {};
  if(lg.completed) return true;
  var sess = sessionDefFor(p, sessionKeyFor(p, iso));
  return !!sess && sess.exercises.length>0 && sess.exercises.every(function(ex){ return ((lg.exercises||{})[ex.id]||{}).done; });
}
/* แคลที่เผาเพิ่มจากการออกกำลังกาย (สุทธิ หักการเผาผลาญขณะพักแล้ว): เวท ~3.5 MET, cardio ~5 MET
   kcal/นาที = (MET−1) × 3.5 × น้ำหนักตัว / 200 — TDEE ของระบบคิดจากลักษณะงานอย่างเดียว จึงต้องบวกส่วนนี้เพิ่มตอนคาดการณ์ */
function pgExerciseKcal(kg, sessions, sessMin, cardioMin){ return (sessions*sessMin*2.5 + cardioMin*4)*3.5*kg/200; }
function pgSessMin(p){ return Q3_MIN[p.minutesEstimate] || 52; }
function pgCardioWeek(p){ return (p.cardioDays||[]).reduce(function(s, d){ return s + cardioMinFor(p, d); }, 0); }
function pgPlannedExPerDay(p, kg){ return Math.round(pgExerciseKcal(kg, (p.days||[]).length, pgSessMin(p), pgCardioWeek(p))/7); }
function pgBMR(p, kg){
  var a = state.answers || {};
  return GymBroCalc.calculateBMR({weightKg:kg, heightCm:a.Q11, age:a.Q10, sex:pgSex(p)});
}
/* กรอบน้ำหนัก (กก./สัปดาห์, ลบ = ลด) ถ้าทำตามแผน
   ลดไขมัน/Recomp/รักษาสุขภาพ: จากสมดุลพลังงานของแผน = เป้าแคลอรี่ − (TDEE + แคลจากการออกกำลังกายตามแผน), 7,700 kcal ≈ 1 กก.
   เพิ่มกล้าม: % น้ำหนักตัวต่อเดือนตามประสบการณ์ (สมดุลพลังงานบอกไม่ได้ว่าส่วนที่เพิ่มเป็นกล้ามหรือไขมัน) */
function pgWeightPlan(p, kg){
  var t = targetsOf(p), ex = pgPlannedExPerDay(p, kg);
  var energy = (t.kcal!=null && t.tdee!=null) ? (t.kcal - (t.tdee + ex))*7/FAT_KCAL_PER_KG : null;
  var c, lo, hi;
  if(p.goal==='เพิ่มกล้ามเนื้อ'){
    var g = PG_GAIN_PCT_MONTH[pgExpRank(p)];
    lo = kg*g[0]/100*7/30.4; hi = kg*g[1]/100*7/30.4; c = (lo + hi)/2;
  } else if(p.goal==='ลดไขมัน'){
    c = energy!=null ? energy : -kg*0.0075;
    var w = Math.max(kg*0.0015, Math.abs(c)*0.3);
    lo = Math.max(c - w, Math.min(c, -kg*0.01)); // ลดเร็วเกิน 1% น้ำหนักตัว/สัปดาห์ เสี่ยงเสียกล้ามเนื้อ
    hi = c + w;
  } else {
    c = energy!=null ? energy : 0;
    lo = c - kg*0.002; hi = c + kg*0.002;
  }
  return {c:c, lo:lo, hi:hi, exPerDay:ex};
}
function pgStrengthBand(p){
  var b = PG_STR_PCT_4W[pgExpRank(p)];
  if(p.goal==='เพิ่มกล้ามเนื้อ') return [b[0], b[1]];
  if(p.goal==='ลดไขมัน') return [0, r1(b[1]*0.5)]; // ช่วงกินขาด: รักษาแรงไว้ได้ก็ถือว่าตามแผน
  return [r1(b[0]*0.6), r1(b[1]*0.8)];
}
/* น้ำหนักตั้งต้นของรอบ: ชั่งครั้งแรกภายใน 7 วันแรกของรอบ ไม่มีก็ใช้ค่าล่าสุดก่อนหน้า/น้ำหนักตอนทำแบบสอบถาม */
function pgAnchorKg(p){
  var from = pgAnchorDate(p), until = fmtDateISO(addDays(parseISO(from), 6));
  var s = weightSeries().filter(function(x){ return x.date >= from && x.date <= until; })[0];
  if(s) return {kg:s.kg, date:s.date};
  var kg = bodyweightAsOf(from);
  return kg!=null ? {kg:kg, date:from} : null;
}
function pgLifts(p){
  var out = [], seen = {};
  (p.sessions||[]).forEach(function(s){ s.exercises.forEach(function(ex){
    if(seen[ex.id] || ex.timeBased || WARMUP_WEIGHTED.indexOf(ex.equip)===-1) return;
    seen[ex.id] = true; out.push(ex);
  }); });
  return out;
}
function pgHasLiftData(p, iso){
  var sess = sessionDefFor(p, sessionKeyFor(p, iso)), exs = (logFor(iso)||{}).exercises || {};
  var weighted = (sess ? sess.exercises : []).filter(function(ex){ return WARMUP_WEIGHTED.indexOf(ex.equip)>-1 && !ex.timeBased; });
  if(!weighted.length) return true; // เซสชันน้ำหนักตัวล้วน ไม่ต้องมีน้ำหนักต่อเซ็ต
  return weighted.some(function(ex){ return ((exs[ex.id]||{}).sets||[]).some(function(s){ return s && Number(s.weight)>0; }); });
}
/* สรุปการทำตามแผน + จุดสังเกตคุณภาพข้อมูลในช่วง from..to (วันที่จบแล้ว) */
function pgAdherence(p, from, to){
  var t = targetsOf(p);
  var r = {days:0, sess:0, sessDone:0, sessNoData:0, cardio:0, cardioDone:0, cardioMin:0,
           kcal:[], kcalOkDays:0, macroMismatch:0, lowKcal:0, prot:[], sleep:[], injuries:0, stress:[], stressLog:[], stressHigh:[]};
  for(var iso=from; iso<=to; iso=nextISO(iso)){
    r.days++;
    var lg = logFor(iso) || {};
    if(sessionKeyFor(p, iso)){
      r.sess++;
      if(sessionDone(p, iso)){ r.sessDone++; if(!pgHasLiftData(p, iso)) r.sessNoData++; }
    }
    var cm = cardioMinutesOn(iso) || 0;
    r.cardioMin += cm;
    if(cardioPlannedFor(p, iso)){ r.cardio++; if(cm) r.cardioDone++; }
    var n = lg.nutrition || {};
    if(n.kcal!=null && n.kcal>0){
      r.kcal.push(n.kcal);
      if(kcalOk(n.kcal, t.kcal)) r.kcalOkDays++;
      if(n.proteinG!=null && n.carbG!=null && n.fatG!=null){
        var mk = n.proteinG*4 + n.carbG*4 + n.fatG*9;
        if(mk>0 && Math.abs(mk - n.kcal)/n.kcal > 0.15) r.macroMismatch++;
      }
      if(n.kcal < 800 || (t.kcal!=null && n.kcal < t.kcal*0.6)) r.lowKcal++;
    }
    if(n.proteinG!=null) r.prot.push(n.proteinG);
    var sl = lg.sleep || {};
    if(sl.hours!=null && isFinite(sl.hours) && sl.hours>=0 && sl.hours<=24) r.sleep.push(sl.hours);
    r.injuries += seriousSymptoms(iso).length;
    var st = stressOf(iso);
    if(st){
      r.stress.push(st.level);
      r.stressLog.push({date:iso, level:st.level, note:st.note||''});
      if(st.level >= 4) r.stressHigh.push({date:iso, level:st.level, note:st.note||''});
    }
  }
  var avgIn = mean(r.kcal);
  r.sessPct = r.sess ? r.sessDone/r.sess : null;
  r.kcalCover = r.days ? r.kcal.length/r.days : 0;
  r.avgIn = avgIn;
  r.train = r.sessPct==null || r.sessPct >= 0.75;
  r.food = r.kcalCover >= 0.7 && avgIn!=null && t.kcal!=null && Math.abs(avgIn - t.kcal) <= t.kcal*0.1;
  return r;
}
function pgFollowText(adh){
  var out = [];
  if(adh.sessPct!=null) out.push('เข้าฝึก '+Math.round(adh.sessPct*100)+'%');
  out.push('กรอกแคลอรี่ '+Math.round(adh.kcalCover*100)+'% ของวัน');
  if(adh.avgIn!=null) out.push('กินเฉลี่ย '+Math.round(adh.avgIn).toLocaleString()+' kcal');
  return out.join(' · ');
}
/* ข้อที่ทำตามแผนไม่ถึงเกณฑ์ — ใช้บอกว่าทำไมผลที่หลุดกรอบยังไม่นับว่าแผนผิดปกติ */
function pgFollowGap(p, adh){
  var t = targetsOf(p), out = [];
  if(adh.sessPct!=null && adh.sessPct < 0.75) out.push('เข้าฝึก '+Math.round(adh.sessPct*100)+'% (เกณฑ์ 75%)');
  if(adh.kcalCover < 0.7) out.push('กรอกแคลอรี่ '+Math.round(adh.kcalCover*100)+'% ของวัน (เกณฑ์ 70%)');
  else if(adh.avgIn!=null && t.kcal!=null && Math.abs(adh.avgIn - t.kcal) > t.kcal*0.1)
    out.push('กินเฉลี่ย '+Math.round(adh.avgIn).toLocaleString()+' kcal '+(adh.avgIn > t.kcal ? 'เกิน' : 'ต่ำกว่า')+'เป้า '+t.kcal.toLocaleString()+' เกิน 10%');
  return out.join(' · ');
}
function pgDirection(p, rate, dev){
  if(p.goal==='ลดไขมัน') return dev>0 ? (rate>=0 ? 'น้ำหนักไม่ลด' : 'ลดช้ากว่ากรอบ') : 'ลดเร็วกว่ากรอบ (เสี่ยงเสียกล้ามเนื้อ)';
  if(p.goal==='เพิ่มกล้ามเนื้อ') return dev<0 ? (rate<=0 ? 'น้ำหนักไม่เพิ่ม' : 'เพิ่มช้ากว่ากรอบ') : 'เพิ่มเร็วกว่ากรอบ (ส่วนเกินมักเป็นไขมัน)';
  return dev>0 ? 'น้ำหนักขึ้นมากกว่ากรอบ' : 'น้ำหนักลงมากกว่ากรอบ';
}
function pgWeightSignal(p, ev){
  var s = {key:'weight', title:'น้ำหนักตัวเทียบกรอบแผน', level:'na', text:''};
  var plan = ev.plan, band = 'กรอบ '+pgRate(plan.lo)+' ถึง '+pgRate(plan.hi)+' กก./สัปดาห์';
  if(!ev.reg){
    s.text = 'ต้องชั่งน้ำหนักอย่างน้อย 4 ครั้งในช่วง 10 วันขึ้นไปของรอบนี้ (ตอนนี้ '+ev.wpts.length+' ครั้ง) · '+band;
    return s;
  }
  var rate = ev.reg.b*7, kg = ev.refKg;
  var dev = rate > plan.hi ? rate - plan.hi : (rate < plan.lo ? rate - plan.lo : 0); // + = สูงกว่ากรอบ, − = ต่ำกว่ากรอบ
  var lvl = Math.abs(dev) <= kg*0.0005 ? 'ok' : (Math.abs(dev) <= Math.max(1.5*ev.reg.se*7, kg*0.001) ? 'watch' : 'anomaly');
  var early = ev.elapsed < PG_EARLY_DAYS && dev*plan.c > 0;
  if(lvl==='anomaly' && early) lvl = 'watch';
  s.rate = rate;
  var head = 'แนวโน้มจากการชั่ง '+ev.wpts.length+' ครั้งล่าสุด '+pgRate(rate)+' กก./สัปดาห์';
  if(lvl==='ok'){ s.level = 'ok'; s.text = head+' อยู่ใน'+band; return s; }
  var dir = pgDirection(p, rate, dev);
  if(!(ev.adh.food && ev.adh.train)){
    s.why = 'follow';
    s.text = head+' — '+dir+' ('+band+') แต่ช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ ('+pgFollowGap(p, ev.adh)+') ผลจึงยังไม่นับว่าแผนผิดปกติ';
    return s;
  }
  s.level = lvl; s.dev = dev;
  s.text = head+' — '+dir+' ('+band+') ทั้งที่ทำตามแผน ('+pgFollowText(ev.adh)+')'+
    (early ? ' · ช่วง 3 สัปดาห์แรกน้ำและไกลโคเจนทำให้น้ำหนักเปลี่ยนเร็วกว่าปกติได้' : '');
  return s;
}
/* พลังงานที่ร่างกายใช้จริง = กินเฉลี่ย − (น้ำหนักที่เปลี่ยนต่อวัน × 7,700) แล้วเทียบกับที่ระบบคาด (TDEE + การออกกำลังกายที่ทำจริง) */
function pgEnergySignal(p, ev){
  var s = {key:'energy', title:'การกินที่บันทึก เทียบกับน้ำหนักที่เปลี่ยนจริง', level:'na', text:''};
  var t = targetsOf(p), adh = ev.adh, need = Math.max(7, Math.ceil(adh.days*0.7));
  if(!ev.reg){ s.text = 'ต้องมีแนวโน้มน้ำหนักก่อน (ชั่งอย่างน้อย 4 ครั้งในช่วง 10 วันขึ้นไป)'; return s; }
  if(adh.kcal.length < need){ s.text = 'ต้องกรอกแคลอรี่อย่างน้อย '+need+' จาก '+adh.days+' วันในช่วงประเมิน (ตอนนี้ '+adh.kcal.length+' วัน)'; return s; }
  if(t.tdee==null){ s.text = 'คำนวณ TDEE ไม่ได้ — ข้อมูลแบบสอบถามไม่ครบ'; return s; }
  var exAct = pgExerciseKcal(ev.refKg, adh.sessDone, pgSessMin(p), adh.cardioMin)/adh.days;
  var implied = adh.avgIn - ev.reg.b*FAT_KCAL_PER_KG;
  var unc = ev.reg.se*FAT_KCAL_PER_KG;
  var expected = t.tdee + exAct, diff = implied - expected, bmr = pgBMR(p, ev.refKg);
  var lvl = Math.abs(diff) <= Math.max(0.12*expected, unc) ? 'ok' : (Math.abs(diff) <= Math.max(0.2*expected, 1.5*unc) ? 'watch' : 'anomaly');
  var belowBmr = bmr!=null && implied + unc < bmr;
  if(belowBmr) lvl = 'anomaly';
  if(lvl==='anomaly' && ev.elapsed < PG_EARLY_DAYS) lvl = 'watch';
  s.level = lvl; s.implied = implied; s.expected = expected; s.exAct = exAct; s.unc = unc; s.bmr = bmr; s.diff = diff;
  var nums = 'กินเฉลี่ย '+Math.round(adh.avgIn).toLocaleString()+' kcal/วัน และน้ำหนักเปลี่ยน '+pgRate(ev.reg.b*7)+' กก./สัปดาห์ → ร่างกายใช้พลังงานจริงประมาณ '+Math.round(implied).toLocaleString()+' kcal/วัน';
  var exp = ' ('+Math.round(expected).toLocaleString()+' kcal)';
  if(lvl==='ok'){ s.text = nums+' ใกล้กับที่ระบบคาด'+exp+' — ข้อมูลสอดคล้องกัน'; return s; }
  var pct = Math.round(Math.abs(diff)/expected*100);
  if(diff<0){
    s.text = nums+' ต่ำกว่าที่ระบบคาด'+exp+' '+pct+'%'+(belowBmr
      ? ' และต่ำกว่าพลังงานขั้นต่ำขณะพัก (BMR ~'+Math.round(bmr).toLocaleString()+' kcal) ซึ่งแทบเป็นไปไม่ได้ทางร่างกาย — มีแนวโน้มสูงว่าบันทึกการกินไม่ครบ หรือช่วงนี้มีน้ำคั่ง'
      : ' — มักเกิดจากบันทึกการกินไม่ครบ (เครื่องดื่ม ของว่าง น้ำมัน ซอส) หรือร่างกายใช้พลังงานน้อยกว่าที่คำนวณ');
  } else {
    s.text = nums+' สูงกว่าที่ระบบคาด'+exp+' '+pct+'% — อาจกรอกแคลอรี่เกินจริง เคลื่อนไหวมากขึ้น หรือน้ำหนักลดจากน้ำ';
  }
  return s;
}
function pgStrengthSignal(p, ev, ctx){
  var s = {key:'strength', title:'ความแข็งแรงเทียบกรอบแผน', level:'na', text:'', lifts:[]};
  var band = pgStrengthBand(p);
  var from = fmtDateISO(addDays(parseISO(ev.asOf), -PG_STR_WINDOW));
  if(from < ev.anchor) from = ev.anchor;
  pgLifts(p).forEach(function(ex){
    var h = (ctx.hist[ex.id]||[]).filter(function(d){ return d.date >= from && d.date <= ev.asOf; });
    if(h.length < 3 || daysBetween(h[0].date, h[h.length-1].date) < 14) return;
    var r = linreg(h.map(function(d){ return {x:daysBetween(h[0].date, d.date), y:d.e1rm}; }));
    if(!r || !(r.a>0)) return;
    var pct = r.b*28/r.a*100, dev = band[0] - pct;
    s.lifts.push({ex:ex, pct:pct, n:h.length, last:h[h.length-1].e1rm, level: dev<=1 ? 'ok' : (dev<=5 ? 'watch' : 'anomaly')});
  });
  var bandTxt = 'กรอบ e1RM '+(band[0]>0 ? '+' : '')+band[0]+' ถึง +'+band[1]+'% ต่อ 4 สัปดาห์';
  if(!s.lifts.length){ s.text = 'ต้องบันทึกน้ำหนัก × ครั้งของท่าที่ใช้น้ำหนัก อย่างน้อย 3 ครั้งต่อท่าในช่วง 14 วันขึ้นไป · '+bandTxt; return s; }
  var bad = s.lifts.filter(function(l){ return l.level!=='ok'; });
  var anom = s.lifts.filter(function(l){ return l.level==='anomaly'; });
  var lvl = (anom.length>=2 || (anom.length && anom.length*2 >= s.lifts.length)) ? 'anomaly'
    : (bad.length && bad.length*3 >= s.lifts.length ? 'watch' : 'ok');
  var head = s.lifts.length+' ท่าที่มีข้อมูล เฉลี่ย '+pgPct(mean(s.lifts.map(function(l){ return l.pct; })))+' ต่อ 4 สัปดาห์';
  var worst = bad.slice().sort(function(a, b){ return a.pct - b.pct; });
  var names = worst.slice(0, 3).map(function(l){ return l.ex.th+' '+pgPct(l.pct); }).join(', ')+(worst.length>3 ? ' และอีก '+(worst.length-3)+' ท่า' : '');
  if(lvl==='ok'){ s.level = 'ok'; s.text = head+' อยู่ใน'+bandTxt+(names ? ' · ท่าที่ยังช้ากว่ากรอบ: '+names : ''); return s; }
  var sp = 0, sd = 0;
  for(var iso=from; iso<ev.asOf; iso=nextISO(iso)){ if(sessionKeyFor(p, iso)){ sp++; if(sessionDone(p, iso)) sd++; } }
  if(sp && sd/sp < 0.75){
    s.why = 'follow';
    s.text = head+' — ต่ำกว่า'+bandTxt+' ('+names+') แต่เข้าฝึกได้ '+Math.round(sd/sp*100)+'% (เกณฑ์ 75%) ผลจึงยังไม่นับว่าแผนผิดปกติ';
    return s;
  }
  s.level = lvl;
  s.text = head+' — ต่ำกว่า'+bandTxt+' ('+names+') ทั้งที่เข้าฝึก '+(sp ? Math.round(sd/sp*100) : 0)+'%';
  return s;
}
/* จุดที่ระบบเห็นเองจากตัวข้อมูลว่าอาจบันทึกไม่ครบ/ไม่แม่น */
function pgDataIssues(p, ev){
  var t = targetsOf(p), adh = ev.adh, out = [];
  if(adh.days >= 7){
    var perWeek = ev.wpts.length/((daysBetween(ev.ws, ev.asOf)+1)/7);
    if(perWeek < 3) out.push({lvl:'warn', text:'ชั่งน้ำหนักเฉลี่ย '+fmt1(perWeek)+' ครั้ง/สัปดาห์ — ควรชั่ง 3-7 ครั้ง/สัปดาห์ในช่วงเวลาเดิม ระบบจึงแยกแนวโน้มจริงออกจากน้ำในร่างกายได้'});
    if(adh.kcal.length < adh.days) out.push({lvl: adh.kcalCover < 0.7 ? 'warn' : 'info', text:'ไม่ได้กรอกแคลอรี่ '+(adh.days - adh.kcal.length)+' จาก '+adh.days+' วัน'});
    if(adh.sleep.length < adh.days*0.7) out.push({lvl:'info', text:'บันทึกการนอนแค่ '+adh.sleep.length+' จาก '+adh.days+' วัน'});
  }
  for(var i=1; i<ev.wpts.length; i++){
    var a = ev.wpts[i-1], b = ev.wpts[i], jump = b.y - a.y;
    if(b.x - a.x <= 3 && Math.abs(jump) >= Math.max(2, b.y*0.025)){
      out.push({lvl:'warn', text:'น้ำหนักกระโดด '+(jump>0?'+':'−')+fmt1(Math.abs(jump))+' กก. ใน '+(b.x - a.x)+' วัน ('+shortDateTH(a.date)+' → '+shortDateTH(b.date)+') — พิมพ์ผิด หรือชั่งคนละเวลา/คนละเครื่อง?'});
    }
  }
  if(adh.kcal.length >= 5){
    var cnt = {}, top = null;
    adh.kcal.forEach(function(v){ cnt[v] = (cnt[v]||0) + 1; if(top==null || cnt[v] > cnt[top]) top = v; });
    var nearTarget = t.kcal!=null ? adh.kcal.filter(function(v){ return Math.abs(v - t.kcal) <= 5; }).length : 0;
    if(cnt[top]/adh.kcal.length >= 0.6) out.push({lvl:'warn', text:'แคลอรี่ '+Number(top).toLocaleString()+' kcal ซ้ำกัน '+cnt[top]+' จาก '+adh.kcal.length+' วัน — ถ้าเป็นตัวเลขที่กะไว้หรือกรอกตามเป้า ระบบจะประเมินคลาดเคลื่อน'});
    else if(nearTarget/adh.kcal.length >= 0.5) out.push({lvl:'warn', text:'แคลอรี่ที่กรอกตรงกับเป้าพอดี '+nearTarget+' จาก '+adh.kcal.length+' วัน — เป็นยอดที่กินจริงหรือกรอกตามเป้า?'});
  }
  if(adh.macroMismatch >= 2) out.push({lvl:'warn', text:adh.macroMismatch+' วันที่แคลอรี่ไม่ตรงกับโปรตีน/คาร์บ/ไขมันที่กรอก (ต่างกันเกิน 15%) — อาจลืมกรอกบางรายการ'});
  if(adh.lowKcal) out.push({lvl:'warn', text:adh.lowKcal+' วันที่แคลอรี่ต่ำผิดปกติ (ต่ำกว่า 60% ของเป้าหรือ 800 kcal) — ลืมกรอกบางมื้อหรือไม่?'});
  if(adh.sessNoData) out.push({lvl:'info', text:'ติ๊กว่าเล่นครบ '+adh.sessNoData+' วันแต่ไม่ได้บันทึกน้ำหนัก/ครั้งต่อเซ็ต — ระบบประเมินความแข็งแรงจากวันนั้นไม่ได้'});
  return out;
}
/* สรุปความเครียดในช่วงประเมิน — นับเป็นปัจจัยเมื่อบันทึก ≥3 วัน และ เฉลี่ย ≥3.5/5 หรือเครียดมาก (4-5)
   ≥30% ของวันที่บันทึก (อย่างน้อย 3 วัน) หรือ 7 วันล่าสุดสูงขึ้นจากก่อนหน้า ≥1 ระดับ */
function pgStressSummary(ev){
  var adh = ev.adh, log = adh.stressLog;
  if(!log.length) return null;
  var avgS = mean(adh.stress), high = adh.stressHigh.length, cut = fmtDateISO(addDays(parseISO(ev.asOf), -7));
  var recent = log.filter(function(x){ return x.date >= cut; }).map(function(x){ return x.level; });
  var before = log.filter(function(x){ return x.date < cut; }).map(function(x){ return x.level; });
  var rising = recent.length>=3 && before.length>=3 && mean(recent) - mean(before) >= 1 && mean(recent) >= 3;
  var heavy = avgS >= 3.5 || high >= Math.max(3, Math.ceil(log.length*0.3));
  var flag = log.length >= 3 && (heavy || rising);
  var notes = adh.stressHigh.filter(function(x){ return x.note; }).slice(-3).map(function(x){
    return '“'+(x.note.length > 40 ? x.note.slice(0, 40)+'…' : x.note)+'”';
  });
  var text = (flag ? (heavy ? 'ความเครียดสูง: ' : 'ความเครียดเพิ่มขึ้น: ') : 'ความเครียด: ')+
    'เฉลี่ย '+fmt1(avgS)+'/5 · เครียดมาก (4-5) '+high+' จาก '+log.length+' วันที่บันทึก'+
    (rising ? ' · 7 วันล่าสุดสูงขึ้นจาก '+fmt1(mean(before))+' เป็น '+fmt1(mean(recent)) : '')+
    (notes.length ? ' (สาเหตุที่บันทึก: '+notes.join(', ')+')' : '');
  return {flag:flag, avg:avgS, high:high, n:log.length, rising:rising, text:text};
}
/* ปัจจัยที่อาจทำให้ผลไม่ตรงกรอบ (ใช้อธิบายประกอบ ไม่ใช่ตัวตัดสินระดับ) */
function pgCauses(p, ev){
  var t = targetsOf(p), adh = ev.adh, out = [];
  var sl = mean(adh.sleep), pr = mean(adh.prot);
  if(sl!=null && t.sleepH!=null && sl < t.sleepH - 0.5) out.push('นอนเฉลี่ย '+fmt1(sl)+' ชม. (เป้า '+fmt1(t.sleepH)+') — นอนน้อยทำให้ฟื้นตัวช้าและน้ำหนักแกว่ง');
  if(pr!=null && t.proteinG && pr < t.proteinG*0.9) out.push('โปรตีนเฉลี่ย '+Math.round(pr)+' g ('+Math.round(pr/t.proteinG*100)+'% ของเป้า) — ไม่พอต่อการรักษา/สร้างกล้ามเนื้อ');
  if(adh.injuries) out.push('มีอาการเข้าข่ายบาดเจ็บที่บันทึกไว้ '+adh.injuries+' ครั้งในช่วงนี้');
  var ss = pgStressSummary(ev);
  if(ss && ss.flag) out.push(ss.text+' — ความเครียดสะสมทำให้นอนแย่ ฟื้นตัวช้า อยากอาหารมากขึ้น และน้ำหนักแกว่งจากการคั่งน้ำ');
  if(p.goal==='ลดไขมัน' && ev.strength.level!=='ok' && ev.strength.level!=='na') out.push('อยู่ในช่วงกินขาด ความแข็งแรงเพิ่มช้าลงได้ แต่ไม่ควรลดลงต่อเนื่อง');
  return out;
}
function pgContext(p){
  var hist = {};
  pgLifts(p).forEach(function(ex){ hist[ex.id] = exerciseHistory(ex.id); });
  return {hist:hist, series:weightSeries(), anchorKg:pgAnchorKg(p)};
}
function pgEvaluate(p, asOf, ctx){
  var anchor = pgAnchorDate(p), ak = ctx.anchorKg;
  var refKg = ak ? ak.kg : (p.startWeight || 70);
  var ws = fmtDateISO(addDays(parseISO(asOf), -PG_WINDOW));
  if(ws < anchor) ws = anchor;
  var adh = pgAdherence(p, ws, fmtDateISO(addDays(parseISO(asOf), -1)));
  var wpts = ctx.series.filter(function(s){ return s.date >= ws && s.date <= asOf; })
    .map(function(s){ return {x:daysBetween(ws, s.date), y:s.kg, date:s.date}; });
  var span = wpts.length>1 ? wpts[wpts.length-1].x - wpts[0].x : 0;
  var ev = {asOf:asOf, anchor:anchor, elapsed:daysBetween(anchor, asOf), ws:ws, refKg:refKg,
            plan:pgWeightPlan(p, refKg), adh:adh, wpts:wpts, reg:(wpts.length>=4 && span>=10) ? linreg(wpts) : null};
  ev.weight = pgWeightSignal(p, ev);
  ev.energy = pgEnergySignal(p, ev);
  ev.strength = pgStrengthSignal(p, ev, ctx);
  ev.signals = [ev.weight, ev.energy, ev.strength];
  // "ตามแผน" ต้องมาจากผลลัพธ์จริง (น้ำหนัก/ความแข็งแรง) — ข้อความสอดคล้องของข้อมูลยกระดับได้เฉพาะตอนพบปัญหา
  ev.level = pgWorse(pgWorse(ev.weight.level, ev.strength.level), ev.energy.level==='ok' ? 'na' : ev.energy.level);
  // เป้าลดไขมัน/เพิ่มกล้าม น้ำหนักคือผลหลัก — ถ้ายังประเมินน้ำหนักไม่ได้เพราะทำตามแผนไม่ถึง ไม่ขึ้นว่า "ตามแผน" จากความแข็งแรงอย่างเดียว
  if(ev.level==='ok' && ev.weight.why==='follow' && (p.goal==='ลดไขมัน' || p.goal==='เพิ่มกล้ามเนื้อ')) ev.level = 'na';
  ev.issues = pgDataIssues(p, ev);
  ev.causes = pgCauses(p, ev);
  return ev;
}
/* ผลประเมินรายสัปดาห์ย้อนหลังในรอบนี้ (สูงสุด 8 สัปดาห์ล่าสุด) — ให้เห็นว่าระหว่างทางเริ่มผิดปกติตั้งแต่เมื่อไร */
function pgHistory(p, ctx){
  var anchor = pgAnchorDate(p), weeks = Math.floor(daysBetween(anchor, todayISO())/7), out = [];
  for(var k=Math.max(1, weeks-7); k<=weeks; k++){
    var d = fmtDateISO(addDays(parseISO(anchor), 7*k));
    out.push({week:k, date:d, level:pgEvaluate(p, d, ctx).level});
  }
  return out;
}
/* ผลประเมิน ณ วันนี้
   - เฝ้าระวังต่อเนื่องตั้งแต่ 4 สัปดาห์ (3 จุดตรวจก่อนหน้า + วันนี้) → ผิดปกติ: หลุดกรอบเล็กน้อยแต่ไม่หายไปเอง
   - ผิดปกติ + ผู้ใช้ยืนยันว่าข้อมูลถูกต้องแล้ว (ภายใน 28 วัน ในรอบเดียวกัน) → ควรปรับแผน */
function pgCurrent(p){
  var ctx = pgContext(p), today = todayISO(), pg = pgState(p);
  var ev = pgEvaluate(p, today, ctx);
  ev.ctx = ctx;
  ev.history = pgHistory(p, ctx).filter(function(x){ return x.date < today; });
  ev.run = 0;
  for(var i=ev.history.length-1; i>=0 && PG_LEVELS[ev.history[i].level].n >= 2; i--) ev.run++;
  if(ev.level==='watch' && ev.run >= 3){ ev.level = 'anomaly'; ev.persisted = true; }
  ev.confirmed = !!pg.confirmedAt && pg.confirmedAt >= ev.anchor && daysBetween(pg.confirmedAt, today) <= 28;
  if(ev.level==='anomaly' && ev.confirmed) ev.level = 'adjust';
  return ev;
}
function pgOff(s){ return s.level==='watch' || s.level==='anomaly'; }
/* คำแนะนำปรับแผน: เป้าแคลอรี่ใหม่ = พลังงานที่ใช้จริง ± ส่วนต่างที่ต้องการตามกรอบ ปรับทีละไม่เกิน 300 kcal ไม่ต่ำกว่าขั้นต่ำปลอดภัย */
function pgRecommend(p, ev){
  var t = targetsOf(p), en = ev.energy, out = {kcal:null, text:[]};
  if((pgOff(ev.weight) || pgOff(en)) && en.implied!=null && t.kcal!=null){
    var want = en.implied + ev.plan.c*FAT_KCAL_PER_KG/7;
    var floor = pgSex(p)==='ชาย' ? 1500 : 1200;
    var kcal = Math.max(floor, Math.round(Math.min(t.kcal + 300, Math.max(t.kcal - 300, want))/10)*10);
    out.floor = floor; out.want = Math.round(want); out.belowFloor = want < floor;
    if(Math.abs(kcal - t.kcal) >= 50){
      out.kcal = kcal; out.capped = Math.abs(want - kcal) > 10;
      out.tdee = Math.round(en.implied - en.exAct);
    }
    if(out.belowFloor) out.text.push('แคลอรี่ที่ต้องใช้เพื่อให้ได้ตามกรอบต่ำกว่าขั้นต่ำที่ปลอดภัย ('+fmtKcal(floor)+' kcal) — ระบบจะไม่ตั้งเป้าต่ำกว่านั้น ให้เพิ่มการเคลื่อนไหว/cardio แทน หรือยอมให้ลดช้าลง และถ้าลดได้น้อยมากต่อเนื่องควรปรึกษาแพทย์');
  }
  if(pgOff(ev.strength)){
    out.text.push('ลดภาระ 1 สัปดาห์ (deload): ใช้น้ำหนักเดิมแต่ลดจำนวนเซ็ตลงครึ่งหนึ่ง แล้วกลับมาเล่นตามแผน');
    out.text.push('ท่าที่ตันต่อเนื่อง: เปลี่ยนช่วงจำนวนครั้ง หรือเปลี่ยนเป็นท่าใกล้เคียงได้ที่หน้า “แผนของฉัน”');
    if(p.goal==='ลดไขมัน') out.text.push('ถ้าแรงตกต่อเนื่องระหว่างลดไขมัน ลดการกินขาดลง 100-200 kcal/วัน');
  }
  ev.causes.forEach(function(c){ out.text.push('แก้ปัจจัยนี้ก่อน: '+c); });
  var ss = pgStressSummary(ev);
  if(ss && ss.flag) out.text.push('จัดการความเครียดควบคู่ไปด้วย: นอนให้ถึงเป้า เดินเบา ๆ หรือยืดเหยียด 10-20 นาที วันที่เครียดมากให้ฝึกตามแผนโดยไม่เพิ่มน้ำหนัก — ถ้าเครียดมากต่อเนื่องหลายสัปดาห์ควรคุยกับผู้เชี่ยวชาญ (สายด่วนสุขภาพจิต 1323)');
  return out;
}
function pgSave(patch){
  var p = track.program;
  if(!p) return;
  var cur = pgState(p), nx = {};
  Object.keys(cur).forEach(function(k){ nx[k] = cur[k]; });
  Object.keys(patch).forEach(function(k){ nx[k] = patch[k]; });
  p.pg = nx;
  persistProgram();
  render();
}
function pgApply(){
  var p = track.program;
  if(!p) return;
  var ev = pgCurrent(p);
  if(ev.level!=='adjust') return;
  var rec = pgRecommend(p, ev);
  if(rec.kcal==null) return;
  var t = targetsOf(p), today = todayISO(), pg = pgState(p);
  var base = pg.baseDirection || t.kcalDirection || '';
  var nt = {};
  Object.keys(t).forEach(function(k){ nt[k] = t[k]; });
  var macro = computeMacro(rec.kcal, t.proteinG ? t.proteinG/2 : bodyweightAsOf(today)); // คงเป้าโปรตีนเดิม
  nt.kcal = rec.kcal; nt.tdee = rec.tdee; nt.fatG = macro.fatG; nt.carbG = macro.carbG; nt.macroClamped = macro.clamped;
  nt.kcalDirection = base+' · ปรับตามผลจริงเมื่อ '+shortDateTH(today);
  p.targets = nt;
  track.pgChecks = {};
  pgSave({evalFrom:today, confirmedAt:null, baseDirection:base,
          adjustments:(pg.adjustments||[]).concat([{date:today, fromKcal:t.kcal, toKcal:rec.kcal, fromTdee:t.tdee, toTdee:rec.tdee}])});
}

/* แก้ได้เฉพาะวันนี้กับเมื่อวาน (ตามเวลาเครื่อง) — พ้นเที่ยงคืนของวันถัดไปแล้วล็อกถาวร */
var LOCKED_MSG = 'วันนี้ถูกล็อกแล้ว — แก้ไขได้เฉพาะวันนี้และเมื่อวานเท่านั้น';
function editableFrom(){ return fmtDateISO(addDays(new Date(), -1)); }
function isEditable(iso){ return iso <= todayISO() && iso >= editableFrom(); }

/* ---------- เขียน log รายวัน: อ่านของเดิมมา merge เสมอ ไม่ให้ข้อมูลหมวดอื่นหาย ---------- */
function saveDay(iso, patch){
  if(!isEditable(iso)){ track.saveStatus = LOCKED_MSG; render(); return; }
  var cur = logFor(iso) || {};
  var program = track.program || {};
  var body = {
    date: iso,
    sessionKey: cur.sessionKey || sessionKeyFor(program, iso) || null,
    planId: cur.planId || program.planId || null,
    exercises: cur.exercises || {},
    completed: cur.completed || false,
    nutrition: cur.nutrition || {},
    sleep: cur.sleep || {},
    cardio: cur.cardio || {},
    stress: cur.stress || {},
    updatedAt: new Date().toISOString()
  };
  Object.keys(patch).forEach(function(k){ body[k] = patch[k]; });
  track.logs[iso] = body;
  var ok = persistLogs();
  if(ok && syncOn()) Promise.resolve(GymBroSync.pushDailyLog(auth.session.user.id, iso, body)).catch(function(){});
  track.saveStatus = ok ? "บันทึกแล้ว ✓" : "บันทึกไม่ได้ — พื้นที่จัดเก็บของเบราว์เซอร์ใช้ไม่ได้ตอนนี้";
  render();
}
function saveWeight(iso, kg){
  if(!isEditable(iso)){ track.saveStatus = LOCKED_MSG; render(); return; }
  var body = {date:iso, kg:kg, updatedAt:new Date().toISOString()};
  track.weights[iso] = body;
  var ok = persistWeights();
  if(ok && syncOn()) Promise.resolve(GymBroSync.pushWeight(auth.session.user.id, iso, kg)).catch(function(){});
  track.saveStatus = ok ? "บันทึกแล้ว ✓" : "บันทึกไม่ได้ — พื้นที่จัดเก็บของเบราว์เซอร์ใช้ไม่ได้ตอนนี้";
  render();
}

/* ---------- คำนวณสถานะรายวัน / สตรีค / % ทำตามแผน ---------- */
function dayItems(program, iso){
  var t = targetsOf(program);
  var log = logFor(iso) || {};
  var items = [];
  var sKey = sessionKeyFor(program, iso);
  var sess = sessionDefFor(program, sKey);
  var NA = 'ไม่ได้บันทึก';
  if(sess){
    sess.exercises.forEach(function(ex){
      var e = (log.exercises||{})[ex.id] || {};
      var exDone = !!e.done || !!log.completed;
      items.push({group:'workout', key:'ex-'+ex.id, label:ex.th, val: exDone?'ทำแล้ว':'ยังไม่ติ๊ก', done: exDone});
    });
  }
  if(cardioPlannedFor(program, iso)){
    var cm = cardioMinutesOn(iso);
    items.push({group:'cardio', key:'cardio', label:'Cardio', val: cm? cm+' / '+cardioTargetOn(program, iso)+' นาที' : NA, done: !!cm});
  }
  var n = log.nutrition || {};
  items.push({group:'food', key:'protein', label:'โปรตีน', val: n.proteinG!=null? n.proteinG+' / '+t.proteinG+' g' : NA, done: n.proteinG!=null && n.proteinG >= t.proteinG*0.9});
  items.push({group:'food', key:'kcal', label:'แคลอรี่', val: n.kcal!=null? fmtKcal(n.kcal)+' / '+fmtKcal(t.kcal)+' kcal' : NA, done: kcalOk(n.kcal, t.kcal)});
  items.push({group:'food', key:'water', label:'น้ำ', val: n.waterL!=null? n.waterL+' / '+fmt1(t.waterL)+' ล.' : NA, done: n.waterL!=null && n.waterL >= t.waterL*0.9});
  for(var i=0;i<t.meals;i++){
    var ate = !!(n.meals && n.meals[i]);
    items.push({group:'food', key:'meal'+i, label:'มื้อ '+(i+1), val: ate?'กินแล้ว':NA, done: ate});
  }
  var sl = log.sleep || {};
  items.push({group:'sleep', key:'hours', label:'ชั่วโมงนอน', val: sl.hours!=null? sl.hours+' ชม.' : NA, done: sl.hours!=null && isFinite(sl.hours) && sl.hours>=0 && sl.hours<=24 && t.sleepH!=null && sl.hours >= t.sleepH-0.5});
  if(t.sleepHygiene) items.push({group:'sleep', key:'hygiene', label:'Sleep hygiene', val: sl.hygiene?'ทำแล้ว':NA, done: !!sl.hygiene});
  var kg = weightFor(iso);
  items.push({group:'body', key:'weight', label:'น้ำหนักตัว', val: kg!=null? fmt1(kg)+' กก.' : NA, done: kg!=null});
  return items;
}

/* ---------- ประวัติรายวัน: วันที่ล็อกแล้วเก็บผลสุดท้ายไว้ใน log.final (ไม่เปลี่ยนตามแผน/เป้าที่แก้ทีหลัง) ---------- */
var REPORT_GROUPS = [
  {k:'workout', label:'การฝึก'}, {k:'cardio', label:'Cardio'}, {k:'food', label:'โภชนาการ'},
  {k:'sleep', label:'การนอน'}, {k:'body', label:'น้ำหนักตัว'}
];
function dayReport(program, iso){
  var lg = logFor(iso);
  if(lg && lg.final) return lg.final;
  var items = dayItems(program, iso).map(function(x){ return {group:x.group, label:x.label, val:x.val, done:x.done}; });
  return {items:items, complete: items.every(function(x){ return x.done; }), warmup: warmupSummary(program, iso)};
}
function finalizeLockedDays(){
  var p = track.program;
  if(!p || !p.startDate) return;
  var until = editableFrom();
  if(track.finalizedThrough===until) return;
  var changed = [];
  // ทุกวันตั้งแต่วันเริ่มจนก่อนช่วงที่ยังแก้ได้ — วันที่ไม่มีบันทึกเลยได้ stub ไว้เป็นวันที่ไม่ครบ
  for(var iso = p.startDate; iso < until; iso = fmtDateISO(addDays(parseISO(iso), 1))){
    var lg = track.logs[iso];
    if(lg && lg.final) continue;
    var rep = dayReport(p, iso);
    var next = lg ? {} : {date: iso, stub: true};
    if(lg) Object.keys(lg).forEach(function(k){ next[k] = lg[k]; });
    next.final = {at: new Date().toISOString(), parts: dayActivity(p, iso), items: rep.items, complete: rep.complete, warmup: rep.warmup,
                  energy: dayEnergy(p, iso)};
    track.logs[iso] = next;
    changed.push(iso);
  }
  track.finalizedThrough = until;
  if(!changed.length) return;
  if(persistLogs() && syncOn()){
    Promise.resolve(GymBroSync.pushDailyLogs(auth.session.user.id, changed.map(function(d){ return {date:d, payload:track.logs[d]}; }))).catch(function(){});
  }
}
function dayCounts(program, iso){
  var items = dayItems(program, iso);
  var done = items.filter(function(x){return x.done;}).length;
  return {done:done, total:items.length};
}
function dayStatus(program, iso){
  var today = todayISO();
  var sKey = sessionKeyFor(program, iso);
  if(iso < (program.startDate||today)) return 'before';
  if(iso > today) return sKey ? 'future' : 'rest-future';
  var log = logFor(iso);
  if(log && log.stub) log = null;
  if(!sKey){
    if(!log) return 'rest';
    var c = dayCounts(program, iso);
    return c.done>=c.total ? 'rest-done' : 'rest';
  }
  if(log && log.completed) return 'done';
  if(log) return 'partial';
  return 'pending';
}
function streakOf(program){
  if(!program || !program.startDate) return 0;
  var today = todayISO();
  var cur = today, n = 0, guard = 0;
  var sToday = sessionKeyFor(program, today);
  if(sToday){
    var lt = logFor(today);
    if(!(lt && lt.completed)) cur = fmtDateISO(addDays(new Date(), -1));
  }
  while(guard++ < 400){
    if(cur < program.startDate) break;
    var sKey = sessionKeyFor(program, cur);
    if(sKey){
      var lg = logFor(cur);
      if(!(lg && lg.completed)) break;
      n++;
    } else {
      n++;
    }
    cur = fmtDateISO(addDays(parseISO(cur), -1));
  }
  return n;
}
function weeklyAdherence(program, weeks){
  var out = [];
  var today = new Date();
  var thisWeekStart = startOfWeek(today);
  for(var w=weeks-1; w>=0; w--){
    var ws = addDays(thisWeekStart, -7*w);
    var planned = 0, done = 0;
    for(var i=0;i<7;i++){
      var d = addDays(ws, i);
      var iso = fmtDateISO(d);
      if(iso < program.startDate || iso > todayISO()) continue;
      if(!sessionKeyFor(program, iso)) continue;
      planned++;
      var lg = logFor(iso);
      if(lg && lg.completed) done++;
    }
    out.push({start:fmtDateISO(ws), planned:planned, done:done, pct: planned? Math.round(done/planned*100) : null});
  }
  return out;
}
function weightSeries(){
  var keys = Object.keys(track.weights).filter(function(k){ return track.weights[k] && track.weights[k].kg!=null; }).sort();
  return keys.map(function(k){ return {date:k, kg: Number(track.weights[k].kg)}; });
}
function exerciseHistory(exId){
  var out = [];
  Object.keys(track.logs).sort().forEach(function(iso){
    var lg = track.logs[iso];
    var e = lg && lg.exercises && lg.exercises[exId];
    if(!e || !e.sets) return;
    var best=null, vol=0;
    e.sets.forEach(function(s){
      if(!s) return;
      var wgt = s.weight==null? null : Number(s.weight);
      var reps = s.reps==null? null : Number(s.reps);
      if(wgt==null || isNaN(wgt) || wgt<=0) return;
      if(reps!=null && !isNaN(reps)) vol += wgt*reps;
      // e1RM มาจาก GymBroBenchmark.calculateEstimated1RM (สูตร Epley) เสมอ — จุดเดียว
      // ที่คำนวณสูตรนี้ในระบบ ห้ามเขียนสูตรซ้ำที่นี่ ถ้า reps ไม่ใช่จำนวนเต็ม/ไม่มีค่า
      // (เช่น log น้ำหนักเฉยๆ) ใช้น้ำหนักตรงๆ แทนเหมือนพฤติกรรมเดิม
      var e1 = GymBroBenchmark.calculateEstimated1RM(wgt, reps);
      if(e1==null) e1 = wgt;
      if(!best || e1 > best.e1rm) best = {weight:wgt, reps:reps, e1rm:e1};
    });
    if(best) out.push({date:iso, weight:best.weight, reps:best.reps, e1rm:Math.round(best.e1rm*10)/10, volume:Math.round(vol)});
  });
  return out;
}
/* ============================================================
   RENDER
   ============================================================ */
function esc(s){return String(s).replace(/[&<>"']/g,function(c){return {"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c];});}
function num(v){ return v==null||v===""?"":String(v); }
function fmt1(n){ return (Math.round(n*10)/10).toFixed(1); }

function currentView(){
  if(!track.program || state.editPlan) return 'onboarding';
  var v = state.nav||'today';
  var allowed = ['today','schedule','progress','plan'];
  if(auth.session) allowed.push('coach'); // ต้อง login ก่อนเท่านั้น (ต้องมี access token ส่งไป /api/coach)
  return allowed.indexOf(v)>-1 ? v : 'today';
}

/* short = ป้ายสำหรับแท็บบาร์ล่างบนจอมือถือ (5 แท็บแบ่งความกว้างกัน คำเต็มยาวเกิน)
   ป้ายทั้งสองแบบถูก render ลง HTML พร้อมกันเสมอ แล้วให้ CSS เลือกโชว์ตามความกว้างจอ
   — ไม่ต้องรู้ขนาดจอฝั่ง JS และไม่ต้อง re-render เวลาหมุนจอ */
var NAV_ITEMS = [
  {k:'today', label:'วันนี้', short:'วันนี้'},
  {k:'schedule', label:'ตารางฝึก', short:'ตาราง'},
  {k:'progress', label:'ความคืบหน้า', short:'คืบหน้า'},
  {k:'plan', label:'แผนของฉัน', short:'แผน'}
];
var NAV_ITEM_COACH = {k:'coach', label:'ถามโค้ช', short:'โค้ช'}; // แสดงเฉพาะตอน login แล้วเท่านั้น (ดู renderNav)

/* ไอคอนแท็บ — stroke ใช้ currentColor เพื่อให้เปลี่ยนสีตามสถานะ active/ธีมเองอัตโนมัติ
   วาดเป็น SVG ฝังในโค้ดเพราะโปรเจกต์นี้ไม่มี build step และไม่ควรพึ่งไฟล์ไอคอนภายนอก */
var NAV_ICONS = {
  today:    '<path d="M4 5.5h16v15H4z"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><path d="m9 15 2 2 4-4"/>',
  schedule: '<path d="M4 5.5h16v15H4z"/><path d="M4 10h16M8.5 3v4M15.5 3v4"/><path d="M8 13.5h2M14 13.5h2M8 17.5h2M14 17.5h2"/>',
  progress: '<path d="M4 4v16h16"/><path d="m7.5 15 3.5-4 3 2.5L20 7"/>',
  plan:     '<path d="M6 4h12v17H6z"/><path d="M9.5 2.5h5v3h-5z"/><path d="M9 11h6M9 15h6"/>',
  coach:    '<path d="M4.5 5h15v11h-9l-4 3.5V16h-2z"/><path d="M9 10.5h6"/>'
};
function navIconHTML(k){
  var d = NAV_ICONS[k];
  if(!d) return '';
  return '<svg class="ni" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" '+
    'stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">'+d+'</svg>';
}

/* เปิด/ปิดแผงบัญชีบน app bar ของมือถือ — เป็นสถานะชั่วคราวของ UI ล้วนๆ ไม่ต้อง persist
   (รีเฟรชแล้วปิดเองถือว่าถูกต้อง) จึงเก็บเป็นตัวแปรธรรมดา ไม่ยัดลง state/track ที่ถูกเซฟ */
var acctOpen = false;

/* สถานะโมดัลดูภาพหมุน 360° ของรูปร่างอ้างอิงระดับไขมัน — UI ชั่วคราว ไม่ persist
   frame = เฟรมที่กำลังแสดง (0..BODYFAT_SPIN_FRAMES-1), drag = ข้อมูลระหว่างลากนิ้ว/เมาส์,
   autoTimer = ตัวหมุนอัตโนมัติตอนเพิ่งเปิด (หยุดทันทีที่ผู้ใช้เริ่มลากเอง) */
var bodyFatSpin = {open:false, sex:null, band:null, frame:0, drag:null, autoTimer:null};

function bodyFatSpinSrc(sex, band, i){
  return 'bodyfat/spin/bf-'+sex+'-'+band+'-'+(i<10?('0'+i):(''+i))+'.webp';
}

/* หยุดหมุนอัตโนมัติ — เรียกได้ปลอดภัยเสมอแม้ไม่มี timer ค้างอยู่ */
function bodyFatSpinStopAuto(){
  if(bodyFatSpin.autoTimer){ clearInterval(bodyFatSpin.autoTimer); bodyFatSpin.autoTimer = null; }
}

/* เปลี่ยนเฟรมที่แสดง "โดยไม่เรียก render()" — แตะ DOM ตรงๆ จุดเดียวในแอปที่ทำแบบนี้
   เหตุผล: ตอนลากนิ้วหมุน เฟรมเปลี่ยนหลายสิบครั้งต่อวินาที ถ้าเรียก render() ทุกครั้ง
   จะสร้าง innerHTML ของทั้งหน้าใหม่หมดทุกเฟรม (ช้ามากบนมือถือ) และ <img> ชุดใหม่จะถูก
   สร้างใหม่ทุกรอบจนภาพกะพริบ อีกทั้ง pointer capture ที่กำลังลากอยู่จะหลุดกลางคัน
   ทุกเฟรมถูกใส่ไว้ใน DOM ตั้งแต่ตอนเปิดโมดัลแล้ว (โหลดล่วงหน้าครบ) สลับด้วย .hidden เท่านั้น */
function bodyFatSpinShow(frame){
  var n = BODYFAT_SPIN_FRAMES;
  frame = ((frame % n) + n) % n;   // วนรอบได้ทั้งสองทิศ ไม่ต้องกังวลค่าติดลบ
  bodyFatSpin.frame = frame;
  var stage = document.getElementById('bfSpinStage');
  if(!stage) return;
  var imgs = stage.getElementsByTagName('img');
  for(var i=0;i<imgs.length;i++){ imgs[i].hidden = (i !== frame); }
  var deg = document.getElementById('bfSpinDeg');
  if(deg) deg.textContent = Math.round(frame * 360 / n) + '°';
}

function bodyFatSpinModalHTML(){
  if(!bodyFatSpin.open) return '';
  var b = null;
  for(var k=0;k<BODYFAT_BANDS.length;k++){ if(BODYFAT_BANDS[k].key===bodyFatSpin.band) b = BODYFAT_BANDS[k]; }
  if(!b) return '';
  var sexLabel = bodyFatSpin.sex==='male' ? 'ชาย' : 'หญิง';
  var frames = '';
  for(var i=0;i<BODYFAT_SPIN_FRAMES;i++){
    // ใส่ครบทุกเฟรมตั้งแต่แรกเพื่อให้เบราว์เซอร์โหลดล่วงหน้าพร้อมกัน (ห้ามใส่ loading="lazy"
    // เพราะเฟรมที่ยังไม่แสดงจะไม่ถูกโหลด แล้วตอนลากหมุนจะเจอภาพว่างเป็นช่วงๆ)
    frames += '<img src="'+bodyFatSpinSrc(bodyFatSpin.sex, bodyFatSpin.band, i)+'" alt=""'+
      (i===bodyFatSpin.frame?'':' hidden')+' draggable="false">';
  }
  return '<div class="demo-overlay" data-act="bf-spin-close">'+
    '<div class="demo-modal bf-spin-modal" role="dialog" aria-modal="true" aria-label="หมุนดูรูปร่าง 360 องศา" data-act="demo-stop">'+
      '<button type="button" class="demo-x" data-act="bf-spin-close" aria-label="ปิด">✕</button>'+
      '<div class="demo-title">ระดับไขมัน '+esc(b.pct)+' ('+sexLabel+')</div>'+
      '<div class="bf-spin-stage" id="bfSpinStage" data-act="bf-spin-stage">'+frames+'</div>'+
      '<div class="bf-spin-ctl">'+
        '<button type="button" class="btn ghost bf-spin-step" data-act="bf-spin-prev" aria-label="หมุนซ้าย">‹</button>'+
        '<input type="range" class="bf-spin-range" id="bfSpinRange" min="0" max="'+(BODYFAT_SPIN_FRAMES-1)+'" '+
          'value="'+bodyFatSpin.frame+'" data-act="bf-spin-range" aria-label="มุมการหมุน">'+
        '<button type="button" class="btn ghost bf-spin-step" data-act="bf-spin-next" aria-label="หมุนขวา">›</button>'+
        '<span class="mono bf-spin-deg" id="bfSpinDeg">'+Math.round(bodyFatSpin.frame*360/BODYFAT_SPIN_FRAMES)+'°</span>'+
      '</div>'+
      '<p class="sub" style="margin-top:10px">ลากบนภาพเพื่อหมุนดูรอบตัว — เป็นภาพประกอบคร่าวๆ รูปร่างจริงอาจต่างกันแม้เปอร์เซ็นต์เท่ากัน</p>'+
    '</div></div>';
}

/* สถานะโมดัลลบบัญชี — เป็น UI ชั่วคราวเช่นกัน ไม่ persist
   done:true = ลบสำเร็จแล้ว กำลังโชว์หน้ายืนยัน (ตอนนั้น session ถูกตัดไปแล้ว แต่ยังเห็น
   ข้อความยืนยันได้ เพราะ render() วาดโมดัลนี้ทับหน้า auth gate ให้ด้วย ดู render()) */
var deleteAccountUI = {open:false, reason:null, busy:false, error:null, done:false};

/* กันเหนียวชั้นสุดท้าย: ตั้งเป็น true ทันทีที่ลบบัญชีสำเร็จ แล้วห้าม hydrateFromRemote()
   ทำงานอีกเลยจนกว่าจะรีโหลดหน้า — กัน race ที่ onAuthChange ยิงตอน signOut() แล้วไป
   เรียก sync ซ้อนขึ้นมาดันข้อมูลที่ค้างในหน่วยความจำกลับขึ้น Supabase อีกรอบ */
var accountDeleted = false;

/* ตัวเลือกเหตุผลลบบัญชี — ต้องตรงกับ ALLOWED_REASONS ใน functions/api/delete-account.js
   เป๊ะทุกตัวอักษร (server เช็คซ้ำ ไม่เชื่อ client เฉยๆ) เลือกได้ข้อเดียว อิงหมวดหมู่
   มาตรฐานที่แอปทั่วไปใช้ถามตอนผู้ใช้จะปิดบัญชี (เหตุผลการใช้งาน/คู่แข่ง/ฟีเจอร์/
   ความยาก/ความเป็นส่วนตัว/บั๊ก/อื่นๆ) */
var ACCOUNT_DELETE_REASONS = [
  "ไม่ได้ใช้งานแอปแล้ว",
  "เจอแอป/บริการอื่นที่ดีกว่า",
  "ฟีเจอร์ไม่ตรงกับที่ต้องการ",
  "ใช้งานยาก/ซับซ้อนเกินไป",
  "กังวลเรื่องความเป็นส่วนตัวของข้อมูล",
  "เจอปัญหา/บั๊กทางเทคนิคบ่อย",
  "อื่นๆ"
];

/* โมดัลลบบัญชี — โครง HTML ใช้ class เดิมของ demo-modal (.demo-overlay/.demo-modal)
   ให้สม่ำเสมอกับโมดัลอื่นในแอป ไม่ต้องเพิ่ม CSS ใหม่ */
function deleteAccountModalHTML(){
  if(!deleteAccountUI.open) return '';
  var busy = deleteAccountUI.busy;
  var body;
  if(deleteAccountUI.done){
    body = '<div class="demo-title">ลบบัญชีเรียบร้อยแล้ว</div>'+
      '<p class="sub" style="margin-top:8px">ข้อมูลทั้งหมดของคุณถูกลบออกจากระบบถาวรแล้ว ขอบคุณที่เคยใช้งาน Gymbro Daily</p>'+
      '<button type="button" class="btn primary" style="width:100%;margin-top:14px" data-act="delacct-close-final">ปิด</button>';
  } else {
    body = '<div class="demo-title">ลบบัญชีถาวร</div>'+
      '<p class="sub" style="margin:8px 0 14px">การลบบัญชีจะลบข้อมูลทั้งหมดของคุณออกจากระบบถาวร (แผนออกกำลังกาย บันทึกประจำวัน น้ำหนัก) กู้คืนไม่ได้ — ก่อนลบ ช่วยบอกเราหน่อยว่าเพราะอะไร:</p>'+
      '<div class="opts" style="flex-direction:column">'+
      ACCOUNT_DELETE_REASONS.map(function(r){
        var sel = deleteAccountUI.reason===r;
        return '<button type="button" class="opt'+(sel?' sel':'')+'" style="width:100%;text-align:left" data-act="delacct-reason" data-val="'+esc(r)+'"'+(busy?' disabled':'')+'>'+esc(r)+'</button>';
      }).join('')+
      '</div>'+
      (deleteAccountUI.error ? '<div class="note warn" style="margin-top:10px"><p>'+esc(deleteAccountUI.error)+'</p></div>' : '')+
      '<div class="sum-actions" style="margin-top:16px">'+
        '<button type="button" class="btn" style="background:var(--warn);color:#fff;border-color:var(--warn)" data-act="delacct-confirm"'+((!deleteAccountUI.reason||busy)?' disabled':'')+'>'+(busy?'กำลังลบ...':'ยืนยันลบบัญชี')+'</button>'+
        '<button type="button" class="btn ghost" data-act="delacct-cancel"'+(busy?' disabled':'')+'>ยกเลิก</button>'+
      '</div>';
  }
  return '<div class="demo-overlay" data-act="delacct-cancel">'+
    '<div class="demo-modal" role="dialog" aria-modal="true" data-act="demo-stop">'+
      (deleteAccountUI.done?'':'<button type="button" class="demo-x" data-act="delacct-cancel" aria-label="ปิด">✕</button>')+
      body+
    '</div></div>';
}

/* โครง HTML ชุดเดียวเสิร์ฟทั้งสองหน้าตา — เดสก์ท็อป = แถบข้าง, มือถือ = app bar บน +
   แท็บบาร์ล่างแบบแอป (CSS เป็นคนสลับ ดู @media ใน style.css) ฝั่ง JS จึงไม่ต้องรู้ขนาดจอเลย
   .locked = อยู่ในแบบสอบถาม onboarding → มือถือซ่อนแท็บบาร์ให้เต็มจอไปเลยเหมือนแอปจริง */
function renderNav(view){
  var el = document.getElementById("nav");
  var locked = (view==='onboarding');
  el.className = "nav" + (locked ? " locked" : "");

  /* app bar (เห็นเฉพาะมือถือ): ชื่อแอปซ้าย + ปุ่มบัญชีขวา
     ปุ่มบัญชีเป็นวงกลมอักษรตัวแรกของอีเมล แตะแล้วกางแผงที่มีอีเมลเต็ม + ปุ่มออกจากระบบ
     (เอาอีเมลยาวๆ ออกจากแถบหลัก ไม่ให้ไปเบียดเมนูเหมือนหน้าตาเดิม) */
  var html = '<div class="appbar">'+
    '<div class="appbar-brand"><span class="brand-mark"></span><span>Gymbro Daily</span></div>';
  if(auth.session){
    var email = auth.session.user.email || '';
    html += '<button type="button" class="acct-btn'+(acctOpen?' open':'')+'" data-act="acct-toggle" aria-label="บัญชีของฉัน">'+
        esc((email.charAt(0) || '?').toUpperCase())+'</button>';
    if(acctOpen){
      html += '<div class="acct-panel"><div class="acct-mail">'+esc(email)+'</div>'+
        '<button type="button" class="btn sm" data-act="auth-signout">ออกจากระบบ</button>'+
        '<button type="button" class="linkbtn" style="color:var(--warn)" data-act="acct-delete-open">ลบบัญชี</button></div>';
    }
  }
  html += '</div>';

  html += '<div class="brand"><div class="brand-mark"></div><div class="brand-name">Gymbro</div></div>';
  if(auth.session){
    html += '<div class="nav-acct hint">'+esc(auth.session.user.email||'')+
      '<button type="button" class="ex-open nav-acct-signout" data-act="auth-signout">ออกจากระบบ</button>'+
      '<button type="button" class="linkbtn" style="color:var(--warn);display:block;padding:2px 0" data-act="acct-delete-open">ลบบัญชี</button></div>';
  }
  html += '<div class="nav-group"><div class="nav-label">เมนู</div>';
  var counts = null;
  if(!locked && track.program) counts = dayCounts(track.program, todayISO());
  var navItems = NAV_ITEMS.slice();
  if(auth.session) navItems.push(NAV_ITEM_COACH);
  navItems.forEach(function(it){
    var active = (!locked && view===it.k);
    var cnt = (it.k==='today' && counts) ? '<span class="cnt">'+counts.done+'/'+counts.total+'</span>' : '';
    html += '<button type="button" class="nav-item'+(active?' active':'')+'" data-act="nav" data-view="'+it.k+'"'+(locked?' disabled':'')+'>'+
      '<span class="nd"></span>'+navIconHTML(it.k)+
      '<span class="nl">'+esc(it.label)+'</span><span class="nl-s">'+esc(it.short||it.label)+'</span>'+cnt+'</button>';
  });
  html += '</div>';

  if(!locked && track.program){
    var st = streakOf(track.program);
    html += '<div class="streak-card"><div class="sl">สตรีคปัจจุบัน</div>'+
      '<div class="sn mono">'+st+' <small>วันติดต่อกัน</small></div>'+
      '<div class="ss">วันฝึกต้องติ๊ก “ทำเซสชันนี้ครบแล้ว” จึงจะนับ · วันพักนับให้อัตโนมัติ</div></div>';
    html += '<div class="nav-foot"><b>'+esc(track.program.splitLabel)+'</b><br>เป้าหมาย: '+esc(track.program.goal||'—')+'<br>เริ่ม '+esc(shortDateTH(track.program.startDate))+' · '+(track.program.days||[]).length+' วัน/สัปดาห์</div>'+
      '<button type="button" class="linkbtn" data-act="hard-restart" style="margin-top:8px;color:var(--warn)">ล้างข้อมูลและเริ่มแบบสอบถามใหม่ทั้งหมด</button>';
  } else {
    html += '<div class="nav-foot">ตอบแบบสอบถามและกด “เริ่มโปรแกรม” เพื่อปลดล็อกเมนูใช้งานประจำวัน</div>';
  }
  html += deleteAccountModalHTML(); // ต่อท้าย #nav (render ได้ทุกหน้า ไม่ใช่แค่ตอนรีวิวแผน)
  html += bodyFatSpinModalHTML();   // เช่นกัน — เปิดจากการ์ดเลือกรูปร่างที่หน้าแบบสอบถาม
  el.innerHTML = html;
}

/* ---------- ส่วนประกอบเช็คลิสต์รายวัน (ใช้ได้กับทุกวันที่ ไม่เฉพาะวันนี้) ---------- */
function lastBestBefore(exId, iso){
  var hist = exerciseHistory(exId).filter(function(h){ return h.date < iso; });
  return hist.length ? hist[hist.length-1] : null;
}

/* ---------- Strength Performance Benchmark (เลเยอร์เสริม — logic จริงอยู่ใน
   benchmarks.js/GymBroBenchmark ทั้งหมด สองฟังก์ชันนี้แค่ประกอบ HTML จากผลลัพธ์
   ห้ามคำนวณ e1RM/Relative Strength/จับคู่ benchmark ซ้ำที่นี่หรือที่ไหนอื่นในหน้า UI) ---------- */
function benchDetailHTML(perf, relStrength, pb, progress, benchmark, bw){
  var rows = '';
  rows += '<div class="side-row"><span class="k">Benchmark ของคุณ</span><span class="v">'+
    (benchmark
      ? fmt1(benchmark.benchmarkValueKg)+' กก. · '+esc(benchmark.sourceName||benchmark.benchmarkSource||'ไม่ระบุแหล่งที่มา')
      : 'ยังไม่มี Benchmark สำหรับข้อมูลนี้')+
    '</span></div>';
  rows += '<div class="side-row"><span class="k">Relative Strength</span><span class="v">'+
    (relStrength!=null ? (Math.round(relStrength*100)/100)+'× น้ำหนักตัว'+(bw!=null?' ('+fmt1(bw)+' กก.)':'') : 'ยังไม่มีข้อมูลน้ำหนักตัว')+
    '</span></div>';
  rows += '<div class="side-row"><span class="k">Personal Best</span><span class="v">'+
    (pb ? fmt1(pb.e1rm)+' กก. ('+esc(shortDateTH(pb.date))+')' : 'ยังไม่เคยบันทึกท่านี้มาก่อน')+
    '</span></div>';
  rows += '<div class="side-row"><span class="k">Personal Progress</span><span class="v">'+
    (progress
      ? (progress.direction==='up'?'📈 +':(progress.direction==='down'?'📉 ':'▪️ '))+fmt1(Math.abs(progress.deltaPct))+'% เทียบกับครั้งก่อน ('+esc(shortDateTH(progress.baselineDate))+')'
      : 'ยังไม่มีข้อมูลครั้งก่อนให้เทียบ')+
    '</span></div>';
  rows += '<div class="side-row"><span class="k">ระดับ Performance</span><span class="v">'+(perf.icon||'')+' '+esc(perf.label)+'</span></div>';
  return '<div class="setbox">'+rows+'</div>';
}
function perfBlockFor(ex, iso, e, isBW){
  if(isBW || ex.timeBased) return ''; // ท่า bodyweight/จับเวลาไม่มีน้ำหนักให้ประเมิน e1RM
  var pick = GymBroBenchmark.pickAssessmentSet(e.sets||[]);
  if(!pick) return ''; // ยังไม่มีเซ็ตที่กรอกน้ำหนัก+ครั้งครบสำหรับวันนี้
  var a = state.answers;
  var bw = bodyweightAsOf(iso);
  var relStrength = GymBroBenchmark.calculateRelativeStrength(pick.e1rm, bw);
  var benchKey = GymBroBenchmark.resolveBenchmarkKey(ex.id);
  var benchmark = benchKey ? GymBroBenchmark.getStrengthBenchmark({
    exercise: benchKey, sex: a.Q9, bodyweightKg: bw, experience: a.Q16
  }) : null;
  var perf = GymBroBenchmark.getPerformanceLevel({e1rmKg: pick.e1rm, benchmark: benchmark});
  var histAll = exerciseHistory(ex.id).filter(function(h){ return h.date<=iso; });
  var histBefore = histAll.filter(function(h){ return h.date<iso; });
  var pb = histAll.length ? histAll.reduce(function(m,h){ return h.e1rm>m.e1rm?h:m; }) : null;
  var progress = histBefore.length ? GymBroBenchmark.calculatePersonalProgress(pick.e1rm, histBefore) : null;

  var openBench = !!track.openBench[iso+':'+ex.id];
  var lowConfNote = pick.lowConfidence
    ? '<div class="hint" style="margin-top:2px">⚠️ เซ็ตนี้ทำมากกว่า 12 ครั้ง — Estimated 1RM อาจคลาดเคลื่อนกว่าปกติ</div>'
    : '';
  /* Personal Progress แสดงแยกจาก Benchmark เสมอ (PART 11) — ต่ำกว่า Benchmark
     แต่พัฒนาขึ้นจากตัวเอง ต้องเห็นทั้งสองอย่างพร้อมกัน */
  var progLine = progress
    ? '<div class="perf-line">Personal Progress: <b>'+(progress.direction==='up'?'📈 +':(progress.direction==='down'?'📉 ':'▪️ '))+
        fmt1(Math.abs(progress.deltaPct))+'%</b> <span class="hint" style="display:inline">เทียบครั้งก่อน</span></div>'
    : '';
  return '<div class="perf-block">'+
    '<div class="perf-line mono">'+pick.weight+' กก. × '+pick.reps+' ครั้ง</div>'+
    '<div class="perf-line">Estimated 1RM: <b>'+fmt1(pick.e1rm)+' กก.</b></div>'+
    '<div class="perf-badge '+(perf.cssClass||'none')+'">'+(perf.icon||'')+' '+esc(perf.label)+'</div>'+
    progLine+
    lowConfNote+
    '<button type="button" class="ex-open" data-act="bench-toggle" data-date="'+iso+'" data-ex="'+esc(ex.id)+'">'+(openBench?'ซ่อนรายละเอียด ▴':'ดูรายละเอียด ▾')+'</button>'+
    (openBench ? benchDetailHTML(perf, relStrength, pb, progress, benchmark, bw) : '')+
    '</div>';
}

/* สรุป Strength รายท่าสำหรับหน้า "ความคืบหน้า" (PART 16) — เพิ่มเข้าไปในส่วน
   Progression เดิม ไม่แตะกราฟ/ตาราง/ส่วนอื่นของหน้านั้น ค่าทุกตัวมาจาก function
   กลางใน GymBroBenchmark เหมือนหน้า "วันนี้" ทุกประการ (ไม่คำนวณซ้ำเอง) */
function strengthSummaryHTML(exDef, hist){
  if(!exDef || !hist || !hist.length) return '';
  var a = state.answers;
  var latest = hist[hist.length-1];
  var prev = hist.length>1 ? hist[hist.length-2] : null;
  var pb = hist.reduce(function(m,h){ return h.e1rm>m.e1rm ? h : m; });
  var bw = bodyweightAsOf(latest.date);
  var rel = GymBroBenchmark.calculateRelativeStrength({e1rmKg: latest.e1rm, bodyweightKg: bw});
  var perf = GymBroBenchmark.getPerformanceLevel({
    exercise: exDef.id, sex: a.Q9, bodyweightKg: bw,
    experience: a.Q16, e1rmKg: latest.e1rm, relativeStrength: rel
  });
  var progress = prev ? GymBroBenchmark.calculatePersonalProgress(latest.e1rm, hist.slice(0, -1)) : null;
  function tile(label, value, detail){
    return '<div class="stat-b"><div class="l">'+label+'</div><div class="v">'+value+'</div>'+
      '<div class="d">'+detail+'</div></div>';
  }
  return '<div class="stat-strip" style="margin-top:14px">'+
    tile('Estimated 1RM ล่าสุด', fmt1(latest.e1rm)+' <small>กก.</small>',
      esc(shortDateTH(latest.date))+' · '+latest.weight+' กก. × '+(latest.reps!=null?latest.reps:'?')+' ครั้ง')+
    tile('Personal Best (e1RM)', fmt1(pb.e1rm)+' <small>กก.</small>',
      esc(shortDateTH(pb.date))+(pb.date===latest.date?' · ล่าสุดคือสถิติสูงสุด':''))+
    tile('ครั้งก่อนหน้า', prev? fmt1(prev.e1rm)+' <small>กก.</small>' : '—',
      progress
        ? '<span class="'+(progress.direction==='up'?'down':(progress.direction==='down'?'up':''))+'">'+
            (progress.direction==='up'?'+':'')+fmt1(progress.deltaPct)+'%</span> Personal Progress'
        : 'ต้องมีอย่างน้อย 2 วันจึงเทียบได้')+
    tile('Benchmark', (perf.icon||'')+' <span style="font-size:15px">'+esc(perf.label)+'</span>',
      perf.hasBenchmark && perf.benchmark
        ? 'มาตรฐาน '+fmt1(perf.benchmark.benchmarkValueKg)+' กก. · '+esc(perf.benchmark.sourceName||'ไม่ระบุแหล่งที่มา')
        : 'เทียบกับกลุ่มอ้างอิง — คนละเรื่องกับ Personal Progress')+
    tile('Relative Strength', rel!=null ? (Math.round(rel*100)/100)+'<small>× น้ำหนักตัว</small>' : '—',
      bw!=null ? 'น้ำหนักตัว '+fmt1(bw)+' กก.' : 'ยังไม่มีข้อมูลน้ำหนักตัว')+
    '</div>'+
    '<p class="hint" style="margin-top:10px">ตัวเลขทั้งหมดเป็น <b>ประมาณการ 1RM (Estimated 1RM)</b> จากน้ำหนัก × ครั้งที่บันทึกไว้ ไม่ใช่ 1RM ที่ยกได้จริง — Benchmark เป็นข้อมูลเปรียบเทียบกับกลุ่มอ้างอิงเท่านั้น ไม่ใช่เป้าที่ต้องไปให้ถึง</p>';
}

/* 4-8 ครั้งจนหมดแรง ≈ 79-88% ของ 1RM (Epley) — แนะนำจาก e1RM ของครั้งก่อนถ้ามี */
function intenseNoteHTML(ex, prev){
  var lo = prev && prev.e1rm ? warmupKg(prev.e1rm, 0.79, ex.equip) : null;
  var hi = prev && prev.e1rm ? warmupKg(prev.e1rm, 0.88, ex.equip) : null;
  var load = (lo && hi)
    ? 'น้ำหนักแนะนำ ~'+lo+(hi>lo?'–'+hi:'')+' กก. (≈79–88% ของ 1RM โดยประมาณจากครั้งก่อน) '
    : 'เลือกน้ำหนักที่ยกได้แค่ 4-8 ครั้งแล้วหมดแรง ';
  return '<div class="int-warn">⚠️ '+esc(load)+'— '+esc(INTENSE_WARNING)+'</div>';
}
function warmupHTML(ex, iso, e, steps, prev){
  if(!steps.length) return '';
  var todayMax = (e.sets||[]).reduce(function(m,s){ var w = s && s.weight!=null ? Number(s.weight) : 0; return w>m ? w : m; }, 0);
  // ท่าเข้มข้นวอร์มอัพเทียบกับน้ำหนักเข้มข้นที่จะยก (~83.5% ของ e1RM กลางช่วง 79-88%) ไม่ใช่น้ำหนักแบบทั่วไปของครั้งก่อน
  var intenseRef = !todayMax && isIntense(ex) && prev && prev.e1rm ? warmupKg(prev.e1rm, 0.835, ex.equip) : null;
  var refKg = todayMax || intenseRef || (prev && prev.weight) || null;
  var flags = e.warmup || [];
  var boxes = steps.map(function(st, i){
    var kg = warmupKg(refKg, st.pct, ex.equip);
    var what = st.pct==null ? (st.note||'แบบเบา')
      : (kg!=null ? kg+' กก.' : '~'+Math.round(st.pct*100)+'%');
    return '<label class="wu-item'+(flags[i]?' on':'')+'"><input type="checkbox" data-act="warmup" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" data-idx="'+i+'"'+(flags[i]?' checked':'')+'>'+
      'W'+(i+1)+' · '+esc(what)+' × '+esc(st.reps)+'</label>';
  }).join('');
  var basis = steps[0].pct==null ? ''
    : (refKg ? 'คำนวณจากน้ำหนักเซ็ตจริง '+refKg+' กก.'+(todayMax?' (วันนี้)':(intenseRef?' (น้ำหนักเข้มข้นที่แนะนำ)':' (ครั้งก่อน)')) : 'ยังไม่มีน้ำหนักอ้างอิง — ใช้ % ของน้ำหนักเซ็ตจริงที่จะยก');
  return '<div class="wu-list"><span class="wu-label">Warm-up (ไม่บังคับ):</span>'+boxes+'</div>'+
    (basis ? '<div class="wu-basis">'+esc(basis)+'</div>' : '');
}

/* ---------- อาการหลังออกกำลังกาย: คัดกรองจากคำที่ผู้ใช้พิมพ์ (ไม่ใช่การวินิจฉัย) ----------
   ระดับเรียงจากหนักไปเบา ระดับที่หนักสุดที่เจอคือผลลัพธ์ · คำที่มี "ไม่" นำหน้า (เช่น "ไม่บวม") ไม่นับ */
var SYMPTOM_RULES = [
  {level:'emergency', words:['เจ็บหน้าอก','แน่นหน้าอก','หายใจไม่ออก','หายใจลำบาก','หน้ามืด','เป็นลม','วูบ','ใจสั่น','หัวใจเต้นผิดจังหวะ',
    'ปัสสาวะสีเข้ม','ปัสสาวะสีน้ำตาล','ฉี่สีเข้ม','ฉี่สีโค้ก','ชาครึ่งซีก','พูดไม่ชัด','chest pain','faint']},
  {level:'injury', words:['เจ็บแปลบ','ปวดแปลบ','เจ็บจี๊ด','ปวดจี๊ด','เสียงดัง','ได้ยินเสียง','ป๊อก','กร๊อบ','บวม','ช้ำ','ชา','เหน็บ',
    'ร้าวลง','ปวดร้าว','ขยับไม่ได้','ยกไม่ขึ้น','ลงน้ำหนักไม่ได้','เดินไม่ได้','หลุด','เคล็ด','พลิก','ฉีก','อ่อนแรง',
    'sharp pain','swelling','numb']},
  {level:'caution', words:['ปวดข้อ','เจ็บข้อ','ปวดเข่า','เจ็บเข่า','ปวดไหล่','เจ็บไหล่','ปวดหลัง','เจ็บหลัง','ปวดเอว','ปวดข้อมือ','เจ็บข้อมือ',
    'ปวดศอก','เจ็บศอก','ปวดสะโพก','ปวดคอ','ข้อฝืด','ข้อติด','ตะคริว','เจ็บ','pain']},
  {level:'normal', words:['ปวดเมื่อย','เมื่อย','ตึง','ล้า','เหนื่อย','ระบม','ปกติ','ไม่มีอาการ','ไม่เจ็บ','ไม่ปวด','สบายดี','sore']}
];
var SYMPTOM_INFO = {
  emergency:{label:'อันตราย', cls:'danger', icon:'🚨', advice:'หยุดออกกำลังกายทันที นั่งพัก ถ้าอาการไม่ดีขึ้นหรือรุนแรงให้ไปพบแพทย์หรือโทร 1669'},
  injury:{label:'เข้าข่ายบาดเจ็บ', cls:'danger', icon:'⚠️', advice:'หยุดเล่นท่านี้ พักส่วนที่เจ็บ ประคบเย็น 15-20 นาที ถ้าบวม/ปวดมากหรือไม่ดีขึ้นใน 2-3 วันควรพบแพทย์ และแจ้งอาการในแบบสอบถาม (หมวดอาการบาดเจ็บ) ให้ระบบล็อกท่าที่เสี่ยง'},
  caution:{label:'ควรระวัง', cls:'warn', icon:'⚠️', advice:'อาจเป็นสัญญาณเริ่มบาดเจ็บ — ครั้งหน้าลดน้ำหนัก เช็คฟอร์ม ถ้าปวดข้อต่อซ้ำหรือนานเกิน 2-3 วันควรปรึกษาผู้เชี่ยวชาญ'},
  normal:{label:'ปกติหลังฝึก', cls:'ok', icon:'✓', advice:'อาการล้า/ตึง/ระบมของกล้ามเนื้อเป็นเรื่องปกติหลังฝึก มักหายใน 1-3 วัน'},
  unknown:{label:'บันทึกแล้ว', cls:'', icon:'📝', advice:'ระบบแยกระดับจากคำที่พิมพ์ไม่ได้ — ถ้าอาการแย่ลงหรือไม่หายใน 2-3 วันควรปรึกษาแพทย์'}
};
var SYMPTOM_CHIPS = ['ปวดเมื่อยปกติ','ตึงกล้ามเนื้อ','ปวดข้อ','เจ็บแปลบ','มีเสียงดังในข้อ','บวม','ชา/เหน็บ'];
function analyzeSymptom(text){
  var t = String(text||'').toLowerCase();
  for(var r=0; r<SYMPTOM_RULES.length; r++){
    var hit = SYMPTOM_RULES[r].words.filter(function(w){
      var i = t.indexOf(w);
      while(i>-1){
        if(t.slice(Math.max(0, i-4), i).indexOf('ไม่')===-1) return true;
        i = t.indexOf(w, i+1);
      }
      return false;
    });
    if(hit.length) return {level:SYMPTOM_RULES[r].level, words:hit};
  }
  return {level:'unknown', words:[]};
}
function symptomHTML(ex, iso, e){
  var s = e.symptom, open = !!track.openSym[iso+':'+ex.id];
  var info = s ? SYMPTOM_INFO[s.level] || SYMPTOM_INFO.unknown : null;
  var summary = s ? '<div class="sym-sum sym-'+(info.cls||'none')+'">'+info.icon+' อาการหลังเล่น: '+esc(s.text)+' — <b>'+info.label+'</b></div>' : '';
  var btn = '<button type="button" class="ex-open" data-act="sym-toggle" data-date="'+iso+'" data-ex="'+esc(ex.id)+'">'+(open?'ซ่อนช่องอาการ ▴':(s?'แก้ไขอาการหลังเล่น ▾':'บันทึกอาการหลังเล่น ▾'))+'</button>';
  if(!open) return summary + btn;
  return summary + btn + '<div class="setbox">'+
    '<input type="text" class="sym-input" maxlength="200" placeholder="เช่น ปวดเข่าด้านในตอนย่อ, ไหล่มีเสียงดังกึก" data-act="symptom" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" data-fkey="sym-'+iso+'-'+ex.id+'" value="'+esc(s?s.text:'')+'">'+
    '<div class="sym-chips">'+SYMPTOM_CHIPS.map(function(c){
      return '<button type="button" class="opt" data-act="sym-chip" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" data-val="'+esc(c)+'">'+esc(c)+'</button>';
    }).join('')+(s?'<button type="button" class="opt" data-act="sym-clear" data-date="'+iso+'" data-ex="'+esc(ex.id)+'">ล้าง</button>':'')+'</div>'+
    (info ? '<div class="sym-advice">'+esc(info.advice)+'</div>' : '')+
    '<div class="hint">ระบบคัดกรองจากคำที่พิมพ์เท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์</div></div>';
}
function exerciseName(iso, exId){
  var p = track.program || {};
  var sess = sessionDefFor(p, sessionKeyFor(p, iso));
  var ex = (sess ? sess.exercises : []).filter(function(x){ return x.id===exId; })[0] || EXERCISES.filter(function(x){ return x.id===exId; })[0];
  return ex ? ex.th : exId;
}
function saveSymptom(iso, exId, text, name){
  text = String(text||'').trim().slice(0, 200);
  patchExercise(iso, exId, {symptom: text ? {text:text, level:analyzeSymptom(text).level, name:name} : null});
}
function seriousSymptoms(iso){
  var exs = (logFor(iso)||{}).exercises || {}, out = [];
  Object.keys(exs).forEach(function(id){
    var s = exs[id] && exs[id].symptom;
    if(s && (s.level==='injury' || s.level==='emergency')) out.push(s);
  });
  return out;
}

function sectionWorkout(iso){
  var p = track.program, t = targetsOf(p);
  var sKey = sessionKeyFor(p, iso);
  var log = logFor(iso) || {};
  if(!sKey){
    return '<div class="sec-card"><div class="sec-head"><span class="sq" style="background:var(--text-4)"></span><h2>วันพัก</h2>'+
      '<span class="meta">ไม่มีเซสชันตามตาราง</span></div>'+
      '<p class="hint">วันนี้ไม่ได้อยู่ในวันที่คุณเลือกไว้ ('+esc((p.days||[]).join(' · '))+') — โฟกัสที่โภชนาการ การนอน และการฟื้นตัวแทน เดินเบาๆ หรือยืดกล้ามเนื้อได้ตามสบาย</p></div>';
  }
  var sess = sessionDefFor(p, sKey) || {exercises:[]};
  var exData = log.exercises || {};
  var doneN = sess.exercises.filter(function(ex){ return (exData[ex.id]||{}).done; }).length;
  var wuSteps = warmupStepsFor(sess);
  var rows = sess.exercises.map(function(ex, exIdx){
    var e = exData[ex.id] || {};
    var rest = restFor(ex), intense = isIntense(ex);
    var restLine = '<div class="rest-line">พักระหว่างเซ็ต '+rest.set+(exIdx < sess.exercises.length-1 ? ' · พักก่อนเปลี่ยนท่า '+rest.next : '')+'</div>';
    var open = !!track.openSets[iso+':'+ex.id];
    var prev = lastBestBefore(ex.id, iso);
    var isBW = ex.equip==='bodyweight' && !ex.timeBased; // bodyweight (ไม่นับ core ที่วัดเวลา) — ไม่ต้องมีช่องน้ำหนัก
    var prevTxt = prev
      ? ('ครั้งก่อน '+(prev.date===iso?'':shortDateTH(prev.date)+' · ')+
          (isBW
            ? (prev.reps!=null ? prev.reps+' ครั้ง' : '—')
            : prev.weight+(ex.timeBased?' วิ':' กก.')+(prev.reps!=null&&!ex.timeBased?' × '+prev.reps+' ครั้ง':'')))
      : 'ยังไม่เคยบันทึกท่านี้';
    var sets = e.sets || [];
    var n = setCountFor(ex.setsReps);
    var setRows = '';
    for(var i=0;i<n;i++){
      var sv = sets[i]||{};
      setRows += '<div class="set-row"><span class="sr-label">เซ็ต '+(i+1)+'</span>'+
        (isBW?'':'<input type="number" inputmode="decimal" placeholder="'+(ex.timeBased?'วินาที':'น.น.(กก.)')+'" data-act="set" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" data-field="weight" data-idx="'+i+'" data-fkey="set-'+iso+'-'+ex.id+'-w'+i+'" value="'+num(sv.weight)+'">')+
        (ex.timeBased?'':'<input type="number" inputmode="numeric" placeholder="ครั้ง" data-act="set" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" data-field="reps" data-idx="'+i+'" data-fkey="set-'+iso+'-'+ex.id+'-r'+i+'" value="'+num(sv.reps)+'">')+
        '</div>';
    }
    return '<div class="chk'+(e.done?' on':'')+'">'+
      '<input type="checkbox" data-act="ex-done" data-date="'+iso+'" data-ex="'+esc(ex.id)+'" '+(e.done?'checked':'')+' aria-label="ทำท่า '+esc(ex.th)+' แล้ว">'+
      '<div class="cb"><div class="t">'+esc(ex.th)+(intense?' <span class="chip miss">เข้มข้น</span>':'')+'</div>'+
        '<div class="s">'+esc(ex.setsReps)+(intense?' (จนหมดแรง)':'')+' · '+esc(PATTERN_SHORT[ex.pattern]||ex.pattern)+' · '+esc(prevTxt)+'</div>'+
        restLine+
        (intense ? intenseNoteHTML(ex, prev) : '')+
        warmupHTML(ex, iso, e, wuSteps[ex.id]||[], prev)+
        symptomHTML(ex, iso, e)+
        '<button type="button" class="ex-open" data-act="ex-toggle" data-date="'+iso+'" data-ex="'+esc(ex.id)+'">'+(open?'ซ่อนช่องบันทึกเซ็ต ▴':(isBW?'บันทึกจำนวนครั้งต่อเซ็ต ▾':'บันทึกน้ำหนัก/ครั้งต่อเซ็ต ▾'))+'</button>'+
        (open? '<div class="setbox">'+setRows+'</div>' : '')+
        perfBlockFor(ex, iso, e, isBW)+
      '</div></div>';
  }).join('');
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--accent)"></span><h2>ออกกำลังกาย</h2>'+
    '<span class="meta">'+esc(sKey)+' · ~'+esc(p.minutesEstimate||'45-60 นาที')+' · '+esc(p.trainTime||'')+'</span>'+
    '<span class="cnt">'+doneN+'/'+sess.exercises.length+'</span></div>'+
    seriousSymptoms(iso).map(function(s){
      var info = SYMPTOM_INFO[s.level];
      return '<div class="banner danger"><div class="ic">'+info.icon+'</div><div><b>'+esc(s.name||'')+': '+esc(s.text)+'</b> — '+info.label+' · '+esc(info.advice)+'</div></div>';
    }).join('')+
    '<div class="chk-list">'+rows+'</div>'+
    '<label class="log-complete-row"><input type="checkbox" data-act="sess-complete" data-date="'+iso+'" '+(log.completed?'checked':'')+'> ทำเซสชันนี้ครบแล้ว (ข้อนี้คือตัวที่นับสตรีคและ % ทำตามแผน)</label>'+
    '</div>';
}

/* ---------- อาหาร → สารอาหาร: ค่าต่อ 100 g (อาหารสุกถ้าไม่ระบุ) ประมาณจาก USDA FoodData Central ----------
   พลังงานคิด 4/4/9 kcal ต่อกรัมของโปรตีน/คาร์บ/ไขมัน ให้ยอดแคลแต่ละสารอาหารรวมกันได้พอดี */
var FOODS = [
  {id:'chk_breast', cat:'protein', name:'อกไก่ไม่มีหนัง (สุก)', p:31, c:0, f:3.6},
  {id:'chk_thigh', cat:'protein', name:'สะโพกไก่ไม่มีหนัง (สุก)', p:26, c:0, f:10.9},
  {id:'chk_drum', cat:'protein', name:'น่องไก่ไม่มีหนัง (สุก)', p:28.3, c:0, f:5.7},
  {id:'chk_wing', cat:'protein', name:'ปีกไก่ติดหนัง (สุก)', p:26.9, c:0, f:19.5},
  {id:'egg', cat:'protein', name:'ไข่ไก่ทั้งฟอง (ต้ม)', p:12.6, c:1.1, f:10.6, unit:'1 ฟอง ≈ 50 g'},
  {id:'egg_white', cat:'protein', name:'ไข่ขาว (สุก)', p:10.9, c:0.7, f:0.2, unit:'ไข่ขาว 1 ฟอง ≈ 33 g'},
  {id:'pork_loin', cat:'protein', name:'หมูสันใน (สุก)', p:26.2, c:0, f:3.5},
  {id:'pork_mince', cat:'protein', name:'หมูสับ (สุก)', p:25.7, c:0, f:20.8},
  {id:'beef_lean', cat:'protein', name:'เนื้อวัวไม่ติดมัน (สุก)', p:29, c:0, f:7},
  {id:'salmon', cat:'protein', name:'ปลาแซลมอน (สุก)', p:22.1, c:0, f:12.4},
  {id:'tilapia', cat:'protein', name:'ปลานิล (สุก)', p:26.2, c:0, f:2.7},
  {id:'shrimp', cat:'protein', name:'กุ้ง (สุก)', p:24, c:0.2, f:0.3},
  {id:'tuna', cat:'protein', name:'ทูน่ากระป๋องในน้ำแร่ (สะเด็ดน้ำ)', p:25.5, c:0, f:0.8},
  {id:'tofu', cat:'protein', name:'เต้าหู้แข็ง', p:17.3, c:2.8, f:8.7},
  {id:'whey', cat:'protein', name:'เวย์โปรตีน (ผง)', p:80, c:8, f:6, unit:'1 สกูป ≈ 30 g'},
  {id:'milk', cat:'protein', name:'นมจืด', p:3.2, c:4.8, f:3.3, unit:'1 กล่อง ≈ 200-250 ml (≈ กรัม)'},
  {id:'rice', cat:'carb', name:'ข้าวขาว (หุงสุก)', p:2.7, c:28.2, f:0.3, unit:'1 ทัพพี ≈ 60 g'},
  {id:'rice_brown', cat:'carb', name:'ข้าวกล้อง (หุงสุก)', p:2.7, c:25.6, f:1, unit:'1 ทัพพี ≈ 60 g'},
  {id:'sticky_rice', cat:'carb', name:'ข้าวเหนียวนึ่ง', p:2, c:21.1, f:0.2},
  {id:'rice_noodle', cat:'carb', name:'เส้นก๋วยเตี๋ยว (ลวก)', p:1.8, c:24, f:0.2},
  {id:'egg_noodle', cat:'carb', name:'บะหมี่ไข่ (ลวก)', p:4.5, c:25.2, f:2.1},
  {id:'bread', cat:'carb', name:'ขนมปังขาว', p:9, c:49, f:3.2, unit:'1 แผ่น ≈ 30 g'},
  {id:'bread_ww', cat:'carb', name:'ขนมปังโฮลวีท', p:12.4, c:43, f:3.5, unit:'1 แผ่น ≈ 30 g'},
  {id:'oats', cat:'carb', name:'ข้าวโอ๊ต (แห้ง ก่อนต้ม)', p:16.9, c:66, f:6.9},
  {id:'pasta', cat:'carb', name:'พาสต้า (ต้มสุก)', p:5.8, c:31, f:0.9},
  {id:'potato', cat:'carb', name:'มันฝรั่ง (ต้ม)', p:1.9, c:20.1, f:0.1},
  {id:'sweet_potato', cat:'carb', name:'มันเทศ (สุก)', p:2, c:20.7, f:0.2},
  {id:'banana', cat:'carb', name:'กล้วยหอม', p:1.1, c:22.8, f:0.3, unit:'1 ลูก ≈ 120 g (ไม่รวมเปลือก)'},
  {id:'oil', cat:'fat', name:'น้ำมันพืช/น้ำมันมะกอก', p:0, c:0, f:100, unit:'1 ช้อนโต๊ะ ≈ 14 g'},
  {id:'butter', cat:'fat', name:'เนย', p:0.9, c:0.1, f:81, unit:'1 ช้อนโต๊ะ ≈ 14 g'},
  {id:'avocado', cat:'fat', name:'อะโวคาโด', p:2, c:8.5, f:14.7},
  {id:'almond', cat:'fat', name:'อัลมอนด์', p:21.2, c:21.6, f:49.9},
  {id:'peanut', cat:'fat', name:'ถั่วลิสงคั่ว', p:23.7, c:21.5, f:49.7},
  {id:'peanut_butter', cat:'fat', name:'เนยถั่ว', p:25, c:20, f:50, unit:'1 ช้อนโต๊ะ ≈ 16 g'},
  {id:'coconut_milk', cat:'fat', name:'กะทิ', p:2.3, c:5.5, f:23.8}
];
var FOOD_CAT_LABEL = {protein:'แหล่งโปรตีน', carb:'แหล่งคาร์โบไฮเดรต', fat:'แหล่งไขมัน'};
function r1(x){ return Math.round(x*10)/10; }
function foodById(id){ return FOODS.filter(function(f){ return f.id===id; })[0] || null; }
function foodMacros(food, g){
  var p = r1(food.p*g/100), c = r1(food.c*g/100), f = r1(food.f*g/100);
  return {p:p, c:c, f:f, kcal:Math.round(p*4 + c*4 + f*9)};
}
function macroLine(m){
  return 'โปรตีน '+m.p+' g ('+Math.round(m.p*4)+' kcal) · คาร์บ '+m.c+' g ('+Math.round(m.c*4)+' kcal) · ไขมัน '+m.f+' g ('+Math.round(m.f*9)+' kcal) = '+m.kcal+' kcal';
}
function foodPreviewText(food, grams){
  if(!food) return '';
  if(grams>0) return grams+' g → '+macroLine(foodMacros(food, grams));
  return 'ต่อ 100 g: '+macroLine(foodMacros(food, 100))+(food.unit ? ' · '+food.unit : '');
}
function updateFoodPreview(iso, cat){
  var sel = document.getElementById('food-sel-'+cat+'-'+iso), g = document.getElementById('food-g-'+cat+'-'+iso);
  var out = document.getElementById('food-prev-'+cat+'-'+iso);
  if(!sel || !g || !out) return;
  out.textContent = foodPreviewText(foodById(sel.value), parseFloat(g.value));
}
function addFood(iso, cat){
  var sel = document.getElementById('food-sel-'+cat+'-'+iso), gEl = document.getElementById('food-g-'+cat+'-'+iso);
  var food = sel ? foodById(sel.value) : null, g = numInRange(gEl ? gEl.value : '', 1, 3000);
  if(!food || !g.valid || g.value==null){ track.foodErr[iso+':'+cat] = 'กรอกน้ำหนักอาหารเป็นกรัม (1-3000)'; render(); return; }
  track.foodErr[iso+':'+cat] = '';
  var m = foodMacros(food, g.value);
  var n = (logFor(iso)||{}).nutrition || {};
  patchNutrition(iso, {
    foods: (n.foods||[]).concat([{fid:food.id, cat:cat, name:food.name, g:g.value, p:m.p, c:m.c, f:m.f, kcal:m.kcal}]),
    proteinG: r1((n.proteinG||0)+m.p), carbG: r1((n.carbG||0)+m.c), fatG: r1((n.fatG||0)+m.f), kcal: Math.round((n.kcal||0)+m.kcal)
  });
}
function removeFood(iso, idx){
  var n = (logFor(iso)||{}).nutrition || {}, foods = (n.foods||[]).slice(), x = foods[idx];
  if(!x) return;
  foods.splice(idx, 1);
  patchNutrition(iso, {
    foods: foods,
    proteinG: r1(Math.max(0, (n.proteinG||0)-x.p)), carbG: r1(Math.max(0, (n.carbG||0)-x.c)),
    fatG: r1(Math.max(0, (n.fatG||0)-x.f)), kcal: Math.max(0, Math.round((n.kcal||0)-x.kcal))
  });
}
function foodPanelHTML(iso, cat, n){
  var open = !!track.openFood[iso+':'+cat];
  var mine = (n.foods||[]).map(function(x, i){ return {x:x, i:i}; }).filter(function(o){ return o.x.cat===cat; });
  var list = mine.length ? '<div class="food-list">'+mine.map(function(o){
    return '<div class="food-item"><div><b>'+esc(o.x.name)+'</b> '+o.x.g+' g<div class="food-macro">'+esc(macroLine(o.x))+'</div></div>'+
      '<button type="button" class="food-del" data-act="food-del" data-date="'+iso+'" data-idx="'+o.i+'" aria-label="ลบ '+esc(o.x.name)+'">✕</button></div>';
  }).join('')+'</div>' : '';
  var btn = '<button type="button" class="ex-open" data-act="food-toggle" data-date="'+iso+'" data-cat="'+cat+'">'+
    (open ? 'ซ่อนช่องเพิ่มอาหาร ▴' : '+ เพิ่มอาหาร ('+FOOD_CAT_LABEL[cat]+') ▾')+'</button>';
  if(!open) return btn + list;
  var foods = FOODS.filter(function(f){ return f.cat===cat; });
  var err = track.foodErr[iso+':'+cat];
  return btn + '<div class="setbox food-box">'+
    '<div class="food-row"><select id="food-sel-'+cat+'-'+iso+'" data-act="food-pick" data-date="'+iso+'" data-cat="'+cat+'" aria-label="เลือกอาหาร">'+
      foods.map(function(f){ return '<option value="'+f.id+'">'+esc(f.name)+'</option>'; }).join('')+'</select>'+
    '<input type="number" inputmode="decimal" min="1" max="3000" id="food-g-'+cat+'-'+iso+'" data-act="food-grams" data-date="'+iso+'" data-cat="'+cat+'" data-fkey="food-g-'+cat+'-'+iso+'" placeholder="กรัม" aria-label="น้ำหนักอาหาร (กรัม)">'+
    '<button type="button" class="btn sm" data-act="food-add" data-date="'+iso+'" data-cat="'+cat+'">เพิ่ม</button></div>'+
    '<div class="food-prev" id="food-prev-'+cat+'-'+iso+'">'+esc(foodPreviewText(foods[0], 0))+'</div>'+
    (err ? '<div class="hint" style="color:var(--warn)">'+esc(err)+'</div>' : '')+
    '<div class="hint">อาหารที่เพิ่มจะบวกโปรตีน/คาร์บ/ไขมัน/แคลอรี่เข้ายอดรวมของวันให้อัตโนมัติ — ค่าประมาณต่อ 100 g จาก USDA</div></div>' + list;
}

function sectionFood(iso){
  var p = track.program, t = targetsOf(p);
  var log = logFor(iso) || {};
  var n = log.nutrition || {};
  var meals = n.meals || [];
  var mealBtns = '';
  for(var i=0;i<t.meals;i++){
    mealBtns += '<button type="button" class="meal-btn'+(meals[i]?' on':'')+'" data-act="meal" data-date="'+iso+'" data-idx="'+i+'">มื้อ '+(i+1)+(meals[i]?' ✓':'')+'</button>';
  }
  var doneN = 0;
  if(n.proteinG!=null && n.proteinG>=t.proteinG*0.9) doneN++;
  if(kcalOk(n.kcal, t.kcal)) doneN++;
  if(n.waterL!=null && n.waterL>=t.waterL*0.9) doneN++;
  for(var j=0;j<t.meals;j++){ if(meals[j]) doneN++; }
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--food)"></span><h2>โภชนาการ</h2>'+
    '<span class="meta">'+fmtKcal(t.kcal)+' kcal · โปรตีน '+t.proteinG+' g · น้ำ '+fmt1(t.waterL)+' ล.</span>'+
    '<span class="cnt">'+doneN+'/'+(3+t.meals)+'</span></div>'+
    '<div class="chk-list">'+
      '<div class="chk wrap'+((n.proteinG!=null&&n.proteinG>=t.proteinG*0.9)?' on':'')+'">'+
        '<div class="cb"><div class="t">โปรตีนวันนี้</div><div class="s">เป้า '+t.proteinG+' g (2 g ต่อน้ำหนักตัว 1 กก.) — ติ๊กผ่านเมื่อถึง 90% ขึ้นไป</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="proteinG" data-date="'+iso+'" data-fkey="nut-p-'+iso+'" value="'+num(n.proteinG)+'" placeholder="g"><span class="tgt">/ '+t.proteinG+' g</span></div>'+
        '<div class="chk-full">'+foodPanelHTML(iso, 'protein', n)+'</div></div>'+
      '<div class="chk wrap">'+
        '<div class="cb"><div class="t">คาร์โบไฮเดรตวันนี้</div><div class="s">เป้าประมาณ '+t.carbG+' g — แสดงเป็นข้อมูล ไม่นับในเช็คลิสต์</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="carbG" data-date="'+iso+'" data-fkey="nut-c-'+iso+'" value="'+num(n.carbG)+'" placeholder="g"><span class="tgt">/ '+t.carbG+' g</span></div>'+
        '<div class="chk-full">'+foodPanelHTML(iso, 'carb', n)+'</div></div>'+
      '<div class="chk wrap">'+
        '<div class="cb"><div class="t">ไขมันวันนี้</div><div class="s">เป้าประมาณ '+t.fatG+' g — แสดงเป็นข้อมูล ไม่นับในเช็คลิสต์</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="fatG" data-date="'+iso+'" data-fkey="nut-f-'+iso+'" value="'+num(n.fatG)+'" placeholder="g"><span class="tgt">/ '+t.fatG+' g</span></div>'+
        '<div class="chk-full">'+foodPanelHTML(iso, 'fat', n)+'</div></div>'+
      '<div class="chk'+(kcalOk(n.kcal, t.kcal)?' on':'')+'">'+
        '<div class="cb"><div class="t">พลังงานที่กินวันนี้</div><div class="s">เป้า '+fmtKcal(t.kcal)+' kcal · '+esc(t.kcalDirection)+(t.kcal!=null?' — ผ่านเมื่ออยู่ในช่วง '+Math.ceil(t.kcal*0.9).toLocaleString()+'–'+Math.floor(t.kcal*1.1).toLocaleString()+' kcal (กินน้อยเกินไปก็ยังไม่ผ่าน)':'')+'</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="kcal" data-date="'+iso+'" data-fkey="nut-k-'+iso+'" value="'+num(n.kcal)+'" placeholder="kcal"><span class="tgt">/ '+fmtKcal(t.kcal)+'</span></div></div>'+
      '<div class="chk'+((n.waterL!=null&&n.waterL>=t.waterL*0.9)?' on':'')+'">'+
        '<div class="cb"><div class="t">น้ำดื่ม</div><div class="s">เป้า '+fmt1(t.waterL)+' ลิตร (≈35 มล. ต่อน้ำหนักตัว 1 กก.)</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" step="0.1" data-act="nut" data-field="waterL" data-date="'+iso+'" data-fkey="nut-w-'+iso+'" value="'+num(n.waterL)+'" placeholder="ลิตร"><span class="tgt">/ '+fmt1(t.waterL)+' ล.</span></div></div>'+
      '<div class="chk"><div class="cb"><div class="t">มื้ออาหารตามแผน</div><div class="s">'+t.meals+' มื้อ/วัน ตามที่ตอบไว้ — กดเพื่อติ๊กเมื่อกินแล้ว</div>'+
        '<div class="meal-row" style="margin-top:8px">'+mealBtns+'</div></div></div>'+
    '</div>'+
    '<p class="hint">กด “+ เพิ่มอาหาร” ใต้แต่ละหมวดเพื่อให้ระบบแปลงน้ำหนักอาหารเป็นสารอาหารและแคลอรี่ หรือกรอกยอดรวมเองได้โดยตรง</p>'+
    '</div>';
}

function sectionSleep(iso){
  var p = track.program, t = targetsOf(p);
  var log = logFor(iso) || {};
  var sl = log.sleep || {};
  // N-02: ข้อมูลเก่าที่บันทึกไว้ก่อนมี validation (เช่น 99 ชม.) ต้องไม่นับว่าสำเร็จ
  // และต้องขึ้นเตือนว่าค่าผิดปกติ โดยไม่ลบ/ทับค่าดิบที่บันทึกไว้เดิม
  var hoursOutOfRange = sl.hours!=null && (!isFinite(sl.hours) || sl.hours<0 || sl.hours>24);
  var okH = sl.hours!=null && !hoursOutOfRange && t.sleepH!=null && sl.hours >= t.sleepH-0.5;
  var total = t.sleepHygiene?2:1, doneN = (okH?1:0) + (t.sleepHygiene && sl.hygiene ?1:0);
  var rejectedNote = track.sleepHoursError[iso]
    ? '<div class="hint" style="color:var(--warn);margin-top:4px">ค่าที่กรอกต้องอยู่ระหว่าง 0-24 ชม. ระบบไม่ได้บันทึกค่านี้</div>' : '';
  var legacyBadNote = (!track.sleepHoursError[iso] && hoursOutOfRange)
    ? '<div class="hint" style="color:var(--warn);margin-top:4px">ค่าที่บันทึกไว้ ('+sl.hours+' ชม.) อยู่นอกช่วงที่เป็นไปได้จริง กรุณาแก้ไข — ระบบไม่นับเป็นวันที่ทำสำเร็จ</div>' : '';
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--sleep)"></span><h2>การนอน</h2>'+
    '<span class="meta">เป้า '+fmtHours(t.sleepH)+'</span><span class="cnt">'+doneN+'/'+total+'</span></div>'+
    '<div class="chk-list">'+
      '<div class="chk'+(okH?' on':'')+'">'+
        '<div class="cb"><div class="t">ชั่วโมงนอนคืนที่ผ่านมา</div><div class="s">'+(t.sleepH!=null?'ผ่านเมื่อได้ '+fmt1(t.sleepH-0.5)+' ชม. ขึ้นไป':'ยังไม่ได้ตั้งเป้า — กลับไปแก้แบบสอบถามข้อ Q37 เพื่อให้ระบบคำนวณเป้าให้')+'</div>'+rejectedNote+legacyBadNote+'</div>'+
        '<div class="val"><input type="number" inputmode="decimal" step="0.5" min="0" max="24" data-act="sleep-h" data-date="'+iso+'" data-fkey="sleep-'+iso+'" value="'+num(sl.hours)+'" placeholder="ชม."><span class="tgt">/ '+fmtHours(t.sleepH)+'</span></div></div>'+
      (t.sleepHygiene ? '<div class="chk'+(sl.hygiene?' on':'')+'">'+
        '<input type="checkbox" data-act="sleep-hyg" data-date="'+iso+'" '+(sl.hygiene?'checked':'')+'>'+
        '<div class="cb"><div class="t">ทำ sleep hygiene ก่อนนอน</div><div class="s">คุณตอบว่าอยากได้คำแนะนำนี้ (นอนน้อยกว่า 6 ชม.) — เลี่ยงจอ 30 นาทีก่อนนอน เข้านอนเวลาเดิมทุกคืน</div></div></div>' : '')+
    '</div></div>';
}

/* ---------- ความเครียด/อารมณ์รายวัน ----------
   บันทึกเป็นข้อมูล ไม่นับความครบ/สีแดง — ใช้เป็นปัจจัยประกอบการเฝ้าระวังในกรอบแผน Progression & Goal */
var STRESS_LEVELS = [
  {v:1, label:'ไม่เครียด', icon:'😌'}, {v:2, label:'เล็กน้อย', icon:'🙂'}, {v:3, label:'ปานกลาง', icon:'😐'},
  {v:4, label:'มาก', icon:'😣'}, {v:5, label:'มากที่สุด', icon:'😫'}
];
var STRESS_CHIPS = ['งาน','การเรียน','ครอบครัว','การเงิน','ความสัมพันธ์','สุขภาพ','นอนไม่พอ','เดินทาง'];
function stressOf(iso){ var s = (logFor(iso)||{}).stress; return (s && s.level>=1 && s.level<=5) ? s : null; }
function stressLabel(level){ var x = STRESS_LEVELS[level-1]; return x ? x.icon+' '+level+'/5 '+x.label : ''; }
function patchStress(iso, patch){
  var cur = (logFor(iso)||{}).stress || {}, s = {};
  Object.keys(cur).forEach(function(k){ s[k] = cur[k]; });
  Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });
  saveDay(iso, {stress:s});
}
function sectionStress(iso){
  var s = (logFor(iso)||{}).stress || {}, lvl = s.level || null;
  var btns = STRESS_LEVELS.map(function(x){
    return '<button type="button" class="meal-btn s'+x.v+(lvl===x.v ? ' on' : '')+'" data-act="stress-lvl" data-date="'+iso+'" data-val="'+x.v+'" aria-pressed="'+(lvl===x.v)+'">'+x.icon+' '+x.v+' · '+x.label+'</button>';
  }).join('');
  var chips = STRESS_CHIPS.map(function(c){
    return '<button type="button" class="opt" data-act="stress-chip" data-date="'+iso+'" data-val="'+esc(c)+'">'+esc(c)+'</button>';
  }).join('');
  var tip = lvl>=4 ? '<div class="sym-advice">'+(lvl===5
      ? 'วันนี้เครียดมาก — ไม่ต้องฝืนฝึกหนักกว่าแผน พักหายใจลึก ๆ เดินเบา ๆ และนอนให้พอ ถ้าเครียดมากต่อเนื่องหรือรับมือไม่ไหว ควรคุยกับคนที่ไว้ใจหรือผู้เชี่ยวชาญ (สายด่วนสุขภาพจิต 1323)'
      : 'เครียดมาก — ลองพักหายใจลึก ๆ เดินเบา ๆ 10-20 นาที และนอนให้ถึงเป้า ช่วยให้ร่างกายฟื้นตัวได้ดีขึ้น')+'</div>' : '';
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--stress)"></span><h2>ความเครียด / อารมณ์</h2>'+
    '<span class="meta">บันทึกเป็นข้อมูล ไม่นับในเช็คลิสต์</span>'+(lvl ? '<span class="cnt">'+lvl+'/5</span>' : '')+'</div>'+
    '<div class="chk-list"><div class="chk wrap">'+
      '<div class="cb"><div class="t">ระดับความเครียดวันนี้</div><div class="s">ความเครียดสะสมมีผลต่อการนอน การฟื้นตัว ความอยากอาหาร และน้ำหนักตัว — ระบบใช้ประกอบการเฝ้าระวังในหน้าความคืบหน้า (กดระดับเดิมซ้ำเพื่อล้าง)</div>'+
        '<div class="meal-row stress-row" style="margin-top:8px">'+btns+'</div></div>'+
      '<div class="chk-full">'+
        '<input type="text" class="stress-note" maxlength="200" placeholder="สาเหตุของความเครียด เช่น งานเร่ง ประชุมทั้งวัน เรื่องที่บ้าน" data-act="stress-note" data-date="'+iso+'" data-fkey="stress-'+iso+'" value="'+esc(s.note||'')+'">'+
        '<div class="sym-chips">'+chips+(s.note ? '<button type="button" class="opt" data-act="stress-clear" data-date="'+iso+'">ล้างสาเหตุ</button>' : '')+'</div>'+tip+
      '</div></div></div></div>';
}

function sectionBody(iso){
  var p = track.program, t = targetsOf(p);
  var kg = weightFor(iso);
  var series = weightSeries();
  var first = series.length ? series[0] : null;
  var deltaTxt = '';
  if(kg!=null && first){
    var d = kg - first.kg;
    deltaTxt = (d===0?'เท่ากับ':(d>0?'มากกว่า':'น้อยกว่า'))+'วันแรกที่ชั่ง ('+fmt1(first.kg)+' กก. เมื่อ '+shortDateTH(first.date)+') '+fmt1(Math.abs(d))+' กก.';
  } else if(kg==null){
    deltaTxt = 'ชั่งตอนเดิมของทุกวันจะเทียบกันได้แม่นที่สุด (เช่น หลังตื่นนอน ก่อนอาหาร)';
  }
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--branch)"></span><h2>น้ำหนักตัว</h2>'+
    '<span class="meta">'+(t.goalWeight? 'เป้า '+fmt1(t.goalWeight)+' กก.' : 'ยังไม่ได้ตั้งเป้าตัวเลข')+'</span>'+
    '<span class="cnt">'+(kg!=null?1:0)+'/1</span></div>'+
    '<div class="chk-list"><div class="chk'+(kg!=null?' on':'')+'">'+
      '<div class="cb"><div class="t">บันทึกน้ำหนักของวันนี้</div><div class="s">'+esc(deltaTxt)+'</div></div>'+
      '<div class="val"><input type="number" inputmode="decimal" step="0.1" data-act="weight" data-date="'+iso+'" data-fkey="wt-'+iso+'" value="'+num(kg)+'" placeholder="กก."><span class="tgt">กก.</span></div>'+
    '</div></div></div>';
}

function sectionCardio(iso){
  var p = track.program;
  var planned = cardioPlannedFor(p, iso);
  var mins = cardioMinutesOn(iso);
  var target = cardioTargetOn(p, iso);
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--branch)"></span><h2>Cardio</h2>'+
    '<span class="meta">'+(planned ? 'ตามแผน ~'+target+' นาที' : 'ไม่ได้อยู่ในแผนวันนี้ — ถ้าทำก็บันทึกได้')+'</span>'+
    (planned ? '<span class="cnt">'+(mins?1:0)+'/1</span>' : '')+'</div>'+
    '<div class="chk-list"><div class="chk'+(mins?' on':'')+'">'+
      '<div class="cb"><div class="t">เวลาที่ทำ cardio วันนี้</div><div class="s">กรอกจำนวนนาทีที่ทำจริง (เดินเร็ว วิ่ง ปั่นจักรยาน ฯลฯ)</div></div>'+
      '<div class="val"><input type="number" inputmode="numeric" min="0" max="600" data-act="cardio-min" data-date="'+iso+'" data-fkey="cardio-'+iso+'" value="'+num(mins)+'" placeholder="นาที"><span class="tgt">'+(planned?'/ '+target+' นาที':'นาที')+'</span></div>'+
    '</div></div></div>';
}

function dayEditor(iso){
  return sectionWorkout(iso) + sectionCardio(iso) + sectionFood(iso) + sectionSleep(iso) + sectionStress(iso) + sectionBody(iso);
}
function dayDetailHTML(iso){
  var rep = dayReport(track.program, iso);
  var wu = rep.warmup && rep.warmup.total
    ? '<div class="sec-card"><div class="sec-head"><h2>Warm-up</h2><span class="meta">บันทึกไว้เป็นข้อมูล ไม่นับความครบ</span>'+
        '<span class="cnt">'+rep.warmup.done+'/'+rep.warmup.total+'</span></div><div class="hist-items">'+
        rep.warmup.byEx.map(function(x){ return '<div class="hist-item"><span>'+esc(x.label)+'</span><span class="mono">'+x.done+'/'+x.total+' เซ็ต</span></div>'; }).join('')+
      '</div></div>'
    : '';
  return REPORT_GROUPS.map(function(g){
    var its = rep.items.filter(function(x){ return x.group===g.k; });
    if(!its.length) return '';
    var ok = its.every(function(x){ return x.done; });
    return '<div class="sec-card"><div class="sec-head"><h2'+(ok?'':' class="act-miss"')+'>'+esc(g.label)+'</h2>'+
      '<span class="cnt">'+its.filter(function(x){return x.done;}).length+'/'+its.length+'</span></div>'+
      '<div class="hist-items">'+its.map(function(x){
        return '<div class="hist-item'+(x.done?'':' act-miss')+'"><span>'+esc(x.label)+'</span><span class="mono">'+esc(x.val)+'</span></div>';
      }).join('')+'</div></div>'+(g.k==='workout' ? wu : '');
  }).join('') + dayExtrasHTML(iso);
}
/* อาการหลังออกกำลังกาย + รายการอาหาร ของวันนั้น (อ่านจาก log โดยตรง ใช้ได้ทั้งวันที่ล็อกแล้ว) */
function dayExtrasHTML(iso){
  var lg = logFor(iso) || {}, out = '', st = stressOf(iso);
  if(st){
    out += '<div class="sec-card"><div class="sec-head"><h2>ความเครียด / อารมณ์</h2><span class="meta">บันทึกไว้เป็นข้อมูล ไม่นับความครบ</span></div><div class="hist-items">'+
      '<div class="hist-item"><span>'+esc(st.note ? 'สาเหตุ: '+st.note : 'ไม่ได้ระบุสาเหตุ')+'</span><span>'+esc(stressLabel(st.level))+'</span></div></div></div>';
  }
  var syms = Object.keys(lg.exercises||{}).map(function(id){ return lg.exercises[id].symptom; }).filter(Boolean);
  if(syms.length){
    out += '<div class="sec-card"><div class="sec-head"><h2>อาการหลังออกกำลังกาย</h2></div><div class="hist-items">'+syms.map(function(s){
      var info = SYMPTOM_INFO[s.level] || SYMPTOM_INFO.unknown;
      return '<div class="hist-item'+(info.cls==='danger'?' act-miss':'')+'"><span>'+esc(s.name||'')+': '+esc(s.text)+'</span><span>'+info.icon+' '+info.label+'</span></div>';
    }).join('')+'</div></div>';
  }
  var foods = (lg.nutrition||{}).foods || [];
  if(foods.length){
    out += '<div class="sec-card"><div class="sec-head"><h2>อาหารที่บันทึก</h2></div><div class="food-list">'+foods.map(function(x){
      return '<div class="food-item"><div><b>'+esc(x.name)+'</b> '+x.g+' g<div class="food-macro">'+esc(macroLine(x))+'</div></div></div>';
    }).join('')+'</div></div>';
  }
  return out;
}
/* วันที่ยังแก้ได้ = ฟอร์มบันทึก, วันที่ล็อกแล้ว = ดูผลสุดท้ายอย่างเดียว */
function dayPanelBody(iso){
  if(isEditable(iso)) return dayEditor(iso);
  return '<div class="banner info"><div class="ic">🔒</div><div>วันนี้ถูกล็อกแล้ว ดูได้อย่างเดียว — บันทึกหรือแก้ไขได้เฉพาะวันนี้และเมื่อวาน</div></div>'+dayDetailHTML(iso);
}

/* ---------- หน้า: วันนี้ ---------- */
function renderToday(){
  var p = track.program, iso = todayISO();
  var counts = dayCounts(p, iso);
  var pct = counts.total ? Math.round(counts.done/counts.total*100) : 0;
  var sKey = sessionKeyFor(p, iso);
  var tomorrowIso = fmtDateISO(addDays(new Date(),1));
  var tKey = sessionKeyFor(p, tomorrowIso);
  var tSess = sessionDefFor(p, tKey);

  var html = '<div class="page-head"><div>'+
      '<div class="eyebrow">'+esc(longDateTH(iso))+'</div>'+
      '<h1>วันนี้: '+dayLabelHTML(p, iso, 'พัก')+'</h1>'+
      '<div class="sub">'+(sKey||cardioPlannedFor(p, iso)? 'ตามตารางที่ผูกกับวันที่จริง — ติ๊กทีละข้อระหว่างวันได้เลย ข้อมูลบันทึกทันทีที่กด' : 'วันพักตามตาราง — ถ้าทำ cardio เพิ่มก็บันทึกได้ เช็คลิสต์ที่เหลือคือโภชนาการ การนอน และน้ำหนักตัว')+'</div>'+
    '</div><div class="head-actions">'+
      '<button type="button" class="btn" data-act="nav" data-view="schedule">ดูตารางทั้งสัปดาห์</button>'+
      '<button type="button" class="btn" data-act="nav" data-view="progress">ความคืบหน้า</button>'+
    '</div></div>';

  html += oldScheduleBanner(p) + scheduleClashBanner(p) + planUpdateBanner(p) + fatAlertHTML(p) + pgAlertHTML(p);
  html += '<div class="today-grid"><div class="stack">'+dayEditor(iso)+'</div>'+
    '<aside class="rail">'+
      '<div class="prog-card"><div class="prog-top"><h3>ความคืบหน้าวันนี้</h3><span class="n mono">'+counts.done+'/'+counts.total+'</span></div>'+
        '<div class="pbar'+(pct>=100?' full':'')+'"><i style="width:'+pct+'%"></i></div>'+
        '<p style="margin:0;font-size:12.5px;color:var(--text-2)">'+(pct>=100? 'ทำครบทุกข้อของวันนี้แล้ว' : 'เหลืออีก '+(counts.total-counts.done)+' ข้อ'+(sKey? ' · เทรนวันนี้ '+esc(p.trainTime||'') : ''))+'</p>'+
        (track.saveStatus? '<span class="save-status">'+esc(track.saveStatus)+'</span>':'')+
      '</div>'+
      '<div class="side-card"><h3>พรุ่งนี้</h3>'+
        '<p><b>'+dayLabelHTML(p, tomorrowIso, 'พักฟื้น')+'</b><br>'+esc(tSess? tSess.exercises.map(function(e){return e.th;}).slice(0,3).join(' · ') : (cardioPlannedFor(p, tomorrowIso)? 'Cardio ~'+cardioTargetOn(p, tomorrowIso)+' นาที' : 'ยืดกล้ามเนื้อ เดินเบาๆ และนอนให้ครบเป้า'))+'</p>'+
        '<button type="button" class="linkbtn" data-act="nav" data-view="schedule">ดูตารางทั้งสัปดาห์ →</button></div>'+
      '<div class="side-card"><h3>ทำตามแผนไม่ได้?</h3><p>ข้ามได้โดยไม่ต้องแก้อะไร — เมื่อผ่านวันไปแล้ว ชื่อกิจกรรมที่ไม่สำเร็จจะเป็นตัวแดงในตารางฝึก — บันทึกย้อนหลังได้แค่เมื่อวาน หลังจากนั้นวันนั้นจะล็อก</p>'+
        '<button type="button" class="linkbtn" data-act="nav" data-view="plan">ปรับแผน/เปลี่ยนวันฝึก →</button></div>'+
    '</aside></div>';

  document.getElementById("page").innerHTML = html;
}

/* ---------- หน้า: ตารางฝึก (รายสัปดาห์ / รายเดือน) ---------- */
function ensureWeekStart(){ if(!track.weekStart) track.weekStart = fmtDateISO(startOfWeek(new Date())); }
function ensureViewMonth(){
  if(!track.viewMonth){
    var td=new Date();
    track.viewMonth={y:td.getFullYear(), m:td.getMonth()};
  }
}
var STATUS_CHIP = {
  done:'<span class="chip ok">บันทึกครบ ✓</span>',
  partial:'<span class="chip">บันทึกบางส่วน</span>',
  pending:'<span class="chip">ยังไม่บันทึก</span>',
  future:'<span class="chip">ยังไม่ถึง</span>',
  before:'<span class="chip">ก่อนเริ่มโปรแกรม</span>',
  rest:'', 'rest-future':'', 'rest-done':'<span class="chip ok">ครบ ✓</span>'
};

function renderWeekGrid(){
  var p = track.program;
  ensureWeekStart();
  var ws = parseISO(track.weekStart);
  var today = todayISO();
  var cards = '';
  for(var i=0;i<7;i++){
    var d = addDays(ws,i), iso = fmtDateISO(d);
    var sKey = sessionKeyFor(p, iso);
    var sess = sessionDefFor(p, sKey);
    var stt = dayStatus(p, iso);
    var openable = iso <= today && (iso >= p.startDate || !!logFor(iso));
    var hasCardio = cardioPlannedFor(p, iso);
    var active = !!sKey || hasCardio || !!cardioMinutesOn(iso);
    var cls = 'wk-card' + (active?'':' rest') + (iso===today?' is-today':'') + (iso < p.startDate?' before':'');
    var chips = (iso===today?'<span class="chip now">วันนี้</span>':'') +
                (sKey?'<span class="chip">'+esc(p.minutesEstimate||'')+'</span>':(active?'':'<span class="chip">พัก</span>')) +
                (STATUS_CHIP[stt]||'');
    var cardioTxt = hasCardio ? 'Cardio ~'+cardioTargetOn(p, iso)+' นาที' : '';
    var sub = sess
      ? sess.exercises.map(function(e){return e.th;}).join(' · ') + (cardioTxt? ' · '+cardioTxt : '')
      : (cardioTxt || (active ? 'ทำ cardio เพิ่มนอกแผน' : 'ยืดกล้ามเนื้อ 10 นาที · เดินเบาๆ · เน้นนอนให้ครบเป้า'));
    var fin = (logFor(iso)||{}).final;
    if(fin){
      chips = fin.complete ? '<span class="chip ok">ครบ ✓ 🔒</span>' : '<span class="chip miss">ไม่ครบ 🔒</span>';
      sub = 'ล็อกแล้ว — ทำได้ '+fin.items.filter(function(x){ return x.done; }).length+'/'+fin.items.length+' ข้อ';
    }
    if(iso < p.startDate){ chips = STATUS_CHIP.before; sub = logFor(iso) ? 'ก่อนเริ่มแผนปัจจุบัน — กดเพื่อดูบันทึก' : 'ก่อนเริ่มแผนปัจจุบัน'; }
    cards += '<button type="button" class="'+cls+'"'+(openable?' data-act="open-day" data-date="'+iso+'" data-open="1"':' disabled')+'>'+
      '<div class="wk-top"><span class="wk-day mono">'+esc(DAYS_SHORT[i])+'</span><span class="wk-date mono">'+d.getDate()+' '+esc(TH_MONTHS[d.getMonth()])+'</span>'+
      '<span class="wk-chips">'+chips+'</span></div>'+
      '<div class="wk-name">'+dayLabelHTML(p, iso, 'พักฟื้น')+'</div>'+
      '<div class="wk-sub">'+esc(sub)+'</div></button>';
  }
  var we = addDays(ws,6);
  var label = ws.getDate()+' '+TH_MONTHS[ws.getMonth()]+' – '+we.getDate()+' '+TH_MONTHS[we.getMonth()]+' '+(we.getFullYear()+543);
  return '<div class="range-nav"><h2>'+esc(label)+'</h2><div class="rn-btns">'+
      '<button type="button" data-act="week-prev">← สัปดาห์ก่อน</button>'+
      '<button type="button" data-act="week-today">สัปดาห์นี้</button>'+
      '<button type="button" data-act="week-next">สัปดาห์ถัดไป →</button></div></div>'+
    '<div class="wk-grid">'+cards+'</div>'+
    '<p class="hint" style="margin-top:12px">คลิกวันที่ผ่านมาแล้วหรือวันนี้เพื่อเปิดบันทึกของวันนั้น — บันทึก/แก้ไขได้เฉพาะวันนี้และเมื่อวาน วันก่อนหน้านั้นดูได้อย่างเดียว</p>';
}

function renderMonthGrid(){
  var p = track.program;
  ensureViewMonth();
  var vm = track.viewMonth;
  var first = new Date(vm.y, vm.m, 1);
  var startOffset = (first.getDay()+6)%7;
  var daysInMonth = new Date(vm.y, vm.m+1, 0).getDate();
  var today = todayISO();
  var cells = "";
  for(var i=0;i<startOffset;i++){ cells += '<div class="month-day blank"></div>'; }
  for(var dd=1; dd<=daysInMonth; dd++){
    var dateObj = new Date(vm.y, vm.m, dd);
    var iso = fmtDateISO(dateObj);
    var sKey = sessionKeyFor(p, iso);
    var stt = dayStatus(p, iso);
    var cls = "month-day", mark = "", openable = false;
    var mActive = !!sKey || cardioPlannedFor(p, iso) || !!cardioMinutesOn(iso);
    if(!mActive) cls += " rest";
    if(stt==='before') cls += " before-start";
    else if(stt==='future'){ cls += " future"; mark = "ยังไม่ถึง"; }
    else if(stt==='done'){ cls += " done"; mark = "✓ ครบ"; openable = true; }
    else if(stt==='partial'){ cls += " partial"; mark = "บางส่วน"; openable = true; }
    else if(stt==='pending'){ cls += " pending"; mark = "ยังไม่บันทึก"; openable = true; }
    else if(stt==='rest-done'){ cls += " done"; mark = "✓"; openable = true; }
    else if(stt==='rest'){ openable = (iso<=today && iso>=p.startDate); }
    if(iso===today) cls += " today";
    var tag = openable ? 'button type="button" data-act="open-day" data-date="'+iso+'" data-open="1"' : 'div';
    var close = openable ? 'button' : 'div';
    cells += '<'+tag+' class="'+cls+'">'+
      '<span class="md-num mono">'+dd+'</span>'+
      '<span class="md-sess'+(mActive?'':' rest')+'">'+dayLabelHTML(p, iso, 'พัก')+'</span>'+
      (mark?'<span class="md-mark mono">'+esc(mark)+'</span>':'')+
      '</'+close+'>';
  }
  var dowRow = DAYS_SHORT.map(function(dd2){return '<div class="month-dow">'+esc(dd2)+'</div>';}).join('');
  return '<div class="range-nav"><h2>'+esc(monthLabelTH(vm.y,vm.m))+'</h2><div class="rn-btns">'+
      '<button type="button" data-act="month-prev">← เดือนก่อน</button>'+
      '<button type="button" data-act="month-today">เดือนนี้</button>'+
      '<button type="button" data-act="month-next">เดือนถัดไป →</button></div></div>'+
    '<div class="month-grid">'+dowRow+cells+'</div>'+
    '<p class="hint" style="margin-top:12px">พื้นเขียว = ทำครบและติ๊กแล้ว · ขอบสีน้ำเงิน = บันทึกบางส่วน · <span class="act-miss">ตัวแดง</span> = กิจกรรมที่ผ่านวันไปแล้วแต่ไม่สำเร็จ — คลิกวันเพื่อเปิดดู (แก้ไขได้เฉพาะวันนี้และเมื่อวาน)</p>';
}

function renderSchedule(){
  var p = track.program;
  var tab = track.schedTab==='month' ? 'month' : 'week';
  var html = '<div class="page-head"><div><div class="eyebrow">'+esc(p.splitLabel)+' · '+(p.days||[]).length+' วัน/สัปดาห์</div>'+
      '<h1>ตารางฝึก</h1>'+
      '<div class="sub">ตารางเดียวกันดูได้ 2 มุม: รายสัปดาห์ไว้ดูว่าวันนี้-พรุ่งนี้ต้องทำอะไร รายเดือนไว้ดูภาพรวมทั้งเดือนและย้อนกลับไปบันทึกวันที่ตกหล่น</div></div>'+
      '<div class="head-actions"><div class="tabs">'+
        '<button type="button" class="'+(tab==='week'?'on':'')+'" data-act="tab" data-tab="week">รายสัปดาห์</button>'+
        '<button type="button" class="'+(tab==='month'?'on':'')+'" data-act="tab" data-tab="month">รายเดือน</button>'+
      '</div></div></div>';

  html += tab==='week' ? renderWeekGrid() : renderMonthGrid();

  if(track.openDate){
    var iso = track.openDate;
    html += '<div class="log-panel" id="logPanel">'+
      '<h3>บันทึกของ '+esc(longDateTH(iso))+'</h3>'+
      '<div class="lp-sub">'+esc(iso)+' · '+dayLabelHTML(p, iso, 'วันพัก')+(isEditable(iso)?' — แก้ไขได้ถึงเที่ยงคืนของวันถัดไป ข้อมูลบันทึกทันทีที่กรอก':' — ล็อกแล้ว')+'</div>'+
      '<div class="stack">'+dayPanelBody(iso)+'</div>'+
      '<div class="log-actions"><button type="button" class="btn" data-act="close-day">ปิด</button>'+
      (logFor(iso) && isEditable(iso)? '<button type="button" class="btn ghost" data-act="clear-day" data-date="'+iso+'">ล้างบันทึกของวันนี้</button>':'')+
      '<span class="save-status">'+esc(track.saveStatus||'')+'</span></div>'+
      '</div>';
  }
  document.getElementById("page").innerHTML = html;
  if(track.openDate){
    var panel = document.getElementById("logPanel");
    if(panel && track.scrollToPanel){ panel.scrollIntoView({behavior:"smooth", block:"start"}); track.scrollToPanel=false; }
  }
}

/* ---------- กราฟ (SVG inline ไม่พึ่งไลบรารี) ---------- */
function plotSVG(pts, opts){
  opts = opts || {};
  var w = 720, h = opts.h||220, pl = 46, pr = 16, pt = 14, pb = 26;
  if(!pts.length) return '<p class="hint">ยังไม่มีข้อมูลพอจะวาดกราฟ</p>';
  var xs = pts.map(function(p){return p.x;}), ys = pts.map(function(p){return p.y;});
  var extra = [];
  if(opts.goal!=null) extra.push(opts.goal);
  if(opts.base!=null) extra.push(opts.base);
  var minY = Math.min.apply(null, ys.concat(extra)), maxY = Math.max.apply(null, ys.concat(extra));
  if(maxY===minY){ maxY = minY + 1; minY = minY - 1; }
  var padY = (maxY-minY)*0.12; minY -= padY; maxY += padY;
  var minX = Math.min.apply(null, xs), maxX = Math.max.apply(null, xs);
  if(maxX===minX) maxX = minX + 1;
  function X(v){ return pl + (v-minX)/(maxX-minX)*(w-pl-pr); }
  function Y(v){ return pt + (maxY-v)/(maxY-minY)*(h-pt-pb); }
  var fmt = opts.yfmt || function(v){ return fmt1(v); };
  var line = pts.map(function(p,i){ return (i?'L':'M')+X(p.x).toFixed(1)+' '+Y(p.y).toFixed(1); }).join(' ');
  var area = line + ' L'+X(pts[pts.length-1].x).toFixed(1)+' '+Y(minY).toFixed(1)+' L'+X(pts[0].x).toFixed(1)+' '+Y(minY).toFixed(1)+' Z';
  var svg = '<svg class="chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="'+esc(opts.aria||'กราฟ')+'">';
  [maxY, (maxY+minY)/2, minY].forEach(function(v){
    svg += '<line class="ch-axis" x1="'+pl+'" y1="'+Y(v).toFixed(1)+'" x2="'+(w-pr)+'" y2="'+Y(v).toFixed(1)+'"></line>'+
           '<text class="ch-t" x="'+(pl-8)+'" y="'+(Y(v)+3.5).toFixed(1)+'" text-anchor="end">'+esc(fmt(v))+'</text>';
  });
  svg += '<path class="ch-area" d="'+area+'"></path>';
  if(opts.base!=null){
    svg += '<line class="ch-base" x1="'+pl+'" y1="'+Y(opts.base).toFixed(1)+'" x2="'+(w-pr)+'" y2="'+Y(opts.base).toFixed(1)+'"></line>'+
           '<text class="ch-t" x="'+(w-pr)+'" y="'+(Y(opts.base)-6).toFixed(1)+'" text-anchor="end">'+esc(opts.baseLabel||'จุดเริ่มต้น')+'</text>';
  }
  if(opts.goal!=null){
    svg += '<line class="ch-goal" x1="'+pl+'" y1="'+Y(opts.goal).toFixed(1)+'" x2="'+(w-pr)+'" y2="'+Y(opts.goal).toFixed(1)+'"></line>'+
           '<text class="ch-t goal" x="'+(w-pr)+'" y="'+(Y(opts.goal)+14).toFixed(1)+'" text-anchor="end">'+esc(opts.goalLabel||'เป้าหมาย')+'</text>';
  }
  svg += '<path class="ch-line" d="'+line+'"></path>';
  pts.forEach(function(p,i){
    var last = i===pts.length-1;
    svg += '<circle class="ch-dot'+(last?' end':'')+'" cx="'+X(p.x).toFixed(1)+'" cy="'+Y(p.y).toFixed(1)+'" r="'+(last?4.5:3.2)+'"></circle>';
  });
  var firstLbl = pts[0].label, lastLbl = pts[pts.length-1].label;
  svg += '<text class="ch-t" x="'+pl+'" y="'+(h-7)+'">'+esc(firstLbl)+'</text>';
  if(pts.length>1) svg += '<text class="ch-t" x="'+(w-pr)+'" y="'+(h-7)+'" text-anchor="end">'+esc(lastLbl)+'</text>';
  svg += '</svg>';
  return svg;
}

function milestonesOf(p){
  var t = targetsOf(p);
  var logs = Object.keys(track.logs).map(function(k){return track.logs[k];});
  var completed = logs.filter(function(l){return l && l.completed;}).length;
  var weighDays = Object.keys(track.weights).length;
  var series = weightSeries();
  var first = series.length? series[0].kg : (p.startWeight||null);
  var last = series.length? series[series.length-1].kg : null;
  var moved = (first!=null && last!=null) ? Math.abs(last-first) : 0;
  var st = streakOf(p);
  var goalHit = false;
  if(t.goalWeight!=null && last!=null && first!=null){
    goalHit = (t.goalWeight < first) ? (last<=t.goalWeight) : (last>=t.goalWeight);
  }
  var list = [
    {t:'บันทึกเซสชันแรก', on: completed>=1, sub: completed+' / 1'},
    {t:'ทำครบ 10 เซสชัน', on: completed>=10, sub: Math.min(completed,10)+' / 10'},
    {t:'สตรีค 7 วัน', on: st>=7, sub: Math.min(st,7)+' / 7'},
    {t:'สตรีค 30 วัน', on: st>=30, sub: Math.min(st,30)+' / 30'},
    {t:'ชั่งน้ำหนัก 8 วัน', on: weighDays>=8, sub: Math.min(weighDays,8)+' / 8'},
    {t:'น้ำหนักขยับจากวันแรก 1 กก.', on: moved>=1, sub: fmt1(Math.min(moved,1))+' / 1.0 กก.'}
  ];
  if(t.goalWeight!=null){
    list.push({t:'ถึงน้ำหนักเป้าหมาย '+fmt1(t.goalWeight)+' กก.', on: goalHit, sub: last!=null? ('ตอนนี้ '+fmt1(last)+' กก.') : 'ยังไม่ได้ชั่ง'});
  }
  return list;
}

/* แจ้งเตือนเมื่อครบ 1 กก. — โชว์จนกว่าจะกดรับทราบ (จำจำนวนที่เห็นแล้วไว้ในเครื่อง) */
function fatAlertHTML(p){
  if(!fatBarEnabled(p)) return '';
  var t = fatTug(p), seen = fatSeen();
  var fixSeen = {gains: Math.min(seen.gains, t.gains.length), losses: Math.min(seen.losses, t.losses.length)};
  if(fixSeen.gains!==seen.gains || fixSeen.losses!==seen.losses){ lsSet('gymbro_fat_seen', fixSeen); seen = fixSeen; }
  var nl = t.losses.length - seen.losses, ng = t.gains.length - seen.gains;
  if(nl<=0 && ng<=0) return '';
  var msg = [];
  if(nl>0) msg.push('<div class="banner fat-ok"><div class="ic">🎉</div><div><b>คุณลดไขมันได้ '+nl+' กก.</b> จากการกินน้อยกว่าที่ร่างกายต้องการสะสมครบ '+(nl*FAT_KCAL_PER_KG).toLocaleString()+' kcal — รวมลดได้แล้ว '+t.losses.length+' ครั้ง</div></div>');
  if(ng>0) msg.push('<div class="banner danger"><div class="ic">⚠️</div><div><b>ไขมันของคุณเพิ่มขึ้น '+ng+' กก.</b> จากการกินเกินที่ร่างกายต้องการสะสมครบ '+(ng*FAT_KCAL_PER_KG).toLocaleString()+' kcal — รวมเพิ่มแล้ว '+t.gains.length+' ครั้ง</div></div>');
  return msg.join('')+'<div style="margin:-4px 0 14px"><button type="button" class="btn sm" data-act="fat-ack">รับทราบ</button></div>';
}
function fatBarHTML(p){
  if(!fatBarEnabled(p)) return '';
  var head = '<div class="section-title">แถบไขมัน (ชักเย่อแคลอรี่)</div><div class="card">';
  var tdee = targetsOf(p).tdee;
  if(tdee==null) return head+'<p class="hint">ยังคำนวณไม่ได้ — ข้อมูลแบบสอบถามไม่พอคำนวณพลังงานที่ร่างกายต้องการ (TDEE)</p></div>';
  var t = fatTug(p), acc = t.acc, pct = Math.min(100, Math.abs(acc)/FAT_KCAL_PER_KG*100);
  var side = acc>0 ? 'ok' : (acc<0 ? 'warn' : '');
  var now = acc>0 ? 'กินขาดสะสม <b>'+Math.round(acc).toLocaleString()+'</b> / '+FAT_KCAL_PER_KG.toLocaleString()+' kcal → อีก '+Math.round(FAT_KCAL_PER_KG-acc).toLocaleString()+' kcal จะลดไขมันได้ 1 กก.'
    : acc<0 ? 'กินเกินสะสม <b>'+Math.round(-acc).toLocaleString()+'</b> / '+FAT_KCAL_PER_KG.toLocaleString()+' kcal → อีก '+Math.round(FAT_KCAL_PER_KG+acc).toLocaleString()+' kcal ไขมันจะเพิ่ม 1 กก.'
    : 'แถบอยู่ที่ 0';
  var te = dayEnergy(p, todayISO());
  var todayLine = te
    ? 'วันนี้กินไป '+te.kcal.toLocaleString()+' kcal จาก TDEE '+te.tdee.toLocaleString()+' kcal — ถ้าจบวันที่ตัวเลขนี้ แถบจะขยับ'+
      (te.tdee-te.kcal>=0 ? 'ไปทางขวา +'+(te.tdee-te.kcal).toLocaleString() : 'ไปทางซ้าย '+(te.tdee-te.kcal).toLocaleString())+' kcal (นับตอนเที่ยงคืน)'
    : 'วันนี้ยังไม่ได้กรอกแคลอรี่ — กรอกที่หน้า “วันนี้” แล้วระบบจะนับให้ตอนจบวัน';
  var bar = '<div class="fat-bar" role="img" aria-label="แถบไขมัน: '+(acc>=0?'กินขาด':'กินเกิน')+'สะสม '+Math.abs(Math.round(acc))+' จาก '+FAT_KCAL_PER_KG+' kcal">'+
      '<div class="fat-half left"><i style="width:'+(acc<0?pct:0)+'%"></i></div><div class="fat-mid"></div>'+
      '<div class="fat-half right"><i style="width:'+(acc>0?pct:0)+'%"></i></div></div>'+
    '<div class="fat-scale"><span>ไขมัน +1 กก.<br>−7,700 kcal</span><span>0</span><span>ไขมัน −1 กก.<br>+7,700 kcal</span></div>';
  var events = t.days.filter(function(d){ return d.ev; }).reverse().slice(0,10).map(function(d){
    return '<div class="hist-item'+(d.ev==='gain'?' act-miss':'')+'"><span>'+(d.ev==='loss'?'🟢 ลดไขมัน 1 กก.':'🔴 ไขมันเพิ่ม 1 กก.')+'</span><span class="mono">'+esc(shortDateTH(d.date))+'</span></div>';
  }).join('');
  var recent = t.days.slice(-7).reverse().map(function(d){
    return '<tr><td>'+esc(shortDateTH(d.date))+'</td><td>'+d.kcal.toLocaleString()+'</td><td>'+d.tdee.toLocaleString()+'</td>'+
      '<td class="'+(d.bal>=0?'fat-pos':'fat-neg')+'">'+(d.bal>=0?'+':'')+d.bal.toLocaleString()+'</td></tr>';
  }).join('');
  var open = !!track.fatOpen;
  var toggle = '<button type="button" class="ex-open" data-act="fat-toggle" aria-expanded="'+open+'" style="margin-top:10px">'+(open?'ซ่อนข้อมูล ▴':'แสดงข้อมูล ▾')+'</button>';
  if(!open) return head+bar+toggle+'</div>';
  return head+bar+toggle+
    '<div class="fat-now '+side+'" style="margin-top:12px">'+now+'</div>'+
    '<div class="stat-strip" style="margin-top:14px">'+
      '<div class="stat-b"><div class="l">ลดไขมันได้แล้ว</div><div class="v fat-pos">'+t.losses.length+' <small>ครั้ง (กก.)</small></div><div class="d">ฝั่งขวาครบ 7,700 kcal</div></div>'+
      '<div class="stat-b"><div class="l">ไขมันเพิ่มขึ้น</div><div class="v fat-neg">'+t.gains.length+' <small>ครั้ง (กก.)</small></div><div class="d">ฝั่งซ้ายครบ 7,700 kcal</div></div>'+
      '<div class="stat-b"><div class="l">สุทธิ</div><div class="v '+(t.losses.length>t.gains.length?'fat-pos':(t.losses.length<t.gains.length?'fat-neg':''))+'">'+(t.losses.length-t.gains.length>0?'−':(t.losses.length-t.gains.length<0?'+':''))+Math.abs(t.losses.length-t.gains.length)+' <small>กก. ไขมัน</small></div><div class="d">นับจาก '+t.days.length+' วันที่กรอกแคลอรี่</div></div>'+
    '</div>'+
    '<p class="hint" style="margin-top:12px">'+esc(todayLine)+'</p>'+
    (events ? '<h3 style="font-size:13.5px;margin:14px 0 6px">ประวัติการครบ 1 กก.</h3><div class="hist-items">'+events+'</div>' : '')+
    (recent ? '<table class="logtab"><thead><tr><th>วันที่</th><th>กิน (kcal)</th><th>ร่างกายต้องการ</th><th>ขยับแถบ</th></tr></thead><tbody>'+recent+'</tbody></table>' : '')+
    '<p class="hint" style="margin-top:10px">ร่างกายต้องการ = TDEE (BMR × ระดับกิจกรรมจากลักษณะงาน ยังไม่รวมแคลที่เผาจากการออกกำลังกาย) · 1 กก. ไขมัน ≈ 7,700 kcal · กินขาด = ขยับขวา (เขียว) กินเกิน = ขยับซ้าย (แดง) ครบฝั่งใดฝั่งหนึ่งแล้วเริ่มที่ 0 ใหม่ · นับเมื่อจบวัน และไม่นับวันที่ไม่ได้กรอกแคลอรี่ · เป็นการประมาณ ไม่ใช่การวัดไขมันจริง</p>'+
    '</div>';
}

/* ---------- กรอบแผน Progression & Goal (หน้าความคืบหน้า) ---------- */
var PG_SUMMARY = {
  na:'ระบบจะเริ่มประเมินเองเมื่อข้อมูลพอ — ชั่งน้ำหนักอย่างน้อย 4 ครั้ง และบันทึกการกิน/การฝึกต่อเนื่องราว 2 สัปดาห์',
  ok:'ผลลัพธ์จริงเป็นไปตามกรอบของแผน — ทำแบบนี้ต่อไป',
  watch:'เริ่มเห็นสัญญาณว่าผลอาจไม่ตรงกรอบ ยังไม่ต้องเปลี่ยนอะไร ระบบติดตามต่อให้ทุกวัน',
  anomaly:'คุณทำตามแผนแล้ว แต่ผลลัพธ์ไม่เป็นไปตามกรอบ — ก่อนปรับแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง',
  adjust:'คุณยืนยันแล้วว่าข้อมูลถูกต้อง แต่ผลยังไม่เป็นไปตามกรอบ — ระบบแนะนำให้ปรับแผนตามด้านล่าง'
};
function pgSummaryText(ev){
  var s = ev.signals;
  if(ev.level==='na' && s.some(function(x){ return x.why==='follow'; })) return 'ช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ ระบบจึงยังตัดสินไม่ได้ว่าแผนให้ผลตามกรอบหรือไม่ — ทำตามแผนต่อเนื่องแล้วระบบจะประเมินให้เอง';
  if(ev.level==='anomaly' && ev.persisted)
    return 'ผลหลุดกรอบเล็กน้อยติดต่อกันหลายสัปดาห์และไม่กลับเข้ากรอบเอง — ก่อนปรับแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง';
  if(ev.level==='anomaly' && ev.energy.level==='anomaly' && ev.weight.level!=='anomaly' && ev.strength.level!=='anomaly')
    return 'การกินที่บันทึกไม่สอดคล้องกับน้ำหนักที่เปลี่ยนจริง — ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง';
  function name(x){ return x.key==='weight' ? 'น้ำหนัก' : 'ความแข็งแรง'; }
  var off = [ev.weight, ev.strength].filter(function(x){ return x.why==='follow'; }).map(name);
  if(!off.length || ev.level==='na') return PG_SUMMARY[ev.level];
  var offTxt = off.join('และ')+'ยังประเมินไม่ได้ เพราะช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ (ผลที่ไม่ตรงกรอบจึงยังไม่นับว่าแผนผิดปกติ)';
  if(ev.level==='ok') return [ev.weight, ev.strength].filter(function(x){ return x.level==='ok'; }).map(name).join('และ')+'เป็นไปตามกรอบของแผน · '+offTxt;
  return PG_SUMMARY[ev.level]+' · ส่วน'+offTxt;
}
function pgBadge(level){ var L = PG_LEVELS[level]; return '<span class="pg-badge pg-'+level+'">'+L.icon+' '+esc(L.label)+'</span>'; }
function pgDateY(d){ return d.getDate()+' '+TH_MONTHS[d.getMonth()]+' '+(d.getFullYear()+543); }
function pgGoalLine(p, plan){
  var sb = pgStrengthBand(p), sbt = (sb[0]>0 ? '+' : '')+sb[0]+' ถึง +'+sb[1]+'%';
  var steady = pgRate(plan.lo)+' ถึง '+pgRate(plan.hi)+' กก./สัปดาห์';
  if(p.goal==='ลดไขมัน'){
    var perDay = -plan.c*FAT_KCAL_PER_KG/7;
    return 'น้ำหนักควร'+(plan.hi<0 ? 'ลด '+Math.abs(plan.hi).toFixed(2)+'–'+Math.abs(plan.lo).toFixed(2)+' กก./สัปดาห์' : 'เปลี่ยน '+steady)+
      (perDay>0 ? ' (ไขมันลด ~1 กก. ทุก '+Math.round(FAT_KCAL_PER_KG/perDay)+' วัน)' : '')+' และความแข็งแรงคงที่หรือเพิ่มขึ้น ('+sbt+' ต่อ 4 สัปดาห์)';
  }
  if(p.goal==='เพิ่มกล้ามเนื้อ') return 'น้ำหนักควรเพิ่ม '+plan.lo.toFixed(2)+'–'+plan.hi.toFixed(2)+' กก./สัปดาห์ และความแข็งแรงเพิ่ม '+sbt+' ต่อ 4 สัปดาห์';
  return 'น้ำหนักควรค่อนข้างคงที่ ('+steady+') ขณะที่ความแข็งแรงเพิ่ม '+sbt+' ต่อ 4 สัปดาห์';
}
/* น้ำหนักตอนนี้สำหรับคาดการณ์ไปข้างหน้า: ค่าบนเส้นแนวโน้ม (ลดผลจากน้ำหนักแกว่งรายวัน) > ชั่งล่าสุด > น้ำหนักตั้งต้นของรอบ */
function pgNowKg(ev){
  if(ev.reg) return {kg: ev.reg.a + ev.reg.b*daysBetween(ev.ws, ev.asOf), how:'ค่าบนเส้นแนวโน้ม'};
  var s = ev.ctx.series.filter(function(x){ return x.date <= ev.asOf; });
  if(s.length) return {kg: s[s.length-1].kg, how:'ชั่งล่าสุด '+shortDateTH(s[s.length-1].date)};
  return ev.ctx.anchorKg ? {kg: ev.ctx.anchorKg.kg, how:'น้ำหนักตั้งต้น'} : null;
}
function pgEta(p, ev){
  var g = targetsOf(p).goalWeight, plan = ev.plan, now = pgNowKg(ev);
  if(g==null || !now) return null;
  var need = g - now.kg;
  if(Math.abs(need) < 0.3) return {done:true, goal:g};
  if((p.goal!=='ลดไขมัน' && p.goal!=='เพิ่มกล้ามเนื้อ') || need*plan.c <= 0 || Math.abs(plan.c) < 0.02) return {mismatch:true, goal:g};
  var fastRate = need<0 ? plan.lo : plan.hi, slowRate = need<0 ? plan.hi : plan.lo, weeks = need/plan.c;
  return {goal:g, weeks:weeks, date:addDays(new Date(), Math.round(weeks*7)), fast:need/fastRate, slow: slowRate*need>0 ? need/slowRate : null};
}
function pgEtaBox(p, ev){
  var e = pgEta(p, ev);
  if(!e) return '';
  var head = '<div class="stat-b"><div class="l">ถึงเป้า '+fmt1(e.goal)+' กก.</div>';
  if(e.done) return head+'<div class="v fat-pos">ถึงแล้ว</div><div class="d">น้ำหนักล่าสุดอยู่ที่เป้าหมาย</div></div>';
  if(e.mismatch) return head+'<div class="v">—</div><div class="d">'+(p.goal==='Recomposition (ลด+เพิ่มพร้อมกัน)'
    ? 'Recomposition เน้นเปลี่ยนสัดส่วน น้ำหนักแทบไม่เปลี่ยน — ดูความแข็งแรงและรูปร่างแทน'
    : p.goal==='รักษาสุขภาพทั่วไป' ? 'แผนนี้ตั้งแคลอรี่เพื่อรักษาน้ำหนัก — ถ้าต้องการถึงเป้านี้ให้เปลี่ยนเป้าหมายในแบบสอบถาม'
    : 'แผนนี้ไม่ได้พาน้ำหนักไปทางเป้า')+'</div></div>';
  var fast = Math.max(1, Math.round(e.fast));
  return head+'<div class="v">~'+Math.max(1, Math.round(e.weeks))+' <small>สัปดาห์</small></div><div class="d">ประมาณ '+esc(pgDateY(e.date))+
    (e.slow ? ' (ช่วง '+fast+'–'+Math.round(e.slow)+' สัปดาห์)' : ' (เร็วสุด ~'+fast+' สัปดาห์)')+'</div></div>';
}
function pgCorridorSVG(p, ev){
  var ak = ev.ctx.anchorKg, plan = ev.plan, today = todayISO(), goal = targetsOf(p).goalWeight;
  var elapsed = Math.max(0, daysBetween(ak.date, today));
  var X = Math.max(84, Math.ceil((elapsed + 14)/28)*28);
  var pts = ev.ctx.series.filter(function(s){ return s.date >= ak.date && s.date <= today; })
    .map(function(s){ return {x:daysBetween(ak.date, s.date), y:s.kg}; });
  function at(rate, x){ return ak.kg + rate*x/7; }
  var ys = [at(plan.lo, 0), at(plan.hi, 0), at(plan.lo, X), at(plan.hi, X)].concat(pts.map(function(q){ return q.y; }));
  var minY = Math.min.apply(null, ys), maxY = Math.max.apply(null, ys);
  var showGoal = goal!=null && goal >= minY - 2 && goal <= maxY + 2;
  if(showGoal){ minY = Math.min(minY, goal); maxY = Math.max(maxY, goal); }
  if(maxY - minY < 2){ var m = (maxY + minY)/2; minY = m - 1; maxY = m + 1; }
  var pad = (maxY - minY)*0.1; minY -= pad; maxY += pad;
  var w = 600, h = 250, pl = 46, pr = 14, pt = 14, pb = 26;
  function PX(v){ return (pl + v/X*(w-pl-pr)).toFixed(1); }
  function PY(v){ return (pt + (maxY - v)/(maxY - minY)*(h-pt-pb)).toFixed(1); }
  var svg = '<svg class="chart pg-chart" viewBox="0 0 '+w+' '+h+'" role="img" aria-label="กรอบน้ำหนักที่ควรเป็นถ้าทำตามแผน เทียบกับน้ำหนักที่ชั่งจริง">';
  [maxY, (maxY + minY)/2, minY].forEach(function(v){
    svg += '<line class="ch-axis" x1="'+pl+'" y1="'+PY(v)+'" x2="'+(w-pr)+'" y2="'+PY(v)+'"></line>'+
      '<text class="ch-t" x="'+(pl-6)+'" y="'+(+PY(v)+4)+'" text-anchor="end">'+fmt1(v)+'</text>';
  });
  svg += '<polygon class="ch-band" points="'+PX(0)+','+PY(at(plan.lo,0))+' '+PX(X)+','+PY(at(plan.lo,X))+' '+PX(X)+','+PY(at(plan.hi,X))+' '+PX(0)+','+PY(at(plan.hi,0))+'"></polygon>';
  svg += '<line class="ch-mid" x1="'+PX(0)+'" y1="'+PY(ak.kg)+'" x2="'+PX(X)+'" y2="'+PY(at(plan.c, X))+'"></line>';
  if(showGoal){
    svg += '<line class="ch-goal" x1="'+pl+'" y1="'+PY(goal)+'" x2="'+(w-pr)+'" y2="'+PY(goal)+'"></line>'+
      '<text class="ch-t goal" x="'+(w-pr)+'" y="'+(+PY(goal)-5)+'" text-anchor="end">เป้า '+fmt1(goal)+' กก.</text>';
  }
  var step = X > 168 ? 56 : 28;
  for(var d=0; d<=X; d+=step){
    svg += '<text class="ch-t" x="'+PX(d)+'" y="'+(h-7)+'" text-anchor="'+(d===0 ? 'start' : (d+step>X ? 'end' : 'middle'))+'">'+(d===0 ? 'เริ่มรอบ' : 'สัปดาห์ '+(d/7))+'</text>';
  }
  if(elapsed>0 && elapsed<=X){
    svg += '<line class="ch-today" x1="'+PX(elapsed)+'" y1="'+pt+'" x2="'+PX(elapsed)+'" y2="'+(h-pb)+'"></line>'+
      '<text class="ch-t" x="'+(+PX(elapsed)+4)+'" y="'+(pt+10)+'">วันนี้</text>';
  }
  if(pts.length>1) svg += '<path class="ch-line" d="'+pts.map(function(q, i){ return (i ? 'L' : 'M')+PX(q.x)+' '+PY(q.y); }).join(' ')+'"></path>';
  pts.forEach(function(q, i){ svg += '<circle class="ch-dot'+(i===pts.length-1 ? ' end' : '')+'" cx="'+PX(q.x)+'" cy="'+PY(q.y)+'" r="'+(i===pts.length-1 ? 4.5 : 3.2)+'"></circle>'; });
  return svg+'</svg>';
}
function pgCriteriaHTML(p, ev){
  var t = targetsOf(p), plan = ev.plan, sb = pgStrengthBand(p), ak = ev.ctx.anchorKg, today = todayISO(), cw = pgCardioWeek(p);
  var rows = [
    ['น้ำหนักตัว', pgRate(plan.lo)+' ถึง '+pgRate(plan.hi)+' กก./สัปดาห์'],
    ['เข้าฝึก', (p.days||[]).length+' ครั้ง/สัปดาห์ (นับว่าทำตามแผนเมื่อ ≥ 75%)'],
    cw ? ['Cardio', cw+' นาที/สัปดาห์'] : null,
    t.kcal!=null ? ['แคลอรี่', 'เฉลี่ย '+Math.ceil(t.kcal*0.9).toLocaleString()+'–'+Math.floor(t.kcal*1.1).toLocaleString()+' kcal/วัน และกรอกอย่างน้อย 70% ของวัน'] : null,
    t.proteinG ? ['โปรตีน', '≥ '+Math.round(t.proteinG*0.9)+' g/วัน'] : null,
    t.sleepH!=null ? ['การนอน', '≥ '+fmt1(t.sleepH-0.5)+' ชม./คืน'] : null,
    ['ความแข็งแรง', 'e1RM ท่าที่ใช้น้ำหนัก '+(sb[0]>0 ? '+' : '')+sb[0]+' ถึง +'+sb[1]+'% ต่อ 4 สัปดาห์'],
    ['การชั่งน้ำหนัก', '3-7 ครั้ง/สัปดาห์ ตอนเช้าหลังเข้าห้องน้ำ ก่อนกิน (ให้ระบบแยกแนวโน้มจริงออกจากน้ำได้)']
  ].filter(Boolean);
  var html = '<h4 class="pg-h4">เกณฑ์ที่ควรเห็นทุกสัปดาห์ถ้าทำตามแผน</h4><table class="logtab pg-tab"><tbody>'+
    rows.map(function(r){ return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'; }).join('')+'</tbody></table>';
  var tol = Math.max(0.5, ak.kg*0.005);
  html += '<h4 class="pg-h4">จุดตรวจระหว่างทาง (น้ำหนักเฉลี่ยช่วง ±3 วันของจุดตรวจ)</h4><table class="logtab pg-tab"><thead><tr><th>จุดตรวจ</th><th>กรอบ</th><th>จริง</th><th>ผล</th></tr></thead><tbody>'+
    [2,4,8,12].map(function(wk){
      var d = fmtDateISO(addDays(parseISO(ak.date), 7*wk));
      var a = Math.min(ak.kg + plan.lo*wk, ak.kg + plan.hi*wk), b = Math.max(ak.kg + plan.lo*wk, ak.kg + plan.hi*wk);
      var near = ev.ctx.series.filter(function(s){ return Math.abs(daysBetween(d, s.date)) <= 3 && s.date <= today; });
      var act = near.length ? mean(near.map(function(s){ return s.kg; })) : null;
      var res = d > today ? '<span class="chip">รอถึงวัน</span>'
        : act==null ? '<span class="chip">ไม่ได้ชั่ง</span>'
        : (act >= a - tol && act <= b + tol) ? '<span class="chip ok">ในกรอบ ✓</span>'
        : '<span class="chip miss">'+(act < a ? 'ต่ำกว่า' : 'สูงกว่า')+'กรอบ</span>';
      return '<tr><td>สัปดาห์ '+wk+' · '+esc(shortDateTH(d))+'</td><td>'+fmt1(a)+'–'+fmt1(b)+'</td><td>'+(act!=null ? fmt1(act) : '—')+'</td><td>'+res+'</td></tr>';
    }).join('')+'</tbody></table>';
  var lifts = pgLifts(p).map(function(ex){
    var h = ev.ctx.hist[ex.id];
    return (h && h.length) ? {th:ex.th, cur:h[h.length-1].e1rm} : null;
  }).filter(Boolean).slice(0, 6);
  if(lifts.length){
    html += '<h4 class="pg-h4">ความแข็งแรงที่ควรไปถึง (e1RM โดยประมาณ)</h4><table class="logtab pg-tab"><thead><tr><th>ท่า</th><th>ล่าสุด</th><th>+4 สัปดาห์</th><th>+12 สัปดาห์</th></tr></thead><tbody>'+
      lifts.map(function(l){
        function g(n){ return Math.round(l.cur*(1 + sb[0]*n/100))+'–'+Math.round(l.cur*(1 + sb[1]*n/100)); }
        return '<tr><td>'+esc(l.th)+'</td><td>'+Math.round(l.cur)+' กก.</td><td>'+g(1)+'</td><td>'+g(3)+'</td></tr>';
      }).join('')+'</tbody></table>';
  } else {
    html += '<p class="hint">บันทึกน้ำหนัก/ครั้งต่อเซ็ตในหน้า “วันนี้” แล้วระบบจะตั้งกรอบความแข็งแรงรายท่าให้</p>';
  }
  html += '<p class="hint" style="margin-top:10px">ที่มาของกรอบ: '+(p.goal==='เพิ่มกล้ามเนื้อ'
      ? 'ช่วงเพิ่มกล้าม น้ำหนักควรขึ้น '+PG_GAIN_PCT_MONTH[pgExpRank(p)].join('–')+'% ของน้ำหนักตัวต่อเดือนตามระดับประสบการณ์ (เร็วกว่านี้ส่วนเกินมักเป็นไขมัน)'
      : 'เป้าแคลอรี่ − (TDEE '+fmtKcal(t.tdee)+' + การออกกำลังกายตามแผน ~'+plan.exPerDay+' kcal/วัน) ÷ 7,700 kcal ต่อ 1 กก. ± ช่วงคลาดเคลื่อน'+(p.goal==='ลดไขมัน' ? ' · ไม่ควรลดเร็วเกิน 1% ของน้ำหนักตัว/สัปดาห์' : ''))+
    ' · ความแข็งแรงตามระดับประสบการณ์ (มือใหม่พัฒนาเร็วกว่า) · เป็นค่าประมาณจากแนวทางทั่วไป ไม่ใช่การรับประกันผล</p>';
  return html;
}
/* แบบย่อ (ค่าเริ่มต้น) แสดงแค่กราฟกรอบ — กด "แสดงผลเพิ่มเติม" แล้วรายละเอียดและผลประเมินขึ้นต่อใต้กราฟ */
function pgPlanCardHTML(p, ev){
  var ak = ev.ctx.anchorKg, plan = ev.plan, rounds = (pgState(p).adjustments||[]).length, more = !!track.pgMore;
  var toggle = '<button type="button" class="ex-open" data-act="pg-more" aria-expanded="'+more+'" style="margin-top:10px">'+(more ? 'ซ่อนผลเพิ่มเติม ▴' : 'แสดงผลเพิ่มเติม ▾')+'</button>';
  var html = '<div class="card pg-card">'+(ak ? '<div class="chart-wrap">'+pgCorridorSVG(p, ev)+'</div>'
    : '<p class="hint" style="margin-top:0">ยังไม่มีน้ำหนักตั้งต้น — บันทึกน้ำหนักที่หน้า “วันนี้” แล้วระบบจะวาดกราฟกรอบให้</p>')+toggle;
  if(!more) return html+'</div>';
  html += '<div class="pg-kicker" style="margin-top:14px">ถ้าทำตามแผนนี้ต่อเนื่อง · รอบประเมินเริ่ม '+esc(shortDateTH(ev.anchor))+(rounds ? ' (ปรับเป้าแล้ว '+rounds+' ครั้ง)' : '')+'</div>'+
    '<h3 class="pg-goal">'+esc(pgGoalLine(p, plan))+'</h3>';
  if(!ak) return html+'</div>';
  var now = pgNowKg(ev);
  html += '<div class="stat-strip">'+[4,8,12].map(function(wk){
    var a = now.kg + plan.lo*wk, b = now.kg + plan.hi*wk;
    return '<div class="stat-b"><div class="l">อีก '+wk+' สัปดาห์</div><div class="v">'+fmt1(now.kg + plan.c*wk)+' <small>กก.</small></div>'+
      '<div class="d">ช่วง '+fmt1(Math.min(a, b))+'–'+fmt1(Math.max(a, b))+' · '+esc(shortDateTH(fmtDateISO(addDays(new Date(), 7*wk))))+'</div></div>';
  }).join('')+pgEtaBox(p, ev)+'</div>';
  html += '<p class="hint" style="margin-top:8px">คาดการณ์จากน้ำหนักตอนนี้ ~'+fmt1(now.kg)+' กก. ('+esc(now.how)+')</p>';
  html += '<p class="hint">กราฟ: แถบเขียว = กรอบน้ำหนักที่ควรเป็นถ้าทำตามแผน (ตั้งต้นจาก '+fmt1(ak.kg)+' กก. เมื่อ '+esc(shortDateTH(ak.date))+') · เส้นประเขียว = ค่ากลาง · จุดน้ำเงิน = น้ำหนักที่ชั่งจริง — น้ำหนักรายวันแกว่ง ±1 กก. ได้ ระบบดูแนวโน้มหลายวันรวมกัน</p>';
  var open = !!track.pgCrit;
  html += '<button type="button" class="ex-open" data-act="pg-crit" aria-expanded="'+open+'" style="margin-top:6px">'+(open ? 'ซ่อนเกณฑ์และจุดตรวจ ▴' : 'ดูเกณฑ์รายสัปดาห์ จุดตรวจ และเป้าความแข็งแรง ▾')+'</button>';
  if(open) html += pgCriteriaHTML(p, ev);
  return html+'</div>';
}
function pgChecksFor(p){
  return [
    {k:'weigh', t:'ชั่งน้ำหนักตอนเช้าหลังเข้าห้องน้ำ ก่อนกิน/ดื่ม ด้วยเครื่องชั่งเดิมทุกครั้ง'},
    {k:'food', t:'บันทึกทุกอย่างที่กินและดื่มครบทุกวัน รวมเครื่องดื่มหวาน กาแฟ ของว่าง ซอส และน้ำมันที่ใช้ปรุง'},
    {k:'portion', t:'ปริมาณอาหารมาจากการชั่ง/ตวงหรือฉลากโภชนาการ ไม่ได้กะด้วยตาหรือกรอกตามเป้า'},
    {k:'lift', t:'น้ำหนักและจำนวนครั้งที่กรอกในแต่ละเซ็ตเป็นค่าที่ทำได้จริง'},
    {k:'water', t:'ช่วงนี้ไม่มีปัจจัยที่ทำให้น้ำคั่งผิดปกติ เช่น กินเค็มจัด ป่วย เปลี่ยนยา'+(pgSex(p)==='หญิง' ? ' หรือช่วงก่อน/ระหว่างมีประจำเดือน' : '')}
  ];
}
function pgListHTML(items){
  return '<ul class="pg-issues">'+items.map(function(i){
    return typeof i==='string' ? '<li>'+esc(i)+'</li>' : '<li class="'+i.lvl+'">'+esc(i.text)+'</li>';
  }).join('')+'</ul>';
}
function pgCheckHTML(p, ev){
  var checks = pgChecksFor(p);
  var ticked = checks.filter(function(c){ return track.pgChecks[c.k]; }).length;
  var reset = track.pgResetAsk
    ? '<div class="pg-confirm">เริ่มรอบประเมินใหม่ตั้งแต่วันนี้? ข้อมูลเดิมยังอยู่ครบ แต่ระบบจะไม่ใช้ข้อมูลก่อนวันนี้ในการประเมิน และจะประเมินใหม่เมื่อมีข้อมูลพอ (~2 สัปดาห์)'+
        '<div class="pg-actions"><button type="button" class="btn sm primary" data-act="pg-reset-go">ยืนยัน เริ่มเก็บข้อมูลใหม่</button><button type="button" class="btn sm" data-act="pg-reset">ยกเลิก</button></div></div>'
    : '<button type="button" class="btn sm" data-act="pg-reset">พบว่าบันทึกไม่ครบ/ไม่ถูก — เริ่มเก็บข้อมูลใหม่</button>';
  return '<div class="pg-check">'+
    '<h4>1. จุดที่ระบบพบในข้อมูลของคุณ</h4>'+
    (ev.issues.length ? pgListHTML(ev.issues) : '<p class="pg-note">ระบบไม่พบจุดผิดสังเกตจากตัวข้อมูลเอง — ช่วยตรวจตามรายการในข้อ 2</p>')+
    (ev.causes.length ? '<h4>ปัจจัยที่อาจเกี่ยวข้อง</h4>'+pgListHTML(ev.causes) : '')+
    '<h4>2. ช่วยยืนยันว่าบันทึกครบและถูกต้อง</h4>'+
    checks.map(function(c){
      return '<label class="pg-chk"><input type="checkbox" data-act="pg-check" data-k="'+c.k+'"'+(track.pgChecks[c.k] ? ' checked' : '')+'><span>'+esc(c.t)+'</span></label>';
    }).join('')+
    '<div class="pg-actions"><button type="button" class="btn sm primary" data-act="pg-confirm"'+(ticked<checks.length ? ' disabled' : '')+'>ตรวจแล้ว ข้อมูลถูกต้องครบ ('+ticked+'/'+checks.length+')</button>'+
      (track.pgResetAsk ? '' : reset)+'</div>'+
    (track.pgResetAsk ? reset : '')+
    '<p class="hint">ถ้าเมื่อวาน/วันนี้กรอกผิด แก้ได้ที่ “บันทึกรายวันย้อนหลัง” ด้านล่าง (วันก่อนหน้านั้นล็อกแล้ว) · ยืนยันว่าข้อมูลถูกต้อง → ระบบจะเสนอวิธีปรับแผน · พบว่าบันทึกไม่ครบ → เริ่มเก็บใหม่ให้แม่นขึ้น แล้วระบบประเมินใหม่เอง</p>'+
  '</div>';
}
function pgAdjustHTML(p, ev){
  var rec = pgRecommend(p, ev), t = targetsOf(p), html = '<div class="pg-adjbox"><h4>สิ่งที่ระบบแนะนำให้ปรับ</h4>';
  if(rec.kcal!=null){
    html += '<div class="pg-rec"><b>ปรับเป้าแคลอรี่: '+fmtKcal(t.kcal)+' → '+fmtKcal(rec.kcal)+' kcal/วัน</b><br>'+
      'จากข้อมูลจริง ร่างกายใช้พลังงานประมาณ '+fmtKcal(Math.round(ev.energy.implied))+' kcal/วัน — ถ้าจะให้ผลตามกรอบ ('+pgRate(ev.plan.c)+' กก./สัปดาห์) ควรกินประมาณ '+fmtKcal(rec.want)+' kcal'+
      (rec.capped ? ' · ระบบปรับทีละไม่เกิน 300 kcal เพื่อความปลอดภัย แล้วค่อยประเมินรอบถัดไป' : '')+'</div>'+
      '<button type="button" class="btn sm primary" data-act="pg-apply">ใช้เป้าใหม่ '+fmtKcal(rec.kcal)+' kcal</button>';
  }
  if(rec.text.length) html += pgListHTML(rec.text);
  if(rec.kcal==null && !rec.text.length) html += '<p class="pg-note">ยังไม่มีตัวเลขพอให้ระบบเสนอเป้าใหม่ — ปรับวันฝึก/ท่าได้ที่หน้า “แผนของฉัน” หรือถามโค้ช</p>';
  return html+'<div class="pg-actions"><button type="button" class="btn sm" data-act="nav" data-view="plan">ไปหน้าแผนของฉัน</button>'+
    '<button type="button" class="btn sm ghost" data-act="pg-unconfirm">กลับไปตรวจข้อมูลอีกครั้ง</button></div>'+
    '<p class="hint">ยืนยันข้อมูลเมื่อ '+esc(shortDateTH(pgState(p).confirmedAt))+' · หลังปรับเป้า ระบบเริ่มรอบประเมินใหม่และติดตามผลต่ออีก 2-3 สัปดาห์</p></div>';
}
function pgDetailsHTML(p, ev){
  var t = targetsOf(p), adh = ev.adh, en = ev.energy, rows = [];
  rows.push(['ช่วงข้อมูล', shortDateTH(ev.ws)+' – '+shortDateTH(ev.asOf)+' ('+adh.days+' วันที่จบแล้ว)']);
  if(adh.sess) rows.push(['เข้าฝึก', adh.sessDone+'/'+adh.sess+' วัน ('+Math.round(adh.sessPct*100)+'%) — เกณฑ์ 75%']);
  if(adh.cardio) rows.push(['Cardio ตามแผน', adh.cardioDone+'/'+adh.cardio+' วัน · รวม '+adh.cardioMin+' นาที']);
  rows.push(['กรอกแคลอรี่', adh.kcal.length+'/'+adh.days+' วัน — เกณฑ์ 70%']);
  if(adh.avgIn!=null) rows.push(['กินเฉลี่ย', Math.round(adh.avgIn).toLocaleString()+' kcal/วัน (เป้า '+fmtKcal(t.kcal)+' ±10%) · อยู่ในช่วงเป้า '+adh.kcalOkDays+' วัน']);
  var pr = mean(adh.prot), sl = mean(adh.sleep);
  if(pr!=null) rows.push(['โปรตีนเฉลี่ย', Math.round(pr)+' g (เป้า '+t.proteinG+' g)']);
  if(sl!=null) rows.push(['นอนเฉลี่ย', fmt1(sl)+' ชม. (เป้า '+fmtHours(t.sleepH)+')']);
  var ss = pgStressSummary(ev);
  rows.push(['ความเครียด', ss ? ss.text.replace(/^ความเครียด(สูง|เพิ่มขึ้น)?: /, '') : 'ยังไม่ได้บันทึก — บันทึกได้ที่หน้า “วันนี้” (ไม่บังคับ แต่ช่วยให้ระบบหาสาเหตุได้แม่นขึ้น)']);
  rows.push(['ชั่งน้ำหนัก', ev.wpts.length+' ครั้ง'+(ev.reg ? ' · แนวโน้ม '+pgRate(ev.reg.b*7)+' ± '+(ev.reg.se*7).toFixed(2)+' กก./สัปดาห์' : '')]);
  if(en.implied!=null) rows.push(['พลังงาน', 'ระบบคาด '+fmtKcal(Math.round(en.expected))+' (TDEE '+fmtKcal(t.tdee)+' + ออกกำลังกาย ~'+Math.round(en.exAct)+') · คำนวณจากข้อมูลจริง '+fmtKcal(Math.round(en.implied))+' ± '+Math.round(en.unc)+' kcal/วัน']);
  var html = '<table class="logtab pg-tab"><tbody>'+rows.map(function(r){ return '<tr><td>'+esc(r[0])+'</td><td>'+esc(r[1])+'</td></tr>'; }).join('')+'</tbody></table>';
  html += '<h4 class="pg-h4">คุณภาพข้อมูล</h4>'+(ev.issues.length ? pgListHTML(ev.issues) : '<p class="pg-note">ไม่พบจุดผิดสังเกต</p>');
  if(ev.causes.length) html += '<h4 class="pg-h4">ปัจจัยที่อาจกระทบผล</h4>'+pgListHTML(ev.causes);
  var adj = pgState(p).adjustments || [];
  if(adj.length) html += '<h4 class="pg-h4">ประวัติการปรับเป้า</h4>'+pgListHTML(adj.slice().reverse().map(function(a){
    return shortDateTH(a.date)+': แคลอรี่ '+fmtKcal(a.fromKcal)+' → '+fmtKcal(a.toKcal)+' kcal (TDEE '+fmtKcal(a.fromTdee)+' → '+fmtKcal(a.toTdee)+')';
  }));
  html += '<p class="hint" style="margin-top:10px">วิธีประเมิน: หาแนวโน้มน้ำหนักจากการชั่งย้อนหลัง '+PG_WINDOW+' วัน (เส้นตรงที่ fit ดีที่สุด + ค่าความคลาดเคลื่อน) แล้วเทียบกรอบ · ความแข็งแรงดู e1RM ย้อนหลัง '+PG_STR_WINDOW+' วัน · '+
    'พลังงานที่ใช้จริง = กินเฉลี่ย − น้ำหนักที่เปลี่ยน × 7,700 kcal · การนอน โปรตีน ความเครียด และอาการบาดเจ็บ ใช้เป็นปัจจัยอธิบายผล ไม่ใช่ตัวตัดสินระดับ · ผลที่หลุดกรอบนับว่าผิดปกติเฉพาะตอนเข้าฝึก ≥ 75% และกินตามเป้า (กรอก ≥ 70% ของวัน เฉลี่ยอยู่ใน ±10%) · 3 สัปดาห์แรกของรอบ ยังไม่ตัดสินว่าผิดปกติกรณีน้ำหนักเปลี่ยนเร็วกว่ากรอบ และกรณีข้อมูลพลังงานไม่สอดคล้อง เพราะน้ำและไกลโคเจนทำให้น้ำหนักแกว่งแรง</p>';
  return html;
}
function pgEvalCardHTML(p, ev){
  var hist = ev.history, streak = PG_LEVELS[ev.level].n >= 3 ? ev.run + 1 : 0;
  var html = '<div class="card pg-card pg-eval pg-'+ev.level+'">'+
    '<div class="pg-kicker">ผลการประเมินอัตโนมัติ · ข้อมูล '+esc(shortDateTH(ev.ws))+' – '+esc(shortDateTH(ev.asOf))+'</div>'+
    pgBadge(ev.level)+'<p class="pg-summary">'+esc(pgSummaryText(ev))+(streak>=2 ? ' <b>(หลุดกรอบต่อเนื่อง '+streak+' สัปดาห์)</b>' : '')+'</p>';
  if(hist.length){
    html += '<div class="pg-weeks">'+hist.map(function(x){
      return '<span class="pg-wk pg-'+x.level+'" title="'+esc(shortDateTH(x.date)+': '+PG_LEVELS[x.level].label)+'">สัปดาห์ '+x.week+'</span>';
    }).join('')+'<span class="pg-wk now pg-'+ev.level+'" title="'+esc(PG_LEVELS[ev.level].label)+'">ตอนนี้</span></div>';
  }
  html += '<div class="pg-signals">'+ev.signals.map(function(s){
    return '<div class="pg-sig pg-'+s.level+'"><span class="pg-ic">'+PG_LEVELS[s.level].icon+'</span><div><div class="pg-st">'+esc(s.title)+'</div><div class="pg-sd">'+esc(s.text)+'</div></div></div>';
  }).join('')+'</div>';
  if((ev.level==='na' || ev.level==='ok' || ev.level==='watch') && ev.causes.length)
    html += '<div class="pg-factors"><div class="pg-st">ปัจจัยที่ควรเฝ้าดู (อาจกระทบพัฒนาการ)</div>'+pgListHTML(ev.causes)+'</div>';
  if(ev.level==='anomaly') html += pgCheckHTML(p, ev);
  else if(ev.level==='adjust') html += pgAdjustHTML(p, ev);
  else if(ev.issues.some(function(x){ return x.lvl==='warn'; })) html += '<p class="pg-dq">⚠️ คุณภาพข้อมูล: พบ '+ev.issues.length+' จุดที่ควรบันทึกให้ครบ/แม่นขึ้น เพื่อให้ระบบประเมินได้ถูกต้อง (ดูในรายละเอียด)</p>';
  var open = !!track.pgOpen;
  html += '<button type="button" class="ex-open" data-act="pg-open" aria-expanded="'+open+'" style="margin-top:12px">'+(open ? 'ซ่อนข้อมูลที่ใช้ประเมิน ▴' : 'ดูข้อมูลที่ใช้ประเมิน ▾')+'</button>';
  if(open) html += pgDetailsHTML(p, ev);
  return html+'</div>';
}
function pgSectionHTML(p){
  var ev = pgCurrent(p);
  return '<div class="section-title">เป้าหมาย & กรอบพัฒนาการ (Progression & Goal)</div>'+pgPlanCardHTML(p, ev)+(track.pgMore ? pgEvalCardHTML(p, ev) : '');
}
/* แจ้งเตือนหน้า "วันนี้" ทันทีที่ระบบพบความผิดปกติ — รายละเอียดและการตรวจข้อมูลอยู่หน้าความคืบหน้า */
function pgAlertHTML(p){
  if(!p || !p.startDate) return '';
  var ev = pgCurrent(p);
  if(PG_LEVELS[ev.level].n < 3) return '';
  return '<div class="banner warn"><div class="ic">'+PG_LEVELS[ev.level].icon+'</div><div><b>กรอบแผน: '+esc(PG_LEVELS[ev.level].label)+'</b> — '+
    esc(ev.level==='adjust' ? 'ระบบมีคำแนะนำให้ปรับแผนจากผลจริงของคุณ' : 'ผลลัพธ์ไม่เป็นไปตามกรอบของแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้อง')+
    '<div style="margin-top:6px"><button type="button" class="btn sm" data-act="pg-goto">ดูที่หน้าความคืบหน้า →</button></div></div></div>';
}

function historyHTML(p){
  var today = todayISO();
  // ประวัติจากแผนก่อนหน้า (ก่อนวันเริ่มปัจจุบัน) ยังต้องเห็นอยู่ — แสดงเฉพาะวันที่มีบันทึกจริง
  var firstDay = Object.keys(track.logs).concat([p.startDate]).sort()[0];
  var oldest = fmtDateISO(addDays(new Date(), -(track.histDays-1)));
  if(oldest < firstDay) oldest = firstDay;
  var rows = '';
  for(var d=new Date(); fmtDateISO(d) >= oldest; d=addDays(d,-1)){
    var iso = fmtDateISO(d);
    if(iso < p.startDate && !logFor(iso)) continue;
    var rep = dayReport(p, iso);
    var past = iso < today, open = track.histOpen===iso, editable = isEditable(iso);
    var status = !past ? '<span class="chip">กำลังบันทึก</span>'
      : rep.complete ? '<span class="chip ok">ครบ ✓'+(editable?'':' 🔒')+'</span>'
      : '<span class="chip miss">ไม่ครบ'+(editable?' · แก้ได้ถึงเที่ยงคืนนี้':' 🔒')+'</span>';
    var groups = REPORT_GROUPS.map(function(g){
      var its = rep.items.filter(function(x){ return x.group===g.k; });
      if(!its.length) return '';
      var n = its.filter(function(x){ return x.done; }).length;
      return '<span class="chip'+(past && n<its.length?' miss':'')+'">'+esc(g.label)+' '+n+'/'+its.length+'</span>';
    }).join('');
    if(rep.warmup && rep.warmup.total) groups += '<span class="chip" title="บันทึกไว้เป็นข้อมูล ไม่นับความครบ">Warm-up '+rep.warmup.done+'/'+rep.warmup.total+'</span>';
    if(seriousSymptoms(iso).length) groups += '<span class="chip miss">⚠️ มีอาการบาดเจ็บ</span>';
    var stH = stressOf(iso);
    if(stH) groups += '<span class="chip'+(stH.level>=4 ? ' warn' : '')+'" title="บันทึกไว้เป็นข้อมูล ไม่นับความครบ">เครียด '+stH.level+'/5</span>';
    rows += '<button type="button" class="hist-row'+(past && !rep.complete?' miss':'')+(open?' open':'')+'" data-act="hist-open" data-date="'+iso+'" aria-expanded="'+open+'">'+
      '<div class="hist-top"><span class="hist-date">'+esc(longDateTH(iso))+'</span><span>· '+dayLabelHTML(p, iso, 'พัก')+'</span>'+status+'</div>'+
      '<div class="hist-groups">'+groups+'</div></button>';
    if(open){
      rows += '<div class="log-panel"><div class="stack">'+dayPanelBody(iso)+'</div>'+
        '<div class="log-actions"><button type="button" class="btn" data-act="hist-open" data-date="'+iso+'">ปิด</button>'+
        '<span class="save-status">'+esc(track.saveStatus||'')+'</span></div></div>';
    }
  }
  var more = oldest > firstDay ? '<button type="button" class="btn ghost" data-act="hist-more" style="margin-top:10px">ดูย้อนหลังเพิ่มอีก 14 วัน</button>' : '';
  return '<div class="section-title">บันทึกรายวันย้อนหลัง</div><div class="card">'+
    '<p class="hint" style="margin-top:0">ระบบตัดบันทึกทุกเที่ยงคืน — วันนี้และเมื่อวานยังบันทึก/แก้ไขได้ (กดที่วันเพื่อเปิด) วันก่อนหน้านั้นถูกล็อกเป็นประวัติถาวร · <span class="act-miss">สีแดง</span> = ข้อมูลไม่ครบหรือไม่ถึงเป้า (แคลอรี่ผ่านเมื่ออยู่ในช่วง ±10% ของเป้า · โปรตีนและน้ำผ่านเมื่อถึง 90% ขึ้นไป)</p>'+
    '<div class="hist-list">'+rows+'</div>'+more+'</div>';
}

function renderProgress(){
  var p = track.program, t = targetsOf(p);
  var series = weightSeries();
  var first = series.length? series[0] : null;
  var last = series.length? series[series.length-1] : null;
  var startW = first ? first.kg : (p.startWeight||null);

  var html = '<div class="page-head"><div><div class="eyebrow">ตั้งแต่ '+esc(shortDateTH(p.startDate))+' · '+Math.max(0,daysBetween(p.startDate, todayISO()))+' วัน</div>'+
    '<h1>ความคืบหน้า</h1>'+
    '<div class="sub">ทุกตัวเลขในหน้านี้คำนวณจากสิ่งที่คุณบันทึกไว้จริงเท่านั้น ไม่มีค่าตัวอย่างผสม — ช่องไหนยังว่างแปลว่ายังไม่มีข้อมูลพอ</div></div>'+
    '<div class="head-actions"><button type="button" class="btn" data-act="nav" data-view="today">กลับไปเช็คลิสต์วันนี้</button></div></div>';

  html += fatAlertHTML(p) + pgSectionHTML(p) + fatBarHTML(p) + historyHTML(p);

  var deltaFirst = (last && startW!=null) ? (last.kg - startW) : null;
  var remain = (last && t.goalWeight!=null) ? (last.kg - t.goalWeight) : null;
  html += '<div class="card"><div class="stat-strip">'+
    '<div class="stat-b"><div class="l">น้ำหนักล่าสุด</div><div class="v">'+(last? fmt1(last.kg)+' <small>กก.</small>':'—')+'</div><div class="d">'+(last? esc(shortDateTH(last.date)) : 'ยังไม่ได้บันทึก')+'</div></div>'+
    '<div class="stat-b"><div class="l">เทียบวันแรกที่ชั่ง</div><div class="v">'+(deltaFirst!=null? '<span class="'+(deltaFirst>0?'up':'down')+'">'+(deltaFirst>0?'+':'')+fmt1(deltaFirst)+'</span> <small>กก.</small>':'—')+'</div>'+
      '<div class="d">'+(startW!=null? 'วันแรก '+fmt1(startW)+' กก.'+(first?' ('+shortDateTH(first.date)+')':' (จากแบบสอบถาม)') : 'ยังไม่มีค่าเริ่มต้น')+'</div></div>'+
    '<div class="stat-b"><div class="l">เหลือถึงเป้า</div><div class="v">'+(remain!=null? fmt1(Math.abs(remain))+' <small>กก.</small>':'—')+'</div>'+
      '<div class="d">'+(t.goalWeight!=null? 'เป้า '+fmt1(t.goalWeight)+' กก.' : 'ยังไม่ได้ตั้งเป้าตัวเลข (Q13)')+'</div></div>'+
    '<div class="stat-b"><div class="l">จำนวนครั้งที่ชั่ง</div><div class="v">'+series.length+'</div><div class="d">ยิ่งชั่งสม่ำเสมอ เส้นแนวโน้มยิ่งเชื่อถือได้</div></div>'+
    '</div>';

  if(series.length>=2){
    var base = parseISO(series[0].date);
    var pts = series.map(function(s){ return {x: daysBetween(series[0].date, s.date), y: s.kg, label: shortDateTH(s.date)}; });
    html += '<div class="chart-wrap">'+plotSVG(pts, {
      goal: t.goalWeight, goalLabel: t.goalWeight!=null? 'เป้าหมาย '+fmt1(t.goalWeight)+' กก.':'',
      base: startW, baseLabel: 'วันแรก '+fmt1(startW)+' กก.',
      yfmt: function(v){ return fmt1(v); },
      aria: 'กราฟน้ำหนักตัวเทียบกับเป้าหมายและน้ำหนักวันแรก'
    })+'</div>';
    html += '<p class="hint">เส้นทึบ = น้ำหนักที่บันทึกจริง · เส้นประเทา = น้ำหนักวันแรกที่ชั่ง · เส้นประส้ม = เป้าหมาย</p>';
  } else {
    html += '<p class="hint" style="margin-top:14px">ต้องชั่งอย่างน้อย 2 วันจึงจะวาดเส้นแนวโน้มได้ — บันทึกน้ำหนักได้ที่หน้า “วันนี้”</p>';
  }
  html += '</div>';

  var adh = weeklyAdherence(p, 8).filter(function(x){ return x.planned>0; });
  html += '<div class="section-title">ทำตามแผนได้กี่ % ต่อสัปดาห์</div><div class="card">';
  if(adh.length){
    var avg = Math.round(adh.reduce(function(s,x){return s+x.pct;},0)/adh.length);
    html += '<div class="prog-top"><h3 style="font-size:14px;color:var(--text-2);font-weight:500">ค่าเฉลี่ย '+adh.length+' สัปดาห์ที่ผ่านมา</h3><span class="n mono">'+avg+'%</span></div>';
    html += '<div class="bars">'+adh.map(function(x){
      return '<div class="bar'+(x.pct>=80?' hi':'')+'"><span class="bv mono">'+x.pct+'%</span>'+
        '<span class="b" style="height:'+Math.max(3, x.pct*1.05)+'px"></span>'+
        '<span class="bl mono">'+esc(shortDateTH(x.start))+'</span></div>';
    }).join('')+'</div>';
    html += '<p class="hint" style="margin-top:10px">นับจากวันฝึกที่ติ๊ก “ทำเซสชันนี้ครบแล้ว” หารด้วยวันฝึกทั้งหมดในสัปดาห์นั้น (ไม่รวมวันในอนาคต)</p>';
  } else {
    html += '<p class="hint">ยังไม่มีวันฝึกที่ผ่านมาให้คำนวณ — ตัวเลขจะขึ้นหลังผ่านวันฝึกวันแรก</p>';
  }
  html += '</div>';

  var allEx = [];
  (p.sessions||[]).forEach(function(s){ s.exercises.forEach(function(e){ if(!allEx.filter(function(x){return x.id===e.id;}).length) allEx.push(e); }); });
  var cur = track.progressEx && allEx.filter(function(e){return e.id===track.progressEx;}).length ? track.progressEx : (allEx[0]? allEx[0].id : null);
  html += '<div class="section-title">Progression การยกน้ำหนักรายท่า</div><div class="card">';
  if(!allEx.length){
    html += '<p class="hint">แผนนี้ยังไม่มีท่าให้ติดตาม</p>';
  } else {
    html += '<div class="picker">'+allEx.map(function(e){
      return '<button type="button" class="'+(e.id===cur?'on':'')+'" data-act="progress-ex" data-ex="'+esc(e.id)+'">'+esc(e.th)+'</button>';
    }).join('')+'</div>';
    var hist = exerciseHistory(cur);
    var exDef = allEx.filter(function(e){return e.id===cur;})[0];
    html += strengthSummaryHTML(exDef, hist); // PART 16 — เพิ่มสรุป ไม่แทนที่กราฟ/ตารางเดิม
    if(hist.length>=2){
      var pts2 = hist.map(function(hh,i){ return {x: daysBetween(hist[0].date, hh.date), y: hh.e1rm, label: shortDateTH(hh.date)}; });
      html += '<div class="chart-wrap">'+plotSVG(pts2, {h:200, yfmt:function(v){return Math.round(v)+' กก.';}, aria:'กราฟความแข็งแรงโดยประมาณของท่า '+exDef.th})+'</div>';
      var d0 = hist[0].e1rm, d1 = hist[hist.length-1].e1rm;
      html += '<p class="hint">แกนตั้ง = ความแข็งแรงโดยประมาณ (e1RM = น้ำหนัก × (1 + ครั้ง/30) สูตร Epley) จากเซ็ตที่ดีที่สุดของแต่ละวัน — เปลี่ยนแปลง '+(d1>=d0?'+':'')+fmt1(d1-d0)+' กก. จากครั้งแรกที่บันทึก</p>';
    } else if(hist.length===1){
      html += '<p class="hint" style="margin-top:12px">มีข้อมูลวันเดียว ('+esc(shortDateTH(hist[0].date))+' — '+hist[0].weight+' กก. × '+(hist[0].reps||'?')+' ครั้ง) ต้องบันทึกอย่างน้อย 2 วันจึงจะเห็นแนวโน้ม</p>';
    } else {
      html += '<p class="hint" style="margin-top:12px">ยังไม่มีบันทึกน้ำหนักต่อเซ็ตของท่านี้ — เปิด “บันทึกน้ำหนัก/ครั้งต่อเซ็ต” ในหน้าวันนี้เพื่อเริ่มเก็บข้อมูล</p>';
    }
    if(hist.length){
      html += '<table class="logtab"><thead><tr><th>วันที่</th><th>เซ็ตที่ดีที่สุด</th><th>e1RM</th><th>ปริมาตรรวม</th></tr></thead><tbody>'+
        hist.slice(-8).reverse().map(function(hh){
          return '<tr><td>'+esc(shortDateTH(hh.date))+'</td><td>'+hh.weight+' กก.'+(hh.reps!=null?' × '+hh.reps:'')+'</td><td>'+fmt1(hh.e1rm)+' กก.</td><td>'+(hh.volume||0).toLocaleString()+' กก.</td></tr>';
        }).join('')+'</tbody></table>';
    }
  }
  html += '</div>';

  html += '<div class="section-title">Milestone</div><div class="card">'+
    '<div class="ms-grid">'+milestonesOf(p).map(function(m){
      return '<div class="ms'+(m.on?' on':'')+'"><span class="ic">'+(m.on?'✓':'·')+'</span>'+
        '<div><div class="mt">'+esc(m.t)+'</div><div class="msub mono">'+esc(m.on?'ปลดล็อกแล้ว':m.sub)+'</div></div></div>';
    }).join('')+'</div>'+
    '<p class="hint" style="margin-top:12px">เงื่อนไขทุกข้อผูกกับข้อมูลจริงในระบบ ไม่มีการปลดล็อกให้ล่วงหน้า</p></div>';

  document.getElementById("page").innerHTML = html;
}

/* ---------- หน้า: ถามโค้ช (เรียก /api/coach — Cloudflare Pages Function) ----------
   ต้อง login แล้วเท่านั้น (ดู currentView()/renderNav()) เพราะ backend ต้องมี access
   token ไปยืนยันตัวตน + เช็คโควตารายวัน ประวัติแชทเก็บแค่ใน session นี้เท่านั้น (ไม่
   persist ลง localStorage/Supabase — เป็น scope ของ MVP รอบแรก) */
/* apiUrl: ที่อยู่จริงของ Cloudflare Pages Functions (/api/*)
   บนเว็บ = path สัมพัทธ์เหมือนเดิม (same-origin กับ Pages ที่ deploy อยู่)
   บนแอป native = ต้องเติมโดเมนเต็ม เพราะหน้าเว็บในแอปถูกเสิร์ฟจาก https://localhost โดย
   static server ในเครื่องของ Capacitor เอง — fetch('/api/xxx') จึงวิ่งไปหา server ตัวนั้น
   ซึ่ง "ตอบ 200 พร้อม index.html" กลับมา (SPA fallback) ไม่ใช่ 404 ด้วยซ้ำ
   นี่คือต้นตอจริงของบั๊ก "กดลบบัญชีแล้วขึ้นว่าสำเร็จ แต่ข้อมูลไม่หายจาก Supabase":
   โค้ดเดิมเช็คแค่ res.ok เห็น 200 เลยเข้าใจว่าลบสำเร็จ ทั้งที่คำขอไม่เคยออกจากเครื่องเลย
   (ฟีเจอร์ถามโค้ชก็พังด้วยเหตุผลเดียวกันเป๊ะ) — ฝั่ง server เปิด CORS ให้ origin ของ
   Capacitor ไว้แล้วใน functions/api/*.js */
var API_ORIGIN = 'https://gymbro-daily.pages.dev';
function isNativeApp(){
  return typeof window.Capacitor !== 'undefined' &&
         !!window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform();
}
function apiUrl(path){ return (isNativeApp() ? API_ORIGIN : '') + path; }

var coachState = {messages:[], busy:false, error:null};
var COACH_MAX_PER_DAY = 20; // ต้องตรงกับ MAX_QUESTIONS_PER_DAY ใน functions/api/coach.js เสมอ — แค่ไว้โชว์ผู้ใช้

function renderCoach(){
  var html = '<div class="page-head"><div><div class="eyebrow">ถามได้ทุกเรื่องเกี่ยวกับ Gymbro Daily</div><h1>ถามโค้ช</h1>'+
    '<div class="sub">โค้ชตอบจากข้อมูลที่แอปมีจริงเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ — จำกัด '+COACH_MAX_PER_DAY+' คำถาม/วัน</div></div></div>';

  html += '<div class="card coach-log">';
  if(!coachState.messages.length){
    html += '<p class="hint">ลองถามเช่น "ทำไมปุ่มเริ่มโปรแกรมกดไม่ได้" หรือ "ทำไมท่าออกกำลังกายบางท่าเป็นชื่อภาษาอังกฤษ"</p>';
  }
  coachState.messages.forEach(function(m){
    html += '<div class="coach-msg '+esc(m.role)+'"><div class="coach-bubble">'+esc(m.text)+'</div></div>';
  });
  if(coachState.busy){
    html += '<div class="coach-msg assistant"><div class="coach-bubble">กำลังพิมพ์...</div></div>';
  }
  html += '</div>';

  if(coachState.error){
    html += '<div class="note warn" style="margin-top:10px"><p>'+esc(coachState.error)+'</p></div>';
  }

  html += '<div class="coach-input-row">'+
    '<input type="text" id="coachInput" placeholder="พิมพ์คำถาม..." maxlength="500" '+(coachState.busy?'disabled':'')+'>'+
    '<button type="button" class="btn primary" data-act="coach-ask" '+(coachState.busy?'disabled':'')+'>ถาม</button>'+
  '</div>';

  document.getElementById("page").innerHTML = html;
  var input = document.getElementById('coachInput');
  if(input) input.focus();
}

function coachAsk(){
  var input = document.getElementById('coachInput');
  var q = input ? input.value.trim() : '';
  if(!q || coachState.busy) return;
  coachState.messages.push({role:'user', text:q});
  coachState.busy = true; coachState.error = null;
  render();
  var token = (auth.session && auth.session.access_token) || '';
  fetch(apiUrl('/api/coach'), {
    method: 'POST',
    headers: {'content-type':'application/json', 'Authorization':'Bearer '+token},
    body: JSON.stringify({question:q})
  }).then(function(res){
    return res.json().catch(function(){ return null; }).then(function(data){ return {ok:res.ok, data:data}; });
  }).then(function(r){
    coachState.busy = false;
    // ตอบกลับต้องเป็น JSON จริงเท่านั้น — ถ้าแกะ JSON ไม่ออก (data===null) แปลว่าไปโดน
    // อย่างอื่นที่ไม่ใช่ API ของเรา (เช่น index.html) ต่อให้ status เป็น 200 ก็ห้ามนับว่าสำเร็จ
    if(r.ok && r.data && typeof r.data.answer === 'string') coachState.messages.push({role:'assistant', text:r.data.answer||'(ไม่มีคำตอบ)'});
    else coachState.error = (r.data && r.data.error) || 'เชื่อมต่อระบบไม่สำเร็จ ลองใหม่อีกครั้ง';
    render();
  }).catch(function(e){
    coachState.busy = false;
    coachState.error = 'เชื่อมต่อไม่สำเร็จ: '+(e && e.message ? e.message : e);
    render();
  });
}

/* ---------- หน้า: แผนของฉัน ---------- */
/* วันว่างของโปรแกรมที่เริ่มแล้ว — แผนที่สร้างก่อนมีระบบเลือกวันไม่มี availableDays ใช้คำตอบ Q2 แทน */
function progAvailDays(p){
  var avail = (p.availableDays && p.availableDays.length) ? p.availableDays : (state.answers.Q2 || []);
  return DAYS.filter(function(d){ return avail.indexOf(d)>-1 || (p.days||[]).indexOf(d)>-1; });
}
function schedLists(ctx){
  if(ctx==='prog'){ var dr = track.schedDraft; return {train:dr.days, cardio:dr.cardioDays, mins:dr.cardioMinByDay}; }
  return {train:planTrainDays(state.answers), cardio:planCardioDays(state.answers), mins:state.plan.cardioMinByDay};
}
function setSchedLists(ctx, train, cardio){
  var byWeek = function(list){ return DAYS.filter(function(d){ return list.indexOf(d)>-1; }); };
  if(ctx==='prog'){ track.schedDraft.days = byWeek(train); track.schedDraft.cardioDays = byWeek(cardio); render(); return; }
  state.plan.trainDays = byWeek(train); state.plan.cardioDays = byWeek(cardio);
  persist(); render();
}
function openSchedDraft(){
  var p = track.program, mins = {};
  (p.cardioDays||[]).forEach(function(d){ mins[d] = cardioMinFor(p, d); });
  track.schedDraft = {days:(p.days||[]).slice(), cardioDays:(p.cardioDays||[]).slice(), cardioMinByDay:mins};
  track.saveStatus = '';
}
/* ปรับวันของโปรแกรมที่ใช้อยู่ โดยท่า/เป้าหมายเดิมไม่เปลี่ยน — วันที่ล็อกแล้วมี snapshot ของตัวเองจึงไม่กระทบประวัติ */
function saveSchedDraft(){
  var p = track.program, dr = track.schedDraft, avail = progAvailDays(p);
  var need = minTrainDays(p.splitKey, {Q2:avail});
  if(dr.days.length < need){
    track.saveStatus = 'ยังบันทึกไม่ได้ — '+(p.splitLabel||'')+' ต้องมีวันฝึกอย่างน้อย '+need+' วัน/สัปดาห์';
    render(); return;
  }
  var sch = bestSchedule(p.sessions||[], dr.days);
  if(sch.hard){
    track.saveStatus = 'ยังบันทึกไม่ได้ — '+clashText(sch.clash)+' กล้ามเนื้อต้องพัก ~48 ชม. เอาวันใดวันหนึ่งออกก่อน';
    render(); return;
  }
  var next = {};
  Object.keys(p).forEach(function(k){ next[k] = p[k]; });
  next.days = dr.days.slice();
  next.dayToSession = {};
  sch.list.forEach(function(x){ next.dayToSession[x.day] = x.session; });
  next.cardioDays = dr.cardioDays.slice();
  next.cardioMinByDay = minsForDays(dr.cardioMinByDay, next.cardioDays);
  next.availableDays = avail;
  track.program = next;
  var ok = persistProgram();
  state.plan.trainDays = next.days.slice();
  state.plan.cardioDays = next.cardioDays.slice();
  state.plan.cardioMinByDay = minsForDays(next.cardioMinByDay, next.cardioDays);
  persist();
  track.schedDraft = null;
  track.saveStatus = ok ? 'บันทึกวันฝึกแล้ว ✓' : 'บันทึกไม่ได้ — พื้นที่จัดเก็บของเบราว์เซอร์ใช้ไม่ได้ตอนนี้';
  render();
}
function schedEditorPanelHTML(){
  var p = track.program, dr = track.schedDraft;
  if(!dr) return '';
  return '<div class="setup-panel"><h3>เลือกวันฝึกและวัน cardio</h3>'+
    '<p>วันว่างคือวันที่ “เลือกได้” — กดเลือกเฉพาะวันที่จะเล่นจริง ท่าออกกำลังกายและเป้าหมายเดิมไม่เปลี่ยน วันที่ถูกล็อกเป็นประวัติแล้วไม่ได้รับผลกระทบ</p>'+
    scheduleEditorHTML('prog', p.splitKey, progAvailDays(p), dr.days, dr.cardioDays, dr.cardioMinByDay, p.minutesEstimate||'', p.sessions||[])+
    '<div class="setup-row" style="margin-top:12px"><button type="button" class="btn primary" data-act="sched-save">บันทึกวันฝึก</button>'+
    '<button type="button" class="btn ghost" data-act="sched-cancel">ยกเลิก</button>'+
    '<span class="save-status">'+esc(track.saveStatus||'')+'</span></div></div>';
}
/* ตารางที่ใช้อยู่จริง (ตาม dayToSession) มีวันติดกันที่ฝึกกล้ามเนื้อกลุ่มเดียวกันหรือไม่ — แผนเก่าก่อนมีระบบนี้อาจมี */
function programClash(p){
  var days = weekOrder(p.days), out = null;
  adjacentPairs(days).some(function(pr){
    var a = sessionDefFor(p, p.dayToSession[days[pr[0]]]), b = sessionDefFor(p, p.dayToSession[days[pr[1]]]);
    var g = (a && b) ? sharedGroups(sessionGroups(a, false), sessionGroups(b, false)) : [];
    if(g.length) out = {from:days[pr[0]], to:days[pr[1]], groups:g};
    return !!out;
  });
  return out;
}
function scheduleClashBanner(p){
  if(!p.availableDays || track.schedDraft) return ''; // แผนเก่ามาก ๆ มี oldScheduleBanner ให้เลือกวันอยู่แล้ว
  var c = programClash(p);
  if(!c) return '';
  return '<div class="banner warn"><div class="ic">⚠️</div><div>ตารางตอนนี้ทำให้<b>'+esc(clashText(c))+'</b> — กล้ามเนื้อควรพัก ~48 ชม. ก่อนฝึกซ้ำ '+
    '<button type="button" class="linkbtn" data-act="sched-edit-go">ปรับวันฝึก →</button></div></div>';
}
function oldScheduleBanner(p){
  if(p.availableDays || track.schedDraft) return '';
  return '<div class="banner warn"><div class="ic">⚠️</div><div>แผนนี้สร้างก่อนมีระบบเลือกวัน — ตอนนี้ <b>ทุกวันที่ว่างยังถูกนับเป็นวันฝึก</b> '+
    '<button type="button" class="linkbtn" data-act="sched-edit-go">เลือกวันที่จะเล่นจริง และวัน cardio →</button></div></div>';
}

function renderPlan(){
  var p = track.program, t = targetsOf(p);
  var pKcal = t.proteinG*4, fKcal = t.fatG*9, cKcal = t.carbG*4, tot = pKcal+fKcal+cKcal;
  var pPct = Math.round(pKcal/tot*100), fPct = Math.round(fKcal/tot*100), cPct = 100-pPct-fPct;

  var html = '<div class="page-head"><div><div class="eyebrow">โปรแกรมที่กำลังติดตาม</div><h1>แผนของฉัน</h1>'+
    '<div class="sub">แผนนี้ถูกล็อกไว้ตั้งแต่วันที่กด “เริ่มโปรแกรม” เพื่อไม่ให้ประวัติที่บันทึกไปแล้วเปลี่ยนความหมายย้อนหลัง — แก้ได้โดยกดปุ่มด้านขวา</div></div>'+
    '<div class="head-actions">'+
      '<button type="button" class="btn" data-act="sched-edit">ปรับวันฝึก / วัน cardio</button>'+
      '<button type="button" class="btn" data-act="edit-plan">แก้ไขแผน / ทำแบบสอบถามใหม่</button>'+
      '<button type="button" class="btn" data-act="edit-start">ตั้งวันเริ่มใหม่</button>'+
    '</div></div>';
  html += oldScheduleBanner(p) + scheduleClashBanner(p) + planUpdateBanner(p) + schedEditorPanelHTML();
  if(!track.schedDraft && track.saveStatus==='บันทึกวันฝึกแล้ว ✓') html += '<div class="banner info"><div class="ic">✓</div><div>บันทึกวันฝึกแล้ว</div></div>';

  if(track.editing){
    html += renderStartSetup();
  }

  html += '<div class="card"><div class="stat-grid">'+
    '<div class="stat-tile"><div class="l">รูปแบบโปรแกรม</div><div class="v" style="font-size:17px">'+esc(p.splitLabel)+'</div><span class="pill">'+(p.days||[]).length+' วัน/สัปดาห์</span></div>'+
    '<div class="stat-tile"><div class="l">วันเริ่มโปรแกรม</div><div class="v" style="font-size:17px">'+esc(shortDateTH(p.startDate))+'</div><span class="pill">'+Math.max(0,daysBetween(p.startDate, todayISO()))+' วันที่ผ่านมา</span></div>'+
    '<div class="stat-tile"><div class="l">TDEE โดยประมาณ</div><div class="v">'+fmtKcal(t.tdee)+' <small>kcal/วัน</small></div></div>'+
    '<div class="stat-tile"><div class="l">เป้าแคลอรี่ต่อวัน</div><div class="v">'+fmtKcal(t.kcal)+' <small>kcal</small></div><span class="pill">'+esc(t.kcalDirection)+'</span>'+
      (t.kcalFloored?'<span class="pill" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line)">ปรับขึ้นถึงขั้นต่ำ</span>':'')+'</div>'+
    '</div>'+
    '<div class="stat-tile"><div class="l">สัดส่วนมาโครที่แนะนำ</div>'+
      '<div class="macro-bar"><span style="width:'+pPct+'%; background:var(--accent);"></span><span style="width:'+fPct+'%; background:var(--sleep);"></span><span style="width:'+cPct+'%; background:var(--branch);"></span></div>'+
      '<div class="macro-legend"><span><i style="background:var(--accent)"></i>โปรตีน '+t.proteinG+'g ('+pPct+'%)</span>'+
      '<span><i style="background:var(--sleep)"></i>ไขมัน '+t.fatG+'g ('+fPct+'%)</span>'+
      '<span><i style="background:var(--branch)"></i>คาร์บ '+t.carbG+'g ('+cPct+'%)</span></div>'+
      (t.macroClamped?'<div class="opt-note">⚠️ ปรับสัดส่วนอัตโนมัติเพราะโปรตีน+ไขมันตั้งต้นเกินเป้าแคลอรี่ — เคสนี้ควรปรึกษาผู้เชี่ยวชาญเพิ่มเติม</div>':'')+
      '<div class="opt-note" style="margin-top:8px">น้ำ '+fmt1(t.waterL)+' ลิตร/วัน · '+t.meals+' มื้อ/วัน · นอน '+fmtHours(t.sleepH)+'/คืน</div>'+
    '</div></div>';

  html += '<div class="section-title">เซสชันในแผน</div>' + coverageHTML(programCoverage(p), '');
  html += (p.sessions||[]).map(function(se){
    var daysFor = (p.days||[]).filter(function(d){ return p.dayToSession[d]===se.key; });
    return '<div class="session-heading">เซสชัน “'+esc(se.key)+'” <span class="sh-sub">'+daysFor.length+'x/สัปดาห์ — '+esc(daysFor.join(', ')||'—')+' · ~'+esc(p.minutesEstimate)+'</span></div>'+
      '<div class="exercise-list">'+se.exercises.map(function(ex){
        return '<div class="ex-row"><div class="ex-row-top"><div>'+
          '<div class="ex-pattern">'+esc(PATTERN_LABEL[ex.pattern]||ex.pattern)+'</div>'+
          '<div class="ex-name">'+esc(ex.th)+' '+tierBadge(ex.tier)+(isIntense(ex)?' <span class="chip miss">เข้มข้น</span>':'')+'</div>'+
          '<div class="ex-sub">'+esc(ex.sub||'')+'</div>'+
          '<div class="rest-line">พักระหว่างเซ็ต '+restFor(ex).set+' · ก่อนเปลี่ยนท่า '+restFor(ex).next+'</div>'+
          (isIntense(ex) ? '<div class="int-warn">⚠️ '+esc(INTENSE_WARNING)+'</div>' : '')+'</div>'+
          '<div class="ex-meta"><span class="ex-sets mono">'+esc(ex.setsReps)+'</span></div></div></div>';
      }).join('')+'</div>';
  }).join('');
  if((p.cardioDays||[]).length){
    html += '<div class="session-heading">Cardio <span class="sh-sub">'+p.cardioDays.length+'x/สัปดาห์ — '+
      esc(p.cardioDays.map(function(d){ return d+' '+cardioMinFor(p, d)+' นาที'; }).join(', '))+'</span></div>';
  }

  html += '<div class="disclaimer-block"><h3>สิ่งที่ต้องรู้ก่อนใช้จริง</h3><ul>'+
    '<li>ตัวเลข sets/reps, tier ของท่า และเกณฑ์แคลอรี่/มาโคร/น้ำ/การนอนทั้งหมดเป็น <b>placeholder</b> ที่ยังไม่ผ่านการ review จากเทรนเนอร์/นักโภชนาการตัวจริง</li>'+
    '<li>ฐานข้อมูลท่าออกกำลังกายเป็นชุดตัวอย่างอ้างอิงแนวคิดจาก wger.de ยังไม่ใช่ exercise database ระดับ production</li>'+
    '<li>ตารางยังหมุนวนซ้ำทุกสัปดาห์แบบเดิม ยังไม่มี mesocycle / progressive overload อัตโนมัติ — ระบบยัง<b>ไม่แนะนำ</b>ว่าควรเพิ่มน้ำหนักเมื่อไหร่ หน้า Progression แสดงข้อมูลย้อนหลังอย่างเดียว</li>'+
    '<li>เป้าแคลอรี่ใช้ static multiplier จากลักษณะงาน (Q36) ไม่ได้บวกแคลอรี่จากเซสชันที่ทำจริง</li>'+
    '<li>ข้อมูลทั้งหมดเก็บไว้ใน localStorage ของเบราว์เซอร์เครื่องนี้เท่านั้น — ล้างแคช/เปลี่ยนเครื่อง/เปิดโหมดไม่ระบุตัวตนจะไม่เห็นข้อมูลเดิม และยังไม่มีระบบซิงก์ข้ามอุปกรณ์หรือบัญชีผู้ใช้</li>'+
    '<li>รองรับหน่วย kg/cm เท่านั้น และรองรับ 4 เป้าหมาย (ลดไขมัน / เพิ่มกล้ามเนื้อ / Recomposition / รักษาสุขภาพทั่วไป) เฉพาะสถานที่ "ฟิตเนส-ยิม" หรือ "ที่บ้าน"</li>'+
    '<li>นี่คือต้นแบบสาธิต ไม่ใช่คำแนะนำทางการแพทย์หรือโภชนาการ หากมีอาการผิดปกติระหว่างออกกำลังกาย ควรหยุดและปรึกษาแพทย์ทันที</li>'+
  '</ul></div>';

  document.getElementById("page").innerHTML = html;
}

function renderStartSetup(){
  var prev = track.program ? track.program.startDate : todayISO();
  return '<div class="setup-panel"><h3>ตั้งวันเริ่มโปรแกรม</h3>'+
    '<p>ระบบจะผูกเซสชันเข้ากับวันในสัปดาห์ตามวันที่คุณเลือกไว้ แล้วนับต่อเนื่องจากวันเริ่มนี้ — ถ้าเปลี่ยนวันเริ่ม บันทึกเก่ายังอยู่ครบ แต่การนับสตรีค/% ทำตามแผนจะเริ่มจากวันใหม่</p>'+
    '<div class="setup-row"><label for="startDateInput">วันเริ่มโปรแกรม</label>'+
    '<input type="date" id="startDateInput" data-fkey="startDate" value="'+esc(prev)+'"></div>'+
    '<div class="setup-row"><button type="button" class="btn primary" data-act="save-start">บันทึกวันเริ่ม</button>'+
    (track.program? '<button type="button" class="btn ghost" data-act="cancel-start">ยกเลิก</button>':'')+
    '<span class="save-status">'+esc(track.saveStatus||'')+'</span></div></div>';
}
/* ============================================================
   ONBOARDING (แบบสอบถาม 9 หมวด → สรุป → แผน → กดเริ่มโปรแกรม)
   ============================================================ */
function benchTable(goal){
  var rows="";
  Object.keys(BENCH).forEach(function(g){
    rows += '<tr class="'+(g===goal?"hit":"")+'"><td>'+esc(g)+'</td><td>'+esc(BENCH[g].label)+'</td></tr>';
  });
  return '<div class="note"><span class="eyebrow2">ข้อความอัตโนมัติจากระบบ (ไม่ใช่คำถาม)</span>'+
    '<table class="bench"><thead><tr><th>เป้าหมาย</th><th>แนะนำ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
/* เตือนความเป็นไปได้ของแต่ละเป้าหมายเทียบกับวัน/เวลาที่ตอบไว้ใน Q2/Q3 — แสดง "ก่อน" เลือก
   Q1 เพราะตอนนี้ Q2/Q3 อยู่ก่อน Q1 แล้ว (ดูหมายเหตุที่ประกาศ QUESTIONS) ไม่บล็อกตัวเลือกใดๆ
   แค่ให้ข้อมูลประกอบ — ยังเลือกเป้าหมายที่ "เวลาไม่พอ" ได้ปกติ เพราะ timeFeedback()
   จัดการ fallback ให้อยู่แล้ว (ปรับความเข้มข้นให้เหมาะกับเวลาที่มีแทน ไม่ใช่ปฏิเสธ) */
function goalFeasibilityHint(a){
  var days = a.Q2, t = a.Q3;
  if(!days || !days.length || !t) return ""; // ยังตอบ Q2/Q3 ไม่ครบ ยังเดาไม่ได้ ไม่แสดงอะไรเดา
  var est = Q3_MIN[t]||0, rows = "";
  Object.keys(BENCH).forEach(function(g){
    var b = BENCH[g], ok = days.length>=b.days[0] && est>=b.mins[0];
    rows += '<tr><td>'+esc(g)+'</td><td>'+esc(b.label)+'</td><td>'+
      (ok ? '<span class="chip ok">พอเวลา</span>' : '<span class="chip">เวลาน้อยกว่าที่แนะนำ</span>')+'</td></tr>';
  });
  return '<div class="note"><span class="eyebrow2">เทียบกับวัน/เวลาที่ตอบไว้ (เลือกได้ทุกเป้าหมาย — เวลาไม่พอระบบจะปรับความเข้มข้นให้แทน ไม่ปิดกั้น)</span>'+
    '<table class="bench"><thead><tr><th>เป้าหมาย</th><th>แนะนำ</th><th>สถานะ</th></tr></thead><tbody>'+rows+'</tbody></table></div>';
}
/* ตัวเลือกรูปร่าง/ระดับไขมันร่างกายด้วยภาพ (Q0) — เก็บไว้ที่ bodyfat/bf-<male|female>-
   <key>.png ที่ root โปรเจกต์ (ใช้ได้ทั้งเว็บที่ deploy จริงและแอป native) ช่วง % เดียวกัน
   ทั้งสองเพศ ตั้งใจใช้ตัวเลขตรงไปตรงมา (ไม่ใส่ชื่อหมวดแบบ "นักกีฬา/ฟิต" เพราะคำเหล่านั้น
   สื่อเกินจริง — ไขมันน้อยไม่ได้แปลว่าเป็นนักกีฬาเสมอไป) — ต้องกำกับว่าเป็น "ภาพประกอบ
   คร่าวๆ" เสมอ ไม่ใช่เครื่องมือวัดจริง (สอดคล้องกับวินัยความซื่อสัตย์ของแอปทั้งระบบ —
   ดู CLAUDE.md) เป็นคำถามที่ไม่บังคับตอบ (ดู catComplete — kind "bodyfat" ไม่เข้าเงื่อนไข
   ที่บล็อกการกดถัดไป) เพราะเป็นแค่ตัวช่วยแนะนำ ไม่ใช่ข้อมูลที่ต้องมีถึงจะสร้างแผนได้ */
/* จำนวนเฟรมของภาพหมุน 360° ต่อ 1 ร่าง — ต้องตรงกับ FRAMES ใน
   mobile/scripts/bodyfat-renders/render_spin.py เสมอ (เฟรม 00 = ด้านหน้าตรง
   แล้วหมุนทีละ 360/FRAMES องศาจนครบรอบ) ถ้าแก้ที่ไฟล์ใดไฟล์หนึ่งต้องแก้อีกไฟล์ด้วย */
var BODYFAT_SPIN_FRAMES = 24;

var BODYFAT_BANDS = [
  {key:"05-09", pct:"5-9%"},
  {key:"10-14", pct:"10-14%"},
  {key:"15-19", pct:"15-19%"},
  {key:"20-24", pct:"20-24%"},
  {key:"25-29", pct:"25-29%"},
  {key:"30-35", pct:"30-35%"}
];
/* แนะนำเป้าหมายคร่าวๆ จากรูปร่างที่เลือก — ไขมันน้อยมากเน้นสร้างกล้ามได้เต็มที่, กลางๆ
   เหมาะกับ recomposition (ลด+เพิ่มพร้อมกัน), สูงเน้นลดไขมันก่อน — เป็นแค่จุดเริ่มต้น
   ให้เลือกตาม ไม่ใช่กติกาตายตัว ผู้ใช้เปลี่ยนเป็นเป้าหมายอื่นที่ Q1 ได้เสมอไม่ถูกปิดกั้น */
var BODYFAT_GOAL_MAP = {
  "05-09": "เพิ่มกล้ามเนื้อ",
  "10-14": "เพิ่มกล้ามเนื้อ",
  "15-19": "Recomposition (ลด+เพิ่มพร้อมกัน)",
  "20-24": "Recomposition (ลด+เพิ่มพร้อมกัน)",
  "25-29": "ลดไขมัน",
  "30-35": "ลดไขมัน"
};
function bodyFatPickerHTML(q, a){
  var sex = a.Q9;
  if(sex!=="ชาย" && sex!=="หญิง"){
    return '<div class="hint" style="margin:10px 0 14px">ตอบคำถาม "เพศ" ด้านบนก่อน ระบบจะเลือกภาพให้ตรงกับคุณ</div>';
  }
  var folder = sex==="ชาย" ? "male" : "female";
  var cards = BODYFAT_BANDS.map(function(b){
    var sel = a[q.id]===b.key;
    /* ปุ่มเลือก กับ ปุ่มเปิดภาพหมุน 360° ต้องเป็น <button> พี่น้องกันใน .bf-cell ห้ามซ้อนกัน
       (button ซ้อน button เป็น HTML ที่ไม่ถูกต้อง เบราว์เซอร์จะแยกแท็กออกจากกันเอง)
       — closest('[data-act]') ที่ตัวจัดการคลิกใช้ จึงหยิบปุ่มที่ถูกกดจริงได้ถูกตัวเสมอ */
    return '<div class="bf-cell">'+
      '<button type="button" class="bf-card'+(sel?" sel":"")+'" data-act="opt" data-qid="'+q.id+'" data-kind="single" data-val="'+b.key+'">'+
        '<img src="bodyfat/bf-'+folder+'-'+b.key+'.png" alt="'+esc(b.pct)+'" loading="lazy">'+
        '<div class="bf-card-label mono">'+esc(b.pct)+'</div></button>'+
      '<button type="button" class="bf-spin-btn" data-act="bf-spin" data-sex="'+folder+'" data-band="'+b.key+'" '+
        'aria-label="หมุนดูรอบตัว 360 องศา ระดับ '+esc(b.pct)+'">⟳ 360°</button>'+
      '</div>';
  }).join('');
  return '<div class="bf-ref">'+
    '<div class="hint" style="margin-bottom:8px">แตะรูปร่างที่ใกล้เคียงกับคุณตอนนี้มากที่สุด ระบบจะแนะนำเป้าหมายเบื้องต้นให้ (เปลี่ยนภายหลังได้เสมอ ไม่ผูกมัด) — รูปร่างจริงอาจต่างกันแม้เปอร์เซ็นต์เท่ากัน ไม่ใช่เครื่องมือวัดที่แม่นยำ ข้ามข้อนี้ได้ถ้าไม่อยากตอบ</div>'+
    '<div class="bf-grid">'+cards+'</div></div>';
}
function timeFeedback(a){
  var goal=a.Q1, days=a.Q2, t=a.Q3;
  if(!goal || !days || !t || !BENCH[goal]) return "";
  var b=BENCH[goal], est = Q3_MIN[t]||0;
  if(days.length < b.days[0] || est < b.mins[0]){
    return '<div class="note warn"><span class="eyebrow2">ข้อความอัตโนมัติจากระบบ</span>'+
      '<p>เวลาที่มีน้อยกว่าที่แนะนำ ระบบจะปรับความเข้มข้นให้เหมาะกับเวลาที่มีแทน</p></div>';
  }
  return "";
}
function renderQuestion(q){
  var a = state.answers;
  var badge = q.main ? '<span class="badge main">คำถามหลัก</span>' : '<span class="badge branch">แตกกิ่ง · '+esc(q.branchFrom)+'</span>';
  var body = '<div class="q-block">'+
    '<div class="q-top"><span class="q-id mono">'+q.id+'</span>'+badge+'</div>'+
    '<div class="q-label">'+esc(q.label)+'</div>';
  if(q.id==="Q1") body += goalFeasibilityHint(a);
  if(q.kind==="bodyfat") body += bodyFatPickerHTML(q, a);
  if(q.kind==="single" || q.kind==="multi"){
    body += '<div class="opts">';
    q.options.forEach(function(o){
      var sel = q.kind==="multi" ? (Array.isArray(a[q.id]) && a[q.id].indexOf(o)>-1) : a[q.id]===o;
      // แนะนำจากรูปร่างที่เลือกไว้ที่ Q0 (ถ้ามี) — เฉพาะที่ Q1 (เป้าหมาย) เท่านั้น
      var recommended = q.id==="Q1" && a.Q0 && BODYFAT_GOAL_MAP[a.Q0]===o;
      body += '<button type="button" class="opt'+(sel?" sel":"")+(recommended?" recommended":"")+'" data-act="opt" data-qid="'+q.id+'" data-kind="'+q.kind+'" data-val="'+esc(o)+'">'+esc(o)+
        (recommended ? ' <span class="chip ok">แนะนำ</span>' : '') +
        '</button>';
    });
    body += '</div>';
    if(q.note) body += '<div class="opt-note">'+esc(q.note)+'</div>';
  } else if(q.kind==="number"){
    var missingReq = q.required && !numberAnswered(a[q.id]);
    body += '<div class="field-row"><input type="number" inputmode="decimal" data-act="field" data-fid="'+q.id+'" data-fkey="q-'+q.id+'" value="'+num(a[q.id])+'" placeholder="กรอกตัวเลข">'+(q.unit?'<span class="unit">'+esc(q.unit)+'</span>':"")+'</div>'+
      (missingReq ? '<div class="hint" style="color:var(--warn);margin-top:4px">* จำเป็นต้องกรอกก่อนไปข้อถัดไป</div>' : '');
  } else if(q.kind==="text"){
    body += '<div class="field-row"><input type="text" class="wide" data-act="field" data-fid="'+q.id+'" data-fkey="q-'+q.id+'" value="'+num(a[q.id])+'" placeholder="พิมพ์คำตอบ (ไม่บังคับ)"></div>';
  }
  if(q.id==="Q1" && a.Q1){
    body += benchTable(a.Q1);
    if(SUPPORTED_GOALS.indexOf(a.Q1)===-1){
      // N-03: แจ้งข้อจำกัด MVP ทันทีที่เลือก ไม่ปล่อยให้ตอบจนจบ 9 หมวดแล้วเพิ่งไปเจอที่หน้าสรุป
      body += '<div class="note warn"><span class="eyebrow2">ข้อจำกัดของต้นแบบนี้ (MVP)</span>'+
        '<p>เป้าหมาย "'+esc(a.Q1)+'" ยังไม่มี generator รองรับในเวอร์ชันนี้ — ตอบแบบสอบถามต่อได้ตามปกติ (คำตอบจะถูกเก็บไว้) แต่ระบบจะยังสร้างตารางออกกำลังกายให้ไม่ได้จนกว่าจะรองรับ ถ้าต้องการสร้างตารางตอนนี้ ให้กลับไปเลือกเป้าหมาย ลดไขมัน / เพิ่มกล้ามเนื้อ / Recomposition / รักษาสุขภาพทั่วไป แทน</p></div>';
    }
  }
  if(q.id==="Q3"){ body += timeFeedback(a); }
  if(q.id==="Q13" && a.Q13==="ระบุ"){
    body += '<div class="nested field-row"><input type="number" data-act="field" data-fid="Q13_val" data-fkey="q-Q13_val" value="'+num(a.Q13_val)+'" placeholder="น้ำหนักเป้าหมาย"><span class="unit">kg</span></div>';
  }
  if(q.id==="Q4b" && a.Q4b==="ระบุตัวเลข"){
    body += '<div class="nested field-row"><input type="text" data-act="field" data-fid="Q4b_val" data-fkey="q-Q4b_val" value="'+num(a.Q4b_val)+'" placeholder="เช่น 65kg หรือ 18%"></div>';
  }
  if(q.id==="Q14" && a.Q14==="ทราบ (กรอกตัวเลข)"){
    body += '<div class="nested field-row"><input type="number" data-act="field" data-fid="Q14_val" data-fkey="q-Q14_val" value="'+num(a.Q14_val)+'" placeholder="เปอร์เซ็นต์ไขมัน"><span class="unit">%</span></div>';
  }
  if(q.id==="Q14" && a.Q14==="ไม่ทราบแต่มีรอบเอว-รอบคอ-รอบสะโพกให้คำนวณ"){
    body += '<div class="nested">'+
      '<div class="field-row" style="margin-bottom:8px"><input type="number" data-act="field" data-fid="Q14_waist" data-fkey="q-Q14_waist" value="'+num(a.Q14_waist)+'" placeholder="รอบเอว"><span class="unit">cm</span></div>'+
      '<div class="field-row" style="margin-bottom:8px"><input type="number" data-act="field" data-fid="Q14_neck" data-fkey="q-Q14_neck" value="'+num(a.Q14_neck)+'" placeholder="รอบคอ"><span class="unit">cm</span></div>'+
      '<div class="field-row"><input type="number" data-act="field" data-fid="Q14_hip" data-fkey="q-Q14_hip" value="'+num(a.Q14_hip)+'" placeholder="รอบสะโพก"><span class="unit">cm</span></div>'+
      '</div>';
  }
  if(q.id==="Q18" && a.Q18==="รู้ (กรอกตัวเลข)"){
    body += '<div class="nested">'+
      '<div class="field-row" style="margin-bottom:8px"><input type="number" data-act="field" data-fid="Q18_squat" data-fkey="q-Q18_squat" value="'+num(a.Q18_squat)+'" placeholder="Squat"><span class="unit">kg</span></div>'+
      '<div class="field-row" style="margin-bottom:8px"><input type="number" data-act="field" data-fid="Q18_bench" data-fkey="q-Q18_bench" value="'+num(a.Q18_bench)+'" placeholder="Bench"><span class="unit">kg</span></div>'+
      '<div class="field-row"><input type="number" data-act="field" data-fid="Q18_deadlift" data-fkey="q-Q18_deadlift" value="'+num(a.Q18_deadlift)+'" placeholder="Deadlift"><span class="unit">kg</span></div>'+
      '</div>';
  }
  if(q.id==="Q15"){
    body += '<div class="note warn"><span class="eyebrow2">คำเตือนด้านการแพทย์ (แสดงคู่กับคำถามนี้เสมอ)</span>'+
      '<p>เป้าหมายที่คุณตั้งไว้ค่อนข้างห่างจากน้ำหนักปัจจุบันมาก การไปถึงอย่างปลอดภัยอาจต้องใช้ระยะเวลานานกว่าที่คิด แนะนำให้ปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนเริ่มโปรแกรม</p></div>';
  }
  if(q.id==="Q20" && a.Q20 && SUPPORTED_LOCATIONS.indexOf(a.Q20)===-1){
    // N-03: แจ้งข้อจำกัด MVP ทันทีที่เลือกสถานที่ ไม่ปล่อยให้ตอบจนจบแล้วเพิ่งไปเจอที่หน้าสรุป
    body += '<div class="note warn"><span class="eyebrow2">ข้อจำกัดของต้นแบบนี้ (MVP)</span>'+
      '<p>สถานที่ "'+esc(a.Q20)+'" ยังไม่มี generator รองรับในเวอร์ชันนี้ (รองรับ "ฟิตเนส-ยิม" กับ "ที่บ้าน") — ตอบแบบสอบถามต่อได้ตามปกติ (คำตอบจะถูกเก็บไว้) แต่ระบบจะยังสร้างตารางออกกำลังกายให้ไม่ได้จนกว่าจะรองรับ ถ้าต้องการสร้างตารางตอนนี้ ให้กลับไปเลือก "ฟิตเนส-ยิม" หรือ "ที่บ้าน" แทน</p></div>';
  }
  if(q.id==="Q20" && a.Q20==="ผสมผสาน"){
    body += '<div class="note dev"><span class="eyebrow2">หมายเหตุต้นแบบ (deviation)</span>'+
      '<p>เอกสารสเปกเดิมยังไม่ระบุว่า "ผสมผสาน" ควรเห็นคำถามอุปกรณ์ข้อไหน — ต้นแบบนี้เลือกแสดงทั้ง Q21 และ Q22 ไปก่อนเป็นทางแก้ชั่วคราว</p></div>';
  }
  if(q.id==="Q26" && Array.isArray(a.Q26) && a.Q26.indexOf("อื่นๆ ระบุ")>-1){
    body += '<div class="nested field-row"><input type="text" class="wide" data-act="field" data-fid="Q26_other" data-fkey="q-Q26_other" value="'+num(a.Q26_other)+'" placeholder="ระบุตำแหน่ง/อาการอื่นๆ"></div>';
  }
  if(q.id==="Q28"){
    body += '<div class="note warn"><span class="eyebrow2">Safety Gate</span>'+
      '<p>คำตอบข้อนี้ใช้เป็นจุดหยุดจริง (hard block) ก่อนสร้างตาราง — ถ้าตอบอย่างอื่นนอกจาก "ได้รับอนุญาตแล้ว" ระบบจะยังไม่สร้างตารางออกกำลังกายให้จนกว่าจะได้รับอนุญาตจากแพทย์</p></div>';
  }
  return body + '</div>';
}
function countAnswered(){
  var n=0;
  QUESTIONS.forEach(function(q){
    if(!q.visible(state.answers)) return;
    var v = state.answers[q.id];
    if(q.kind==="multi"){ if(Array.isArray(v)&&v.length>0) n++; }
    else if(v!=null && v!=="") n++;
  });
  return n;
}
function countVisibleTotal(){ return QUESTIONS.filter(function(q){return q.visible(state.answers);}).length; }

function readinessPanel(scope, issues, gate, ready){
  if(ready){
    return '<div class="note"><span class="eyebrow2">พร้อมสร้างตาราง</span>'+
      '<p>คำตอบของคุณผ่านเงื่อนไขความปลอดภัยและอยู่ในขอบเขตที่ต้นแบบนี้รองรับแล้ว กดปุ่มด้านล่างเพื่อสร้างตารางออกกำลังกาย + เป้าหมายโภชนาการของคุณ</p></div>';
  }
  var parts = [];
  if(!scope){
    parts.push('<p><b>ขอบเขต MVP v0.1:</b> generator สร้างตารางได้สำหรับ 4 เป้าหมาย (ลดไขมัน / เพิ่มกล้ามเนื้อ / Recomposition / รักษาสุขภาพทั่วไป) และเฉพาะสถานที่ "ฟิตเนส-ยิม" หรือ "ที่บ้าน" เท่านั้น — "เพิ่มความแข็งแรง-Performance" และ "เดิน-วิ่ง (Cardio)" ยังไม่รองรับ เพราะต้องการ program logic คนละแบบ (1RM-based programming และตารางวิ่งแยกจาก exercise engine เดิม) "กลางแจ้ง-สวนสาธารณะ" และ "ผสมผสาน" ก็ยังไม่รองรับเช่นกัน เพราะยังไม่มีคำถามอุปกรณ์ที่แม่นยำพอสำหรับสองเส้นทางนั้น</p>');
  }
  if(gate.blocked){ parts.push('<p><b>Safety Gate:</b> '+gate.reason+'</p>'); }
  if(issues.length){ parts.push('<p><b>ตรวจค่านี้อีกครั้ง:</b> '+issues.join(' · ')+'</p>'); }
  var cls = (gate.blocked || issues.length) ? 'note warn' : 'note dev';
  return '<div class="'+cls+'"><span class="eyebrow2">ยังสร้างตารางไม่ได้ตอนนี้</span>'+parts.join('')+'</div>';
}

var SIDE_KEYS = [
  {k:"เป้าหมาย", q:"Q1"}, {k:"วันที่ว่าง", q:"Q2"}, {k:"เวลา/ครั้ง", q:"Q3"},
  {k:"อายุ", q:"Q10", unit:" ปี"}, {k:"ส่วนสูง", q:"Q11", unit:" ซม."},
  {k:"น้ำหนัก", q:"Q12", unit:" กก."}, {k:"สถานที่", q:"Q20"}, {k:"ประสบการณ์", q:"Q16"}
];
function sideSummary(){
  var rows = "";
  SIDE_KEYS.forEach(function(item){
    var v = state.answers[item.q];
    if(Array.isArray(v)) v = v.join(", ");
    if(v==null || v==="") return;
    rows += '<div class="side-row"><div class="k">'+esc(item.k)+'</div><div class="v">'+esc(v)+(item.unit||"")+'</div></div>';
  });
  return '<div class="side-box"><div class="side-title">สรุปคำตอบของคุณ</div>'+
    (rows || '<div class="side-empty">ตอบคำถามแล้วสรุปจะขึ้นตรงนี้ระหว่างทาง เพื่อให้เห็นว่าระบบกำลังใช้ข้อมูลอะไรสร้างตารางให้</div>')+'</div>';
}
function stepRail(){
  var html = '<nav class="step-rail" aria-label="ความคืบหน้าตามหมวด"><div class="rail-title">หมวดคำถาม</div>';
  CATEGORIES.forEach(function(c,idx){
    var isCurrent = idx === state.step && state.step<9;
    var cls = "rail-step" + (idx<state.step?" done":"") + (isCurrent?" current":"");
    html += '<button type="button" class="'+cls+'" data-act="rail" data-idx="'+idx+'" '+(idx>state.step?"disabled":"")+'>'+
      '<span class="dot">'+(idx+1)+'</span><span class="lbl">'+esc(c.short)+'</span></button>';
  });
  return html + '</nav>';
}

function summaryHTML(){
  var html = '<div class="qcard"><div class="summary-head"><div class="catno mono">เสร็จสิ้น</div><h2>สรุปคำตอบของเส้นทางนี้</h2></div>';
  html += '<div class="stat-row">'+
    '<div class="stat"><div class="n mono">'+countAnswered()+'</div><div class="l">ข้อที่ตอบแล้ว</div></div>'+
    '<div class="stat"><div class="n mono">'+countVisibleTotal()+'</div><div class="l">ข้อที่เจอในเส้นทางนี้</div></div>'+
    '<div class="stat"><div class="n mono">'+QUESTIONS.length+'</div><div class="l">ข้อในคลังทั้งหมด</div></div></div>';
  CATEGORIES.forEach(function(cat){
    var qs = QUESTIONS.filter(function(q){return q.cat===cat.id && q.visible(state.answers) && state.answers[q.id]!=null && state.answers[q.id]!=="";});
    if(!qs.length) return;
    html += '<div class="sum-cat"><h3>หมวด '+cat.id+' — '+esc(cat.name)+'</h3>';
    qs.forEach(function(q){
      var v = state.answers[q.id];
      if(Array.isArray(v)) v = v.join(", ");
      html += '<div class="sum-row"><div class="k mono">'+q.id+' · '+esc(q.label)+'</div><div class="v">'+esc(v)+'</div></div>';
    });
    html += '</div>';
  });
  var a = state.answers;
  var scope = inScope(a), issues = sanityIssues(a), gate = safetyGate(a);
  var ready = scope && !issues.length && !gate.blocked;
  html += readinessPanel(scope, issues, gate, ready);
  html += '<div class="sum-actions">'+
    (ready ? '<button type="button" class="btn primary" data-act="gen">สร้างตารางออกกำลังกายของฉัน →</button>' : '')+
    '<button type="button" class="btn ghost" data-act="back-steps">← กลับไปแก้คำตอบ</button>'+
    '<button type="button" class="btn ghost" data-act="restart">เริ่มใหม่ / ทดสอบเส้นทางอื่น</button></div></div>';
  return html;
}

/* ปุ่มชื่อท่าที่กดดูภาพเคลื่อนไหวได้ — ใช้ทั้งท่าที่เลือกอยู่และท่าทางเลือกในหน้าตรวจแผน
   ส่ง exId/pattern/th/sub ผ่าน data-attr (esc เสมอ ป้องกันอักขระพิเศษทำ markup พัง) */
function demoBtnHTML(exId, pattern, th, sub, tierBadgeHtml, extraClass){
  var cls = 'ex-demo-btn' + (extraClass ? ' '+extraClass : '');
  return '<button type="button" class="'+cls+'" data-act="demo" data-exid="'+esc(exId)+'" data-pattern="'+esc(pattern)+'" data-th="'+esc(th)+'" data-sub="'+esc(sub||'')+'">'+
    esc(th)+' '+(tierBadgeHtml||'')+' <span class="demo-ic" aria-hidden="true">▶ ดูท่า</span></button>';
}

/* โมดัลรายละเอียดท่า — เปิดจาก track.demoExercise (set โดย action 'demo')
   เดิมมีลิงก์ไปคลิปสอน YouTube (ทั้งคลิปที่ตรวจสอบแล้วและลิงก์ค้นหา) ตัดออกทั้งหมดแล้ว
   ตามที่ผู้ใช้ขอ — เหลือแค่ชื่อท่า/pattern/หมายเหตุความปลอดภัย ไม่มีลิงก์ออกนอกแอปแล้ว */
function demoModalHTML(){
  var d = track.demoExercise;
  if(!d) return '';
  return '<div class="demo-overlay" data-act="demo-close">'+
    '<div class="demo-modal" role="dialog" aria-modal="true" data-act="demo-stop">'+
      '<button type="button" class="demo-x" data-act="demo-close" aria-label="ปิด">✕</button>'+
      '<div class="demo-title">'+esc(d.th)+'</div>'+
      '<div class="demo-pattern">'+esc(PATTERN_LABEL[d.pattern]||d.pattern)+'</div>'+
      (d.sub ? '<div class="demo-sub">'+esc(d.sub)+'</div>' : '')+
      '<div class="demo-note">ℹ️ ปรึกษาเทรนเนอร์ก่อนทำจริง เพื่อฟอร์มที่ถูกต้องเป๊ะรายท่า</div>'+
    '</div></div>';
}

/* ตัวเลือกวันฝึก/วัน cardio (+ นาที cardio รายวัน) ใช้ร่วมกันระหว่างหน้าตรวจแผน (ctx 'plan' → state.plan)
   และหน้าแผนของฉัน (ctx 'prog' → track.schedDraft ของโปรแกรมที่เริ่มไปแล้ว) */
var MUSCLE_ORDER = ['hpush','incline','chestfly','vpush','latraise','reardelt','hpull','vpull','biceps','triceps',
                    'squat','lunge','hinge','glute','legcurl','calf','core','oblique'];
function coverageHTML(covered, note){
  var n = MUSCLE_ORDER.filter(function(m){ return covered.indexOf(m)>-1; }).length;
  return '<div class="cov-card"><div class="cov-head">กล้ามเนื้อที่ได้ฝึกโดยตรงต่อสัปดาห์: <b>'+n+'/'+MUSCLE_ORDER.length+'</b> ส่วน</div>'+
    '<div class="cov-chips">'+MUSCLE_ORDER.map(function(m){
      var ok = covered.indexOf(m)>-1;
      return '<span class="chip'+(ok?' ok':'')+'">'+(ok?'✓ ':'· ')+esc(PATTERN_SHORT[m])+'</span>';
    }).join('')+'</div>'+(note ? '<p class="hint" style="margin:6px 0 0">'+note+'</p>' : '')+'</div>';
}
/* ส่วนที่ครอบคลุมจากเซสชันที่ได้ฝึกจริงในสัปดาห์ตามวันที่เลือก (ท่าเสริมที่ข้ามเพราะอุปกรณ์ไม่นับ) */
function planCoverage(split, trainDays, a){
  var used = {};
  assignSessions(split, trainDays).forEach(function(x){ used[x.session] = true; });
  var covered = [];
  SPLIT_DEFS[split].sessions.forEach(function(se){
    if(!used[se.key]) return;
    se.patterns.forEach(function(slot){
      var b = slotBase(slot);
      if(covered.indexOf(b)===-1 && selectionFor(slot, a).picked) covered.push(b);
    });
  });
  return covered;
}
function programCoverage(p){
  var used = {}, covered = [];
  (p.days||[]).forEach(function(d){ if(p.dayToSession[d]) used[p.dayToSession[d]] = true; });
  (p.sessions||[]).forEach(function(se){
    if(!used[se.key]) return;
    se.exercises.forEach(function(ex){ if(covered.indexOf(ex.pattern)===-1) covered.push(ex.pattern); });
  });
  return covered;
}
function planOutdated(p){
  var def = SPLIT_DEFS[p.splitKey];
  return !!def && sessionKeys(def.sessions).join('|') !== sessionKeys(p.sessions||[]).join('|');
}
function planUpdateBanner(p){
  if(!planOutdated(p)) return '';
  return '<div class="banner info"><div class="ic">ⓘ</div><div>มีตารางแบบใหม่ที่ <b>หมุนเวียนท่าในแต่ละวัน ให้โดนกล้ามเนื้อครบทุกส่วนในสัปดาห์</b> (ตอนนี้ครอบคลุม '+
    programCoverage(p).filter(function(m){ return MUSCLE_ORDER.indexOf(m)>-1; }).length+'/'+MUSCLE_ORDER.length+' ส่วน) '+
    '<button type="button" class="linkbtn" data-act="edit-plan">อัปเดตตารางเป็นแบบใหม่ →</button></div></div>';
}
/* sessions = เซสชันของแบบที่กำลังเลือก (SPLIT_DEFS: มี patterns) หรือของโปรแกรมที่ใช้อยู่ (มี exercises) */
function sessionMuscles(se){
  var bases = se.patterns ? se.patterns.map(slotBase) : se.exercises.map(function(e){ return e.pattern; });
  return bases.filter(function(b, i){ return bases.indexOf(b)===i; });
}
function scheduleEditorHTML(ctx, splitKey, avail, train, cardio, minByDay, sessMinutes, sessions){
  var def = SPLIT_DEFS[splitKey];
  sessions = sessions || def.sessions;
  var d2s = {}, sch = bestSchedule(sessions, train);
  sch.list.forEach(function(x){ d2s[x.day]=x.session; });
  var minTrain = minTrainDays(splitKey, {Q2:avail});
  var cards = DAYS.map(function(d,i){
    var isAvail = avail.indexOf(d)>-1, isTrain = train.indexOf(d)>-1, isCardio = cardio.indexOf(d)>-1;
    var blocked = isAvail && !isTrain && !sch.hard && bestSchedule(sessions, train.concat([d])).hard > 0;
    var sKey = isTrain ? d2s[d] : null;
    var seDef = sKey ? sessions.filter(function(s){return s.key===sKey;})[0] : null;
    var chips = seDef ? sessionMuscles(seDef).map(function(p){ return '<span class="chip">'+esc(PATTERN_SHORT[p]||p)+'</span>'; }).join('') : '';
    var mins = (minByDay||{})[d] || CARDIO_DEFAULT_MIN;
    var name = [sKey, isCardio?'Cardio':null].filter(Boolean).join(' + ') || (isAvail ? 'พัก' : 'ไม่ว่าง');
    var body = isAvail
      ? '<div class="sched-btns">'+
          '<button type="button" class="opt'+(isTrain?' sel':'')+(blocked?' blocked':'')+'" data-act="train-day" data-ctx="'+ctx+'" data-day="'+esc(d)+'" aria-pressed="'+isTrain+'"'+
            (blocked?' title="ติดกับวันฝึกที่ใช้กล้ามเนื้อกลุ่มเดียวกัน"':'')+'>ฝึก</button>'+
          '<button type="button" class="opt'+(isCardio?' sel':'')+'" data-act="cardio-day" data-ctx="'+ctx+'" data-day="'+esc(d)+'" aria-pressed="'+isCardio+'">Cardio</button>'+
        '</div>'+
        (isCardio ? '<div class="sched-row"><label>Cardio วันนี้</label><input type="number" inputmode="numeric" min="5" max="300" data-act="cardio-day-min" data-ctx="'+ctx+'" data-day="'+esc(d)+'" data-fkey="cmin-'+ctx+'-'+esc(d)+'" value="'+mins+'"> นาที</div>' : '')
      : '<div class="wk-sub">ไม่ได้เลือกเป็นวันว่างในแบบสอบถาม</div>';
    if(blocked) body += '<div class="wk-sub sched-block">ฝึกไม่ได้ — ติดกับวันฝึกกล้ามเนื้อกลุ่มเดียวกัน (พักได้ หรือทำ cardio)</div>';
    return '<div class="wk-card'+(isTrain||isCardio?'':' rest')+(isAvail?'':' unavail')+'"><div class="wk-top"><span class="wk-day mono">'+esc(DAYS_SHORT[i])+'</span>'+
      (isTrain&&sessMinutes?'<span class="chip">'+esc(sessMinutes)+'</span>':'')+'</div>'+
      '<div class="wk-name">'+esc(name)+'</div>'+
      (chips?'<div class="wk-sub">'+chips+'</div>':'')+body+'</div>';
  }).join('');
  var note = train.length >= minTrain
    ? '<div class="split-auto-line">เลือกวันฝึกไว้ '+train.length+' วัน (ขั้นต่ำของ '+esc(def.label)+' คือ '+minTrain+' วัน) · Cardio '+cardio.length+' วัน — เลือกได้เฉพาะวันที่ว่าง ไม่ต้องใช้ครบทุกวัน cardio อยู่วันเดียวกับวันฝึกหรือคนละวันก็ได้ และตั้งนาทีแยกแต่ละวันได้</div>'
    : '<div class="banner warn"><div class="ic">⚠️</div><div>'+esc(def.label)+' ต้องมีวันฝึกอย่างน้อย <b>'+minTrain+' วัน/สัปดาห์</b> ตอนนี้เลือกไว้ '+train.length+' วัน — กด “ฝึก” เพิ่มในวันที่ว่าง</div></div>';
  var rule = '<div class="split-auto-line">'+(splitKey==='fullbody'
      ? 'Full Body ฝึกทั้งตัวทุกครั้ง จึงต้อง<b>เว้นอย่างน้อย 1 วันระหว่างวันฝึก</b> (นับอาทิตย์ → จันทร์ด้วย) ให้กล้ามเนื้อได้พัก ~48 ชม.'
      : 'ระบบจัดเซสชันลงวันให้อัตโนมัติ ไม่ให้กล้ามเนื้อกลุ่มเดียวกันโดนในวันติดกัน (นับอาทิตย์ → จันทร์ด้วย) — วันที่จัดไม่ได้จะขึ้นว่าฝึกไม่ได้')+'</div>';
  var warn = sch.hard
    ? '<div class="banner danger"><div class="ic">⚠️</div><div><b>วันฝึกที่เลือกทำให้'+esc(clashText(sch.clash))+'</b> — กล้ามเนื้อต้องพัก ~48 ชม. เอาวันใดวันหนึ่งออก แล้วจึงบันทึก/เริ่มโปรแกรมได้</div></div>'
    : (track.schedMsg ? '<div class="banner warn"><div class="ic">⚠️</div><div>'+esc(track.schedMsg)+'</div></div>' : '');
  return warn+'<div class="wk-grid" style="margin-top:12px">'+cards+'</div>'+rule+note;
}

function resultsHTML(){
  var a = state.answers;
  var t = computeTargets(a);
  var bmiNow = bmiOf(parseFloat(a.Q12), parseFloat(a.Q11));
  var bmiTarget = t.goalWeight ? bmiOf(t.goalWeight, parseFloat(a.Q11)) : null;
  var trainDays = planTrainDays(a), cardioDays = planCardioDays(a);
  var adjacency = weekdayAdjacencyWarning(trainDays);
  var pKcal = t.proteinG*4, fKcal = t.fatG*9, cKcal = t.carbG*4, tot = pKcal+fKcal+cKcal;
  var pPct = Math.round(pKcal/tot*100), fPct = Math.round(fKcal/tot*100), cPct = 100-pPct-fPct;

  var split = effectiveSplit(a), splitDef = SPLIT_DEFS[split], feas = splitFeasibility(a);
  var minTrain = minTrainDays(split, a);
  var scheduleOk = trainDays.length >= minTrain;
  var assignment = assignSessions(split, trainDays);
  var dayToSession = {};
  assignment.forEach(function(x){ dayToSession[x.day]=x.session; });
  var autoPick = autoSplit(a);

  var statTiles =
    '<div class="stat-tile"><div class="l">BMI ปัจจุบัน</div><div class="v">'+bmiNow.toFixed(1)+'</div><span class="pill">'+bmiLabel(bmiNow)+'</span></div>'+
    (bmiTarget ? '<div class="stat-tile"><div class="l">BMI เป้าหมาย</div><div class="v">'+bmiTarget.toFixed(1)+'</div><span class="pill">'+bmiLabel(bmiTarget)+'</span></div>' : '')+
    '<div class="stat-tile"><div class="l">TDEE โดยประมาณ</div><div class="v">'+fmtKcal(t.tdee)+' <small>kcal/วัน</small></div></div>'+
    '<div class="stat-tile"><div class="l">เป้าแคลอรี่ต่อวัน</div><div class="v">'+fmtKcal(t.kcal)+' <small>kcal</small></div>'+
      '<span class="pill">'+esc(t.kcalDirection)+'</span>'+
      (t.kcalFloored ? '<span class="pill" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line)">ปรับขึ้นถึง floor ขั้นต่ำ</span>' : '')+'</div>';

  var splitPicker = '<div class="split-picker">' + Object.keys(SPLIT_DEFS).map(function(key){
    var def = SPLIT_DEFS[key], f = feas[key], active = key===split, tag = '';
    if(f.eligible && key===autoPick) tag = '<span class="so-tag">แนะนำอัตโนมัติ</span>';
    else if(f.eligible && !f.recommended) tag = '<span class="so-tag" style="background:var(--warn-soft);color:var(--warn);border-color:var(--warn-line)">ไม่ค่อยแนะนำ</span>';
    var subNote = !f.eligible ? 'ต้องมีวันว่างอย่างน้อย '+def.minDays+' วัน/สัปดาห์ (ตอนนี้เลือกไว้ '+(a.Q2||[]).length+' วัน)' : def.desc;
    return '<button type="button" class="split-opt'+(active?' active':'')+'" data-act="split" data-split="'+key+'" '+(f.eligible?'':'disabled')+'>'+
      '<div class="so-name">'+def.label+' '+tag+'</div><div class="so-sub">'+subNote+'</div></button>';
  }).join('') + '</div>';
  var splitFooter = state.plan.splitOverride
    ? '<div class="split-auto-line">คุณเลือกรูปแบบนี้เอง — <button type="button" data-act="split-auto">ให้ระบบแนะนำอัตโนมัติแทน</button></div>'
    : '<div class="split-auto-line">ระบบแนะนำอัตโนมัติตามวันว่างและประสบการณ์ที่ตอบไว้ — กดเลือกรูปแบบอื่นด้านบนได้ถ้าต้องการ</div>';

  var schedHTML = scheduleEditorHTML('plan', split, a.Q2||[], trainDays, cardioDays, state.plan.cardioMinByDay, a.Q3||'');
  var covered = planCoverage(split, trainDays, a);
  var covMissing = MUSCLE_ORDER.filter(function(m){ return covered.indexOf(m)===-1; }).length;
  var covNote = !covMissing ? 'ครบทุกส่วนแล้ว — แต่ละวันฝึกคนละชุดท่าหมุนเวียนกัน'
    : (trainDays.length < splitDef.sessions.length
        ? 'ฝึก '+splitDef.sessions.length+' วัน/สัปดาห์ขึ้นไปจะได้ครบทุกชุดท่า (ตอนนี้ '+trainDays.length+' วัน) — ส่วนที่ขาดยังได้แรงทางอ้อมจากท่าหลัก'
        : 'ส่วนที่ขาดเพราะไม่มีอุปกรณ์สำหรับท่าเสริมนั้น');
  schedHTML += coverageHTML(covered, covNote);

  function buildExRow(pattern){
    var base = slotBase(pattern);
    var label = PATTERN_LABEL[base] + (pattern!==base ? ' · ท่าที่ 2' : '');
    var sel = selectionFor(pattern, a);
    if(!sel.picked){
      if(OPTIONAL_PATTERNS.indexOf(base)>-1){
        return '<div class="ex-row"><div class="ex-pattern">'+label+'</div><div class="hint">ข้ามท่านี้ — ไม่มีท่าที่ใช้อุปกรณ์ที่คุณมี (เป็นท่าเสริม ไม่กระทบตารางหลัก)</div></div>';
      }
      return '<div class="ex-row"><div class="ex-pattern">'+label+'</div><div class="banner danger"><div class="ic">✕</div><div>ไม่มีท่าที่เหมาะสมเหลือให้เลือก (อุปกรณ์ไม่พอ หรือถูกล็อกทั้งหมด) — ต้องการอุปกรณ์เพิ่มเติม/ปรึกษาเทรนเนอร์</div></div></div>';
    }
    var setsReps = setsRepsFor(pattern, sel.picked, a);
    var intense = planIntense(pattern, sel.picked);
    var rest = restFor({pattern:base, equip:sel.picked.equip, timeBased:!!sel.picked.timed, intensity:intense?'intense':'normal'});
    var intToggle = intensityEligible(sel.picked)
      ? '<div class="int-toggle" role="group" aria-label="ความเข้มข้นของท่านี้">'+
          '<button type="button" class="opt'+(intense?'':' sel')+'" data-act="intensity" data-pattern="'+pattern+'" data-val="normal" aria-pressed="'+!intense+'">ทั่วไป</button>'+
          '<button type="button" class="opt'+(intense?' sel':'')+'" data-act="intensity" data-pattern="'+pattern+'" data-val="intense" aria-pressed="'+intense+'">เข้มข้น</button></div>'
      : '';
    var alts = sel.all.filter(function(e){return e.id!==sel.picked.id;});
    var altsHtml = alts.map(function(x){
      var pickedThis = state.plan.manualPick[pattern]===x.id;
      var nameBtn = demoBtnHTML(x.id, base, x.th, x.sub, tierBadge(x.tier));
      if(x.locked){
        return '<div class="swap-opt locked"><div>'+nameBtn+'<div class="lockmsg">ล็อกอยู่ — เนื่องจากอาการที่ '+x.lockedBy.join(', ')+' ที่คุณแจ้งไว้</div></div>'+
          '<button type="button" data-act="unlock" data-unlock="'+x.id+'" data-pattern="'+pattern+'">แจ้งว่าหายแล้ว</button></div>';
      }
      if(!x.equipOk){
        return '<div class="swap-opt locked"><div>'+nameBtn+'<div class="lockmsg">ต้องใช้อุปกรณ์ที่ยิมนี้ไม่มีตามที่แจ้งไว้</div></div></div>';
      }
      return '<div class="swap-opt'+(pickedThis?' picked':'')+'">'+nameBtn+
        '<button type="button" data-act="swap" data-swap="'+x.id+'" data-pattern="'+pattern+'">เลือกท่านี้แทน</button></div>';
    }).join('');
    return '<div class="ex-row"><div class="ex-row-top"><div><div class="ex-pattern">'+label+'</div>'+
      demoBtnHTML(sel.picked.id, base, sel.picked.th, sel.picked.sub, tierBadge(sel.picked.tier), 'ex-name')+
      '<div class="ex-sub">'+sel.picked.sub+'</div>'+
      '<div class="rest-line">พักระหว่างเซ็ต '+rest.set+' · ก่อนเปลี่ยนท่า '+rest.next+'</div>'+
      (intense ? '<div class="int-warn">⚠️ เข้มข้น: เพิ่มน้ำหนักให้หมดแรงภายใน 4-8 ครั้ง — '+INTENSE_WARNING+'</div>' : '')+
      '</div>'+
      '<div class="ex-meta"><span class="ex-sets mono">'+setsReps+'</span>'+intToggle+
      '<button type="button" class="swap-toggle" data-act="swap-toggle" data-pattern="'+pattern+'">สลับท่า ▾</button></div></div>'+
      '<div class="swap-panel'+(track.openSwap===pattern?' open':'')+'">'+altsHtml+'</div></div>';
  }
  var anyIntense = false, anyEligible = false;
  splitDef.sessions.forEach(function(se){ se.patterns.forEach(function(pt){
    var pk = selectionFor(pt, a).picked;
    if(intensityEligible(pk)) anyEligible = true;
    if(planIntense(pt, pk)) anyIntense = true;
  }); });
  var intensityBar = anyEligible
    ? '<div class="int-all"><span>ความเข้มข้นทุกท่า (ยกเว้นท่าน้ำหนักตัว/core):</span>'+
        '<button type="button" class="opt" data-act="intensity-all" data-val="normal">ทั่วไปทั้งหมด</button>'+
        '<button type="button" class="opt" data-act="intensity-all" data-val="intense">เข้มข้นทั้งหมด</button></div>'+
      '<p class="hint">ทั่วไป = จำนวนเซ็ต/ครั้งตามเป้าหมาย พักตามปกติ · เข้มข้น = 2 เซ็ต × 4-8 ครั้ง ใช้น้ำหนักมากขึ้นจนหมดแรงภายใน 4-8 ครั้ง พักเซ็ตละ 3-5 นาที</p>'
    : '';
  var intenseBanner = anyIntense
    ? '<div class="banner warn"><div class="ic">⚠️</div><div><b>คุณเลือกแบบเข้มข้นไว้</b> — '+INTENSE_WARNING+
        (a.Q16==='มือใหม่' ? ' · คุณระบุว่าเป็นมือใหม่ แนะนำให้เริ่มจากแบบทั่วไปจนฟอร์มนิ่งก่อน' : '')+'</div></div>'
    : '';
  var sessionBlocks = splitDef.sessions.map(function(se){
    var daysForThis = assignment.filter(function(x){return x.session===se.key;}).map(function(x){return x.day;});
    return '<div class="session-heading">เซสชัน "'+se.key+'" <span class="sh-sub">('+daysForThis.length+'x/สัปดาห์ — '+(daysForThis.join(', ')||'—')+' · ~'+(a.Q3||'45-60 นาที')+' รวมวอร์มอัพ)</span></div>'+
      '<div class="exercise-list">'+se.patterns.map(buildExRow).join('')+'</div>';
  }).join('');

  var reasoning = (function(){
    var isOverride = !!state.plan.splitOverride;
    var lead = isOverride ? 'คุณเลือก <b>'+splitDef.label+'</b> เอง' : 'ระบบแนะนำ <b>'+splitDef.label+'</b> ให้อัตโนมัติ';
    var warnRec = (isOverride && !feas[split].recommended) ? ' — รูปแบบนี้ปกติแนะนำสำหรับคนที่มีประสบการณ์มากกว่านี้ ระบบยังสร้างตารางให้ตามที่คุณเลือกได้ แต่โปรดสังเกตความเหนื่อยล้า/ฟอร์มท่าให้ดีเป็นพิเศษในช่วงแรก' : '';
    var daysStr=(a.Q2||[]).join(', '), body;
    if(split==='fullbody'){
      body = ' เพราะวันฝึกที่เลือก ('+(trainDays.join(', ')||'—')+') '+
        (adjacency ? 'มีวันที่ติดกัน — โปรดสังเกตว่ากล้ามเนื้อกลุ่มเดิมอาจได้พักไม่ถึง ~48 ชม. แนะนำให้เว้นอย่างน้อย 1 วันระหว่างเซสชันถ้าเป็นไปได้'
          : 'ไม่ติดกัน ทำให้แต่ละกลุ่มกล้ามเนื้อได้พัก ≥48 ชม. ระหว่างเซสชันพอดี')+
        ' และประสบการณ์ระดับ "'+a.Q16+'" เหมาะกับ Full Body ที่สุดในบรรดา 4 รูปแบบที่ MVP นี้รองรับ';
    } else if(split==='ul'){
      body = ' เพราะมีวันว่าง '+(a.Q2||[]).length+' วัน/สัปดาห์ ('+daysStr+') พอจะแยกวันบน-ล่างสลับกันได้';
    } else if(split==='ppl'){
      body = ' เพราะมีวันว่าง '+(a.Q2||[]).length+' วัน/สัปดาห์ ('+daysStr+') พอจะหมุนวน Push → Pull → Legs ได้';
    } else {
      body = ' เพราะมีวันว่าง '+(a.Q2||[]).length+' วัน/สัปดาห์ ('+daysStr+') พอจะแยกฝึกกล้ามเนื้อทีละกลุ่มได้ครบ 5 วัน (ข้อควรรู้: แต่ละกลุ่มได้ฝึก ~1 ครั้ง/สัปดาห์ แลกกับโวลุ่มต่อครั้งที่สูงกว่า)';
    }
    return lead + body + warnRec;
  })();

  var q27Note = a.Q27 ? '<div class="banner warn"><div class="ic">⚠️</div><div><b>ท่าที่คุณระบุเองว่าต้องหลีกเลี่ยง:</b> "'+esc(a.Q27)+'" — ระบบยังกรองท่าให้อัตโนมัติจากข้อความนี้ไม่ได้ 100% กรุณาตรวจสอบตารางด้านล่างอีกครั้งก่อนเริ่ม</div></div>' : '';

  return '<div class="qcard">'+
    '<div class="summary-head"><div class="catno mono">แผนที่ระบบสร้างให้ · '+esc(a.Q1)+' + ฟิตเนส-ยิม</div>'+
    '<h2>ตารางออกกำลังกาย + เป้าหมายรายวันของคุณ</h2>'+
    '<p style="color:var(--text-2); font-size:13px; margin-top:6px;">ตรวจให้ครบก่อนกดเริ่ม — เมื่อกด “เริ่มโปรแกรม” ระบบจะล็อกแผนนี้ไว้เป็นชุดคงที่แล้วเปิดใช้งานเมนูประจำวัน</p></div>'+
    q27Note+
    (a.Q4c && a.Q4c!=='ไม่เคย' ? '<div class="banner info"><div class="ic">ⓘ</div><div>คุณระบุว่าเคย yo-yo มาก่อน — ระบบจะเน้นความสม่ำเสมอมากกว่าความเร็ว และแนะนำให้ดู % ทำตามแผนรายสัปดาห์แทนตัวเลขน้ำหนักรายวัน</div></div>' : '')+
    '<div class="stat-grid">'+statTiles+'</div>'+
    '<div class="stat-tile"><div class="l">เป้าหมายรายวันที่จะไปอยู่ในเช็คลิสต์</div>'+
      '<div class="macro-bar"><span style="width:'+pPct+'%; background:var(--accent);"></span><span style="width:'+fPct+'%; background:var(--sleep);"></span><span style="width:'+cPct+'%; background:var(--branch);"></span></div>'+
      '<div class="macro-legend"><span><i style="background:var(--accent)"></i>โปรตีน '+t.proteinG+'g ('+pPct+'%)</span>'+
      '<span><i style="background:var(--sleep)"></i>ไขมัน '+t.fatG+'g ('+fPct+'%)</span>'+
      '<span><i style="background:var(--branch)"></i>คาร์บ '+t.carbG+'g ('+cPct+'%)</span></div>'+
      (t.macroClamped?'<div class="opt-note">⚠️ ปรับสัดส่วนอัตโนมัติเพราะโปรตีน+ไขมันตั้งต้นเกินเป้าแคลอรี่ที่คำนวณได้</div>':'')+
      '<div class="opt-note" style="margin-top:8px">น้ำ '+fmt1(t.waterL)+' ลิตร/วัน · '+t.meals+' มื้อ/วัน · นอน '+fmtHours(t.sleepH)+'/คืน'+(t.sleepHygiene?' · มีข้อ sleep hygiene ในเช็คลิสต์':'')+'</div></div>'+

    '<div class="section-title">รูปแบบโปรแกรมและตารางรายสัปดาห์</div>'+
    splitPicker + splitFooter +
    '<div class="reasoning-card">'+reasoning+'</div>'+
    '<div class="section-title">เลือกวันฝึกและวัน cardio</div>'+
    '<p class="hint">วันว่างที่ตอบไว้คือวันที่ “เลือกได้” — กดเลือกเฉพาะวันที่จะเล่นจริง</p>'+
    schedHTML +
    (Object.keys(state.plan.forceLowTier).length ? '<div class="banner info"><div class="ic">ⓘ</div><div>คุณเพิ่งแจ้งว่าหายจากอาการบาดเจ็บสำหรับบางท่า — ระบบเริ่มท่าในกลุ่มนั้นใหม่จาก <b>Tier ต่ำสุด</b> ก่อนเสมอเพื่อความปลอดภัย</div></div>' : '')+

    '<div class="section-title">รายละเอียดเซสชัน</div>'+
    '<div class="tier-legend">'+TIER_ORDER.map(function(tt){ return '<div class="item"><b>Tier '+tt+'</b> '+TIER_LABEL[tt]+'</div>'; }).join('')+'</div>'+
    intensityBar + intenseBanner +
    sessionBlocks+

    (track.editing ? renderStartSetup() :
      '<div class="sum-actions"><button type="button" class="btn primary" data-act="edit-start"'+(scheduleOk?'':' disabled')+'>'+(track.program?'บันทึกแผนใหม่ (ตั้งวันเริ่ม) →':'เริ่มโปรแกรม →')+'</button>'+
      '<button type="button" class="btn ghost" data-act="back-summary">← กลับไปหน้าสรุปคำตอบ</button>'+
      (track.program? '<button type="button" class="btn ghost" data-act="exit-edit">ยกเลิก กลับไปแอป</button>':'')+'</div>')+
    '</div>' + demoModalHTML();
}

function renderOnboarding(){
  var pctDone = Math.min(state.step,9)/9*100;
  var head = '<div class="page-head"><div><div class="eyebrow">Gymbro Daily · ตั้งค่าครั้งแรก</div>'+
    '<h1>'+(state.step>=9 ? (state.mode==='results'?'ตรวจแผนก่อนเริ่ม':'สรุปคำตอบ') : 'แบบสอบถาม Onboarding')+'</h1>'+
    '<div class="sub">ตอบ 9 หมวดเพื่อให้ระบบสร้างตารางฝึกและเป้าหมายรายวันให้ — ทำครั้งเดียว หลังจากนั้นจะเข้าหน้าใช้งานประจำวันโดยตรง</div></div>'+
    (track.program? '<div class="head-actions"><button type="button" class="btn" data-act="exit-edit">← กลับไปแอป</button></div>':'')+
    '</div>';

  var warn = '';
  if(!STORAGE_OK){
    warn = '<div class="note warn"><span class="eyebrow2">บันทึกข้อมูลถาวรใช้ไม่ได้ในเบราว์เซอร์นี้</span>'+
      '<p>เบราว์เซอร์นี้ไม่อนุญาตให้เว็บไซต์บันทึกข้อมูล (เช่น โหมดส่วนตัว/ปิด cookies) — ยังตอบแบบสอบถามและดูแผนได้ตามปกติ แต่ข้อมูลจะหายเมื่อปิดแท็บ</p></div>';
  }

  var main;
  if(state.step>=9 && state.mode==='results') main = resultsHTML();
  else if(state.step>=9) main = summaryHTML();
  else {
    var cat = CATEGORIES[state.step];
    var qs = visibleQsFor(cat.id);
    var body = '<div class="qcard"><div class="cat-head"><div class="catno mono">หมวด '+cat.id+' / 9</div><h2>'+esc(cat.name)+'</h2></div>';
    qs.forEach(function(q){ body += renderQuestion(q); });
    body += '</div>';
    var ok = catComplete(cat.id);
    body += '<div class="footnav">'+
      '<button type="button" class="btn ghost" data-act="back" '+(state.step===0?'disabled':'')+'>← ย้อนกลับ</button>'+
      '<div class="nav-right"><span class="pos mono">หมวด '+(state.step+1)+' / 9</span>'+
      '<button type="button" class="btn primary" data-act="next" '+(ok?'':'disabled')+'>'+(state.step===8?'ส่งแบบสอบถาม':'ถัดไป →')+'</button></div></div>';
    main = body;
  }

  var side = (state.step>=9) ? '' : '<aside class="onb-side">'+stepRail()+sideSummary()+'</aside>';
  var topline = (state.step>=9) ? '' :
    '<div class="topline"><div class="rail-bar"><i style="width:'+pctDone+'%"></i></div><span class="step-count">หมวด '+(state.step+1)+' / 9</span></div>';

  document.getElementById("page").innerHTML = head + warn + topline +
    (side ? '<div class="onb-layout"><div class="onb-main">'+main+'</div>'+side+'</div>' : '<div class="onb-main">'+main+'</div>');
}

/* ============================================================
   RENDER DISPATCH + EVENTS
   ============================================================ */
function captureFocus(){
  var el = document.activeElement;
  if(!el || !el.getAttribute) return null;
  var k = el.getAttribute('data-fkey');
  if(!k) return null;
  var o = {k:k, s:null, e:null};
  try{ if(el.type!=='number' && el.selectionStart!=null){ o.s=el.selectionStart; o.e=el.selectionEnd; } }catch(err){}
  return o;
}
function restoreFocus(f){
  if(!f) return;
  var el = document.querySelector('[data-fkey="'+f.k+'"]');
  if(!el) return;
  try{ el.focus(); if(f.s!=null && el.setSelectionRange) el.setSelectionRange(f.s, f.e); }catch(err){}
}

function syncAvailable(){ return typeof GymBroSync!=='undefined' && GymBroSync.isReady(); }
var GOOGLE_G_SVG = '<svg width="18" height="18" viewBox="0 0 48 48" style="flex:0 0 auto"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4 24 4 12.9 4 4 12.9 4 24s8.9 20 20 20 20-8.9 20-20c0-1.3-.1-2.7-.4-3.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 16 19 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4 24 4c-7.6 0-14.1 4.3-17.4 10.7z"/><path fill="#4CAF50" d="M24 44c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 34.9 26.9 36 24 36c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.8 39.6 16.4 44 24 44z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.2-2.2 4.1-4.1 5.4l6.6 5.6C39.8 37.4 44 31.5 44 24c0-1.3-.1-2.7-.4-3.5z"/></svg>';
/* Google เท่านั้น — ตัดอีเมล/รหัสผ่านออกทั้งหมดตามที่ตัดสินใจ (กันอีเมลปลอมได้ฟรี
   ไม่ต้องพึ่ง SMTP/SMS ที่มีค่าใช้จ่ายและขีดจำกัดตามที่เจอมา) ไม่มี signin/signup
   แยกกันด้วยซ้ำ — ปุ่มเดียวจบ Google จัดการ "สมัครครั้งแรก = เข้าสู่ระบบเลย" ให้เอง */
function renderAuthGate(){
  return '<div class="page" style="max-width:420px;margin:60px auto;">'+
    '<div class="qcard">'+
    '<div class="eyebrow">Gymbro Daily</div>'+
    '<h1 style="margin-top:6px">เข้าสู่ระบบ</h1>'+
    '<p class="sub" style="margin:8px 0 18px">เข้าสู่ระบบด้วย Google เพื่อให้ข้อมูลของคุณซิงก์ข้ามอุปกรณ์ได้</p>'+
    (authState.error ? '<div class="note warn" style="margin-bottom:14px"><p>'+esc(authState.error)+'</p></div>' : '')+
    '<button type="button" class="btn" data-act="auth-google" '+(authState.busy?'disabled':'')+' style="width:100%;display:flex;align-items:center;justify-content:center;gap:10px">'+
      GOOGLE_G_SVG+'<span>'+(authState.busy?'กำลังเชื่อมต่อ...':'ดำเนินการต่อด้วย Google')+'</span></button>'+
    '</div></div>';
}
function render(toTop){
  if(auth.ready && syncAvailable() && !auth.session){
    document.getElementById('nav').innerHTML = '';
    // ต่อโมดัลลบบัญชีท้ายหน้า login ด้วย — กรณีเดียวที่จำเป็นคือหลังลบบัญชีสำเร็จ ซึ่ง
    // session ถูกตัดไปแล้ว (signOut จริง) แต่ยังต้องให้ผู้ใช้เห็นข้อความ "ลบบัญชีเรียบร้อย
    // แล้ว" ก่อนกดปิด ถ้าไม่ต่อตรงนี้ auth gate จะกลืนโมดัลหายไปทันทีที่ลบเสร็จ
    document.getElementById('page').innerHTML = renderAuthGate() + deleteAccountModalHTML();
    if(toTop) window.scrollTo({top:0, behavior:"auto"});
    return;
  }
  finalizeLockedDays();
  var view = currentView();
  var f = captureFocus();
  renderNav(view);
  if(view==='onboarding') renderOnboarding();
  else if(view==='today') renderToday();
  else if(view==='schedule') renderSchedule();
  else if(view==='progress') renderProgress();
  else if(view==='plan') renderPlan();
  else if(view==='coach') renderCoach();
  restoreFocus(f);
  if(toTop) window.scrollTo({top:0, behavior:"auto"});
}

function setsFromDom(exId, iso){
  var nodes = document.querySelectorAll('[data-act="set"][data-ex="'+exId+'"][data-date="'+iso+'"]');
  var sets = [];
  Array.prototype.forEach.call(nodes, function(inp){
    var i = parseInt(inp.getAttribute('data-idx'),10);
    var field = inp.getAttribute('data-field');
    if(!sets[i]) sets[i] = {};
    sets[i][field] = inp.value===''? null : parseFloat(inp.value);
  });
  return sets;
}
function patchExercise(iso, exId, patch){
  var cur = logFor(iso) || {};
  var exs = {};
  Object.keys(cur.exercises||{}).forEach(function(k){ exs[k] = cur.exercises[k]; });
  var e = exs[exId] || {};
  var next = {sets: e.sets||[], done: !!e.done, warmup: e.warmup||[], symptom: e.symptom||null};
  Object.keys(patch).forEach(function(k){ next[k] = patch[k]; });
  exs[exId] = next;
  saveDay(iso, {exercises: exs});
}
function patchNutrition(iso, patch){
  var cur = logFor(iso) || {};
  var n = {};
  Object.keys(cur.nutrition||{}).forEach(function(k){ n[k] = cur.nutrition[k]; });
  Object.keys(patch).forEach(function(k){ n[k] = patch[k]; });
  saveDay(iso, {nutrition:n});
}
function patchSleep(iso, patch){
  var cur = logFor(iso) || {};
  var s = {};
  Object.keys(cur.sleep||{}).forEach(function(k){ s[k] = cur.sleep[k]; });
  Object.keys(patch).forEach(function(k){ s[k] = patch[k]; });
  saveDay(iso, {sleep:s});
}
function numOrNull(v){ if(v===''||v==null) return null; var n=parseFloat(v); return isNaN(n)? null : n; }
/* N-02: ตรวจช่วงค่าที่ชั้นข้อมูล ไม่พึ่ง HTML min/max อย่างเดียว (คนพิมพ์เลขในช่อง
   type=number ข้าม min/max ของ HTML ได้ตรงๆ) — ว่าง = ไม่มีข้อมูล (valid, value:null)
   ต่างจากค่านอกช่วง (invalid, ถูกปฏิเสธไม่ให้บันทึก) */
function numInRange(v, lo, hi){
  var n = numOrNull(v);
  if(n==null) return {value:null, valid:true};
  if(!isFinite(n) || n<lo || n>hi) return {value:null, valid:false, rejected:n};
  return {value:n, valid:true};
}

function goto(view){ state.nav = view; track.openDate=null; track.saveStatus=''; track.schedDraft=null; track.schedMsg=''; acctOpen=false; persist(); render(true); }

document.addEventListener("click", function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;

  /* แผงบัญชีบน app bar: แตะที่ว่างนอกแผงแล้วปิด (พฤติกรรมที่คนคาดหวังจากเมนูแบบนี้)
     ต้องเช็คก่อน return ของ el เพราะการแตะพื้นที่ว่างจะไม่เจอ [data-act] ใดๆ เลย */
  if(acctOpen){
    var insidePanel = ev.target && ev.target.closest && ev.target.closest('.acct-panel');
    var onToggle = el && el.getAttribute('data-act')==='acct-toggle';
    if(!insidePanel && !onToggle){ acctOpen = false; render(); }
  }
  if(!el) return;
  var act = el.getAttribute('data-act');
  var iso = el.getAttribute('data-date');

  if(act==='acct-toggle'){ acctOpen = !acctOpen; render(); return; }
  if(act==='auth-google'){
    authState.busy = true; authState.error = null; render();
    Promise.resolve(GymBroSync.signInWithGoogle()).then(function(res){
      // สำเร็จ = หน้าเว็บกำลังจะ redirect ไป Google ทันที (ไม่ต้อง render ต่อ)
      // ถ้ามี error กลับมาทันที (เช่นยังไม่ได้ตั้งค่า provider ฝั่ง Supabase) ค่อยแสดง
      if(res && res.error){ authState.busy=false; authState.error=res.error.message; render(); }
    }).catch(function(e){ authState.busy=false; authState.error='เชื่อมต่อไม่ได้: '+(e&&e.message?e.message:e); render(); });
    return;
  }
  if(act==='auth-signout'){ GymBroSync.signOut(); return; } // onAuthChange จะเคลียร์ auth.session + render ให้เอง

  if(act==='acct-delete-open'){
    acctOpen = false;
    deleteAccountUI = {open:true, reason:null, busy:false, error:null, done:false};
    render(); return;
  }
  if(act==='delacct-reason'){
    if(deleteAccountUI.busy) return;
    deleteAccountUI.reason = el.getAttribute('data-val'); render(); return;
  }
  if(act==='delacct-cancel'){
    if(deleteAccountUI.busy) return; // กำลังลบอยู่ ห้ามปิดกลางคัน (ยิง request ไปแล้ว)
    deleteAccountUI = {open:false, reason:null, busy:false, error:null, done:false};
    render(); return;
  }
  if(act==='delacct-close-final'){
    // เพิ่งลบบัญชีสำเร็จและล้างเครื่องไปหมดแล้วตอน delacct-confirm — ปิดท้ายด้วยการโหลด
    // แอปใหม่ทั้งตัว เพื่อการันตีว่า "เริ่มที่ 0" จริง 100%: ตัวแปรในหน่วยความจำทุกตัวถูก
    // สร้างใหม่จากศูนย์ ไม่ต้องไล่รีเซ็ตทีละตัวแล้วมาลุ้นว่าลืมตัวไหนไปหรือเปล่า
    // (บั๊กเดิมเกิดจากการไล่รีเซ็ตเองแล้วมีตัวที่มองข้ามไป — reload ตัดปัญหานี้ถาวร)
    window.location.reload();
    return;
  }
  if(act==='delacct-confirm'){
    if(!deleteAccountUI.reason || deleteAccountUI.busy) return;
    deleteAccountUI.busy = true; deleteAccountUI.error = null; render();
    var token = (auth.session && auth.session.access_token) || '';
    fetch(apiUrl('/api/delete-account'), {
      method: 'POST',
      headers: {'content-type':'application/json', 'Authorization':'Bearer '+token},
      body: JSON.stringify({reason: deleteAccountUI.reason})
    }).then(function(res){
      return res.json().catch(function(){ return null; }).then(function(data){ return {ok:res.ok, data:data}; });
    }).then(function(r){
      // ต้องได้ {ok:true} ที่เป็น JSON จริงจาก server เท่านั้นถึงจะนับว่าลบสำเร็จ — ห้ามดูแค่
      // res.ok เด็ดขาด เพราะ static server ของ Capacitor ตอบ 200 + index.html ให้ทุก path
      // ที่ไม่รู้จัก (บั๊กเดิมที่ทำให้ขึ้น "ลบบัญชีเรียบร้อยแล้ว" ทั้งที่ไม่มีอะไรถูกลบจริง)
      if(!r.ok || !r.data || r.data.ok !== true){
        deleteAccountUI.busy = false;
        deleteAccountUI.error = (r.data && r.data.error) ||
          'ลบบัญชีไม่สำเร็จ (ติดต่อเซิร์ฟเวอร์ไม่ได้) ยังไม่มีข้อมูลใดถูกลบ ลองใหม่อีกครั้ง';
        render(); return;
      }
      // สำเร็จ: server ลบทุกตารางใน Supabase + ลบ auth user + ตรวจซ้ำว่าเหลือ 0 แล้ว
      // (ดู functions/api/delete-account.js) เหลือหน้าที่ฝั่งนี้อย่างเดียว: ทำให้เครื่องนี้
      // "ไม่เหลืออะไรเลย" จริงๆ ทั้ง 3 ชั้น ไม่งั้นข้อมูลเก่าจะฟื้นกลับมาได้ทุกครั้งที่ล็อกอินใหม่
      //   ชั้นที่ 1) session ของ Supabase — ต้อง signOut() จริง ไม่ใช่แค่ auth.session=null
      //      เพราะ supabase-js เก็บ token ไว้ใน localStorage คีย์ "sb-<ref>-auth-token"
      //      ซึ่งเป็นคนละคีย์กับ gymbro_* ที่เราล้าง มันจึงรอดมาตลอดและทำให้แอปยัง "ล็อกอิน
      //      ค้าง" เป็น user ที่ถูกลบไปแล้วในรอบถัดไป (ต้นตอจริงของบั๊กที่แก้หลายรอบไม่หาย)
      //   ชั้นที่ 2) localStorage — ล้างทั้งก้อนด้วย clear() ไม่ใช่ไล่ลบทีละคีย์ที่นึกออก
      //   ชั้นที่ 3) ตัวแปรในหน่วยความจำ (track/state) + ธง accountDeleted กัน sync ซ้อน
      //      เพราะ hydrateFromRemote() ที่เจอ track.program ค้างอยู่ จะ push มันกลับขึ้น
      //      Supabase ให้บัญชีใหม่ทันทีที่ล็อกอินอีกครั้ง
      accountDeleted = true;
      var finish = function(){
        try{ localStorage.clear(); }catch(e){}
        track.program = null; track.logs = {}; track.weights = {};
        state = freshState();
        auth.session = null;
        deleteAccountUI = {open:true, reason:null, busy:false, error:null, done:true};
        render();
      };
      // signOut() ล้มเหลวได้เป็นปกติหลังบัญชีถูกลบไปแล้ว (server ตอบ 403 user_not_found)
      // ไม่ว่าผลจะเป็นอย่างไรก็ต้องล้างเครื่องต่อเสมอ จึงใช้ finish ตัวเดียวกันทั้งสองทาง
      try{ GymBroSync.signOut().then(finish, finish); }
      catch(e){ finish(); }
    }).catch(function(e){
      deleteAccountUI.busy = false;
      deleteAccountUI.error = 'เชื่อมต่อไม่สำเร็จ: '+(e && e.message ? e.message : e);
      render();
    });
    return;
  }
  if(act==='bf-spin'){
    bodyFatSpinStopAuto();
    bodyFatSpin = {open:true, sex:el.getAttribute('data-sex'), band:el.getAttribute('data-band'),
                   frame:0, drag:null, autoTimer:null};
    render();
    /* หมุนช้าๆ เองตอนเพิ่งเปิด เพื่อให้เห็นทันทีว่าภาพนี้หมุนดูรอบตัวได้ (ไม่ต้องอ่านคำอธิบาย
       ก่อนถึงจะรู้) — หยุดถาวรทันทีที่ผู้ใช้เริ่มควบคุมเอง ไม่แย่งการควบคุมกลับคืน */
    bodyFatSpin.autoTimer = setInterval(function(){
      if(!bodyFatSpin.open){ bodyFatSpinStopAuto(); return; }
      bodyFatSpinShow(bodyFatSpin.frame + 1);
      var r = document.getElementById('bfSpinRange');
      if(r) r.value = bodyFatSpin.frame;
    }, 110);
    return;
  }
  if(act==='bf-spin-close'){
    bodyFatSpinStopAuto();
    bodyFatSpin = {open:false, sex:null, band:null, frame:0, drag:null, autoTimer:null};
    render(); return;
  }
  if(act==='bf-spin-prev' || act==='bf-spin-next'){
    bodyFatSpinStopAuto();
    bodyFatSpinShow(bodyFatSpin.frame + (act==='bf-spin-next' ? 1 : -1));
    var rng = document.getElementById('bfSpinRange');
    if(rng) rng.value = bodyFatSpin.frame;
    return;
  }
  if(act==='coach-ask'){ coachAsk(); return; }
  if(act==='nav'){ if(el.disabled) return; goto(el.getAttribute('data-view')); return; }
  if(act==='tab'){ track.schedTab = el.getAttribute('data-tab'); track.openDate=null; render(); return; }
  if(act==='week-prev'){ track.weekStart = fmtDateISO(addDays(parseISO(track.weekStart), -7)); render(); return; }
  if(act==='week-next'){ track.weekStart = fmtDateISO(addDays(parseISO(track.weekStart), 7)); render(); return; }
  if(act==='week-today'){ track.weekStart = fmtDateISO(startOfWeek(new Date())); render(); return; }
  if(act==='month-prev'){ track.viewMonth.m--; if(track.viewMonth.m<0){track.viewMonth.m=11;track.viewMonth.y--;} track.openDate=null; render(); return; }
  if(act==='month-next'){ track.viewMonth.m++; if(track.viewMonth.m>11){track.viewMonth.m=0;track.viewMonth.y++;} track.openDate=null; render(); return; }
  if(act==='month-today'){ var td=new Date(); track.viewMonth={y:td.getFullYear(),m:td.getMonth()}; track.openDate=null; render(); return; }
  if(act==='open-day'){ track.openDate = iso; track.saveStatus=''; track.scrollToPanel=true; render(); return; }
  if(act==='close-day'){ track.openDate=null; track.saveStatus=''; render(); return; }
  if(act==='clear-day'){
    if(!isEditable(iso)) return;
    delete track.logs[iso];
    persistLogs();
    track.saveStatus=''; track.openDate=null; render();
    return;
  }
  if(act==='ex-toggle'){
    var key = iso+':'+el.getAttribute('data-ex');
    track.openSets[key] = !track.openSets[key];
    render(); return;
  }
  if(act==='bench-toggle'){
    var bkey = iso+':'+el.getAttribute('data-ex');
    track.openBench[bkey] = !track.openBench[bkey];
    render(); return;
  }
  if(act==='meal'){
    var idx = parseInt(el.getAttribute('data-idx'),10);
    var cur = logFor(iso) || {};
    var meals = ((cur.nutrition||{}).meals || []).slice();
    meals[idx] = !meals[idx];
    patchNutrition(iso, {meals:meals});
    return;
  }
  if(act==='hist-open'){ track.histOpen = (track.histOpen===iso ? null : iso); track.saveStatus=''; render(); return; }
  if(act==='sym-toggle'){ var sk = iso+':'+el.getAttribute('data-ex'); track.openSym[sk] = !track.openSym[sk]; render(); return; }
  if(act==='sym-chip' || act==='sym-clear'){
    var sex = el.getAttribute('data-ex');
    var cur = ((((logFor(iso)||{}).exercises||{})[sex]||{}).symptom||{}).text || '';
    var nextTxt = act==='sym-clear' ? '' : (cur ? cur+', ' : '')+el.getAttribute('data-val');
    saveSymptom(iso, sex, nextTxt, exerciseName(iso, sex));
    return;
  }
  if(act==='stress-lvl'){
    var sv = parseInt(el.getAttribute('data-val'), 10), sc = stressOf(iso);
    patchStress(iso, {level: sc && sc.level===sv ? null : sv});
    return;
  }
  if(act==='stress-chip' || act==='stress-clear'){
    var sn = (((logFor(iso)||{}).stress)||{}).note || '';
    patchStress(iso, {note: act==='stress-clear' ? '' : ((sn ? sn+', ' : '')+el.getAttribute('data-val')).slice(0, 200)});
    return;
  }
  if(act==='food-toggle'){ var fk = iso+':'+el.getAttribute('data-cat'); track.openFood[fk] = !track.openFood[fk]; render(); return; }
  if(act==='food-add'){ addFood(iso, el.getAttribute('data-cat')); return; }
  if(act==='food-del'){ removeFood(iso, parseInt(el.getAttribute('data-idx'),10)); return; }
  if(act==='fat-toggle'){ track.fatOpen = !track.fatOpen; render(); return; }
  if(act==='fat-ack'){ var ft = fatTug(track.program); lsSet('gymbro_fat_seen', {gains:ft.gains.length, losses:ft.losses.length}); render(); return; }
  if(act==='hist-more'){ track.histDays += 14; render(); return; }
  if(act==='pg-more'){ track.pgMore = !track.pgMore; render(); return; }
  if(act==='pg-goto'){ track.pgMore = true; goto('progress'); return; } // มาจากแจ้งเตือนหน้าวันนี้ → เปิดผลประเมินให้เห็นทันที
  if(act==='pg-crit'){ track.pgCrit = !track.pgCrit; render(); return; }
  if(act==='pg-open'){ track.pgOpen = !track.pgOpen; render(); return; }
  if(act==='pg-confirm'){ if(el.disabled) return; track.pgChecks = {}; pgSave({confirmedAt: todayISO()}); return; }
  if(act==='pg-unconfirm'){ pgSave({confirmedAt: null}); return; }
  if(act==='pg-reset'){ track.pgResetAsk = !track.pgResetAsk; render(); return; }
  if(act==='pg-reset-go'){
    track.pgResetAsk = false; track.pgChecks = {};
    pgSave({evalFrom: todayISO(), confirmedAt: null, resets: (pgState(track.program).resets||[]).concat([todayISO()])});
    return;
  }
  if(act==='pg-apply'){ pgApply(); return; }
  if(act==='progress-ex'){ track.progressEx = el.getAttribute('data-ex'); render(); return; }
  if(act==='hard-restart'){
    lsRemove("gymbro_program"); lsRemove("gymbro_logs"); lsRemove("gymbro_weights"); lsRemove("gymbro_onb_proto"); lsRemove("gymbro_fat_seen");
    track.program = null; track.logs = {}; track.weights = {};
    state = freshState();
    render(true);
    return;
  }
  if(act==='edit-plan'){
    if(track.program){
      var ep = track.program;
      state.plan.trainDays = (ep.days||[]).slice();
      state.plan.cardioDays = (ep.cardioDays||[]).slice();
      state.plan.cardioMinByDay = {};
      state.plan.cardioDays.forEach(function(d){ state.plan.cardioMinByDay[d] = cardioMinFor(ep, d); });
      state.plan.intensity = {};
      (ep.sessions||[]).forEach(function(se){ se.exercises.forEach(function(ex){ if(ex.intensity==='intense') state.plan.intensity[ex.slot||ex.pattern] = 'intense'; }); });
    }
    track.schedDraft = null;
    state.editPlan=true; state.step=9; state.mode='results'; track.editing=false; persist(); render(true); return; }
  if(act==='exit-edit'){ state.editPlan=false; track.editing=false; persist(); render(true); return; }
  if(act==='edit-start'){ if(el.disabled) return; track.editing=true; track.saveStatus=''; render(); return; }
  if(act==='cancel-start'){ track.editing=false; render(); return; }
  if(act==='save-start'){
    var input = document.getElementById('startDateInput');
    var val = input ? input.value : '';
    if(!val) return;
    var snap;
    if(track.program && !state.editPlan){
      snap = {};
      Object.keys(track.program).forEach(function(k){ snap[k]=track.program[k]; });
      snap.startDate = val;
    } else {
      // C-01/C-02: ด่านสุดท้ายก่อนล็อกแผนจริง ต้องตรวจซ้ำเสมอ ไม่พึ่งแค่ "ready" ตอนอยู่
      // หน้าสรุป — เพราะเข้าถึงหน้านี้ได้จากหลายทาง (rail jump, session เก่าที่ค้าง
      // mode='results' จากก่อนมี gate นี้) ห้ามล็อกแผนที่มีข้อมูลไม่ครบ/ไม่ปลอดภัยเด็ดขาด
      var gateIssues = sanityIssues(state.answers);
      var gateSafety = safetyGate(state.answers);
      if(!inScope(state.answers) || gateIssues.length || gateSafety.blocked){
        track.saveStatus = 'ยังสร้างตารางไม่ได้ — ข้อมูลไม่ครบหรืออยู่นอกขอบเขตที่รองรับ ('+
          (gateSafety.blocked ? gateSafety.reason : (gateIssues[0] || 'เป้าหมาย/สถานที่ยังไม่รองรับ'))+') กลับไปแก้แบบสอบถามก่อน';
        render();
        return;
      }
      var gSplit = effectiveSplit(state.answers);
      if(planTrainDays(state.answers).length < minTrainDays(gSplit, state.answers)){
        track.saveStatus = 'ยังสร้างตารางไม่ได้ — '+SPLIT_DEFS[gSplit].label+' ต้องมีวันฝึกอย่างน้อย '+minTrainDays(gSplit, state.answers)+' วัน/สัปดาห์';
        render();
        return;
      }
      var gSch = bestSchedule(SPLIT_DEFS[gSplit].sessions, planTrainDays(state.answers));
      if(gSch.hard){
        track.saveStatus = 'ยังสร้างตารางไม่ได้ — '+clashText(gSch.clash)+' กล้ามเนื้อต้องพัก ~48 ชม. ปรับวันฝึกก่อน';
        render();
        return;
      }
      snap = buildPlanSnapshot(state.answers);
      snap.startDate = val;
      snap.planId = Date.now().toString(36);
      snap.createdAt = new Date().toISOString();
    }
    track.program = snap;
    var ok = persistProgram();
    track.editing = false;
    track.saveStatus = ok ? '' : 'บันทึกไม่ได้ — พื้นที่จัดเก็บของเบราว์เซอร์ใช้ไม่ได้ตอนนี้';
    state.editPlan=false; state.nav='today'; persist();
    render(true);
    return;
  }
  /* onboarding */
  if(act==='opt'){ setAnswer(el.getAttribute('data-qid'), el.getAttribute('data-val'), el.getAttribute('data-kind')); return; }
  if(act==='rail'){ if(el.disabled) return; state.step = parseInt(el.getAttribute('data-idx'),10); state.mode=null; persist(); render(true); return; }
  if(act==='back'){ if(state.step>0){ state.step--; persist(); render(true);} return; }
  if(act==='next'){ if(!catComplete(CATEGORIES[state.step].id)) return; state.step++; persist(); render(true); return; }
  if(act==='back-steps'){ state.step=8; state.mode=null; persist(); render(true); return; }
  if(act==='gen'){ state.mode='results'; persist(); render(true); return; }
  if(act==='back-summary'){ state.mode=null; track.editing=false; persist(); render(true); return; }
  if(act==='restart'){
    var keepNav = state.nav;
    state = freshState(); state.nav = keepNav; state.editPlan = !!track.program;
    persist(); render(true); return;
  }
  if(act==='split' || act==='split-auto'){
    if(el.disabled) return;
    state.plan.splitOverride = act==='split' ? el.getAttribute('data-split') : null; state.plan.manualPick={};
    // วันที่เลือกไว้กับแบบเดิมอาจชนกันในแบบใหม่ (เช่น เปลี่ยนเป็น Full Body ที่ต้องเว้นวัน) → กลับไปใช้ชุดวันอัตโนมัติ
    var nSplit = effectiveSplit(state.answers), nDays = state.plan.trainDays ? inAvailable(state.plan.trainDays, state.answers) : null;
    if(nDays && (bestSchedule(SPLIT_DEFS[nSplit].sessions, nDays).hard || nDays.length < minTrainDays(nSplit, state.answers))) state.plan.trainDays = null;
    track.schedMsg = '';
    persist(); render(); return;
  }
  if(act==='train-day' || act==='cardio-day'){
    var sctx = el.getAttribute('data-ctx'), sl = schedLists(sctx);
    var list = (act==='train-day' ? sl.train : sl.cardio).slice();
    var dday = el.getAttribute('data-day'), at = list.indexOf(dday);
    track.schedMsg = '';
    if(act==='train-day' && at===-1){
      var tsess = sctx==='prog' ? (track.program.sessions||[]) : SPLIT_DEFS[effectiveSplit(state.answers)].sessions;
      var tcur = bestSchedule(tsess, list), tnext = bestSchedule(tsess, list.concat([dday]));
      if(!tcur.hard && tnext.hard){
        track.schedMsg = 'เลือก'+dday+'เป็นวันฝึกไม่ได้ — จะทำให้'+clashText(tnext.clash)+' กล้ามเนื้อต้องพัก ~48 ชม. (วันนี้ใช้เป็นวันพักหรือวัน cardio ได้)';
        render(); return;
      }
    }
    if(at>-1) list.splice(at,1); else list.push(dday);
    if(act==='train-day') setSchedLists(sctx, list, sl.cardio); else setSchedLists(sctx, sl.train, list);
    return;
  }
  if(act==='sched-edit'){ track.schedMsg=''; openSchedDraft(); render(); return; }
  if(act==='sched-edit-go'){ track.schedMsg=''; openSchedDraft(); state.nav='plan'; persist(); render(true); return; }
  if(act==='sched-cancel'){ track.schedDraft=null; track.schedMsg=''; track.saveStatus=''; render(); return; }
  if(act==='sched-save'){ saveSchedDraft(); return; }
  if(act==='intensity'){
    var ipat = el.getAttribute('data-pattern');
    state.plan.intensity = state.plan.intensity || {};
    if(el.getAttribute('data-val')==='intense') state.plan.intensity[ipat] = 'intense'; else delete state.plan.intensity[ipat];
    persist(); render(); return;
  }
  if(act==='intensity-all'){
    state.plan.intensity = {};
    if(el.getAttribute('data-val')==='intense'){
      SPLIT_DEFS[effectiveSplit(state.answers)].sessions.forEach(function(se){ se.patterns.forEach(function(pt){
        if(intensityEligible(selectionFor(pt, state.answers).picked)) state.plan.intensity[pt] = 'intense';
      }); });
    }
    persist(); render(); return;
  }
  if(act==='swap-toggle'){ var pt=el.getAttribute('data-pattern'); track.openSwap = (track.openSwap===pt? null : pt); render(); return; }
  if(act==='demo'){ track.demoExercise = {exId:el.getAttribute('data-exid'), pattern:el.getAttribute('data-pattern'), th:el.getAttribute('data-th'), sub:el.getAttribute('data-sub')}; render(); return; }
  if(act==='demo-stop'){ return; } // คลิกภายในโมดัลไม่ปิด (กันคลิกทะลุไป backdrop)
  if(act==='demo-close'){ track.demoExercise = null; render(); return; }
  if(act==='swap'){ state.plan.manualPick[el.getAttribute('data-pattern')] = el.getAttribute('data-swap'); persist(); render(); return; }
  if(act==='unlock'){
    var pat = el.getAttribute('data-pattern');
    state.plan.unlockedEx[el.getAttribute('data-unlock')] = true;
    state.plan.forceLowTier[slotBase(pat)] = true;
    delete state.plan.manualPick[pat];
    persist(); render(); return;
  }
}, false);

document.addEventListener("change", function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
  if(!el) return;
  var act = el.getAttribute('data-act');
  var iso = el.getAttribute('data-date');
  if(act==='ex-done'){ patchExercise(iso, el.getAttribute('data-ex'), {done: el.checked}); return; }
  if(act==='set'){ patchExercise(iso, el.getAttribute('data-ex'), {sets: setsFromDom(el.getAttribute('data-ex'), iso)}); return; }
  if(act==='symptom'){ var syx = el.getAttribute('data-ex'); saveSymptom(iso, syx, el.value, exerciseName(iso, syx)); return; }
  if(act==='food-pick'){ updateFoodPreview(iso, el.getAttribute('data-cat')); return; }
  if(act==='warmup'){
    var wex = el.getAttribute('data-ex');
    var wflags = (((logFor(iso)||{}).exercises||{})[wex]||{}).warmup || [];
    wflags = wflags.slice();
    wflags[parseInt(el.getAttribute('data-idx'),10)] = el.checked;
    for(var wi=0; wi<wflags.length; wi++) wflags[wi] = !!wflags[wi];
    patchExercise(iso, wex, {warmup: wflags});
    return;
  }
  if(act==='sess-complete'){ saveDay(iso, {completed: el.checked}); return; }
  if(act==='nut'){ var p={}; p[el.getAttribute('data-field')] = numOrNull(el.value); patchNutrition(iso, p); return; }
  if(act==='sleep-h'){
    var hr = numInRange(el.value, 0, 24); // N-02: ปฏิเสธค่านอก 0-24 ชม. ไม่บันทึก ไม่ clamp เงียบๆ
    track.sleepHoursError[iso] = !hr.valid;
    if(hr.valid) patchSleep(iso, {hours: hr.value});
    else render(); // แสดง error โดยไม่เขียนทับค่าที่ถูกต้องล่าสุดในเครื่อง
    return;
  }
  if(act==='sleep-hyg'){ patchSleep(iso, {hygiene: el.checked}); return; }
  if(act==='stress-note'){ patchStress(iso, {note: String(el.value||'').trim().slice(0, 200)}); return; }
  if(act==='pg-check'){ track.pgChecks[el.getAttribute('data-k')] = el.checked; render(); return; }
  if(act==='cardio-min'){
    var cm = numInRange(el.value, 0, 600);
    if(el.value==='') saveDay(iso, {cardio:{}});
    else if(cm.valid) saveDay(iso, {cardio:{minutes: Math.round(cm.value)}});
    else render();
    return;
  }
  if(act==='cardio-day-min'){
    var cmctx = el.getAttribute('data-ctx'), cmv = numInRange(el.value, 5, 300);
    if(cmv.valid && cmv.value!=null){
      schedLists(cmctx).mins[el.getAttribute('data-day')] = Math.round(cmv.value);
      if(cmctx!=='prog') persist();
    }
    render(); return;
  }
  if(act==='weight'){
    var kg = numOrNull(el.value);
    if(kg==null){ return; }
    saveWeight(iso, kg); return;
  }
  if(act==='field'){ setField(el.getAttribute('data-fid'), el.value); return; }
}, false);

/* set (น้ำหนัก/ครั้ง ต่อเซ็ต) ต้องอัปเดตสด ๆ ระหว่างพิมพ์ ไม่ต้องรอ blur/change ก่อน —
   ผลลัพธ์ Performance vs Benchmark ใต้ท่านั้นถึงจะขึ้นทันทีที่กรอกครบ ไม่ต้องคลิกออก
   จาก field ก่อน (ฟิลด์อื่น เช่น โภชนาการ/การนอน ยังใช้ change ตามเดิม ไม่แตะ) */
document.addEventListener("input", function(ev){
  /* แถบเลื่อนมุมของภาพหมุน 360° — จัดการก่อน เพราะไม่ใช่ data-act="set" (ช่องกรอกเซ็ต) */
  if(ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act')==='bf-spin-range'){
    bodyFatSpinStopAuto();
    bodyFatSpinShow(parseInt(ev.target.value, 10) || 0);
    return;
  }
  if(ev.target && ev.target.getAttribute && ev.target.getAttribute('data-act')==='food-grams'){
    updateFoodPreview(ev.target.getAttribute('data-date'), ev.target.getAttribute('data-cat'));
    return;
  }
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act="set"]') : null;
  if(!el) return;
  var iso = el.getAttribute('data-date');
  patchExercise(iso, el.getAttribute('data-ex'), {sets: setsFromDom(el.getAttribute('data-ex'), iso)});
}, false);

/* ---------- ลากเพื่อหมุนภาพ 360° ----------
   ใช้ Pointer Events ตัวเดียวครอบทั้งเมาส์และนิ้ว (Android WebView รองรับครบ) ผูกไว้ที่
   document แบบ delegated เหมือน listener อื่นๆ ของแอป เพราะโมดัลถูกสร้างใหม่ทุกครั้งที่
   render() — ผูก listener ไว้ที่ตัว stage โดยตรงจะหลุดทุกครั้งที่หน้าถูกวาดใหม่
   ระยะลากต่อ 1 เฟรม คิดจากความกว้างจริงของ stage หารด้วยจำนวนเฟรม เพื่อให้ "ลากสุดความ
   กว้างภาพ = หมุนครบ 1 รอบ" เท่ากันทุกขนาดหน้าจอ ไม่ต้องปรับค่าคงที่ตามอุปกรณ์ */
document.addEventListener("pointerdown", function(ev){
  if(!bodyFatSpin.open) return;
  var stage = ev.target && ev.target.closest ? ev.target.closest('.bf-spin-stage') : null;
  if(!stage) return;
  bodyFatSpinStopAuto();
  var w = stage.getBoundingClientRect().width || 1;
  bodyFatSpin.drag = {x: ev.clientX, startFrame: bodyFatSpin.frame, perFrame: w / BODYFAT_SPIN_FRAMES};
  if(stage.setPointerCapture){ try{ stage.setPointerCapture(ev.pointerId); }catch(e){} }
  ev.preventDefault();
}, false);

document.addEventListener("pointermove", function(ev){
  var d = bodyFatSpin.drag;
  if(!bodyFatSpin.open || !d) return;
  // ลากไปทางขวา = ตัวแบบหมุนตามมือ (ทิศเดียวกับที่คนคาดหวังเวลาหมุนของจริงด้วยนิ้ว)
  var steps = Math.round((ev.clientX - d.x) / d.perFrame);
  bodyFatSpinShow(d.startFrame + steps);
  var r = document.getElementById('bfSpinRange');
  if(r) r.value = bodyFatSpin.frame;
  ev.preventDefault();
}, false);

function bodyFatSpinEndDrag(){ if(bodyFatSpin.drag) bodyFatSpin.drag = null; }
document.addEventListener("pointerup", bodyFatSpinEndDrag, false);
document.addEventListener("pointercancel", bodyFatSpinEndDrag, false);

/* กด Enter ในช่องถามโค้ชให้ส่งคำถามได้เลย ไม่ต้องกดปุ่มเสมอไป
   กด Escape ปิดโมดัลภาพเคลื่อนไหวท่า (ถ้าเปิดอยู่) */
document.addEventListener("keydown", function(ev){
  if(ev.key==='Enter' && ev.target && ev.target.id==='coachInput'){ ev.preventDefault(); coachAsk(); return; }
  if(ev.key==='Escape' && bodyFatSpin.open){
    bodyFatSpinStopAuto();
    bodyFatSpin = {open:false, sex:null, band:null, frame:0, drag:null, autoTimer:null};
    render(); return;
  }
  if(ev.key==='Escape' && track.demoExercise){ track.demoExercise = null; render(); }
}, false);

/* ---------- ครั้งแรกหลัง sign in: ดึงข้อมูลจาก Supabase มาแทนของในเครื่อง ถ้ายังไม่เคย
   มีข้อมูลบน Supabase เลย (บัญชีใหม่/เพิ่งย้ายจาก local-only) ให้ส่งของในเครื่องขึ้นไป
   แทน (migrate ครั้งแรก) ทำทีละตารางเรียงลำดับ ไม่ Promise.all รวมเพราะไม่รีบและ debug ง่ายกว่า
   ผิดพลาดจุดไหนก็ไม่ทำให้แอปพัง (catch เงียบ แล้วไปต่อขั้นถัดไป) */
/* กติกา merge: "ของในเครื่องนี้ชนะเสมอถ้ามีอยู่แล้ว" — pull จาก remote มาทับเฉพาะตอนที่
   ในเครื่องนี้ "ไม่มี" ข้อมูลนั้นอยู่เลย (เช่น เพิ่งสมัคร/เพิ่งเปิดเครื่องใหม่ที่ไม่เคยมีข้อมูล)
   ป้องกันปัญหาที่เจอจริงตอนทดสอบ: ถ้า pull ทับเสมอไม่ว่าจะมีของในเครื่องอยู่แล้วหรือไม่ —
   reload หน้าเว็บกลางคันตอนกำลังตอบแบบสอบถาม/พิมพ์ค่าอยู่ (ซึ่ง push ขึ้น remote แบบ
   background อาจยังไปไม่ถึง) จะโดนข้อมูลเก่ากว่าจาก remote ทับข้อมูลที่เพิ่งพิมพ์ไปหายเงียบๆ
   ทันที ขัดกับหลักการ "ห้ามทำข้อมูลผู้ใช้หายเงียบๆ" ที่ยึดมาตลอดทั้งโปรเจกต์
   สำหรับ logs/weights (เป็น dict คีย์ด้วยวันที่) merge แบบ union ต่อวัน: วันที่มีในเครื่อง
   แล้วใช้ของเครื่อง วันที่มีเฉพาะบน remote (เช่นบันทึกไว้จากอีกเครื่อง) ดึงมาเพิ่ม */
function hydrateFromRemote(userId){
  // เพิ่งลบบัญชีไปในเซสชันนี้ — ห้าม sync อะไรทั้งสิ้นจนกว่าจะรีโหลด (ดู accountDeleted)
  if(accountDeleted) return Promise.resolve();
  return GymBroSync.pullProgram(userId).then(function(res){
    var remote = res && res.data && res.data.payload;
    if(!track.program && remote){ track.program = remote; lsSet("gymbro_program", track.program); }
    else if(track.program){ return GymBroSync.pushProgram(userId, track.program); }
  }).catch(function(){}).then(function(){
    return GymBroSync.pullDailyLogs(userId);
  }).then(function(res){
    var rows = (res && res.data) || [];
    var merged = {}, toPush = [];
    Object.keys(track.logs).forEach(function(d){ merged[d] = track.logs[d]; });
    // stub (วันว่างที่ระบบล็อกให้เอง) ต้องไม่ชนะข้อมูลจริงที่บันทึกไว้จากเครื่องอื่น
    rows.forEach(function(r){
      var loc = merged[r.log_date];
      if(!loc || (loc.stub && r.payload && !r.payload.stub)) merged[r.log_date] = r.payload;
    });
    Object.keys(track.logs).forEach(function(d){ if(merged[d]===track.logs[d]) toPush.push(GymBroSync.pushDailyLog(userId, d, track.logs[d])); });
    track.logs = merged; lsSet("gymbro_logs", track.logs);
    if(toPush.length) return Promise.all(toPush);
  }).catch(function(){}).then(function(){
    return GymBroSync.pullWeights(userId);
  }).then(function(res){
    var rows = (res && res.data) || [];
    var merged = {}, toPush = [];
    Object.keys(track.weights).forEach(function(d){ merged[d] = track.weights[d]; });
    rows.forEach(function(r){ if(!(r.log_date in merged)) merged[r.log_date] = {date:r.log_date, kg:r.kg}; });
    Object.keys(track.weights).forEach(function(d){ toPush.push(GymBroSync.pushWeight(userId, d, track.weights[d].kg)); });
    track.weights = merged; lsSet("gymbro_weights", track.weights);
    if(toPush.length) return Promise.all(toPush);
  }).catch(function(){}).then(function(){
    return GymBroSync.pullOnboarding(userId);
  }).then(function(res){
    var remote = res && res.data && res.data.payload;
    var hasLocalAnswers = state.answers && Object.keys(state.answers).length>0;
    if(!hasLocalAnswers && remote && typeof remote==='object'){
      state.step = remote.step||0;
      state.answers = remote.answers||{};
      state.mode = remote.mode||null;
      state.nav = remote.nav||'today';
      state.editPlan = false;
      if(remote.plan && typeof remote.plan==='object'){
        state.plan.manualPick = remote.plan.manualPick||{};
        state.plan.unlockedEx = remote.plan.unlockedEx||{};
        state.plan.forceLowTier = remote.plan.forceLowTier||{};
        state.plan.splitOverride = remote.plan.splitOverride||null;
        loadPlanSchedule(state.plan, remote.plan);
      }
      lsSet("gymbro_onb_proto", state);
    } else if(hasLocalAnswers){
      return GymBroSync.pushOnboarding(userId, state);
    }
  }).catch(function(){}).then(function(){ track.finalizedThrough = null; });
}

/* ---------- boot: เช็ค session ก่อน render ครั้งแรกเสมอ ถ้า Supabase โหลดไม่ได้เลย
   (ออฟไลน์/ถูกบล็อก) ข้ามระบบ auth ไปทั้งหมด ใช้แอปแบบ local-only เหมือนเดิมทุกประการ ---------- */
function boot(){
  if(!syncAvailable()){ auth.ready = true; render(true); return; }
  /* ดัก deep link ที่ Supabase ส่ง Google OAuth token กลับมาตอนรันเป็นแอป native
     (ดู signInWithGoogle/handleNativeAuthCallback ใน supabase-client.js) — เช็ค
     window.Capacitor ตรงๆ เฉยๆ เพราะเป็น global ที่ Capacitor inject ให้เองตอนรันจริง
     บนเครื่อง ไม่มีทางเจอตอนเปิดผ่านเว็บปกติ จึงไม่กระทบเว็บเลย */
  if(typeof window.Capacitor!=='undefined' && window.Capacitor.isNativePlatform && window.Capacitor.isNativePlatform()){
    window.Capacitor.Plugins.App.addListener('appUrlOpen', function(data){
      GymBroSync.handleNativeAuthCallback(data && data.url);
    });
    /* ผู้ใช้กด back/ปิด Custom Tab เองโดยไม่ทำ Google sign-in จนจบ (ยกเลิกกลางทาง) —
       ถ้าไม่ดัก event นี้ไว้ ปุ่มจะค้างที่ "กำลังเชื่อมต่อ..." ตลอดไป เพราะ Promise ของ
       Browser.open() resolve ไปตั้งแต่ตอนเปิดแท็บสำเร็จแล้ว (ไม่ได้รอจนกว่าจะปิด) จุดเดียว
       ที่รู้ว่าแท็บปิดแล้วคือ event นี้ — เช็ค !auth.session ก่อนรีเซ็ต เผื่อ sign-in จริงๆ
       สำเร็จไปแล้วและ handleNativeAuthCallback/onAuthChange กำลังจะ render หน้าอื่นอยู่ */
    window.Capacitor.Plugins.Browser.addListener('browserFinished', function(){
      if(authState.busy && !auth.session){ authState.busy = false; render(); }
    });
  }
  GymBroSync.onAuthChange(function(event, session){
    var hadSession = !!auth.session;
    auth.session = session || null;
    if(!auth.ready) return; // รอบแรกให้ getSession() ด้านล่างเป็นคนจัดการ render
    if(session && !hadSession) hydrateFromRemote(session.user.id).then(function(){ render(true); });
    else render(true);
  });
  GymBroSync.getSession().then(function(res){
    var session = res && res.data && res.data.session;
    auth.session = session || null;
    auth.ready = true;
    if(session) hydrateFromRemote(session.user.id).then(function(){ render(true); });
    else render(true);
  }).catch(function(){ auth.ready = true; render(true); });
}
boot();
})();
