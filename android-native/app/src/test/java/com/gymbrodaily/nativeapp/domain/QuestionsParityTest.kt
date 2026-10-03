package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import org.junit.Assert.assertEquals
import org.junit.Test

/** เทียบคลังคำถาม/เงื่อนไขการแสดงผล/การกดตัวเลือกกับ app.js ตัวจริง (golden/questions.json) */
class QuestionsParityTest {

    @Test
    fun questionsMatchJs() {
        val cases = loadGolden("questions.json")
        assertEquals(400, cases.size)
        cases.forEachIndexed { i, c ->
            val o = c.jsonObject
            val a = Answers(o["answers"]!!.jsonObject)
            var after = a
            (o["ops"] as JsonArray).forEach { op ->
                after = Questions.setAnswer(after, op.jsonObject["id"]!!.jsonPrimitive.content, op.jsonObject["value"]!!.jsonPrimitive.content)
            }
            val actual = buildJsonObject {
                put("visible", buildJsonObject {
                    for (cat in 1..9) put(cat.toString(), JsonArray(Questions.visibleQsFor(cat, a).map { JsonPrimitive(it.id) }))
                })
                put("complete", buildJsonObject { for (cat in 1..9) put(cat.toString(), Questions.catComplete(cat, a)) })
                put("answered", Questions.countAnswered(a))
                put("visibleTotal", Questions.countVisibleTotal(a))
                put("afterOps", after.json)
            }
            assertJsonEquivalent(o["expected"]!!, actual, "questions[$i]")
        }
    }

    @Test
    fun exclusiveOptionClearsOthers() {
        var a = Answers()
        a = Questions.setAnswer(a, "Q21", "ดัมเบล")
        a = Questions.setAnswer(a, "Q21", "บาร์เบล")
        a = Questions.setAnswer(a, "Q21", "ไม่มีอุปกรณ์เลย")
        assertEquals(listOf("ไม่มีอุปกรณ์เลย"), a.list("Q21"))
        a = Questions.setAnswer(a, "Q21", "ดัมเบล")
        assertEquals(listOf("ดัมเบล"), a.list("Q21"))
    }

    @Test
    fun singleOptionTogglesOff() {
        var a = Questions.setAnswer(Answers(), "Q9", "ชาย")
        assertEquals("ชาย", a.str("Q9"))
        a = Questions.setAnswer(a, "Q9", "ชาย")
        assertEquals(null, a.raw("Q9"))
    }

    @Test
    fun goalOptionsFollowBenchOrder() =
        assertEquals(Questions.BENCH.keys.toList(), Questions.QUESTIONS.first { it.id == "Q1" }.options)
}
