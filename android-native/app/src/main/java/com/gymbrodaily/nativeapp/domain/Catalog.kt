package com.gymbrodaily.nativeapp.domain

/* ============================================================
   ข้อมูลคงที่ของ generator — คัดลอกจาก app.js (EXERCISES, SPLIT_DEFS ฯลฯ)
   แก้ที่นี่ต้องแก้ app.js ให้ตรงกันด้วย จนกว่าจะเลิกใช้เว็บ (GeneratorGoldenTest จะจับได้)
   ============================================================ */

data class Exercise(
    val id: String,
    val pattern: String,
    val tier: Int,
    val equip: String,
    val th: String,
    val sub: String,
    /** ท่าที่วัดเป็นเวลา (วินาที) ไม่ใช่จำนวนครั้ง — ตรงกับ timed ของ EXERCISES ในเว็บ */
    val timed: Boolean = false,
)

data class SessionDef(val key: String, val patterns: List<String>)

data class SplitDef(
    val key: String,
    val label: String,
    val minDays: Int,
    val minRank: Int,
    val desc: String,
    val sessions: List<SessionDef>,
)

object Catalog {
    val DAYS = listOf("จันทร์", "อังคาร", "พุธ", "พฤหัสบดี", "ศุกร์", "เสาร์", "อาทิตย์")
    val DAYS_SHORT = listOf("จ", "อ", "พ", "พฤ", "ศ", "ส", "อา")

