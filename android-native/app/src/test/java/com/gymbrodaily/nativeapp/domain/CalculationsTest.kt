package com.gymbrodaily.nativeapp.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** พอร์ตจาก tests/calculations.test.js ทีละข้อ */
class CalculationsTest {
    private val C = Calculations

    @Test fun maleBmr() = assertEquals(1780.0, C.calculateBMR(80.0, 180.0, 30.0, "ชาย")!!, 0.0)
    @Test fun femaleBmr() = assertEquals(1320.25, C.calculateBMR(60.0, 165.0, 30.0, "หญิง")!!, 0.0)

    @Test fun stringInputsAreCoercedNotRoundedFirst() = assertEquals(
        10 * 80.4 + 6.25 * 180.6 - 5 * 30 + 5,
        C.calculateBMR(jsNumber("80.4"), jsNumber("180.6"), jsNumber("30"), "ชาย")!!, 0.0,
    )

    @Test fun tdee() {
        assertEquals(2759.0, C.calculateTDEE(1780.0, 1.55)!!, 0.0)
        assertEquals(1815.34375, C.calculateTDEE(1320.25, 1.375)!!, 0.0)
    }

    @Test fun katchMcArdle() {
        assertEquals(1838.8, C.calculateBMRKatchMcArdle(80.0, 15.0)!!, 1e-9)
        assertNull(C.calculateBMRKatchMcArdle(80.0, 2.9))
        assertNull(C.calculateBMRKatchMcArdle(80.0, 60.1))
        assertNull(C.calculateBMRKatchMcArdle(0.0, 15.0))
    }

    @Test fun profileBmrUsesKatchOnlyWhenTyped() {
        assertEquals(1780.0, C.calculateBMRForProfile(80.0, 180.0, 30.0, "ชาย", null)!!, 0.0)
        assertEquals(1838.8, C.calculateBMRForProfile(80.0, 180.0, 30.0, "ชาย", 15.0)!!, 1e-9)
        assertEquals(1780.0, C.calculateBMRForProfile(80.0, 180.0, 30.0, "ชาย", 99.0)!!, 0.0)
        assertNull(C.calculateBMRForProfile(80.0, 0.0, 30.0, "ชาย", 15.0))
        assertNull(C.calculateBMRForProfile(80.0, 180.0, 30.0, "other", 15.0))
    }

    @Test fun activityFactors() {
        assertEquals(1.40, C.ACTIVITY_FACTORS["sedentary"]!!, 0.0)
        assertEquals(1.55, C.ACTIVITY_FACTORS["lightly_active"]!!, 0.0)
        assertEquals(1.75, C.ACTIVITY_FACTORS["moderately_active"]!!, 0.0)
        assertEquals(3, C.ACTIVITY_FACTORS.size)
    }

    @Test fun q36Mapping() {
        assertEquals(1.40, C.activityFactorFromQ36("นั่งโต๊ะเป็นหลัก")!!, 0.0)
        assertEquals(1.55, C.activityFactorFromQ36("ยืน-เดินเยอะ")!!, 0.0)
        assertEquals(1.75, C.activityFactorFromQ36("ใช้แรงงาน")!!, 0.0)
        assertNull(C.activityFactorFromQ36("อะไรก็ไม่รู้"))
        assertNull(C.activityFactorFromQ36(null))
        assertNull(C.getActivityFactor("super_active"))
        assertNull(C.getActivityFactor(null))
    }

    @Test fun missingOrInvalidInputsGiveNullNotZero() {
        assertNull(C.calculateBMR(Double.NaN, 180.0, 30.0, "ชาย"))
        assertNull(C.calculateBMR(80.0, Double.NaN, 30.0, "ชาย"))
        assertNull(C.calculateBMR(80.0, 180.0, Double.NaN, "ชาย"))
        assertNull(C.calculateBMR(80.0, 180.0, 0.0, "ชาย"))
        assertNull(C.calculateBMR(80.0, 180.0, -5.0, "ชาย"))
        assertNull(C.calculateBMR(80.0, 180.0, 30.0, "other"))
        assertNull(C.calculateBMR(80.0, 180.0, 30.0, null))
        assertNull(C.calculateTDEE(null, 1.55))
        assertNull(C.calculateTDEE(1780.0, 0.0))
        assertNull(C.calculateTDEE(1780.0, null))
    }

