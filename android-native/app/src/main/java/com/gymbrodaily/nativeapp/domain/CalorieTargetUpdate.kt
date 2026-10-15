package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/** สูตรเป้าแคลอรี่รุ่นปัจจุบัน — แผนที่ไม่มี calcV หรือ calcV ต่ำกว่านี้ถูกล็อกเป้าด้วยสูตรเก่า (ตรงกับ CALC_VERSION ใน app.js) */
const val CALC_VERSION = 2

data class CalorieUpdate(val kcal: Int, val tdee: Int, val direction: String, val floored: Boolean, val eaLimited: Boolean)

/* ============================================================
   เสนอเป้าแคลอรี่ใหม่ให้แผนที่สร้างก่อนสูตรรุ่นปัจจุบัน — พอร์ตจาก calorieTargetUpdate / calorieTargetText ใน app.js
   ทุกเป้าหมายคิดจากฐาน TDEE + แคลฝึกตามแผน (รักษา/เพิ่มกล้ามที่เคยคิดจาก TDEE ล้วนจะได้เป้าสูงขึ้น, Recomp ที่ใช้หลักเก่าจะได้เป้าต่ำลง)
   แผนเป็นชุดที่ล็อกเป้าไว้ จึงเสนอให้ผู้ใช้กดใช้เอง ไม่เปลี่ยนเงียบ ๆ — เสนอเมื่อต่างจากเดิมตั้งแต่ 50 kcal ทั้งขึ้นและลง
   ข้ามแผนที่ Progression & Goal เคยปรับเป้าแล้ว (ข้อมูลจริงแม่นกว่าสูตร) และแผนที่ผู้ใช้เคยตอบรับ/ปฏิเสธแล้ว
   ถ้าเสนอลดเป้า ต้องผ่านด่าน EA (Calculations.applyEaGuard) ก่อน — ดันกลับได้ไม่เกินเป้าเดิม

   แผนที่สร้างใหม่ (ทั้งเว็บและ native) ถูกประทับ calcV ตอนกดเริ่มโปรแกรม เพราะเป้าคิดด้วยสูตรรุ่นปัจจุบันและแคลฝึกชุดเดียวกับตารางจริงแล้ว
   แผนที่ไม่มี calcV (สร้างก่อนสูตรรุ่นนี้) ถึงจะเข้าเงื่อนไข banner — ผู้ใช้เปลี่ยนตารางทีหลังก็ไม่มี banner เพราะ Progression & Goal ปรับเป้าตามผลจริงให้อยู่แล้ว
   ============================================================ */
object CalorieTargetUpdate {

    /** ธง "เห็นแล้ว": targetFormulaSeen + ชื่อเก่าสองตัวของเว็บ (calcTargetSeen / recompTargetSeen) — banner ที่เคยกดข้ามต้องไม่กลับมา */
    fun seen(p: Program) = p.targetFormulaSeen || p.calcTargetSeen || p.recompTargetSeen

    private fun usable(d: Double?) = d != null && d != 0.0 && !d.isNaN()

    fun of(t: TrackData, today: String): CalorieUpdate? {
        val p = t.program
        val targets = p.targets ?: return null
        if ((p.calcV ?: 0) >= CALC_VERSION || seen(p)) return null
        if (p.pg?.adjustments?.isNotEmpty() == true) return null
        val kg = listOf(Tracking.bodyweightAsOf(t, today), p.startWeight, t.answers.parseFloat("Q12")).firstOrNull { usable(it) } ?: return null
        if (!(kg > 0)) return null
        val sex = ProgressGoal.sex(t)
        val a = Answers(
            JsonObject(
                t.answers.json + mapOf(
                    "Q1" to (p.goal?.let { JsonPrimitive(it) } ?: JsonNull),
                    "Q9" to (sex?.let { JsonPrimitive(it) } ?: JsonNull),
                    "Q12" to JsonPrimitive(kg),
                ),
            ),
        )
        val tdee = Generator.computeTDEE(a)
        if (tdee == null || tdee.isNaN()) return null
        val exDay = ProgressGoal.plannedExPerDay(p, kg)
        val cal = Generator.computeCalorieTarget(tdee, a, exDay)
        val calKcal = cal.kcal ?: return null
        if (calKcal.isNaN()) return null
        var kcal = jsRound(calKcal).toInt()
        val old = targets.kcal
        var direction = cal.direction
        var floored = cal.floored
        var eaLimited = cal.eaLimited
        if (old != null && kcal < old) {
            val ffm = ProgressGoal.ffmFromAnswers(a, kg, sex)
            val g = ffm?.let { Calculations.applyEaGuard(kcal.toDouble(), p.goal, exDay.toDouble(), it.ffm, old.toDouble()) }
            if (g != null && ffm != null && g.blocked && g.kcal > kcal) {
                kcal = g.kcal.toInt(); floored = true; eaLimited = true
                direction += " · ไม่ลดต่ำกว่า ${ProgressGoal.fmtKcal(kcal)} kcal เพราะ energy availability จะต่ำกว่า ${g.minEA.toInt()} kcal/กก. มวลไร้ไขมัน (FFM ~${Tracking.fmt1(ffm.ffm)} กก. — ${ffm.src})"
            }
        }
        if (old != null && Math.abs(kcal - old) < 50) return null
        return CalorieUpdate(kcal, jsRound(tdee).toInt(), direction, floored, eaLimited)
    }

