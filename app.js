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
var authState = {mode:'signin', error:null, busy:false};
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

var QUESTIONS = [
  {id:"Q1", cat:1, kind:"single", main:true, label:"เป้าหมายหลักของคุณตอนนี้คืออะไร?",
    options:Object.keys(BENCH), visible:function(){return true;}},

  {id:"Q2", cat:1, kind:"multi", main:true, label:"วันไหนบ้างที่คุณว่างสำหรับออกกำลังกาย?",
    options:DAYS, note:"multi-select — เลือกได้หลายวัน", visible:function(){return true;}},

  {id:"Q3", cat:1, kind:"single", main:true, label:"โดยเฉลี่ยแต่ละครั้งคุณมีเวลาเท่าไหร่?",
    options:["น้อยกว่า 20 นาที","20-45 นาที","45-60 นาที","มากกว่า 60 นาที"], visible:function(){return true;}},

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

  {id:"Q9", cat:2, kind:"single", main:true, label:"เพศ", options:["ชาย","หญิง"], visible:function(){return true;}},
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
    options:["ดัมเบล","บาร์เบล","ยางยืด","ม้านั่ง","บาร์โหน","ไม่มีอุปกรณ์เลย"],
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
  {id:'sq3',pattern:'squat',tier:3,equip:'machine',th:'Leg Press Machine',sub:'เครื่องเลกเพรส'},
  {id:'sq4',pattern:'squat',tier:4,equip:'barbell',th:'Barbell Back Squat',sub:'สควอทบาร์เบล'},

  {id:'hg1',pattern:'hinge',tier:1,equip:'bodyweight',th:'Glute Bridge',sub:'สะพานสะโพก'},
  {id:'hg2',pattern:'hinge',tier:2,equip:'dumbbell',th:'Romanian Deadlift (Dumbbell)',sub:'RDL ดัมเบล'},
  {id:'hg3',pattern:'hinge',tier:3,equip:'machine',th:'Hip Thrust Machine',sub:'เครื่องฮิปทรัสต์'},
  {id:'hg4',pattern:'hinge',tier:4,equip:'barbell',th:'Barbell Deadlift',sub:'เดดลิฟต์บาร์เบล'},

  {id:'hp1',pattern:'hpush',tier:1,equip:'bodyweight',th:'Wall Push-up',sub:'พุชอัพกำแพง'},
  {id:'hp2a',pattern:'hpush',tier:2,equip:'bodyweight',th:'Knee Push-up',sub:'พุชอัพคุกเข่า'},
  {id:'hp2b',pattern:'hpush',tier:2,equip:'machine',th:'Chest Press Machine',sub:'เครื่องเชสต์เพรส'},
  {id:'hp3',pattern:'hpush',tier:3,equip:'dumbbell',th:'Dumbbell Bench Press',sub:'เบนช์เพรสดัมเบล'},
  {id:'hp4',pattern:'hpush',tier:4,equip:'barbell',th:'Barbell Bench Press',sub:'เบนช์เพรสบาร์เบล'},

  {id:'hl1',pattern:'hpull',tier:1,equip:'cable',th:'Seated Cable Row (น้ำหนักเบา)',sub:'พายเคเบิลนั่งเบา'},
  {id:'hl1b',pattern:'hpull',tier:1,equip:'bodyweight',th:'Superman',sub:'เหยียดหลังท่าซุปเปอร์แมน (ไม่ใช้อุปกรณ์)'},
  {id:'hl2',pattern:'hpull',tier:2,equip:'cable',th:'Seated Cable Row',sub:'พายเคเบิลนั่ง'},
  {id:'hl3',pattern:'hpull',tier:3,equip:'dumbbell',th:'Dumbbell Bent-over Row',sub:'ก้มพายดัมเบล'},
  {id:'hl4',pattern:'hpull',tier:4,equip:'barbell',th:'Barbell Bent-over Row',sub:'ก้มพายบาร์เบล'},

  {id:'vl1',pattern:'vpull',tier:1,equip:'machine',th:'Assisted Pull-up Machine',sub:'ดึงข้อช่วยเครื่อง'},
  {id:'vl2',pattern:'vpull',tier:2,equip:'machine',th:'Lat Pulldown',sub:'ดึงลัทดาวน์'},
  {id:'vl3',pattern:'vpull',tier:3,equip:'dumbbell',th:'Dumbbell Pullover',sub:'พูลโอเวอร์ดัมเบล'},
  {id:'vl4',pattern:'vpull',tier:4,equip:'pullupbar',th:'Pull-up',sub:'ดึงข้อ (ต้องมีบาร์โหน)'},

  {id:'vp1',pattern:'vpush',tier:1,equip:'machine',th:'Shoulder Press Machine (น้ำหนักเบา)',sub:'เครื่องดันไหล่เบา'},
  {id:'vp1b',pattern:'vpush',tier:1,equip:'bodyweight',th:'Pike Push-up',sub:'พุชอัพท่าไพค์ เน้นไหล่ (ไม่ใช้อุปกรณ์)'},
  {id:'vp2',pattern:'vpush',tier:2,equip:'machine',th:'Shoulder Press Machine',sub:'เครื่องดันไหล่'},
  {id:'vp3',pattern:'vpush',tier:3,equip:'dumbbell',th:'Dumbbell Shoulder Press',sub:'ดันไหล่ดัมเบล'},
  {id:'vp4',pattern:'vpush',tier:4,equip:'barbell',th:'Barbell Overhead Press',sub:'ดันไหล่บาร์เบลเหนือศีรษะ'},

  {id:'co1',pattern:'core',tier:1,equip:'bodyweight',th:'Plank',sub:'แพลงก์'},
  {id:'co2',pattern:'core',tier:2,equip:'bodyweight',th:'Dead Bug',sub:'เดดบั๊ก'},
  {id:'co3',pattern:'core',tier:3,equip:'cable',th:'Cable Woodchopper',sub:'วู้ดช็อปเปอร์เคเบิล'},
  {id:'co4',pattern:'core',tier:4,equip:'pullupbar',th:'Hanging Leg Raise',sub:'ยกขาห้อยตัว (ต้องมีบาร์โหน)'},

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

var PATTERN_ORDER = ['squat','hpush','hpull','hinge','vpull','vpush','core'];
var PATTERN_LABEL = {
  squat:'Squat Pattern — ขา / ก้น', hinge:'Hinge Pattern — หลังขา / สะโพก',
  hpush:'Horizontal Push — อก / ไหล่หน้า / ไทรเซป', hpull:'Horizontal Pull — หลังกลาง',
  vpull:'Vertical Pull — หลังกว้าง / ไบเซป', vpush:'Vertical Push — ไหล่',
  core:'Core — แกนกลางลำตัว',
  biceps:'Biceps — กล้ามแขนหน้า', triceps:'Triceps — กล้ามแขนหลัง'
};
var PATTERN_SHORT = {
  squat:'ขา', hinge:'หลังขา/สะโพก', hpush:'อก/ไหล่หน้า', hpull:'หลังกลาง',
  vpull:'หลังกว้าง', vpush:'ไหล่', core:'แกนกลาง', biceps:'ไบเซป', triceps:'ไทรเซป'
};

var EXCLUSION_MAP = {
  'เข่า':['sq3','sq4'],
  'ไหล่':['vp3','vp4','tc3','tc4'],
  'หลัง':['hg3','hg4','bc4'],
  'ข้อมือ':['hp2a','hp3','hp4','bc4','tc4'],
  'หัวใจ-หลอดเลือด':['sq4','hg4','hp4','vp4','hl4','bc4','tc4']
};

var SPLIT_DEFS = {
  fullbody: {
    key:'fullbody', label:'Full Body', minDays:1, minRank:0,
    desc:'ทุกกลุ่มกล้ามเนื้อในเซสชันเดียว ทำซ้ำทุกวันที่เลือก — ปลอดภัยสุดสำหรับมือใหม่ ต้องการวันว่างน้อยสุด',
    sessions:[{key:'Full Body', patterns:PATTERN_ORDER}]
  },
  ul: {
    key:'ul', label:'Upper / Lower', minDays:4, minRank:1,
    desc:'แยกวันบนตัว (Upper) กับล่างตัว (Lower) สลับกัน ให้แต่ละกลุ่มกล้ามเนื้อพักได้นานขึ้น ต้องมีวันว่างอย่างน้อย 4 วัน/สัปดาห์',
    sessions:[
      {key:'Upper', patterns:['hpush','hpull','vpush','vpull']},
      {key:'Lower', patterns:['squat','hinge','core']}
    ]
  },
  ppl: {
    key:'ppl', label:'Push / Pull / Legs', minDays:3, minRank:2,
    desc:'แยกวันดัน (Push) ดึง (Pull) และขา (Legs) หมุนวนกัน เหมาะกับคนที่ออกกำลังกายประจำและมีวันว่างพอจะฝึกแต่ละกลุ่มด้วยโวลุ่มสูงขึ้น',
    sessions:[
      {key:'Push', patterns:['hpush','vpush']},
      {key:'Pull', patterns:['hpull','vpull']},
      {key:'Legs', patterns:['squat','hinge','core']}
    ]
  },
  bro: {
    key:'bro', label:'Bro Split (แยกกล้ามเนื้อรายวัน)', minDays:5, minRank:3,
    desc:'แยกกล้ามเนื้อแต่ละกลุ่มเป็นวันของตัวเอง (อก/หลัง/ไหล่/ขา/แขน) โวลุ่มต่อครั้งสูงสุดในบรรดา 4 รูปแบบ แต่แต่ละกลุ่มกล้ามเนื้อได้ฝึกแค่ ~1 ครั้ง/สัปดาห์ — ต้องมีวันว่างอย่างน้อย 5 วัน/สัปดาห์',
    sessions:[
      {key:'อก (Chest)', patterns:['hpush']},
      {key:'หลัง (Back)', patterns:['hpull','vpull']},
      {key:'ไหล่ (Shoulders)', patterns:['vpush']},
      {key:'ขา (Legs)', patterns:['squat','hinge','core']},
      {key:'แขน (Arms)', patterns:['biceps','triceps']}
    ]
  }
};
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
          plan:{manualPick:{}, unlockedEx:{}, forceLowTier:{}, splitOverride:null}};
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
function computeCalorieTarget(tdee, a){
  var goal = a.Q1;
  var floor = a.Q9==='ชาย' ? 1500 : (a.Q9==='หญิง' ? 1200 : null);
  if(tdee==null || isNaN(tdee)){
    return {kcal:null, floored:false, floor:floor, direction:'ข้อมูลไม่ครบ — กรอกเพศ/อายุ/ส่วนสูง/น้ำหนัก/กิจกรรมให้ครบก่อน'};
  }
  var mult = 1.0, directionLabel = 'รักษาน้ำหนัก (maintenance)';
  if(goal==='ลดไขมัน'){
    var dmap = {'เข้มข้น':0.75,'ค่อยเป็นค่อยไป':0.85,'ไม่แน่ใจให้ระบบแนะนำ':0.80};
    mult = dmap[a.Q4a]||0.80;
    directionLabel = 'ลดไขมัน (deficit '+Math.round((1-mult)*100)+'%)';
  } else if(goal==='เพิ่มกล้ามเนื้อ'){
    var smap = {'ได้ (เน้นสร้างกล้ามให้เร็ว)':1.15,'ไม่ได้ (อยากคุมไขมันไปด้วย)':1.08};
    mult = smap[a.Q5b] || 1.10;
    directionLabel = 'เพิ่มกล้ามเนื้อ (surplus +'+Math.round((mult-1)*100)+'%)';
  } else if(goal==='Recomposition (ลด+เพิ่มพร้อมกัน)'){
    var rmap = {'ห่างมาก':0.92,'ห่างปานกลาง':1.0,'ใกล้เป้าหมายแล้ว':1.03};
    mult = rmap[a.Q6]!=null ? rmap[a.Q6] : 1.0;
    directionLabel = 'Recomposition (ใกล้ maintenance ปรับตามคำตอบ Q6)';
  }
  var target = tdee*mult;
  var floored = mult<1 && floor!=null && target < floor;
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
   "ยางยืด"/"ม้านั่ง" ยังไม่มี equip type ให้จับคู่ในฐานข้อมูลท่า (ไม่มีท่าไหนต้องใช้) จึงยังไม่
   มีผลต่อ allowed[] ตอนนี้ — เป็นข้อจำกัดที่รู้อยู่แล้ว ไม่ใช่บั๊ก */
function equipAllowedHome(q21){
  var list = Array.isArray(q21) ? q21 : [];
  var allowed = ['bodyweight'];
  if(list.indexOf('ไม่มีอุปกรณ์เลย')>-1) return allowed;
  if(list.indexOf('ดัมเบล')>-1) allowed.push('dumbbell');
  if(list.indexOf('บาร์เบล')>-1) allowed.push('barbell');
  if(list.indexOf('บาร์โหน')>-1) allowed.push('pullupbar');
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
      id:e.id, pattern:e.pattern, tier:e.tier, equip:e.equip, th:e.th, sub:e.sub,
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
function selectionFor(pattern, a){
  var all = candidatesFor(pattern, a);
  var eligible = all.filter(function(e){return e.equipOk && !e.locked;});
  var forceLow = !!state.plan.forceLowTier[pattern];
  var tTier = forceLow ? 1 : targetTier(a.Q16);
  var manual = state.plan.manualPick[pattern];
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
function assignSessions(splitKey, days){
  var def = SPLIT_DEFS[splitKey];
  var sorted = DAYS.filter(function(d){ return (days||[]).indexOf(d)>-1; });
  var seq = def.sessions.map(function(se){ return se.key; });
  return sorted.map(function(d,i){ return {day:d, session:seq[i%seq.length]}; });
}
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
  var dayToSession = {};
  assignSessions(split, a.Q2||[]).forEach(function(x){ dayToSession[x.day]=x.session; });
  var sessions = splitDef.sessions.map(function(se){
    var exercises = se.patterns.map(function(p){
      var sel = selectionFor(p, a);
      if(!sel.picked) return null;
      return {
        pattern:p, id:sel.picked.id, th:sel.picked.th, sub:sel.picked.sub, tier:sel.picked.tier,
        equip:sel.picked.equip, // เดิมไม่มีฟิลด์นี้ — sectionWorkout ต้องใช้แยกท่า bodyweight (ซ่อนช่องน้ำหนัก)
        setsReps: p==='core' ? '3 x 30-45 วิ' : repSchemeFor(a.Q1),
        timeBased: p==='core'
      };
    }).filter(Boolean);
    return {key:se.key, exercises:exercises};
  });
  return {
    splitKey:split, splitLabel:splitDef.label, goal:a.Q1,
    days:(a.Q2||[]).slice(), dayToSession:dayToSession, sessions:sessions,
    minutesEstimate:a.Q3||'45-60 นาที',
    trainTime:a.Q24||'ไม่แน่นอนแล้วแต่วัน',
    targets: computeTargets(a),
    startWeight: parseFloat(a.Q12)||null
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
  schedTab:'week', editing:false, progressEx:null, openBench:{}, sleepHoursError:{}
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
function sessionDefFor(program, sKey){
  if(!sKey) return null;
  var found = (program.sessions||[]).filter(function(s){return s.key===sKey;})[0];
  return found || null;
}
function targetsOf(program){
  return (program && program.targets) ? program.targets : computeTargets(state.answers);
}

/* ---------- เขียน log รายวัน: อ่านของเดิมมา merge เสมอ ไม่ให้ข้อมูลหมวดอื่นหาย ---------- */
function saveDay(iso, patch){
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
  if(sess){
    sess.exercises.forEach(function(ex){
      var e = (log.exercises||{})[ex.id] || {};
      items.push({group:'workout', key:'ex-'+ex.id, done: !!e.done});
    });
  }
  var n = log.nutrition || {};
  items.push({group:'food', key:'protein', done: n.proteinG!=null && n.proteinG >= t.proteinG*0.9});
  items.push({group:'food', key:'kcal', done: kcalOk(n.kcal, t.kcal)});
  items.push({group:'food', key:'water', done: n.waterL!=null && n.waterL >= t.waterL});
  for(var i=0;i<t.meals;i++){
    items.push({group:'food', key:'meal'+i, done: !!(n.meals && n.meals[i])});
  }
  var sl = log.sleep || {};
  items.push({group:'sleep', key:'hours', done: sl.hours!=null && isFinite(sl.hours) && sl.hours>=0 && sl.hours<=24 && t.sleepH!=null && sl.hours >= t.sleepH-0.5});
  if(t.sleepHygiene) items.push({group:'sleep', key:'hygiene', done: !!sl.hygiene});
  items.push({group:'body', key:'weight', done: weightFor(iso)!=null});
  return items;
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
  return ['today','schedule','progress','plan'].indexOf(v)>-1 ? v : 'today';
}

var NAV_ITEMS = [
  {k:'today', label:'วันนี้'},
  {k:'schedule', label:'ตารางฝึก'},
  {k:'progress', label:'ความคืบหน้า'},
  {k:'plan', label:'แผนของฉัน'}
];

function renderNav(view){
  var el = document.getElementById("nav");
  var locked = (view==='onboarding');
  var html = '<div class="brand"><div class="brand-mark"></div><div class="brand-name">Gymbro</div></div>';
  if(auth.session){
    html += '<div class="hint" style="padding:0 6px;word-break:break-all">'+esc(auth.session.user.email||'')+
      '<button type="button" class="ex-open" data-act="auth-signout" style="display:block;padding:2px 0">ออกจากระบบ</button></div>';
  }
  html += '<div class="nav-group"><div class="nav-label">เมนู</div>';
  var counts = null;
  if(!locked && track.program) counts = dayCounts(track.program, todayISO());
  NAV_ITEMS.forEach(function(it){
    var active = (!locked && view===it.k);
    var cnt = (it.k==='today' && counts) ? '<span class="cnt">'+counts.done+'/'+counts.total+'</span>' : '';
    html += '<button type="button" class="nav-item'+(active?' active':'')+'" data-act="nav" data-view="'+it.k+'"'+(locked?' disabled':'')+'>'+
      '<span class="nd"></span><span>'+esc(it.label)+'</span>'+cnt+'</button>';
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
  var rows = sess.exercises.map(function(ex){
    var e = exData[ex.id] || {};
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
      '<div class="cb"><div class="t">'+esc(ex.th)+'</div>'+
        '<div class="s">'+esc(ex.setsReps)+' · '+esc(PATTERN_SHORT[ex.pattern]||ex.pattern)+' · '+esc(prevTxt)+'</div>'+
        '<button type="button" class="ex-open" data-act="ex-toggle" data-date="'+iso+'" data-ex="'+esc(ex.id)+'">'+(open?'ซ่อนช่องบันทึกเซ็ต ▴':(isBW?'บันทึกจำนวนครั้งต่อเซ็ต ▾':'บันทึกน้ำหนัก/ครั้งต่อเซ็ต ▾'))+'</button>'+
        (open? '<div class="setbox">'+setRows+'</div>' : '')+
        perfBlockFor(ex, iso, e, isBW)+
      '</div></div>';
  }).join('');
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--accent)"></span><h2>ออกกำลังกาย</h2>'+
    '<span class="meta">'+esc(sKey)+' · ~'+esc(p.minutesEstimate||'45-60 นาที')+' · '+esc(p.trainTime||'')+'</span>'+
    '<span class="cnt">'+doneN+'/'+sess.exercises.length+'</span></div>'+
    '<div class="chk-list">'+rows+'</div>'+
    '<label class="log-complete-row"><input type="checkbox" data-act="sess-complete" data-date="'+iso+'" '+(log.completed?'checked':'')+'> ทำเซสชันนี้ครบแล้ว (ข้อนี้คือตัวที่นับสตรีคและ % ทำตามแผน)</label>'+
    '</div>';
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
  if(n.waterL!=null && n.waterL>=t.waterL) doneN++;
  for(var j=0;j<t.meals;j++){ if(meals[j]) doneN++; }
  return '<div class="sec-card">'+
    '<div class="sec-head"><span class="sq" style="background:var(--food)"></span><h2>โภชนาการ</h2>'+
    '<span class="meta">'+fmtKcal(t.kcal)+' kcal · โปรตีน '+t.proteinG+' g · น้ำ '+fmt1(t.waterL)+' ล.</span>'+
    '<span class="cnt">'+doneN+'/'+(3+t.meals)+'</span></div>'+
    '<div class="chk-list">'+
      '<div class="chk'+((n.proteinG!=null&&n.proteinG>=t.proteinG*0.9)?' on':'')+'">'+
        '<div class="cb"><div class="t">โปรตีนวันนี้</div><div class="s">เป้า '+t.proteinG+' g (2 g ต่อน้ำหนักตัว 1 กก.) — ติ๊กผ่านเมื่อถึง 90% ขึ้นไป</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="proteinG" data-date="'+iso+'" data-fkey="nut-p-'+iso+'" value="'+num(n.proteinG)+'" placeholder="g"><span class="tgt">/ '+t.proteinG+' g</span></div></div>'+
      '<div class="chk'+(kcalOk(n.kcal, t.kcal)?' on':'')+'">'+
        '<div class="cb"><div class="t">พลังงานที่กินวันนี้</div><div class="s">เป้า '+fmtKcal(t.kcal)+' kcal · '+esc(t.kcalDirection)+(t.kcal!=null?' — ผ่านเมื่ออยู่ในช่วง '+Math.round(t.kcal*0.9).toLocaleString()+'–'+Math.round(t.kcal*1.1).toLocaleString()+' kcal (กินน้อยเกินไปก็ยังไม่ผ่าน)':'')+'</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" data-act="nut" data-field="kcal" data-date="'+iso+'" data-fkey="nut-k-'+iso+'" value="'+num(n.kcal)+'" placeholder="kcal"><span class="tgt">/ '+fmtKcal(t.kcal)+'</span></div></div>'+
      '<div class="chk'+((n.waterL!=null&&n.waterL>=t.waterL)?' on':'')+'">'+
        '<div class="cb"><div class="t">น้ำดื่ม</div><div class="s">เป้า '+fmt1(t.waterL)+' ลิตร (≈35 มล. ต่อน้ำหนักตัว 1 กก.)</div></div>'+
        '<div class="val"><input type="number" inputmode="decimal" step="0.1" data-act="nut" data-field="waterL" data-date="'+iso+'" data-fkey="nut-w-'+iso+'" value="'+num(n.waterL)+'" placeholder="ลิตร"><span class="tgt">/ '+fmt1(t.waterL)+' ล.</span></div></div>'+
      '<div class="chk"><div class="cb"><div class="t">มื้ออาหารตามแผน</div><div class="s">'+t.meals+' มื้อ/วัน ตามที่ตอบไว้ — กดเพื่อติ๊กเมื่อกินแล้ว</div>'+
        '<div class="meal-row" style="margin-top:8px">'+mealBtns+'</div></div></div>'+
    '</div>'+
    '<p class="hint">ต้นแบบนี้ยังไม่มีเมนูอาหารรายมื้อ — บันทึกเป็นตัวเลขรวมของวันก่อน (โปรตีน/พลังงาน/น้ำ) แล้วค่อยต่อยอดเป็นเมนูในเฟสถัดไป</p>'+
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

function dayEditor(iso){
  return sectionWorkout(iso) + sectionFood(iso) + sectionSleep(iso) + sectionBody(iso);
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
      '<h1>วันนี้</h1>'+
      '<div class="sub">'+(sKey? 'เซสชัน “'+esc(sKey)+'” ตามตารางที่ผูกกับวันที่จริง — ติ๊กทีละข้อระหว่างวันได้เลย ข้อมูลบันทึกทันทีที่กด' : 'วันพักตามตาราง — เช็คลิสต์เหลือเฉพาะโภชนาการ การนอน และน้ำหนักตัว')+'</div>'+
    '</div><div class="head-actions">'+
      '<button type="button" class="btn" data-act="nav" data-view="schedule">ดูตารางทั้งสัปดาห์</button>'+
      '<button type="button" class="btn" data-act="nav" data-view="progress">ความคืบหน้า</button>'+
    '</div></div>';

  html += '<div class="today-grid"><div class="stack">'+dayEditor(iso)+'</div>'+
    '<aside class="rail">'+
      '<div class="prog-card"><div class="prog-top"><h3>ความคืบหน้าวันนี้</h3><span class="n mono">'+counts.done+'/'+counts.total+'</span></div>'+
        '<div class="pbar'+(pct>=100?' full':'')+'"><i style="width:'+pct+'%"></i></div>'+
        '<p style="margin:0;font-size:12.5px;color:var(--text-2)">'+(pct>=100? 'ทำครบทุกข้อของวันนี้แล้ว' : 'เหลืออีก '+(counts.total-counts.done)+' ข้อ'+(sKey? ' · เทรนวันนี้ '+esc(p.trainTime||'') : ''))+'</p>'+
        (track.saveStatus? '<span class="save-status">'+esc(track.saveStatus)+'</span>':'')+
      '</div>'+
      '<div class="side-card"><h3>พรุ่งนี้</h3>'+
        '<p><b>'+esc(tKey||'พักฟื้น')+'</b><br>'+esc(tSess? tSess.exercises.map(function(e){return e.th;}).slice(0,3).join(' · ') : 'ยืดกล้ามเนื้อ เดินเบาๆ และนอนให้ครบเป้า')+'</p>'+
        '<button type="button" class="linkbtn" data-act="nav" data-view="schedule">ดูตารางทั้งสัปดาห์ →</button></div>'+
      '<div class="side-card"><h3>ทำตามแผนไม่ได้?</h3><p>ข้ามได้โดยไม่ต้องแก้อะไร — วันที่ไม่ได้ติ๊กจะขึ้นว่า “ยังไม่บันทึก” เฉยๆ ไม่มีสีแดงเตือน และย้อนกลับไปบันทึกทีหลังได้จากหน้าตารางฝึก</p>'+
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
    var openable = (iso <= today && iso >= p.startDate);
    var cls = 'wk-card' + (sKey?'':' rest') + (iso===today?' is-today':'') + (iso < p.startDate?' before':'');
    var chips = (iso===today?'<span class="chip now">วันนี้</span>':'') +
                (sKey?'<span class="chip">'+esc(p.minutesEstimate||'')+'</span>':'<span class="chip">พัก</span>') +
                (STATUS_CHIP[stt]||'');
    var sub = sess
      ? sess.exercises.map(function(e){return e.th;}).join(' · ')
      : 'ยืดกล้ามเนื้อ 10 นาที · เดินเบาๆ · เน้นนอนให้ครบเป้า';
    cards += '<button type="button" class="'+cls+'"'+(openable?' data-act="open-day" data-date="'+iso+'" data-open="1"':' disabled')+'>'+
      '<div class="wk-top"><span class="wk-day mono">'+esc(DAYS_SHORT[i])+'</span><span class="wk-date mono">'+d.getDate()+' '+esc(TH_MONTHS[d.getMonth()])+'</span>'+
      '<span class="wk-chips">'+chips+'</span></div>'+
      '<div class="wk-name">'+esc(sKey||'พักฟื้น')+'</div>'+
      '<div class="wk-sub">'+esc(sub)+'</div></button>';
  }
  var we = addDays(ws,6);
  var label = ws.getDate()+' '+TH_MONTHS[ws.getMonth()]+' – '+we.getDate()+' '+TH_MONTHS[we.getMonth()]+' '+(we.getFullYear()+543);
  return '<div class="range-nav"><h2>'+esc(label)+'</h2><div class="rn-btns">'+
      '<button type="button" data-act="week-prev">← สัปดาห์ก่อน</button>'+
      '<button type="button" data-act="week-today">สัปดาห์นี้</button>'+
      '<button type="button" data-act="week-next">สัปดาห์ถัดไป →</button></div></div>'+
    '<div class="wk-grid">'+cards+'</div>'+
    '<p class="hint" style="margin-top:12px">คลิกวันที่ผ่านมาแล้วหรือวันนี้เพื่อเปิดบันทึกของวันนั้น — วันในอนาคตและวันก่อนเริ่มโปรแกรมกดไม่ได้</p>';
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
    if(!sKey) cls += " rest";
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
      '<span class="md-sess'+(sKey?'':' rest')+'">'+esc(sKey||'พัก')+'</span>'+
      (mark?'<span class="md-mark mono">'+esc(mark)+'</span>':'')+
      '</'+close+'>';
  }
  var dowRow = DAYS_SHORT.map(function(dd2){return '<div class="month-dow">'+esc(dd2)+'</div>';}).join('');
  return '<div class="range-nav"><h2>'+esc(monthLabelTH(vm.y,vm.m))+'</h2><div class="rn-btns">'+
      '<button type="button" data-act="month-prev">← เดือนก่อน</button>'+
      '<button type="button" data-act="month-today">เดือนนี้</button>'+
      '<button type="button" data-act="month-next">เดือนถัดไป →</button></div></div>'+
    '<div class="month-grid">'+dowRow+cells+'</div>'+
    '<p class="hint" style="margin-top:12px">พื้นเขียว = ทำครบและติ๊กแล้ว · ขอบสีน้ำเงิน = บันทึกบางส่วน · ไม่มีสีเน้น = ยังไม่บันทึก (ตั้งใจไม่ใช้สีแดงกับวันที่พลาด) — คลิกวันเพื่อบันทึกย้อนหลัง</p>';
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
      '<div class="lp-sub">'+esc(iso)+' · '+(sessionKeyFor(p,iso)||'วันพัก')+' — แก้ไขย้อนหลังได้ ข้อมูลบันทึกทันทีที่กรอก</div>'+
      '<div class="stack">'+dayEditor(iso)+'</div>'+
      '<div class="log-actions"><button type="button" class="btn" data-act="close-day">ปิด</button>'+
      (logFor(iso)? '<button type="button" class="btn ghost" data-act="clear-day" data-date="'+iso+'">ล้างบันทึกของวันนี้</button>':'')+
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

/* ---------- หน้า: แผนของฉัน ---------- */
function renderPlan(){
  var p = track.program, t = targetsOf(p);
  var pKcal = t.proteinG*4, fKcal = t.fatG*9, cKcal = t.carbG*4, tot = pKcal+fKcal+cKcal;
  var pPct = Math.round(pKcal/tot*100), fPct = Math.round(fKcal/tot*100), cPct = 100-pPct-fPct;

  var html = '<div class="page-head"><div><div class="eyebrow">โปรแกรมที่กำลังติดตาม</div><h1>แผนของฉัน</h1>'+
    '<div class="sub">แผนนี้ถูกล็อกไว้ตั้งแต่วันที่กด “เริ่มโปรแกรม” เพื่อไม่ให้ประวัติที่บันทึกไปแล้วเปลี่ยนความหมายย้อนหลัง — แก้ได้โดยกดปุ่มด้านขวา</div></div>'+
    '<div class="head-actions">'+
      '<button type="button" class="btn" data-act="edit-plan">แก้ไขแผน / ทำแบบสอบถามใหม่</button>'+
      '<button type="button" class="btn" data-act="edit-start">ตั้งวันเริ่มใหม่</button>'+
    '</div></div>';

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

  html += '<div class="section-title">เซสชันในแผน</div>';
  html += (p.sessions||[]).map(function(se){
    var daysFor = (p.days||[]).filter(function(d){ return p.dayToSession[d]===se.key; });
    return '<div class="session-heading">เซสชัน “'+esc(se.key)+'” <span class="sh-sub">'+daysFor.length+'x/สัปดาห์ — '+esc(daysFor.join(', ')||'—')+' · ~'+esc(p.minutesEstimate)+'</span></div>'+
      '<div class="exercise-list">'+se.exercises.map(function(ex){
        return '<div class="ex-row"><div class="ex-row-top"><div>'+
          '<div class="ex-pattern">'+esc(PATTERN_LABEL[ex.pattern]||ex.pattern)+'</div>'+
          '<div class="ex-name">'+esc(ex.th)+' '+tierBadge(ex.tier)+'</div>'+
          '<div class="ex-sub">'+esc(ex.sub||'')+'</div></div>'+
          '<div class="ex-meta"><span class="ex-sets mono">'+esc(ex.setsReps)+'</span></div></div></div>';
      }).join('')+'</div>';
  }).join('');

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
  if(q.kind==="single" || q.kind==="multi"){
    body += '<div class="opts">';
    q.options.forEach(function(o){
      var sel = q.kind==="multi" ? (Array.isArray(a[q.id]) && a[q.id].indexOf(o)>-1) : a[q.id]===o;
      body += '<button type="button" class="opt'+(sel?" sel":"")+'" data-act="opt" data-qid="'+q.id+'" data-kind="'+q.kind+'" data-val="'+esc(o)+'">'+esc(o)+'</button>';
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
    '<div class="stat"><div class="n mono">43</div><div class="l">ข้อในคลังทั้งหมด</div></div></div>';
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

function resultsHTML(){
  var a = state.answers;
  var t = computeTargets(a);
  var bmiNow = bmiOf(parseFloat(a.Q12), parseFloat(a.Q11));
  var bmiTarget = t.goalWeight ? bmiOf(t.goalWeight, parseFloat(a.Q11)) : null;
  var adjacency = weekdayAdjacencyWarning(a.Q2||[]);
  var pKcal = t.proteinG*4, fKcal = t.fatG*9, cKcal = t.carbG*4, tot = pKcal+fKcal+cKcal;
  var pPct = Math.round(pKcal/tot*100), fPct = Math.round(fKcal/tot*100), cPct = 100-pPct-fPct;

  var split = effectiveSplit(a), splitDef = SPLIT_DEFS[split], feas = splitFeasibility(a);
  var assignment = assignSessions(split, a.Q2||[]);
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

  var weekPreview = DAYS.map(function(d,i){
    var active = (a.Q2||[]).indexOf(d)>-1;
    var sKey = dayToSession[d];
    var seDef = active ? splitDef.sessions.filter(function(s){return s.key===sKey;})[0] : null;
    var chips = seDef ? seDef.patterns.map(function(p){ return '<span class="chip">'+esc(PATTERN_SHORT[p]||p)+'</span>'; }).join('') : '';
    return '<div class="wk-card'+(active?'':' rest')+'"><div class="wk-top"><span class="wk-day mono">'+esc(DAYS_SHORT[i])+'</span>'+
      (active?'<span class="chip">'+esc(a.Q3||'')+'</span>':'<span class="chip">พัก</span>')+'</div>'+
      '<div class="wk-name">'+esc(active? sKey : 'พักฟื้น')+'</div>'+
      '<div class="wk-sub">'+(chips||'ยืดกล้ามเนื้อ · เดินเบาๆ · นอนให้ครบ')+'</div></div>';
  }).join('');

  function buildExRow(pattern){
    var sel = selectionFor(pattern, a);
    if(!sel.picked){
      return '<div class="ex-row"><div class="ex-pattern">'+PATTERN_LABEL[pattern]+'</div><div class="banner danger"><div class="ic">✕</div><div>ไม่มีท่าที่เหมาะสมเหลือให้เลือก (อุปกรณ์ไม่พอ หรือถูกล็อกทั้งหมด) — ต้องการอุปกรณ์เพิ่มเติม/ปรึกษาเทรนเนอร์</div></div></div>';
    }
    var setsReps = pattern==='core' ? '3 x 30-45 วิ' : repSchemeFor(a.Q1);
    var alts = sel.all.filter(function(e){return e.id!==sel.picked.id;});
    var altsHtml = alts.map(function(x){
      var pickedThis = state.plan.manualPick[pattern]===x.id;
      if(x.locked){
        return '<div class="swap-opt locked"><div><div>'+x.th+' '+tierBadge(x.tier)+'</div><div class="lockmsg">ล็อกอยู่ — เนื่องจากอาการที่ '+x.lockedBy.join(', ')+' ที่คุณแจ้งไว้</div></div>'+
          '<button type="button" data-act="unlock" data-unlock="'+x.id+'" data-pattern="'+pattern+'">แจ้งว่าหายแล้ว</button></div>';
      }
      if(!x.equipOk){
        return '<div class="swap-opt locked"><div><div>'+x.th+' '+tierBadge(x.tier)+'</div><div class="lockmsg">ต้องใช้อุปกรณ์ที่ยิมนี้ไม่มีตามที่แจ้งไว้</div></div></div>';
      }
      return '<div class="swap-opt'+(pickedThis?' picked':'')+'"><div>'+x.th+' '+tierBadge(x.tier)+'</div>'+
        '<button type="button" data-act="swap" data-swap="'+x.id+'" data-pattern="'+pattern+'">เลือกท่านี้แทน</button></div>';
    }).join('');
    return '<div class="ex-row"><div class="ex-row-top"><div><div class="ex-pattern">'+PATTERN_LABEL[pattern]+'</div>'+
      '<div class="ex-name">'+sel.picked.th+' '+tierBadge(sel.picked.tier)+'</div>'+
      '<div class="ex-sub">'+sel.picked.sub+'</div></div>'+
      '<div class="ex-meta"><span class="ex-sets mono">'+setsReps+'</span>'+
      '<button type="button" class="swap-toggle" data-act="swap-toggle" data-pattern="'+pattern+'">สลับท่า ▾</button></div></div>'+
      '<div class="swap-panel'+(track.openSwap===pattern?' open':'')+'">'+altsHtml+'</div></div>';
  }
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
      body = ' เพราะวันที่เลือก ('+daysStr+') '+
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
    '<div class="wk-grid" style="margin-top:12px">'+weekPreview+'</div>'+
    '<div class="reasoning-card">'+reasoning+'</div>'+
    (Object.keys(state.plan.forceLowTier).length ? '<div class="banner info"><div class="ic">ⓘ</div><div>คุณเพิ่งแจ้งว่าหายจากอาการบาดเจ็บสำหรับบางท่า — ระบบเริ่มท่าในกลุ่มนั้นใหม่จาก <b>Tier ต่ำสุด</b> ก่อนเสมอเพื่อความปลอดภัย</div></div>' : '')+

    '<div class="section-title">รายละเอียดเซสชัน</div>'+
    '<div class="tier-legend">'+TIER_ORDER.map(function(tt){ return '<div class="item"><b>Tier '+tt+'</b> '+TIER_LABEL[tt]+'</div>'; }).join('')+'</div>'+
    sessionBlocks+

    (track.editing ? renderStartSetup() :
      '<div class="sum-actions"><button type="button" class="btn primary" data-act="edit-start">'+(track.program?'บันทึกแผนใหม่ (ตั้งวันเริ่ม) →':'เริ่มโปรแกรม →')+'</button>'+
      '<button type="button" class="btn ghost" data-act="back-summary">← กลับไปหน้าสรุปคำตอบ</button>'+
      (track.program? '<button type="button" class="btn ghost" data-act="exit-edit">ยกเลิก กลับไปแอป</button>':'')+'</div>')+
    '</div>';
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
function renderAuthGate(){
  var isSignup = authState.mode==='signup';
  return '<div class="page" style="max-width:420px;margin:60px auto;">'+
    '<div class="qcard">'+
    '<div class="eyebrow">Gymbro Daily</div>'+
    '<h1 style="margin-top:6px">'+(isSignup?'สมัครสมาชิก':'เข้าสู่ระบบ')+'</h1>'+
    '<p class="sub" style="margin:8px 0 18px">เข้าสู่ระบบเพื่อให้ข้อมูลของคุณซิงก์ข้ามอุปกรณ์ได้</p>'+
    (authState.error ? '<div class="note warn" style="margin-bottom:14px"><p>'+esc(authState.error)+'</p></div>' : '')+
    '<div class="field-row" style="margin-bottom:10px"><input type="email" id="authEmail" class="wide" placeholder="อีเมล" autocomplete="email"></div>'+
    '<div class="field-row" style="margin-bottom:16px"><input type="password" id="authPassword" class="wide" placeholder="รหัสผ่าน (อย่างน้อย 6 ตัวอักษร)" autocomplete="'+(isSignup?'new-password':'current-password')+'"></div>'+
    '<button type="button" class="btn primary" data-act="auth-submit" data-mode="'+(isSignup?'signup':'signin')+'" '+(authState.busy?'disabled':'')+' style="width:100%;margin-bottom:10px">'+
      (authState.busy ? 'กำลังดำเนินการ...' : (isSignup?'สมัครสมาชิก':'เข้าสู่ระบบ'))+'</button>'+
    '<button type="button" class="btn ghost" data-act="auth-toggle-mode" '+(authState.busy?'disabled':'')+' style="width:100%">'+
      (isSignup ? 'มีบัญชีอยู่แล้ว? เข้าสู่ระบบ' : 'ยังไม่มีบัญชี? สมัครสมาชิก')+'</button>'+
    '</div></div>';
}
function render(toTop){
  if(auth.ready && syncAvailable() && !auth.session){
    document.getElementById('nav').innerHTML = '';
    document.getElementById('page').innerHTML = renderAuthGate();
    if(toTop) window.scrollTo({top:0, behavior:"auto"});
    return;
  }
  var view = currentView();
  var f = captureFocus();
  renderNav(view);
  if(view==='onboarding') renderOnboarding();
  else if(view==='today') renderToday();
  else if(view==='schedule') renderSchedule();
  else if(view==='progress') renderProgress();
  else if(view==='plan') renderPlan();
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
  var next = {sets: e.sets||[], done: !!e.done};
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

function goto(view){ state.nav = view; track.openDate=null; track.saveStatus=''; persist(); render(true); }

document.addEventListener("click", function(ev){
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act]') : null;
  if(!el) return;
  var act = el.getAttribute('data-act');
  var iso = el.getAttribute('data-date');

  if(act==='auth-toggle-mode'){ authState.mode = authState.mode==='signup'?'signin':'signup'; authState.error=null; render(); return; }
  if(act==='auth-submit'){
    var email = (document.getElementById('authEmail')||{}).value || '';
    var password = (document.getElementById('authPassword')||{}).value || '';
    email = email.trim();
    if(!email || !password){ authState.error='กรอกอีเมลและรหัสผ่านให้ครบ'; render(); return; }
    if(password.length<6){ authState.error='รหัสผ่านต้องมีอย่างน้อย 6 ตัวอักษร'; render(); return; }
    authState.busy = true; authState.error = null; render();
    var isSignup = el.getAttribute('data-mode')==='signup';
    var fn = isSignup ? GymBroSync.signUp : GymBroSync.signIn;
    fn(email, password).then(function(res){
      authState.busy = false;
      if(res.error){ authState.error = res.error.message; render(); return; }
      if(isSignup && res.data && res.data.user && !res.data.session){
        // โปรเจกต์ตั้งให้ต้องยืนยันอีเมลก่อน — Supabase auth.onAuthStateChange จะยังไม่ยิง SIGNED_IN
        authState.error = 'สมัครสำเร็จ — เช็คอีเมลเพื่อยืนยันบัญชีก่อนเข้าสู่ระบบครั้งแรก';
        render();
        return;
      }
      // สำเร็จแล้วปล่อยให้ onAuthChange listener (ผูกไว้ตอน boot) จัดการ hydrate + render ต่อ
    }).catch(function(e){ authState.busy=false; authState.error='เชื่อมต่อไม่ได้: '+(e&&e.message?e.message:e); render(); });
    return;
  }
  if(act==='auth-signout'){ GymBroSync.signOut(); return; } // onAuthChange จะเคลียร์ auth.session + render ให้เอง
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
  if(act==='progress-ex'){ track.progressEx = el.getAttribute('data-ex'); render(); return; }
  if(act==='hard-restart'){
    lsRemove("gymbro_program"); lsRemove("gymbro_logs"); lsRemove("gymbro_weights"); lsRemove("gymbro_onb_proto");
    track.program = null; track.logs = {}; track.weights = {};
    state = freshState();
    render(true);
    return;
  }
  if(act==='edit-plan'){ state.editPlan=true; state.step=9; state.mode='results'; track.editing=false; persist(); render(true); return; }
  if(act==='exit-edit'){ state.editPlan=false; track.editing=false; persist(); render(true); return; }
  if(act==='edit-start'){ track.editing=true; track.saveStatus=''; render(); return; }
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
  if(act==='split'){ if(el.disabled) return; state.plan.splitOverride = el.getAttribute('data-split'); state.plan.manualPick={}; persist(); render(); return; }
  if(act==='split-auto'){ state.plan.splitOverride=null; state.plan.manualPick={}; persist(); render(); return; }
  if(act==='swap-toggle'){ var pt=el.getAttribute('data-pattern'); track.openSwap = (track.openSwap===pt? null : pt); render(); return; }
  if(act==='swap'){ state.plan.manualPick[el.getAttribute('data-pattern')] = el.getAttribute('data-swap'); persist(); render(); return; }
  if(act==='unlock'){
    var pat = el.getAttribute('data-pattern');
    state.plan.unlockedEx[el.getAttribute('data-unlock')] = true;
    state.plan.forceLowTier[pat] = true;
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
  var el = ev.target && ev.target.closest ? ev.target.closest('[data-act="set"]') : null;
  if(!el) return;
  var iso = el.getAttribute('data-date');
  patchExercise(iso, el.getAttribute('data-ex'), {sets: setsFromDom(el.getAttribute('data-ex'), iso)});
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
    rows.forEach(function(r){ if(!(r.log_date in merged)) merged[r.log_date] = r.payload; });
    Object.keys(track.logs).forEach(function(d){ toPush.push(GymBroSync.pushDailyLog(userId, d, track.logs[d])); });
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
      }
      lsSet("gymbro_onb_proto", state);
    } else if(hasLocalAnswers){
      return GymBroSync.pushOnboarding(userId, state);
    }
  }).catch(function(){});
}

/* ---------- boot: เช็ค session ก่อน render ครั้งแรกเสมอ ถ้า Supabase โหลดไม่ได้เลย
   (ออฟไลน์/ถูกบล็อก) ข้ามระบบ auth ไปทั้งหมด ใช้แอปแบบ local-only เหมือนเดิมทุกประการ ---------- */
function boot(){
  if(!syncAvailable()){ auth.ready = true; render(true); return; }
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
