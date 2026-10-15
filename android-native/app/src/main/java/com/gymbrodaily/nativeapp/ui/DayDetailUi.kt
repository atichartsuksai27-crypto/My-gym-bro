package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.AnnotatedString
import androidx.compose.ui.text.SpanStyle
import androidx.compose.ui.text.buildAnnotatedString
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.withStyle
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.DayExtras
import com.gymbrodaily.nativeapp.domain.DayReport
import com.gymbrodaily.nativeapp.domain.Progression
import com.gymbrodaily.nativeapp.domain.ProgressGoal
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import java.time.LocalDate

/* ============================================================
   บันทึกของวันหนึ่ง: วันที่ยังแก้ได้ (วันนี้/เมื่อวาน) = ฟอร์มบันทึก, วันที่ล็อกแล้ว = ดูผลสุดท้ายอย่างเดียว
   ตรงกับ dayPanelBody / dayDetailHTML / dayExtrasHTML ของเว็บ
   ============================================================ */

@Composable
fun DayPanelBody(t: TrackData, iso: String, today: LocalDate, store: TrackStore) {
    if (DayReport.isEditable(iso, today.toString())) {
        DayEditor(t, iso, store)
    } else {
        Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(GB.surface2).padding(14.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("🔒", fontSize = 18.sp)
                Text("วันนี้ถูกล็อกแล้ว ดูได้อย่างเดียว — บันทึกหรือแก้ไขได้เฉพาะวันนี้และเมื่อวาน", fontSize = 13.5.sp, lineHeight = 19.sp)
            }
            DayDetail(t, iso)
        }
    }
}

private val REPORT_GROUPS = listOf("workout" to "การฝึก", "cardio" to "Cardio", "food" to "โภชนาการ", "sleep" to "การนอน", "body" to "น้ำหนักตัว")

@Composable
private fun HistItem(label: String, value: String, miss: Boolean) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp), horizontalArrangement = Arrangement.spacedBy(10.dp)) {
        Text(label, Modifier.weight(1f), fontSize = 13.5.sp, color = if (miss) GB.warn else GB.text)
        Text(value, fontSize = 13.sp, color = if (miss) GB.warn else GB.text2)
    }
}

@Composable
fun DayDetail(t: TrackData, iso: String) {
    val rep = DayReport.dayReport(t, iso)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        REPORT_GROUPS.forEach { (k, label) ->
            val its = rep.items.filter { it.group == k }
            if (its.isEmpty()) return@forEach
            val ok = its.all { it.done }
            Card {
                SectionHead(label, if (ok) GB.ok else GB.warn, null, "${its.count { it.done }}/${its.size}")
                its.forEach { HistItem(it.label, it.v, !it.done) }
            }
            if (k == "workout" && rep.warmup.total > 0) {
                Card {
                    SectionHead("Warm-up", GB.accent, "บันทึกไว้เป็นข้อมูล ไม่นับความครบ", "${rep.warmup.done}/${rep.warmup.total}")
                    rep.warmup.byEx.forEach { HistItem(it.label, "${it.done}/${it.total} เซ็ต", false) }
                }
            }
        }
        DayExtrasCards(t, iso)
    }
}

