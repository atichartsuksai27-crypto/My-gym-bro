package com.gymbrodaily.nativeapp.domain

import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/* ============================================================
   จัดเซสชันลงวัน: กล้ามเนื้อกลุ่มเดียวกันต้องไม่โดนในวันติดกัน — พอร์ตจาก app.js
   (sessionGroups, adjacentPairs, bestSchedule, freeTrainDays, minTrainDays, planTrainDays ฯลฯ)
   กลุ่มหลักของแต่ละท่า (core/oblique ฟื้นตัวเร็ว ไม่นับ) — 2 เซสชันที่มีกลุ่มหลักร่วมกัน "ชนกัน" ห้ามอยู่วันติดกัน (ต้องพัก ~48 ชม.)
   ส่วนกลุ่มรองใช้แค่จัดลำดับให้ซ้อนกันน้อยที่สุด วันติดกันนับข้ามสัปดาห์ด้วย (อาทิตย์ → จันทร์)
   ผลต้องตรงกับ JS ทุกกรณี (GeneratorGoldenTest เทียบ golden/generator.json)
   ============================================================ */

/** เซสชันในมุมมองของตัวจัดตาราง: ชื่อ + รูปแบบท่า (base ไม่ซ้ำ) — ใช้ได้ทั้ง SessionDef ของแบบ และ PlanSession ของโปรแกรมที่ใช้อยู่ */
data class SchedSession(val key: String, val bases: List<String>)

data class SchedClash(val from: String, val to: String, val groups: List<String>)
data class SchedResult(val list: List<DaySession>, val hard: Int, val soft: Int, val clash: SchedClash?)

object Schedule {
    val PATTERN_GROUP = mapOf(
        "hpush" to "chest", "incline" to "chest", "chestfly" to "chest", "vpush" to "shoulders", "latraise" to "shoulders", "reardelt" to "reardelt",
        "hpull" to "back", "vpull" to "back", "biceps" to "biceps", "triceps" to "triceps",
        "squat" to "legs", "lunge" to "legs", "hinge" to "legs", "glute" to "legs", "legcurl" to "legs", "calf" to "legs",
    )
    val PATTERN_GROUP2 = mapOf(
        "hpush" to listOf("triceps", "shoulders"), "incline" to listOf("shoulders", "triceps"), "vpush" to listOf("triceps"),
        "hpull" to listOf("biceps", "reardelt"), "vpull" to listOf("biceps"),
    )
    val GROUP_LABEL = mapOf(
        "chest" to "อก", "shoulders" to "ไหล่", "reardelt" to "ไหล่หลัง", "back" to "หลัง", "biceps" to "ต้นแขนหน้า", "triceps" to "ต้นแขนหลัง", "legs" to "ขา",
    )

    fun slotBase(slot: String) = slot.split("@")[0]

    fun of(se: SessionDef) = SchedSession(se.key, se.patterns.map { slotBase(it) }.distinct())
    fun of(se: PlanSession) = SchedSession(se.key, se.exercises.map { it.pattern }.distinct())
    fun ofSplit(splitKey: String) = Catalog.SPLIT_DEFS.getValue(splitKey).sessions.map { of(it) }

    fun sessionGroups(se: SchedSession, withSecondary: Boolean): List<String> {
        val out = mutableListOf<String>()
        se.bases.forEach { p ->
            (listOf(PATTERN_GROUP[p]) + (if (withSecondary) (PATTERN_GROUP2[p] ?: emptyList()) else emptyList())).forEach { g ->
                if (g != null && g !in out) out += g
            }
        }
        return out
    }

    private fun shared(a: List<String>, b: List<String>) = a.filter { it in b }
    fun weekOrder(days: List<String>?): List<String> = Catalog.DAYS.filter { it in (days ?: emptyList()) }

    /** คู่วันฝึกที่ติดกัน (ตำแหน่งในรายการเรียงตามสัปดาห์) รวมอาทิตย์ → จันทร์ */
    fun adjacentPairs(sorted: List<String>): List<Pair<Int, Int>> {
        val idx = sorted.map { Catalog.DAYS.indexOf(it) }
        val out = mutableListOf<Pair<Int, Int>>()
        idx.forEachIndexed { k, x -> val j = idx.indexOf((x + 1) % 7); if (j > -1 && j != k) out += k to j }
        return out
    }

    private val schedCache = HashMap<String, SchedResult>()

