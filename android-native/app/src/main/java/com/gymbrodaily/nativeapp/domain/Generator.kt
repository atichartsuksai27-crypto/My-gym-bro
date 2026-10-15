package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.Serializable
import kotlin.math.max
import kotlin.math.min

/* ============================================================
   Program Generator + เป้าหมายรายวัน — พอร์ตจาก app.js
   (sanityIssues, computeTargets, safetyGate, selectionFor, splitFeasibility,
    effectiveSplit, assignSessions, buildPlanSnapshot ฯลฯ)
   ผลต้องตรงกับ JS ทุกกรณี (ตรวจด้วย GeneratorGoldenTest)
   ============================================================ */

/* ค่า default มีไว้อ่านโปรแกรมรุ่นเก่าที่เว็บบันทึกไว้ก่อนมีบาง field เท่านั้น — generator ใส่ครบทุกตัวเสมอ */
@Serializable
data class Targets(
    val tdee: Int? = null,
    val kcal: Int? = null,
    val kcalDirection: String = "",
    val kcalFloored: Boolean = false,
    /** พื้น energy availability เป็นตัวดันเป้าขึ้นตอนสร้างแผน (ข้อความอธิบายอยู่ใน kcalDirection) */
    val eaLimited: Boolean = false,
    val incomplete: Boolean = false,
    val proteinG: Int? = null,
    val fatG: Int? = null,
    val carbG: Int? = null,
    val macroClamped: Boolean = false,
    val waterL: Double? = null,
    val meals: Int = 3,
    val sleepH: Double? = null,
    val sleepHygiene: Boolean = false,
    val goalWeight: Double? = null,
)

@Serializable
data class PlanExercise(
    val pattern: String,
    val id: String,
    val th: String,
    val sub: String = "",
    val tier: Int = 1,
    val equip: String = "",
    val setsReps: String = "",
    val timeBased: Boolean = false,
    /** slot ในแบบ (เช่น "squat@2" = ตัวเลือกที่สองของรูปแบบเดียวกัน) — pattern คือรูปแบบฐาน */
    val slot: String? = null,
    /** "intense" = แบบเข้มข้น (2 x 4-8 จนหมดแรง) — เลือกตอนสร้างแผนบนเว็บ */
    val intensity: String? = null,
)

@Serializable
data class PlanSession(val key: String, val exercises: List<PlanExercise>)

/** shape เดียวกับ track.program ของเว็บ (programs.payload) ยกเว้น startDate/planId ที่เติมตอนกดเริ่มโปรแกรม */
@Serializable
data class PlanSnapshot(
    val splitKey: String,
    val splitLabel: String,
    val goal: String?,
    val days: List<String>,
    val dayToSession: Map<String, String>,
    val sessions: List<PlanSession>,
    val minutesEstimate: String,
    val trainTime: String,
    val targets: Targets,
    val startWeight: Double?,
    val availableDays: List<String> = emptyList(),
    val cardioDays: List<String> = emptyList(),
    val cardioMinByDay: Map<String, Double> = emptyMap(),
    val exp: String? = null,
    val sex: String? = null,
)

data class CalorieTarget(val kcal: Double?, val floored: Boolean, val floor: Double?, val direction: String, val eaLimited: Boolean = false)
data class Macro(val proteinG: Int?, val fatG: Int?, val carbG: Int?, val clamped: Boolean)
data class SafetyGate(val blocked: Boolean, val reason: String? = null)
data class SplitFeasibility(val eligible: Boolean, val recommended: Boolean, val minDays: Int)
data class DaySession(val day: String, val session: String)

data class Candidate(
    val exercise: Exercise,
    val equipOk: Boolean,
    val locked: Boolean,
    val lockedBy: List<String>,
) {
    val id get() = exercise.id
    val tier get() = exercise.tier
    val equip get() = exercise.equip
    val timed get() = exercise.timed
}

data class Selection(val picked: Candidate?, val all: List<Candidate>)

object Generator {

    fun bmiOf(w: Double, h: Double) = w / ((h / 100) * (h / 100))

