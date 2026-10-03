package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.abs

/* ============================================================
   แบบสอบถาม onboarding 9 หมวด — คัดลอกจาก app.js (CATEGORIES, QUESTIONS, BENCH,
   BODYFAT_BANDS, BODYFAT_GOAL_MAP, visibleQsFor, catComplete, setAnswer, countAnswered)
   เงื่อนไขการแสดงคำถามต้องตรงกับเว็บทุกข้อ (ตรวจด้วย GoldenParityTest.questionsMatchJs)
   ============================================================ */

data class Category(val id: Int, val name: String, val short: String)

enum class QKind { SINGLE, MULTI, NUMBER, TEXT, BODYFAT }

data class Question(
    val id: String,
    val cat: Int,
    val kind: QKind,
    val main: Boolean,
    val label: String,
    val options: List<String> = emptyList(),
    val note: String? = null,
    val branchFrom: String? = null,
    val required: Boolean = false,
    val unit: String? = null,
    val exclusiveOption: String? = null,
    val visible: (Answers) -> Boolean = { true },
)

data class GoalBench(val days: IntRange, val mins: IntRange, val label: String)
data class BodyFatBand(val key: String, val pct: String)

object Questions {
    val CATEGORIES = listOf(
        Category(1, "เป้าหมาย + Time Feasibility", "เป้าหมาย"),
        Category(2, "ข้อมูลร่างกาย", "ร่างกาย"),
        Category(3, "ประสบการณ์ออกกำลังกาย", "ประสบการณ์"),
        Category(4, "สภาพแวดล้อมการฝึก", "สภาพแวดล้อม"),
        Category(5, "ช่วงเวลาที่สะดวก", "ช่วงเวลา"),
        Category(6, "สุขภาพและข้อจำกัด", "สุขภาพ"),
        Category(7, "โภชนาการและอาหาร", "โภชนาการ"),
        Category(8, "ไลฟ์สไตล์และการพักฟื้น", "ไลฟ์สไตล์"),
        Category(9, "Preference การใช้แอป", "Preference"),
    )

    /** ลำดับ key ตรงกับ Object.keys(BENCH) ใน JS (ใช้เป็นตัวเลือกของ Q1 ด้วย) */
    val BENCH: Map<String, GoalBench> = linkedMapOf(
        "ลดไขมัน" to GoalBench(4..5, 45..60, "4-5 วัน/สัปดาห์ ครั้งละ 45-60 นาที"),
        "เพิ่มกล้ามเนื้อ" to GoalBench(4..6, 45..75, "4-6 วัน/สัปดาห์ ครั้งละ 45-75 นาที"),
        "Recomposition (ลด+เพิ่มพร้อมกัน)" to GoalBench(4..5, 45..60, "4-5 วัน/สัปดาห์ ครั้งละ 45-60 นาที"),
        "รักษาสุขภาพทั่วไป" to GoalBench(3..3, 30..45, "3 วัน/สัปดาห์ ครั้งละ 30-45 นาที"),
        "เพิ่มความแข็งแรง-Performance" to GoalBench(3..5, 60..90, "3-5 วัน/สัปดาห์ ครั้งละ 60-90 นาที"),
        "เดิน-วิ่ง (Cardio)" to GoalBench(3..5, 20..45, "3-5 วัน/สัปดาห์ ครั้งละ 20-45 นาที"),
    )
    val Q3_MIN = mapOf("น้อยกว่า 20 นาที" to 15, "20-45 นาที" to 32, "45-60 นาที" to 52, "มากกว่า 60 นาที" to 70)

    /** ต้องตรงกับ FRAMES ใน mobile/scripts/bodyfat-renders/render_spin.py */
    const val BODYFAT_SPIN_FRAMES = 24
    val BODYFAT_BANDS = listOf(
        BodyFatBand("05-09", "5-9%"), BodyFatBand("10-14", "10-14%"), BodyFatBand("15-19", "15-19%"),
        BodyFatBand("20-24", "20-24%"), BodyFatBand("25-29", "25-29%"), BodyFatBand("30-35", "30-35%"),
    )
    /** แนะนำเป้าหมายจากรูปร่างที่เลือก — เป็นแค่คำแนะนำ ไม่บังคับ */
    val BODYFAT_GOAL_MAP = mapOf(
        "05-09" to "เพิ่มกล้ามเนื้อ", "10-14" to "เพิ่มกล้ามเนื้อ",
        "15-19" to "Recomposition (ลด+เพิ่มพร้อมกัน)", "20-24" to "Recomposition (ลด+เพิ่มพร้อมกัน)",
        "25-29" to "ลดไขมัน", "30-35" to "ลดไขมัน",
    )