/** อาการหลังออกกำลังกาย + รายการอาหาร + วอร์มร่างกาย + ความเครียด ของวันนั้น (อ่านจาก log โดยตรง ใช้ได้ทั้งวันที่ล็อกแล้ว) */
@Composable
private fun DayExtrasCards(t: TrackData, iso: String) {
    val lg = t.logs[iso]
    val pr = lg?.prep
    val st = ProgressGoal.stressOf(t, iso)
    if (Tracking.sessionKeyFor(t.program, iso) != null || pr?.warm == true || pr?.cool == true) {
        Card {
            SectionHead("วอร์มร่างกาย / คลายกล้ามเนื้อ", GB.accent, "บันทึกไว้เป็นข้อมูล ไม่นับความครบ")
            HistItem("วอร์มร่างกายก่อนเริ่ม", if (pr?.warm == true) "ทำแล้ว ✓" else "ไม่ได้บันทึก", false)
            HistItem("คลายกล้ามเนื้อหลังฝึก", if (pr?.cool == true) "ทำแล้ว ✓" else "ไม่ได้บันทึก", false)
        }
    }
    if (st != null) {
        Card {
            SectionHead("ความเครียด / อารมณ์", GB.pink, "บันทึกไว้เป็นข้อมูล ไม่นับความครบ")
            HistItem(if (!st.note.isNullOrEmpty()) "สาเหตุ: ${st.note}" else "ไม่ได้ระบุสาเหตุ", DayExtras.stressLabel(st.level!!.toInt()), false)
        }
    }
    val exs = lg?.exercises ?: emptyMap()
    val feels = exs.filter { it.value.feel != null }
    if (feels.isNotEmpty()) {
        Card {
            SectionHead("น้ำหนักที่ยก และแรงเหลือหลังเล่น", GB.accent)
            feels.forEach { (id, x) ->
                val o = Progression.FEEL_OPTS.firstOrNull { it.k == x.feel }
                val exd = Tracking.sessionDefFor(t.program, Tracking.sessionKeyFor(t.program, iso))?.exercises?.firstOrNull { it.id == id }
                val kind = if (exd != null) Progression.exKind(exd, Progression.cleanSets(x.sets)) else "weight"
                HistItem("${exerciseName(t, iso, id)} · ${Progression.setsText(x.sets, kind)}", o?.let { "${it.icon} ${it.label}" } ?: "", false)
            }
        }
    }
    val syms = exs.values.mapNotNull { it.symptom }
    if (syms.isNotEmpty()) {
        Card {
            SectionHead("อาการหลังออกกำลังกาย", GB.warn)
            syms.forEach { s ->
                val info = DayExtras.info(s.level)
                HistItem("${s.name.orEmpty()}: ${s.text}", "${info.icon} ${info.label}", info.cls == "danger")
            }
        }
    }
    val foods = lg?.nutrition?.foods ?: emptyList()
    if (foods.isNotEmpty()) {
        Card {
            SectionHead("อาหารที่บันทึก", GB.food)
            foods.forEach { x ->
                Column(Modifier.padding(vertical = 2.dp)) {
                    Text("${x.name} ${Fmt.num(x.g)} g", fontWeight = FontWeight.Medium, fontSize = 13.5.sp)
                    Hint(macroLine(x))
                }
            }
        }
    }
}

/** ชื่อท่าของวันนั้น: ท่าในเซสชันปัจจุบัน ไม่งั้นท่าในแคตตาล็อก ไม่งั้นใช้ id */
private fun exerciseName(t: TrackData, iso: String, id: String): String =
    Tracking.sessionDefFor(t.program, Tracking.sessionKeyFor(t.program, iso))?.exercises?.firstOrNull { it.id == id }?.th
        ?: com.gymbrodaily.nativeapp.domain.Catalog.EXERCISES.firstOrNull { it.id == id }?.th ?: id

/** ชื่อวัน = เซสชัน/Cardio ของวันนั้น ส่วนที่ผ่านวันไปแล้วแต่ไม่สำเร็จเป็นตัวแดง (dayLabelHTML) */
fun dayLabel(t: TrackData, iso: String, today: LocalDate, rest: String): AnnotatedString {
    val parts = DayReport.dayParts(t, iso, today.toString())
    if (parts.isEmpty()) return AnnotatedString(rest)
    return buildAnnotatedString {
        parts.forEachIndexed { i, x ->
            if (i > 0) append(" + ")
            if (x.missed) withStyle(SpanStyle(color = Color(0xFFFF8A8A))) { append(x.label) } else append(x.label)
        }
    }
}