    val EXERCISES = listOf(
        Exercise("sq1", "squat", 1, "bodyweight", "Bodyweight Squat", "สควอทน้ำหนักตัว"),
        Exercise("sq2", "squat", 2, "dumbbell", "Goblet Squat", "สควอทถือดัมเบล"),
        Exercise("sq3", "squat", 3, "machine", "45-Degree Leg Press", "เลกเพรสมุมเอียง 45 องศา (แบบที่พบบ่อยที่สุดในยิม)"),
        Exercise("sq3c", "squat", 3, "machine", "Horizontal Leg Press", "เลกเพรสแนวนอน (นั่งดันไปข้างหน้า)"),
        Exercise("sq3d", "squat", 3, "machine", "Vertical Leg Press", "เลกเพรสแนวตั้ง (นอนหงายดันขึ้นเหนือตัว)"),
        Exercise("sq3b", "squat", 3, "stepper", "Step-up", "ก้าวขึ้น-ลงสเต็ปเปอร์ (ทางเลือกที่บ้านแทนเครื่องเลกเพรส)"),
        Exercise("sq4", "squat", 4, "barbell", "Barbell Back Squat", "สควอทบาร์เบล"),

        Exercise("hg1b", "hinge", 1, "bodyweight", "Single-Leg RDL (น้ำหนักตัว)", "ก้มสะโพกขาเดียวน้ำหนักตัว"),
        Exercise("hg2", "hinge", 2, "dumbbell", "Romanian Deadlift (Dumbbell)", "RDL ดัมเบล"),
        Exercise("hg3c", "hinge", 3, "machine", "45-Degree Back Extension", "เครื่องเหยียดหลัง 45 องศา (หลังล่าง/ก้น/หลังขา)"),
        Exercise("hg3d", "hinge", 3, "cable", "Cable Pull-through", "ดึงเคเบิลลอดขา"),
        Exercise("hg4", "hinge", 4, "barbell", "Barbell Deadlift", "เดดลิฟต์บาร์เบล"),

        Exercise("hg1", "glute", 1, "bodyweight", "Glute Bridge", "สะพานสะโพก"),
        Exercise("gl2", "glute", 2, "bodyweight", "Single-Leg Glute Bridge", "สะพานสะโพกขาเดียว"),
        Exercise("gl2b", "glute", 2, "dumbbell", "Dumbbell Hip Thrust", "ฮิปทรัสต์ถือดัมเบล"),
        Exercise("gl2c", "glute", 2, "cable", "Cable Glute Kickback", "เตะขาไปด้านหลังด้วยเคเบิล"),
        Exercise("hg3", "glute", 3, "machine", "Hip Thrust Machine", "เครื่องฮิปทรัสต์"),
        Exercise("hg3b", "glute", 3, "yogaball", "Stability Ball Hip Thrust", "สะพานสะโพกบนลูกบอลโยคะ (ทางเลือกที่บ้านแทนเครื่องฮิปทรัสต์)"),
        Exercise("gl4", "glute", 4, "barbell", "Barbell Hip Thrust", "ฮิปทรัสต์บาร์เบล"),

        Exercise("lg1", "lunge", 1, "bodyweight", "Reverse Lunge", "ลันจ์ถอยหลังน้ำหนักตัว"),
        Exercise("lg2", "lunge", 2, "dumbbell", "Dumbbell Split Squat", "สปลิทสควอทถือดัมเบล"),
        Exercise("lg2b", "lunge", 2, "bodyweight", "Walking Lunge", "ลันจ์เดินน้ำหนักตัว"),
        Exercise("lg3", "lunge", 3, "dumbbell", "Bulgarian Split Squat (Dumbbell)", "บัลแกเรียนสปลิทสควอท (วางเท้าหลังบนม้านั่ง)"),
        Exercise("lg3b", "lunge", 3, "machine", "Smith Machine Split Squat", "สปลิทสควอทในเครื่องสมิท"),
        Exercise("lg4", "lunge", 4, "barbell", "Barbell Walking Lunge", "ลันจ์เดินแบกบาร์เบล"),

        Exercise("lc1", "legcurl", 1, "bodyweight", "Towel Slider Leg Curl", "นอนหงายงอเข่าดึงผ้าขนหนูบนพื้นลื่น"),
        Exercise("lc2", "legcurl", 2, "machine", "Lying Leg Curl Machine", "เครื่องงอเข่านอนคว่ำ"),
        Exercise("lc2b", "legcurl", 2, "yogaball", "Stability Ball Leg Curl", "งอเข่าบนลูกบอลโยคะ"),
        Exercise("lc3", "legcurl", 3, "machine", "Seated Leg Curl Machine", "เครื่องงอเข่านั่ง"),
        Exercise("lc3b", "legcurl", 3, "dumbbell", "Prone Dumbbell Leg Curl", "นอนคว่ำหนีบดัมเบลงอเข่า"),
        Exercise("lc4", "legcurl", 4, "bodyweight", "Nordic Hamstring Curl", "นอร์ดิกเคิร์ล (ต้องมีที่ล็อกข้อเท้า)"),

        Exercise("cf1", "calf", 1, "bodyweight", "Standing Calf Raise", "เขย่งปลายเท้าน้ำหนักตัว"),
        Exercise("cf2", "calf", 2, "bodyweight", "Single-Leg Calf Raise", "เขย่งปลายเท้าขาเดียว"),
        Exercise("cf2b", "calf", 2, "dumbbell", "Dumbbell Calf Raise", "เขย่งปลายเท้าถือดัมเบล"),
        Exercise("cf3", "calf", 3, "machine", "Seated Calf Raise Machine", "เครื่องเขย่งน่องแบบนั่ง (เน้นน่องชั้นใน)"),
        Exercise("cf3b", "calf", 3, "machine", "Leg Press Calf Raise", "เขย่งน่องบนเครื่องเลกเพรส"),
        Exercise("cf4", "calf", 4, "barbell", "Barbell Standing Calf Raise", "เขย่งน่องแบกบาร์เบล"),

        Exercise("hp1", "hpush", 1, "bodyweight", "Wall Push-up", "พุชอัพกำแพง"),
        Exercise("hp2a", "hpush", 2, "bodyweight", "Knee Push-up", "พุชอัพคุกเข่า"),
        Exercise("hp2b", "hpush", 2, "machine", "Chest Press Machine", "เครื่องเชสต์เพรส"),
        Exercise("hp3", "hpush", 3, "dumbbell", "Dumbbell Bench Press", "เบนช์เพรสดัมเบล"),
        Exercise("hp4", "hpush", 4, "barbell", "Barbell Bench Press", "เบนช์เพรสบาร์เบล"),

        Exercise("ic1", "incline", 1, "cable", "Low-to-High Cable Fly (น้ำหนักเบา)", "ดึงเคเบิลจากล่างขึ้นบน เน้นอกบน"),
        Exercise("ic2", "incline", 2, "machine", "Incline Chest Press Machine", "เครื่องดันอกแบบเอียงขึ้น เน้นอกบน"),
        Exercise("ic3", "incline", 3, "dumbbell", "Incline Dumbbell Press", "ดันดัมเบลบนม้านั่งเอียง เน้นอกบน"),
        Exercise("ic3b", "incline", 3, "bodyweight", "Decline Push-up", "พุชอัพยกเท้าสูง เน้นอกบน"),
        Exercise("ic4", "incline", 4, "barbell", "Incline Barbell Bench Press", "เบนช์เพรสบาร์เบลม้านั่งเอียง"),

        Exercise("fl1", "chestfly", 1, "cable", "Cable Fly (น้ำหนักเบา)", "กางแขนหนีบอกด้วยเคเบิลเบา"),
        Exercise("fl2", "chestfly", 2, "machine", "Pec Deck Machine", "เครื่องหนีบอก"),
        Exercise("fl3", "chestfly", 3, "dumbbell", "Dumbbell Fly", "นอนกางแขนดัมเบล"),
        Exercise("fl3b", "chestfly", 3, "cable", "Cable Crossover", "ไขว้เคเบิลหนีบอก"),

        Exercise("hl1", "hpull", 1, "cable", "Seated Cable Row (น้ำหนักเบา)", "พายเคเบิลนั่งเบา"),
        Exercise("hl1b", "hpull", 1, "bodyweight", "Superman", "เหยียดหลังท่าซุปเปอร์แมน (ไม่ใช้อุปกรณ์)"),
        Exercise("hl2", "hpull", 2, "cable", "Seated Cable Row", "พายเคเบิลนั่ง"),
        Exercise("hl3", "hpull", 3, "dumbbell", "Dumbbell Bent-over Row", "ก้มพายดัมเบล"),
        Exercise("hl4", "hpull", 4, "barbell", "Barbell Bent-over Row", "ก้มพายบาร์เบล"),

        Exercise("vl0", "vpull", 1, "bodyweight", "Prone Lat Pull (น้ำหนักตัว)", "นอนคว่ำ ยกอกเล็กน้อย ดึงศอกลงข้างลำตัวบีบปีกหลัง (ทางเลือกเมื่อไม่มีบาร์โหน/เครื่อง)"),
        Exercise("vl1", "vpull", 1, "machine", "Assisted Pull-up Machine", "ดึงข้อช่วยเครื่อง"),
        Exercise("vl2", "vpull", 2, "machine", "Lat Pulldown", "ดึงลัทดาวน์"),
        Exercise("vl3", "vpull", 3, "dumbbell", "Dumbbell Pullover", "พูลโอเวอร์ดัมเบล"),
        Exercise("vl4", "vpull", 4, "pullupbar", "Pull-up", "ดึงข้อ (ต้องมีบาร์โหน)"),

        Exercise("vp1", "vpush", 1, "machine", "Shoulder Press Machine (น้ำหนักเบา)", "เครื่องดันไหล่เบา"),
        Exercise("vp1b", "vpush", 1, "bodyweight", "Pike Push-up", "พุชอัพท่าไพค์ เน้นไหล่ (ไม่ใช้อุปกรณ์)"),
        Exercise("vp2", "vpush", 2, "machine", "Shoulder Press Machine", "เครื่องดันไหล่"),
        Exercise("vp3", "vpush", 3, "dumbbell", "Dumbbell Shoulder Press", "ดันไหล่ดัมเบล"),
        Exercise("vp4", "vpush", 4, "barbell", "Barbell Overhead Press", "ดันไหล่บาร์เบลเหนือศีรษะ"),

        Exercise("lr1", "latraise", 1, "bodyweight", "Lateral Raise (ขวดน้ำ)", "ยกแขนด้านข้างด้วยขวดน้ำ/ของในบ้าน"),
        Exercise("lr2", "latraise", 2, "dumbbell", "Dumbbell Lateral Raise", "ยกดัมเบลด้านข้าง เน้นไหล่ข้าง"),
        Exercise("lr3", "latraise", 3, "cable", "Cable Lateral Raise", "ยกเคเบิลด้านข้าง"),
        Exercise("lr3b", "latraise", 3, "machine", "Machine Lateral Raise", "เครื่องยกไหล่ด้านข้าง"),

        Exercise("rd1", "reardelt", 1, "bodyweight", "Prone Y-T-W Raise", "นอนคว่ำยกแขนเป็นตัว Y-T-W (ไหล่หลัง/หลังบน)"),
        Exercise("rd2", "reardelt", 2, "machine", "Reverse Pec Deck", "เครื่องกางแขนไปด้านหลัง เน้นไหล่หลัง"),
        Exercise("rd2b", "reardelt", 2, "cable", "Face Pull", "ดึงเชือกเคเบิลเข้าหาหน้า"),
        Exercise("rd3", "reardelt", 3, "dumbbell", "Dumbbell Reverse Fly", "ก้มตัวกางแขนดัมเบล เน้นไหล่หลัง"),

        Exercise("co1", "core", 1, "bodyweight", "Plank", "แพลงก์", timed = true),
        Exercise("co2", "core", 2, "bodyweight", "Dead Bug", "เดดบั๊ก", timed = true),
        Exercise("co3c", "core", 3, "cable", "Cable Crunch", "คุกเข่าครันช์ด้วยเคเบิล"),
        Exercise("co3b", "core", 3, "abroller", "Ab Wheel Rollout", "ล้อโรลหน้าท้อง"),
        Exercise("co4", "core", 4, "pullupbar", "Hanging Leg Raise", "ยกขาห้อยตัว (ต้องมีบาร์โหน)"),

        Exercise("ob1", "oblique", 1, "bodyweight", "Side Plank", "แพลงก์ด้านข้าง", timed = true),
        Exercise("ob2", "oblique", 2, "bodyweight", "Bicycle Crunch", "ครันช์ปั่นจักรยาน"),
        Exercise("co3", "oblique", 3, "cable", "Cable Woodchopper", "วู้ดช็อปเปอร์เคเบิล"),
        Exercise("ob3", "oblique", 3, "cable", "Pallof Press", "ดันเคเบิลต้านการบิดลำตัว", timed = true),
        Exercise("ob4", "oblique", 4, "pullupbar", "Hanging Oblique Knee Raise", "ห้อยตัวยกเข่าเฉียงข้าง (ต้องมีบาร์โหน)"),

        Exercise("bc0", "biceps", 1, "bodyweight", "Towel Bicep Curl", "เหยียบผ้าขนหนูแล้วงอแขนดึงต้านแรงขาตัวเอง (ไม่ใช้อุปกรณ์)"),
        Exercise("bc1", "biceps", 1, "cable", "Cable Curl (น้ำหนักเบา)", "ดึงเคเบิลกล้ามแขนหน้าเบา"),
        Exercise("bc2", "biceps", 2, "dumbbell", "Dumbbell Bicep Curl", "เคิร์ลดัมเบล"),
        Exercise("bc3", "biceps", 3, "machine", "Preacher Curl Machine", "เครื่องเคิร์ลพักแขน"),
        Exercise("bc4", "biceps", 4, "barbell", "Barbell Curl", "เคิร์ลบาร์เบล"),

        Exercise("tc1", "triceps", 1, "cable", "Cable Tricep Pushdown (น้ำหนักเบา)", "กดเคเบิลกล้ามแขนหลังเบา"),
        Exercise("tc2", "triceps", 2, "bodyweight", "Bench Dip", "ดิปเก้าอี้"),
        Exercise("tc3", "triceps", 3, "dumbbell", "Overhead Dumbbell Tricep Extension", "เหยียดแขนเหนือศีรษะดัมเบล"),
        Exercise("tc4", "triceps", 4, "barbell", "Close-Grip Barbell Bench Press", "เบนช์เพรสจับแคบบาร์เบล"),
    )