    fun bmiLabel(b: Double) = when {
        b < 18.5 -> "ต่ำกว่าเกณฑ์"
        b < 23 -> "ปกติ"
        b < 25 -> "ท้วม"
        b < 30 -> "อ้วนระดับ 1"
        else -> "อ้วนระดับ 2"
    }

    fun inScope(a: Answers) = a.str("Q1") in Catalog.SUPPORTED_GOALS && a.str("Q20") in Catalog.SUPPORTED_LOCATIONS

    /** ตอบเป็นตัวเลขจริงแล้วหรือยัง (ไม่ตรวจช่วงค่า) — แยก "ไม่ตอบ" ออกจาก "ตอบเป็น 0" */
    fun numberAnswered(a: Answers, id: String): Boolean {
        val v = a.raw(id) ?: return false
        if (v is kotlinx.serialization.json.JsonNull) return false
        if (a.str(id) == "") return false
        return !jsParseFloat(v).isNaN()
    }

    fun sanityIssues(a: Answers): List<String> {
        val issues = mutableListOf<String>()
        fun checkNum(label: String, id: String, lo: Int, hi: Int) {
            if (!numberAnswered(a, id)) { issues += label + "ยังไม่ได้กรอก"; return }
            val n = a.parseFloat(id)
            if (n < lo || n > hi) issues += "${label}อยู่นอกช่วงที่เป็นไปได้จริง ($lo-$hi)"
        }
        checkNum("อายุ ", "Q10", 10, 100)
        checkNum("ส่วนสูง ", "Q11", 100, 250)
        checkNum("น้ำหนักปัจจุบัน ", "Q12", 20, 300)
        if (a.str("Q13") == "ระบุ") checkNum("น้ำหนักเป้าหมาย ", "Q13_val", 20, 300)
        checkNum("ชั่วโมงนอนเฉลี่ย ", "Q37", 1, 16)
        return issues
    }

    /** adapter แปลงคำตอบไปเป็น input ของสูตรใน Calculations — ห้ามเขียนสูตรซ้ำที่นี่ */
    fun computeTDEE(a: Answers): Double? {
        val bmr = Calculations.calculateBMRForProfile(a.number("Q12"), a.number("Q11"), a.number("Q10"), a.str("Q9"), ProgressGoal.typedBodyFatPct(a))
        val factor = Calculations.activityFactorFromQ36(a.str("Q36"))
        return Calculations.calculateTDEE(bmr, factor)
    }

