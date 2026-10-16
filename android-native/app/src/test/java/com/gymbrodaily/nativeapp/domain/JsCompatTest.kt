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
        assertEquals("abc", jsTrim("\uFEFFabc\uFEFF"))
        assertEquals("abc", jsTrim("\u00A0 abc\u3000\n\t"))
        assertEquals("abc", jsTrim("\u2028abc\u2029\u202F\u205F\u1680\u2000\u200A"))
        assertEquals("\u001Cabc\u001F", jsTrim("\u001Cabc\u001F")) // Kotlin trim() ตัดสองตัวนี้ แต่ JS ไม่ตัด
        assertEquals("\u0085abc", jsTrim("\u0085abc"))
        assertEquals("᠎abc", jsTrim("᠎abc"))
        assertEquals("", jsTrim("  \t\n"))
    }

    /** Number()/parseFloat() ตัดช่องว่างตามชุดของ JS: U+001C ไม่ถูกตัด, U+FEFF ถูกตัด; Number รับ 0x/0b/0o */
    @Test fun numberAndParseFloatWhitespaceAndRadix() {
        assertTrue(jsNumber("\u001C5").isNaN())
        assertEquals(5.0, jsNumber("\uFEFF5"), 0.0)
        assertEquals(7.0, jsNumber(" \n7\t"), 0.0)
        assertTrue(jsParseFloat("\u001C5").isNaN())
        assertEquals(5.0, jsParseFloat("\uFEFF5"), 0.0)
        assertEquals(5.0, jsParseFloat("\u00A05"), 0.0)
        assertEquals(26.0, jsNumber("0x1A"), 0.0)
        assertEquals(3.0, jsNumber("0b11"), 0.0)
        assertEquals(7.0, jsNumber("0o7"), 0.0)
        assertTrue(jsNumber("-0x1").isNaN())
        assertEquals(0.0, jsParseFloat("0x1A"), 0.0)
        assertEquals(5.0, jsNumber("5."), 0.0)
        assertEquals(0.5, jsNumber(".5"), 0.0)
        assertEquals(5.0, jsNumber("+.5e1"), 0.0)
        assertTrue(jsNumber("1_0").isNaN())
        assertEquals(-0.5, jsParseFloat("-.5x"), 0.0)
        assertEquals(1.0, jsParseFloat("1e"), 0.0)
        assertTrue(jsParseFloat(".e1").isNaN())
        assertEquals(Double.NEGATIVE_INFINITY, jsParseFloat("-Infinity"), 0.0)
    }

    /** String(n): 1e+21, 1.5e-7, 0.000001, -0 → "0" */
    @Test fun numberToString() {
        assertEquals("1e+21", jsNumToString(1e21))
        assertEquals("1.5e-7", jsNumToString(1.5e-7))
        assertEquals("-1.5e-7", jsNumToString(-1.5e-7))
        assertEquals("0.000001", jsNumToString(1e-6))
        assertEquals("1e+300", jsNumToString(1e300))
        assertEquals("123456789012345680000", jsNumToString(123456789012345680000.0))
        assertEquals("0", jsNumToString(-0.0))
        assertEquals("12.5", jsNumToString(12.5))
        assertEquals("80", jsString(JsonPrimitive(80.0)))
    }

    /** toFixed: ตามค่าฐานสองจริง, ลบเมื่อ x<0 แม้ปัดเป็นศูนย์, NaN/Infinity/≥1e21 */
    @Test fun toFixedEdgeCases() {
        assertEquals("-0.00", jsToFixed(-0.001, 2))
        assertEquals("0.00", jsToFixed(-0.0, 2))
        assertEquals("NaN", jsToFixed(Double.NaN, 2))
        assertEquals("Infinity", jsToFixed(Double.POSITIVE_INFINITY, 1))
        assertEquals("1e+21", jsToFixed(1e21, 2))
        assertEquals("1.00", jsToFixed(1.005, 2))
        assertEquals("3", jsToFixed(2.5, 0))
        assertEquals("-3", jsToFixed(-2.5, 0))
        assertEquals("1", jsToFixed(0.5, 0))
        assertEquals("1.4", jsToFixed(1.45, 1))
        assertEquals("8.35", jsToFixed(8.345, 2))
    }

    /** toLocaleString (ICU ปัดจากทศนิยมสั้นที่สุด) และเครื่องหมายของ −0 */
    @Test fun localeEdgeCases() {
        assertEquals("1.001", jsLocale(1.0005))
        assertEquals("2.001", jsLocale(2.0005))
        assertEquals("1.002", jsLocale(1.0015))
        assertEquals("0.001", jsLocale(0.0005))
        assertEquals("1,234.568", jsLocale(1234.5675))
        assertEquals("-0", jsLocale(-0.0))
        assertEquals("-0", jsLocale(-0.0001))
        assertEquals("0", jsLocale(1e-7))
        assertEquals("-1.001", jsLocale(-1.0005))
        assertEquals("1,000,000,000,000,000,000,000", jsLocale(1e21))
        assertEquals("0.3", jsLocale(0.1 + 0.2))
        assertEquals("1,000,000", jsLocale(999999.9996))
        assertEquals("1,234,567.891", jsLocale(1234567.891))
    }

    @Test fun saveSymptomAndStressNoteUseJsTrim() {
        assertEquals("ปวดเข่า", DayActions.saveSymptom(null, "\uFEFF ปวดเข่า \uFEFF", "x").symptom!!.text)
        assertEquals("งาน", DayActions.setStressNote(null, "\uFEFFงาน\u00A0").note)
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