    val TIER_LABEL = mapOf(1 to "เบาสุด / เริ่มต้น", 2 to "ปานกลาง", 3 to "ค่อนข้างหนัก", 4 to "หนักสุด / ต้องมีพื้นฐาน")
    val TIER_DESC = mapOf(
        1 to "ใช้ทักษะ/แรงน้อยที่สุดในกลุ่มท่านี้ เหมาะกับผู้เริ่มต้นหรือกำลังฟื้นจากอาการบาดเจ็บ",
        2 to "เพิ่มแรงต้านหรือความซับซ้อนขึ้นอีกขั้นจาก Tier 1",
        3 to "ต้องการความมั่นคง/ทักษะควบคุมน้ำหนักที่ดีขึ้น",
        4 to "ใช้แรง/ทักษะควบคุมมากที่สุดในกลุ่มท่านี้",
    )

    val PATTERN_LABEL = linkedMapOf(
        "squat" to "Squat Pattern — ต้นขาหน้า / ก้น",
        "lunge" to "Lunge — ขาทีละข้าง / ก้น",
        "hinge" to "Hinge Pattern — หลังขา / หลังล่าง",
        "glute" to "Glute — กล้ามก้น",
        "legcurl" to "Leg Curl — หลังขา (งอเข่า)",
        "calf" to "Calf — น่อง",
        "hpush" to "Horizontal Push — อกกลาง / ไหล่หน้า / ไทรเซป",
        "incline" to "Incline Push — อกบน",
        "chestfly" to "Chest Fly — อก (แยกส่วน)",
        "vpush" to "Vertical Push — ไหล่หน้า",
        "latraise" to "Lateral Raise — ไหล่ข้าง",
        "reardelt" to "Rear Delt — ไหล่หลัง / หลังบน",
        "hpull" to "Horizontal Pull — หลังกลาง",
        "vpull" to "Vertical Pull — หลังกว้าง / ไบเซป",
        "core" to "Core — หน้าท้อง",
        "oblique" to "Oblique — ท้องด้านข้าง / ต้านการบิด",
        "biceps" to "Biceps — กล้ามแขนหน้า",
        "triceps" to "Triceps — กล้ามแขนหลัง",
    )
    val PATTERN_SHORT = mapOf(
        "squat" to "ต้นขาหน้า",
        "lunge" to "ขาทีละข้าง",
        "hinge" to "หลังขา/หลังล่าง",
        "glute" to "ก้น",
        "legcurl" to "หลังขา (งอเข่า)",
        "calf" to "น่อง",
        "hpush" to "อกกลาง",
        "incline" to "อกบน",
        "chestfly" to "อก (แยกส่วน)",
        "vpush" to "ไหล่หน้า",
        "latraise" to "ไหล่ข้าง",
        "reardelt" to "ไหล่หลัง",
        "hpull" to "หลังกลาง",
        "vpull" to "หลังกว้าง",
        "core" to "หน้าท้อง",
        "oblique" to "ท้องด้านข้าง",
        "biceps" to "แขนหน้า",
        "triceps" to "แขนหลัง",
    )
    val PATTERN_ORDER = PATTERN_LABEL.keys.toList()

