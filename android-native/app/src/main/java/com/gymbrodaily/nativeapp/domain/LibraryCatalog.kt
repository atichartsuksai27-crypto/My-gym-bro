package com.gymbrodaily.nativeapp.domain

/* ============================================================
   ท่าเสริมสำหรับ "คลังท่า" เท่านั้น — ตัวสร้างตารางไม่เห็นและไม่เลือกท่าเหล่านี้
   แยกจาก Catalog.EXERCISES โดยตั้งใจ: array นั้นต้องตรงกับ EXERCISES ใน app.js (GoldenParityTest เทียบกัน)
   และการเพิ่มท่าเข้ากลุ่มเดิมจะเปลี่ยนผลการเลือกท่าอัตโนมัติ
   id ขึ้นต้นด้วย "x" เสมอเพื่อไม่ชนกับ id ใน Catalog
   ============================================================ */

object LibraryCatalog {
    private fun x(id: String, pattern: String, tier: Int, equip: String, th: String, sub: String) =
        Exercise(id, pattern, tier, equip, th, sub)

    val EXTRA = listOf(
        // ขา / ก้น
        x("xsq1", "squat", 1, "bodyweight", "Wall Sit", "นั่งพิงกำแพงค้างท่า"),
        x("xsq2", "squat", 2, "bodyweight", "Split Squat", "สควอทแยกขาหน้า-หลังอยู่กับที่"),
        x("xsq3", "squat", 2, "bodyweight", "Reverse Lunge", "ลันจ์ก้าวถอยหลัง"),
        x("xsq4", "squat", 2, "machine", "Leg Extension Machine", "เครื่องเตะขาเหยียดเข่า เน้นต้นขาหน้า"),
        x("xsq5", "squat", 3, "dumbbell", "Walking Lunge (Dumbbell)", "ลันจ์เดินถือดัมเบล"),
        x("xsq6", "squat", 3, "dumbbell", "Bulgarian Split Squat", "สควอทเท้าหลังพักบนเก้าอี้/ม้านั่ง"),
        x("xsq7", "squat", 3, "machine", "Hack Squat Machine", "เครื่องแฮคสควอท"),
        x("xsq8", "squat", 3, "bodyweight", "Jump Squat", "สควอทกระโดด (เน้นพลัง)"),
        x("xsq9", "squat", 4, "barbell", "Barbell Front Squat", "สควอทบาร์เบลด้านหน้า"),

        // หลังขา / สะโพก
        x("xhg1", "hinge", 1, "bodyweight", "Back Extension (Bodyweight)", "นอนคว่ำเหยียดหลังล่าง/สะโพก"),
        x("xhg2", "hinge", 2, "bodyweight", "Single-Leg Glute Bridge", "สะพานสะโพกขาเดียว"),
        x("xhg3", "hinge", 2, "machine", "Lying Leg Curl Machine", "เครื่องนอนคว่ำงอเข่า เน้นหลังขา"),
        x("xhg4", "hinge", 2, "machine", "Seated Leg Curl Machine", "เครื่องนั่งงอเข่า เน้นหลังขา"),
        x("xhg5", "hinge", 2, "cable", "Cable Pull-Through", "ดึงเคเบิลผ่านขา เน้นสะโพก"),
        x("xhg6", "hinge", 3, "dumbbell", "Single-Leg Romanian Deadlift", "RDL ขาเดียวถือดัมเบล"),
        x("xhg7", "hinge", 3, "kettlebell", "Kettlebell Swing", "สวิงเคตเทิลเบลล์"),
        x("xhg8", "hinge", 3, "barbell", "Barbell Hip Thrust", "ฮิปทรัสต์บาร์เบล"),
        x("xhg9", "hinge", 4, "barbell", "Barbell Good Morning", "กู๊ดมอร์นิ่งบาร์เบล"),
        x("xhg10", "hinge", 4, "barbell", "Sumo Deadlift", "เดดลิฟต์ท่าซูโม่ (ยืนกว้าง)"),

        // อก / ไหล่หน้า
        x("xhp1", "hpush", 1, "bodyweight", "Incline Push-up", "พุชอัพมือสูง (วางมือบนม้านั่ง/โต๊ะ)"),
        x("xhp2", "hpush", 2, "bodyweight", "Push-up", "พุชอัพมาตรฐาน"),
        x("xhp3", "hpush", 2, "dumbbell", "Dumbbell Fly", "ฟลายดัมเบลนอนราบ"),
        x("xhp4", "hpush", 2, "machine", "Pec Deck Machine", "เครื่องเพคเด็ค (บีบอก)"),
        x("xhp5", "hpush", 2, "cable", "Cable Crossover", "ครอสโอเวอร์เคเบิล"),
        x("xhp6", "hpush", 3, "dumbbell", "Incline Dumbbell Press", "ดันดัมเบลบนม้านั่งเอียง เน้นอกบน"),
        x("xhp7", "hpush", 3, "bodyweight", "Decline Push-up", "พุชอัพเท้าสูง"),
        x("xhp8", "hpush", 4, "barbell", "Incline Barbell Bench Press", "เบนช์เพรสบาร์เบลม้านั่งเอียง"),

        // หลังกลาง
        x("xhl1", "hpull", 2, "dumbbell", "One-Arm Dumbbell Row", "พายดัมเบลข้างเดียว"),
        x("xhl2", "hpull", 2, "machine", "Chest-Supported Row Machine", "เครื่องพายเอนอกพักกับเบาะ"),
        x("xhl3", "hpull", 2, "pullupbar", "Inverted Row", "พายตัวใต้บาร์ (ตัวลอยเฉียง)"),
        x("xhl4", "hpull", 3, "barbell", "T-Bar Row", "พายทีบาร์"),

        // หลังกว้าง
        x("xvl1", "vpull", 2, "cable", "Straight-Arm Pulldown", "ดึงเคเบิลแขนตรง เน้นหลังกว้าง"),
        x("xvl2", "vpull", 2, "machine", "Close-Grip Lat Pulldown", "ลัทดาวน์จับแคบ"),
        x("xvl3", "vpull", 3, "pullupbar", "Negative Pull-up", "ดึงข้อแบบลดตัวช้า ๆ (ฝึกก่อนดึงข้อเต็ม)"),
        x("xvl4", "vpull", 4, "pullupbar", "Chin-up", "ดึงข้อมือหงาย เน้นไบเซปร่วม"),

        // ไหล่ (กดขึ้น)
        x("xvp1", "vpush", 3, "dumbbell", "Arnold Press", "อาร์โนลด์เพรส (ดันไหล่พร้อมหมุนข้อมือ)"),
        x("xvp2", "vpush", 4, "barbell", "Barbell Push Press", "พุชเพรสบาร์เบล (ใช้ขาช่วยส่งแรง)"),

        // ไหล่ข้าง/หลัง / ทราพีเซียส
        x("xdl1", "delts", 2, "dumbbell", "Dumbbell Lateral Raise", "ยกดัมเบลไปด้านข้าง เน้นไหล่ข้าง"),
        x("xdl2", "delts", 2, "dumbbell", "Dumbbell Front Raise", "ยกดัมเบลไปด้านหน้า"),
        x("xdl3", "delts", 2, "dumbbell", "Rear Delt Fly", "ก้มกางแขนดัมเบล เน้นไหล่หลัง"),
        x("xdl4", "delts", 2, "machine", "Reverse Pec Deck", "เครื่องเพคเด็คย้อนกลับ เน้นไหล่หลัง"),
        x("xdl5", "delts", 2, "cable", "Face Pull", "ดึงเคเบิลเข้าหน้า เน้นไหล่หลัง/สะบัก"),
        x("xdl6", "delts", 2, "dumbbell", "Dumbbell Shrug", "ยักไหล่ดัมเบล"),
        x("xdl7", "delts", 3, "cable", "Cable Lateral Raise", "ยกไหล่ข้างด้วยเคเบิล"),
        x("xdl8", "delts", 3, "barbell", "Barbell Shrug", "ยักไหล่บาร์เบล"),

        // แกนกลาง
        x("xco1", "core", 1, "bodyweight", "Crunch", "ครันช์"),
        x("xco2", "core", 1, "bodyweight", "Bird Dog", "เบิร์ดด็อก (ยกแขนขาสลับข้างบนสี่เหลี่ยม)"),
        x("xco3", "core", 2, "bodyweight", "Side Plank", "แพลงก์ด้านข้าง"),
        x("xco4", "core", 2, "bodyweight", "Bicycle Crunch", "ครันช์ปั่นจักรยาน"),
        x("xco5", "core", 2, "bodyweight", "Russian Twist", "บิดลำตัวนั่งเอนหลัง"),
        x("xco6", "core", 2, "bodyweight", "Mountain Climber", "ปีนเขา (วิ่งอยู่กับที่ท่าวิดพื้น)"),
        x("xco7", "core", 2, "bodyweight", "Lying Leg Raise", "นอนหงายยกขา"),
        x("xco8", "core", 2, "cable", "Pallof Press", "ดันเคเบิลต้านการบิดลำตัว"),
        x("xco9", "core", 3, "cable", "Cable Crunch", "ครันช์คุกเข่าดึงเคเบิล"),
        x("xco10", "core", 3, "bodyweight", "Hollow Body Hold", "ค้างท่าเรือ (นอนหงายยกแขนขาลอย)"),

        // ไบเซป
        x("xbc1", "biceps", 2, "dumbbell", "Hammer Curl", "แฮมเมอร์เคิร์ล (จับแนวตั้ง)"),
        x("xbc2", "biceps", 2, "dumbbell", "Concentration Curl", "คอนเซนเทรชันเคิร์ลนั่งศอกพักต้นขา"),
        x("xbc3", "biceps", 3, "dumbbell", "Incline Dumbbell Curl", "เคิร์ลดัมเบลบนม้านั่งเอียง"),
        x("xbc4", "biceps", 3, "barbell", "EZ-Bar Curl", "เคิร์ลบาร์โค้งอีแซด"),
        x("xbc5", "biceps", 3, "barbell", "Reverse Barbell Curl", "เคิร์ลบาร์เบลมือคว่ำ เน้นปลายแขน"),

        // ไทรเซป
        x("xtc1", "triceps", 2, "bodyweight", "Close-Grip Push-up", "พุชอัพมือชิด"),
        x("xtc2", "triceps", 2, "dumbbell", "Dumbbell Kickback", "เตะหลังดัมเบลก้มตัว"),
        x("xtc3", "triceps", 2, "cable", "Rope Pushdown", "กดเคเบิลแบบเชือก"),
        x("xtc4", "triceps", 3, "bodyweight", "Diamond Push-up", "พุชอัพมือเพชร"),
        x("xtc5", "triceps", 3, "barbell", "Skull Crusher", "สกัลครัชเชอร์ (นอนเหยียดแขนบาร์เบล)"),

        // น่อง
        x("xcf1", "calves", 1, "bodyweight", "Standing Calf Raise (Bodyweight)", "เขย่งปลายเท้ายืนน้ำหนักตัว"),
        x("xcf2", "calves", 2, "bodyweight", "Single-Leg Calf Raise", "เขย่งปลายเท้าขาเดียว"),
        x("xcf3", "calves", 2, "dumbbell", "Dumbbell Calf Raise", "เขย่งปลายเท้าถือดัมเบล"),
        x("xcf4", "calves", 2, "machine", "Seated Calf Raise Machine", "เครื่องนั่งยกส้นเท้า"),
        x("xcf5", "calves", 3, "machine", "Standing Calf Raise Machine", "เครื่องยืนยกส้นเท้า"),

        // คาร์ดิโอ / ทั้งตัว
        x("xcd1", "cardio", 1, "bodyweight", "Jumping Jacks", "กระโดดตบ"),
        x("xcd2", "cardio", 1, "bodyweight", "High Knees", "วิ่งยกเข่าสูงอยู่กับที่"),
        x("xcd3", "cardio", 1, "machine", "Stationary Bike", "จักรยานนั่งปั่นในร่ม"),
        x("xcd4", "cardio", 2, "machine", "Rowing Machine", "เครื่องพายเรือ"),
        x("xcd5", "cardio", 2, "machine", "Treadmill Run", "วิ่งบนลู่"),
        x("xcd6", "cardio", 2, "bodyweight", "Jump Rope", "กระโดดเชือก"),
        x("xcd7", "cardio", 3, "bodyweight", "Burpee", "เบอร์พี"),
    )

