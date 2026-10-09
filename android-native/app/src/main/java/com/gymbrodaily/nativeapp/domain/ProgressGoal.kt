package com.gymbrodaily.nativeapp.domain

import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min
import kotlin.math.sqrt

/* ============================================================
   แถบไขมัน (ชักเย่อแคลอรี่) + กรอบแผน Progression & Goal — พอร์ตจาก app.js
   (fatTug, dayEnergy, pgWeightPlan, pgAdherence, pg*Signal, pgEvaluate, pgCurrent, pgRecommend
   และข้อความสรุปที่หน้า "ความคืบหน้า" ใช้) ข้อความ/ตัวเลขต้องตรงกับเว็บทุกตัว
   ตรวจด้วย ProgressGoalParityTest เทียบ golden/progress.json ที่สร้างจาก app.js จริง
   "วันนี้" รับเป็นพารามิเตอร์เสมอ ไม่อ่านนาฬิกาเอง
   ============================================================ */

const val FAT_KCAL_PER_KG = 7700
private val FAT_BAR_GOALS = listOf("ลดไขมัน", "Recomposition (ลด+เพิ่มพร้อมกัน)")
private val WARMUP_WEIGHTED = listOf("barbell", "dumbbell", "machine", "cable")
private const val CARDIO_DEFAULT_MIN = 30.0
private val TH_MONTHS = listOf("ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.")

const val PG_WINDOW = 21
const val PG_STR_WINDOW = 28
const val PG_EARLY_DAYS = 21
val PG_GAIN_PCT_MONTH = listOf(listOf(1.0, 1.5), listOf(0.75, 1.25), listOf(0.5, 1.0), listOf(0.25, 0.5))
private val PG_STR_PCT_4W = listOf(listOf(4.0, 10.0), listOf(3.0, 7.0), listOf(1.5, 4.0), listOf(0.5, 2.0))

enum class PgLevel(val key: String, val n: Int, val label: String, val icon: String) {
    NA("na", 0, "ข้อมูลยังไม่พอประเมิน", "⚪"),
    OK("ok", 1, "เป็นไปตามแผน", "🟢"),
    WATCH("watch", 2, "เฝ้าระวัง", "🟡"),
    ANOMALY("anomaly", 3, "ผิดปกติ — ตรวจสอบข้อมูล", "🟠"),
    ADJUST("adjust", 4, "ควรปรับแผน", "🔴"),
}

private fun worse(a: PgLevel, b: PgLevel) = if (b.n > a.n) b else a

data class FatDay(val date: String, val kcal: Double, val tdee: Double, val ex: Double, val burn: Double, val bal: Double, val ev: String?)
data class FatTugResult(val acc: Double, val gains: List<String>, val losses: List<String>, val days: List<FatDay>)
data class Energy(val kcal: Double, val tdee: Double, val ex: Double)

data class PgPlan(val c: Double, val lo: Double, val hi: Double, val exPerDay: Int)
data class LinReg(val a: Double, val b: Double, val se: Double, val n: Int)
data class WPoint(val x: Int, val y: Double, val date: String)
data class AnchorKg(val kg: Double, val date: String)
data class StressEntry(val date: String, val level: Double, val note: String)
data class PgIssue(val lvl: String, val text: String)
data class PgLift(val ex: PlanExercise, val pct: Double, val n: Int, val last: Double, val level: PgLevel)
data class PgWeek(val week: Int, val date: String, val level: PgLevel)
data class NowKg(val kg: Double, val how: String)
data class PgEta(
    val goal: Double,
    val done: Boolean = false,
    val mismatch: Boolean = false,
    val weeks: Double? = null,
    val date: String? = null,
    val fast: Double? = null,
    val slow: Double? = null,
)

class Adherence {
    var days = 0; var sess = 0; var sessDone = 0; var sessNoData = 0
    var cardio = 0; var cardioDone = 0; var cardioMin = 0.0
    val kcal = mutableListOf<Double>(); var kcalOkDays = 0; var macroMismatch = 0; var lowKcal = 0
    val prot = mutableListOf<Double>(); val sleep = mutableListOf<Double>(); var injuries = 0
    val stress = mutableListOf<Double>(); val stressLog = mutableListOf<StressEntry>(); val stressHigh = mutableListOf<StressEntry>()
    var sessPct: Double? = null; var kcalCover = 0.0; var avgIn: Double? = null
    var train = false; var food = false
}

class PgSignal(val key: String, val title: String) {
    var level = PgLevel.NA
    var text = ""
    var why: String? = null
    var rate: Double? = null
    var dev: Double? = null
    var implied: Double? = null
    var expected: Double? = null
    var exAct: Double? = null
    var unc: Double? = null
    var bmr: Double? = null
    var diff: Double? = null
    val lifts = mutableListOf<PgLift>()
}

data class PgContext(val hist: Map<String, List<HistoryEntry>>, val series: List<WeightPoint>, val anchorKg: AnchorKg?)

class PgEval(
    val asOf: String,
    val anchor: String,
    val elapsed: Int,
    val ws: String,
    val refKg: Double,
    val plan: PgPlan,
    val adh: Adherence,
    val wpts: List<WPoint>,
    val reg: LinReg?,
) {
    lateinit var weight: PgSignal
    lateinit var energy: PgSignal
    lateinit var strength: PgSignal
    val signals get() = listOf(weight, energy, strength)
    var level = PgLevel.NA
    var issues: List<PgIssue> = emptyList()
    var causes: List<String> = emptyList()
    // เติมใน pgCurrent
    var ctx: PgContext? = null
    var history: List<PgWeek> = emptyList()
    var run = 0
    var persisted = false
    var confirmed = false
}

data class PgRecommendation(
    val kcal: Int?,
    val text: List<String>,
    val floor: Int? = null,
    val want: Int? = null,
    val belowFloor: Boolean = false,
    val capped: Boolean = false,
    val tdee: Int? = null,
)

object ProgressGoal {

