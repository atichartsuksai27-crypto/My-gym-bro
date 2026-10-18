package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
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
        assertEquals(631, loadGolden("targets.json").size) // 600 สุ่ม + 7 เคส P4 ตายตัว + 24 เคสขอบ BMI 30
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
                    if (e.timed) put("timed", true)
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
            put("CATEGORIES", JsonArray(Questions.CATEGORIES.map {
                buildJsonObject { put("id", it.id); put("name", it.name); put("short", it.short) }
            }))
            put("BENCH", buildJsonObject {
                Questions.BENCH.forEach { (k, b) ->
                    put(k, buildJsonObject {
                        put("days", JsonArray(listOf(JsonPrimitive(b.days.first), JsonPrimitive(b.days.last))))
                        put("mins", JsonArray(listOf(JsonPrimitive(b.mins.first), JsonPrimitive(b.mins.last))))
                        put("label", b.label)
                    })
                }
            })
            put("Q3_MIN", buildJsonObject { Questions.Q3_MIN.forEach { (k, v) -> put(k, v) } })
            put("QUESTIONS", JsonArray(Questions.QUESTIONS.map { q ->
                buildJsonObject {
                    put("id", q.id); put("cat", q.cat); put("kind", q.kind.name.lowercase()); put("main", q.main)
                    put("label", q.label); put("options", JsonArray(q.options.map { JsonPrimitive(it) }))
                    put("note", q.note); put("branchFrom", q.branchFrom); put("required", q.required)
                    put("unit", q.unit); put("exclusiveOption", q.exclusiveOption)
                }
            }))
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
            val bf = input["bodyFatPct"]?.takeIf { it !is kotlinx.serialization.json.JsonNull }?.let { jsNumber(it) }
            val bmr = Calculations.calculateBMRForProfile(
                jsNumber(input["weightKg"]), jsNumber(input["heightCm"]), jsNumber(input["age"]),
                input["sex"].stringOrNullJs(), bf,
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
                put("targets", goldenJson.encodeToJsonElement(Generator.computeTargets(a, plan)))
                put("picks", buildJsonObject {
                    Catalog.PATTERN_LABEL.keys.forEach { p -> put(p, Generator.selectionFor(p, a, plan).picked?.id) }
                })
                put("trainDays", JsonArray(Generator.planTrainDays(a, plan).map { JsonPrimitive(it) }))
                put("cardioDays", JsonArray(Generator.planCardioDays(a, plan).map { JsonPrimitive(it) }))
                put("minTrain", buildJsonObject { Catalog.SPLIT_DEFS.keys.forEach { k -> put(k, Schedule.minTrainDays(k, a.list("Q2"))) } })
                put("schedules", buildJsonObject {
                    Catalog.SPLIT_DEFS.keys.forEach { k ->
                        val r = Schedule.bestSchedule(Schedule.ofSplit(k), Generator.planTrainDays(a, plan))
                        put(k, buildJsonObject {
                            put("list", JsonArray(r.list.map { x -> buildJsonObject { put("day", x.day); put("session", x.session) } }))
                            put("hard", r.hard); put("soft", r.soft)
                            put("clash", r.clash?.let { c -> buildJsonObject { put("from", c.from); put("to", c.to); put("groups", JsonArray(c.groups.map { g -> JsonPrimitive(g) })) } } ?: kotlinx.serialization.json.JsonNull)
                            put("text", r.clash?.let { Schedule.clashText(it) })
                        })
                    }
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

    /** เป้าแคลอรี่ตามเป้าหมาย (รวม F-02: maintenance = TDEE + แคลฝึกตามแผน) ต้องตรงกับเว็บ */
    @Test
    fun targetsMatchJs() {
        val cases = loadGolden("targets.json")
        var maintenance = 0
        cases.forEachIndexed { i, c ->
            val a = Answers(c.jsonObject["answers"]!!.jsonObject)
            val plan = goldenJson.decodeFromJsonElement<PlanOverrides>(c.jsonObject["plan"]!!)
            if (a.str("Q1") == "รักษาสุขภาพทั่วไป") maintenance++
            assertJsonEquivalent(c.jsonObject["expected"]!!, goldenJson.encodeToJsonElement(Generator.computeTargets(a, plan)), "targets[$i]")
        }
        assertTrue("ต้องมีเคส maintenance พอ", maintenance >= 150)
        assertTrue("ต้องมีเคสที่พื้น EA ดันเป้าขึ้นตอนสร้างแผน", cases.count { it.jsonObject["expected"]!!.jsonObject["eaLimited"]!!.jsonPrimitive.boolean } >= 5)
    }

    /** P4: หญิง 24 ปี ฝึกมา 8 ปี TDEE ~1,753 ฝึก 5 วัน — ด่าน EA ตอนสร้างแผน (เคสตายตัว 7 เคสท้าย targets.json) */
    private fun p4(goal: String, extra: Map<String, JsonElement> = emptyMap()) = Answers(
        buildJsonObject {
            put("Q9", "หญิง"); put("Q10", 24); put("Q11", 162.1); put("Q12", 52); put("Q16", "นักกีฬา-เทรนมานาน"); put("Q20", "ฟิตเนส-ยิม")
            put("Q22", "ครบมาก"); put("Q36", "นั่งโต๊ะเป็นหลัก"); put("Q3", "45-60 นาที"); put("Q4a", "เข้มข้น"); put("Q6", "ห่างปานกลาง")
            put("Q5b", "ได้ (เน้นสร้างกล้ามให้เร็ว)"); put("Q37", 7); put("Q1", goal)
            put("Q2", JsonArray(Catalog.DAYS.take(5).map { JsonPrimitive(it) }))
            extra.forEach { (k, v) -> put(k, v) }
        },
    )

    private fun eaOf(a: Answers, kcal: Int, plan: PlanOverrides = PlanOverrides()): Double {
        val kg = a.parseFloat("Q12")
        val ffm = ProgressGoal.ffmFromAnswers(a, kg, a.str("Q9"))!!
        return Calculations.calculateEnergyAvailability(kcal.toDouble(), Generator.plannedExFromAnswers(a, kg, plan).toDouble(), ffm.ffm)!!
    }

    @Test
    fun p4IntenseCutKeepsEaAtOrAboveThirty() {
        val a = p4("ลดไขมัน")
        val t = Generator.computeTargets(a)
        assertTrue("TDEE ${t.tdee}", Math.abs(t.tdee!! - 1753) <= 1)
        assertTrue("EA ${eaOf(a, t.kcal!!)}", eaOf(a, t.kcal!!) >= Calculations.EA_MIN_CUT - 1e-9)
    }

    @Test
    fun p4MaintenanceIsTdeePlusPlannedTraining() {
        val a = p4("รักษาสุขภาพทั่วไป")
        val t = Generator.computeTargets(a)
        val ex = Generator.plannedExFromAnswers(a, 52.0)
        assertTrue(ex > 0)
        assertEquals(t.tdee!! + ex, t.kcal!!)
        assertFalse(t.eaLimited)
    }

    @Test
    fun heavyLoadPushesCutUpToEaMinimumAndExplainsWhy() {
        val a = p4(
            "ลดไขมัน",
            mapOf(
                "Q2" to JsonArray(Catalog.DAYS.map { JsonPrimitive(it) }), "Q3" to JsonPrimitive("มากกว่า 60 นาที"),
                "Q14" to JsonPrimitive("ทราบ (กรอกตัวเลข)"), "Q14_val" to JsonPrimitive(12),
            ),
        )
        val every = Catalog.DAYS
        val plan = PlanOverrides(trainDays = every, cardioDays = every, cardioMinByDay = every.associateWith { 60.0 }) // ฝึกหนักทุกวัน + cardio ทุกวัน
        val t = Generator.computeTargets(a, plan)
        val kg = 52.0
        val ffm = ProgressGoal.ffmFromAnswers(a, kg, "หญิง")!!
        val minKcal = Math.ceil((30 * ffm.ffm + Generator.plannedExFromAnswers(a, kg, plan)) / 10).toInt() * 10
        assertTrue(t.eaLimited)
        assertTrue(t.kcalFloored)
        assertEquals(minKcal, t.kcal)
        assertTrue(eaOf(a, t.kcal!!, plan) >= Calculations.EA_MIN_CUT - 1e-9)
        assertTrue(t.kcalDirection, "energy availability" in t.kcalDirection && "FFM" in t.kcalDirection && "ส่วนที่ขาดจริง" in t.kcalDirection)
    }

    @Test
    fun eaGuardNeverLowersGainOrMaintenanceTargets() {
        listOf("เพิ่มกล้ามเนื้อ", "รักษาสุขภาพทั่วไป").forEach {
            val t = Generator.computeTargets(p4(it))
            assertFalse(it, t.eaLimited)
            assertFalse(it, t.kcalFloored)
        }
    }
}
