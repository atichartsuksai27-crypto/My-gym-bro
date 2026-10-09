package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.SegmentedButton
import androidx.compose.material3.SegmentedButtonDefaults
import androidx.compose.material3.SingleChoiceSegmentedButtonRow
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.Catalog
import com.gymbrodaily.nativeapp.domain.DayStatus
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import java.time.LocalDate
import java.time.YearMonth

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ScheduleScreen(t: TrackData, today: LocalDate, store: TrackStore) {
    var tab by rememberSaveable { mutableStateOf("week") }
    var weekStart by rememberSaveable { mutableStateOf(Tracking.startOfWeek(today).toString()) }
    var month by rememberSaveable { mutableStateOf(YearMonth.from(today).toString()) }
    var openDate by rememberSaveable { mutableStateOf<String?>(null) }
    val p = t.program

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            "${p.splitLabel} · ${p.days.size} วัน/สัปดาห์", "ตารางฝึก",
            "รายสัปดาห์ไว้ดูว่าวันนี้-พรุ่งนี้ต้องทำอะไร รายเดือนไว้ดูภาพรวมและย้อนกลับไปบันทึกวันที่ตกหล่น",
        )
        SingleChoiceSegmentedButtonRow(Modifier.fillMaxWidth()) {
            listOf("week" to "รายสัปดาห์", "month" to "รายเดือน").forEachIndexed { i, (k, label) ->
                SegmentedButton(
                    selected = tab == k, onClick = { tab = k },
                    shape = SegmentedButtonDefaults.itemShape(i, 2),
                ) { Text(label) }
            }
        }
        if (tab == "week") {
            WeekGrid(t, today, LocalDate.parse(weekStart), { weekStart = it.toString() }) { openDate = it }
        } else {
            MonthGrid(t, today, YearMonth.parse(month), { month = it.toString() }) { openDate = it }
        }
    }

    openDate?.let { iso ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { openDate = null }, sheetState = sheet, containerColor = GB.bg) {
            Column(
                Modifier.fillMaxWidth().imePadding().verticalScroll(rememberScrollState()).padding(horizontal = 16.dp).navigationBarsPadding(),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                Text("บันทึกของ ${Fmt.longDate(iso)}", fontSize = 18.sp, fontWeight = FontWeight.Bold)
                Hint("$iso · ${Tracking.sessionKeyFor(p, iso) ?: "วันพัก"} — แก้ไขย้อนหลังได้ ข้อมูลบันทึกทันทีที่กรอก")
                DayEditor(t, iso, store)
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { openDate = null }) { Text("ปิด") }
                    if (t.logs[iso] != null) {
                        TextButton(onClick = { store.clearDay(iso); openDate = null }) {
                            Text("ล้างบันทึกของวันนี้", color = GB.warn)
                        }
                    }
                }
                Spacer(Modifier.padding(8.dp))
            }
        }
    }
}

@Composable
private fun RangeNav(label: String, prev: String, now: String, next: String, onPrev: () -> Unit, onNow: () -> Unit, onNext: () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Text(label, fontSize = 18.sp, fontWeight = FontWeight.Bold)
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
            OutlinedButton(onClick = onPrev) { Text(prev, fontSize = 12.sp) }
            OutlinedButton(onClick = onNow) { Text(now, fontSize = 12.sp) }
            OutlinedButton(onClick = onNext) { Text(next, fontSize = 12.sp) }
        }
    }
}

private fun statusChip(s: DayStatus): Pair<String, Boolean>? = when (s) {
    DayStatus.DONE -> "บันทึกครบ ✓" to true
    DayStatus.PARTIAL -> "บันทึกบางส่วน" to false
    DayStatus.PENDING -> "ยังไม่บันทึก" to false
    DayStatus.FUTURE -> "ยังไม่ถึง" to false
    DayStatus.BEFORE -> "ก่อนเริ่มโปรแกรม" to false
    DayStatus.REST_DONE -> "ครบ ✓" to true
    else -> null
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WeekGrid(t: TrackData, today: LocalDate, ws: LocalDate, setWeek: (LocalDate) -> Unit, open: (String) -> Unit) {
    val p = t.program
    val todayIso = today.toString()
    val we = ws.plusDays(6)
    RangeNav(
        "${ws.dayOfMonth} ${Fmt.MONTHS[ws.monthValue - 1]} – ${we.dayOfMonth} ${Fmt.MONTHS[we.monthValue - 1]} ${we.year + 543}",
        "← ก่อน", "สัปดาห์นี้", "ถัดไป →",
        { setWeek(ws.minusDays(7)) }, { setWeek(Tracking.startOfWeek(today)) }, { setWeek(ws.plusDays(7)) },
    )
    for (i in 0 until 7) {
        val d = ws.plusDays(i.toLong())
        val iso = d.toString()
        val sKey = Tracking.sessionKeyFor(p, iso)
        val sess = Tracking.sessionDefFor(p, sKey)
        val status = Tracking.dayStatus(t, iso, todayIso)
        val openable = iso <= todayIso && iso >= (p.startDate ?: "")
        val isToday = iso == todayIso
        Column(
            Modifier
                .fillMaxWidth()
                .clip(CardShape)
                .background(if (sKey == null) GB.bg else GB.surface)
                .border(if (isToday) 2.dp else 1.dp, if (isToday) GB.accent else GB.border, CardShape)
                .clickable(enabled = openable) { open(iso) }
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(4.dp),
        ) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                Text(Catalog.DAYS_SHORT[i], fontWeight = FontWeight.SemiBold, color = GB.text2)
                Text("${d.dayOfMonth} ${Fmt.MONTHS[d.monthValue - 1]}", color = GB.text3)
                if (isToday) Pill("วันนี้", GB.accent, GB.accentSoft)
                Pill(if (sKey != null) (p.minutesEstimate ?: "") else "พัก")
                statusChip(status)?.let { (label, ok) -> Pill(label, if (ok) GB.ok else GB.text2, if (ok) GB.okSoft else GB.surface2) }
            }
            Text(sKey ?: "พักฟื้น", fontWeight = FontWeight.Medium, color = if (openable || sKey != null) GB.text else GB.text3)
            Text(
                sess?.exercises?.joinToString(" · ") { it.th } ?: "ยืดกล้ามเนื้อ 10 นาที · เดินเบาๆ · เน้นนอนให้ครบเป้า",
                color = GB.text3, fontSize = 12.5.sp, maxLines = 2, overflow = TextOverflow.Ellipsis,
            )
        }
    }
    Hint("แตะวันที่ผ่านมาแล้วหรือวันนี้เพื่อเปิดบันทึกของวันนั้น — วันในอนาคตและวันก่อนเริ่มโปรแกรมกดไม่ได้")
}