    /* ---------- วันที่/ตัวเลขแบบเดียวกับ app.js ---------- */
    private fun d(iso: String) = LocalDate.parse(iso)
    fun addDays(iso: String, n: Int): String = d(iso).plusDays(n.toLong()).toString()
    fun nextISO(iso: String) = addDays(iso, 1)
    fun daysBetween(a: String, b: String) = ChronoUnit.DAYS.between(d(a), d(b)).toInt()
    fun shortDateTH(iso: String): String = d(iso).let { "${it.dayOfMonth} ${TH_MONTHS[it.monthValue - 1]}" }
    fun dateY(iso: String): String = d(iso).let { "${it.dayOfMonth} ${TH_MONTHS[it.monthValue - 1]} ${it.year + 543}" }
    fun mean(xs: List<Double>): Double? = if (xs.isEmpty()) null else xs.sum() / xs.size
    private fun r1(x: Double) = jsRound(x * 10) / 10
    private fun fmt1(x: Double) = Tracking.fmt1(x)
    private fun pct100(x: Double) = jsRound(x * 100).toLong()
    private fun loc(x: Double) = jsLocale(x)
    private fun locR(x: Double) = jsLocale(jsRound(x))
    fun fmtKcal(v: Number?): String = v?.let { jsLocale(it.toDouble()) } ?: "ข้อมูลไม่ครบ"
    fun rate(x: Double) = (if (x > 0) "+" else if (x < 0) "−" else "") + jsToFixed(abs(x), 2)
    fun pctTxt(x: Double) = (if (x > 0) "+" else if (x < 0) "−" else "") + jsToFixed(abs(x), 1) + "%"
    /** ตัวเลขแบบ String(n) ของ JS (5 → "5", 1.5 → "1.5") */
    fun jsNum(x: Double): String = if (x == floor(x) && abs(x) < 1e15) x.toLong().toString() else x.toString()

    /* ---------- อ่านข้อมูลรายวัน ---------- */
    private fun logFor(t: TrackData, iso: String) = t.logs[iso]

    fun cardioMinFor(p: Program, wd: String): Double {
        val m = p.cardioMinByDay[wd]
        return if (m != null && m > 0) m else (p.cardioMinutes?.takeIf { it != 0.0 } ?: CARDIO_DEFAULT_MIN)
    }
    fun cardioPlannedFor(p: Program, iso: String) = Tracking.thaiWeekday(iso) in p.cardioDays
    fun cardioMinutesOn(t: TrackData, iso: String): Double? = logFor(t, iso)?.cardio?.minutes?.takeIf { it > 0 }
    fun stressOf(t: TrackData, iso: String): StressLog? = logFor(t, iso)?.stress?.takeIf { s -> s.level != null && s.level >= 1 && s.level <= 5 }
    fun seriousSymptoms(t: TrackData, iso: String): List<Symptom> =
        logFor(t, iso)?.exercises?.values?.mapNotNull { it.symptom }?.filter { it.level == "injury" || it.level == "emergency" } ?: emptyList()

    fun sessionDone(t: TrackData, p: Program, iso: String): Boolean {
        val lg = logFor(t, iso)
        if (lg?.completed == true) return true
        val sess = Tracking.sessionDefFor(p, Tracking.sessionKeyFor(p, iso)) ?: return false
        return sess.exercises.isNotEmpty() && sess.exercises.all { lg?.exercises?.get(it.id)?.done == true }
    }

    /* ---------- แถบไขมัน ---------- */
    fun fatBarEnabled(p: Program?) = p != null && p.goal in FAT_BAR_GOALS

    fun exerciseKcal(kg: Double, sessions: Int, sessMin: Double, cardioMin: Double) = (sessions * sessMin * 2.5 + cardioMin * 4) * 3.5 * kg / 200
    fun sessMin(p: Program): Double = (Questions.Q3_MIN[p.minutesEstimate] ?: 52).toDouble()
    fun cardioWeek(p: Program): Double = p.cardioDays.sumOf { cardioMinFor(p, it) }
    fun plannedExPerDay(p: Program, kg: Double): Int = jsRound(exerciseKcal(kg, p.days.size, sessMin(p), cardioWeek(p)) / 7).toInt()

    fun dayExerciseKcal(t: TrackData, iso: String): Double {
        val p = t.program
        val kg = Tracking.bodyweightAsOf(t, iso)?.takeIf { it != 0.0 && !it.isNaN() }
            ?: t.answers.parseFloat("Q12").takeIf { it != 0.0 && !it.isNaN() } ?: return 0.0
        val parts = logFor(t, iso)?.final?.parts
        val sess = if (parts != null) parts.any { !it.missed && !it.label.startsWith("Cardio") }
        else Tracking.sessionKeyFor(p, iso) != null && sessionDone(t, p, iso)
        return jsRound(exerciseKcal(kg, if (sess) 1 else 0, sessMin(p), cardioMinutesOn(t, iso) ?: 0.0))
    }

    fun dayEnergy(t: TrackData, iso: String): Energy? {
        val lg = logFor(t, iso)
        val fe = lg?.final?.energy
        if (fe != null) return Energy(fe.kcal ?: 0.0, fe.tdee ?: 0.0, fe.ex ?: dayExerciseKcal(t, iso))
        val kcal = lg?.nutrition?.kcal
        val tdee = Tracking.targetsOf(t).tdee
        return if (kcal != null && tdee != null) Energy(kcal, tdee.toDouble(), dayExerciseKcal(t, iso)) else null
    }

    fun fatTug(t: TrackData, today: String): FatTugResult {
        var acc = 0.0
        val gains = mutableListOf<String>(); val losses = mutableListOf<String>(); val days = mutableListOf<FatDay>()
        t.logs.keys.filter { it < today }.sorted().forEach { iso ->
            val en = dayEnergy(t, iso) ?: return@forEach
            val burn = en.tdee + en.ex
            val bal = burn - en.kcal
            acc += bal
            var ev: String? = null
            if (acc >= FAT_KCAL_PER_KG) { losses += iso; acc = 0.0; ev = "loss" }
            else if (acc <= -FAT_KCAL_PER_KG) { gains += iso; acc = 0.0; ev = "gain" }
            days += FatDay(iso, en.kcal, en.tdee, en.ex, burn, bal, ev)
        }
        return FatTugResult(acc, gains, losses, days)
    }

    /* ---------- กรอบแผน ---------- */
    private fun pg(p: Program) = p.pg ?: PgState()
    fun anchorDate(p: Program, today: String): String {
        val start = p.startDate ?: today
        val f = pg(p).evalFrom
        return if (f != null && f > start) f else start
    }
    fun expRank(t: TrackData): Int = Catalog.EXP_RANK[t.program.exp?.takeIf { it.isNotEmpty() } ?: t.answers.str("Q16")] ?: 0
    fun sex(t: TrackData): String? = t.program.sex?.takeIf { it.isNotEmpty() } ?: t.answers.str("Q9")?.takeIf { it.isNotEmpty() }

