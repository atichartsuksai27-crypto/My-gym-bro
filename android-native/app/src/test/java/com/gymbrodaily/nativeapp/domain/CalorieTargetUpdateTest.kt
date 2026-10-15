package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.int
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/** banner เสนอเป้าแคลอรี่ใหม่ให้แผนเก่า (F-02) — พฤติกรรมเทียบเว็บอยู่ที่ ProgressGoalParityTest (golden); ที่นี่ตรึงกฎและการเขียน payload */
class CalorieTargetUpdateTest {
    private val lenient = Json { ignoreUnknownKeys = true; coerceInputValues = true }
    private val today = "2026-10-15"

    private fun answers(goal: String) = Answers(
        buildJsonObject {
            put("Q9", "หญิง"); put("Q10", 24); put("Q11", 162.1); put("Q12", 52); put("Q16", "นักกีฬา-เทรนมานาน"); put("Q36", "นั่งโต๊ะเป็นหลัก")
            put("Q3", "45-60 นาที"); put("Q1", goal); put("Q5b", "ได้ (เน้นสร้างกล้ามให้เร็ว)"); put("Q6", "ห่างปานกลาง")
            put("Q2", JsonArray(Catalog.DAYS.take(5).map { JsonPrimitive(it) }))
        },
    )

    private fun snapshot(a: Answers): JsonObject =
        Json { encodeDefaults = true }.encodeToJsonElement(PlanSnapshot.serializer(), Generator.buildPlanSnapshot(a, PlanOverrides())).jsonObject

    /** แผนเก่า: เป้าล็อกด้วยสูตรเก่า (TDEE ล้วน) + ฟิลด์ที่ native ไม่รู้จัก (ต้องไม่หายตอนกดใช้/ข้าม) */
    private fun oldPlanRaw(a: Answers, mutate: (MutableMap<String, JsonElement>) -> Unit = {}): JsonObject {
        val snap = snapshot(a)
        val targets = JsonObject(snap["targets"]!!.jsonObject + mapOf("kcal" to JsonPrimitive(1500), "tdee" to JsonPrimitive(1500), "webOnly" to JsonPrimitive("keep")))
        val m = (
            snap + mapOf(
                "targets" to targets, "startDate" to JsonPrimitive("2026-09-01"), "planId" to JsonPrimitive("x"),
                "warmupPrefs" to buildJsonObject { put("x", 1) }, // field ที่เว็บเขียนเอง native ไม่รู้จัก
            )
            ).toMutableMap()
        mutate(m)
        return JsonObject(m)
    }

    private fun track(raw: JsonObject, a: Answers) = TrackData(program = lenient.decodeFromJsonElement<Program>(raw), answers = a)

    @Test fun oldMaintenancePlanIsOfferedAHigherTarget() {
        val a = answers("รักษาสุขภาพทั่วไป")
        val t = track(oldPlanRaw(a), a)
        val u = CalorieTargetUpdate.of(t, today)
        assertNotNull(u)
        assertTrue(u!!.kcal >= 1550)
        assertTrue(CalorieTargetUpdate.text(t.program, u).contains("เดิมเป้าไม่รวมแคลที่เผาจากการฝึก"))
    }

    @Test fun seenFlagsIncludingLegacyWebNamesSuppressTheBanner() {
        val a = answers("รักษาสุขภาพทั่วไป")
        listOf("targetFormulaSeen", "recompTargetSeen", "calcTargetSeen").forEach { flag ->
            val raw = oldPlanRaw(a) { it[flag] = JsonPrimitive(true) }
            assertNull(flag, CalorieTargetUpdate.of(track(raw, a), today))
        }
    }

    @Test fun adjustedOrCurrentFormulaPlansAreSkipped() {
        val a = answers("รักษาสุขภาพทั่วไป")
        val adjusted = oldPlanRaw(a) { it["pg"] = buildJsonObject { put("adjustments", JsonArray(listOf(buildJsonObject { put("date", "2026-10-01") }))) } }
        assertNull(CalorieTargetUpdate.of(track(adjusted, a), today))
        assertNull(CalorieTargetUpdate.of(track(oldPlanRaw(a) { it["calcV"] = JsonPrimitive(2) }, a), today))
    }