    val EXCLUSION_MAP = mapOf(
        "เข่า" to listOf("sq3", "sq3c", "sq3d", "sq4", "sq3b", "lg2b", "lg3", "lg3b", "lg4", "lc4", "cf3b"),
        "ไหล่" to listOf("vp3", "vp4", "tc3", "tc4", "ic3", "ic4", "fl3", "fl3b", "lr2", "lr3", "lr3b"),
        "หลัง" to listOf("hg3", "hg4", "bc4", "hg3b", "co3b", "hg3c", "gl4", "lg4", "co3c", "ob2"),
        "ข้อมือ" to listOf("hp2a", "hp3", "hp4", "bc4", "tc4", "ic3", "ic3b", "ic4"),
        "หัวใจ-หลอดเลือด" to listOf("sq4", "hg4", "hp4", "vp4", "hl4", "bc4", "tc4", "ic4", "gl4", "lg4", "cf4"),
    )

    /** ลำดับตรงกับ Object.keys(SPLIT_DEFS) ใน JS (สร้างจาก golden/catalog.json) — pattern "x@2" = ตัวเลือกที่สองของรูปแบบเดียวกัน */
    val SPLIT_DEFS: Map<String, SplitDef> = linkedMapOf(
        "fullbody" to SplitDef(
            "fullbody", "Full Body", 1, 0,
            "ฝึกทั้งตัวทุกครั้ง แต่หมุนเวียนท่า A/B/C ในแต่ละวันให้โดนกล้ามเนื้อครบทุกส่วนในสัปดาห์ — ปลอดภัยสุดสำหรับมือใหม่ ต้องการวันว่างน้อยสุด",
            listOf(
                SessionDef("Full Body A", listOf("squat", "hpush", "hpull", "hinge", "latraise", "triceps", "core")),
                SessionDef("Full Body B", listOf("lunge", "incline", "vpull", "glute", "reardelt", "biceps", "oblique")),
                SessionDef("Full Body C", listOf("squat@2", "vpush", "vpull@2", "legcurl", "chestfly", "calf", "core@2")),
            ),
        ),
        "ul" to SplitDef(
            "ul", "Upper / Lower", 4, 1,
            "แยกวันบนตัว (Upper) กับล่างตัว (Lower) สลับกัน แต่ละฝั่งมี 2 ชุดท่า (A/B) ครบทุกส่วนใน 4 วัน — ต้องมีวันว่างอย่างน้อย 4 วัน/สัปดาห์",
            listOf(
                SessionDef("Upper A", listOf("hpush", "hpull", "vpush", "latraise", "triceps")),
                SessionDef("Lower A", listOf("squat", "hinge", "calf", "core")),
                SessionDef("Upper B", listOf("incline", "vpull", "chestfly", "reardelt", "biceps")),
                SessionDef("Lower B", listOf("lunge", "glute", "legcurl", "oblique")),
            ),
        ),
        "ppl" to SplitDef(
            "ppl", "Push / Pull / Legs", 3, 2,
            "แยกวันดัน (Push) ดึง (Pull) และขา (Legs) หมุนวนกัน ชุด A ครอบคลุมเกือบครบใน 3 วัน ชุด B เปลี่ยนท่าให้หลากหลายขึ้นเมื่อฝึกเกิน 3 วัน",
            listOf(
                SessionDef("Push A", listOf("hpush", "incline", "vpush", "latraise", "triceps")),
                SessionDef("Pull A", listOf("vpull", "hpull", "reardelt", "biceps")),
                SessionDef("Legs A", listOf("squat", "hinge", "lunge", "legcurl", "calf", "core")),
                SessionDef("Push B", listOf("incline", "hpush@2", "chestfly", "latraise", "triceps@2")),
                SessionDef("Pull B", listOf("hpull@2", "vpull@2", "reardelt", "biceps@2")),
                SessionDef("Legs B", listOf("squat@2", "hinge@2", "glute", "legcurl", "calf", "oblique")),
            ),
        ),
        "bro" to SplitDef(
            "bro", "Bro Split (แยกกล้ามเนื้อรายวัน)", 5, 3,
            "แยกกล้ามเนื้อแต่ละกลุ่มเป็นวันของตัวเอง (อก/หลัง/ไหล่/ขา/แขน) แต่ละวันมีหลายท่าครบทุกมัด โวลุ่มต่อครั้งสูงสุด แต่แต่ละกลุ่มได้ฝึก ~1 ครั้ง/สัปดาห์ — ต้องมีวันว่างอย่างน้อย 5 วัน/สัปดาห์",
            listOf(
                SessionDef("อก (Chest)", listOf("hpush", "incline", "chestfly", "hpush@2")),
                SessionDef("หลัง (Back)", listOf("vpull", "hpull", "vpull@2", "hpull@2")),
                SessionDef("ไหล่ (Shoulders)", listOf("vpush", "latraise", "reardelt", "vpush@2")),
                SessionDef("ขา (Legs)", listOf("squat", "hinge", "lunge", "glute", "legcurl", "calf")),
                SessionDef("แขน (Arms)", listOf("biceps", "triceps", "biceps@2", "triceps@2", "core", "oblique")),
            ),
        ),
    )

