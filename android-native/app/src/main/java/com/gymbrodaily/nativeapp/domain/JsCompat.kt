package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlin.math.floor

/* ============================================================
   ตัวช่วยเลียนแบบการแปลงค่าของ JavaScript ให้ตรงกับเว็บแอปเดิมทุกกรณี
   ------------------------------------------------------------
   คำตอบแบบสอบถามที่ซิงก์ใน Supabase (onboarding_state.payload.answers) มาจากช่อง input
   ของเว็บ ค่าตัวเลขจึงอาจเป็น number, string, string มีหน่วยต่อท้าย ("80kg") หรือว่าง
   โค้ดเดิมแปลงด้วย Number() บ้าง parseFloat() บ้าง ซึ่งให้ผลต่างกัน ("80kg" → NaN กับ 80)
   ถ้าแปลงคนละแบบกับ JS ผู้ใช้คนเดียวกันจะได้ตัวเลขต่างกันระหว่างเว็บกับแอป จึงแยกไว้ตรงนี้
   ============================================================ */

private val DECIMAL_FULL = Regex("""[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?""")
private val DECIMAL_PREFIX = Regex("""^[+-]?(Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)""")

/** Number(v) ของ JS — คีย์ที่ไม่มีอยู่ (undefined) ให้ส่ง null เข้ามา */
fun jsNumber(e: JsonElement?): Double = when (e) {
    null -> Double.NaN
    JsonNull -> 0.0
    is JsonPrimitive -> if (e.isString) jsNumber(e.content) else e.booleanOrNull?.let { if (it) 1.0 else 0.0 } ?: e.content.toDouble()
    else -> Double.NaN
}

fun jsNumber(s: String): Double {
    val t = s.trim()
    if (t.isEmpty()) return 0.0
    return when (t) {
        "Infinity", "+Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        else -> if (DECIMAL_FULL.matches(t)) t.toDouble() else Double.NaN
    }
}

/** parseFloat(v) ของ JS — อ่านเลขนำหน้าแล้วทิ้งส่วนที่เหลือ ("80kg" → 80) */
fun jsParseFloat(e: JsonElement?): Double = jsParseFloat(jsString(e))

fun jsParseFloat(s: String): Double {
    val m = DECIMAL_PREFIX.find(s.trimStart()) ?: return Double.NaN
    return when (val v = m.value) {
        "Infinity", "+Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        else -> v.toDouble()
    }
}

/** String(v) ของ JS (พอสำหรับค่าที่เจอในคำตอบแบบสอบถาม) */
fun jsString(e: JsonElement?): String = when (e) {
    null -> "undefined"
    JsonNull -> "null"
    is JsonPrimitive -> e.content
    is JsonArray -> e.joinToString(",") { if (it is JsonNull) "" else jsString(it) }
    is JsonObject -> "[object Object]"
}

/** ค่า truthy ของ JS */
fun jsTruthy(e: JsonElement?): Boolean = when (e) {
    null, JsonNull -> false
    is JsonPrimitive -> when {
        e.isString -> e.content.isNotEmpty()
        e.booleanOrNull != null -> e.booleanOrNull!!
        else -> e.content.toDouble().let { it != 0.0 && !it.isNaN() }
    }
    else -> true
}

/** Math.round ของ JS — ปัดครึ่งขึ้นไปทาง +∞ เสมอ (ต่างจาก Kotlin roundToInt ที่ปัดครึ่งออกจากศูนย์) */
fun jsRound(x: Double): Double = floor(x + 0.5)

/** NaN/Infinity ของ JS กลายเป็น null ตอน JSON.stringify — ใช้ก่อนเก็บค่าลงโมเดลที่จะซิงก์ */
fun Double.finiteOrNull(): Double? = if (isFinite()) this else null

/** x.toFixed(d) ของ JS — ปัดจากค่าฐานสองจริงของ x แบบครึ่งออกจากศูนย์ (−0 แสดงเป็น "0.00") */
fun jsToFixed(x: Double, d: Int): String {
    val s = java.math.BigDecimal(x).setScale(d, java.math.RoundingMode.HALF_UP).toPlainString()
    return if (s.startsWith("-") && s.trim('-', '0', '.').isEmpty()) s.substring(1) else s
}

/** x.toLocaleString() ของ JS (en-US): คั่นหลักพันด้วย "," ทศนิยมไม่เกิน 3 ตำแหน่ง */
fun jsLocale(x: Double): String {
    if (x.isNaN()) return "NaN"
    val bd = java.math.BigDecimal(x).setScale(3, java.math.RoundingMode.HALF_UP).stripTrailingZeros()
    val neg = bd.signum() < 0
    val plain = bd.abs().toPlainString()
    val intPart = plain.substringBefore('.')
    val frac = plain.substringAfter('.', "")
    val grouped = intPart.reversed().chunked(3).joinToString(",").reversed()
    return (if (neg) "-" else "") + grouped + (if (frac.isNotEmpty()) ".$frac" else "")
}

fun jsLocale(x: Int): String = jsLocale(x.toDouble())
