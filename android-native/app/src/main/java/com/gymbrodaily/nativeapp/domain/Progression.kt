package com.gymbrodaily.nativeapp.domain

import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/* ============================================================
   Progressive overload อัตโนมัติ + warm-up set + ความเข้มข้น/เวลาพัก — พอร์ตจาก app.js
   (planFrom, progressionPlan, equipStep, loadTier, safeIncrement, setsText, warmupStepsFor,
   warmupKg, restFor, intensityEligible) ข้อความ/ตัวเลขต้องตรงกับเว็บทุกตัว
   ตรวจด้วย ProgressionParityTest เทียบ golden/progression.json ที่สร้างจาก app.js จริง
   ============================================================ */

data class FeelOpt(val k: String, val icon: String, val label: String, val tip: String)
data class LoadTierInfo(val label: String, val how: String)
data class PlanChange(val kind: String, val from: Double? = null, val to: Double? = null, val inc: Double? = null)
data class WuStep(val pct: Double?, val reps: String, val note: String? = null)
data class Rest(val set: String, val next: String)

/** ผลการตั้งค่าของวันจากเซ็ตฐาน + ความรู้สึก (out ของ planFrom) */
data class LoadPlan(
    val kind: String,
    val sets: List<SetEntry>,
    val base: List<SetEntry>,
    val change: PlanChange?,
    val note: String,
    val tier: String? = null,
    val step: Double? = null,
    val prevDate: String? = null,
    val prevFeel: String? = null,
)

object Progression {
    val FEEL_OPTS = listOf(
        FeelOpt("more", "💪", "ยกเพิ่มได้อีก", "เหลือแรงอีก 3 ครั้งขึ้นไป — ครั้งหน้าระบบเพิ่มให้"),
        FeelOpt("ok", "👌", "พอดี", "เหลือแรงอีก 1-2 ครั้ง — ครั้งหน้าคงไว้"),
        FeelOpt("hard", "😓", "หนักไป / ทำไม่ครบ", "ครั้งหน้าไม่เพิ่ม หรือกลับไปน้ำหนักเดิม"),
    )
    private val LOWER_PATTERNS = listOf("squat", "lunge", "hinge", "glute", "legcurl", "calf")
    val WARMUP_COMPOUND = listOf("squat", "lunge", "hinge", "glute", "hpush", "incline", "hpull", "vpush", "vpull")
    val WARMUP_WEIGHTED = listOf("barbell", "dumbbell", "machine", "cable")
    private val TIMED_PATTERNS = listOf("core", "oblique")
    private val SMALL_PATTERNS = listOf("latraise", "reardelt", "calf")
    const val INTENSE_WARNING = "ต้องคุมฟอร์มให้ดีและเล่นให้ถูกต้องทุกครั้ง เนื่องจากใช้น้ำหนักสูงจึงอาจเสี่ยงบาดเจ็บได้"
    val EQUIP_STEP_OPTS = mapOf(
        "barbell" to listOf(1.0, 2.5, 5.0), "dumbbell" to listOf(0.5, 1.0, 2.0, 2.5),
        "machine" to listOf(1.0, 2.5, 5.0), "cable" to listOf(1.0, 2.5, 5.0),
    )
    val LOAD_TIER = mapOf(
        "light" to LoadTierInfo("ยกเบา", "เพิ่มจำนวนครั้งก่อน ครบช่วงบนทุกเซ็ตแล้วค่อยขึ้น 1 ขั้น"),
        "mid" to LoadTierInfo("ยกปานกลาง", "ขึ้นทีละ 1 ขั้น"),
        "heavy" to LoadTierInfo("ยกหนัก", "ขึ้นตามสัดส่วน (ส่วนล่าง ~5% ส่วนบน ~2.5%) ปัดเป็นขั้นเต็ม"),
    )

    private fun r2(x: Double) = jsRound(x * 100) / 100
    /** String(n) ของ JS */
    fun n(x: Double): String = ProgressGoal.jsNum(x)

    data class RepRange(val lo: Int, val hi: Int)
    fun repRange(setsReps: String?): RepRange {
        val m = Regex("""x\s*(\d+)(?:\s*-\s*(\d+))?""").find(setsReps ?: "") ?: return RepRange(8, 12)
        val lo = m.groupValues[1].toInt()
        return RepRange(lo, m.groupValues[2].ifEmpty { m.groupValues[1] }.toInt())
    }

