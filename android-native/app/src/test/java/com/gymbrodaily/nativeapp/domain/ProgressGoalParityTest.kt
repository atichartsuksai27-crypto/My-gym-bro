package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.double
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test

/** เทียบแถบไขมัน + กรอบแผน Progression & Goal กับ app.js ตัวจริง (golden/progress.json จาก tools/make-golden.js) */
class ProgressGoalParityTest {

    private val lenient = kotlinx.serialization.json.Json { ignoreUnknownKeys = true; coerceInputValues = true }

    private fun strs(xs: List<String>) = JsonArray(xs.map { JsonPrimitive(it) })

    @Test
    fun progressMatchesJs() {
        val cases = loadGolden("progress.json")
        assertEquals(220, cases.size)
        cases.forEachIndexed { i, c ->
            val o = c.jsonObject
            val today = o["today"]!!.jsonPrimitive.content
            val t = TrackData(
                program = lenient.decodeFromJsonElement<Program>(o["program"]!!),
                logs = o["logs"]!!.jsonObject.mapValues { lenient.decodeFromJsonElement<DailyLog>(it.value) },
                weights = o["weights"]!!.jsonObject.mapValues { it.value.jsonObject["kg"]!!.jsonPrimitive.double },
                answers = Answers(o["answers"]!!.jsonObject),
            )
            val fat = ProgressGoal.fatTug(t, today)
            val ev = ProgressGoal.current(t, today)
            val rec = ProgressGoal.recommend(t, ev)
            val eta = ProgressGoal.eta(t, ev, today)
            val now = ProgressGoal.nowKg(ev)
            val actual = buildJsonObject {
                put("fat", buildJsonObject {
                    put("acc", fat.acc)
                    put("gains", strs(fat.gains)); put("losses", strs(fat.losses))
                    put("days", JsonArray(fat.days.map { d ->
                        buildJsonObject {
                            put("date", d.date); put("kcal", d.kcal); put("tdee", d.tdee); put("ex", d.ex)
                            put("burn", d.burn); put("bal", d.bal); put("ev", d.ev)
                        }
                    }))
                })
                put("level", ev.level.key); put("persisted", ev.persisted); put("run", ev.run); put("confirmed", ev.confirmed)
                put("anchor", ev.anchor); put("ws", ev.ws); put("refKg", ev.refKg); put("elapsed", ev.elapsed)
                put("plan", buildJsonObject { put("c", ev.plan.c); put("lo", ev.plan.lo); put("hi", ev.plan.hi); put("exPerDay", ev.plan.exPerDay) })
                put("reg", ev.reg?.let { r -> buildJsonObject { put("a", r.a); put("b", r.b); put("se", r.se); put("n", r.n) } } ?: JsonNull)
                put("history", JsonArray(ev.history.map { h -> buildJsonObject { put("week", h.week); put("date", h.date); put("level", h.level.key) } }))
                put("weight", buildJsonObject { put("level", ev.weight.level.key); put("text", ev.weight.text); put("why", ev.weight.why) })
                put("energy", buildJsonObject {
                    put("level", ev.energy.level.key); put("text", ev.energy.text); put("implied", jsonNum(ev.energy.implied))
                })
                put("strength", buildJsonObject {
                    put("level", ev.strength.level.key); put("text", ev.strength.text); put("why", ev.strength.why)
                    put("lifts", JsonArray(ev.strength.lifts.map { l -> buildJsonObject { put("id", l.ex.id); put("pct", l.pct); put("level", l.level.key) } }))
                })
                put("issues", JsonArray(ev.issues.map { x -> buildJsonObject { put("lvl", x.lvl); put("text", x.text) } }))
                put("causes", strs(ev.causes))
                put("summary", ProgressGoal.summaryText(ev))
                put("goalLine", ProgressGoal.goalLine(t, ev.plan))
                put("now", now?.let { n -> buildJsonObject { put("kg", n.kg); put("how", n.how) } } ?: JsonNull)
                put("eta", eta?.let { e ->
                    buildJsonObject {
                        put("goal", e.goal)
                        if (e.done) put("done", true)
                        if (e.mismatch) put("mismatch", true)
                        e.weeks?.let { put("weeks", it) }
                        e.date?.let { put("date", it) }
                        e.fast?.let { put("fast", it) }
                        if (e.weeks != null) put("slow", jsonNum(e.slow))
                    }
                } ?: JsonNull)
                put("rec", buildJsonObject {
                    put("kcal", rec.kcal)
                    put("text", strs(rec.text))
                    rec.eaBlocked?.let { e ->
                        put("eaBlocked", buildJsonObject {
                            put("minEA", e.minEA); put("ea", e.ea); put("wouldBe", e.wouldBe)
                            put("minKcal", e.minKcal); put("ffm", e.ffm); put("src", e.src)
                        })
                    }
                    if (rec.floor != null) { put("floor", rec.floor); put("want", rec.want); put("belowFloor", rec.belowFloor) }
                    if (rec.kcal != null) { put("capped", rec.capped); put("tdee", rec.tdee) }
                })
            }
            assertJsonEquivalent(o["expected"]!!, actual, "progress[$i]")
            assertCalorieUpdate(o, t, today, i)
        }
        assertTrue("ต้องมีเคสที่เสนอเป้าใหม่ทั้งขึ้นและลง", offers.any { it > 0 } && offers.any { it < 0 } && offers.size >= 100)
    }