    fun linreg(pts: List<Pair<Double, Double>>): LinReg? {
        val n = pts.size
        if (n < 2) return null
        var mx = 0.0; var my = 0.0
        pts.forEach { mx += it.first; my += it.second }
        mx /= n; my /= n
        var sxx = 0.0; var sxy = 0.0
        pts.forEach { sxx += (it.first - mx) * (it.first - mx); sxy += (it.first - mx) * (it.second - my) }
        if (sxx == 0.0) return null
        val b = sxy / sxx
        val a = my - b * mx
        var sse = 0.0
        pts.forEach { val r = it.second - (a + b * it.first); sse += r * r }
        return LinReg(a, b, if (n > 2) sqrt(sse / (n - 2) / sxx) else 0.0, n)
    }

    fun bmr(t: TrackData, kg: Double): Double? =
        Calculations.calculateBMR(kg, t.answers.number("Q11"), t.answers.number("Q10"), sex(t))

    fun weightPlan(t: TrackData, kg: Double): PgPlan {
        val p = t.program
        val tg = Tracking.targetsOf(t)
        val ex = plannedExPerDay(p, kg)
        val energy = if (tg.kcal != null && tg.tdee != null) (tg.kcal - (tg.tdee + ex)) * 7.0 / FAT_KCAL_PER_KG else null
        val c: Double; val lo: Double; val hi: Double
        when (p.goal) {
            "เพิ่มกล้ามเนื้อ" -> {
                val g = PG_GAIN_PCT_MONTH[expRank(t)]
                lo = kg * g[0] / 100 * 7 / 30.4; hi = kg * g[1] / 100 * 7 / 30.4; c = (lo + hi) / 2
            }
            "ลดไขมัน" -> {
                c = energy ?: (-kg * 0.0075)
                val w = max(kg * 0.0015, abs(c) * 0.3)
                lo = max(c - w, min(c, -kg * 0.01))
                hi = c + w
            }
            else -> {
                c = energy ?: 0.0
                lo = c - kg * 0.002; hi = c + kg * 0.002
            }
        }
        return PgPlan(c, lo, hi, ex)
    }

    fun strengthBand(t: TrackData): List<Double> {
        val b = PG_STR_PCT_4W[expRank(t)]
        return when (t.program.goal) {
            "เพิ่มกล้ามเนื้อ" -> listOf(b[0], b[1])
            "ลดไขมัน" -> listOf(0.0, r1(b[1] * 0.5))
            else -> listOf(r1(b[0] * 0.6), r1(b[1] * 0.8))
        }
    }

    fun anchorKg(t: TrackData, today: String): AnchorKg? {
        val from = anchorDate(t.program, today)
        val until = addDays(from, 6)
        Tracking.weightSeries(t).firstOrNull { it.date >= from && it.date <= until }?.let { return AnchorKg(it.kg, it.date) }
        return Tracking.bodyweightAsOf(t, from)?.let { AnchorKg(it, from) }
    }

    fun lifts(p: Program): List<PlanExercise> {
        val seen = mutableSetOf<String>()
        val out = mutableListOf<PlanExercise>()
        p.sessions.forEach { s ->
            s.exercises.forEach { ex ->
                if (ex.id in seen || ex.timeBased || ex.equip !in WARMUP_WEIGHTED) return@forEach
                seen += ex.id; out += ex
            }
        }
        return out
    }

    private fun hasLiftData(t: TrackData, p: Program, iso: String): Boolean {
        val sess = Tracking.sessionDefFor(p, Tracking.sessionKeyFor(p, iso))
        val exs = logFor(t, iso)?.exercises ?: emptyMap()
        val weighted = (sess?.exercises ?: emptyList()).filter { it.equip in WARMUP_WEIGHTED && !it.timeBased }
        if (weighted.isEmpty()) return true
        return weighted.any { ex -> exs[ex.id]?.sets?.any { s -> s?.weight != null && s.weight > 0 } == true }
    }

    fun adherence(t: TrackData, from: String, to: String): Adherence {
        val p = t.program
        val tg = Tracking.targetsOf(t)
        val r = Adherence()
        var iso = from
        while (iso <= to) {
            r.days++
            val lg = logFor(t, iso)
            if (Tracking.sessionKeyFor(p, iso) != null) {
                r.sess++
                if (sessionDone(t, p, iso)) { r.sessDone++; if (!hasLiftData(t, p, iso)) r.sessNoData++ }
            }
            val cm = cardioMinutesOn(t, iso) ?: 0.0
            r.cardioMin += cm
            if (cardioPlannedFor(p, iso)) { r.cardio++; if (cm != 0.0) r.cardioDone++ }
            val n = lg?.nutrition ?: Nutrition()
            if (n.kcal != null && n.kcal > 0) {
                r.kcal += n.kcal
                if (Tracking.kcalOk(n.kcal, tg.kcal)) r.kcalOkDays++
                if (n.proteinG != null && n.carbG != null && n.fatG != null) {
                    val mk = n.proteinG * 4 + n.carbG * 4 + n.fatG * 9
                    if (mk > 0 && abs(mk - n.kcal) / n.kcal > 0.15) r.macroMismatch++
                }
                if (n.kcal < 800 || (tg.kcal != null && n.kcal < tg.kcal * 0.6)) r.lowKcal++
            }
            n.proteinG?.let { r.prot += it }
            val sl = lg?.sleep?.hours
            if (sl != null && sl.isFinite() && sl >= 0 && sl <= 24) r.sleep += sl
            r.injuries += seriousSymptoms(t, iso).size
            stressOf(t, iso)?.let { st ->
                val e = StressEntry(iso, st.level!!, st.note ?: "")
                r.stress += st.level; r.stressLog += e
                if (st.level >= 4) r.stressHigh += e
            }
            iso = nextISO(iso)
        }
        val avgIn = mean(r.kcal)
        r.sessPct = if (r.sess != 0) r.sessDone.toDouble() / r.sess else null
        r.kcalCover = if (r.days != 0) r.kcal.size.toDouble() / r.days else 0.0
        r.avgIn = avgIn
        r.train = r.sessPct == null || r.sessPct!! >= 0.75
        r.food = r.kcalCover >= 0.7 && avgIn != null && tg.kcal != null && abs(avgIn - tg.kcal) <= tg.kcal * 0.1
        return r
    }