    @Test fun planWithoutCalcVIsEligibleOnceTheRealProgramDiffersByFiftyKcal() {
        val a = answers("รักษาสุขภาพทั่วไป")
        val fresh = snapshot(a)
        assertNull("แผน native ที่เพิ่งสร้างและตรงกับแผนจริง → ไม่มี banner", CalorieTargetUpdate.of(track(fresh, a), today))
        // ผู้ใช้เปลี่ยนตารางเหลือ 2 วัน → แคลฝึกจากโปรแกรมจริงต่ำลง → เป้าแม่นขึ้นต่างจากเดิม ≥ 50
        val fewer = JsonObject(fresh + ("days" to JsonArray(Catalog.DAYS.take(2).map { JsonPrimitive(it) })))
        val t = track(fewer, a)
        val u = CalorieTargetUpdate.of(t, today)
        assertNotNull(u)
        assertTrue(u!!.kcal < t.program.targets!!.kcal!!)
    }

    @Test fun applyWritesOnlyTargetsCalcVAndEvalFromAndKeepsEverythingElse() {
        val a = answers("รักษาสุขภาพทั่วไป")
        val raw = oldPlanRaw(a) {
            it["pg"] = buildJsonObject { put("confirmedAt", "2026-10-10"); put("resets", JsonArray(listOf(JsonPrimitive("2026-09-20")))) }
        }
        val t = track(raw, a)
        val u = CalorieTargetUpdate.of(t, today)!!
        val out = CalorieTargetUpdate.applyTo(raw, t, u, today)
        val nt = out["targets"]!!.jsonObject
        assertEquals(u.kcal, nt["kcal"]!!.jsonPrimitive.int)
        assertEquals(u.tdee, nt["tdee"]!!.jsonPrimitive.int)
        assertEquals(raw["targets"]!!.jsonObject["proteinG"], nt["proteinG"]) // โปรตีนคงเดิม
        assertEquals("keep", nt["webOnly"]!!.jsonPrimitive.content)
        assertEquals(CALC_VERSION, out["calcV"]!!.jsonPrimitive.int)
        assertEquals(today, out["pg"]!!.jsonObject["evalFrom"]!!.jsonPrimitive.content)
        assertEquals("2026-10-10", out["pg"]!!.jsonObject["confirmedAt"]!!.jsonPrimitive.content) // pg อื่นคงเดิม
        assertEquals(1, out["pg"]!!.jsonObject["resets"]!!.jsonArray.size)
        assertEquals(raw["warmupPrefs"], out["warmupPrefs"])
        assertEquals(raw["sessions"], out["sessions"])
        assertNull("หลังใช้แล้วไม่เสนอซ้ำ", CalorieTargetUpdate.of(track(out, a), today))
    }

    @Test fun skipStampsTargetFormulaSeenAndNothingElse() {
        val a = answers("รักษาสุขภาพทั่วไป")
        val raw = oldPlanRaw(a)
        val out = CalorieTargetUpdate.skipped(raw)
        assertTrue(out["targetFormulaSeen"]!!.jsonPrimitive.boolean)
        assertEquals(raw.keys + "targetFormulaSeen", out.keys)
        assertEquals(raw["targets"], out["targets"])
        assertNull(CalorieTargetUpdate.of(track(out, a), today))
    }

    @Test fun programReadsTheNewFlagAndTheLegacyWebFlags() {
        val p = lenient.decodeFromJsonElement<Program>(
            buildJsonObject { put("targetFormulaSeen", true); put("calcTargetSeen", true); put("recompTargetSeen", true); put("calcV", 2) },
        )
        assertTrue(p.targetFormulaSeen && p.calcTargetSeen && p.recompTargetSeen)
        assertEquals(2, p.calcV)
        assertFalse(CalorieTargetUpdate.seen(lenient.decodeFromJsonElement<Program>(buildJsonObject { })))
    }
}
