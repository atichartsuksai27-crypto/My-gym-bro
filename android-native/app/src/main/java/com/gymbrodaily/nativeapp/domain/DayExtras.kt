package com.gymbrodaily.nativeapp.domain

import kotlin.math.max

/* ============================================================
   ส่วนเสริมของบันทึกรายวัน — พอร์ตจาก app.js: อาการหลังออกกำลังกาย (analyzeSymptom / SYMPTOM_INFO),
   วอร์มร่างกาย/คลายกล้ามเนื้อ (PREP_WARM / PREP_COOL / prepTips), ความเครียด (STRESS_LEVELS / stressLabel)
   ข้อความต้องตรงกับเว็บทุกตัวอักษร ตรวจด้วย ProgressionParityTest เทียบ golden/progression.json
   ============================================================ */

data class SymptomInfo(val label: String, val cls: String, val icon: String, val advice: String)
data class SymptomResult(val level: String, val words: List<String>)
data class StressLevel(val v: Int, val label: String, val icon: String)

object DayExtras {
    /** ระดับเรียงจากหนักไปเบา ระดับที่หนักสุดที่เจอคือผลลัพธ์ · คำที่มี "ไม่" นำหน้า (เช่น "ไม่บวม") ไม่นับ */
    private val SYMPTOM_RULES = listOf(
        "emergency" to listOf(
            "เจ็บหน้าอก", "แน่นหน้าอก", "หายใจไม่ออก", "หายใจลำบาก", "หน้ามืด", "เป็นลม", "วูบ", "ใจสั่น", "หัวใจเต้นผิดจังหวะ",
            "ปัสสาวะสีเข้ม", "ปัสสาวะสีน้ำตาล", "ฉี่สีเข้ม", "ฉี่สีโค้ก", "ชาครึ่งซีก", "พูดไม่ชัด", "chest pain", "faint",
        ),
        "injury" to listOf(
            "เจ็บแปลบ", "ปวดแปลบ", "เจ็บจี๊ด", "ปวดจี๊ด", "เสียงดัง", "ได้ยินเสียง", "ป๊อก", "กร๊อบ", "บวม", "ช้ำ", "ชา", "เหน็บ",
            "ร้าวลง", "ปวดร้าว", "ขยับไม่ได้", "ยกไม่ขึ้น", "ลงน้ำหนักไม่ได้", "เดินไม่ได้", "หลุด", "เคล็ด", "พลิก", "ฉีก", "อ่อนแรง",
            "sharp pain", "swelling", "numb",
        ),
        "caution" to listOf(
            "ปวดข้อ", "เจ็บข้อ", "ปวดเข่า", "เจ็บเข่า", "ปวดไหล่", "เจ็บไหล่", "ปวดหลัง", "เจ็บหลัง", "ปวดเอว", "ปวดข้อมือ", "เจ็บข้อมือ",
            "ปวดศอก", "เจ็บศอก", "ปวดสะโพก", "ปวดคอ", "ข้อฝืด", "ข้อติด", "ตะคริว", "เจ็บ", "pain",
        ),
        "normal" to listOf(
            "ปวดเมื่อย", "เมื่อย", "ตึง", "ล้า", "เหนื่อย", "ระบม", "ปกติ", "ไม่มีอาการ", "ไม่เจ็บ", "ไม่ปวด", "สบายดี", "sore",
        ),
    )

