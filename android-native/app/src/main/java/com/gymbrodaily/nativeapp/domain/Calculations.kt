package com.gymbrodaily.nativeapp.domain

import kotlin.math.max
import kotlin.math.min

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

    const val KATCH_BF_MIN = 3.0
    const val KATCH_BF_MAX = 60.0

    /** Katch-McArdle: BMR = 370 + 21.6 × มวลไร้ไขมัน — ใช้เมื่อผู้ใช้กรอก % ไขมันเอง (3–60%) เท่านั้น ตรงกับ calculations.js */
    fun calculateBMRKatchMcArdle(weightKg: Double, bodyFatPct: Double): Double? {
        if (!(weightKg > 0) || !(bodyFatPct >= KATCH_BF_MIN && bodyFatPct <= KATCH_BF_MAX)) return null
        return 370 + 21.6 * (weightKg * (1 - bodyFatPct / 100))
    }

    /* BMI / น้ำหนักอ้างอิง (Adjusted Body Weight) — ตรงกับ calculations.js
       BMI > 25 → ใช้ ABW = anchor + 0.4 × (น้ำหนักจริง − anchor) คิด BMR แทนน้ำหนักรวม (กัน TDEE เฟ้อ)
       anchor = น้ำหนักเป้าหมายถ้า BMI 18.5–25 และต่ำกว่าน้ำหนักจริง ไม่งั้น IBW (น้ำหนักที่ BMI 22) */
    const val BMI_ABW_THRESHOLD = 25.0
    const val IBW_BMI = 22.0
    const val ABW_FACTOR = 0.4

    fun calculateBMI(weightKg: Double?, heightCm: Double?): Double? {
        if (weightKg == null || heightCm == null || !(weightKg > 0) || !(heightCm > 0)) return null
        val m = heightCm / 100
        return weightKg / (m * m)
    }

    fun idealBodyWeight(heightCm: Double?): Double? {
        if (heightCm == null || !(heightCm > 0)) return null
        val m = heightCm / 100
        return IBW_BMI * m * m
    }

    /** method = "actual" | "abw"; anchorKg เป็น null เมื่อใช้น้ำหนักจริง */
    data class RefWeight(val kg: Double, val method: String, val bmi: Double, val anchorKg: Double?)

    fun referenceWeight(weightKg: Double, heightCm: Double, goalWeightKg: Double?): RefWeight? {
        val bmi = calculateBMI(weightKg, heightCm) ?: return null
        if (bmi <= BMI_ABW_THRESHOLD) return RefWeight(weightKg, "actual", bmi, null)
        val goalBmi = calculateBMI(goalWeightKg, heightCm)
        val anchor = if (goalBmi != null && goalBmi >= 18.5 && goalBmi <= BMI_ABW_THRESHOLD && goalWeightKg!! < weightKg) goalWeightKg
        else idealBodyWeight(heightCm) ?: return null
        return RefWeight(anchor + ABW_FACTOR * (weightKg - anchor), "abw", bmi, anchor)
    }

    /**
     * จุดเข้าเดียวสำหรับ BMR ของโปรไฟล์: ข้อมูลพื้นฐานต้องครบก่อน (ไม่งั้น null)
     * 1) มี bodyFatPct ที่กรอกเอง → Katch-McArdle  2) ไม่งั้น Mifflin ด้วยน้ำหนักอ้างอิง (BMI > 25 = ABW)
     */
    fun calculateBMRForProfile(weightKg: Double, heightCm: Double, age: Double, sex: String?, bodyFatPct: Double?, goalWeightKg: Double? = null): Double? {
        val mifflin = calculateBMR(weightKg, heightCm, age, sex) ?: return null
        if (bodyFatPct != null) calculateBMRKatchMcArdle(weightKg, bodyFatPct)?.let { return it }
        val ref = referenceWeight(weightKg, heightCm, goalWeightKg)
        if (ref == null || ref.method == "actual") return mifflin
        return calculateBMR(ref.kg, heightCm, age, sex)
    }

    /** ขนาด deficit ของ Recomposition ตาม BMI (ช่วง 22–24.9 ใช้ค่ากลาง 12%/400) */
    data class RecompTier(val maxBmi: Double, val pct: Double, val cap: Int)
    val RECOMP_DEFICIT_TIERS = listOf(
        RecompTier(22.0, 0.08, 300), RecompTier(25.0, 0.12, 400),
        RecompTier(30.0, 0.20, 500), RecompTier(Double.POSITIVE_INFINITY, 0.25, 800),
    )

    fun recompDeficit(bmi: Double?): RecompTier? {
        if (bmi == null || !(bmi > 0)) return null
        return RECOMP_DEFICIT_TIERS.firstOrNull { bmi < it.maxBmi } ?: RECOMP_DEFICIT_TIERS.last()
    }

    /** ผลมาโคร (กรัม) — carbG ไม่ติดลบ, clamped = ต้องถอยจากเป้าตั้งต้นเพื่อไม่ให้รวมเกินแคลอรี่เป้า */
    data class MacroResult(val proteinG: Int?, val fatG: Int?, val carbG: Int?, val clamped: Boolean)

    const val PROTEIN_G_PER_KG = 2.0
    const val PROTEIN_MIN_G_PER_KG = 1.6
    const val FAT_G_PER_KG = 0.8
    const val FAT_MIN_PCT = 0.20
    const val FAT_MAX_PCT = 0.30
    const val CARB_MIN_G = 50.0

    /**
     * โปรตีน (g) → ไขมัน (g, บีบอยู่ใน 20–30% ของแคล) → คาร์บ = ส่วนที่เหลือ ÷ 4 — ตรงกับ calculateMacros ใน calculations.js
     * คาร์บต่ำกว่า [CARB_MIN_G]: ลดไขมันถึงพื้น 20% → ลดโปรตีนถึง 1.6 g/kg → คาร์บ 0 (ไม่ติดลบ)
     */
    fun calculateMacros(kcal: Double?, proteinRefKg: Double?, fatRefKg: Double?): MacroResult {
        val pRef = proteinRefKg?.takeIf { it > 0 }
        val fRef = fatRefKg?.takeIf { it > 0 } ?: pRef
        var proteinG = if (pRef != null) PROTEIN_G_PER_KG * pRef else 0.0
        if (kcal == null || !kcal.isFinite()) {
            return MacroResult(pRef?.let { jsRound(proteinG).toInt() }, null, null, false)
        }
        val fatMinG = kcal * FAT_MIN_PCT / 9
        val fatMaxG = kcal * FAT_MAX_PCT / 9
        var fatG = if (fRef != null) min(fatMaxG, max(fatMinG, FAT_G_PER_KG * fRef)) else kcal * 0.25 / 9
        fun carbsLeft() = (kcal - proteinG * 4 - fatG * 9) / 4
        var clamped = false
        if (carbsLeft() < CARB_MIN_G && fatG > fatMinG) {
            fatG = max(fatMinG, fatG - (CARB_MIN_G - carbsLeft()) * 4 / 9); clamped = true
        }
        if (carbsLeft() < CARB_MIN_G && pRef != null) {
            val proteinMinG = PROTEIN_MIN_G_PER_KG * pRef
            if (proteinG > proteinMinG) { proteinG = max(proteinMinG, proteinG - (CARB_MIN_G - carbsLeft())); clamped = true }
        }
        if (carbsLeft() < CARB_MIN_G) clamped = true
        val carbG = max(0.0, carbsLeft())
        return MacroResult(pRef?.let { jsRound(proteinG).toInt() }, jsRound(fatG).toInt(), jsRound(carbG).toInt(), clamped)
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

    /** ผลของด่าน EA กลาง — ea = EA ของ kcal ที่ส่งเข้ามา (ก่อนดัน), kcal = เป้าหลังดัน */
    data class EaGuard(val kcal: Double, val blocked: Boolean, val ea: Double, val minKcal: Double, val minEA: Double)

    /**
     * ด่านกลางของ energy availability (ตรงกับ GymBroCalc.applyEaGuard ใน calculations.js) — ใช้ตอนสร้างแผน, ตอนเสนอเป้าใหม่ให้แผนเก่า
     * และตอนปรับเป้าตามผลจริง ดันเป้าขึ้นได้อย่างเดียว ห้ามลด: เกณฑ์ลดไขมัน = [EA_MIN_CUT], เป้าอื่น = [EA_MIN_NON_CUT]
     * maxKcal = เพดานที่ห้ามดันขึ้นไปเกิน (null = ดันถึง minKcal เต็ม ๆ) · minKcal ปัดขึ้นเป็นหลัก 10 kcal
     * คืน null ถ้าข้อมูลไม่ครบ (kcal ว่าง/ไม่ใช่ตัวเลข, FFM ≤ 0) — ไม่คืน 0 หรือผ่านเงียบ ๆ
     */
    fun applyEaGuard(kcal: Double?, goal: String?, exPerDay: Double?, ffmKg: Double?, maxKcal: Double? = null): EaGuard? {
        if (kcal == null || !kcal.isFinite()) return null
        val minEA = if (goal == "ลดไขมัน") EA_MIN_CUT else EA_MIN_NON_CUT
        val raw = minIntakeForEA(minEA, exPerDay, ffmKg) ?: return null
        val ea = calculateEnergyAvailability(kcal, exPerDay, ffmKg) ?: return null
        val minKcal = Math.ceil(raw / 10) * 10
        val blocked = kcal < minKcal
        val cap = maxKcal?.takeIf { it.isFinite() } ?: minKcal
        val out = if (blocked) maxOf(kcal, minOf(minKcal, cap)) else kcal
        return EaGuard(out, blocked, ea, minKcal, minEA)
    }
}