    /** เป้าแคลอรี่ตามเป้าหมาย + เพดานสัมบูรณ์ แล้วบังคับพื้นขั้นต่ำตามเพศเป็นด่านสุดท้าย */
    /** exKcal = แคลฝึกตามแผนต่อวัน — TDEE ไม่รวมการฝึก ทุกเป้าหมาย (รวมลดไขมัน) จึงคิดจาก base = TDEE + exKcal
     *  พื้น = max(ตามเพศ, energy availability 30 ลดไขมัน / 35 เป้าอื่น kcal/กก. FFM + แคลฝึก แต่ไม่เกิน base) — ตรงกับเว็บ */
    fun computeCalorieTarget(tdee: Double?, a: Answers, exKcal: Int = 0): CalorieTarget {
        val sex = a.str("Q9")
        val floor = if (sex == "ชาย") 1500.0 else if (sex == "หญิง") 1200.0 else null
        if (tdee == null || tdee.isNaN()) {
            return CalorieTarget(null, false, floor, "ข้อมูลไม่ครบ — กรอกเพศ/อายุ/ส่วนสูง/น้ำหนัก/กิจกรรมให้ครบก่อน")
        }
        val target: Double
        val direction: String
        val ex = if (exKcal > 0) exKcal else 0
        val base = tdee + ex
        val exNote = if (ex != 0) " · ฐาน = TDEE + แคลฝึก ~$ex kcal" else ""
        when (a.str("Q1")) {
            "ลดไขมัน" -> when (a.str("Q4a")) {
                "เข้มข้น" -> { target = max(base * 0.75, base - 1000); direction = "ลดไขมัน (เข้มข้น — หัก 25% แต่ไม่เกิน 1,000 kcal$exNote)" }
                "ค่อยเป็นค่อยไป" -> { target = max(base * 0.85, base - 500); direction = "ลดไขมัน (ค่อยเป็นค่อยไป — หัก 15% แต่ไม่เกิน 500 kcal$exNote)" }
                else -> { target = base * 0.80; direction = "ลดไขมัน (deficit 20%$exNote)" }
            }
            "เพิ่มกล้ามเนื้อ" -> when (a.str("Q5b")) {
                "ได้ (เน้นสร้างกล้ามให้เร็ว)" -> { target = min(base * 1.15, base + 500); direction = "เพิ่มกล้ามเนื้อ (รับไขมันได้ — เพิ่ม 15% แต่ไม่เกิน +500 kcal$exNote)" }
                "ไม่ได้ (อยากคุมไขมันไปด้วย)" -> { target = min(base * 1.08, base + 300); direction = "เพิ่มกล้ามเนื้อ (คุมไขมัน — เพิ่ม 8% แต่ไม่เกิน +300 kcal$exNote)" }
                else -> { target = base * 1.10; direction = "เพิ่มกล้ามเนื้อ (surplus 10%$exNote)" }
            }
            // Recomp: เปอร์เซ็นต์ที่หักคิดจากพลังงานที่ใช้รวมการฝึก (base) ไม่งั้นวันฝึกขาดซ้ำสองชั้น — ตรงกับเว็บ
            "Recomposition (ลด+เพิ่มพร้อมกัน)" -> when (a.str("Q6")) {
                "ห่างมาก" -> { target = max(base * 0.92, base - 300); direction = "Recomposition (ห่างเป้ามาก — หัก 8% แต่ไม่เกิน 300 kcal$exNote)" }
                "ใกล้เป้าหมายแล้ว" -> { target = base * 1.0; direction = "Recomposition (ใกล้เป้าแล้ว — เท่าพลังงานที่ใช้รวมการฝึก$exNote)" }
                else -> { target = max(base * 0.95, base - 200); direction = "Recomposition (ห่างปานกลาง — หัก 5% แต่ไม่เกิน 200 kcal$exNote)" }
            }
            else -> {
                target = base
                direction = if (ex != 0) "รักษาน้ำหนัก (maintenance — TDEE + แคลจากการฝึกตามแผน ~$ex kcal)" else "รักษาน้ำหนัก (maintenance)"
            }
        }
        // ชั้นที่ 1: พื้นตามเพศ  ชั้นที่ 2: ด่าน energy availability กลาง (Calculations.applyEaGuard — ดันขึ้นอย่างเดียว ไม่เกิน base) — ตรงกับเว็บ
        var floorV = floor
        val kg = a.parseFloat("Q12")
        val ffm = if (kg > 0) ProgressGoal.ffmFromAnswers(a, kg, sex) else null
        val afterSex = if (floorV != null && target < floorV) floorV else target
        val guard = ffm?.let { Calculations.applyEaGuard(afterSex, a.str("Q1"), ex.toDouble(), it.ffm, base) }
        val kcal = guard?.kcal ?: afterSex
        val eaLimited = guard != null && guard.kcal > afterSex
        if (guard != null) {
            val eaFloor = min(guard.minKcal, base)
            if (floorV == null || eaFloor > floorV) floorV = eaFloor
        }
        var eaNote = ""
        if (eaLimited && guard != null && ffm != null) {
            val gap0 = jsRound(base - afterSex); val gap1 = jsRound(base - kcal)
            eaNote = " · ปรับขึ้นให้ energy availability ไม่ต่ำกว่า ${guard.minEA.toInt()} kcal/กก. มวลไร้ไขมัน: ถ้ากินตามที่เลือก (${ProgressGoal.fmtKcal(jsRound(afterSex))} kcal) " +
                "และฝึกตามแผน (~$ex kcal/วัน) EA จะเหลือ ~${Tracking.fmt1(guard.ea)} (FFM ~${Tracking.fmt1(ffm.ffm)} กก. — ${ffm.src}) จึงตั้งเป้าที่ ${ProgressGoal.fmtKcal(jsRound(kcal))}" +
                " kcal (EA ~${Tracking.fmt1(Calculations.calculateEnergyAvailability(kcal, ex.toDouble(), ffm.ffm)!!)}) — ส่วนที่ขาดจริงจึงเหลือ ~${ProgressGoal.fmtKcal(max(0.0, gap1))} kcal/วัน เล็กกว่าที่เลือกไว้ (~${ProgressGoal.fmtKcal(max(0.0, gap0))})"
        }
        return CalorieTarget(kcal, kcal > target, floorV, direction + eaNote, eaLimited)
    }

