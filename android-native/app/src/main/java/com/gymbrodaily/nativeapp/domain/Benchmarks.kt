package com.gymbrodaily.nativeapp.domain

/* ============================================================
   Strength Performance Benchmark — พอร์ตจาก benchmarks.js
   ------------------------------------------------------------
   ทุกจุดที่ต้องคำนวณ e1RM / Relative Strength / จับคู่ Benchmark / จัดระดับ Performance /
   Personal Progress ต้องเรียกผ่าน object นี้เท่านั้น ผลต้องตรงกับ benchmarks.js ทุกกรณี
   (ตรวจด้วย BenchmarksGoldenTest)
   ============================================================ */

data class BenchmarkEntry(
    val exerciseId: String,
    val sex: String,
    val bodyweightMinKg: Double,
    val bodyweightMaxKg: Double,
    val experienceLevel: String,
    val benchmarkLevel: String,
    val benchmarkValueKg: Double,
    val unit: String = "kg",
    val benchmarkSource: String,
    val sourceName: String,
    val sourceUrl: String? = null,
    val lastUpdated: String,
)

/** ถ้อยคำเป็นกลาง ไม่มีคำว่าเก่ง/ไม่เก่ง และทุกระดับมีข้อความกำกับคู่กับสีเสมอ */
enum class PerformanceLevel(val label: String, val icon: String, val hasBenchmark: Boolean) {
    LOWER_THAN_BENCHMARK("ต่ำกว่า Benchmark", "🔴", true),
    NEAR_BENCHMARK("ใกล้เคียง Benchmark", "🟡", true),
    ABOVE_BENCHMARK("สูงกว่า Benchmark", "🟢", true),
    ADVANCED("ระดับ Advanced", "🟣", true),
    NO_BENCHMARK("ยังไม่มี Benchmark สำหรับข้อมูลนี้", "⚪", false),
    INSUFFICIENT_DATA("ข้อมูลไม่ครบสำหรับประเมิน Performance", "⚪", false),
}

data class PerformanceResult(
    val level: PerformanceLevel,
    val ratio: Double? = null,
    val benchmark: BenchmarkEntry? = null,
)

data class E1rmEntry(val date: String, val e1rm: Double?)

data class PersonalProgress(
    val baselineDate: String,
    val baselineE1rm: Double,
    val currentE1rm: Double,
    val deltaKg: Double,
    val deltaPct: Double,
    val deltaKgRaw: Double,
    val deltaPctRaw: Double,
    val direction: String, // "up" | "down" | "flat"
)

data class LoggedSet(val weight: Double?, val reps: Double?)

data class AssessmentSet(val weight: Double, val reps: Double, val e1rm: Double, val lowConfidence: Boolean)

data class ValidationResult(val valid: Boolean, val issues: List<String>)

object Benchmarks {

    /** ท่าใน EXERCISES ที่จับคู่กับ benchmark key — เฉพาะท่าหลักที่มี published standard */
    val EXERCISE_BENCHMARK_KEY: Map<String, String> = mapOf(
        "sq4" to "back_squat",
        "hg4" to "deadlift",
        "hp4" to "bench_press",
        "vp4" to "overhead_press",
        "hl4" to "barbell_row",
        "vl4" to "pull_up",
    )

    /** ว่างไว้โดยตั้งใจ — ห้ามเดาตัวเลขมาตรฐานขึ้นมาเอง (ดูคอมเมนต์ใน benchmarks.js) */
    val BENCHMARK_DATASET: List<BenchmarkEntry> = emptyList()

    const val BAND_BELOW_MAX = 0.90
    const val BAND_NEAR_MAX = 1.10
    const val BAND_ABOVE_MAX = 1.50
    const val RELIABLE_REP_MAX = 12.0

    /** Epley: e1RM = weight × (1 + reps/30) — reps ต้องเป็นจำนวนเต็ม > 0 */
    fun calculateEstimated1RM(weightKg: Double?, reps: Double?): Double? {
        val w = weightKg ?: 0.0
        val r = reps ?: 0.0
        if (!(w > 0)) return null
        if (!isInteger(r) || r <= 0) return null
        return w * (1 + r / 30)
    }

    fun calculateRelativeStrength(e1rmKg: Double?, bodyweightKg: Double?): Double? {
        val e = e1rmKg ?: 0.0
        val bw = bodyweightKg ?: 0.0
        if (!(e > 0) || !(bw > 0)) return null
        return e / bw
    }

    fun resolveBenchmarkKey(exercise: String?): String? {
        if (exercise.isNullOrEmpty()) return null
        return EXERCISE_BENCHMARK_KEY[exercise] ?: exercise
    }

    /** หา entry ที่ตรงทุกเงื่อนไข ไม่ตรง = null (ห้ามใช้ entry ใกล้เคียงแทน) */
    fun getStrengthBenchmark(
        exercise: String?,
        sex: String?,
        bodyweightKg: Double?,
        experience: String?,
        dataset: List<BenchmarkEntry> = BENCHMARK_DATASET,
    ): BenchmarkEntry? {
        val key = resolveBenchmarkKey(exercise) ?: return null
        if (sex != "ชาย" && sex != "หญิง") return null
        val bw = bodyweightKg ?: return null
        if (!(bw > 0)) return null
        if (experience.isNullOrEmpty()) return null
        return dataset.firstOrNull {
            it.exerciseId == key && it.sex == sex && it.experienceLevel == experience &&
                bw >= it.bodyweightMinKg && bw <= it.bodyweightMaxKg
        }
    }

