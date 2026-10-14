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

    /** Activity Factor — mapping กลางชุดเดียวของทั้งระบบ: กิจกรรมประจำวันนอกเวลาออกกำลังกาย (TDEE ไม่รวมการฝึก)
     *  ค่า PAL ของ FAO/WHO/UNU (2004) — นั่งโต๊ะ 1.40 (ขอบล่าง sedentary), ยืน-เดินเยอะ 1.55, ใช้แรงงาน 1.75 (ขอบล่าง active) ตรงกับ calculations.js */
    val ACTIVITY_FACTORS: Map<String, Double> = mapOf(
        "sedentary" to 1.40,
        "lightly_active" to 1.55,
        "moderately_active" to 1.75,
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

    /* Energy availability (IOC RED-S) — พอร์ตจาก calculations.js: EA = (แคลที่กิน − แคลจากการออกกำลังกาย) / FFM (กก.)
       EA_MIN_CUT = พื้นระหว่างลดไขมัน, EA_MIN_NON_CUT = พื้นสำหรับเป้าที่ไม่ได้ตั้งใจให้ขาด (รักษา/Recomp/เพิ่มกล้าม) */
    const val EA_MIN_CUT = 30.0
    const val EA_MIN_NON_CUT = 35.0

    fun calculateFFM(weightKg: Double, bodyFatPct: Double): Double? {
        if (!(weightKg > 0) || !(bodyFatPct >= 0 && bodyFatPct < 100)) return null
        return weightKg * (1 - bodyFatPct / 100)
    }

    fun calculateEnergyAvailability(intakeKcal: Double?, exerciseKcal: Double?, ffmKg: Double?): Double? {
        if (intakeKcal == null || !(intakeKcal >= 0) || ffmKg == null || !(ffmKg > 0)) return null
        val ex = exerciseKcal?.takeIf { !it.isNaN() } ?: 0.0
        return (intakeKcal - ex) / ffmKg
    }

    /** แคลต่ำสุดที่กินได้โดย EA ไม่ต่ำกว่า minEA */
    fun minIntakeForEA(minEA: Double, exerciseKcal: Double?, ffmKg: Double?): Double? {
        if (!(minEA > 0) || ffmKg == null || !(ffmKg > 0)) return null
        return minEA * ffmKg + (exerciseKcal?.takeIf { !it.isNaN() } ?: 0.0)
    }
}
