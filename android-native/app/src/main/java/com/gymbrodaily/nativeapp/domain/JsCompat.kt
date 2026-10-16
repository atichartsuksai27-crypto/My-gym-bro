package com.gymbrodaily.nativeapp.domain

import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import java.math.BigDecimal
import java.math.BigInteger
import java.math.RoundingMode
import kotlin.math.abs
import kotlin.math.ceil

/* ============================================================
   ตัวช่วยเลียนแบบการแปลงค่าของ JavaScript ให้ตรงกับเว็บแอปเดิมทุกกรณี
   ------------------------------------------------------------
   คำตอบแบบสอบถามที่ซิงก์ใน Supabase (onboarding_state.payload.answers) มาจากช่อง input
   ของเว็บ ค่าตัวเลขจึงอาจเป็น number, string, string มีหน่วยต่อท้าย ("80kg") หรือว่าง
   โค้ดเดิมแปลงด้วย Number() บ้าง parseFloat() บ้าง ซึ่งให้ผลต่างกัน ("80kg" → NaN กับ 80)
   ถ้าแปลงคนละแบบกับ JS ผู้ใช้คนเดียวกันจะได้ตัวเลขต่างกันระหว่างเว็บกับแอป จึงแยกไว้ตรงนี้
   ค่าที่คาดของทุกฟังก์ชันตรวจเทียบกับ node (ดู JsCompatTest)
   ============================================================ */

private val DECIMAL_FULL = Regex("""[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?""")
private val DECIMAL_PREFIX = Regex("""^[+-]?(Infinity|(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?)""")
/** Number("0x1A") = 26, Number("0b11") = 3, Number("0o7") = 7 (ไม่รับเครื่องหมายนำหน้า) */
private val RADIX_LITERAL = Regex("""0([xX][0-9a-fA-F]+|[bB][01]+|[oO][0-7]+)""")

/** WhiteSpace + LineTerminator ของ ECMAScript — ใช้เลขรหัสแทนตัวอักษรจริงเพราะส่วนใหญ่มองไม่เห็นในซอร์ส */
private fun isJsSpace(c: Char): Boolean = when (c.code) {
    in 0x09..0x0D, 0x20, 0xA0, 0x1680, in 0x2000..0x200A, 0x2028, 0x2029, 0x202F, 0x205F, 0x3000, 0xFEFF -> true
    else -> false
}

/** String.prototype.trim ของ JS — ไม่ตัด U+001C–001F (Kotlin trim() ตัด) และตัด U+FEFF (Kotlin trim() ไม่ตัด) */
fun jsTrim(s: String): String = s.trim { isJsSpace(it) }

fun jsTrimStart(s: String): String = s.trimStart { isJsSpace(it) }

/** Number(v) ของ JS — คีย์ที่ไม่มีอยู่ (undefined) ให้ส่ง null เข้ามา */
fun jsNumber(e: JsonElement?): Double = when (e) {
    null -> Double.NaN
    JsonNull -> 0.0
    is JsonPrimitive -> if (e.isString) jsNumber(e.content) else e.booleanOrNull?.let { if (it) 1.0 else 0.0 } ?: e.content.toDouble()
    else -> Double.NaN
}

fun jsNumber(s: String): Double {
    val t = jsTrim(s)
    if (t.isEmpty()) return 0.0
    if (RADIX_LITERAL.matches(t)) {
        val radix = when (t[1]) { 'x', 'X' -> 16; 'b', 'B' -> 2; else -> 8 }
        return BigInteger(t.substring(2), radix).toDouble()
    }
    return when (t) {
        "Infinity", "+Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        else -> if (DECIMAL_FULL.matches(t)) t.toDouble() else Double.NaN
    }
}

/** parseFloat(v) ของ JS — อ่านเลขนำหน้าแล้วทิ้งส่วนที่เหลือ ("80kg" → 80) */
fun jsParseFloat(e: JsonElement?): Double = jsParseFloat(jsString(e))

fun jsParseFloat(s: String): Double {
    val m = DECIMAL_PREFIX.find(jsTrimStart(s)) ?: return Double.NaN
    return when (val v = m.value) {
        "Infinity", "+Infinity" -> Double.POSITIVE_INFINITY
        "-Infinity" -> Double.NEGATIVE_INFINITY
        else -> v.toDouble()
    }
}

