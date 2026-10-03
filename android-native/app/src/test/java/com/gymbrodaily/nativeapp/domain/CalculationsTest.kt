package com.gymbrodaily.nativeapp.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
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

    @Test fun activityFactors() {
        assertEquals(1.20, C.ACTIVITY_FACTORS["sedentary"]!!, 0.0)
        assertEquals(1.375, C.ACTIVITY_FACTORS["lightly_active"]!!, 0.0)
        assertEquals(1.55, C.ACTIVITY_FACTORS["moderately_active"]!!, 0.0)
        assertEquals(1.725, C.ACTIVITY_FACTORS["very_active"]!!, 0.0)
        assertEquals(1.90, C.ACTIVITY_FACTORS["extremely_active"]!!, 0.0)
    }

    @Test fun q36Mapping() {
        assertEquals(1.20, C.activityFactorFromQ36("นั่งโต๊ะเป็นหลัก")!!, 0.0)
        assertEquals(1.375, C.activityFactorFromQ36("ยืน-เดินเยอะ")!!, 0.0)
        assertEquals(1.55, C.activityFactorFromQ36("ใช้แรงงาน")!!, 0.0)
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
}
