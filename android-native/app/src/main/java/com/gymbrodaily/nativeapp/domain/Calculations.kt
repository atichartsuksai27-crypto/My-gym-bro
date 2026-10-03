package com.gymbrodaily.nativeapp.domain

/* ============================================================
   Energy calculations (BMR / TDEE) — พอร์ตจาก calculations.js
   ------------------------------------------------------------
   Single source of truth ของสูตรพลังงานฝั่งแอป native ห้ามเขียนสูตร BMR/TDEE ซ้ำที่อื่น
   ผลต้องตรงกับ calculations.js ทุกกรณี (ตรวจด้วย CalculationsGoldenTest)
   คืน null เมื่อข้อมูลไม่ครบ/ไม่ถูกต้อง ห้ามคืน 0 เพื่อกลบ error
   ไม่ปัดเศษ: ปัดเฉพาะตอนแสดงผลเท่านั้น
   ============================================================ */
object Calculations {

    /** Activity Factor — mapping กลางชุดเดียวของทั้งระบบ */
    val ACTIVITY_FACTORS: Map<String, Double> = mapOf(
        "sedentary" to 1.20,
        "lightly_active" to 1.375,
        "moderately_active" to 1.55,
        "very_active" to 1.725,
        "extremely_active" to 1.90,
    )

    /** คำตอบ Q36 → ระดับกิจกรรมกลางข้างบน */
    val Q36_ACTIVITY_LEVEL: Map<String, String> = mapOf(
        "นั่งโต๊ะเป็นหลัก" to "sedentary",
        "ยืน-เดินเยอะ" to "lightly_active",
        "ใช้แรงงาน" to "moderately_active",
    )

    fun getActivityFactor(level: String?): Double? = level?.let { ACTIVITY_FACTORS[it] }

    fun activityFactorFromQ36(answer: String?): Double? =
        answer?.let { Q36_ACTIVITY_LEVEL[it] }?.let { getActivityFactor(it) }

    /** Mifflin-St Jeor — ค่า NaN นับเป็นข้อมูลไม่ถูกต้อง (เหมือน Number() ที่แปลงไม่ได้ใน JS) */
    fun calculateBMR(weightKg: Double, heightCm: Double, age: Double, sex: String?): Double? {
        if (!(weightKg > 0) || !(heightCm > 0) || !(age > 0)) return null
        if (sex != "ชาย" && sex != "หญิง") return null
        val base = 10 * weightKg + 6.25 * heightCm - 5 * age
        return if (sex == "ชาย") base + 5 else base - 161
    }

    /** TDEE = BMR × Activity Factor */
    fun calculateTDEE(bmr: Double?, activityFactor: Double?): Double? {
        if (bmr == null || !(bmr > 0)) return null
        if (activityFactor == null || !(activityFactor > 0)) return null
        return bmr * activityFactor
    }
}
