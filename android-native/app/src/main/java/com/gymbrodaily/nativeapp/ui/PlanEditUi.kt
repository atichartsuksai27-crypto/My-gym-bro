package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.domain.Catalog
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.PlanEditing
import com.gymbrodaily.nativeapp.domain.SchedSession
import com.gymbrodaily.nativeapp.domain.Schedule

/* ============================================================
   ตัวช่วยหน้าจอแก้แผน — ใช้ทั้งหน้าตรวจแผน (แบบสอบถาม) และหน้า "แผนของฉัน"
   ตรงกับ scheduleEditorHTML / coverageHTML / banner ของเว็บ
   ============================================================ */

/** สถานะข้ามหน้า: banner บนหน้า "วันนี้" กด "เลือกวัน…" แล้วเปิดตัวแก้วันฝึกที่หน้า "แผนของฉัน" ให้เลย */
object PlanUi {
    var openDraft by mutableStateOf(false)
}

@Composable
internal fun WebBanner(icon: String, bg: Color, line: Color, content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(bg).border(1.dp, line, RoundedCornerShape(20.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(icon, fontSize = 18.sp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

/**
 * ตัวเลือกวันฝึก/วัน cardio ของสัปดาห์ (scheduleEditorHTML) — วันว่างคือวันที่ "เลือกได้" กดเลือกเฉพาะวันที่จะเล่นจริง
 * sessions = เซสชันที่ใช้จัดตาราง (ของแบบที่เลือก หรือของโปรแกรมที่ใช้อยู่)
 */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun ScheduleEditor(
    splitKey: String,
    avail: List<String>,
    train: List<String>,
    cardio: List<String>,
    minByDay: Map<String, Double>,
    sessMinutes: String,
    sessions: List<SchedSession>,
    msg: String?,
    onTrain: (String) -> Unit,
    onCardio: (String) -> Unit,
    onMins: (String, Double) -> Unit,
) {
    val def = Catalog.SPLIT_DEFS.getValue(splitKey)
    val sch = Schedule.bestSchedule(sessions, train)
    val d2s = sch.list.associate { it.day to it.session }
    val minTrain = Schedule.minTrainDays(splitKey, avail)
    if (sch.hard != 0) {
        WebBanner("⚠️", GB.warnSoft, GB.warnLine) {
            Text("วันฝึกที่เลือกทำให้${sch.clash?.let { Schedule.clashText(it) } ?: ""} — กล้ามเนื้อต้องพัก ~48 ชม. เอาวันใดวันหนึ่งออก แล้วจึงบันทึก/เริ่มโปรแกรมได้", fontSize = 13.5.sp, lineHeight = 19.sp)
        }
    } else if (!msg.isNullOrEmpty()) {
        WebBanner("⚠️", GB.branchSoft, GB.branch) { Text(msg, fontSize = 13.5.sp, lineHeight = 19.sp) }
    }
    Catalog.DAYS.forEachIndexed { i, d ->
        val isAvail = d in avail
        val isTrain = d in train
        val isCardio = d in cardio
        val blocked = isAvail && !isTrain && sch.hard == 0 && Schedule.bestSchedule(sessions, train + d).hard > 0
        val sKey = if (isTrain) d2s[d] else null
        val se = sKey?.let { k -> sessions.firstOrNull { it.key == k } }
        val name = listOfNotNull(sKey, if (isCardio) "Cardio" else null).joinToString(" + ").ifEmpty { if (isAvail) "พัก" else "ไม่ว่าง" }
        Column(
            Modifier.fillMaxWidth().clip(RoundedCornerShape(22.dp))
                .background(if (isTrain || isCardio) GB.surface else GB.bg)
                .border(1.dp, GB.border, RoundedCornerShape(22.dp)).padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(6.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Text(Catalog.DAYS_SHORT[i], fontWeight = FontWeight.SemiBold, color = GB.text2)
                if (isTrain && sessMinutes.isNotEmpty()) Pill(sessMinutes)
            }
            Text(name, fontWeight = FontWeight.Medium, color = if (isAvail) GB.text else GB.text4)
            if (se != null) {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    se.bases.forEach { Pill(Catalog.PATTERN_SHORT[it] ?: it) }
                }
            }
            if (isAvail) {
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    GbChip(isTrain, { onTrain(d) }, { Text("ฝึก", color = if (blocked) GB.text4 else Color.Unspecified) })
                    GbChip(isCardio, { onCardio(d) }, { Text("Cardio") })
                }
                if (isCardio) {
                    var rejected by androidx.compose.runtime.remember(d) { mutableStateOf(false) }
                    Row(verticalAlignment = Alignment.CenterVertically) {
                        Text("Cardio วันนี้", color = GB.text3, fontSize = 13.sp, modifier = Modifier.width(96.dp))
                        NumberField(
                            minByDay[d] ?: Generator.CARDIO_DEFAULT_MIN,
                            { text, v ->
                                val valid = v != null && v.isFinite() && v in 5.0..300.0
                                rejected = text.isNotBlank() && !valid
                                if (valid) onMins(d, Math.round(v!!).toDouble())
                            },
                            "นาที", Modifier.weight(1f), integer = true, isError = rejected, commitOnBlur = true,
                        )
                        Text("  นาที", color = GB.text3, fontSize = 13.sp)
                    }
                }
            } else {
                Hint("ไม่ได้เลือกเป็นวันว่างในแบบสอบถาม")
            }
            if (blocked) Hint("ฝึกไม่ได้ — ติดกับวันฝึกกล้ามเนื้อกลุ่มเดียวกัน (พักได้ หรือทำ cardio)", color = GB.warn)
        }
    }
    Hint(
        if (splitKey == "fullbody") "Full Body ฝึกทั้งตัวทุกครั้ง จึงต้องเว้นอย่างน้อย 1 วันระหว่างวันฝึก (นับอาทิตย์ → จันทร์ด้วย) ให้กล้ามเนื้อได้พัก ~48 ชม."
        else "ระบบจัดเซสชันลงวันให้อัตโนมัติ ไม่ให้กล้ามเนื้อกลุ่มเดียวกันโดนในวันติดกัน (นับอาทิตย์ → จันทร์ด้วย) — วันที่จัดไม่ได้จะขึ้นว่าฝึกไม่ได้",
    )
    if (train.size >= minTrain) {
        Hint("เลือกวันฝึกไว้ ${train.size} วัน (ขั้นต่ำของ ${def.label} คือ $minTrain วัน) · Cardio ${cardio.size} วัน — เลือกได้เฉพาะวันที่ว่าง ไม่ต้องใช้ครบทุกวัน cardio อยู่วันเดียวกับวันฝึกหรือคนละวันก็ได้ และตั้งนาทีแยกแต่ละวันได้")
    } else {
        WebBanner("⚠️", GB.warnSoft, GB.warnLine) {
            Text("${def.label} ต้องมีวันฝึกอย่างน้อย $minTrain วัน/สัปดาห์ ตอนนี้เลือกไว้ ${train.size} วัน — กด “ฝึก” เพิ่มในวันที่ว่าง", fontSize = 13.5.sp, lineHeight = 19.sp)
        }
    }
}

/** กล้ามเนื้อที่ได้ฝึกโดยตรงต่อสัปดาห์ (coverageHTML) */
@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun CoverageCard(covered: List<String>, note: String?) {
    val n = PlanEditing.MUSCLE_ORDER.count { it in covered }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(GB.surface2).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        Text("กล้ามเนื้อที่ได้ฝึกโดยตรงต่อสัปดาห์: $n/${PlanEditing.MUSCLE_ORDER.size} ส่วน", fontSize = 13.5.sp, fontWeight = FontWeight.Medium)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            PlanEditing.MUSCLE_ORDER.forEach { m ->
                val ok = m in covered
                Pill((if (ok) "✓ " else "· ") + (Catalog.PATTERN_SHORT[m] ?: m), if (ok) GB.ok else GB.text3, if (ok) GB.okSoft else GB.bg)
            }
        }
        if (!note.isNullOrEmpty()) Hint(note)
    }
}

