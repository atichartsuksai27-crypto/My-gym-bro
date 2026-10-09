package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.Serializable
import java.time.LocalDate
import kotlin.math.abs
import kotlin.math.min

/* ============================================================
   การติดตามผลรายวัน — พอร์ตจาก app.js (sessionKeyFor, dayItems, dayStatus, streakOf,
   weeklyAdherence, exerciseHistory, bodyweightAsOf, milestonesOf ฯลฯ)
   ทุกฟังก์ชันรับ "วันนี้" เป็นพารามิเตอร์แทนการอ่านนาฬิกาเอง เพื่อให้เทสต์ได้
   ผลต้องตรงกับ JS ทุกกรณี (ตรวจด้วย GoldenParityTest.trackingMatchesJs)
   ============================================================ */

/** shape เดียวกับ track.program ของเว็บ (programs.payload) */
@Serializable
data class Program(
    val splitKey: String = "",
    val splitLabel: String = "",
    val goal: String? = null,
    val days: List<String> = emptyList(),
    val dayToSession: Map<String, String> = emptyMap(),
    val sessions: List<PlanSession> = emptyList(),
    val minutesEstimate: String? = null,
    val trainTime: String? = null,
    val targets: Targets? = null,
    val startWeight: Double? = null,
    val startDate: String? = null,
    val planId: String? = null,
    val createdAt: String? = null,
)

@Serializable
data class SetEntry(val weight: Double? = null, val reps: Double? = null)

@Serializable
data class ExerciseLog(val sets: List<SetEntry?> = emptyList(), val done: Boolean = false)

@Serializable
data class Nutrition(
    val proteinG: Double? = null,
    val kcal: Double? = null,
    val waterL: Double? = null,
    val meals: List<Boolean?> = emptyList(),
    val carbG: Double? = null,
    val fatG: Double? = null,
)

@Serializable
data class Sleep(val hours: Double? = null, val hygiene: Boolean = false)

/** shape เดียวกับ track.logs[iso] ของเว็บ (daily_logs.payload) */
@Serializable
data class DailyLog(
    val date: String,
    val sessionKey: String? = null,
    val planId: String? = null,
    val exercises: Map<String, ExerciseLog> = emptyMap(),
    val completed: Boolean = false,
    val nutrition: Nutrition = Nutrition(),
    val sleep: Sleep = Sleep(),
    val updatedAt: String? = null,
)

data class DayItem(val group: String, val key: String, val done: Boolean)
data class DayCounts(val done: Int, val total: Int)
data class WeekAdherence(val start: String, val planned: Int, val done: Int, val pct: Int?)
data class WeightPoint(val date: String, val kg: Double)
data class HistoryEntry(val date: String, val weight: Double, val reps: Double?, val e1rm: Double, val volume: Long)
data class Milestone(val title: String, val on: Boolean, val sub: String)

enum class DayStatus(val key: String) {
    BEFORE("before"), FUTURE("future"), REST_FUTURE("rest-future"), REST("rest"), REST_DONE("rest-done"),
    DONE("done"), PARTIAL("partial"), PENDING("pending"),
}

/** ข้อมูลติดตามผลทั้งหมดของผู้ใช้ ณ ขณะหนึ่ง (เทียบเท่า track ใน app.js) */
data class TrackData(
    val program: Program,
    val logs: Map<String, DailyLog> = emptyMap(),
    val weights: Map<String, Double> = emptyMap(),
    val answers: Answers = Answers(),
)

object Tracking {

    fun iso(d: LocalDate): String = d.toString()

    /** วันในสัปดาห์แบบไทยของวันที่ ISO (จันทร์ = ตัวแรก) */
    fun thaiWeekday(iso: String): String = Catalog.DAYS[LocalDate.parse(iso).dayOfWeek.value - 1]

    fun startOfWeek(d: LocalDate): LocalDate = d.minusDays((d.dayOfWeek.value - 1).toLong())

    fun sessionKeyFor(p: Program, iso: String): String? {
        val wd = thaiWeekday(iso)
        if (wd !in p.days) return null
        return p.dayToSession[wd]?.takeIf { it.isNotEmpty() }
    }

    fun sessionDefFor(p: Program, key: String?): PlanSession? =
        if (key.isNullOrEmpty()) null else p.sessions.firstOrNull { it.key == key }

