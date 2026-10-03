package com.gymbrodaily.nativeapp.ui

import com.gymbrodaily.nativeapp.domain.Tracking
import java.time.LocalDate
import java.util.Locale
import kotlin.math.abs
import kotlin.math.floor

/** วันที่/ตัวเลขแบบเดียวกับที่เว็บแสดง (shortDateTH, longDateTH, fmt1, toLocaleString) */
object Fmt {
    val MONTHS = listOf("ม.ค.", "ก.พ.", "มี.ค.", "เม.ย.", "พ.ค.", "มิ.ย.", "ก.ค.", "ส.ค.", "ก.ย.", "ต.ค.", "พ.ย.", "ธ.ค.")
    val MONTHS_FULL = listOf(
        "มกราคม", "กุมภาพันธ์", "มีนาคม", "เมษายน", "พฤษภาคม", "มิถุนายน",
        "กรกฎาคม", "สิงหาคม", "กันยายน", "ตุลาคม", "พฤศจิกายน", "ธันวาคม",
    )

    fun shortDate(iso: String): String {
        val d = LocalDate.parse(iso)
        return "${d.dayOfMonth} ${MONTHS[d.monthValue - 1]}"
    }

    fun longDate(iso: String): String {
        val d = LocalDate.parse(iso)
        return "${Tracking.thaiWeekday(iso)}ที่ ${d.dayOfMonth} ${MONTHS_FULL[d.monthValue - 1]} ${d.year + 543}"
    }

    fun monthLabel(y: Int, m: Int) = "${MONTHS_FULL[m - 1]} ${y + 543}"

    fun one(n: Double) = Tracking.fmt1(n)

    fun kcal(v: Int?) = v?.let { String.format(Locale.US, "%,d", it) } ?: "ข้อมูลไม่ครบ"

    fun hours(v: Double?) = v?.let { one(it) + " ชม." } ?: "ยังไม่ได้ตั้งเป้า"

    /** String(v) ของ JS: 80 → "80", 72.5 → "72.5" */
    fun num(v: Double?): String {
        if (v == null) return ""
        return if (v == floor(v) && abs(v) < 1e15) v.toLong().toString() else v.toString()
    }
}
