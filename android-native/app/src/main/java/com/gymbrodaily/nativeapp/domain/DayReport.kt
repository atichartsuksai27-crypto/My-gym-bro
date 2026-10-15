package com.gymbrodaily.nativeapp.domain

import java.time.LocalDate

/* ============================================================
   ล็อกวัน + รายงานรายวัน — พอร์ตจาก app.js
   (isEditable, dayActivity, dayParts, warmupSummary, dayReport, finalizeLockedDays)
   แก้ได้เฉพาะวันนี้กับเมื่อวาน (ตามเวลาเครื่อง) พ้นเที่ยงคืนของวันถัดไปแล้ววันนั้นถูกล็อกถาวร:
   ระบบจดผลสุดท้าย (final) ไว้ในบันทึกของวัน — ชื่อกิจกรรม รายการเช็คลิสต์ ผล warm-up และพลังงาน —
   เพื่อให้แผนที่เปลี่ยนภายหลังไม่เปลี่ยนความหมายของประวัติ วันที่ไม่มีบันทึกเลยได้ stub ไว้เป็นวันที่ไม่ครบ
   ผลต้องตรงกับ JS ทุกกรณี (TrackingParityTest เทียบ golden/tracking.json)
   ============================================================ */

data class DayReportData(val items: List<FinalItem>, val complete: Boolean, val warmup: WarmupSummary)

object DayReport {
    const val LOCKED_MSG = "วันนี้ถูกล็อกแล้ว — แก้ไขได้เฉพาะวันนี้และเมื่อวานเท่านั้น"

    fun editableFrom(today: String): String = LocalDate.parse(today).minusDays(1).toString()
    fun isEditable(iso: String, today: String) = iso <= today && iso >= editableFrom(today)

    /** ชื่อวัน = สิ่งที่วันนั้นมีจริง (เซสชันตามตาราง / Cardio ตามแผนหรือที่บันทึกเพิ่ม) — ส่วนที่ผ่านวันไปแล้วแต่ไม่สำเร็จติด missed */
    fun dayActivity(t: TrackData, iso: String, today: String): List<DayPart> {
        val p = t.program
        val past = iso < today && iso >= (p.startDate?.takeIf { it.isNotEmpty() } ?: today)
        val sKey = Tracking.sessionKeyFor(p, iso)
        val planned = ProgressGoal.cardioPlannedFor(p, iso)
        val mins = ProgressGoal.cardioMinutesOn(t, iso)
        val parts = mutableListOf<DayPart>()
        if (sKey != null) parts += DayPart(sKey, past && !ProgressGoal.sessionDone(t, p, iso))
        if (planned || mins != null) parts += DayPart("Cardio" + (mins?.let { " ${Progression.n(it)} นาที" } ?: ""), past && planned && mins == null)
        return parts
    }

    /** ชื่อวันที่แสดง: วันที่ล็อกแล้วใช้ snapshot ใน final เพราะแผนปัจจุบันอาจเปลี่ยนไปแล้ว */
    fun dayParts(t: TrackData, iso: String, today: String): List<DayPart> = t.logs[iso]?.final?.parts ?: dayActivity(t, iso, today)

    fun warmupSummary(t: TrackData, iso: String): WarmupSummary {
        val p = t.program
        val sess = Tracking.sessionDefFor(p, Tracking.sessionKeyFor(p, iso))
        val steps = Progression.warmupStepsFor(sess)
        val exData = t.logs[iso]?.exercises ?: emptyMap()
        val byEx = mutableListOf<WarmupByEx>()
        var done = 0
        var total = 0
        sess?.exercises?.forEach { ex ->
            val n = steps[ex.id]?.size ?: 0
            if (n == 0) return@forEach
            val flags = exData[ex.id]?.warmup ?: emptyList()
            val d = (0 until n).count { flags.getOrNull(it) == true }
            byEx += WarmupByEx(ex.th, d, n)
            done += d; total += n
        }
        return WarmupSummary(done, total, byEx)
    }

    fun dayReport(t: TrackData, iso: String): DayReportData {
        val fin = t.logs[iso]?.final
        if (fin?.items != null) return DayReportData(fin.items, fin.complete ?: fin.items.all { it.done }, fin.warmup ?: WarmupSummary())
        val items = Tracking.dayItems(t, iso).map { FinalItem(it.group, it.label, it.v, it.done) }
        return DayReportData(items, items.all { it.done }, warmupSummary(t, iso))
    }

    /**
     * ล็อกทุกวันตั้งแต่วันเริ่มจนก่อนช่วงที่ยังแก้ได้ — คืนเฉพาะบันทึกที่ต้องเขียนใหม่ (วันที่ยังไม่มี final)
     * ผู้เรียกเป็นคนเขียนลงที่เก็บ/ซิงก์ (ไม่แตะ updatedAt เหมือนเว็บ)
     */
    fun finalizeLockedDays(t: TrackData, today: String, nowIso: String): Map<String, DailyLog> {
        val start = t.program.startDate?.takeIf { it.isNotEmpty() } ?: return emptyMap()
        val until = editableFrom(today)
        val out = LinkedHashMap<String, DailyLog>()
        var iso = start
        while (iso < until) {
            val lg = t.logs[iso]
            if (lg?.final == null) {
                val rep = dayReport(t, iso)
                val en = ProgressGoal.dayEnergy(t, iso)
                val base = lg ?: DailyLog(iso, stub = true)
                out[iso] = base.copy(
                    final = DayFinal(
                        at = nowIso, parts = dayActivity(t, iso, today), items = rep.items, complete = rep.complete, warmup = rep.warmup,
                        energy = en?.let { DayEnergy(it.kcal, it.tdee, it.ex) },
                    ),
                )
            }
            iso = LocalDate.parse(iso).plusDays(1).toString()
        }
        return out
    }
}