/** String(n) ของ JS สำหรับตัวเลข: 80.0 → "80", 1e21 → "1e+21", 1.5e-7 → "1.5e-7", -0 → "0" (รูปแบบเลขยกกำลังเมื่อ < 1e-6 หรือ ≥ 1e21) */
fun jsNumToString(x: Double): String {
    if (x.isNaN()) return "NaN"
    if (x.isInfinite()) return if (x > 0) "Infinity" else "-Infinity"
    if (x == 0.0) return "0"
    val a = abs(x)
    val sign = if (x < 0) "-" else ""
    if (a >= 1e-6 && a < 1e21) return sign + BigDecimal(a.toString()).stripTrailingZeros().toPlainString()
    // Double.toString ให้รูป "1.5E-7" / "1.0E21" ในช่วงนี้เสมอ
    val (mant, exp) = a.toString().split('E').let { it[0].removeSuffix(".0") to it[1].toInt() }
    return "$sign${mant}e${if (exp >= 0) "+" else "-"}${abs(exp)}"
}

/** String(v) ของ JS (พอสำหรับค่าที่เจอในคำตอบแบบสอบถาม) */
fun jsString(e: JsonElement?): String = when (e) {
    null -> "undefined"
    JsonNull -> "null"
    is JsonPrimitive ->
        if (e.isString || e.booleanOrNull != null) e.content else e.content.toDoubleOrNull()?.let { jsNumToString(it) } ?: e.content
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

/** Math.round ของ JS — ปัดครึ่งขึ้นไปทาง +∞ เสมอ (ต่างจาก Kotlin roundToInt ที่ปัดครึ่งออกจากศูนย์)
 *  ใช้วิธีเดียวกับ V8 (ceil แล้วถอยหนึ่งถ้าเกินครึ่ง) ไม่ใช่ floor(x + 0.5) เพราะ x + 0.5 ปัดเศษทศนิยมเอง
 *  เช่น 0.49999999999999994 + 0.5 = 1.0 ทำให้ได้ 1 ขณะที่ Math.round ได้ 0 */
fun jsRound(x: Double): Double {
    val r = ceil(x)
    return if (r - 0.5 > x) r - 1 else r
}

/** NaN/Infinity ของ JS กลายเป็น null ตอน JSON.stringify — ใช้ก่อนเก็บค่าลงโมเดลที่จะซิงก์ */
fun Double.finiteOrNull(): Double? = if (isFinite()) this else null

/**
 * x.toFixed(d) ของ JS — ปัดจากค่าฐานสองจริงของ x (ไม่ใช่ทศนิยมที่พิมพ์) ครึ่งขึ้นบนขนาดของค่า
 * เครื่องหมายลบใส่เมื่อ x < 0 แม้ผลปัดเป็นศูนย์ ((-0.001).toFixed(2) = "-0.00") แต่ −0 เองได้ "0.00"
 * NaN/Infinity ได้ "NaN"/"Infinity" และ |x| ≥ 1e21 ได้ String(x) ตามสเปค
 */
fun jsToFixed(x: Double, d: Int): String {
    if (x.isNaN() || x.isInfinite() || abs(x) >= 1e21) return jsNumToString(x)
    val s = BigDecimal(abs(x)).setScale(d, RoundingMode.HALF_UP).toPlainString()
    return if (x < 0) "-$s" else s
}

/**
 * x.toLocaleString() ของ JS (en-US): คั่นหลักพันด้วย "," ทศนิยมไม่เกิน 3 ตำแหน่ง ปัดครึ่งออกจากศูนย์
 * Intl (ICU) ปัดจากทศนิยมสั้นที่สุดที่แทนค่า double ได้ (1.0005 → "1.001") ไม่ใช่จากค่าฐานสองจริง (ซึ่งจะได้ "1")
 * เครื่องหมายลบตามบิตเครื่องหมาย: −0 และค่าลบที่ปัดเป็นศูนย์ได้ "-0"
 */
fun jsLocale(x: Double): String {
    if (x.isNaN()) return "NaN"
    if (x.isInfinite()) return if (x > 0) "∞" else "-∞"
    val neg = x < 0 || (x == 0.0 && 1.0 / x < 0)
    val bd = BigDecimal(abs(x).toString()).setScale(3, RoundingMode.HALF_UP).stripTrailingZeros()
    val plain = if (bd.signum() == 0) "0" else bd.toPlainString()
    val intPart = plain.substringBefore('.')
    val frac = plain.substringAfter('.', "")
    val grouped = intPart.reversed().chunked(3).joinToString(",").reversed()
    return (if (neg) "-" else "") + grouped + (if (frac.isNotEmpty()) ".$frac" else "")
}

fun jsLocale(x: Int): String = jsLocale(x.toDouble())