    fun followText(adh: Adherence): String {
        val out = mutableListOf<String>()
        adh.sessPct?.let { out += "เข้าฝึก ${pct100(it)}%" }
        out += "กรอกแคลอรี่ ${pct100(adh.kcalCover)}% ของวัน"
        adh.avgIn?.let { out += "กินเฉลี่ย ${locR(it)} kcal" }
        return out.joinToString(" · ")
    }

    fun followGap(t: TrackData, adh: Adherence): String {
        val tg = Tracking.targetsOf(t)
        val out = mutableListOf<String>()
        val sp = adh.sessPct
        if (sp != null && sp < 0.75) out += "เข้าฝึก ${pct100(sp)}% (เกณฑ์ 75%)"
        val avg = adh.avgIn
        if (adh.kcalCover < 0.7) out += "กรอกแคลอรี่ ${pct100(adh.kcalCover)}% ของวัน (เกณฑ์ 70%)"
        else if (avg != null && tg.kcal != null && abs(avg - tg.kcal) > tg.kcal * 0.1)
            out += "กินเฉลี่ย ${locR(avg)} kcal ${if (avg > tg.kcal) "เกิน" else "ต่ำกว่า"}เป้า ${jsLocale(tg.kcal)} เกิน 10%"
        return out.joinToString(" · ")
    }

    private fun direction(p: Program, rate: Double, dev: Double): String = when (p.goal) {
        "ลดไขมัน" -> if (dev > 0) (if (rate >= 0) "น้ำหนักไม่ลด" else "ลดช้ากว่ากรอบ") else "ลดเร็วกว่ากรอบ (เสี่ยงเสียกล้ามเนื้อ)"
        "เพิ่มกล้ามเนื้อ" -> if (dev < 0) (if (rate <= 0) "น้ำหนักไม่เพิ่ม" else "เพิ่มช้ากว่ากรอบ") else "เพิ่มเร็วกว่ากรอบ (ส่วนเกินมักเป็นไขมัน)"
        else -> if (dev > 0) "น้ำหนักขึ้นมากกว่ากรอบ" else "น้ำหนักลงมากกว่ากรอบ"
    }

    private fun weightSignal(t: TrackData, ev: PgEval): PgSignal {
        val s = PgSignal("weight", "น้ำหนักตัวเทียบกรอบแผน")
        val plan = ev.plan
        val band = "กรอบ ${rate(plan.lo)} ถึง ${rate(plan.hi)} กก./สัปดาห์"
        val reg = ev.reg
        if (reg == null) {
            s.text = "ต้องชั่งน้ำหนักอย่างน้อย 4 ครั้งในช่วง 10 วันขึ้นไปของรอบนี้ (ตอนนี้ ${ev.wpts.size} ครั้ง) · $band"
            return s
        }
        val r = reg.b * 7
        val kg = ev.refKg
        val dev = if (r > plan.hi) r - plan.hi else if (r < plan.lo) r - plan.lo else 0.0
        var lvl = if (abs(dev) <= kg * 0.0005) PgLevel.OK else if (abs(dev) <= max(1.5 * reg.se * 7, kg * 0.001)) PgLevel.WATCH else PgLevel.ANOMALY
        val early = ev.elapsed < PG_EARLY_DAYS && dev * plan.c > 0
        if (lvl == PgLevel.ANOMALY && early) lvl = PgLevel.WATCH
        s.rate = r
        val head = "แนวโน้มจากการชั่ง ${ev.wpts.size} ครั้งล่าสุด ${rate(r)} กก./สัปดาห์"
        if (lvl == PgLevel.OK) { s.level = PgLevel.OK; s.text = "$head อยู่ใน$band"; return s }
        val dir = direction(t.program, r, dev)
        if (!(ev.adh.food && ev.adh.train)) {
            s.why = "follow"
            s.text = "$head — $dir ($band) แต่ช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ (${followGap(t, ev.adh)}) ผลจึงยังไม่นับว่าแผนผิดปกติ"
            return s
        }
        s.level = lvl; s.dev = dev
        s.text = "$head — $dir ($band) ทั้งที่ทำตามแผน (${followText(ev.adh)})" +
            if (early) " · ช่วง 3 สัปดาห์แรกน้ำและไกลโคเจนทำให้น้ำหนักเปลี่ยนเร็วกว่าปกติได้" else ""
        return s
    }