    val ALL: List<Exercise> = Catalog.EXERCISES + EXTRA

    private val EXTRA_IDS = EXTRA.map { it.id }.toSet()
    fun isLibraryOnly(id: String) = id in EXTRA_IDS

    /** ลำดับกลุ่มในคลัง = กลุ่มเดิม + กลุ่มที่มีเฉพาะในคลัง */
    val GROUP_ORDER = Catalog.PATTERN_ORDER + listOf("biceps", "triceps", "delts", "calves", "cardio")

    val GROUP_LABEL: Map<String, String> = Catalog.PATTERN_LABEL + mapOf(
        "delts" to "Delts & Traps — ไหล่ข้าง / ไหล่หลัง / บ่า",
        "calves" to "Calves — น่อง",
        "cardio" to "Cardio — คาร์ดิโอ / ทั้งตัว",
    )

    val GROUP_SHORT: Map<String, String> = Catalog.PATTERN_SHORT + mapOf(
        "delts" to "ไหล่ข้าง/หลัง", "calves" to "น่อง", "cardio" to "คาร์ดิโอ",
    )

    /** ท่าเสริมที่ควรระวังเมื่อมีอาการบาดเจ็บ (ใช้แสดงเตือนในคลังเท่านั้น ไม่มีผลกับการสร้างตาราง) */
    val EXTRA_CAUTION: Map<String, List<String>> = mapOf(
        "เข่า" to listOf("xsq2", "xsq3", "xsq4", "xsq5", "xsq6", "xsq7", "xsq8", "xsq9", "xcd2", "xcd6", "xcd7", "xcd5"),
        "ไหล่" to listOf("xvp1", "xvp2", "xhp8", "xhp6", "xhp3", "xdl1", "xdl2", "xtc5", "xcd7", "xvl3", "xvl4"),
        "หลัง" to listOf("xhg6", "xhg7", "xhg8", "xhg9", "xhg10", "xhl4", "xvp2", "xsq9", "xcd7", "xhg1", "xco5"),
        "ข้อมือ" to listOf("xhp2", "xhp7", "xtc1", "xtc4", "xbc4", "xbc5", "xcd7", "xco6", "xco3", "xhg7"),
        "หัวใจ-หลอดเลือด" to listOf("xsq9", "xhg9", "xhg10", "xhp8", "xvp2", "xhl4", "xvl4", "xcd7", "xcd2", "xcd6", "xhg7"),
    )