    fun computeMacro(kcal: Double?, weightKg: Double?): Macro {
        val proteinG = if (weightKg != null && weightKg > 0) jsRound(2.0 * weightKg).toInt() else null
        if (kcal == null || kcal.isNaN()) return Macro(proteinG, null, null, false)
        val proteinKcal = (proteinG ?: 0) * 4.0
        val fatKcal = kcal * 0.28
        val fatG = jsRound(fatKcal / 9).toInt()
        var carbKcal = kcal - proteinKcal - fatKcal
        var clamped = false
        if (carbKcal < 200) { carbKcal = 200.0; clamped = true }
        return Macro(proteinG, fatG, jsRound(carbKcal / 4).toInt(), clamped)
    }

    /**
     * แคลฝึกตามแผนต่อวัน ณ ตอนสร้างแผน (ยังไม่มี program จริง) — ใช้ตารางวัน/นาที/cardio ชุดเดียวกับ [buildPlanSnapshot]
     * (วันฝึกจาก [planTrainDays] + cardio จาก [planCardioDays]) ตรงกับ plannedExFromAnswers ของเว็บ และตรงกับ [ProgressGoal.plannedExPerDay] ของแผนที่สร้างตามมา
     */
    fun plannedExFromAnswers(a: Answers, kg: Double, plan: PlanOverrides = PlanOverrides()): Int {
        val days = planTrainDays(a, plan).size
        val cd = planCardioDays(a, plan)
        val mins = minsForDays(plan.cardioMinByDay, cd)
        val cardioWeek = cd.sumOf { mins.getValue(it) }
        val sessMin = (Questions.Q3_MIN[a.strOr("Q3", "45-60 นาที")] ?: 52).toDouble()
        return jsRound(ProgressGoal.exerciseKcal(kg, days, sessMin, cardioWeek) / 7).toInt()
    }

    fun computeTargets(a: Answers, plan: PlanOverrides = PlanOverrides()): Targets {
        val w = a.parseFloat("Q12")
        val hasWeight = w > 0
        val tdee = computeTDEE(a)
        val cal = computeCalorieTarget(tdee, a, if (hasWeight) plannedExFromAnswers(a, w, plan) else 0)
        val macro = computeMacro(cal.kcal, if (hasWeight) w else null)
        var water = if (hasWeight) min(4.0, max(1.5, jsRound(w * 0.035 * 10) / 10)) else null
        val already = a.str("Q43")?.let { Catalog.WATER_NOW[it] }
        if (water != null && already != null && already > water) water = min(4.0, already)
        val sleepH = if (numberAnswered(a, "Q37")) min(9.0, max(7.0, a.parseFloat("Q37"))) else null
        return Targets(
            tdee = tdee?.let { jsRound(it).toInt() },
            kcal = cal.kcal?.let { jsRound(it).toInt() },
            kcalDirection = cal.direction,
            kcalFloored = cal.floored,
            eaLimited = cal.eaLimited,
            incomplete = tdee == null,
            proteinG = macro.proteinG,
            fatG = macro.fatG,
            carbG = macro.carbG,
            macroClamped = macro.clamped,
            waterL = water,
            meals = a.str("Q31")?.let { Catalog.MEALS_MAP[it] } ?: 3,
            sleepH = sleepH?.finiteOrNull(),
            sleepHygiene = a.str("Q39") == "ต้องการ",
            goalWeight = if (a.str("Q13") == "ระบุ" && a.truthy("Q13_val")) a.parseFloat("Q13_val").finiteOrNull() else null,
        )
    }