@Composable
internal fun TextLinkRow(text: String, action: String, onClick: () -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Text(text, fontSize = 13.5.sp, lineHeight = 19.sp, modifier = Modifier.weight(1f, fill = false))
        TextButton(onClick = onClick) { Text(action, color = GB.accent, fontSize = 13.sp) }
    }
}

@Composable
internal fun OutlinedAction(text: String, onClick: () -> Unit, modifier: Modifier = Modifier) {
    OutlinedButton(onClick = onClick, modifier = modifier) { Text(text, fontSize = 13.sp) }
}

/** แจ้งเตือนบนหน้า "วันนี้" และ "แผนของฉัน": แผนเก่าไม่มีระบบเลือกวัน / ตารางชนกัน / มีตารางแบบใหม่ (oldScheduleBanner, scheduleClashBanner, planUpdateBanner) */
@Composable
fun PlanBanners(t: com.gymbrodaily.nativeapp.domain.TrackData, store: com.gymbrodaily.nativeapp.data.TrackStore, draftOpen: Boolean, goDraft: () -> Unit) {
    val p = t.program
    if (p.availableDays == null && !draftOpen) {
        WebBanner("⚠️", GB.warnSoft, GB.warnLine) {
            Text("แผนนี้สร้างก่อนมีระบบเลือกวัน — ตอนนี้ ทุกวันที่ว่างยังถูกนับเป็นวันฝึก", fontSize = 13.5.sp, lineHeight = 19.sp)
            LinkButton("เลือกวันที่จะเล่นจริง และวัน cardio →", goDraft)
        }
    }
    if (p.availableDays != null && !draftOpen) {
        PlanEditing.programClash(p)?.let { c ->
            WebBanner("⚠️", GB.warnSoft, GB.warnLine) {
                Text("ตารางตอนนี้ทำให้${Schedule.clashText(c)} — กล้ามเนื้อควรพัก ~48 ชม. ก่อนฝึกซ้ำ", fontSize = 13.5.sp, lineHeight = 19.sp)
                LinkButton("ปรับวันฝึก →", goDraft)
            }
        }
    }
    if (PlanEditing.planOutdated(p)) {
        WebBanner("ⓘ", GB.surface2, GB.borderStrong) {
            Text(
                "มีตารางแบบใหม่ที่ หมุนเวียนท่าในแต่ละวัน ให้โดนกล้ามเนื้อครบทุกส่วนในสัปดาห์ (ตอนนี้ครอบคลุม " +
                    "${PlanEditing.programCoverage(p).count { it in PlanEditing.MUSCLE_ORDER }}/${PlanEditing.MUSCLE_ORDER.size} ส่วน)",
                fontSize = 13.5.sp, lineHeight = 19.sp,
            )
            LinkButton("อัปเดตตารางเป็นแบบใหม่ →") { store.beginEditPlan() }
        }
    }
}
