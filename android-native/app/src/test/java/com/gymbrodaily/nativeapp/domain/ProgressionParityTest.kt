package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * เทียบ progressive overload อัตโนมัติ / warm-up / เวลาพัก / ความเข้มข้น / อาการหลังเล่น / วอร์มร่างกาย / ความเครียด
 * กับ app.js ตัวจริง (golden/progression.json จาก tools/make-golden.js)
 */
class ProgressionParityTest {
    private val lenient = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private fun num(x: Double?): JsonElement = jsonNum(x)
    private fun strs(xs: List<String>) = JsonArray(xs.map { JsonPrimitive(it) })
    private fun sets(xs: List<SetEntry?>) = JsonArray(xs.map { s -> if (s == null) JsonNull else buildJsonObject { put("weight", num(s.weight)); put("reps", num(s.reps)) } })

    private val root get() = loadGolden("progression.json")[0].jsonObject

    @Test
    fun progressionMatchesJs() {
        val cases = root["cases"]!!.jsonArray
        assertTrue(cases.size >= 60)
        var withPlan = 0
        cases.forEachIndexed { i, c ->
            val o = c.jsonObject
            val program = lenient.decodeFromJsonElement<Program>(o["program"]!!)
            val logs = o["logs"]!!.jsonObject.mapValues { lenient.decodeFromJsonElement<DailyLog>(it.value) }
            val t = TrackData(program, logs)
            val today = o["today"]!!.jsonPrimitive.content
            val exp = o["expected"]!!.jsonObject
            val lastDay = logs.keys.sorted().last()
            val expEx = exp["exercises"]!!.jsonArray.map { it.jsonObject }.associateBy { it["sess"]!!.jsonPrimitive.content + "|" + it["id"]!!.jsonPrimitive.content }
            program.sessions.forEach { s ->
                s.exercises.forEach { ex ->
                    val e = expEx.getValue(s.key + "|" + ex.id)
                    val plan = Progression.progressionPlan(t, ex, today)
                    if (plan != null) withPlan++
                    val prev = Tracking.lastBestBefore(t, ex.id, today)
                    val lastSets = logs[lastDay]?.exercises?.get(ex.id)?.sets ?: emptyList()
                    val kind = Progression.exKind(ex, Progression.cleanSets(lastSets))
                    val actual = buildJsonObject {
                        put("sess", s.key); put("id", ex.id)
                        put("plan", plan?.let { p ->
                            buildJsonObject {
                                put("kind", p.kind); put("sets", sets(p.sets)); put("base", sets(p.base))
                                put("change", p.change?.let { ch -> buildJsonObject { put("kind", ch.kind); put("from", num(ch.from)); put("to", num(ch.to)); put("inc", num(ch.inc)) } } ?: JsonNull)
                                put("note", p.note); put("tier", p.tier); put("step", num(p.step)); put("prevDate", p.prevDate); put("prevFeel", p.prevFeel)
                            }
                        } ?: JsonNull)
                        val r = Progression.restFor(ex)
                        put("rest", buildJsonObject { put("set", r.set); put("next", r.next) })
                        put("intense", Progression.isIntense(ex)); put("eligible", Progression.intensityEligible(ex))
                        put("prev", prev?.let { h -> buildJsonObject { put("date", h.date); put("weight", num(h.weight)); put("reps", num(h.reps)); put("e1rm", num(h.e1rm)) } } ?: JsonNull)
                        put("intenseNote", Progression.intenseNote(ex, prev))
                        put("setsText", Progression.setsText(lastSets, kind)); put("kind", kind)
                    }
                    assertJsonEquivalent(e, actual, "progression[$i].${ex.id}")
                }
            }
            program.sessions.forEach { s ->
                val wu = Progression.warmupStepsFor(s)
                val actualWu = buildJsonObject {
                    wu.forEach { (id, steps) ->
                        put(id, JsonArray(steps.map { st -> buildJsonObject { put("pct", num(st.pct)); put("reps", st.reps); put("note", st.note) } }))
                    }
                }
                assertJsonEquivalent(exp["warmup"]!!.jsonObject[s.key]!!, actualWu, "progression[$i].warmup.${s.key}")
                val prep = exp["prep"]!!.jsonObject[s.key]!!.jsonObject
                assertJsonEquivalent(prep["groups"]!!, strs(DayExtras.sessionGroups(s)), "progression[$i].prep.groups.${s.key}")
                assertJsonEquivalent(prep["warm"]!!, strs(DayExtras.warmTips(s)), "progression[$i].prep.warm.${s.key}")
                assertJsonEquivalent(prep["cool"]!!, strs(DayExtras.coolTips(s)), "progression[$i].prep.cool.${s.key}")
            }
        }
        assertTrue("ต้องมีเคสที่ระบบตั้งค่าให้จากครั้งก่อนมากพอ ($withPlan)", withPlan >= 300)
    }

    @Test
    fun warmupKgMatchesJs() {
        val kg = root["kg"]!!.jsonArray
        assertTrue(kg.size > 200)
        kg.forEach { c ->
            val o = c.jsonObject
            fun d(k: String) = o[k]?.takeIf { it !is JsonNull }?.jsonPrimitive?.double
            assertJsonEquivalent(o["kg"]!!, num(Progression.warmupKg(d("ref"), d("pct"), o["equip"]!!.jsonPrimitive.content)), "kg $o")
        }
    }

    @Test
    fun symptomAnalysisMatchesJs() {
        root["symptoms"]!!.jsonArray.forEach { c ->
            val o = c.jsonObject
            val text = o["text"]!!.jsonPrimitive.content
            val r = DayExtras.analyzeSymptom(text)
            assertEquals("level of '$text'", o["level"]!!.jsonPrimitive.content, r.level)
            assertJsonEquivalent(o["words"]!!, strs(r.words), "words of '$text'")
        }
    }

    @Test
    fun staticTextMatchesJs() {
        val st = root["static"]!!.jsonObject
        val info = buildJsonObject {
            DayExtras.SYMPTOM_INFO.forEach { (k, v) -> put(k, buildJsonObject { put("label", v.label); put("cls", v.cls); put("icon", v.icon); put("advice", v.advice) }) }
        }
        // cls ของ unknown ใน JS เป็น '' (ไม่มี class)
        assertJsonEquivalent(st["info"]!!, info, "symptomInfo")
        assertJsonEquivalent(st["chips"]!!, strs(DayExtras.SYMPTOM_CHIPS), "symptomChips")
        assertJsonEquivalent(st["stressChips"]!!, strs(DayExtras.STRESS_CHIPS), "stressChips")
        assertJsonEquivalent(
            st["stressLevels"]!!,
            JsonArray(DayExtras.STRESS_LEVELS.map { buildJsonObject { put("v", it.v); put("label", it.label); put("icon", it.icon) } }),
            "stressLevels",
        )
        assertJsonEquivalent(st["stressLabels"]!!, strs((0..6).map { DayExtras.stressLabel(it) }), "stressLabels")
    }
}
