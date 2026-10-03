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

        Exercise("hg1", "hinge", 1, "bodyweight", "Glute Bridge", "สะพานสะโพก"),
        Exercise("hg2", "hinge", 2, "dumbbell", "Romanian Deadlift (Dumbbell)", "RDL ดัมเบล"),
        Exercise("hg3", "hinge", 3, "machine", "Hip Thrust Machine", "เครื่องฮิปทรัสต์"),
        Exercise("hg3b", "hinge", 3, "yogaball", "Stability Ball Hip Thrust", "สะพานสะโพกบนลูกบอลโยคะ (ทางเลือกที่บ้านแทนเครื่องฮิปทรัสต์)"),
        Exercise("hg4", "hinge", 4, "barbell", "Barbell Deadlift", "เดดลิฟต์บาร์เบล"),

        Exercise("hp1", "hpush", 1, "bodyweight", "Wall Push-up", "พุชอัพกำแพง"),
        Exercise("hp2a", "hpush", 2, "bodyweight", "Knee Push-up", "พุชอัพคุกเข่า"),
        Exercise("hp2b", "hpush", 2, "machine", "Chest Press Machine", "เครื่องเชสต์เพรส"),
        Exercise("hp3", "hpush", 3, "dumbbell", "Dumbbell Bench Press", "เบนช์เพรสดัมเบล"),
        Exercise("hp4", "hpush", 4, "barbell", "Barbell Bench Press", "เบนช์เพรสบาร์เบล"),

        Exercise("hl1", "hpull", 1, "cable", "Seated Cable Row (น้ำหนักเบา)", "พายเคเบิลนั่งเบา"),
        Exercise("hl1b", "hpull", 1, "bodyweight", "Superman", "เหยียดหลังท่าซุปเปอร์แมน (ไม่ใช้อุปกรณ์)"),
        Exercise("hl2", "hpull", 2, "cable", "Seated Cable Row", "พายเคเบิลนั่ง"),
        Exercise("hl3", "hpull", 3, "dumbbell", "Dumbbell Bent-over Row", "ก้มพายดัมเบล"),
        Exercise("hl4", "hpull", 4, "barbell", "Barbell Bent-over Row", "ก้มพายบาร์เบล"),

        Exercise("vl1", "vpull", 1, "machine", "Assisted Pull-up Machine", "ดึงข้อช่วยเครื่อง"),
        Exercise("vl2", "vpull", 2, "machine", "Lat Pulldown", "ดึงลัทดาวน์"),
        Exercise("vl3", "vpull", 3, "dumbbell", "Dumbbell Pullover", "พูลโอเวอร์ดัมเบล"),
        Exercise("vl4", "vpull", 4, "pullupbar", "Pull-up", "ดึงข้อ (ต้องมีบาร์โหน)"),

        Exercise("vp1", "vpush", 1, "machine", "Shoulder Press Machine (น้ำหนักเบา)", "เครื่องดันไหล่เบา"),
        Exercise("vp1b", "vpush", 1, "bodyweight", "Pike Push-up", "พุชอัพท่าไพค์ เน้นไหล่ (ไม่ใช้อุปกรณ์)"),
        Exercise("vp2", "vpush", 2, "machine", "Shoulder Press Machine", "เครื่องดันไหล่"),
        Exercise("vp3", "vpush", 3, "dumbbell", "Dumbbell Shoulder Press", "ดันไหล่ดัมเบล"),
        Exercise("vp4", "vpush", 4, "barbell", "Barbell Overhead Press", "ดันไหล่บาร์เบลเหนือศีรษะ"),

        Exercise("co1", "core", 1, "bodyweight", "Plank", "แพลงก์"),
        Exercise("co2", "core", 2, "bodyweight", "Dead Bug", "เดดบั๊ก"),
        Exercise("co3", "core", 3, "cable", "Cable Woodchopper", "วู้ดช็อปเปอร์เคเบิล"),
        Exercise("co3b", "core", 3, "abroller", "Ab Wheel Rollout", "ล้อโรลหน้าท้อง (ทางเลือกที่บ้านแทนวู้ดช็อปเปอร์เคเบิล)"),
        Exercise("co4", "core", 4, "pullupbar", "Hanging Leg Raise", "ยกขาห้อยตัว (ต้องมีบาร์โหน)"),

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

    val PATTERN_ORDER = listOf("squat", "hpush", "hpull", "hinge", "vpull", "vpush", "core")
    val PATTERN_LABEL = linkedMapOf(
        "squat" to "Squat Pattern — ขา / ก้น", "hinge" to "Hinge Pattern — หลังขา / สะโพก",
        "hpush" to "Horizontal Push — อก / ไหล่หน้า / ไทรเซป", "hpull" to "Horizontal Pull — หลังกลาง",
        "vpull" to "Vertical Pull — หลังกว้าง / ไบเซป", "vpush" to "Vertical Push — ไหล่",
        "core" to "Core — แกนกลางลำตัว",
        "biceps" to "Biceps — กล้ามแขนหน้า", "triceps" to "Triceps — กล้ามแขนหลัง",
    )
    val PATTERN_SHORT = mapOf(
        "squat" to "ขา", "hinge" to "หลังขา/สะโพก", "hpush" to "อก/ไหล่หน้า", "hpull" to "หลังกลาง",
        "vpull" to "หลังกว้าง", "vpush" to "ไหล่", "core" to "แกนกลาง", "biceps" to "ไบเซป", "triceps" to "ไทรเซป",
    )

    val EXCLUSION_MAP = mapOf(
        "เข่า" to listOf("sq3", "sq3c", "sq3d", "sq4", "sq3b"),
        "ไหล่" to listOf("vp3", "vp4", "tc3", "tc4"),
        "หลัง" to listOf("hg3", "hg4", "bc4", "hg3b", "co3b"),
        "ข้อมือ" to listOf("hp2a", "hp3", "hp4", "bc4", "tc4"),
        "หัวใจ-หลอดเลือด" to listOf("sq4", "hg4", "hp4", "vp4", "hl4", "bc4", "tc4"),
    )

    /** ลำดับตรงกับ Object.keys(SPLIT_DEFS) ใน JS */
    val SPLIT_DEFS: Map<String, SplitDef> = linkedMapOf(
        "fullbody" to SplitDef(
            "fullbody", "Full Body", 1, 0,
            "ทุกกลุ่มกล้ามเนื้อในเซสชันเดียว ทำซ้ำทุกวันที่เลือก — ปลอดภัยสุดสำหรับมือใหม่ ต้องการวันว่างน้อยสุด",
            listOf(SessionDef("Full Body", PATTERN_ORDER)),
        ),
        "ul" to SplitDef(
            "ul", "Upper / Lower", 4, 1,
            "แยกวันบนตัว (Upper) กับล่างตัว (Lower) สลับกัน ให้แต่ละกลุ่มกล้ามเนื้อพักได้นานขึ้น ต้องมีวันว่างอย่างน้อย 4 วัน/สัปดาห์",
            listOf(
                SessionDef("Upper", listOf("hpush", "hpull", "vpush", "vpull")),
                SessionDef("Lower", listOf("squat", "hinge", "core")),
            ),
        ),
        "ppl" to SplitDef(
            "ppl", "Push / Pull / Legs", 3, 2,
            "แยกวันดัน (Push) ดึง (Pull) และขา (Legs) หมุนวนกัน เหมาะกับคนที่ออกกำลังกายประจำและมีวันว่างพอจะฝึกแต่ละกลุ่มด้วยโวลุ่มสูงขึ้น",
            listOf(
                SessionDef("Push", listOf("hpush", "vpush")),
                SessionDef("Pull", listOf("hpull", "vpull")),
                SessionDef("Legs", listOf("squat", "hinge", "core")),
            ),
        ),
        "bro" to SplitDef(
            "bro", "Bro Split (แยกกล้ามเนื้อรายวัน)", 5, 3,
            "แยกกล้ามเนื้อแต่ละกลุ่มเป็นวันของตัวเอง (อก/หลัง/ไหล่/ขา/แขน) โวลุ่มต่อครั้งสูงสุดในบรรดา 4 รูปแบบ แต่แต่ละกลุ่มกล้ามเนื้อได้ฝึกแค่ ~1 ครั้ง/สัปดาห์ — ต้องมีวันว่างอย่างน้อย 5 วัน/สัปดาห์",
            listOf(
                SessionDef("อก (Chest)", listOf("hpush")),
                SessionDef("หลัง (Back)", listOf("hpull", "vpull")),
                SessionDef("ไหล่ (Shoulders)", listOf("vpush")),
                SessionDef("ขา (Legs)", listOf("squat", "hinge", "core")),
                SessionDef("แขน (Arms)", listOf("biceps", "triceps")),
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
