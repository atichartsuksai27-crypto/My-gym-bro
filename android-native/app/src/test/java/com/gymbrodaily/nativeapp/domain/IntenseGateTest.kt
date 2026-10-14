package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonObject
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotNull
import org.junit.Assert.assertNull
import org.junit.Test

/** ด่านความปลอดภัยของโหมดเข้มข้น — กติกาเดียวกับ intenseBlockReason ของ app.js */
class IntenseGateTest {
    private fun answers(json: String) = Answers(Json.parseToJsonElement(json).jsonObject)

    @Test
    fun beginnerIsBlocked() {
        assertEquals("คุณระบุว่าเป็นมือใหม่ — เริ่มจากแบบทั่วไปจนฟอร์มนิ่งก่อน", Progression.intenseBlockReason(answers("""{"Q16":"มือใหม่"}""")))
    }

    @Test
    fun injuryOrHeartConditionIsBlocked() {
        val msg = Progression.intenseBlockReason(answers("""{"Q16":"นักกีฬา-เทรนมานาน","Q25":"มี","Q26":["เข่า","หัวใจ-หลอดเลือด"]}"""))
        assertEquals("คุณระบุอาการบาดเจ็บ/โรคประจำตัว (เข่า, หัวใจ-หลอดเลือด) — แบบเข้มข้นใช้น้ำหนักสูงจนหมดแรง เสี่ยงเกินไป", msg)
        assertNotNull(msg)
    }

    @Test
    fun experiencedWithoutConditionsIsAllowed() {
        assertNull(Progression.intenseBlockReason(answers("""{"Q16":"ออกกำลังกายประจำ","Q25":"ไม่มี"}""")))
        // ตอบ Q26 ค้างไว้แต่เปลี่ยน Q25 เป็น ไม่มี → ไม่นับ (เหมือนเว็บที่เช็ค Q25 ก่อน)
        assertNull(Progression.intenseBlockReason(answers("""{"Q16":"เคยออกบ้าง","Q25":"ไม่มี","Q26":["หลัง"]}""")))
    }
}