    fun safetyGate(a: Answers): SafetyGate {
        val q28 = a.str("Q28")
        if (a.str("Q25") == "มี" && a.truthy("Q28") && q28 != "ได้รับอนุญาตแล้ว") {
            return SafetyGate(
                true,
                if (q28 == "ปรึกษาแล้วแต่แพทย์ไม่อนุญาต")
                    "คุณระบุว่าปรึกษาแพทย์แล้วและยังไม่ได้รับอนุญาตให้ออกกำลังกาย — ด้วยเหตุผลด้านความปลอดภัย ระบบจะไม่สร้างตารางออกกำลังกายให้จนกว่าจะได้รับอนุญาตจากแพทย์"
                else
                    "คุณระบุว่ามีอาการบาดเจ็บ/โรคประจำตัว แต่ยังไม่ได้ปรึกษาแพทย์ — ด้วยเหตุผลด้านความปลอดภัย ระบบจะยังไม่สร้างตารางออกกำลังกายให้จนกว่าคุณจะปรึกษาแพทย์และได้รับอนุญาตก่อน",
            )
        }
        return SafetyGate(false)
    }

    fun equipAllowed(level: String): List<String> = when (level) {
        "ครบมาก" -> listOf("bodyweight", "dumbbell", "machine", "barbell", "cable", "pullupbar")
        "ปานกลาง" -> listOf("bodyweight", "dumbbell", "machine", "cable", "pullupbar")
        else -> listOf("bodyweight", "dumbbell", "pullupbar")
    }

    /** ที่บ้าน: อ่านรายการอุปกรณ์จริงจาก Q21 (ไม่มี default แบบยิม) */
    fun equipAllowedHome(q21: List<String>): List<String> {
        val allowed = mutableListOf("bodyweight")
        if ("ไม่มีอุปกรณ์เลย" in q21) return allowed
        if ("ดัมเบล" in q21) allowed += "dumbbell"
        if ("บาร์เบล" in q21) allowed += "barbell"
        if ("บาร์โหน" in q21) allowed += "pullupbar"
        if ("สเต็ปเปอร์" in q21) allowed += "stepper"
        if ("ลูกบอลโยคะ" in q21) allowed += "yogaball"
        if ("ลูกกลิ้งบริหารหน้าท้อง" in q21) allowed += "abroller"
        return allowed
    }

    fun allowedEquipFor(a: Answers): List<String> =
        if (a.str("Q20") == "ที่บ้าน") equipAllowedHome(a.list("Q21")) else equipAllowed(a.strOr("Q22", "ครบมาก"))

    fun targetTier(exp: String?): Int = when (exp) {
        "มือใหม่" -> 2
        "เคยออกบ้าง", "ออกกำลังกายประจำ" -> 3
        "นักกีฬา-เทรนมานาน" -> 4
        else -> 2
    }

    fun candidatesFor(pattern: String, a: Answers, plan: PlanOverrides): List<Candidate> {
        val allowed = allowedEquipFor(a)
        val injuries = a.list("Q26")
        return Catalog.EXERCISES.filter { it.pattern == pattern }.map { e ->
            val lockedBy = injuries.filter { inj -> e.id in (Catalog.EXCLUSION_MAP[inj] ?: emptyList()) }
            val manuallyUnlocked = plan.unlockedEx[e.id] == true
            Candidate(e, e.equip in allowed, lockedBy.isNotEmpty() && !manuallyUnlocked, lockedBy)
        }
    }

    private fun tieBreak(list: List<Candidate>) = list.firstOrNull { it.equip == "machine" } ?: list[0]