    /** อาการบาดเจ็บที่ท่านี้ควรระวัง: ท่าใน Catalog ใช้ EXCLUSION_MAP เดิม ท่าเสริมใช้ EXTRA_CAUTION */
    fun cautionsFor(id: String): List<String> =
        (if (isLibraryOnly(id)) EXTRA_CAUTION else Catalog.EXCLUSION_MAP).filterValues { id in it }.keys.toList()

    fun byId(id: String): Exercise? = ALL.firstOrNull { it.id == id }

    /** ท่าที่วัดเป็นเวลา (วินาที) ไม่ใช่จำนวนครั้ง — ตรงกับที่ generator ทำกับกลุ่ม core */
    fun isTimeBased(e: Exercise) = e.pattern == "core" || e.pattern == "cardio" || e.id == "xsq1"

    fun defaultSetsReps(e: Exercise, goal: String?) = when {
        e.pattern == "cardio" -> "3 x 60 วิ"
        isTimeBased(e) -> "3 x 30-45 วิ"
        else -> Generator.repSchemeFor(goal)
    }

    /* ---------- คำแนะนำรายท่า: เหมาะกับใคร / ความเสี่ยง ---------- */

    data class Guide(
        /** 0 = ต่ำ, 1 = ปานกลาง, 2 = สูง */
        val risk: Int,
        val suits: String,
        val tips: List<String>,
        /** เหตุผลที่ท่านี้ไม่ใช่ความเสี่ยงต่ำ (ว่างถ้าเสี่ยงต่ำ) */
        val why: String = "",
    ) {
        val riskLabel get() = RISK_LABEL[risk]
    }