    private fun energySignal(t: TrackData, ev: PgEval): PgSignal {
        val s = PgSignal("energy", "การกินที่บันทึก เทียบกับน้ำหนักที่เปลี่ยนจริง")
        val tg = Tracking.targetsOf(t)
        val adh = ev.adh
        val need = max(7, ceil(adh.days * 0.7).toInt())
        val reg = ev.reg
        if (reg == null) { s.text = "ต้องมีแนวโน้มน้ำหนักก่อน (ชั่งอย่างน้อย 4 ครั้งในช่วง 10 วันขึ้นไป)"; return s }
        if (adh.kcal.size < need) { s.text = "ต้องกรอกแคลอรี่อย่างน้อย $need จาก ${adh.days} วันในช่วงประเมิน (ตอนนี้ ${adh.kcal.size} วัน)"; return s }
        if (tg.tdee == null) { s.text = "คำนวณ TDEE ไม่ได้ — ข้อมูลแบบสอบถามไม่ครบ"; return s }
        val exAct = exerciseKcal(ev.refKg, adh.sessDone, sessMin(t.program), adh.cardioMin) / adh.days
        val avgIn = adh.avgIn!!
        val implied = avgIn - reg.b * FAT_KCAL_PER_KG
        val unc = reg.se * FAT_KCAL_PER_KG
        val expected = tg.tdee + exAct
        val diff = implied - expected
        val bmr = bmr(t, ev.refKg)
        var lvl = if (abs(diff) <= max(0.12 * expected, unc)) PgLevel.OK else if (abs(diff) <= max(0.2 * expected, 1.5 * unc)) PgLevel.WATCH else PgLevel.ANOMALY
        val belowBmr = bmr != null && implied + unc < bmr
        if (belowBmr) lvl = PgLevel.ANOMALY
        if (lvl == PgLevel.ANOMALY && ev.elapsed < PG_EARLY_DAYS) lvl = PgLevel.WATCH
        s.level = lvl; s.implied = implied; s.expected = expected; s.exAct = exAct; s.unc = unc; s.bmr = bmr; s.diff = diff
        val nums = "กินเฉลี่ย ${locR(avgIn)} kcal/วัน และน้ำหนักเปลี่ยน ${rate(reg.b * 7)} กก./สัปดาห์ → ร่างกายใช้พลังงานจริงประมาณ ${locR(implied)} kcal/วัน"
        val exp = " (${locR(expected)} kcal)"
        if (lvl == PgLevel.OK) { s.text = "$nums ใกล้กับที่ระบบคาด$exp — ข้อมูลสอดคล้องกัน"; return s }
        val pct = jsRound(abs(diff) / expected * 100).toLong()
        s.text = if (diff < 0) {
            "$nums ต่ำกว่าที่ระบบคาด$exp $pct%" + if (belowBmr)
                " และต่ำกว่าพลังงานขั้นต่ำขณะพัก (BMR ~${locR(bmr!!)} kcal) ซึ่งแทบเป็นไปไม่ได้ทางร่างกาย — มีแนวโน้มสูงว่าบันทึกการกินไม่ครบ หรือช่วงนี้มีน้ำคั่ง"
            else " — มักเกิดจากบันทึกการกินไม่ครบ (เครื่องดื่ม ของว่าง น้ำมัน ซอส) หรือร่างกายใช้พลังงานน้อยกว่าที่คำนวณ"
        } else {
            "$nums สูงกว่าที่ระบบคาด$exp $pct% — อาจกรอกแคลอรี่เกินจริง เคลื่อนไหวมากขึ้น หรือน้ำหนักลดจากน้ำ"
        }
        return s
    }

    private fun strengthSignal(t: TrackData, ev: PgEval, ctx: PgContext): PgSignal {
        val s = PgSignal("strength", "ความแข็งแรงเทียบกรอบแผน")
        val p = t.program
        val band = strengthBand(t)
        var from = addDays(ev.asOf, -PG_STR_WINDOW)
        if (from < ev.anchor) from = ev.anchor
        lifts(p).forEach { ex ->
            val h = (ctx.hist[ex.id] ?: emptyList()).filter { it.date >= from && it.date <= ev.asOf }
            if (h.size < 3 || daysBetween(h[0].date, h.last().date) < 14) return@forEach
            val r = linreg(h.map { daysBetween(h[0].date, it.date).toDouble() to it.e1rm }) ?: return@forEach
            if (!(r.a > 0)) return@forEach
            val pct = r.b * 28 / r.a * 100
            val dev = band[0] - pct
            s.lifts += PgLift(ex, pct, h.size, h.last().e1rm, if (dev <= 1) PgLevel.OK else if (dev <= 5) PgLevel.WATCH else PgLevel.ANOMALY)
        }
        val bandTxt = "กรอบ e1RM ${if (band[0] > 0) "+" else ""}${jsNum(band[0])} ถึง +${jsNum(band[1])}% ต่อ 4 สัปดาห์"
        if (s.lifts.isEmpty()) {
            s.text = "ต้องบันทึกน้ำหนัก × ครั้งของท่าที่ใช้น้ำหนัก อย่างน้อย 3 ครั้งต่อท่าในช่วง 14 วันขึ้นไป · $bandTxt"
            return s
        }
        val bad = s.lifts.filter { it.level != PgLevel.OK }
        val anom = s.lifts.filter { it.level == PgLevel.ANOMALY }
        val lvl = if (anom.size >= 2 || (anom.isNotEmpty() && anom.size * 2 >= s.lifts.size)) PgLevel.ANOMALY
        else if (bad.isNotEmpty() && bad.size * 3 >= s.lifts.size) PgLevel.WATCH else PgLevel.OK
        val head = "${s.lifts.size} ท่าที่มีข้อมูล เฉลี่ย ${pctTxt(mean(s.lifts.map { it.pct })!!)} ต่อ 4 สัปดาห์"
        val worst = bad.sortedBy { it.pct }
        val names = worst.take(3).joinToString(", ") { "${it.ex.th} ${pctTxt(it.pct)}" } +
            if (worst.size > 3) " และอีก ${worst.size - 3} ท่า" else ""
        if (lvl == PgLevel.OK) {
            s.level = PgLevel.OK
            s.text = "$head อยู่ใน$bandTxt" + if (names.isNotEmpty()) " · ท่าที่ยังช้ากว่ากรอบ: $names" else ""
            return s
        }
        var sp = 0; var sd = 0
        var iso = from
        while (iso < ev.asOf) {
            if (Tracking.sessionKeyFor(p, iso) != null) { sp++; if (sessionDone(t, p, iso)) sd++ }
            iso = nextISO(iso)
        }
        if (sp != 0 && sd.toDouble() / sp < 0.75) {
            s.why = "follow"
            s.text = "$head — ต่ำกว่า$bandTxt ($names) แต่เข้าฝึกได้ ${jsRound(sd.toDouble() / sp * 100).toLong()}% (เกณฑ์ 75%) ผลจึงยังไม่นับว่าแผนผิดปกติ"
            return s
        }
        s.level = lvl
        s.text = "$head — ต่ำกว่า$bandTxt ($names) ทั้งที่เข้าฝึก ${if (sp != 0) jsRound(sd.toDouble() / sp * 100).toLong() else 0}%"
        return s
    }