    fun defaultStep(equip: String, w: Double): Double = when (equip) {
        "dumbbell" -> if (w < 10) 1.0 else 2.0
        "machine", "cable" -> 5.0
        else -> 2.5
    }
    fun equipStep(p: Program, ex: PlanExercise, w: Double): Double = p.equipSteps[ex.id]?.takeIf { it > 0 } ?: defaultStep(ex.equip, w)
    fun loadTier(step: Double, w: Double): String { val r = step / w; return if (r > 0.10) "light" else if (r > 0.05) "mid" else "heavy" }

    fun cleanSets(sets: List<SetEntry?>?): List<SetEntry> = (sets ?: emptyList()).filterNotNull()
        .filter { (it.weight != null && it.weight > 0) || (it.reps != null && it.reps > 0) }
        .map { SetEntry(if (it.weight != null && it.weight > 0) it.weight else null, if (it.reps != null && it.reps > 0) it.reps else null) }
    fun hasSets(e: ExerciseLog?) = cleanSets(e?.sets).isNotEmpty()
    fun topWeight(sets: List<SetEntry>): Double = sets.fold(0.0) { m, s -> val w = s.weight ?: 0.0; if (w > m) w else m }
    fun exKind(ex: PlanExercise, sets: List<SetEntry>): String =
        if (ex.timeBased) "time" else if (ex.equip != "bodyweight" && sets.any { (it.weight ?: 0.0) > 0 }) "weight" else "reps"
    private fun fitSets(base: List<SetEntry>, cnt: Int) = (0 until cnt).map { i -> base[min(i, base.size - 1)].copy() }

    private fun safeIncrement(ex: PlanExercise, w: Double, step: Double, tier: String, cautious: Boolean): Double {
        if (tier == "mid" || cautious) return step
        val pct = if (ex.pattern in LOWER_PATTERNS) 0.05 else 0.025
        return min(max(step, 10 - 10 % step), max(step, floor(w * pct / step) * step))
    }
    private fun tierNote(tier: String, step: Double, w: Double) =
        "${LOAD_TIER.getValue(tier).label} (ขั้นละ ${n(step)} กก. = ${jsRound(step / w * 100).toLong()}% ของน้ำหนักที่ยก)"