    val RISK_LABEL = listOf("เสี่ยงต่ำ", "เสี่ยงปานกลาง", "เสี่ยงสูง")

    private val SUITS_BY_TIER = mapOf(
        1 to "เหมาะกับมือใหม่ หรือคนที่กลับมาออกกำลังกายหลังหยุดไปนาน",
        2 to "เหมาะกับคนที่ฝึกมาแล้วสักระยะและคุมฟอร์มพื้นฐานได้",
        3 to "เหมาะกับคนที่ฝึกสม่ำเสมอและฟอร์มนิ่งแล้ว ไม่แนะนำให้มือใหม่ลอง",
        4 to "สำหรับผู้ฝึกขั้นสูง ควรมีเทรนเนอร์หรือคนช่วยดูแลตอนเริ่มทำ",
    )

    private val TIP_BY_EQUIP = mapOf(
        "barbell" to "บาร์เบลน้ำหนักหนัก ควรมีคนช่วยสปอตหรือตั้งเซฟตี้บาร์ก่อนเริ่มเซ็ต",
        "dumbbell" to "เลือกน้ำหนักที่คุมได้ตลอดเซ็ต และวางดัมเบลลงช้าๆ ไม่โยน",
        "machine" to "ปรับที่นั่งและแกนเครื่องให้พอดีตัวก่อนเริ่ม และเริ่มจากน้ำหนักเบา",
        "cable" to "ตรวจว่าเคเบิลและตัวล็อกแน่นก่อนเริ่ม ไม่ใช้น้ำหนักเหวี่ยง",
        "kettlebell" to "จับให้แน่นและเว้นพื้นที่รอบตัวให้โล่ง เพราะน้ำหนักเหวี่ยงได้",
        "pullupbar" to "ตรวจว่าบาร์แข็งแรง และลงจากบาร์อย่างช้าๆ ไม่ปล่อยตัวหล่น",
        "bodyweight" to "ใช้น้ำหนักตัวเอง คุมจังหวะให้ช้าและนิ่ง ไม่ต้องรีบทำให้ครบ",
    )