    private fun dataIssues(t: TrackData, ev: PgEval): List<PgIssue> {
        val tg = Tracking.targetsOf(t)
        val adh = ev.adh
        val out = mutableListOf<PgIssue>()
        if (adh.days >= 7) {
            val perWeek = ev.wpts.size / ((daysBetween(ev.ws, ev.asOf) + 1) / 7.0)
            if (perWeek < 3) out += PgIssue("warn", "ชั่งน้ำหนักเฉลี่ย ${fmt1(perWeek)} ครั้ง/สัปดาห์ — ควรชั่ง 3-7 ครั้ง/สัปดาห์ในช่วงเวลาเดิม ระบบจึงแยกแนวโน้มจริงออกจากน้ำในร่างกายได้")
            if (adh.kcal.size < adh.days) out += PgIssue(if (adh.kcalCover < 0.7) "warn" else "info", "ไม่ได้กรอกแคลอรี่ ${adh.days - adh.kcal.size} จาก ${adh.days} วัน")
            if (adh.sleep.size < adh.days * 0.7) out += PgIssue("info", "บันทึกการนอนแค่ ${adh.sleep.size} จาก ${adh.days} วัน")
        }
        for (i in 1 until ev.wpts.size) {
            val a = ev.wpts[i - 1]; val b = ev.wpts[i]
            val jump = b.y - a.y
            if (b.x - a.x <= 3 && abs(jump) >= max(2.0, b.y * 0.025)) {
                out += PgIssue("warn", "น้ำหนักกระโดด ${if (jump > 0) "+" else "−"}${fmt1(abs(jump))} กก. ใน ${b.x - a.x} วัน (${shortDateTH(a.date)} → ${shortDateTH(b.date)}) — พิมพ์ผิด หรือชั่งคนละเวลา/คนละเครื่อง?")
            }
        }
        if (adh.kcal.size >= 5) {
            val cnt = LinkedHashMap<Double, Int>()
            var top: Double? = null
            adh.kcal.forEach { v ->
                cnt[v] = (cnt[v] ?: 0) + 1
                if (top == null || cnt.getValue(v) > cnt.getValue(top!!)) top = v
            }
            val nearTarget = if (tg.kcal != null) adh.kcal.count { abs(it - tg.kcal) <= 5 } else 0
            val topN = cnt.getValue(top!!)
            if (topN.toDouble() / adh.kcal.size >= 0.6)
                out += PgIssue("warn", "แคลอรี่ ${loc(top!!)} kcal ซ้ำกัน $topN จาก ${adh.kcal.size} วัน — ถ้าเป็นตัวเลขที่กะไว้หรือกรอกตามเป้า ระบบจะประเมินคลาดเคลื่อน")
            else if (nearTarget.toDouble() / adh.kcal.size >= 0.5)
                out += PgIssue("warn", "แคลอรี่ที่กรอกตรงกับเป้าพอดี $nearTarget จาก ${adh.kcal.size} วัน — เป็นยอดที่กินจริงหรือกรอกตามเป้า?")
        }
        if (adh.macroMismatch >= 2) out += PgIssue("warn", "${adh.macroMismatch} วันที่แคลอรี่ไม่ตรงกับโปรตีน/คาร์บ/ไขมันที่กรอก (ต่างกันเกิน 15%) — อาจลืมกรอกบางรายการ")
        if (adh.lowKcal != 0) out += PgIssue("warn", "${adh.lowKcal} วันที่แคลอรี่ต่ำผิดปกติ (ต่ำกว่า 60% ของเป้าหรือ 800 kcal) — ลืมกรอกบางมื้อหรือไม่?")
        if (adh.sessNoData != 0) out += PgIssue("info", "ติ๊กว่าเล่นครบ ${adh.sessNoData} วันแต่ไม่ได้บันทึกน้ำหนัก/ครั้งต่อเซ็ต — ระบบประเมินความแข็งแรงจากวันนั้นไม่ได้")
        return out
    }

    data class StressSummary(val flag: Boolean, val avg: Double, val high: Int, val n: Int, val rising: Boolean, val text: String)

    fun stressSummary(ev: PgEval): StressSummary? {
        val adh = ev.adh
        val log = adh.stressLog
        if (log.isEmpty()) return null
        val avgS = mean(adh.stress)!!
        val high = adh.stressHigh.size
        val cut = addDays(ev.asOf, -7)
        val recent = log.filter { it.date >= cut }.map { it.level }
        val before = log.filter { it.date < cut }.map { it.level }
        val rising = recent.size >= 3 && before.size >= 3 && mean(recent)!! - mean(before)!! >= 1 && mean(recent)!! >= 3
        val heavy = avgS >= 3.5 || high >= max(3, ceil(log.size * 0.3).toInt())
        val flag = log.size >= 3 && (heavy || rising)
        val notes = adh.stressHigh.filter { it.note.isNotEmpty() }.takeLast(3).map {
            "“" + (if (it.note.length > 40) it.note.substring(0, 40) + "…" else it.note) + "”"
        }
        val text = (if (flag) (if (heavy) "ความเครียดสูง: " else "ความเครียดเพิ่มขึ้น: ") else "ความเครียด: ") +
            "เฉลี่ย ${fmt1(avgS)}/5 · เครียดมาก (4-5) $high จาก ${log.size} วันที่บันทึก" +
            (if (rising) " · 7 วันล่าสุดสูงขึ้นจาก ${fmt1(mean(before)!!)} เป็น ${fmt1(mean(recent)!!)}" else "") +
            (if (notes.isNotEmpty()) " (สาเหตุที่บันทึก: ${notes.joinToString(", ")})" else "")
        return StressSummary(flag, avgS, high, log.size, rising, text)
    }

    private fun causes(t: TrackData, ev: PgEval): List<String> {
        val tg = Tracking.targetsOf(t)
        val adh = ev.adh
        val out = mutableListOf<String>()
        val sl = mean(adh.sleep); val pr = mean(adh.prot)
        if (sl != null && tg.sleepH != null && sl < tg.sleepH - 0.5) out += "นอนเฉลี่ย ${fmt1(sl)} ชม. (เป้า ${fmt1(tg.sleepH)}) — นอนน้อยทำให้ฟื้นตัวช้าและน้ำหนักแกว่ง"
        if (pr != null && tg.proteinG != null && tg.proteinG != 0 && pr < tg.proteinG * 0.9)
            out += "โปรตีนเฉลี่ย ${jsRound(pr).toLong()} g (${jsRound(pr / tg.proteinG * 100).toLong()}% ของเป้า) — ไม่พอต่อการรักษา/สร้างกล้ามเนื้อ"
        if (adh.injuries != 0) out += "มีอาการเข้าข่ายบาดเจ็บที่บันทึกไว้ ${adh.injuries} ครั้งในช่วงนี้"
        stressSummary(ev)?.takeIf { it.flag }?.let { out += it.text + " — ความเครียดสะสมทำให้นอนแย่ ฟื้นตัวช้า อยากอาหารมากขึ้น และน้ำหนักแกว่งจากการคั่งน้ำ" }
        if (t.program.goal == "ลดไขมัน" && ev.strength.level != PgLevel.OK && ev.strength.level != PgLevel.NA)
            out += "อยู่ในช่วงกินขาด ความแข็งแรงเพิ่มช้าลงได้ แต่ไม่ควรลดลงต่อเนื่อง"
        return out
    }