    /** จัดระดับเทียบกับ benchmark ที่หามาแล้ว — benchmark null = NO_BENCHMARK เสมอ */
    fun getPerformanceLevel(e1rmKg: Double?, benchmark: BenchmarkEntry?): PerformanceResult =
        classify(e1rmKg, benchmark?.benchmarkValueKg, benchmark)

    /** จัดระดับโดยหา benchmark จากข้อมูลผู้ใช้เอง (lookup path เดียวกับ getStrengthBenchmark) */
    fun getPerformanceLevel(
        e1rmKg: Double?,
        exercise: String?,
        sex: String?,
        bodyweightKg: Double?,
        experience: String?,
        dataset: List<BenchmarkEntry> = BENCHMARK_DATASET,
    ): PerformanceResult {
        if (!((e1rmKg ?: 0.0) > 0)) return PerformanceResult(PerformanceLevel.INSUFFICIENT_DATA)
        return getPerformanceLevel(e1rmKg, getStrengthBenchmark(exercise, sex, bodyweightKg, experience, dataset))
    }

    /** แยกจาก BenchmarkEntry เพื่อให้เทสต์เทียบกับ JS ได้โดยไม่ต้องสร้าง entry เต็ม */
    internal fun classify(e1rmKg: Double?, benchmarkValueKg: Double?, benchmark: BenchmarkEntry? = null): PerformanceResult {
        val e1 = e1rmKg ?: 0.0
        if (!(e1 > 0)) return PerformanceResult(PerformanceLevel.INSUFFICIENT_DATA)
        if (benchmarkValueKg == null) return PerformanceResult(PerformanceLevel.NO_BENCHMARK)
        val ratio = e1 / benchmarkValueKg
        if (!(ratio > 0)) return PerformanceResult(PerformanceLevel.NO_BENCHMARK)
        val level = when {
            ratio < BAND_BELOW_MAX -> PerformanceLevel.LOWER_THAN_BENCHMARK
            ratio <= BAND_NEAR_MAX -> PerformanceLevel.NEAR_BENCHMARK
            ratio <= BAND_ABOVE_MAX -> PerformanceLevel.ABOVE_BENCHMARK
            else -> PerformanceLevel.ADVANCED
        }
        return PerformanceResult(level, ratio, benchmark)
    }

    /** เทียบกับ performance เดิมของผู้ใช้เอง — baseline เริ่มต้น = รายการล่าสุดใน history (เรียงเก่า→ใหม่) */
    fun calculatePersonalProgress(
        currentE1rm: Double?,
        history: List<E1rmEntry>,
        baselineEntry: E1rmEntry? = null,
    ): PersonalProgress? {
        val current = currentE1rm ?: 0.0
        if (!(current > 0) || history.isEmpty()) return null
        val base = baselineEntry ?: history.last()
        val baseline = base.e1rm ?: 0.0
        if (!(baseline > 0)) return null
        val deltaKg = current - baseline
        val deltaPct = (deltaKg / baseline) * 100
        return PersonalProgress(
            baselineDate = base.date,
            baselineE1rm = round1(baseline),
            currentE1rm = round1(current),
            deltaKg = round1(deltaKg),
            deltaPct = round1(deltaPct),
            deltaKgRaw = deltaKg,
            deltaPctRaw = deltaPct,
            direction = if (deltaKg > 0.05) "up" else if (deltaKg < -0.05) "down" else "flat",
        )
    }

    /** เลือกเซ็ตที่ reps ≤ 12 และ e1RM สูงสุด ถ้าไม่มีเลยใช้เซ็ตที่ดีที่สุดแต่ติด lowConfidence */
    fun pickAssessmentSet(sets: List<LoggedSet?>): AssessmentSet? {
        val valid = sets.mapNotNull { s ->
            s ?: return@mapNotNull null
            val e1 = calculateEstimated1RM(s.weight, s.reps) ?: return@mapNotNull null
            AssessmentSet(s.weight!!, s.reps!!, e1, lowConfidence = false)
        }
        if (valid.isEmpty()) return null
        val reliable = valid.filter { it.reps <= RELIABLE_REP_MAX }
        val pool = reliable.ifEmpty { valid }
        val best = pool.reduce { a, b -> if (b.e1rm > a.e1rm) b else a }
        return best.copy(lowConfidence = best.reps > RELIABLE_REP_MAX)
    }

    fun validateBenchmarkInput(
        weightKg: Double?,
        reps: Double?,
        bodyweightKg: Double?,
        exercise: String?,
        sex: String?,
    ): ValidationResult {
        val issues = mutableListOf<String>()
        if (!((weightKg ?: 0.0) > 0)) issues += "weight ต้องมากกว่า 0"
        val r = reps ?: 0.0
        if (!isInteger(r) || r <= 0) issues += "reps ต้องเป็นจำนวนเต็มมากกว่า 0"
        if (!((bodyweightKg ?: 0.0) > 0)) issues += "bodyweight ต้องมากกว่า 0"
        if (resolveBenchmarkKey(exercise) == null) issues += "exercise ไม่รู้จักในระบบ"
        if (sex != "ชาย" && sex != "หญิง") issues += "ต้องมีข้อมูลเพศก่อนใช้ benchmark"
        return ValidationResult(issues.isEmpty(), issues)
    }

    private fun isInteger(x: Double) = x.isFinite() && x == kotlin.math.floor(x)
    private fun round1(x: Double) = jsRound(x * 10) / 10
}
