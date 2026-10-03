package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test
import java.time.LocalDate

/** เทียบตรรกะติดตามผลกับ app.js ตัวจริง (golden/tracking.json จาก tools/make-golden.js) */
class TrackingParityTest {

    private val lenient = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true }

    @Test
    fun trackingMatchesJs() {
        val cases = loadGolden("tracking.json")
        assertEquals(120, cases.size)
        cases.forEachIndexed { i, c ->
            val o = c.jsonObject
            val today = LocalDate.parse(o["today"]!!.jsonPrimitive.content)
            val todayIso = today.toString()
            val t = TrackData(
                program = lenient.decodeFromJsonElement<Program>(o["program"]!!),
                logs = o["logs"]!!.jsonObject.mapValues { lenient.decodeFromJsonElement<DailyLog>(it.value) },
                weights = o["weights"]!!.jsonObject.mapValues { it.value.jsonObject["kg"]!!.jsonPrimitive.double },
                answers = Answers(o["answers"]!!.jsonObject),
            )
            val exp = o["expected"]!!.jsonObject
            val days = (exp["days"] as JsonArray).map { d ->
                val iso = d.jsonObject["iso"]!!.jsonPrimitive.content
                val counts = Tracking.dayCounts(t, iso)
                buildJsonObject {
                    put("iso", iso)
                    put("sessionKey", Tracking.sessionKeyFor(t.program, iso))
                    put("status", Tracking.dayStatus(t, iso, todayIso).key)
                    put("done", counts.done); put("total", counts.total)
                    if (d.jsonObject.containsKey("items")) {
                        put("items", JsonArray(Tracking.dayItems(t, iso).map {
                            buildJsonObject { put("group", it.group); put("key", it.key); put("done", it.done) }
                        }))
                    }
                }
            }
            val actual = buildJsonObject {
                put("days", JsonArray(days))
                put("streak", Tracking.streakOf(t, today))
                put("adherence", JsonArray(Tracking.weeklyAdherence(t, 8, today).map {
                    buildJsonObject { put("start", it.start); put("planned", it.planned); put("done", it.done); put("pct", it.pct) }
                }))
                put("weightSeries", JsonArray(Tracking.weightSeries(t).map {
                    buildJsonObject { put("date", it.date); put("kg", it.kg) }
                }))
                put("histories", buildJsonObject {
                    exp["histories"]!!.jsonObject.keys.forEach { id ->
                        put(id, JsonArray(Tracking.exerciseHistory(t, id).map(::historyJson)))
                    }
                })
                put("lastBest", buildJsonObject {
                    exp["lastBest"]!!.jsonObject.forEach { (id, q) ->
                        val qIso = q.jsonObject["iso"]!!.jsonPrimitive.content
                        put(id, buildJsonObject {
                            put("iso", qIso)
                            put("entry", Tracking.lastBestBefore(t, id, qIso)?.let(::historyJson) ?: JsonNull)
                        })
                    }
                })
                put("bodyweight", JsonArray((exp["bodyweight"] as JsonArray).map { b ->
                    val qIso = b.jsonObject["iso"]!!.jsonPrimitive.content
                    buildJsonObject { put("iso", qIso); put("kg", jsonNum(Tracking.bodyweightAsOf(t, qIso))) }
                }))
                put("milestones", JsonArray(Tracking.milestones(t, today).map {
                    buildJsonObject { put("t", it.title); put("on", it.on); put("sub", it.sub) }
                }))
            }
            assertJsonEquivalent(exp, actual, "tracking[$i]")
        }
    }

    private fun historyJson(h: HistoryEntry): JsonElement = buildJsonObject {
        put("date", h.date); put("weight", h.weight); put("reps", jsonNum(h.reps))
        put("e1rm", h.e1rm); put("volume", h.volume)
    }

    @Test
    fun restDayIsDoneOnlyWhenEveryItemIsDone() {
        val program = Program(days = listOf("จันทร์"), dayToSession = mapOf("จันทร์" to "Full Body"), startDate = "2026-09-01",
            targets = Targets(proteinG = 100, kcal = 2000, waterL = 2.0, meals = 1, sleepH = 7.5))
        val rest = "2026-09-29" // อังคาร = วันพัก
        val full = DailyLog(rest, nutrition = Nutrition(100.0, 2000.0, 2.0, listOf(true)), sleep = Sleep(7.0))
        val t = TrackData(program, logs = mapOf(rest to full), weights = mapOf(rest to 70.0))
        assertEquals(DayStatus.REST_DONE, Tracking.dayStatus(t, rest, "2026-10-03"))
        val missingWeight = t.copy(weights = emptyMap())
        assertEquals(DayStatus.REST, Tracking.dayStatus(missingWeight, rest, "2026-10-03"))
    }

    @Test
    fun fmt1MatchesToFixed() {
        assertEquals("1.0", Tracking.fmt1(1.0))
        assertEquals("0.0", Tracking.fmt1(-0.04))
        assertEquals("-1.2", Tracking.fmt1(-1.25))
        assertEquals("1.3", Tracking.fmt1(1.25))
        assertEquals("72.5", Tracking.fmt1(72.46))
    }
}