    private fun regular(a: Answers) = a.str("Q16") == "ออกกำลังกายประจำ" || a.str("Q16") == "นักกีฬา-เทรนมานาน"

    val QUESTIONS: List<Question> = listOf(
        Question("Q9", 1, QKind.SINGLE, true, "เพศ", listOf("ชาย", "หญิง")),
        Question("Q0", 1, QKind.BODYFAT, true, "เลือกรูปร่างที่ใกล้เคียงกับคุณตอนนี้",
            visible = { it.str("Q9") == "ชาย" || it.str("Q9") == "หญิง" }),
        Question("Q2", 1, QKind.MULTI, true, "วันไหนบ้างที่คุณว่างสำหรับออกกำลังกาย?", Catalog.DAYS,
            note = "multi-select — เลือกได้หลายวัน"),
        Question("Q3", 1, QKind.SINGLE, true, "โดยเฉลี่ยแต่ละครั้งคุณมีเวลาเท่าไหร่?",
            listOf("น้อยกว่า 20 นาที", "20-45 นาที", "45-60 นาที", "มากกว่า 60 นาที")),
        Question("Q1", 1, QKind.SINGLE, true, "เป้าหมายหลักของคุณตอนนี้คืออะไร?", BENCH.keys.toList()),
        Question("Q4a", 1, QKind.SINGLE, false, "ต้องการลดแบบเข้มข้น (deficit สูง) หรือค่อยเป็นค่อยไป?",
            listOf("เข้มข้น", "ค่อยเป็นค่อยไป", "ไม่แน่ใจให้ระบบแนะนำ"), branchFrom = "Q1 = ลดไขมัน",
            visible = { it.str("Q1") == "ลดไขมัน" }),
        Question("Q4b", 1, QKind.SINGLE, false, "มีเป้าหมายน้ำหนัก/เปอร์เซ็นต์ไขมันที่อยากถึงไหม?",
            listOf("ระบุตัวเลข", "ยังไม่มีเป้าหมายชัดเจน"), branchFrom = "Q1 = ลดไขมัน",
            visible = { it.str("Q1") == "ลดไขมัน" }),
        Question("Q4c", 1, QKind.SINGLE, false, "เคยลดน้ำหนักแล้วกลับมาอ้วนซ้ำ (yo-yo) บ่อยไหม?",
            listOf("บ่อย", "เคยครั้งสองครั้ง", "ไม่เคย"), branchFrom = "Q1 = ลดไขมัน",
            visible = { it.str("Q1") == "ลดไขมัน" }),
        Question("Q5a", 1, QKind.MULTI, false, "เน้นส่วนไหนเป็นพิเศษไหม?",
            listOf("อก", "หลัง", "ขา", "ไหล่", "แขน", "ไม่เน้นส่วนไหนเป็นพิเศษ"), note = "multi-select — เลือกได้หลายส่วน",
            branchFrom = "Q1 = เพิ่มกล้ามเนื้อ", exclusiveOption = "ไม่เน้นส่วนไหนเป็นพิเศษ",
            visible = { it.str("Q1") == "เพิ่มกล้ามเนื้อ" }),
        Question("Q5b", 1, QKind.SINGLE, false, "ยอมรับไขมันขึ้นเล็กน้อยระหว่างสร้างกล้ามได้ไหม?",
            listOf("ได้ (เน้นสร้างกล้ามให้เร็ว)", "ไม่ได้ (อยากคุมไขมันไปด้วย)"), branchFrom = "Q1 = เพิ่มกล้ามเนื้อ",
            visible = { it.str("Q1") == "เพิ่มกล้ามเนื้อ" }),
        Question("Q6", 1, QKind.SINGLE, false, "น้ำหนักและรูปร่างตอนนี้ใกล้เคียงเป้าหมายแค่ไหน?",
            listOf("ห่างมาก", "ห่างปานกลาง", "ใกล้เป้าหมายแล้ว"), branchFrom = "Q1 = Recomposition",
            visible = { it.str("Q1") == "Recomposition (ลด+เพิ่มพร้อมกัน)" }),
        Question("Q7", 1, QKind.SINGLE, false, "เน้นแบบไหน?",
            listOf("แรงสูงสุด (max strength)", "กำลังระเบิด (power)", "ความทนทานกล้ามเนื้อ (endurance)"),
            branchFrom = "Q1 = เพิ่มความแข็งแรง/Performance",
            visible = { it.str("Q1") == "เพิ่มความแข็งแรง-Performance" }),

        Question("Q10", 2, QKind.NUMBER, true, "อายุ", required = true, unit = "ปี"),
        Question("Q11", 2, QKind.NUMBER, true, "ส่วนสูง", required = true, unit = "cm"),
        Question("Q12", 2, QKind.NUMBER, true, "น้ำหนักปัจจุบัน", required = true, unit = "kg"),
        Question("Q13", 2, QKind.SINGLE, true, "น้ำหนักเป้าหมาย (ถ้ามี)", listOf("ระบุ", "ยังไม่มีเป้าหมายตัวเลข")),
        Question("Q14", 2, QKind.SINGLE, true, "ทราบเปอร์เซ็นต์ไขมันตัวเองไหม?",
            listOf("ทราบ (กรอกตัวเลข)", "ไม่ทราบแต่มีรอบเอว-รอบคอ-รอบสะโพกให้คำนวณ", "ไม่ทราบและไม่กรอกตอนนี้")),
        Question("Q15", 2, QKind.SINGLE, false, "เคยปรึกษาแพทย์เกี่ยวกับการเปลี่ยนแปลงน้ำหนักนี้หรือยัง?",
            listOf("ปรึกษาแล้ว", "ยังไม่ได้ปรึกษา", "ไม่จำเป็นในกรณีของฉัน"),
            branchFrom = "น้ำหนักปัจจุบัน vs เป้าหมาย ต่างกัน >15%",
            visible = { a ->
                val cur = a.parseFloat("Q12")
                val tgt = a.parseFloat("Q13_val")
                // !cur || !tgt ของ JS: NaN และ 0 นับเป็นเท็จ
                if (a.str("Q13") != "ระบุ" || cur.isNaN() || cur == 0.0 || tgt.isNaN() || tgt == 0.0) false
                else abs(cur - tgt) / cur > 0.15
            }),

        Question("Q16", 3, QKind.SINGLE, true, "ระดับประสบการณ์ปัจจุบัน?",
            listOf("มือใหม่", "เคยออกบ้าง", "ออกกำลังกายประจำ", "นักกีฬา-เทรนมานาน")),
        Question("Q17", 3, QKind.SINGLE, false, "โปรแกรมปัจจุบันเป็นรูปแบบไหน?",
            listOf("Push-Pull-Legs", "Full body", "Bro split", "อื่นๆ", "ไม่มีโปรแกรมชัดเจน"),
            branchFrom = "Q16 = ออกกำลังกายประจำ/นักกีฬา", visible = ::regular),
        Question("Q18", 3, QKind.SINGLE, false, "รู้ค่า 1RM โดยประมาณของ squat/bench/deadlift ไหม?",
            listOf("รู้ (กรอกตัวเลข)", "ไม่รู้"), branchFrom = "Q16 = ออกกำลังกายประจำ/นักกีฬา", visible = ::regular),
        Question("Q19", 3, QKind.NUMBER, false, "ต้องการออกกำลังกายกี่วัน/สัปดาห์? (รวมทั้ง weight และ cardio)",
            branchFrom = "Q16 = ออกกำลังกายประจำ/นักกีฬา", unit = "วัน/สัปดาห์", visible = ::regular),

        Question("Q20", 4, QKind.SINGLE, true, "ปกติออกกำลังกายที่ไหน?",
            listOf("ที่บ้าน", "ฟิตเนส-ยิม", "กลางแจ้ง-สวนสาธารณะ", "ผสมผสาน")),
        Question("Q21", 4, QKind.MULTI, false, "มีอุปกรณ์อะไรบ้าง?",
            listOf("ดัมเบล", "บาร์เบล", "ยางยืด", "ม้านั่ง", "บาร์โหน", "สเต็ปเปอร์", "ลูกบอลโยคะ",
                "ลูกกลิ้งบริหารหน้าท้อง", "เชือกกระโดด", "ฮูลาฮูป", "เสื่อโยคะ", "ไม่มีอุปกรณ์เลย"),
            note = "multi-select", branchFrom = "Q20 = ที่บ้าน / ผสมผสาน", exclusiveOption = "ไม่มีอุปกรณ์เลย",
            visible = { it.str("Q20") == "ที่บ้าน" || it.str("Q20") == "ผสมผสาน" }),
        Question("Q22", 4, QKind.SINGLE, false, "ยิมที่ใช้มีอุปกรณ์ครบไหม?", listOf("ครบมาก", "ปานกลาง", "จำกัด"),
            branchFrom = "Q20 = ฟิตเนส-ยิม / ผสมผสาน",
            visible = { it.str("Q20") == "ฟิตเนส-ยิม" || it.str("Q20") == "ผสมผสาน" }),

        Question("Q24", 5, QKind.SINGLE, true, "ช่วงเวลาไหนที่สะดวกออกกำลังกายที่สุด?",
            listOf("เช้า", "บ่าย", "เย็น-ค่ำ", "ไม่แน่นอนแล้วแต่วัน")),

        Question("Q25", 6, QKind.SINGLE, true,
            "มีอาการบาดเจ็บ, โรคประจำตัว, หรือข้อจำกัดทางร่างกายที่ส่งผลต่อการออกกำลังกายหรือไม่?", listOf("มี", "ไม่มี")),
        Question("Q26", 6, QKind.MULTI, false, "ตำแหน่ง/ลักษณะอาการ?",
            listOf("หลัง", "เข่า", "ไหล่", "ข้อมือ", "หัวใจ-หลอดเลือด", "อื่นๆ ระบุ"), note = "multi-select",
            branchFrom = "Q25 = มี", visible = { it.str("Q25") == "มี" }),
        Question("Q27", 6, QKind.TEXT, false, "มีท่าหรือการเคลื่อนไหวที่ต้องหลีกเลี่ยงไหม?",
            branchFrom = "Q25 = มี", visible = { it.str("Q25") == "มี" }),
        Question("Q28", 6, QKind.SINGLE, false, "ได้รับอนุญาตจากแพทย์ให้ออกกำลังกายแล้วหรือยัง?",
            listOf("ได้รับอนุญาตแล้ว", "ยังไม่ได้ปรึกษา", "ปรึกษาแล้วแต่แพทย์ไม่อนุญาต"),
            branchFrom = "Q25 = มี", visible = { it.str("Q25") == "มี" }),

        Question("Q29", 7, QKind.SINGLE, true, "รูปแบบการกิน?", listOf("ทั่วไป", "มังสวิรัติ", "วีแกน", "ฮาลาล")),
        Question("Q30", 7, QKind.TEXT, true, "อาหารที่แพ้หรือกินไม่ได้?"),
        Question("Q31", 7, QKind.SINGLE, true, "จำนวนมื้อที่สะดวกทำต่อวัน?", listOf("2 มื้อ", "3 มื้อ", "4-5 มื้อ", "ไม่แน่นอน")),
        Question("Q32", 7, QKind.SINGLE, true, "งบประมาณค่าอาหารโดยประมาณ?", listOf("ประหยัด", "ปานกลาง", "ไม่จำกัด")),
        Question("Q34", 7, QKind.SINGLE, false, "แหล่งโปรตีนทดแทนที่กินได้/สะดวกซื้อ?", listOf("ถั่ว", "เต้าหู้", "เวย์จากพืช", "อื่นๆ"),
            branchFrom = "Q29 = มังสวิรัติ/วีแกน", visible = { it.str("Q29") == "มังสวิรัติ" || it.str("Q29") == "วีแกน" }),
        Question("Q35", 7, QKind.SINGLE, true, "ชอบทำอาหารเองหรือสั่งสำเร็จรูปเป็นหลัก?", listOf("ทำเอง", "สั่งสำเร็จรูป", "ผสมกัน")),
        Question("Q43", 7, QKind.SINGLE, true, "ปริมาณน้ำที่ดื่มต่อวันโดยประมาณ?",
            listOf("น้อยกว่า 1 ลิตร", "1-2 ลิตร", "2-3 ลิตร", "มากกว่า 3 ลิตร")),
        Question("Q44", 7, QKind.SINGLE, true, "กินอาหารเสริมประเภทเวย์โปรตีน (whey protein) อยู่แล้วหรือไม่?",
            listOf("กินอยู่แล้วเป็นประจำ", "กินบ้างบางครั้ง", "ไม่ได้กิน", "ไม่แน่ใจว่าคืออะไร")),

        Question("Q36", 8, QKind.SINGLE, true, "ลักษณะงาน/กิจกรรมนอกเวลาออกกำลังกาย?", listOf("นั่งโต๊ะเป็นหลัก", "ยืน-เดินเยอะ", "ใช้แรงงาน")),
        Question("Q37", 8, QKind.NUMBER, true, "ชั่วโมงนอนเฉลี่ยต่อคืน?", required = true, unit = "ชม./คืน"),
        Question("Q39", 8, QKind.SINGLE, false, "ต้องการคำแนะนำ sleep hygiene เบื้องต้นในแอปด้วยไหม?",
            listOf("ต้องการ", "ไม่ต้องการตอนนี้"), branchFrom = "Q37 < 6 ชม.",
            visible = { a -> val h = a.parseFloat("Q37"); !h.isNaN() && h != 0.0 && h < 6 }),

        Question("Q40", 9, QKind.SINGLE, true, "สไตล์การแจ้งเตือน/coaching ที่ชอบ?",
            listOf("เข้มงวด-กดดัน", "กันเอง-ให้กำลังใจ", "ข้อมูลล้วนไม่ต้องมีอารมณ์")),
        Question("Q41", 9, QKind.SINGLE, true, "อยากมี community/challenge ร่วมกับคนอื่นไหม?", listOf("อยาก", "ไม่อยาก", "ยังไม่แน่ใจ")),
        Question("Q42", 9, QKind.SINGLE, true, "วิธีติดตามผลที่อยากใช้?", listOf("ตัวเลขน้ำหนัก", "ความแข็งแรงที่ยกได้", "ทั้งสองอย่าง")),
    )