    /** แผนจากเซ็ตฐาน + ความรู้สึก (ใช้ทั้งคำนวณวันนี้จากครั้งก่อน และพรีวิว "ครั้งหน้า" จากวันนี้) */
    fun planFrom(p: Program, ex: PlanExercise, base: List<SetEntry>, feel: String?, prog: ProgRec?, symptom: Symptom?): LoadPlan {
        val rr = repRange(ex.setsReps)
        val kind = exKind(ex, base)
        val cnt = Generator.setCountFor(ex.setsReps)
        val sets = fitSets(base, cnt).toMutableList()
        val top = topWeight(base)
        val baseOut = fitSets(base, cnt)
        fun out(change: PlanChange?, note: String, tier: String? = null, step: Double? = null) = LoadPlan(kind, sets.toList(), baseOut, change, note, tier, step)
        val lvl = symptom?.level
        when (feel) {
            "more" -> {
                if (lvl == "caution" || lvl == "injury" || lvl == "emergency")
                    return out(PlanChange("hold"), "ครั้งก่อนบันทึกอาการ “${symptom.text}” — ยังไม่เพิ่ม รอให้หายก่อน")
                if (kind != "time" && base.any { it.reps != null && it.reps < rr.lo })
                    return out(PlanChange("hold"), "ครั้งก่อนบางเซ็ตทำไม่ถึง ${rr.lo} ครั้ง — คงไว้จนทำครบทุกเซ็ตก่อน")
                when (kind) {
                    "weight" -> {
                        val step = equipStep(p, ex, top)
                        val tier = loadTier(step, top)
                        val cautious = prog?.reverted == true
                        if (tier != "light") {
                            val inc = safeIncrement(ex, top, step, tier, cautious)
                            for (i in sets.indices) {
                                var s = sets[i]
                                if ((s.weight ?: 0.0) > 0) s = s.copy(weight = r2(s.weight!! + inc))
                                if (s.reps != null) s = s.copy(reps = min(rr.hi.toDouble(), max(rr.lo.toDouble(), s.reps)))
                                sets[i] = s
                            }
                            return out(
                                PlanChange("weight", top, r2(top + inc), inc),
                                tierNote(tier, step, top) + " → เพิ่ม +${n(inc)} กก." + (if (inc > step) " (${n(inc / step)} ขั้น)" else "") +
                                    (if (cautious) " · ขึ้นแค่ 1 ขั้น เพราะครั้งก่อนกลับไปน้ำหนักเดิม" else ""),
                                tier, step,
                            )
                        } else if (base.all { (it.reps ?: 0.0) >= rr.hi }) {
                            for (i in sets.indices) {
                                var s = sets[i]
                                if ((s.weight ?: 0.0) > 0) s = s.copy(weight = r2(s.weight!! + step))
                                sets[i] = s.copy(reps = rr.lo.toDouble())
                            }
                            return out(
                                PlanChange("weight", top, r2(top + step), step),
                                tierNote(tier, step, top) + " · ทำครบ ${rr.hi} ครั้งทุกเซ็ตแล้ว → ขึ้น +${n(step)} กก. และเริ่มใหม่ที่ ${rr.lo} ครั้ง",
                                tier, step,
                            )
                        } else {
                            for (i in sets.indices) sets[i] = sets[i].copy(reps = min(rr.hi.toDouble(), (sets[i].reps ?: rr.lo.toDouble()) + 1))
                            return out(
                                PlanChange("reps"),
                                tierNote(tier, step, top) + " → เพิ่มทีละ 1 ครั้ง/เซ็ตก่อน ครบ ${rr.hi} ครั้งทุกเซ็ตแล้วจึงขึ้น +${n(step)} กก.",
                                tier, step,
                            )
                        }
                    }
                    "reps" -> {
                        val cap = rr.hi + 5
                        if (base.all { (it.reps ?: 0.0) >= cap })
                            return out(PlanChange("hold"), "ทำได้ $cap ครั้งขึ้นไปแล้ว — ลองเปลี่ยนเป็นท่าที่ยากขึ้นที่หน้า “แผนของฉัน”")
                        for (i in sets.indices) sets[i] = sets[i].copy(reps = min(cap.toDouble(), (sets[i].reps ?: rr.lo.toDouble()) + 1))
                        return out(PlanChange("reps"), "ท่าน้ำหนักตัว: เพิ่ม 1 ครั้งต่อเซ็ต")
                    }
                    else -> {
                        val tcap = rr.hi + 15
                        if (base.all { (it.weight ?: 0.0) >= tcap })
                            return out(PlanChange("hold"), "ค้างได้ $tcap วินาทีขึ้นไปแล้ว — ลองเปลี่ยนเป็นท่าที่ยากขึ้น")
                        for (i in sets.indices) { val w = sets[i].weight; if (w != null && w > 0) sets[i] = sets[i].copy(weight = min(tcap.toDouble(), w + 5)) }
                        return out(PlanChange("time"), "เพิ่มเวลา +5 วินาทีต่อเซ็ต")
                    }
                }
            }
            "hard" -> {
                val from = prog?.from
                if (kind == "weight" && prog != null && prog.kind == "weight" && !prog.reverted && from != null && from > 0 && from < top) {
                    val d = top - from
                    for (i in sets.indices) { val w = sets[i].weight; if (w != null && w > 0) sets[i] = sets[i].copy(weight = r2(max(0.0, w - d))) }
                    return out(PlanChange("back", top, from), "หนักไปหลังเพิ่งขึ้นน้ำหนัก → กลับไปที่ ${n(from)} กก. ที่เคยทำได้")
                }
                return out(PlanChange("hold"), "หนักไป → คงไว้เท่าเดิม ถ้ายังหนักกด “แก้ไข” เพื่อลดลงได้")
            }
            else -> return out(null, if (feel == "ok") "พอดี → ใช้ค่าเดิม" else "")
        }
    }