    val EXP_RANK = mapOf("มือใหม่" to 0, "เคยออกบ้าง" to 1, "ออกกำลังกายประจำ" to 2, "นักกีฬา-เทรนมานาน" to 3)

    val REP_SCHEME = mapOf(
        "เพิ่มกล้ามเนื้อ" to "3-4 x 8-12",
        "Recomposition (ลด+เพิ่มพร้อมกัน)" to "3-4 x 10-12",
        "รักษาสุขภาพทั่วไป" to "3 x 10-12",
    )

    val SUPPORTED_GOALS = listOf("ลดไขมัน", "เพิ่มกล้ามเนื้อ", "Recomposition (ลด+เพิ่มพร้อมกัน)", "รักษาสุขภาพทั่วไป")
    val SUPPORTED_LOCATIONS = listOf("ฟิตเนส-ยิม", "ที่บ้าน")

    val MEALS_MAP = mapOf("2 มื้อ" to 2, "3 มื้อ" to 3, "4-5 มื้อ" to 4, "ไม่แน่นอน" to 3)
    val WATER_NOW = mapOf("น้อยกว่า 1 ลิตร" to 0.8, "1-2 ลิตร" to 1.5, "2-3 ลิตร" to 2.5, "มากกว่า 3 ลิตร" to 3.2)
}
