package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.rememberDatePickerState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.SyncPhase
import com.gymbrodaily.nativeapp.data.TrackState
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.Exercise
import com.gymbrodaily.nativeapp.domain.LibraryCatalog
import com.gymbrodaily.nativeapp.domain.PlanExercise
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import com.gymbrodaily.nativeapp.domain.jsRound
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset
import java.time.temporal.ChronoUnit
import kotlin.math.max

const val WEB_APP_URL = "https://gymbro-daily.pages.dev"

/** session = เซสชันที่แก้, replaceId = ท่าที่จะถูกแทน (null = เพิ่มท่าใหม่), group = กลุ่มที่เปิดตัวกรองไว้ตอนแรก */
private data class PickTarget(val session: String, val replaceId: String?, val group: String?)

private fun Exercise.toPlan(setsReps: String) = PlanExercise(
    pattern = pattern, id = id, th = th, sub = sub, tier = tier, equip = equip,
    setsReps = setsReps, timeBased = LibraryCatalog.isTimeBased(this),
)

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
fun PlanScreen(
    t: TrackData,
    state: TrackState,
    today: LocalDate,
    store: TrackStore,
    email: String?,
    onSignOut: () -> Unit,
) {
    val p = t.program
    val tg = Tracking.targetsOf(t)
    var pickDate by remember { mutableStateOf(false) }
    val uri = LocalUriHandler.current
    val injuries = t.answers.list("Q26")
    var picker by remember { mutableStateOf<PickTarget?>(null) }
    var removing by remember { mutableStateOf<Pair<String, PlanExercise>?>(null) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            "โปรแกรมที่กำลังติดตาม", "แผนของฉัน",
            "เลือกเปลี่ยน เพิ่ม หรือลบท่าในแต่ละเซสชันได้เองจากคลังทั้งหมด การแก้มีผลกับทุกสัปดาห์ น้ำหนักที่เคยบันทึกยังอยู่ครบ " +
                "แต่สถิติ “ทำตามแผน” ของวันที่ผ่านมาจะนับตามท่าชุดใหม่ และถ้ากด “แก้ไขแผน / ทำแบบสอบถามใหม่” ท่าที่เลือกเองจะถูกแทนที่ด้วยท่าที่ระบบสร้างใหม่",
        )
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedButton(onClick = {
                store.updateOnboarding { it.copy(editPlan = true, step = 9, mode = "results") }
            }) { Text("แก้ไขแผน / ทำแบบสอบถามใหม่") }
            OutlinedButton(onClick = { pickDate = true }) { Text("ตั้งวันเริ่มใหม่") }
        }

        Card {
            val since = p.startDate?.let { max(0L, ChronoUnit.DAYS.between(LocalDate.parse(it), today)) }
            TileGrid(
                listOf(
                    Triple("รูปแบบโปรแกรม", p.splitLabel, "${p.days.size} วัน/สัปดาห์"),
                    Triple("วันเริ่มโปรแกรม", p.startDate?.let { Fmt.shortDate(it) } ?: "—", since?.let { "$it วันที่ผ่านมา" }),
                    Triple("TDEE โดยประมาณ", Fmt.kcal(tg.tdee), "kcal/วัน"),
                    Triple("เป้าแคลอรี่ต่อวัน", Fmt.kcal(tg.kcal), tg.kcalDirection + if (tg.kcalFloored) " · ปรับขึ้นถึงขั้นต่ำ" else ""),
                ),
            )
            MacroBar(tg.proteinG, tg.fatG, tg.carbG)
            if (tg.macroClamped) Hint("⚠️ ปรับสัดส่วนอัตโนมัติเพราะโปรตีน+ไขมันตั้งต้นเกินเป้าแคลอรี่ — เคสนี้ควรปรึกษาผู้เชี่ยวชาญเพิ่มเติม", color = GB.warn)
            Hint("น้ำ ${tg.waterL?.let { Fmt.one(it) } ?: "—"} ลิตร/วัน · ${tg.meals} มื้อ/วัน · นอน ${Fmt.hours(tg.sleepH)}/คืน")
        }

        SectionTitle("เซสชันในแผน")
        p.sessions.forEach { se ->
            val daysFor = p.days.filter { p.dayToSession[it] == se.key }
            Card {
                Text("เซสชัน “${se.key}”", fontWeight = FontWeight.SemiBold)
                Hint("${daysFor.size}x/สัปดาห์ — ${daysFor.joinToString(", ").ifEmpty { "—" }} · ~${p.minutesEstimate ?: ""}")
                se.exercises.forEach { ex ->
                    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.surface2).padding(10.dp)) {
                        Text(LibraryCatalog.GROUP_LABEL[ex.pattern] ?: ex.pattern, color = GB.text3, fontSize = 11.5.sp)
                        Row(verticalAlignment = Alignment.CenterVertically) {
                            Text(ex.th, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f))
                            Pill("Tier ${ex.tier}")
                        }
                        if (ex.sub.isNotEmpty()) Text(ex.sub, color = GB.text3, fontSize = 12.sp)
                        Text(ex.setsReps, color = GB.accent, fontSize = 12.5.sp)
                        LibraryCatalog.byId(ex.id)?.let { lib ->
                            val g = LibraryCatalog.guideFor(lib)
                            val risk = when (g.risk) { 0 -> GB.ok; 1 -> GB.branch; else -> GB.warn }
                            val hit = LibraryCatalog.cautionsFor(ex.id).filter { it in injuries }
                            Text(
                                g.riskLabel + if (hit.isNotEmpty()) " · ⚠ ตรงอาการ ${hit.joinToString(" · ")}" else "",
                                color = if (hit.isNotEmpty()) GB.warn else risk, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
                            )
                        }
                        Row(horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                            LinkButton("เปลี่ยนท่า") { picker = PickTarget(se.key, ex.id, ex.pattern) }
                            if (se.exercises.size > 1) LinkButton("ลบออก") { removing = se.key to ex }
                        }
                    }
                }
                OutlinedButton(onClick = { picker = PickTarget(se.key, null, null) }) { Text("+ เพิ่มท่าจากคลัง") }
            }
        }

        SectionTitle("บัญชีและการซิงก์")
        Card {
            Text(email ?: "", fontWeight = FontWeight.Medium)
            Hint(syncText(state))
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                OutlinedButton(onClick = { store.syncNow() }) { Text("ซิงก์ตอนนี้") }
                TextButton(onClick = onSignOut) { Text("ออกจากระบบ", color = GB.warn) }
            }
        }

        Card {
            Text("สิ่งที่ต้องรู้ก่อนใช้จริง", fontWeight = FontWeight.SemiBold)
            listOf(
                "ตัวเลข sets/reps, tier ของท่า และเกณฑ์แคลอรี่/มาโคร/น้ำ/การนอนทั้งหมดเป็น placeholder ที่ยังไม่ผ่านการ review จากเทรนเนอร์/นักโภชนาการตัวจริง",
                "ตารางยังหมุนวนซ้ำทุกสัปดาห์แบบเดิม ยังไม่มี progressive overload อัตโนมัติ — หน้า Progression แสดงข้อมูลย้อนหลังอย่างเดียว",
                "เป้าแคลอรี่ใช้ static multiplier จากลักษณะงาน ไม่ได้บวกแคลอรี่จากเซสชันที่ทำจริง",
                "ข้อมูลบันทึกลงเครื่องทันทีและซิงก์กับบัญชีเมื่อออนไลน์ — เปิดบนเว็บด้วยบัญชีเดียวกันก็เห็นข้อมูลชุดเดียวกัน",
                "นี่คือต้นแบบ ไม่ใช่คำแนะนำทางการแพทย์หรือโภชนาการ หากมีอาการผิดปกติระหว่างออกกำลังกาย ควรหยุดและปรึกษาแพทย์ทันที",
            ).forEach { Hint("• $it") }
        }
    }

    picker?.let { target ->
        val replacing = target.replaceId != null
        ExercisePickerSheet(
            title = if (replacing) "เลือกท่าใหม่แทนท่าเดิม" else "เพิ่มท่าในเซสชัน “${target.session}”",
            injuries = injuries,
            inPlan = p.sessions.flatMap { it.exercises }.map { it.id }.toSet(),
            startGroup = target.group,
            onPick = { e ->
                store.editSession(target.session) { list ->
                    when {
                        replacing -> list.map { old ->
                            if (old.id != target.replaceId) old
                            else if (list.any { it.id == e.id } && e.id != old.id) old
                            else e.toPlan(if (LibraryCatalog.isTimeBased(e) == old.timeBased) old.setsReps else LibraryCatalog.defaultSetsReps(e, p.goal))
                        }
                        list.any { it.id == e.id } -> list
                        else -> list + e.toPlan(LibraryCatalog.defaultSetsReps(e, p.goal))
                    }
                }
                picker = null
            },
            onDismiss = { picker = null },
        )
    }

    removing?.let { (sessionKey, ex) ->
        AlertDialog(
            onDismissRequest = { removing = null },
            title = { Text("ลบ ${ex.th} ออกจากเซสชัน “$sessionKey”?") },
            text = { Text("ท่านี้จะหายจากทุกสัปดาห์ของเซสชันนี้ น้ำหนักที่เคยบันทึกไว้ยังไม่ถูกลบ") },
            confirmButton = {
                TextButton(onClick = {
                    store.editSession(sessionKey) { list -> list.filterNot { it.id == ex.id } }
                    removing = null
                }) { Text("ลบ", color = GB.warn) }
            },
            dismissButton = { TextButton(onClick = { removing = null }) { Text("ยกเลิก") } },
        )
    }

    if (pickDate) {
        val initial = (p.startDate?.let { LocalDate.parse(it) } ?: today).atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli()
        val dp = rememberDatePickerState(initialSelectedDateMillis = initial)
        DatePickerDialog(
            onDismissRequest = { pickDate = false },
            confirmButton = {
                TextButton(onClick = {
                    dp.selectedDateMillis?.let { ms ->
                        store.setStartDate(Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate().toString())
                    }
                    pickDate = false
                }) { Text("บันทึกวันเริ่ม") }
            },
            dismissButton = { TextButton(onClick = { pickDate = false }) { Text("ยกเลิก") } },
        ) {
            Column {
                DatePicker(dp)
                Hint(
                    "ถ้าเปลี่ยนวันเริ่ม บันทึกเก่ายังอยู่ครบ แต่การนับสตรีค/% ทำตามแผนจะเริ่มจากวันใหม่",
                    Modifier.padding(10.dp),
                )
            }
        }
    }
}