    fun targetsOf(t: TrackData): Targets = t.program.targets ?: Generator.computeTargets(t.answers)

    fun kcalOk(v: Double?, target: Int?): Boolean =
        v != null && target != null && v >= target * 0.9 && v <= target * 1.1

    fun proteinOk(n: Nutrition, t: Targets) = n.proteinG != null && n.proteinG >= (t.proteinG ?: 0) * 0.9
    fun waterOk(n: Nutrition, t: Targets) = n.waterL != null && n.waterL >= (t.waterL ?: 0.0)

    /** คาร์บ/ไขมัน: ผ่านเมื่ออยู่ในช่วง ±10% ของเป้า (บันทึกเพื่อติดตาม ไม่นับในคะแนนรวม — เหมือน sectionFood ของเว็บ) */
    fun macroOk(v: Double?, target: Int?) = v != null && target != null && v >= target * 0.9 && v <= target * 1.1

    fun sleepHoursValid(h: Double?) = h != null && h.isFinite() && h >= 0 && h <= 24
    fun sleepOk(s: Sleep, t: Targets) = sleepHoursValid(s.hours) && t.sleepH != null && s.hours!! >= t.sleepH - 0.5

    fun dayItems(t: TrackData, iso: String): List<DayItem> {
        val targets = targetsOf(t)
        val log = t.logs[iso]
        val items = mutableListOf<DayItem>()
        sessionDefFor(t.program, sessionKeyFor(t.program, iso))?.exercises?.forEach { ex ->
            items += DayItem("workout", "ex-" + ex.id, log?.exercises?.get(ex.id)?.done == true)
        }
        val n = log?.nutrition ?: Nutrition()
        items += DayItem("food", "protein", proteinOk(n, targets))
        items += DayItem("food", "kcal", kcalOk(n.kcal, targets.kcal))
        items += DayItem("food", "water", waterOk(n, targets))
        for (i in 0 until targets.meals) items += DayItem("food", "meal$i", n.meals.getOrNull(i) == true)
        val sl = log?.sleep ?: Sleep()
        items += DayItem("sleep", "hours", sleepOk(sl, targets))
        if (targets.sleepHygiene) items += DayItem("sleep", "hygiene", sl.hygiene)
        items += DayItem("body", "weight", t.weights[iso] != null)
        return items
    }

    fun dayCounts(t: TrackData, iso: String): DayCounts {
        val items = dayItems(t, iso)
        return DayCounts(items.count { it.done }, items.size)
    }

    fun dayStatus(t: TrackData, iso: String, today: String): DayStatus {
        val sKey = sessionKeyFor(t.program, iso)
        if (iso < (t.program.startDate?.takeIf { it.isNotEmpty() } ?: today)) return DayStatus.BEFORE
        if (iso > today) return if (sKey != null) DayStatus.FUTURE else DayStatus.REST_FUTURE
        val log = t.logs[iso]
        if (sKey == null) {
            if (log == null) return DayStatus.REST
            val c = dayCounts(t, iso)
            return if (c.done >= c.total) DayStatus.REST_DONE else DayStatus.REST
        }
        if (log != null && log.completed) return DayStatus.DONE
        if (log != null) return DayStatus.PARTIAL
        return DayStatus.PENDING
    }

    /** วันฝึกติดกันที่ติ๊กครบ (วันพักนับรวม) — วันนี้ยังไม่ครบไม่ทำให้สตรีคขาด เริ่มนับจากเมื่อวาน */
    fun streakOf(t: TrackData, today: LocalDate): Int {
        val start = t.program.startDate?.takeIf { it.isNotEmpty() } ?: return 0
        var cur = today
        var n = 0
        if (sessionKeyFor(t.program, iso(today)) != null && t.logs[iso(today)]?.completed != true) cur = today.minusDays(1)
        repeat(400) {
            val c = iso(cur)
            if (c < start) return n
            if (sessionKeyFor(t.program, c) != null) {
                if (t.logs[c]?.completed != true) return n
            }
            n++
            cur = cur.minusDays(1)
        }
        return n
    }

