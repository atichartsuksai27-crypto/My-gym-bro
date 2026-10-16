package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * kotlinx.serialization อ่าน {"x": null} เป็นออบเจกต์ JsonNull (ไม่ใช่ null ของ Kotlin) ส่วนคีย์ที่ไม่มีเลยคือ null
 * ผลที่คาดทุกบรรทัดมาจาก node: Number(null)=0, Number(undefined)=NaN, parseFloat(null)=NaN, !!null=false ฯลฯ
 */
class JsCompatTest {
    @Test fun numberOfNullAndMissing() {
        assertEquals(0.0, jsNumber(JsonNull), 0.0)
        assertTrue(jsNumber(null as kotlinx.serialization.json.JsonElement?).isNaN())
    }

    @Test fun parseFloatOfNullAndMissing() {
        assertTrue(jsParseFloat(JsonNull).isNaN())
        assertTrue(jsParseFloat(null as kotlinx.serialization.json.JsonElement?).isNaN())
    }

    @Test fun truthyOfNullAndMissing() {
        assertFalse(jsTruthy(JsonNull))
        assertFalse(jsTruthy(null))
    }

    @Test fun stringOfNullAndMissing() {
        assertEquals("null", jsString(JsonNull))
        assertEquals("undefined", jsString(null))
    }

    @Test fun numberVsParseFloatOnUnits() {
        assertTrue(jsNumber(JsonPrimitive("80kg")).isNaN())
        assertEquals(80.0, jsParseFloat(JsonPrimitive("80kg")), 0.0)
        assertEquals(0.0, jsNumber(JsonPrimitive("")), 0.0)
        assertTrue(jsParseFloat(JsonPrimitive("")).isNaN())
        assertEquals(1.0, jsNumber(JsonPrimitive(true)), 0.0)
        assertTrue(jsParseFloat(JsonPrimitive(true)).isNaN())
    }

    /** ชุดอักขระที่ ' '.trim() ของ node ตัดจริง (สแกนทั้ง BMP): 9–D, 20, A0, 1680, 2000–200A, 2028, 2029, 202F, 205F, 3000, FEFF */
    @Test fun jsTrimMatchesNode() {
        assertEquals("abc", jsTrim("﻿abc﻿"))
        assertEquals("abc", jsTrim("  abc　\n\t"))
        assertEquals("abc", jsTrim(" abc      "))
        assertEquals("\u001Cabc\u001F", jsTrim("\u001Cabc\u001F")) // Kotlin trim() ตัดสองตัวนี้ แต่ JS ไม่ตัด
        assertEquals("\u0085abc", jsTrim("\u0085abc"))
        assertEquals("᠎abc", jsTrim("᠎abc"))
        assertEquals("", jsTrim("  \t\n"))
    }

    @Test fun saveSymptomAndStressNoteUseJsTrim() {
        assertEquals("ปวดเข่า", DayActions.saveSymptom(null, "﻿ ปวดเข่า ﻿", "x").symptom!!.text)
        assertEquals("งาน", DayActions.setStressNote(null, "﻿งาน ").note)
    }

    /** JsonNull เป็น JsonPrimitive แต่ไม่ใช่สตริง — Answers ต้องไม่เอามาเทียบ === กับข้อความ */
    @Test fun answersWithExplicitNulls() {
        val a = Answers(JsonObject(mapOf("Q1" to JsonNull, "Q10" to JsonNull, "Q26" to JsonNull)))
        assertNull(a.str("Q1"))
        assertEquals("fallback", a.strOr("Q1", "fallback"))
        assertEquals(emptyList<String>(), a.list("Q26"))
        assertEquals(0.0, a.number("Q10"), 0.0)
        assertTrue(a.parseFloat("Q10").isNaN())
        assertFalse(a.truthy("Q10"))
        assertFalse(Generator.numberAnswered(a, "Q10"))
        assertNull(a.str("missing"))
        assertTrue(a.number("missing").isNaN())
    }
}