    fun context(t: TrackData, today: String): PgContext =
        PgContext(lifts(t.program).associate { it.id to Tracking.exerciseHistory(t, it.id) }, Tracking.weightSeries(t), anchorKg(t, today))

    fun evaluate(t: TrackData, asOf: String, ctx: PgContext, today: String): PgEval {
        val p = t.program
        val anchor = anchorDate(p, today)
        val refKg = ctx.anchorKg?.kg ?: (p.startWeight?.takeIf { it != 0.0 } ?: 70.0)
        var ws = addDays(asOf, -PG_WINDOW)
        if (ws < anchor) ws = anchor
        val adh = adherence(t, ws, addDays(asOf, -1))
        val wpts = ctx.series.filter { it.date >= ws && it.date <= asOf }.map { WPoint(daysBetween(ws, it.date), it.kg, it.date) }
        val span = if (wpts.size > 1) wpts.last().x - wpts.first().x else 0
        val reg = if (wpts.size >= 4 && span >= 10) linreg(wpts.map { it.x.toDouble() to it.y }) else null
        val ev = PgEval(asOf, anchor, daysBetween(anchor, asOf), ws, refKg, weightPlan(t, refKg), adh, wpts, reg)
        ev.weight = weightSignal(t, ev)
        ev.energy = energySignal(t, ev)
        ev.strength = strengthSignal(t, ev, ctx)
        ev.level = worse(worse(ev.weight.level, ev.strength.level), if (ev.energy.level == PgLevel.OK) PgLevel.NA else ev.energy.level)
        if (ev.level == PgLevel.OK && ev.weight.why == "follow" && (p.goal == "ลดไขมัน" || p.goal == "เพิ่มกล้ามเนื้อ")) ev.level = PgLevel.NA
        ev.issues = dataIssues(t, ev)
        ev.causes = causes(t, ev)
        return ev
    }

    private fun history(t: TrackData, ctx: PgContext, today: String): List<PgWeek> {
        val anchor = anchorDate(t.program, today)
        val weeks = Math.floorDiv(daysBetween(anchor, today), 7)
        val out = mutableListOf<PgWeek>()
        for (k in max(1, weeks - 7)..weeks) {
            val d = addDays(anchor, 7 * k)
            out += PgWeek(k, d, evaluate(t, d, ctx, today).level)
        }
        return out
    }

    fun current(t: TrackData, today: String): PgEval {
        val ctx = context(t, today)
        val pg = pg(t.program)
        val ev = evaluate(t, today, ctx, today)
        ev.ctx = ctx
        ev.history = history(t, ctx, today).filter { it.date < today }
        var run = 0
        for (i in ev.history.indices.reversed()) { if (ev.history[i].level.n >= 2) run++ else break }
        ev.run = run
        if (ev.level == PgLevel.WATCH && ev.run >= 3) { ev.level = PgLevel.ANOMALY; ev.persisted = true }
        val ca = pg.confirmedAt
        ev.confirmed = ca != null && ca >= ev.anchor && daysBetween(ca, today) <= 28
        if (ev.level == PgLevel.ANOMALY && ev.confirmed) ev.level = PgLevel.ADJUST
        return ev
    }

    private fun off(s: PgSignal) = s.level == PgLevel.WATCH || s.level == PgLevel.ANOMALY

    fun recommend(t: TrackData, ev: PgEval): PgRecommendation {
        val tg = Tracking.targetsOf(t)
        val en = ev.energy
        val text = mutableListOf<String>()
        var kcal: Int? = null; var floorV: Int? = null; var want: Int? = null; var belowFloor = false; var capped = false; var tdee: Int? = null
        val implied = en.implied
        if ((off(ev.weight) || off(en)) && implied != null && tg.kcal != null) {
            val w = implied + ev.plan.c * FAT_KCAL_PER_KG / 7
            val fl = if (sex(t) == "ชาย") 1500 else 1200
            val k = max(fl.toDouble(), jsRound(min(tg.kcal + 300.0, max(tg.kcal - 300.0, w)) / 10) * 10).toInt()
            floorV = fl; want = jsRound(w).toInt(); belowFloor = w < fl
            if (abs(k - tg.kcal) >= 50) {
                kcal = k; capped = abs(w - k) > 10
                tdee = jsRound(implied - en.exAct!!).toInt()
            }
            if (belowFloor) text += "แคลอรี่ที่ต้องใช้เพื่อให้ได้ตามกรอบต่ำกว่าขั้นต่ำที่ปลอดภัย (${fmtKcal(fl)} kcal) — ระบบจะไม่ตั้งเป้าต่ำกว่านั้น ให้เพิ่มการเคลื่อนไหว/cardio แทน หรือยอมให้ลดช้าลง และถ้าลดได้น้อยมากต่อเนื่องควรปรึกษาแพทย์"
        }
        if (off(ev.strength)) {
            text += "ลดภาระ 1 สัปดาห์ (deload): ใช้น้ำหนักเดิมแต่ลดจำนวนเซ็ตลงครึ่งหนึ่ง แล้วกลับมาเล่นตามแผน"
            text += "ท่าที่ตันต่อเนื่อง: เปลี่ยนช่วงจำนวนครั้ง หรือเปลี่ยนเป็นท่าใกล้เคียงได้ที่หน้า “แผนของฉัน”"
            if (t.program.goal == "ลดไขมัน") text += "ถ้าแรงตกต่อเนื่องระหว่างลดไขมัน ลดการกินขาดลง 100-200 kcal/วัน"
        }
        ev.causes.forEach { text += "แก้ปัจจัยนี้ก่อน: $it" }
        if (stressSummary(ev)?.flag == true) text += "จัดการความเครียดควบคู่ไปด้วย: นอนให้ถึงเป้า เดินเบา ๆ หรือยืดเหยียด 10-20 นาที วันที่เครียดมากให้ฝึกตามแผนโดยไม่เพิ่มน้ำหนัก — ถ้าเครียดมากต่อเนื่องหลายสัปดาห์ควรคุยกับผู้เชี่ยวชาญ (สายด่วนสุขภาพจิต 1323)"
        return PgRecommendation(kcal, text, floorV, want, belowFloor, capped, tdee)
    }