    fun pickByTier(eligible: List<Candidate>, tTier: Int): Candidate? {
        if (eligible.isEmpty()) return null
        val exact = eligible.filter { it.tier == tTier }
        if (exact.isNotEmpty()) return tieBreak(exact)
        eligible.filter { it.tier < tTier }.maxOfOrNull { it.tier }?.let { t -> return tieBreak(eligible.filter { it.tier == t }) }
        eligible.filter { it.tier > tTier }.minOfOrNull { it.tier }?.let { t -> return tieBreak(eligible.filter { it.tier == t }) }
        return null
    }

    /** slot = ชื่อรูปแบบท่า หรือ "รูปแบบ@2" (ตัวเลือกที่สองที่ไม่ซ้ำท่าแรก ถ้ามีให้เลือก) */
    fun selectionFor(slot: String, a: Answers, plan: PlanOverrides): Selection {
        val base = Schedule.slotBase(slot)
        val all = candidatesFor(base, a, plan)
        var eligible = all.filter { it.equipOk && !it.locked }
        if (slot != base) {
            val primary = selectionFor(base, a, plan).picked
            val others = if (primary != null) eligible.filter { it.id != primary.id } else eligible
            if (others.isNotEmpty()) eligible = others
        }
        val tTier = if (plan.forceLowTier[base] == true) 1 else targetTier(a.str("Q16"))
        val manual = plan.manualPick[slot]
        val picked = manual?.takeIf { it.isNotEmpty() }
            ?.let { id -> all.firstOrNull { it.id == id && it.equipOk && !it.locked } }
            ?: pickByTier(eligible, tTier)
        return Selection(picked, all)
    }

    fun splitFeasibility(a: Answers): Map<String, SplitFeasibility> {
        val n = a.list("Q2").size
        val rank = a.str("Q16")?.let { Catalog.EXP_RANK[it] } ?: 0
        return Catalog.SPLIT_DEFS.mapValues { (_, def) ->
            val eligible = n >= def.minDays
            SplitFeasibility(eligible, eligible && rank >= def.minRank, def.minDays)
        }
    }

    fun autoSplit(a: Answers): String {
        val f = splitFeasibility(a)
        for (key in listOf("bro", "ppl", "ul")) {
            if (f.getValue(key).let { it.eligible && it.recommended }) return key
        }
        return "fullbody"
    }

    fun effectiveSplit(a: Answers, plan: PlanOverrides): String {
        val override = plan.splitOverride
        if (override != null && splitFeasibility(a)[override]?.eligible == true) return override
        return autoSplit(a)
    }

    /** เวอร์ชันของ state.plan หลังเรียก effectiveSplit ใน JS (ซึ่งเคลียร์ splitOverride ที่ใช้ไม่ได้ทิ้ง) */
    fun sanitizeOverrides(a: Answers, plan: PlanOverrides): PlanOverrides {
        val override = plan.splitOverride ?: return plan
        return if (splitFeasibility(a)[override]?.eligible == true) plan else plan.copy(splitOverride = null)
    }

    fun assignSessions(splitKey: String, days: List<String>): List<DaySession> = Schedule.assignSessions(splitKey, days)

    /** มีวันฝึกติดกันไหม (วนรอบสัปดาห์ อาทิตย์→จันทร์ นับว่าติดกัน) */
    fun weekdayAdjacencyWarning(days: List<String>): Boolean {
        val idx = days.map { Catalog.DAYS.indexOf(it) }.sorted()
        for (i in idx.indices) {
            val x = idx[i]
            val y = idx[(i + 1) % idx.size]
            if ((y - x + 7) % 7 == 1 && idx.size > 1) return true
        }
        return false
    }

    fun repSchemeFor(goal: String?) = goal?.let { Catalog.REP_SCHEME[it] } ?: "3 x 10-12"

    fun setCountFor(setsReps: String?): Int {
        val m = Regex("""^(\d+)(?:-(\d+))?\s*x""").find(setsReps ?: "") ?: return 3
        val n = (m.groupValues[2].ifEmpty { m.groupValues[1] }).toIntOrNull() ?: 0
        return if (n == 0) 3 else n
    }