    /* ---------- applyEaGuard — พอร์ตจาก tests/calculations.test.js (F-02) ---------- */

    @Test fun eaGuardPushesUpToMinKcalWhenBelowThreshold() {
        // FFM 45, ฝึก 200 → เกณฑ์ลดไขมัน = 30*45+200 = 1550; กิน 1400 → EA (1400-200)/45 = 26.67
        val g = C.applyEaGuard(1400.0, "ลดไขมัน", 200.0, 45.0)!!
        assertTrue(g.blocked)
        assertEquals(1550.0, g.minKcal, 0.0)
        assertEquals(1550.0, g.kcal, 0.0)
        assertEquals(1200.0 / 45, g.ea, 1e-9) // EA ของค่าที่ส่งเข้ามา ก่อนดัน
        assertEquals(1530.0, C.applyEaGuard(1305.0, "ลดไขมัน", 203.0, 44.2)!!.minKcal, 0.0) // 30*44.2+203 = 1529 → ปัดขึ้น 1530
    }

    @Test fun eaGuardLeavesPassingTargetsUntouchedAndNeverLowers() {
        val ok = C.applyEaGuard(1550.0, "ลดไขมัน", 200.0, 45.0)!!
        assertFalse(ok.blocked)
        assertEquals(1550.0, ok.kcal, 0.0)
        assertEquals(3200.0, C.applyEaGuard(3200.0, "รักษาสุขภาพทั่วไป", 200.0, 45.0)!!.kcal, 0.0)
    }

    @Test fun eaGuardThresholdIs30ForFatLossAnd35ForOtherGoals() {
        val cut = C.applyEaGuard(1700.0, "ลดไขมัน", 200.0, 45.0)!!
        val other = C.applyEaGuard(1700.0, "รักษาสุขภาพทั่วไป", 200.0, 45.0)!!
        assertEquals(30.0, cut.minEA, 0.0)
        assertEquals(35.0, other.minEA, 0.0)
        assertFalse(cut.blocked) // เกณฑ์ 1550
        assertTrue(other.blocked) // 35*45+200 = 1775 → 1780
        assertEquals(1780.0, other.kcal, 0.0)
        listOf("Recomposition (ลด+เพิ่มพร้อมกัน)", "เพิ่มกล้ามเนื้อ", null).forEach {
            assertEquals(35.0, C.applyEaGuard(1700.0, it, 200.0, 45.0)!!.minEA, 0.0)
        }
    }

    @Test fun eaGuardMaxKcalCapsThePush() {
        val g = C.applyEaGuard(1400.0, "ลดไขมัน", 200.0, 45.0, 1500.0)!!
        assertTrue(g.blocked)
        assertEquals(1550.0, g.minKcal, 0.0)
        assertEquals(1500.0, g.kcal, 0.0)
        assertEquals(1400.0, C.applyEaGuard(1400.0, "ลดไขมัน", 200.0, 45.0, 1300.0)!!.kcal, 0.0) // เพดานต่ำกว่าค่าที่ส่งเข้ามา → ไม่ลด
    }

    @Test fun eaGuardIncompleteDataGivesNullNotZero() {
        assertNull(C.applyEaGuard(null, "ลดไขมัน", 200.0, 45.0))
        assertNull(C.applyEaGuard(Double.NaN, "ลดไขมัน", 200.0, 45.0))
        assertNull(C.applyEaGuard(1500.0, "ลดไขมัน", 200.0, 0.0))
        assertNull(C.applyEaGuard(1500.0, "ลดไขมัน", 200.0, null))
        val noEx = C.applyEaGuard(1200.0, "ลดไขมัน", null, 45.0)!! // ไม่มีแคลฝึก = 0 ไม่ใช่ความล้มเหลว
        assertEquals(1350.0, noEx.minKcal, 0.0)
        assertEquals(1350.0, noEx.kcal, 0.0)
    }
}