    /** หาการจัดเซสชันที่ดีที่สุด: ชนกันน้อยสุด → กลุ่มรองซ้อนน้อยสุด → ใกล้ลำดับ A,B,C เดิมที่สุด
     *  แต่ละเซสชันถูกใช้เท่า ๆ กัน (ต่างกันไม่เกิน 1 ครั้ง) ถ้าวันน้อยกว่าจำนวนเซสชันใช้เซสชันแรก ๆ ตามลำดับ */
    fun bestSchedule(sessions: List<SchedSession>, days: List<String>?): SchedResult {
        val sorted = weekOrder(days)
        val n = sorted.size
        val cand = sessions.take(min(n, sessions.size))
        val m = cand.size
        if (n == 0 || m == 0) return SchedResult(emptyList(), 0, 0, null)
        val p = cand.map { sessionGroups(it, false) }
        val a = cand.map { sessionGroups(it, true) }
        val ck = cand.indices.joinToString("|") { i -> "${cand[i].key}:${p[i].joinToString(",")}/${a[i].joinToString(",")}" } + "#" + sorted.joinToString(",")
        schedCache[ck]?.let { return it }
        val back = sorted.map { mutableListOf<Int>() }
        adjacentPairs(sorted).forEach { pr -> back[max(pr.first, pr.second)].add(min(pr.first, pr.second)) }
        val lo = floor(n.toDouble() / m).toInt()
        val hi = ceil(n.toDouble() / m).toInt()
        val cnt = IntArray(m)
        val cur = IntArray(n)
        var bestHard = 0
        var bestSoft = 0
        var bestDiff = 0
        var bestPick: IntArray? = null
        fun worse(h: Int, s: Int, d: Int) = bestPick != null && (h > bestHard || (h == bestHard && (s > bestSoft || (s == bestSoft && d >= bestDiff))))
        fun rec(pos: Int, h: Int, s: Int, d: Int) {
            if (worse(h, s, d)) return
            if (pos == n) {
                if (cnt.all { it >= lo }) { bestHard = h; bestSoft = s; bestDiff = d; bestPick = cur.copyOf() }
                return
            }
            for (i in 0 until m) {
                if (cnt[i] >= hi) continue
                var dh = 0
                var ds = 0
                back[pos].forEach { q -> dh += if (shared(p[cur[q]], p[i]).isNotEmpty()) 1 else 0; ds += shared(a[cur[q]], a[i]).size }
                cur[pos] = i; cnt[i]++
                rec(pos + 1, h + dh, s + ds, d + (if (i == pos % m) 0 else 1))
                cnt[i]--
            }
        }
        rec(0, 0, 0, 0)
        val pick = bestPick ?: return SchedResult(emptyList(), 0, 0, null)
        val list = sorted.mapIndexed { k, d -> DaySession(d, cand[pick[k]].key) }
        var clash: SchedClash? = null
        for (pr in adjacentPairs(sorted)) {
            val g = shared(p[pick[pr.first]], p[pick[pr.second]])
            if (g.isNotEmpty()) { clash = SchedClash(sorted[pr.first], sorted[pr.second], g); break }
        }
        return SchedResult(list, bestHard, bestSoft, clash).also { schedCache[ck] = it }
    }

    fun assignSessions(splitKey: String, days: List<String>): List<DaySession> = bestSchedule(ofSplit(splitKey), days).list

    fun clashText(c: SchedClash) = c.groups.joinToString("/") { GROUP_LABEL[it] ?: it } + "ถูกฝึกในวันติดกัน (${c.from} → ${c.to})"

    private val freeCache = HashMap<String, List<String>>()

    /** ชุดวันฝึกที่มากที่สุดจากวันว่างที่ไม่มีวันติดกันชนกัน — เท่ากันให้เลือกแบบที่ซ้อนกลุ่มรองน้อย และเว้นระยะห่างมากกว่า */
    fun freeTrainDays(sessions: List<SchedSession>, avail: List<String>?): List<String> {
        val days = weekOrder(avail)
        val ck = sessions.joinToString("|") { it.key } + "#" + days.joinToString(",")
        freeCache[ck]?.let { return it }
        var best: Pair<List<Int>, List<String>>? = null
        for (mask in 1 until (1 shl days.size)) {
            val pick = days.filterIndexed { i, _ -> mask and (1 shl i) != 0 }
            val r = bestSchedule(sessions, pick)
            if (r.hard != 0) continue
            val sc = listOf(pick.size, -r.soft, -adjacentPairs(pick).size)
            val b = best
            if (b == null || sc[0] > b.first[0] || (sc[0] == b.first[0] && (sc[1] > b.first[1] || (sc[1] == b.first[1] && sc[2] > b.first[2])))) best = sc to pick
        }
        return (best?.second ?: emptyList()).also { freeCache[ck] = it }
    }

    /** วันว่าง (Q2) = วันที่ "เลือกได้" เท่านั้น วันฝึก/วัน cardio จริงเลือกแยกในหน้าตรวจแผน */
    fun minTrainDays(splitKey: String, avail: List<String>): Int {
        val base = if (splitKey == "fullbody") min(2, avail.size) else Catalog.SPLIT_DEFS.getValue(splitKey).minDays
        return min(base, freeTrainDays(ofSplit(splitKey), avail).size)
    }

    fun inAvailable(days: List<String>?, avail: List<String>): List<String> =
        Catalog.DAYS.filter { it in avail && it in (days ?: emptyList()) }
}
