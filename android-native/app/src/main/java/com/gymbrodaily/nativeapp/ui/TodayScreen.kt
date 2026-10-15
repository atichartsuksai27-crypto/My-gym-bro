package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.ProgressGoal
import com.gymbrodaily.nativeapp.domain.Progression
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import java.time.LocalDate

@Composable
fun TodayScreen(t: TrackData, today: LocalDate, store: TrackStore, onNavigate: (Tab) -> Unit) {
    val iso = today.toString()
    val p = t.program
    val counts = Tracking.dayCounts(t, iso)
    val pct = if (counts.total > 0) counts.done.toFloat() / counts.total else 0f
    val sKey = Tracking.sessionKeyFor(p, iso)
    val tKey = Tracking.sessionKeyFor(p, today.plusDays(1).toString())
    val tSess = Tracking.sessionDefFor(p, tKey)

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            Fmt.longDate(iso), "วันนี้: ${dayLabel(t, iso, today, "พัก").text}",
            if (sKey != null || ProgressGoal.cardioPlannedFor(p, iso)) "ตามตารางที่ผูกกับวันที่จริง — ติ๊กทีละข้อระหว่างวันได้เลย ข้อมูลบันทึกทันทีที่กด"
            else "วันพักตามตาราง — ถ้าทำ cardio เพิ่มก็บันทึกได้ เช็คลิสต์ที่เหลือคือโภชนาการ การนอน และน้ำหนักตัว",
        )
        val st by store.state.collectAsState()
        PlanBanners(t, store, false) { PlanUi.openDraft = true; onNavigate(Tab.PLAN) }
        CalorieTargetAlert(t, iso, store)
        FatAlert(t, iso, store, st.fatSeen)
        PgAlert(t, iso) { onNavigate(Tab.PROGRESS) }
        Card {
            Row {
                Text("ความคืบหน้าวันนี้", fontWeight = FontWeight.SemiBold, modifier = androidx.compose.ui.Modifier.weight(1f))
                Text("${counts.done}/${counts.total}", color = GB.text2)
            }
            ProgressBar(pct, color = if (pct >= 1f) GB.ok else GB.accent)
            Text(
                if (pct >= 1f) "ทำครบทุกข้อของวันนี้แล้ว"
                else "เหลืออีก ${counts.total - counts.done} ข้อ" + (if (sKey != null) " · เทรนวันนี้ ${p.trainTime ?: ""}" else ""),
                color = GB.text2, fontSize = 12.5.sp,
            )
        }
        DayEditor(t, iso, store)
        Card {
            Text("พรุ่งนี้", fontWeight = FontWeight.SemiBold)
            val tomorrow = today.plusDays(1)
            Text(dayLabel(t, tomorrow.toString(), today, "พักฟื้น"), fontWeight = FontWeight.Medium)
            Hint(
                tSess?.exercises?.take(3)?.joinToString(" · ") { it.th }
                    ?: if (ProgressGoal.cardioPlannedFor(p, tomorrow.toString())) "Cardio ~${Progression.n(ProgressGoal.cardioMinFor(p, Tracking.thaiWeekday(tomorrow.toString())))} นาที" else "ยืดกล้ามเนื้อ เดินเบาๆ และนอนให้ครบเป้า",
            )
            LinkButton("ดูตารางทั้งสัปดาห์ →") { onNavigate(Tab.SCHEDULE) }
        }
        Card {
            Text("ทำตามแผนไม่ได้?", fontWeight = FontWeight.SemiBold)
            Hint("ข้ามได้โดยไม่ต้องแก้อะไร — เมื่อผ่านวันไปแล้ว ชื่อกิจกรรมที่ไม่สำเร็จจะเป็นตัวแดงในตารางฝึก — บันทึกย้อนหลังได้แค่เมื่อวาน หลังจากนั้นวันนั้นจะล็อก")
            LinkButton("ปรับแผน/เปลี่ยนวันฝึก →") { onNavigate(Tab.PLAN) }
        }
    }
}