    fun prevExerciseLog(t: TrackData, exId: String, iso: String): Pair<String, ExerciseLog>? {
        for (d in t.logs.keys.filter { it < iso }.sortedDescending()) {
            val e = t.logs[d]?.exercises?.get(exId)
            if (hasSets(e)) return d to e!!
        }
        return null
    }

    /** แผนของวันนี้จากครั้งล่าสุดที่เล่นท่านี้ — null ถ้ายังไม่เคยบันทึก */
    fun progressionPlan(t: TrackData, ex: PlanExercise, iso: String): LoadPlan? {
        val (date, e) = prevExerciseLog(t, ex.id, iso) ?: return null
        val plan = planFrom(t.program, ex, cleanSets(e.sets), e.feel, e.prog, e.symptom)
        return plan.copy(prevDate = date, prevFeel = e.feel, note = plan.note.ifEmpty { "ใช้ค่าเดียวกับครั้งก่อน" })
    }

    fun progRecord(plan: LoadPlan?): ProgRec? {
        val c = plan?.change ?: return null
        return if (c.kind != "hold") ProgRec(c.kind, c.from, c.to) else null
    }
    fun isUpChange(plan: LoadPlan?) = plan?.change?.kind.let { it == "weight" || it == "reps" || it == "time" }

    fun setsText(sets: List<SetEntry?>, kind: String?): String {
        val cs = cleanSets(sets)
        if (cs.isEmpty()) return "—"
        fun r(s: SetEntry) = s.reps?.let { n(it) } ?: "?"
        if (kind == "time") return cs.joinToString(" / ") { s -> s.weight?.let { n(it) } ?: "null" } + " วิ"
        if (kind == "reps") return cs.joinToString(" / ") { r(it) } + " ครั้ง"
        val w0 = cs[0].weight
        return if (cs.all { it.weight == w0 }) "${w0?.let { n(it) } ?: "null"} กก. × " + cs.joinToString(" / ") { r(it) }
        else cs.joinToString(", ") { "${n(it.weight ?: 0.0)}×${r(it)}" } + " (กก.×ครั้ง)"
    }

    /* ---------- ความเข้มข้น / เวลาพัก ---------- */
    fun intensityEligible(ex: PlanExercise) = ex.pattern !in TIMED_PATTERNS && ex.pattern !in SMALL_PATTERNS && ex.equip in WARMUP_WEIGHTED
    fun isIntense(ex: PlanExercise) = intensityEligible(ex) && ex.intensity == "intense"

    /**
     * แบบเข้มข้น (จนหมดแรง ด้วยน้ำหนักสูง) ปิดสำหรับมือใหม่ และคนที่ระบุอาการบาดเจ็บ/โรคประจำตัว/ข้อจำกัดทางร่างกาย
     * (เหมือน intenseBlockReason ของเว็บ) คืนเหตุผลที่ปิด หรือ null ถ้าใช้ได้ — แผนที่เคยเลือกไว้ก่อนหน้านี้ไม่ถูกแก้ย้อนหลัง
     */
    fun intenseBlockReason(a: Answers): String? {
        if (a.str("Q16") == "มือใหม่") return "คุณระบุว่าเป็นมือใหม่ — เริ่มจากแบบทั่วไปจนฟอร์มนิ่งก่อน"
        val inj = a.list("Q26")
        if (a.str("Q25") == "มี" && inj.isNotEmpty())
            return "คุณระบุอาการบาดเจ็บ/โรคประจำตัว (${inj.joinToString(", ")}) — แบบเข้มข้นใช้น้ำหนักสูงจนหมดแรง เสี่ยงเกินไป"
        return null
    }
    fun restFor(ex: PlanExercise): Rest = when {
        isIntense(ex) -> Rest("3-5 นาที", "3-5 นาที")
        ex.timeBased || ex.pattern in TIMED_PATTERNS -> Rest("30-60 วินาที", "2-3 นาที")
        ex.equip !in WARMUP_WEIGHTED || ex.pattern !in WARMUP_COMPOUND -> Rest("60-90 วินาที", "2-3 นาที")
        else -> Rest("90-120 วินาที", "2-3 นาที")
    }