@Composable
private fun MonthGrid(t: TrackData, today: LocalDate, ym: YearMonth, setMonth: (YearMonth) -> Unit, open: (String) -> Unit) {
    val p = t.program
    val todayIso = today.toString()
    RangeNav(
        Fmt.monthLabel(ym.year, ym.monthValue), "← ก่อน", "เดือนนี้", "ถัดไป →",
        { setMonth(ym.minusMonths(1)) }, { setMonth(YearMonth.from(today)) }, { setMonth(ym.plusMonths(1)) },
    )
    val offset = ym.atDay(1).dayOfWeek.value - 1
    val cells: List<Int?> = List(offset) { null } + (1..ym.lengthOfMonth()).toList()
    val rows = cells.chunked(7)
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
            Catalog.DAYS_SHORT.forEach {
                Text(it, color = GB.text3, fontSize = 12.sp, modifier = Modifier.weight(1f), textAlign = androidx.compose.ui.text.style.TextAlign.Center)
            }
        }
        rows.forEach { week ->
            Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                for (c in 0 until 7) {
                    val day = week.getOrNull(c)
                    Box(Modifier.weight(1f).aspectRatio(0.72f)) {
                        if (day != null) MonthCell(t, ym.atDay(day).toString(), todayIso, open)
                    }
                }
            }
        }
    }
    Hint("พื้นเขียว = ทำครบและติ๊กแล้ว · ขอบสีน้ำเงิน = บันทึกบางส่วน · ไม่มีสีเน้น = ยังไม่บันทึก (ตั้งใจไม่ใช้สีแดงกับวันที่พลาด) — แตะวันเพื่อบันทึกย้อนหลัง")
}

@Composable
private fun MonthCell(t: TrackData, iso: String, todayIso: String, open: (String) -> Unit) {
    val p = t.program
    val sKey = Tracking.sessionKeyFor(p, iso)
    val st = Tracking.dayStatus(t, iso, todayIso)
    var bg = if (sKey == null) GB.bg else GB.surface
    var border: Color = GB.border
    var mark = ""
    var openable = false
    when (st) {
        DayStatus.BEFORE -> bg = GB.bg
        DayStatus.FUTURE -> mark = "ยังไม่ถึง"
        DayStatus.DONE -> { bg = GB.okSoft; border = GB.okLine; mark = "✓ ครบ"; openable = true }
        DayStatus.PARTIAL -> { border = GB.accent; mark = "บางส่วน"; openable = true }
        DayStatus.PENDING -> { mark = "ยังไม่บันทึก"; openable = true }
        DayStatus.REST_DONE -> { bg = GB.okSoft; border = GB.okLine; mark = "✓"; openable = true }
        DayStatus.REST -> openable = iso <= todayIso && iso >= (p.startDate ?: "")
        DayStatus.REST_FUTURE -> {}
    }
    val isToday = iso == todayIso
    val shape = RoundedCornerShape(14.dp)
    Column(
        Modifier
            .fillMaxWidth()
            .clip(shape)
            .background(bg)
            .border(if (isToday) 2.dp else 1.dp, if (isToday) GB.text else border, shape)
            .clickable(enabled = openable) { open(iso) }
            .padding(3.dp),
        horizontalAlignment = Alignment.Start,
    ) {
        Text(LocalDate.parse(iso).dayOfMonth.toString(), fontSize = 12.sp, color = if (st == DayStatus.BEFORE) GB.text4 else GB.text)
        Text(sKey ?: "พัก", fontSize = 9.sp, lineHeight = 11.sp, color = if (sKey == null) GB.text4 else GB.text2, maxLines = 2, overflow = TextOverflow.Ellipsis)
        if (mark.isNotEmpty()) Text(mark, fontSize = 8.5.sp, lineHeight = 10.sp, color = if (st == DayStatus.DONE || st == DayStatus.REST_DONE) GB.ok else GB.text3, maxLines = 2)
    }
}