    /* ---------- ความเข้มข้นรายท่า + จำนวนเซ็ต/ครั้ง ---------- */
    const val INTENSE_SCHEME = "2 x 4-8"

    fun planIntense(slot: String, pattern: String, equip: String, a: Answers, plan: PlanOverrides): Boolean =
        Progression.intensityEligible(pattern, equip) && Progression.intenseBlockReason(a) == null && plan.intensity[slot] == "intense"

    fun setsRepsFor(slot: String, picked: Candidate, a: Answers, plan: PlanOverrides): String {
        val base = Schedule.slotBase(slot)
        if (base in Progression.TIMED_PATTERNS) return if (picked.timed) "3 x 30-45 วิ" else "3 x 10-15"
        if (planIntense(slot, picked.exercise.pattern, picked.equip, a, plan)) return INTENSE_SCHEME
        if (base in Progression.SMALL_PATTERNS) return "3 x 12-15"
        return repSchemeFor(a.str("Q1"))
    }

    /* ---------- วันฝึก / วัน cardio ---------- */
    const val CARDIO_DEFAULT_MIN = 30.0

    /** ยังไม่ได้เลือกวันเอง = ใช้ชุดวันที่มากที่สุดที่ไม่มีกล้ามเนื้อกลุ่มเดียวกันโดนในวันติดกัน */
    fun planTrainDays(a: Answers, plan: PlanOverrides): List<String> {
        val avail = a.list("Q2")
        val td = plan.trainDays
        return if (td != null) Schedule.inAvailable(td, avail)
        else Schedule.inAvailable(Schedule.freeTrainDays(Schedule.ofSplit(effectiveSplit(a, plan)), avail), avail)
    }

    fun planCardioDays(a: Answers, plan: PlanOverrides): List<String> = Schedule.inAvailable(plan.cardioDays, a.list("Q2"))

    fun minsForDays(minByDay: Map<String, Double>, days: List<String>): Map<String, Double> =
        days.associateWith { d -> minByDay[d]?.takeIf { it != 0.0 } ?: CARDIO_DEFAULT_MIN }

    fun buildPlanSnapshot(a: Answers, plan: PlanOverrides): PlanSnapshot {
        val split = effectiveSplit(a, plan)
        val splitDef = Catalog.SPLIT_DEFS.getValue(split)
        val days = planTrainDays(a, plan)
        val dayToSession = assignSessions(split, days).associate { it.day to it.session }
        val sessions = splitDef.sessions.map { se ->
            PlanSession(
                se.key,
                se.patterns.mapNotNull { slot ->
                    val picked = selectionFor(slot, a, plan).picked ?: return@mapNotNull null
                    PlanExercise(
                        pattern = Schedule.slotBase(slot), slot = slot, id = picked.id, th = picked.exercise.th, sub = picked.exercise.sub,
                        tier = picked.tier, equip = picked.equip,
                        setsReps = setsRepsFor(slot, picked, a, plan),
                        intensity = if (planIntense(slot, picked.exercise.pattern, picked.equip, a, plan)) "intense" else "normal",
                        timeBased = picked.timed,
                    )
                },
            )
        }
        val startWeight = a.parseFloat("Q12")
        val cardioDays = planCardioDays(a, plan)
        return PlanSnapshot(
            splitKey = split,
            splitLabel = splitDef.label,
            goal = a.str("Q1"),
            days = days,
            dayToSession = dayToSession,
            sessions = sessions,
            minutesEstimate = a.strOr("Q3", "45-60 นาที"),
            trainTime = a.strOr("Q24", "ไม่แน่นอนแล้วแต่วัน"),
            targets = computeTargets(a, plan),
            startWeight = if (startWeight.isNaN() || startWeight == 0.0) null else startWeight.finiteOrNull(),
            availableDays = a.list("Q2"),
            cardioDays = cardioDays,
            cardioMinByDay = minsForDays(plan.cardioMinByDay, cardioDays),
            exp = a.str("Q16")?.takeIf { it.isNotEmpty() },
            sex = a.str("Q9")?.takeIf { it.isNotEmpty() },
        )
    }
}
