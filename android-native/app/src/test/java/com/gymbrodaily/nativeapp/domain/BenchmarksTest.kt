package com.gymbrodaily.nativeapp.domain

import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** พอร์ตจาก tests/benchmark.test.js ทีละข้อ */
class BenchmarksTest {
    private val B = Benchmarks

    private val fixture = listOf(
        BenchmarkEntry(
            exerciseId = "bench_press", sex = "ชาย", bodyweightMinKg = 70.0, bodyweightMaxKg = 89.0,
            experienceLevel = "ออกกำลังกายประจำ", benchmarkLevel = "intermediate", benchmarkValueKg = 80.0,
            benchmarkSource = "test-fixture", sourceName = "unit test fixture", lastUpdated = "2026-01-01",
        ),
    )
    private fun bench(value: Double) = fixture[0].copy(benchmarkValueKg = value)

    // 1) e1RM
    @Test fun epleySpecExample() = assertEquals(76.0, B.calculateEstimated1RM(60.0, 8.0)!!, 0.0)
    @Test fun epleyOneRep() = assertEquals(103.3333, B.calculateEstimated1RM(100.0, 1.0)!!, 0.001)
    @Test fun nonIntegerRepsIsNull() = assertNull(B.calculateEstimated1RM(60.0, 8.5))
    @Test fun nonPositiveWeightIsNull() {
        assertNull(B.calculateEstimated1RM(0.0, 8.0))
        assertNull(B.calculateEstimated1RM(-5.0, 8.0))
    }

    // 2) Relative Strength
    @Test fun relativeStrength() = assertEquals(0.95, jsRound(B.calculateRelativeStrength(76.0, 80.0)!! * 100) / 100, 0.0)
    @Test fun relativeStrengthMissingBodyweight() = assertNull(B.calculateRelativeStrength(76.0, null))

    // 3) Benchmark matching
    @Test fun matchesAllCriteria() =
        assertEquals(80.0, B.getStrengthBenchmark("hp4", "ชาย", 80.0, "ออกกำลังกายประจำ", fixture)!!.benchmarkValueKg, 0.0)
    @Test fun resolvesBenchmarkKey() = assertEquals("bench_press", B.resolveBenchmarkKey("hp4"))
    @Test fun bodyweightOutsideRange() = assertNull(B.getStrengthBenchmark("hp4", "ชาย", 200.0, "ออกกำลังกายประจำ", fixture))
    @Test fun shippedDatasetIsEmpty() = assertNull(B.getStrengthBenchmark("hp4", "ชาย", 80.0, "ออกกำลังกายประจำ"))

    // 4) Performance classification
    @Test fun lowerThanBenchmark() {
        val lvl = B.getPerformanceLevel(60.0, bench(80.0))
        assertEquals(PerformanceLevel.LOWER_THAN_BENCHMARK, lvl.level)
        assertEquals("🔴", lvl.level.icon)
        assertTrue(lvl.level.label.isNotEmpty())
    }
    @Test fun nearBenchmark() = assertEquals(PerformanceLevel.NEAR_BENCHMARK, B.getPerformanceLevel(76.0, bench(80.0)).level)
    @Test fun aboveBenchmark() = assertEquals(PerformanceLevel.ABOVE_BENCHMARK, B.getPerformanceLevel(100.0, bench(80.0)).level)
    @Test fun advanced() = assertEquals(PerformanceLevel.ADVANCED, B.getPerformanceLevel(130.0, bench(80.0)).level)
    @Test fun labelsStayNeutral() = PerformanceLevel.entries.forEach { assertFalse(it.name, it.label.contains("เก่ง")) }
    @Test fun fullParameterLookup() {
        val lvl = B.getPerformanceLevel(76.0, "hp4", "ชาย", 80.0, "ออกกำลังกายประจำ", fixture)
        assertEquals(PerformanceLevel.NEAR_BENCHMARK, lvl.level)
        assertEquals(80.0, lvl.benchmark!!.benchmarkValueKg, 0.0)
    }