    val SYMPTOM_INFO: Map<String, SymptomInfo> = mapOf(
        "emergency" to SymptomInfo("อันตราย", "danger", "🚨", "หยุดออกกำลังกายทันที นั่งพัก ถ้าอาการไม่ดีขึ้นหรือรุนแรงให้ไปพบแพทย์หรือโทร 1669"),
        "injury" to SymptomInfo("เข้าข่ายบาดเจ็บ", "danger", "⚠️", "หยุดเล่นท่านี้ พักส่วนที่เจ็บ ประคบเย็น 15-20 นาที ถ้าบวม/ปวดมากหรือไม่ดีขึ้นใน 2-3 วันควรพบแพทย์ และแจ้งอาการในแบบสอบถาม (หมวดอาการบาดเจ็บ) ให้ระบบล็อกท่าที่เสี่ยง"),
        "caution" to SymptomInfo("ควรระวัง", "warn", "⚠️", "อาจเป็นสัญญาณเริ่มบาดเจ็บ — ครั้งหน้าลดน้ำหนัก เช็คฟอร์ม ถ้าปวดข้อต่อซ้ำหรือนานเกิน 2-3 วันควรปรึกษาผู้เชี่ยวชาญ"),
        "normal" to SymptomInfo("ปกติหลังฝึก", "ok", "✓", "อาการล้า/ตึง/ระบมของกล้ามเนื้อเป็นเรื่องปกติหลังฝึก มักหายใน 1-3 วัน"),
        "unknown" to SymptomInfo("บันทึกแล้ว", "", "📝", "ระบบแยกระดับจากคำที่พิมพ์ไม่ได้ — ถ้าอาการแย่ลงหรือไม่หายใน 2-3 วันควรปรึกษาแพทย์"),
    )
    val SYMPTOM_CHIPS = listOf("ปวดเมื่อยปกติ", "ตึงกล้ามเนื้อ", "ปวดข้อ", "เจ็บแปลบ", "มีเสียงดังในข้อ", "บวม", "ชา/เหน็บ")

    fun info(level: String?): SymptomInfo = SYMPTOM_INFO[level] ?: SYMPTOM_INFO.getValue("unknown")

    fun analyzeSymptom(text: String?): SymptomResult {
        val t = (text ?: "").lowercase()
        for ((level, words) in SYMPTOM_RULES) {
            val hit = words.filter { w ->
                var i = t.indexOf(w)
                var found = false
                while (i > -1) {
                    if (!t.substring(max(0, i - 4), i).contains("ไม่")) { found = true; break }
                    i = t.indexOf(w, i + 1)
                }
                found
            }
            if (hit.isNotEmpty()) return SymptomResult(level, hit)
        }
        return SymptomResult("unknown", emptyList())
    }

    /** อาการระดับบาดเจ็บ/อันตรายของวันนั้น (ไว้ขึ้น banner แดงบนหัวเซสชัน) */
    fun seriousSymptoms(log: DailyLog?): List<Symptom> =
        (log?.exercises?.values ?: emptyList()).mapNotNull { it.symptom }.filter { it.level == "injury" || it.level == "emergency" }

    /* ---------- วอร์มร่างกายก่อนฝึก / คลายกล้ามเนื้อหลังฝึก (คนละอย่างกับ warm-up set) ---------- */
    private val PATTERN_GROUP = mapOf(
        "hpush" to "chest", "incline" to "chest", "chestfly" to "chest", "vpush" to "shoulders", "latraise" to "shoulders", "reardelt" to "reardelt",
        "hpull" to "back", "vpull" to "back", "biceps" to "biceps", "triceps" to "triceps",
        "squat" to "legs", "lunge" to "legs", "hinge" to "legs", "glute" to "legs", "legcurl" to "legs", "calf" to "legs",
    )
    private val MUSCLE_LABEL = mapOf(
        "chest" to "อก", "shoulders" to "ไหล่", "reardelt" to "ไหล่หลัง", "back" to "หลัง", "biceps" to "ต้นแขนหน้า", "triceps" to "ต้นแขนหลัง", "legs" to "ขา",
    )
    val PREP_WARM = mapOf(
        "legs" to "แกว่งขาหน้า-หลัง/ซ้าย-ขวา 10 ครั้ง · สควอทน้ำหนักตัว 10 ครั้ง · ก้าวย่อ (lunge) เดิน 10 ก้าว",
        "chest" to "หมุนแขนวงกว้าง 10 รอบ · กางแขนไขว้หน้าอก 10 ครั้ง · วิดพื้นกับผนัง 10 ครั้ง",
        "shoulders" to "หมุนไหล่หน้า-หลัง 10 รอบ · ยกแขนขึ้นเหนือศีรษะช้า ๆ 10 ครั้ง",
        "back" to "หมุนไหล่ 10 รอบ · ท่าแมว-วัว (cat-cow) 8 ครั้ง · ดึงยางยืดแยกออก (band pull-apart) 12 ครั้ง",
        "biceps" to "งอ-เหยียดแขน และหมุนข้อมือ 10 ครั้ง",
        "triceps" to "เหยียดแขนเหนือศีรษะ-งอศอก 10 ครั้ง",
        "reardelt" to "กางแขนไปด้านหลังเบา ๆ 10 ครั้ง",
    )
    val PREP_COOL = mapOf(
        "legs" to "ยืดต้นขาหน้า · ยืดต้นขาหลัง · ยืดสะโพก (ไขว่ห้างก้มตัว) · ยืดน่อง",
        "chest" to "ยืดอกโดยดันแขนกับขอบประตู",
        "shoulders" to "ดึงแขนไขว้หน้าอก",
        "back" to "ท่าเด็ก (child's pose) · ห้อยแขนยืดหลังกับราว",
        "biceps" to "ยืดต้นแขนหน้ากับผนัง",
        "triceps" to "ยืดต้นแขนหลังเหนือศีรษะ",
        "reardelt" to "กอดตัวเองยืดหลังไหล่",
    )
    private val PREP_GROUP_ORDER = listOf("legs", "chest", "back", "shoulders", "reardelt", "biceps", "triceps")

