package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * คำตอบแบบสอบถาม (shape เดียวกับ state.answers ใน app.js / onboarding_state.payload.answers)
 * เก็บเป็น JsonObject ดิบไว้ ไม่แปลงเป็น data class เพื่อให้อ่าน/เขียนข้อมูลชุดเดียวกับเว็บได้
 * และให้การแปลงค่าทำตามกติกาของ JS เป๊ะ (ดู JsCompat.kt)
 */
class Answers(val json: JsonObject = JsonObject(emptyMap())) {
    fun raw(id: String): JsonElement? = json[id]

    /** ค่าที่เป็น string เท่านั้น — เทียบด้วย === ใน JS ค่าชนิดอื่นจึงไม่มีทางตรง */
    fun str(id: String): String? = (json[id] as? JsonPrimitive)?.takeIf { it.isString }?.content

    /** `a.X || fallback` ของ JS สำหรับคำตอบแบบ single */
    fun strOr(id: String, fallback: String): String = str(id)?.takeIf { it.isNotEmpty() } ?: fallback

    /** `a.X || []` ของ JS สำหรับคำตอบแบบ multi */
    fun list(id: String): List<String> =
        (json[id] as? JsonArray)?.map { (it as? JsonPrimitive)?.content ?: jsString(it) } ?: emptyList()

    fun number(id: String): Double = jsNumber(json[id])
    fun parseFloat(id: String): Double = jsParseFloat(json[id])
    fun truthy(id: String): Boolean = jsTruthy(json[id])
}

/** การปรับแผนเองของผู้ใช้ (state.plan ใน app.js) */
@Serializable
data class PlanOverrides(
    val manualPick: Map<String, String> = emptyMap(),
    val unlockedEx: Map<String, Boolean> = emptyMap(),
    val forceLowTier: Map<String, Boolean> = emptyMap(),
    val splitOverride: String? = null,
)
