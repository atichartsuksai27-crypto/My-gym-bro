package com.gymbrodaily.nativeapp.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** การแก้บันทึกรายวันที่ผูกกับ progressive overload — ตรึงพฤติกรรมเดียวกับ event handler ของเว็บ (withPlan / ex-done / feel / revert / complete ...) */
class DayActionsTest {
    private val ex = PlanExercise(pattern = "hpush", id = "bp", th = "Bench Press", tier = 1, equip = "barbell", setsReps = "3 x 8-12")
    private val ex2 = PlanExercise(pattern = "hpull", id = "row", th = "Row", tier = 1, equip = "barbell", setsReps = "3 x 8-12")
    private val sess = PlanSession("A", listOf(ex, ex2))
    private val program = Program(days = listOf("จันทร์", "พฤหัสบดี"), dayToSession = mapOf("จันทร์" to "A", "พฤหัสบดี" to "A"), sessions = listOf(sess))
    private fun sets(w: Double, vararg r: Double) = r.map { SetEntry(w, it) }

    /** ครั้งก่อน 60 กก. ทำครบ 12 ทุกเซ็ต + รู้สึก "ยกเพิ่มได้" → วันนี้ระบบเพิ่มให้ */
    private fun track(prevFeel: String? = "more", extra: Map<String, DailyLog> = emptyMap()): TrackData {
        val prev = DailyLog(
            "2026-10-12", exercises = mapOf("bp" to ExerciseLog(sets = sets(60.0, 12.0, 12.0, 12.0), done = true, feel = prevFeel)),
        )
        return TrackData(program, mapOf("2026-10-12" to prev) + extra)
    }
    private val today = "2026-10-15"

    @Test fun markingDoneWithoutSetsTakesThePlanAndRecordsWhatChanged() {
        val t = track()
        val plan = Progression.progressionPlan(t, ex, today)!!
        assertTrue(Progression.isUpChange(plan))
        val out = DayActions.setDone(t, today, ex, null, true)
        assertTrue(out.done)
        assertEquals(plan.sets, out.sets)
        assertEquals(Progression.progRecord(plan), out.prog)
        assertNotNull(out.prog)
    }

    @Test fun markingDoneWhenAlreadyLoggedKeepsTheirSets() {
        val t = track()
        val mine = ExerciseLog(sets = sets(70.0, 8.0, 8.0, 8.0))
        val out = DayActions.setDone(t, today, ex, mine, true)
        assertEquals(mine.sets, out.sets)
        assertNull(out.prog)
        assertTrue(out.done)
        assertFalse(DayActions.setDone(t, today, ex, out, false).done)
    }

    @Test fun firstEverExerciseHasNoPlanSoNothingIsFilled() {
        val out = DayActions.setDone(TrackData(program), today, ex, null, true)
        assertTrue(out.sets.isEmpty())
        assertNull(out.prog)
    }

    @Test fun feelTakesPlanOnFirstTapAndClearsOnSecond() {
        val t = track()
        val a = DayActions.toggleFeel(t, today, ex, null, "hard")
        assertEquals("hard", a.feel)
        assertTrue(a.sets.isNotEmpty())
        assertNull(DayActions.toggleFeel(t, today, ex, a, "hard").feel)
        assertEquals("ok", DayActions.toggleFeel(t, today, ex, a, "ok").feel)
    }

    @Test fun editingSetsRecordsTheProgOnlyWhenNothingWasLoggedYet() {
        val t = track()
        val plan = Progression.progressionPlan(t, ex, today)!!
        val first = DayActions.writeSets(t, today, ex, null, sets(62.5, 10.0, 10.0, 10.0))
        assertEquals(Progression.progRecord(plan), first.prog)
        val again = DayActions.writeSets(t, today, ex, first.copy(prog = null), sets(65.0, 10.0, 10.0, 10.0))
        assertNull(again.prog)
        assertEquals(65.0, again.sets[0]!!.weight!!, 0.0)
    }