    /* ---------- ข้อความสรุปที่หน้า "ความคืบหน้า" ---------- */
    private val SUMMARY = mapOf(
        PgLevel.NA to "ระบบจะเริ่มประเมินเองเมื่อข้อมูลพอ — ชั่งน้ำหนักอย่างน้อย 4 ครั้ง และบันทึกการกิน/การฝึกต่อเนื่องราว 2 สัปดาห์",
        PgLevel.OK to "ผลลัพธ์จริงเป็นไปตามกรอบของแผน — ทำแบบนี้ต่อไป",
        PgLevel.WATCH to "เริ่มเห็นสัญญาณว่าผลอาจไม่ตรงกรอบ ยังไม่ต้องเปลี่ยนอะไร ระบบติดตามต่อให้ทุกวัน",
        PgLevel.ANOMALY to "คุณทำตามแผนแล้ว แต่ผลลัพธ์ไม่เป็นไปตามกรอบ — ก่อนปรับแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง",
        PgLevel.ADJUST to "คุณยืนยันแล้วว่าข้อมูลถูกต้อง แต่ผลยังไม่เป็นไปตามกรอบ — ระบบแนะนำให้ปรับแผนตามด้านล่าง",
    )

    fun summaryText(ev: PgEval): String {
        if (ev.level == PgLevel.NA && ev.signals.any { it.why == "follow" })
            return "ช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ ระบบจึงยังตัดสินไม่ได้ว่าแผนให้ผลตามกรอบหรือไม่ — ทำตามแผนต่อเนื่องแล้วระบบจะประเมินให้เอง"
        if (ev.level == PgLevel.ANOMALY && ev.persisted)
            return "ผลหลุดกรอบเล็กน้อยติดต่อกันหลายสัปดาห์และไม่กลับเข้ากรอบเอง — ก่อนปรับแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง"
        if (ev.level == PgLevel.ANOMALY && ev.energy.level == PgLevel.ANOMALY && ev.weight.level != PgLevel.ANOMALY && ev.strength.level != PgLevel.ANOMALY)
            return "การกินที่บันทึกไม่สอดคล้องกับน้ำหนักที่เปลี่ยนจริง — ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้องจริง"
        fun name(x: PgSignal) = if (x.key == "weight") "น้ำหนัก" else "ความแข็งแรง"
        val off = listOf(ev.weight, ev.strength).filter { it.why == "follow" }.map { name(it) }
        if (off.isEmpty() || ev.level == PgLevel.NA) return SUMMARY.getValue(ev.level)
        val offTxt = off.joinToString("และ") + "ยังประเมินไม่ได้ เพราะช่วงนี้ทำตามแผนไม่ถึงเกณฑ์ (ผลที่ไม่ตรงกรอบจึงยังไม่นับว่าแผนผิดปกติ)"
        if (ev.level == PgLevel.OK) return listOf(ev.weight, ev.strength).filter { it.level == PgLevel.OK }.joinToString("และ") { name(it) } + "เป็นไปตามกรอบของแผน · " + offTxt
        return SUMMARY.getValue(ev.level) + " · ส่วน" + offTxt
    }

    fun goalLine(t: TrackData, plan: PgPlan): String {
        val sb = strengthBand(t)
        val sbt = "${if (sb[0] > 0) "+" else ""}${jsNum(sb[0])} ถึง +${jsNum(sb[1])}%"
        val steady = "${rate(plan.lo)} ถึง ${rate(plan.hi)} กก./สัปดาห์"
        return when (t.program.goal) {
            "ลดไขมัน" -> {
                val perDay = -plan.c * FAT_KCAL_PER_KG / 7
                "น้ำหนักควร" + (if (plan.hi < 0) "ลด ${jsToFixed(abs(plan.hi), 2)}–${jsToFixed(abs(plan.lo), 2)} กก./สัปดาห์" else "เปลี่ยน $steady") +
                    (if (perDay > 0) " (ไขมันลด ~1 กก. ทุก ${jsRound(FAT_KCAL_PER_KG / perDay).toLong()} วัน)" else "") +
                    " และความแข็งแรงคงที่หรือเพิ่มขึ้น ($sbt ต่อ 4 สัปดาห์)"
            }
            "เพิ่มกล้ามเนื้อ" -> "น้ำหนักควรเพิ่ม ${jsToFixed(plan.lo, 2)}–${jsToFixed(plan.hi, 2)} กก./สัปดาห์ และความแข็งแรงเพิ่ม $sbt ต่อ 4 สัปดาห์"
            else -> "น้ำหนักควรค่อนข้างคงที่ ($steady) ขณะที่ความแข็งแรงเพิ่ม $sbt ต่อ 4 สัปดาห์"
        }
    }

    fun nowKg(ev: PgEval): NowKg? {
        ev.reg?.let { return NowKg(it.a + it.b * daysBetween(ev.ws, ev.asOf), "ค่าบนเส้นแนวโน้ม") }
        val ctx = ev.ctx ?: return null
        val s = ctx.series.filter { it.date <= ev.asOf }
        if (s.isNotEmpty()) return NowKg(s.last().kg, "ชั่งล่าสุด ${shortDateTH(s.last().date)}")
        return ctx.anchorKg?.let { NowKg(it.kg, "น้ำหนักตั้งต้น") }
    }

    fun eta(t: TrackData, ev: PgEval, today: String): PgEta? {
        val g = Tracking.targetsOf(t).goalWeight ?: return null
        val now = nowKg(ev) ?: return null
        val plan = ev.plan
        val need = g - now.kg
        if (abs(need) < 0.3) return PgEta(g, done = true)
        val goal = t.program.goal
        if ((goal != "ลดไขมัน" && goal != "เพิ่มกล้ามเนื้อ") || need * plan.c <= 0 || abs(plan.c) < 0.02) return PgEta(g, mismatch = true)
        val fastRate = if (need < 0) plan.lo else plan.hi
        val slowRate = if (need < 0) plan.hi else plan.lo
        val weeks = need / plan.c
        return PgEta(g, weeks = weeks, date = addDays(today, jsRound(weeks * 7).toInt()), fast = need / fastRate, slow = if (slowRate * need > 0) need / slowRate else null)
    }
}