    /** ข้อความอธิบายเหตุผลตามทิศทาง — ตรงกับ calorieTargetText ของเว็บทุกตัวอักษร (golden progress.json) */
    fun text(p: Program, u: CalorieUpdate): String {
        val old = p.targets?.kcal
        val up = u.kcal > (old ?: 0)
        val why = if (up) {
            "ปรับสูตรคำนวณเป้าแคลอรี่ใหม่: เดิมเป้าไม่รวมแคลที่เผาจากการฝึก ทำให้กินน้อยกว่าที่ร่างกายใช้จริงโดยไม่ตั้งใจ (พลังงานในชีวิตประจำวันก็ใช้ค่าที่สมจริงขึ้น)"
        } else if (p.goal == "Recomposition (ลด+เพิ่มพร้อมกัน)") {
            "ปรับหลักเป้าแคลอรี่ของ Recomposition ใหม่ ให้กินขาดเล็กน้อยเสมอ (ส่วนวันฝึกจะขาดเพิ่มจากแคลที่เผาตอนออกกำลังกาย)"
        } else {
            "ปรับสูตรคำนวณเป้าแคลอรี่ใหม่ให้ตรงกับพลังงานที่ใช้จริงรวมการฝึกตามแผน"
        }
        return "$why — เป้าของคุณจะเปลี่ยนจาก ${ProgressGoal.fmtKcal(old)} เป็น ${ProgressGoal.fmtKcal(u.kcal)} kcal/วัน " +
            "(TDEE ไม่รวมการฝึก ${ProgressGoal.fmtKcal(p.targets?.tdee)} → ${ProgressGoal.fmtKcal(u.tdee)}) โปรตีนเท่าเดิม" +
            if (u.eaLimited) " · ตั้งไม่ต่ำกว่านี้เพื่อให้ energy availability ไม่ต่ำกว่าเกณฑ์ปลอดภัย (RED-S)" else ""
    }

    /**
     * ผู้ใช้กด "ใช้เป้าใหม่" — คืน payload ของแผนใหม่ (ตรงกับ calorieApply ของเว็บ): เปลี่ยนเฉพาะ targets (kcal/tdee/ข้อความ/ไขมัน/คาร์บ/eaLimited),
     * ประทับ calcV และเริ่มรอบประเมิน Progression & Goal ใหม่จากวันนี้ — โปรตีนคงเดิม (2 ก./กก.) และ field อื่นทุกตัวใน payload (รวมของที่เว็บเขียน) คงเดิม
     */
    fun applyTo(raw: JsonObject, t: TrackData, u: CalorieUpdate, today: String): JsonObject {
        val curTargets = raw["targets"] as? JsonObject ?: return raw
        val tg = Tracking.targetsOf(t)
        val macro = Generator.computeMacro(u.kcal.toDouble(), if (tg.proteinG != null && tg.proteinG != 0) tg.proteinG / 2.0 else Tracking.bodyweightAsOf(t, today))
        val nt = JsonObject(
            curTargets + mapOf(
                "kcal" to JsonPrimitive(u.kcal),
                "tdee" to JsonPrimitive(u.tdee),
                "kcalDirection" to JsonPrimitive(u.direction),
                "kcalFloored" to JsonPrimitive(u.floored),
                "eaLimited" to JsonPrimitive(u.eaLimited),
                "fatG" to (macro.fatG?.let { JsonPrimitive(it) } ?: JsonNull),
                "carbG" to (macro.carbG?.let { JsonPrimitive(it) } ?: JsonNull),
                "macroClamped" to JsonPrimitive(macro.clamped),
            ),
        )
        val pg = raw["pg"] as? JsonObject ?: JsonObject(emptyMap())
        return JsonObject(
            raw + mapOf(
                "targets" to nt,
                "calcV" to JsonPrimitive(CALC_VERSION),
                "pg" to JsonObject(pg + ("evalFrom" to JsonPrimitive(today))),
            ),
        )
    }

    /** ผู้ใช้กด "คงเป้าเดิม" — ประทับ targetFormulaSeen (ชื่อที่เว็บใช้ด้วย) กัน banner ขึ้นซ้ำ; field อื่นไม่แตะ */
    fun skipped(raw: JsonObject): JsonObject = JsonObject(raw + ("targetFormulaSeen" to JsonPrimitive(true)))
}
