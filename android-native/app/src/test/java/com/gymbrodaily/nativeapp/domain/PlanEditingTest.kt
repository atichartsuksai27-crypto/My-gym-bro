package com.gymbrodaily.nativeapp.domain

import org.junit.Assert.assertEquals
import org.junit.Test

/** กรณีขอบที่ golden planedit.json ไม่ครอบ — ค่าที่คาดเทียบกับพฤติกรรม JS (`ex.slot||ex.pattern`) */
class PlanEditingTest {
    private fun ex(pattern: String, slot: String?, intensity: String) =
        PlanExercise(pattern = pattern, id = pattern, th = pattern, slot = slot, intensity = intensity)

    /** JS ใช้ `ex.slot||ex.pattern` จึงข้ามสตริงว่างไปใช้ pattern — `?:` ของ Kotlin ข้ามแค่ null */
    @Test fun seedPlanFallsBackToPatternWhenSlotIsEmpty() {
        val p = Program(
            days = listOf("จันทร์"),
            sessions = listOf(PlanSession("A", listOf(ex("hpush", "", "intense"), ex("squat", "squat@2", "intense"), ex("hpull", null, "intense"), ex("core", "core", "normal")))),
        )
        val out = PlanEditing.seedPlanFromProgram(PlanOverrides(), p)
        assertEquals(mapOf("hpush" to "intense", "squat@2" to "intense", "hpull" to "intense"), out.intensity)
        assertEquals(listOf("hpush", "squat@2", "hpull"), out.intensity.keys.toList()) // ลำดับ insertion เหมือน object ของ JS
    }

    @Test fun seedPlanDoesNotMutateInputs() {
        val plan = PlanOverrides(trainDays = listOf("อังคาร"))
        val p = Program(days = listOf("จันทร์"), cardioDays = listOf("พุธ"))
        val out = PlanEditing.seedPlanFromProgram(plan, p)
        assertEquals(listOf("อังคาร"), plan.trainDays)
        assertEquals(listOf("จันทร์"), out.trainDays)
        assertEquals(mapOf("พุธ" to 30.0), out.cardioMinByDay)
    }
}