    @Test fun revertGoesBackToBaseAndMarksItReverted() {
        val t = track()
        val plan = Progression.progressionPlan(t, ex, today)!!
        val applied = DayActions.setDone(t, today, ex, null, true)
        val back = DayActions.revert(plan, applied)
        assertEquals(plan.base, back.sets)
        assertTrue(back.prog!!.reverted)
        assertEquals(plan.change!!.kind, back.prog!!.kind)
        val forward = DayActions.reapply(plan, back)
        assertEquals(plan.sets, forward.sets)
        assertFalse(forward.prog!!.reverted)
    }

    @Test fun warmupFlagsPadWithFalse() {
        val a = DayActions.setWarmup(null, 2, true)
        assertEquals(listOf(false, false, true), a.warmup)
        assertEquals(listOf(true, false, true), DayActions.setWarmup(a, 0, true).warmup)
    }

    @Test fun symptomIsClassifiedTrimmedAndCleared() {
        val s = DayActions.saveSymptom(null, "  ปวดเข่าด้านใน  ", "Bench Press").symptom!!
        assertEquals("ปวดเข่าด้านใน", s.text)
        assertEquals("caution", s.level)
        assertEquals("Bench Press", s.name)
        assertNull(DayActions.saveSymptom(ExerciseLog(symptom = s), "   ", "x").symptom)
        assertEquals(200, DayActions.saveSymptom(null, "ก".repeat(300), "x").symptom!!.text.length)
        val withChip = DayActions.symptomWithChip(ExerciseLog(symptom = s), "บวม", "x").symptom!!
        assertEquals("ปวดเข่าด้านใน, บวม", withChip.text)
        assertEquals("injury", withChip.level)
        assertEquals("บวม", DayActions.symptomWithChip(null, "บวม", "x").symptom!!.text)
    }

    @Test fun completingTheSessionFillsOnlyExercisesWithoutSetsAndKeepsDone() {
        val prevRow = ExerciseLog(sets = sets(40.0, 10.0, 10.0, 10.0), done = true, feel = "more")
        val t = track(extra = mapOf("2026-10-13" to DailyLog("2026-10-13", exercises = mapOf("row" to prevRow))))
        val log = DailyLog(today, exercises = mapOf("bp" to ExerciseLog(sets = sets(70.0, 8.0, 8.0, 8.0), done = false)))
        val out = DayActions.completeSession(t, today, sess, log, true)
        assertTrue(out.completed)
        assertEquals(sets(70.0, 8.0, 8.0, 8.0), out.exercises.getValue("bp").sets) // ของที่กรอกแล้วไม่ถูกแตะ
        assertFalse(out.exercises.getValue("bp").done)
        assertTrue(out.exercises.getValue("row").sets.isNotEmpty()) // ท่าที่ยังไม่กรอกใช้ค่าที่ตั้งให้
        assertFalse(out.exercises.getValue("row").done)
        assertFalse(DayActions.completeSession(t, today, sess, out, false).completed)
        assertEquals(out.exercises, DayActions.completeSession(t, today, sess, out, false).exercises)
    }

    @Test fun equipStepSetAndClear() {
        assertEquals(mapOf("bp" to 1.25), DayActions.withEquipStep(emptyMap(), "bp", 1.25))
        assertEquals(emptyMap<String, Double>(), DayActions.withEquipStep(mapOf("bp" to 1.25), "bp", null))
        assertEquals(emptyMap<String, Double>(), DayActions.withEquipStep(mapOf("bp" to 1.25), "bp", 0.0))
    }

    @Test fun stressLevelTogglesNoteIsTrimmedAndChipsAppend() {
        val a = DayActions.setStressLevel(null, 4)
        assertEquals(4.0, a.level!!, 0.0)
        assertNull(DayActions.setStressLevel(a, 4).level)
        assertEquals(5.0, DayActions.setStressLevel(a, 5).level!!, 0.0)
        assertEquals("งานเร่ง", DayActions.setStressNote(a, "  งานเร่ง ").note)
        assertEquals("งาน, เดินทาง", DayActions.stressNoteWithChip(DayActions.stressNoteWithChip(null, "งาน"), "เดินทาง").note)
        assertEquals(4.0, DayActions.setStressNote(a, "x").level!!, 0.0) // แก้สาเหตุไม่ล้างระดับ
    }
}