fun syncText(s: TrackState): String = when {
    s.phase == SyncPhase.SYNCING -> "กำลังซิงก์…"
    s.pendingCount > 0 -> "ออฟไลน์ · รอส่ง ${s.pendingCount} รายการ (บันทึกในเครื่องแล้ว จะส่งให้อัตโนมัติ)"
    s.phase == SyncPhase.OFFLINE -> "เชื่อมต่อ server ไม่ได้ — แสดงข้อมูลล่าสุดในเครื่อง"
    else -> "ซิงก์แล้ว"
}

@Composable
private fun MacroBar(proteinG: Int?, fatG: Int?, carbG: Int?) {
    if (proteinG == null || fatG == null || carbG == null) {
        Hint("ยังคำนวณสัดส่วนมาโครไม่ได้ — ข้อมูลในแบบสอบถามไม่ครบ")
        return
    }
    val pK = proteinG * 4.0; val fK = fatG * 9.0; val cK = carbG * 4.0
    val tot = pK + fK + cK
    val pPct = jsRound(pK / tot * 100).toInt()
    val fPct = jsRound(fK / tot * 100).toInt()
    val cPct = 100 - pPct - fPct
    Text("สัดส่วนมาโครที่แนะนำ", color = GB.text3, fontSize = 12.sp)
    Row(Modifier.fillMaxWidth().height(10.dp).clip(RoundedCornerShape(5.dp))) {
        listOf(pPct to GB.accent, fPct to GB.sleep, cPct to GB.branch).forEach { (w, c) ->
            if (w > 0) Box(Modifier.weight(w.toFloat()).fillMaxHeight().background(c))
        }
    }
    FlowRow(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
        Legend(GB.accent, "โปรตีน ${proteinG}g ($pPct%)")
        Legend(GB.sleep, "ไขมัน ${fatG}g ($fPct%)")
        Legend(GB.branch, "คาร์บ ${carbG}g ($cPct%)")
    }
}

@Composable
private fun Legend(c: Color, text: String) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        Box(Modifier.size(9.dp).clip(RoundedCornerShape(2.dp)).background(c))
        Text(" $text", fontSize = 12.sp, color = GB.text2)
    }
}