    fun weeklyAdherence(t: TrackData, weeks: Int, today: LocalDate): List<WeekAdherence> {
        val start = t.program.startDate ?: ""
        val todayIso = iso(today)
        val thisWeek = startOfWeek(today)
        return (weeks - 1 downTo 0).map { w ->
            val ws = thisWeek.minusDays(7L * w)
            var planned = 0
            var done = 0
            for (i in 0 until 7) {
                val d = iso(ws.plusDays(i.toLong()))
                if (d < start || d > todayIso) continue
                if (sessionKeyFor(t.program, d) == null) continue
                planned++
                if (t.logs[d]?.completed == true) done++
            }
            WeekAdherence(iso(ws), planned, done, if (planned > 0) jsRound(done.toDouble() / planned * 100).toInt() else null)
        }
    }

    fun weightSeries(t: TrackData): List<WeightPoint> =
        t.weights.keys.sorted().map { WeightPoint(it, t.weights.getValue(it)) }

    /** น้ำหนักตัวล่าสุดที่รู้ ณ วันที่ iso ถ้ายังไม่เคยชั่งใช้น้ำหนักตอนเริ่มโปรแกรม */
    fun bodyweightAsOf(t: TrackData, iso: String): Double? =
        t.weights.keys.filter { it <= iso }.maxOrNull()?.let { t.weights[it] } ?: t.program.startWeight

    /** เซ็ตที่ดีที่สุดต่อวันของท่าหนึ่ง เรียงวันเก่า→ใหม่ (e1RM ผ่าน Benchmarks เสมอ) */
    fun exerciseHistory(t: TrackData, exId: String): List<HistoryEntry> =
        t.logs.keys.sorted().mapNotNull { d ->
            val e = t.logs.getValue(d).exercises[exId] ?: return@mapNotNull null
            var best: Triple<Double, Double?, Double>? = null
            var vol = 0.0
            e.sets.forEach { s ->
                s ?: return@forEach
                val w = s.weight ?: return@forEach
                if (w.isNaN() || w <= 0) return@forEach
                if (s.reps != null && !s.reps.isNaN()) vol += w * s.reps
                val e1 = Benchmarks.calculateEstimated1RM(w, s.reps) ?: w
                val cur = best
                if (cur == null || e1 > cur.third) best = Triple(w, s.reps, e1)
            }
            best?.let { HistoryEntry(d, it.first, it.second, jsRound(it.third * 10) / 10, jsRound(vol).toLong()) }
        }

    fun lastBestBefore(t: TrackData, exId: String, iso: String): HistoryEntry? =
        exerciseHistory(t, exId).lastOrNull { it.date < iso }

    fun milestones(t: TrackData, today: LocalDate): List<Milestone> {
        val targets = targetsOf(t)
        val completed = t.logs.values.count { it.completed }
        val weighDays = t.weights.size
        val series = weightSeries(t)
        val first = series.firstOrNull()?.kg ?: t.program.startWeight?.takeIf { it != 0.0 }
        val last = series.lastOrNull()?.kg
        val moved = if (first != null && last != null) abs(last - first) else 0.0
        val st = streakOf(t, today)
        val goal = targets.goalWeight
        val goalHit = goal != null && last != null && first != null && (if (goal < first) last <= goal else last >= goal)
        val list = mutableListOf(
            Milestone("บันทึกเซสชันแรก", completed >= 1, "$completed / 1"),
            Milestone("ทำครบ 10 เซสชัน", completed >= 10, "${min(completed, 10)} / 10"),
            Milestone("สตรีค 7 วัน", st >= 7, "${min(st, 7)} / 7"),
            Milestone("สตรีค 30 วัน", st >= 30, "${min(st, 30)} / 30"),
            Milestone("ชั่งน้ำหนัก 8 วัน", weighDays >= 8, "${min(weighDays, 8)} / 8"),
            Milestone("น้ำหนักขยับจากวันแรก 1 กก.", moved >= 1, fmt1(min(moved, 1.0)) + " / 1.0 กก."),
        )
        if (goal != null) {
            list += Milestone(
                "ถึงน้ำหนักเป้าหมาย " + fmt1(goal) + " กก.", goalHit,
                if (last != null) "ตอนนี้ " + fmt1(last) + " กก." else "ยังไม่ได้ชั่ง",
            )
        }
        return list
    }

    /** fmt1 ของ JS: ปัดทศนิยม 1 ตำแหน่งแล้วแสดง 1 ตำแหน่งเสมอ */
    fun fmt1(n: Double): String {
        val r = jsRound(n * 10) / 10
        return String.format(java.util.Locale.US, "%.1f", r).let { if (it == "-0.0") "0.0" else it }
    }
}
