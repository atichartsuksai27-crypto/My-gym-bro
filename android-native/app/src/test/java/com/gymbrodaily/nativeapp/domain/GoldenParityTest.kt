package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** เทียบผลของ Kotlin กับผลจาก JS ตัวจริงทีละเคส (ดู tools/make-golden.js) */
class GoldenParityTest {

    @Test
    fun fixturesAreLoaded() {
        assertEquals(1500, loadGolden("generator.json").size)
        assertEquals(300, loadGolden("calculations.json").size)
        assertEquals(300, loadGolden("benchmarks.json").size)
    }

    /** กันเทสต์ผ่านแบบหลอกๆ — ตัวเทียบต้องจับความต่างได้จริง */
    @Test
    fun comparatorDetectsDifferences() {
        fun differs(e: String, a: String) = runCatching {
            assertJsonEquivalent(goldenJson.parseToJsonElement(e), goldenJson.parseToJsonElement(a))
        }.isFailure
        assertTrue(differs("""{"a":76}""", """{"a":76.1}"""))
        assertTrue(differs("""{"a":"x"}""", """{"a":"y"}"""))
        assertTrue(differs("""{"a":null}""", """{"a":0}"""))
        assertTrue(differs("""[1,2]""", """[1,2,3]"""))
        assertTrue(differs("""{"a":1}""", """{"a":1,"b":2}"""))
        assertTrue(differs("""{"a":true}""", """{"a":false}"""))
        assertFalse(differs("""{"a":76,"b":null}""", """{"a":76.0}"""))
    }

    @Test
    fun catalogMatchesJs() {
        val js = loadGolden("catalog.json")[0].jsonObject
        val actual = buildJsonObject {
            put("EXERCISES", JsonArray(Catalog.EXERCISES.map { e ->
                buildJsonObject {
                    put("id", e.id); put("pattern", e.pattern); put("tier", e.tier)
                    put("equip", e.equip); put("th", e.th); put("sub", e.sub)
                }
            }))
            put("SPLIT_DEFS", buildJsonObject {
                Catalog.SPLIT_DEFS.forEach { (k, d) ->
                    put(k, buildJsonObject {
                        put("key", d.key); put("label", d.label); put("minDays", d.minDays); put("minRank", d.minRank)
                        put("desc", d.desc)
                        put("sessions", JsonArray(d.sessions.map { s ->
                            buildJsonObject {
                                put("key", s.key)
                                put("patterns", JsonArray(s.patterns.map { JsonPrimitive(it) }))
                            }
                        }))
                    })
                }
            })
            put("EXCLUSION_MAP", stringListMap(Catalog.EXCLUSION_MAP))
            put("EXP_RANK", buildJsonObject { Catalog.EXP_RANK.forEach { (k, v) -> put(k, v) } })
            put("REP_SCHEME", buildJsonObject { Catalog.REP_SCHEME.forEach { (k, v) -> put(k, v) } })
            put("PATTERN_LABEL", buildJsonObject { Catalog.PATTERN_LABEL.forEach { (k, v) -> put(k, v) } })
            put("PATTERN_SHORT", buildJsonObject { Catalog.PATTERN_SHORT.forEach { (k, v) -> put(k, v) } })
            put("TIER_LABEL", buildJsonObject { Catalog.TIER_LABEL.forEach { (k, v) -> put(k.toString(), v) } })
            put("TIER_DESC", buildJsonObject { Catalog.TIER_DESC.forEach { (k, v) -> put(k.toString(), v) } })
        }
        assertJsonEquivalent(js, actual, "catalog")
        // ลำดับมีผล (tieBreak เลือกตัวแรก / Object.keys ใช้เรียง split) — เทียบลำดับ key ด้วย
        assertEquals(js["SPLIT_DEFS"]!!.jsonObject.keys.toList(), Catalog.SPLIT_DEFS.keys.toList())
        assertEquals(js["PATTERN_LABEL"]!!.jsonObject.keys.toList(), Catalog.PATTERN_LABEL.keys.toList())
    }

    private fun stringListMap(m: Map<String, List<String>>) = buildJsonObject {
        m.forEach { (k, v) -> put(k, JsonArray(v.map { JsonPrimitive(it) })) }
    }

    @Test
    fun calculationsMatchJs() {
        loadGolden("calculations.json").forEachIndexed { i, c ->
            val input = c.jsonObject["input"]!!.jsonObject
            val bmr = Calculations.calculateBMR(
                jsNumber(input["weightKg"]), jsNumber(input["heightCm"]), jsNumber(input["age"]),
                input["sex"].stringOrNullJs(),
            )
            val factor = Calculations.activityFactorFromQ36(input["q36"].stringOrNullJs())
            val actual = buildJsonObject {
                put("bmr", jsonNum(bmr))
                put("factor", jsonNum(factor))
                put("tdee", jsonNum(Calculations.calculateTDEE(bmr, factor)))
            }
            assertJsonEquivalent(c.jsonObject["expected"]!!, actual, "calc[$i]")
        }
    }