    /** กลุ่มกล้ามเนื้อหลักของเซสชันที่กำลังใช้ (ตามลำดับท่าที่เจอก่อน) — ตรงกับ sessionGroups(se, false) ของเว็บ */
    fun sessionGroups(sess: PlanSession?): List<String> {
        val out = mutableListOf<String>()
        sess?.exercises?.map { it.pattern }?.distinct()?.forEach { p -> PATTERN_GROUP[p]?.let { g -> if (g !in out) out += g } }
        return out
    }

    private fun prepTips(sess: PlanSession?, table: Map<String, String>): List<String> {
        val gs = sessionGroups(sess)
        return PREP_GROUP_ORDER.filter { it in gs && table[it] != null }.map { "${MUSCLE_LABEL[it]}: ${table[it]}" }
    }
    fun warmTips(sess: PlanSession?) = prepTips(sess, PREP_WARM)
    fun coolTips(sess: PlanSession?) = prepTips(sess, PREP_COOL)

    /* ---------- ความเครียด/อารมณ์รายวัน — บันทึกเป็นข้อมูล ไม่นับความครบ ---------- */
    val STRESS_LEVELS = listOf(
        StressLevel(1, "ไม่เครียด", "😌"), StressLevel(2, "เล็กน้อย", "🙂"), StressLevel(3, "ปานกลาง", "😐"),
        StressLevel(4, "มาก", "😣"), StressLevel(5, "มากที่สุด", "😫"),
    )
    val STRESS_CHIPS = listOf("งาน", "การเรียน", "ครอบครัว", "การเงิน", "ความสัมพันธ์", "สุขภาพ", "นอนไม่พอ", "เดินทาง")

    fun stressLabel(level: Int): String = STRESS_LEVELS.getOrNull(level - 1)?.let { "${it.icon} $level/5 ${it.label}" } ?: ""

    /** คำแนะนำใต้ช่องความเครียด (ระดับ 4-5) */
    fun stressTip(level: Int?): String? = when {
        level == null || level < 4 -> null
        level == 5 -> "วันนี้เครียดมาก — ไม่ต้องฝืนฝึกหนักกว่าแผน พักหายใจลึก ๆ เดินเบา ๆ และนอนให้พอ ถ้าเครียดมากต่อเนื่องหรือรับมือไม่ไหว ควรคุยกับคนที่ไว้ใจหรือผู้เชี่ยวชาญ (สายด่วนสุขภาพจิต 1323)"
        else -> "เครียดมาก — ลองพักหายใจลึก ๆ เดินเบา ๆ 10-20 นาที และนอนให้ถึงเป้า ช่วยให้ร่างกายฟื้นตัวได้ดีขึ้น"
    }
}