    /** เคสที่ยังมีเป้าเก่า/ธงต่างๆ — ผลของ CalorieTargetUpdate (เสนอหรือไม่เสนอ + ข้อความ) ต้องตรงกับ calorieTargetUpdate ของเว็บ */
    private val offers = mutableListOf<Int>()

    private fun assertCalorieUpdate(o: kotlinx.serialization.json.JsonObject, t: TrackData, today: String, i: Int) {
        val c = o["calorie"]!!.jsonObject
        val patch = c["patch"]!!.jsonObject
        fun intOrNull(k: String) = patch[k]?.takeIf { it !is JsonNull }?.jsonPrimitive?.double?.toInt()
        val flag = patch["flag"]?.takeIf { it !is JsonNull }?.jsonPrimitive?.content
        val p = t.program
        val stale = p.copy(
            targets = p.targets?.copy(kcal = intOrNull("kcal"), tdee = intOrNull("tdee")),
            calcV = intOrNull("calcV") ?: p.calcV,
            targetFormulaSeen = flag == "targetFormulaSeen",
            targetFormulaSeenV = intOrNull("flagV"),
            recompTargetSeen = flag == "recompTargetSeen",
            calcTargetSeen = flag == "calcTargetSeen",
        )
        val st = t.copy(program = stale)
        val u = CalorieTargetUpdate.of(st, today)
        val actual = if (u == null) JsonNull else buildJsonObject {
            put("kcal", u.kcal); put("tdee", u.tdee); put("direction", u.direction); put("floored", u.floored); put("eaLimited", u.eaLimited)
            put("text", CalorieTargetUpdate.text(stale, u))
        }
        assertJsonEquivalent(c["expected"]!!, actual, "progress[$i].calorie(mode ${patch["mode"]})")
        if (u != null && stale.targets?.kcal != null) offers += u.kcal - stale.targets!!.kcal!!

        // กด "ใช้เป้าใหม่": payload ที่ native เขียน (targets / calcV / pg) ต้องเท่ากับที่เว็บ calorieApply เขียน — แผนเดียวกันที่ sync ข้ามเครื่อง
        val applied = c["applied"]
        if (u != null && applied != null && applied !is JsonNull) {
            val raw = o["program"]!!.jsonObject
            val rawTargets = JsonObject(
                (raw["targets"]?.jsonObject ?: JsonObject(emptyMap())) +
                    mapOf("kcal" to (stale.targets?.kcal?.let { JsonPrimitive(it) } ?: JsonNull), "tdee" to (stale.targets?.tdee?.let { JsonPrimitive(it) } ?: JsonNull)),
            )
            val staleRaw = JsonObject(
                raw + mapOf("targets" to rawTargets) +
                    (flag?.let { mapOf(it to JsonPrimitive(true)) } ?: emptyMap()) +
                    (intOrNull("calcV")?.let { mapOf("calcV" to JsonPrimitive(it)) } ?: emptyMap()),
            )
            val out = CalorieTargetUpdate.applyTo(staleRaw, st, u, today)
            val actualApplied = buildJsonObject { put("targets", out["targets"]!!); put("calcV", out["calcV"]!!); put("pg", out["pg"]!!) }
            assertJsonEquivalent(applied, actualApplied, "progress[$i].calorie.applied")
        }
    }
}