    private val TIP_BY_GROUP = mapOf(
        "squat" to "ให้เข่าชี้ไปทางเดียวกับปลายเท้า และไม่ปล่อยเข่าบิดเข้าด้านใน",
        "hinge" to "รักษาหลังให้ตรงตลอดการเคลื่อนไหว ถ้าหลังเริ่มโค้งให้ลดน้ำหนักทันที",
        "hpush" to "ไม่ล็อกศอกแรงตอนดันสุด และไม่เด้งน้ำหนักออกจากหน้าอก",
        "hpull" to "ดึงด้วยหลังไม่ใช่แขน และไม่ใช้แรงเหวี่ยงจากลำตัว",
        "vpull" to "เริ่มดึงจากหัวไหล่ลง ไม่ปล่อยตัวทิ้งน้ำหนักตอนยืดแขนสุด",
        "vpush" to "ไม่แอ่นหลังตอนดันเหนือศีรษะ และหยุดถ้าไหล่รู้สึกเจ็บแปลบ",
        "core" to "หายใจต่อเนื่อง ไม่กลั้นหายใจ และไม่ให้หลังส่วนล่างแอ่น",
        "biceps" to "ไม่แกว่งตัวช่วย ศอกอยู่ใกล้ลำตัว",
        "triceps" to "ล็อกศอกให้อยู่กับที่ ไม่กางศอกออก ระวังข้อศอกถ้าเริ่มปวด",
        "delts" to "เลือกน้ำหนักเบา ไม่ยกเกินระดับไหล่ และไม่ใช้แรงเหวี่ยง",
        "calves" to "เคลื่อนไหวเต็มช่วงอย่างช้าๆ ทรงตัวให้มั่น ถ้าตะคริวให้หยุดยืดก่อน",
        "cardio" to "วอร์มอัพก่อนเสมอ และหยุดทันทีถ้าเวียนหัว แน่นหน้าอก หรือหายใจไม่ทัน",
    )