    @Test
    fun benchmarksMatchJs() {
        loadGolden("benchmarks.json").forEachIndexed { i, c ->
            val input = c.jsonObject["input"]!!.jsonObject
            val weight = input["weight"].doubleOrNullJs()
            val reps = input["reps"].doubleOrNullJs()
            val bw = input["bodyweight"].doubleOrNullJs()
            val e1 = Benchmarks.calculateEstimated1RM(weight, reps)
            val perf = Benchmarks.classify(e1, input["benchmarkValueKg"].doubleOrNullJs())
            val history = (input["history"] as JsonArray).map {
                E1rmEntry(it.jsonObject["date"].stringOrNullJs()!!, it.jsonObject["e1rm"].doubleOrNullJs())
            }
            val sets = (input["sets"] as JsonArray).map { s ->
                (s as? JsonObject)?.let { LoggedSet(it["weight"].doubleOrNullJs(), it["reps"].doubleOrNullJs()) }
            }
            val progress = Benchmarks.calculatePersonalProgress(e1, history)
            val assessment = Benchmarks.pickAssessmentSet(sets)
            val validation = Benchmarks.validateBenchmarkInput(
                weight, reps, bw, input["exercise"].stringOrNullJs(), input["sex"].stringOrNullJs(),
            )
            val actual = buildJsonObject {
                put("e1rm", jsonNum(e1))
                put("relativeStrength", jsonNum(Benchmarks.calculateRelativeStrength(e1, bw)))
                put("performanceLevel", perf.level.name)
                put("performanceRatio", jsonNum(perf.ratio))
                put("progress", progress?.let {
                    buildJsonObject {
                        put("baselineDate", it.baselineDate)
                        put("baselineE1rm", it.baselineE1rm); put("currentE1rm", it.currentE1rm)
                        put("deltaKg", it.deltaKg); put("deltaPct", it.deltaPct)
                        put("deltaKgRaw", it.deltaKgRaw); put("deltaPctRaw", it.deltaPctRaw)
                        put("direction", it.direction)
                    }
                } ?: kotlinx.serialization.json.JsonNull)
                put("assessment", assessment?.let {
                    buildJsonObject {
                        put("weight", it.weight); put("reps", it.reps); put("e1rm", it.e1rm)
                        put("lowConfidence", it.lowConfidence)
                    }
                } ?: kotlinx.serialization.json.JsonNull)
                put("validation", buildJsonObject {
                    put("valid", validation.valid)
                    put("issues", JsonArray(validation.issues.map { JsonPrimitive(it) }))
                })
            }
            assertJsonEquivalent(c.jsonObject["expected"]!!, actual, "bench[$i]")
        }
    }

    @Test
    fun generatorMatchesJs() {
        loadGolden("generator.json").forEachIndexed { i, c ->
            val a = Answers(c.jsonObject["answers"]!!.jsonObject)
            val plan = goldenJson.decodeFromJsonElement<PlanOverrides>(c.jsonObject["plan"]!!)
            val expected = c.jsonObject["expected"]!!.jsonObject
            val gate = Generator.safetyGate(a)
            val actual = buildJsonObject {
                put("inScope", Generator.inScope(a))
                put("sanityIssues", JsonArray(Generator.sanityIssues(a).map { JsonPrimitive(it) }))
                put("safetyGate", buildJsonObject {
                    put("blocked", gate.blocked)
                    gate.reason?.let { put("reason", it) }
                })
                put("targets", goldenJson.encodeToJsonElement(Generator.computeTargets(a)))
                put("picks", buildJsonObject {
                    Catalog.PATTERN_LABEL.keys.forEach { p -> put(p, Generator.selectionFor(p, a, plan).picked?.id) }
                })
                put("splitFeasibility", buildJsonObject {
                    Generator.splitFeasibility(a).forEach { (k, f) ->
                        put(k, buildJsonObject {
                            put("eligible", f.eligible); put("recommended", f.recommended); put("minDays", f.minDays)
                        })
                    }
                })
                put("effectiveSplit", Generator.effectiveSplit(a, plan))
                put("planAfter", goldenJson.encodeToJsonElement(Generator.sanitizeOverrides(a, plan)))
                put("adjacencyWarning", Generator.weekdayAdjacencyWarning(a.list("Q2")))
                put("snapshot", goldenJson.encodeToJsonElement(Generator.buildPlanSnapshot(a, plan)))
            }
            assertJsonEquivalent(expected, actual, "generator[$i]")
        }
    }
}