    fun visibleQsFor(catId: Int, a: Answers) = QUESTIONS.filter { it.cat == catId && it.visible(a) }

    /** ตอบครบพอจะกด "ถัดไป" ได้หรือยัง — single/multi ต้องเลือก, number ที่ required ต้องเป็นตัวเลข */
    fun catComplete(catId: Int, a: Answers): Boolean = visibleQsFor(catId, a).all { q ->
        when (q.kind) {
            QKind.SINGLE -> a.truthy(q.id)
            QKind.MULTI -> (a.raw(q.id) as? JsonArray)?.isNotEmpty() == true
            QKind.NUMBER -> !q.required || Generator.numberAnswered(a, q.id)
            else -> true
        }
    }

    fun countAnswered(a: Answers): Int = QUESTIONS.count { q ->
        if (!q.visible(a)) return@count false
        val v = a.raw(q.id)
        if (q.kind == QKind.MULTI) (v as? JsonArray)?.isNotEmpty() == true
        else v != null && v !is JsonNull && !(v is JsonPrimitive && v.isString && v.content.isEmpty())
    }

    fun countVisibleTotal(a: Answers) = QUESTIONS.count { it.visible(a) }

    /**
     * กดตัวเลือก (ตรงกับ setAnswer ของเว็บ): single กดซ้ำ = ยกเลิก, multi สลับเข้า/ออก
     * โดยตัวเลือก exclusive (เช่น "ไม่มีอุปกรณ์เลย") เลือกพร้อมตัวอื่นไม่ได้
     */
    fun setAnswer(a: Answers, id: String, value: String): Answers {
        val q = QUESTIONS.firstOrNull { it.id == id }
        if (q?.kind == QKind.MULTI) {
            val arr = a.list(id).toMutableList()
            val wasSelected = value in arr
            if (wasSelected) arr.remove(value) else arr.add(value)
            val ex = q.exclusiveOption
            var next: List<String> = arr
            if (ex != null && !wasSelected) next = if (value == ex) listOf(ex) else arr.filter { it != ex }
            return a.with(id, JsonArray(next.map { JsonPrimitive(it) }))
        }
        return a.with(id, if (a.str(id) == value) null else JsonPrimitive(value))
    }
}

/** คืน Answers ใหม่ที่แก้คีย์เดียว — null = ลบคีย์ (เหมือนค่า undefined ที่ JSON.stringify ทิ้ง) */
fun Answers.with(id: String, value: JsonElement?): Answers =
    Answers(JsonObject(if (value == null) json - id else json + (id to value)))
