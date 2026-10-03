package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.doubleOrNull
import org.junit.Assert.fail
import kotlin.math.abs
import kotlin.math.max

/* golden fixtures สร้างจาก JS ตัวจริงด้วย tools/make-golden.js */

val goldenJson = Json { encodeDefaults = true; explicitNulls = true }

fun loadGolden(name: String): JsonArray {
    val stream = object {}.javaClass.classLoader!!.getResourceAsStream("golden/$name")
        ?: error("ไม่พบ golden/$name — รัน node android-native/tools/make-golden.js ก่อน")
    return goldenJson.parseToJsonElement(stream.reader(Charsets.UTF_8).readText()) as JsonArray
}

/** Double ที่ไม่ finite กลายเป็น null แบบเดียวกับ JSON.stringify ของ JS */
fun jsonNum(x: Double?): JsonElement = if (x == null || !x.isFinite()) JsonNull else JsonPrimitive(x)

/**
 * เทียบ JSON แบบเดียวกับที่ JS เห็น: ตัวเลขเทียบเป็นค่า (76 == 76.0) ด้วย tolerance เล็กมาก,
 * key ที่ไม่มีเท่ากับ null (JSON.stringify ทิ้ง field ที่เป็น undefined)
 */
fun assertJsonEquivalent(expected: JsonElement, actual: JsonElement, path: String = "$") {
    fun mismatch(): Nothing = fail("$path: expected $expected but was $actual") as Nothing
    when {
        expected is JsonNull || actual is JsonNull -> if (expected !is JsonNull || actual !is JsonNull) mismatch()
        expected is JsonObject && actual is JsonObject ->
            (expected.keys + actual.keys).forEach { k ->
                assertJsonEquivalent(expected[k] ?: JsonNull, actual[k] ?: JsonNull, "$path.$k")
            }
        expected is JsonArray && actual is JsonArray -> {
            if (expected.size != actual.size) mismatch()
            expected.indices.forEach { assertJsonEquivalent(expected[it], actual[it], "$path[$it]") }
        }
        expected is JsonPrimitive && actual is JsonPrimitive -> {
            if (expected.isString || actual.isString) {
                if (expected.isString != actual.isString || expected.content != actual.content) mismatch()
            } else {
                val e = expected.doubleOrNull
                val a = actual.doubleOrNull
                if (e != null && a != null) {
                    if (abs(e - a) > 1e-9 * max(1.0, abs(e))) mismatch()
                } else if (expected.content != actual.content) mismatch()
            }
        }
        else -> mismatch()
    }
}

fun JsonElement?.doubleOrNullJs(): Double? = (this as? JsonPrimitive)?.takeIf { !it.isString }?.doubleOrNull
fun JsonElement?.stringOrNullJs(): String? = (this as? JsonPrimitive)?.takeIf { it.isString }?.content