    // 5) Personal Progress
    @Test fun progressRoundedAndRaw() {
        val prog = B.calculatePersonalProgress(76.0, listOf(E1rmEntry("2026-08-01", 70.0)))!!
        assertEquals(8.6, prog.deltaPct, 0.0)
        assertEquals(8.571428, prog.deltaPctRaw, 0.0001)
        assertEquals("up", prog.direction)
    }
    @Test fun belowBenchmarkAndProgressingAreIndependent() {
        assertEquals(PerformanceLevel.LOWER_THAN_BENCHMARK, B.getPerformanceLevel(76.0, bench(100.0)).level)
        assertEquals("up", B.calculatePersonalProgress(76.0, listOf(E1rmEntry("2026-08-01", 70.0)))!!.direction)
    }

    // 6) No benchmark
    @Test fun noBenchmarkNeverLower() {
        val lvl = B.getPerformanceLevel(76.0, null)
        assertEquals(PerformanceLevel.NO_BENCHMARK, lvl.level)
        assertFalse(lvl.level.hasBenchmark)
        assertEquals("ยังไม่มี Benchmark สำหรับข้อมูลนี้", lvl.level.label)
    }
    @Test fun unmappedExercise() =
        assertEquals(PerformanceLevel.NO_BENCHMARK, B.getPerformanceLevel(200.0, "sq3", "ชาย", 80.0, "ออกกำลังกายประจำ").level)

    // 7) Incomplete data
    @Test fun missingSex() = assertNull(B.getStrengthBenchmark("hp4", null, 80.0, "ออกกำลังกายประจำ", fixture))
    @Test fun missingExperience() = assertNull(B.getStrengthBenchmark("hp4", "ชาย", 80.0, null, fixture))
    @Test fun validationFlagsEveryMissingField() {
        val v = B.validateBenchmarkInput(null, null, null, null, null)
        assertFalse(v.valid)
        assertTrue(v.issues.size >= 5)
    }
    @Test fun assessmentSkipsIncompleteSets() {
        val pick = B.pickAssessmentSet(listOf(null, LoggedSet(null, 8.0), LoggedSet(60.0, 0.0), LoggedSet(60.0, 8.0)))
        assertEquals(76.0, pick!!.e1rm, 0.0)
    }
    @Test fun assessmentWithNoValidSetsIsNull() = assertNull(B.pickAssessmentSet(listOf(null, LoggedSet(null, null))))

    // 8-9) Sex / bodyweight boundaries
    @Test fun differentSexNoMatch() = assertNull(B.getStrengthBenchmark("hp4", "หญิง", 80.0, "ออกกำลังกายประจำ", fixture))
    @Test fun justBelowRange() = assertNull(B.getStrengthBenchmark("hp4", "ชาย", 69.0, "ออกกำลังกายประจำ", fixture))
    @Test fun upperBoundInclusive() = assertNotNull(B.getStrengthBenchmark("hp4", "ชาย", 89.0, "ออกกำลังกายประจำ", fixture))

    // 10) High-rep sets
    @Test fun prefersReliableSet() {
        val pick = B.pickAssessmentSet(listOf(LoggedSet(40.0, 20.0), LoggedSet(60.0, 5.0)))!!
        assertEquals(60.0, pick.weight, 0.0)
        assertFalse(pick.lowConfidence)
    }
    @Test fun allHighRepsFlaggedLowConfidence() =
        assertTrue(B.pickAssessmentSet(listOf(LoggedSet(20.0, 20.0), LoggedSet(25.0, 18.0)))!!.lowConfidence)
    @Test fun baselineIsMostRecentPriorEntry() {
        val prog = B.calculatePersonalProgress(76.0, listOf(E1rmEntry("2026-06-01", 60.0), E1rmEntry("2026-07-01", 70.0)))!!
        assertEquals("2026-07-01", prog.baselineDate)
    }
}
