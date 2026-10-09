package com.gymbrodaily.nativeapp.data

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Test

/** แอปแก้บันทึกที่เว็บเขียนไว้แล้ว ต้องไม่ทำ field ที่แอปไม่รู้จักหาย */
class MergeRawTest {

    @Test
    fun keepsUnknownFieldsAndAppliesTypedValues() {
        val raw = Json.parseToJsonElement(
            """{"date":"2026-10-09","stress":{"level":3,"causes":["งาน"]},
               "nutrition":{"proteinG":120,"kcal":1800,"foods":[{"name":"ข้าว"}]},
               "exercises":{"bench":{"done":false,"intensity":"heavy","sets":[{"weight":40,"reps":8,"warm":true}]}}}""",
        )
        val typed = Json.parseToJsonElement(
            """{"date":"2026-10-09","nutrition":{"proteinG":null,"kcal":2000},
               "exercises":{"bench":{"done":true,"sets":[{"weight":42.5,"reps":8}]}}}""",
        )
        val out = TrackStore.mergeRaw(raw, typed).jsonObject

        assertEquals(3, out["stress"]!!.jsonObject["level"]!!.jsonPrimitive.content.toInt())
        val n = out["nutrition"]!!.jsonObject
        assertEquals(JsonNull, n["proteinG"])                       // ลบค่าในแอป = null จริง ไม่ค้างค่าเก่า
        assertEquals("2000", n["kcal"]!!.jsonPrimitive.content)
        assertEquals(1, n["foods"]!!.jsonArray.size)                  // รายการอาหารจากเว็บยังอยู่
        val bench = out["exercises"]!!.jsonObject["bench"]!!.jsonObject
        assertEquals("true", bench["done"]!!.jsonPrimitive.content)
        assertEquals("heavy", bench["intensity"]!!.jsonPrimitive.content)
        val set0 = bench["sets"]!!.jsonArray[0].jsonObject
        assertEquals("42.5", set0["weight"]!!.jsonPrimitive.content)
        assertEquals("true", set0["warm"]!!.jsonPrimitive.content)
    }

    @Test
    fun doesNotAddNullKeysTheWebNeverWrote() {
        val raw = Json.parseToJsonElement("""{"date":"2026-10-09","nutrition":{"kcal":1800}}""")
        val typed = Json.parseToJsonElement("""{"date":"2026-10-09","stress":null,"nutrition":{"kcal":1800,"fatG":null},"sleep":{"hours":null}}""")
        val out = TrackStore.mergeRaw(raw, typed).jsonObject
        assertEquals(false, "stress" in out)
        assertEquals(false, "fatG" in out["nutrition"]!!.jsonObject)
        assertEquals(false, "hours" in out["sleep"]!!.jsonObject)
    }
}