    /* ---------- warm-up set ---------- */
    fun warmupStepsFor(sess: PlanSession?): Map<String, List<WuStep>> {
        val out = LinkedHashMap<String, List<WuStep>>()
        var firstHeavy = true
        sess?.exercises?.forEach { ex ->
            out[ex.id] = when {
                ex.timeBased -> emptyList()
                ex.equip !in WARMUP_WEIGHTED -> listOf(WuStep(null, "6-8", "แบบเบา/ช่วงสั้นกว่าเซ็ตจริง"))
                ex.pattern !in WARMUP_COMPOUND -> listOf(WuStep(0.5, "10-12"))
                firstHeavy -> { firstHeavy = false; listOf(WuStep(0.4, "8-10"), WuStep(0.6, "5"), WuStep(0.8, "2-3")) }
                else -> listOf(WuStep(0.6, "5"), WuStep(0.8, "2-3"))
            }
        }
        return out
    }

    fun warmupKg(refKg: Double?, pct: Double?, equip: String): Double? {
        if (refKg == null || refKg == 0.0 || refKg.isNaN() || pct == null || pct == 0.0) return null
        val step = if (equip == "dumbbell") 1.0 else 2.5
        var kg = jsRound(refKg * pct / step) * step
        if (equip == "barbell") kg = max(20.0, kg)
        return max(step, kg)
    }

    /** น้ำหนักอ้างอิงของ warm-up + ข้อความบอกที่มา (ตรงกับ warmupHTML ของเว็บ) */
    data class WuRef(val refKg: Double?, val basis: String)
    fun warmupRef(ex: PlanExercise, e: ExerciseLog?, steps: List<WuStep>, prev: HistoryEntry?, planTop: Double): WuRef {
        val todayMax = (e?.sets ?: emptyList()).fold(0.0) { m, s -> val w = s?.weight ?: 0.0; if (w > m) w else m }
        val intenseRef = if (todayMax == 0.0 && planTop == 0.0 && isIntense(ex) && prev != null && prev.e1rm != 0.0) warmupKg(prev.e1rm, 0.835, ex.equip) else null
        val refKg = todayMax.takeIf { it != 0.0 } ?: planTop.takeIf { it != 0.0 } ?: intenseRef ?: prev?.weight?.takeIf { it != 0.0 }
        val basis = if (steps.isEmpty() || steps[0].pct == null) ""
        else if (refKg != null) "คำนวณจากน้ำหนักเซ็ตจริง ${n(refKg)} กก." + when {
            todayMax != 0.0 -> " (วันนี้)"
            planTop != 0.0 -> " (ที่ตั้งไว้วันนี้)"
            intenseRef != null -> " (น้ำหนักเข้มข้นที่แนะนำ)"
            else -> " (ครั้งก่อน)"
        } else "ยังไม่มีน้ำหนักอ้างอิง — ใช้ % ของน้ำหนักเซ็ตจริงที่จะยก"
        return WuRef(refKg, basis)
    }

    fun warmupLabel(st: WuStep, refKg: Double?, equip: String): String {
        val kg = warmupKg(refKg, st.pct, equip)
        val what = if (st.pct == null) (st.note ?: "แบบเบา") else kg?.let { "${n(it)} กก." } ?: "~${jsRound(st.pct * 100).toLong()}%"
        return "$what × ${st.reps}"
    }

    /** 4-8 ครั้งจนหมดแรง ≈ 79-88% ของ 1RM — แนะนำจาก e1RM ของครั้งก่อนถ้ามี */
    fun intenseNote(ex: PlanExercise, prev: HistoryEntry?): String {
        val lo = prev?.e1rm?.takeIf { it != 0.0 }?.let { warmupKg(it, 0.79, ex.equip) }
        val hi = prev?.e1rm?.takeIf { it != 0.0 }?.let { warmupKg(it, 0.88, ex.equip) }
        val load = if (lo != null && hi != null) "น้ำหนักแนะนำ ~${n(lo)}" + (if (hi > lo) "–${n(hi)}" else "") + " กก. (≈79–88% ของ 1RM โดยประมาณจากครั้งก่อน) "
        else "เลือกน้ำหนักที่ยกได้แค่ 4-8 ครั้งแล้วหมดแรง "
        return "⚠️ ${load}— $INTENSE_WARNING"
    }
}