    /**
     * ระดับความเสี่ยงรายท่า (ให้คะแนนทีละท่า ไม่คำนวณจากสูตร): 2 = สูง, 1 = ปานกลาง, ท่าที่ไม่อยู่ในรายการ = ต่ำ
     * เกณฑ์: น้ำหนักที่อยู่เหนือ/บนตัวและพลาดแล้วหนัก, ภาระต่อหลังส่วนล่าง/ข้อต่อ, แรงกระแทก, ความซับซ้อนของฟอร์ม
     * เครื่องไม่ได้แปลว่าปลอดภัยเสมอ (เช่น เลกเพรสแนวตั้ง) — เป็นแนวทางกลางๆ ยังไม่ผ่านการตรวจจากผู้เชี่ยวชาญ
     */
    private val RISK: Map<String, Pair<Int, String>> = mapOf(
        // สูง
        "sq4" to (2 to "บาร์หนักอยู่บนหลัง ถ้าเสียหลักหรือลุกไม่ไหวอาจติดใต้บาร์ และภาระต่อหลังส่วนล่าง/เข่าสูง ควรมีเซฟตี้บาร์หรือคนสปอต"),
        "sq3d" to (2 to "น้ำหนักกดลงเหนือลำตัว สะโพกงอลึกจนหลังส่วนล่างโค้งง่าย และถ้าล็อกเข่าหรือพลาดตอนปลดตัวล็อก ขาอาจโดนกดทับ"),
        "xsq9" to (2 to "บาร์อยู่หน้าไหล่ ต้องยืดอกและข้อมือยืดหยุ่นพอ ถ้าตัวพับบาร์จะหลุดไปข้างหน้า"),
        "hg4" to (2 to "ภาระต่อกระดูกสันหลังสูง ถ้าหลังโค้งตอนล้าเสี่ยงบาดเจ็บหลังได้ง่าย"),
        "xhg10" to (2 to "ยกน้ำหนักมากจากพื้นด้วยท่ากว้าง ภาระต่อหลังและสะโพกสูง ถ้าหลังโค้งตอนล้าเสี่ยงบาดเจ็บ"),
        "xhg9" to (2 to "บาร์อยู่บนหลังขณะก้มตัว ถ้าหลังโค้งหรือน้ำหนักเกินกำลัง หลังส่วนล่างรับแรงเต็มที่"),
        "hp4" to (2 to "บาร์อยู่เหนืออก ถ้ายกไม่ขึ้นแล้วไม่มีคนสปอตหรือเซฟตี้ บาร์ทับอกได้"),
        "xhp8" to (2 to "บาร์อยู่เหนือหน้าอกส่วนบนและคอ ไหล่รับภาระสูง ถ้ายกไม่ขึ้นบาร์ทับตัวได้ ควรมีคนสปอต"),
        "tc4" to (2 to "บาร์เหนืออกและแคบ ข้อมือกับข้อศอกรับภาระสูง ถ้ายกไม่ขึ้นบาร์ทับตัวได้ ควรมีคนสปอต"),
        "vp4" to (2 to "บาร์อยู่เหนือศีรษะ ไหล่รับภาระสูงและหลังส่วนล่างแอ่นง่ายเมื่อล้า"),
        "xvp2" to (2 to "ใช้แรงเหวี่ยงดันบาร์ขึ้นเหนือศีรษะ แรงกระแทกต่อไหล่และหลังสูง ต้องคุมจังหวะแม่น"),
        "hl4" to (2 to "ก้มตัวทำมุมค้างไว้ตลอดเซ็ตพร้อมบาร์หนัก ถ้าหลังโค้งภาระต่อหลังส่วนล่างสูง"),
        "xtc5" to (2 to "บาร์ลงมาใกล้หน้าผากและข้อศอกรับภาระหนัก ถ้าข้อศอกล้าหรือพลาดบาร์ตกใส่หน้าได้"),
        // ปานกลาง
        "sq3" to (1 to "ถ้าลงลึกจนก้นยกหรือหลังโค้ง หลังส่วนล่างรับแรงมาก และห้ามล็อกเข่าตอนดันสุด"),
        "sq3c" to (1 to "ถ้างอสะโพกลึกเกินจนหลังโค้ง หลังส่วนล่างรับแรงมาก และห้ามล็อกเข่าตอนดันสุด"),
        "sq3b" to (1 to "ต้องทรงตัวขาเดียวพร้อมก้าวขึ้นที่สูง เสี่ยงล้มและเข่าบิดถ้าล้า"),
        "xsq4" to (1 to "แรงเฉือนที่เข่าสูงเมื่อเหยียดสุด ไม่เหมาะกับคนปวดเข่าเรื้อรัง"),
        "xsq5" to (1 to "เดินพร้อมน้ำหนักต้องทรงตัวดี เข่าและสะโพกรับแรงต่อเนื่อง"),
        "xsq6" to (1 to "ขาหลังยกสูง ทรงตัวยาก เข่าหน้ารับแรงมาก"),
        "xsq7" to (1 to "เข่ารับแรงมากเมื่อลงลึก และหลังโค้งได้ถ้าเบาะไม่พอดีตัว"),
        "xsq8" to (1 to "มีแรงกระแทกตอนลงพื้นต่อเข่าและข้อเท้า"),
        "hg2" to (1 to "ก้มตัวพร้อมน้ำหนัก ถ้าหลังโค้งหลังส่วนล่างรับแรง"),
        "hg3b" to (1 to "ลูกบอลลื่นไถลได้ถ้าวางเท้าไม่มั่น เสี่ยงล้ม"),
        "xhg6" to (1 to "ทรงตัวขาเดียวขณะก้มตัว เสี่ยงเสียหลักและหลังโค้งถ้าล้า"),
        "xhg7" to (1 to "เหวี่ยงน้ำหนักอย่างรวดเร็ว ต้องใช้สะโพกไม่ใช่หลัง ถ้าฟอร์มพลาดหลังส่วนล่างรับแรงมาก"),
        "xhg8" to (1 to "บาร์กดทับสะโพก ควรมีแผ่นรองและตั้งตัวให้มั่นก่อนเริ่ม ถ้าแอ่นหลังเกินหลังส่วนล่างรับแรง"),
        "hp3" to (1 to "ดัมเบลหนักอาจหลุดมือหรือเสียหลักตอนยกขึ้น/วางลง ควรมีคนช่วยส่งเมื่อน้ำหนักมาก"),
        "xhp3" to (1 to "ไหล่และอกถูกยืดมากตอนเปิดแขน ถ้าลงลึกหรือน้ำหนักเกินเสี่ยงไหล่บาดเจ็บ"),
        "xhp6" to (1 to "ดัมเบลหนักเหนือหน้าอกส่วนบน ไหล่รับภาระมากกว่าเบนช์ราบ"),
        "xhp7" to (1 to "ไหล่และข้อมือรับน้ำหนักตัวมากขึ้นกว่าพุชอัพปกติ"),
        "xhl4" to (1 to "ก้มตัวพร้อมบาร์หนัก ถ้าหลังโค้งหลังส่วนล่างรับแรง"),
        "vl3" to (1 to "ไหล่ถูกยืดมากเหนือศีรษะ ถ้าน้ำหนักเกินเสี่ยงไหล่บาดเจ็บ"),
        "vl4" to (1 to "ต้องรับน้ำหนักตัวทั้งหมด ไหล่และข้อศอกรับแรงมาก ไม่เหมาะกับคนที่ยังดึงน้ำหนักตัวไม่ไหว"),
        "xvl3" to (1 to "ตอนลงช้าไหล่และข้อศอกรับน้ำหนักตัวเต็ม ถ้าปล่อยตัวหล่นเสี่ยงบาดเจ็บ"),
        "xvl4" to (1 to "จับหงายทำให้ข้อศอกและไบเซปรับภาระมากกว่าพูลอัพ"),
        "vp3" to (1 to "ดัมเบลอยู่เหนือศีรษะ ไหล่รับภาระและหลังแอ่นง่ายเมื่อล้า"),
        "xvp1" to (1 to "ไหล่หมุนขณะรับน้ำหนักเหนือศีรษะ ต้องคุมจังหวะ ถ้าฝืนไหล่บาดเจ็บง่าย"),
        "co3" to (1 to "บิดลำตัวพร้อมแรงต้าน ถ้าใช้น้ำหนักเกินหลังส่วนล่างรับแรงบิด"),
        "co3b" to (1 to "หลังส่วนล่างแอ่นง่ายเมื่อแกนกลางล้า ไหล่รับภาระด้วย"),
        "co4" to (1 to "ห้อยตัวด้วยแขนและยกขา ไหล่และหลังส่วนล่างรับแรง ถ้าแกว่งตัวเสี่ยงบาดเจ็บ"),
        "bc4" to (1 to "ถ้าแกว่งตัวช่วยยก หลังส่วนล่างรับแรง และข้อมือรับภาระต่อเนื่อง"),
        "xbc5" to (1 to "จับคว่ำมือทำให้ข้อมือและข้อศอกรับภาระมากกว่าปกติ"),
        "tc2" to (1 to "ไหล่ด้านหน้าถูกยืดและรับแรงมากตอนลงลึก เสี่ยงไหล่บาดเจ็บถ้าลงต่ำเกิน"),
        "tc3" to (1 to "ข้อศอกและไหล่ยืดเหนือศีรษะพร้อมน้ำหนัก ถ้าน้ำหนักเกินข้อศอกเจ็บง่าย"),
        "xtc4" to (1 to "ข้อมือและข้อศอกรับน้ำหนักตัวในมุมแคบ"),
        "xcd2" to (1 to "มีแรงกระแทกซ้ำๆ ต่อเข่าและข้อเท้า"),
        "xcd4" to (1 to "ถ้าฟอร์มพลาดจะโค้งหลังเมื่อดึง ควรเรียนรู้จังหวะขา-ลำตัว-แขนก่อนเพิ่มความเร็ว"),
        "xcd5" to (1 to "มีแรงกระแทกต่อเข่า และเสี่ยงล้มถ้าเร่งความเร็วเกินความคุ้นเคย"),
        "xcd6" to (1 to "มีแรงกระแทกต่อเข่าและข้อเท้า และเสี่ยงสะดุดเชือก"),
        "xcd7" to (1 to "แรงกระแทกสูงและเปลี่ยนท่าเร็ว ข้อมือ เข่า และหลังส่วนล่างรับแรงเมื่อล้า"),
    )

    /** สรุปคำแนะนำของท่า — ระดับความเสี่ยงมาจาก [RISK] ส่วนเหมาะกับใคร/ข้อควรระวังเป็นข้อความกลางตาม Tier อุปกรณ์ กลุ่มกล้ามเนื้อ */
    fun guideFor(e: Exercise): Guide {
        val (risk, why) = RISK[e.id] ?: (0 to "")
        val tips = listOfNotNull(TIP_BY_EQUIP[e.equip], TIP_BY_GROUP[e.pattern])
        return Guide(risk, SUITS_BY_TIER[e.tier].orEmpty(), tips, why)
    }
}
