package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertTrue
import org.junit.Test

/** เทียบการแก้แผน (เลือกรูปแบบ/วันฝึก/cardio/ความเข้มข้น/ด่านเริ่มโปรแกรม/ความครอบคลุม) กับ app.js ตัวจริง (golden/planedit.json) */
class PlanEditParityTest {
    private val lenient = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private fun strs(xs: List<String>) = JsonArray(xs.map { JsonPrimitive(it) })
    private fun planJson(p: PlanOverrides) = goldenJson.encodeToJsonElement(p).jsonObject

    @Test
    fun planEditingMatchesJs() {
        val cases = loadGolden("planedit.json")
        assertTrue(cases.size >= 140)
        var drafts = 0
        var blocks = 0
        cases.forEachIndexed { i, c ->
            val o = c.jsonObject
            val a = Answers(o["answers"]!!.jsonObject)
            val plan = goldenJson.decodeFromJsonElement<PlanOverrides>(o["plan"]!!)
            val e = o["expected"]!!.jsonObject
            val split = Generator.effectiveSplit(a, plan)
            val days = Generator.planTrainDays(a, plan)
            val actual = buildJsonObject {
                put("gate", PlanEditing.startGateError(a, plan))
                put("split", split)
                put("trainDays", strs(days))
                put("coverage", strs(PlanEditing.planCoverage(split, days, a, plan)))
                put("choose", buildJsonObject {
                    (listOf("auto") + Catalog.SPLIT_DEFS.keys).forEach { k ->
                        val r = PlanEditing.chooseSplit(plan, a, if (k == "auto") null else k)
                        put(k, buildJsonObject {
                            put("splitOverride", r.splitOverride)
                            put("trainDays", r.trainDays?.let { strs(it) } ?: JsonNull)
                            put("manualPick", goldenJson.encodeToJsonElement(r.manualPick))
                        })
                    }
                })
                put("intensityAll", buildJsonObject {
                    put("on", goldenJson.encodeToJsonElement(PlanEditing.setIntensityAll(plan, a, true).intensity))
                    put("off", goldenJson.encodeToJsonElement(PlanEditing.setIntensityAll(plan, a, false).intensity))
                })
                o["program"]?.let { pj ->
                    val p = lenient.decodeFromJsonElement<Program>(pj)
                    put("program", buildJsonObject {
                        put("coverage", strs(PlanEditing.programCoverage(p)))
                        put("outdated", PlanEditing.planOutdated(p))
                        put("clash", PlanEditing.programClash(p)?.let { cl -> buildJsonObject { put("from", cl.from); put("to", cl.to); put("groups", strs(cl.groups)) } } ?: JsonNull)
                        put("avail", strs(PlanEditing.progAvailDays(p, a)))
                    })
                    val dj = e["draft"]!!.jsonObject["input"]!!.jsonObject
                    val dr = SchedDraft(
                        dj["days"]!!.jsonArray.map { it.jsonPrimitive.content }, dj["cardioDays"]!!.jsonArray.map { it.jsonPrimitive.content },
                        dj["cardioMinByDay"]!!.jsonObject.mapValues { it.value.jsonPrimitive.double },
                    )
                    val res = PlanEditing.schedDraftNext(p, dr, a)
                    drafts++
                    put("draft", buildJsonObject {
                        put("input", dj)
                        put("result", if (res.error != null) buildJsonObject { put("error", res.error) } else buildJsonObject {
                            val n = res.next!!
                            put("days", strs(n.days)); put("dayToSession", goldenJson.encodeToJsonElement(n.dayToSession))
                            put("cardioDays", strs(n.cardioDays)); put("cardioMinByDay", goldenJson.encodeToJsonElement(n.cardioMinByDay))
                            put("availableDays", strs(n.availableDays ?: emptyList()))
                        })
                    })
                    put("block", JsonArray(e["block"]!!.jsonArray.map { b ->
                        val bo = b.jsonObject
                        val lst = bo["list"]!!.jsonArray.map { it.jsonPrimitive.content }
                        val d = bo["day"]!!.jsonPrimitive.content
                        blocks++
                        buildJsonObject {
                            put("list", bo["list"]!!); put("day", d)
                            put("msg", PlanEditing.trainDayBlockMsg(p.sessions.map { Schedule.of(it) }, lst, d))
                            put("msgSplit", PlanEditing.trainDayBlockMsg(Schedule.ofSplit(split), lst, d))
                        }
                    }))
                    val sp = PlanEditing.seedPlanFromProgram(plan, p)
                    put("seed", buildJsonObject {
                        put("trainDays", strs(sp.trainDays ?: emptyList())); put("cardioDays", strs(sp.cardioDays))
                        put("cardioMinByDay", goldenJson.encodeToJsonElement(sp.cardioMinByDay)); put("intensity", goldenJson.encodeToJsonElement(sp.intensity))
                    })
                }
            }
            assertJsonEquivalent(e, actual, "planedit[$i]")
        }
        assertTrue(drafts > 100 && blocks > 200)
    }
}
