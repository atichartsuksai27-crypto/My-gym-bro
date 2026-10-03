package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.DatePicker
import androidx.compose.material3.DatePickerDialog
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.FilterChip
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
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
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.Onboarding
import com.gymbrodaily.nativeapp.data.TrackState
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.Answers
import com.gymbrodaily.nativeapp.domain.Candidate
import com.gymbrodaily.nativeapp.domain.Catalog
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.QKind
import com.gymbrodaily.nativeapp.domain.Question
import com.gymbrodaily.nativeapp.domain.Questions
import com.gymbrodaily.nativeapp.domain.with
import kotlinx.serialization.json.JsonPrimitive
import java.time.Instant
import java.time.LocalDate
import java.time.ZoneOffset

/* ============================================================
   แบบสอบถาม onboarding 9 หมวด → สรุปคำตอบ → ตรวจแผน → เริ่มโปรแกรม (ตรงกับ renderOnboarding ของเว็บ)
   ============================================================ */

@Composable
fun OnboardingFlow(state: TrackState, store: TrackStore, hasProgram: Boolean) {
    val onb = state.onb
    fun update(change: (Onboarding) -> Onboarding) = store.updateOnboarding(change)
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            "Gymbro Daily · ตั้งค่าครั้งแรก",
            if (onb.step >= 9) (if (onb.mode == "results") "ตรวจแผนก่อนเริ่ม" else "สรุปคำตอบ") else "แบบสอบถาม",
            "ตอบ 9 หมวดเพื่อให้ระบบสร้างตารางฝึกและเป้าหมายรายวันให้ — คำตอบบันทึกทันทีและซิงก์กับเว็บ ทำค้างไว้แล้วกลับมาต่อได้",
        )
        if (hasProgram) OutlinedButton(onClick = { update { it.copy(editPlan = false) } }) { Text("← กลับไปแอป (ไม่เปลี่ยนแผน)") }
        when {
            onb.step < 9 -> CategoryPage(onb, ::update)
            onb.mode == "results" -> ResultsPage(onb, store, hasProgram, ::update)
            else -> SummaryPage(onb, hasProgram, ::update)
        }
    }
}

/* ---------- หน้าหมวดคำถาม ---------- */

@Composable
private fun CategoryPage(onb: Onboarding, update: ((Onboarding) -> Onboarding) -> Unit) {
    val cat = Questions.CATEGORIES[onb.step]
    val a = onb.answers
    val ok = Questions.catComplete(cat.id, a)
    ProgressBar(onb.step / 9f)
    Text("หมวด ${cat.id} / 9", color = GB.text3, fontSize = 12.sp)
    Text(cat.name, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
    Questions.visibleQsFor(cat.id, a).forEach { q ->
        androidx.compose.runtime.key(q.id) {
            QuestionBlock(q, a) { newAnswers -> update { it.copy(answers = newAnswers) } }
        }
    }
    Row(verticalAlignment = Alignment.CenterVertically) {
        OutlinedButton(onClick = { update { it.copy(step = it.step - 1) } }, enabled = onb.step > 0) { Text("← ย้อนกลับ") }
        Spacer(Modifier.weight(1f))
        Button(onClick = { update { it.copy(step = it.step + 1, mode = null) } }, enabled = ok) {
            Text(if (onb.step == 8) "ส่งแบบสอบถาม" else "ถัดไป →")
        }
    }
    if (!ok) Hint("ตอบคำถามที่จำเป็นในหมวดนี้ให้ครบก่อนไปหมวดถัดไป", color = GB.branch)
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun QuestionBlock(q: Question, a: Answers, set: (Answers) -> Unit) {
    fun field(id: String, v: String) = set(a.with(id, JsonPrimitive(v)))
    Card {
        Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
            Text(q.id, color = GB.text4, fontSize = 11.sp)
            if (q.main) Pill("คำถามหลัก") else Pill("แตกกิ่ง · ${q.branchFrom}", GB.branch, GB.branchSoft)
        }
        Text(q.label, fontWeight = FontWeight.Medium, fontSize = 16.sp)
        if (q.id == "Q1") GoalFeasibility(a)
        when (q.kind) {
            QKind.BODYFAT -> BodyFatPicker(a.str("Q9"), a.str(q.id)) { set(Questions.setAnswer(a, q.id, it)) }
            QKind.SINGLE, QKind.MULTI -> {
                FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    q.options.forEach { o ->
                        val sel = if (q.kind == QKind.MULTI) o in a.list(q.id) else a.str(q.id) == o
                        val recommended = q.id == "Q1" && a.str("Q0")?.let { Questions.BODYFAT_GOAL_MAP[it] } == o
                        FilterChip(
                            selected = sel,
                            onClick = { set(Questions.setAnswer(a, q.id, o)) },
                            label = { Text(o + if (recommended) "  · แนะนำ" else "", fontSize = 13.5.sp) },
                        )
                    }
                }
                q.note?.let { Hint(it) }
            }
            QKind.NUMBER -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    NumberField(a.parseFloat(q.id).takeIf { !it.isNaN() }, { t, _ -> field(q.id, t) }, "กรอกตัวเลข", Modifier.weight(1f))
                    q.unit?.let { Text("  $it", color = GB.text3) }
                }
                if (q.required && !Generator.numberAnswered(a, q.id)) Hint("* จำเป็นต้องกรอกก่อนไปข้อถัดไป", color = GB.warn)
            }
            QKind.TEXT -> TextInput(a.str(q.id) ?: "", "พิมพ์คำตอบ (ไม่บังคับ)") { field(q.id, it) }
        }
        ExtraFields(q, a, ::field)
        QuestionNotes(q, a)
    }
}

@Composable
private fun TextInput(value: String, placeholder: String, onChange: (String) -> Unit) {
    var text by remember { mutableStateOf(value) }
    OutlinedTextField(
        text, { text = it; onChange(it) }, Modifier.fillMaxWidth(),
        placeholder = { Text(placeholder, color = GB.text4) }, singleLine = true,
    )
}

@Composable
private fun NumRow(a: Answers, id: String, placeholder: String, unit: String, field: (String, String) -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        NumberField(a.parseFloat(id).takeIf { !it.isNaN() }, { t, _ -> field(id, t) }, placeholder, Modifier.weight(1f))
        Text("  $unit", color = GB.text3)
    }
}

/** ช่องกรอกย่อยที่โผล่ตามคำตอบ (เหมือนเว็บ) */
@Composable
private fun ExtraFields(q: Question, a: Answers, field: (String, String) -> Unit) {
    when {
        q.id == "Q13" && a.str("Q13") == "ระบุ" -> NumRow(a, "Q13_val", "น้ำหนักเป้าหมาย", "kg", field)
        q.id == "Q4b" && a.str("Q4b") == "ระบุตัวเลข" -> TextInput(a.str("Q4b_val") ?: "", "เช่น 65kg หรือ 18%") { field("Q4b_val", it) }
        q.id == "Q14" && a.str("Q14") == "ทราบ (กรอกตัวเลข)" -> NumRow(a, "Q14_val", "เปอร์เซ็นต์ไขมัน", "%", field)
        q.id == "Q14" && a.str("Q14") == "ไม่ทราบแต่มีรอบเอว-รอบคอ-รอบสะโพกให้คำนวณ" -> {
            NumRow(a, "Q14_waist", "รอบเอว", "cm", field)
            NumRow(a, "Q14_neck", "รอบคอ", "cm", field)
            NumRow(a, "Q14_hip", "รอบสะโพก", "cm", field)
        }
        q.id == "Q18" && a.str("Q18") == "รู้ (กรอกตัวเลข)" -> {
            NumRow(a, "Q18_squat", "Squat", "kg", field)
            NumRow(a, "Q18_bench", "Bench", "kg", field)
            NumRow(a, "Q18_deadlift", "Deadlift", "kg", field)
        }
        q.id == "Q26" && "อื่นๆ ระบุ" in a.list("Q26") -> TextInput(a.str("Q26_other") ?: "", "ระบุตำแหน่ง/อาการอื่นๆ") { field("Q26_other", it) }
    }
}

@Composable
private fun Note(title: String, body: String, warn: Boolean = false) {
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp))
            .background(if (warn) GB.warnSoft else GB.accentSoft)
            .border(1.dp, if (warn) GB.warnLine else GB.accentLine, RoundedCornerShape(8.dp))
            .padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(title, fontSize = 11.5.sp, color = if (warn) GB.warn else GB.accent, fontWeight = FontWeight.Medium)
        Text(body, fontSize = 13.sp, lineHeight = 19.sp)
    }
}

@Composable
private fun QuestionNotes(q: Question, a: Answers) {
    val goal = a.str("Q1")
    if (q.id == "Q1" && goal != null) {
        BenchTable(goal)
        if (goal !in Catalog.SUPPORTED_GOALS) Note(
            "ข้อจำกัดของต้นแบบนี้ (MVP)",
            "เป้าหมาย \"$goal\" ยังไม่มี generator รองรับในเวอร์ชันนี้ — ตอบแบบสอบถามต่อได้ตามปกติ (คำตอบจะถูกเก็บไว้) แต่ระบบจะยังสร้างตารางออกกำลังกายให้ไม่ได้จนกว่าจะรองรับ ถ้าต้องการสร้างตารางตอนนี้ ให้กลับไปเลือกเป้าหมาย ลดไขมัน / เพิ่มกล้ามเนื้อ / Recomposition / รักษาสุขภาพทั่วไป แทน",
            warn = true,
        )
    }
    if (q.id == "Q3") timeFeedback(a)?.let { Note("ข้อความอัตโนมัติจากระบบ", it, warn = true) }
    if (q.id == "Q15") Note(
        "คำเตือนด้านการแพทย์ (แสดงคู่กับคำถามนี้เสมอ)",
        "เป้าหมายที่คุณตั้งไว้ค่อนข้างห่างจากน้ำหนักปัจจุบันมาก การไปถึงอย่างปลอดภัยอาจต้องใช้ระยะเวลานานกว่าที่คิด แนะนำให้ปรึกษาแพทย์หรือผู้เชี่ยวชาญก่อนเริ่มโปรแกรม",
        warn = true,
    )
    val loc = a.str("Q20")
    if (q.id == "Q20" && loc != null && loc !in Catalog.SUPPORTED_LOCATIONS) Note(
        "ข้อจำกัดของต้นแบบนี้ (MVP)",
        "สถานที่ \"$loc\" ยังไม่มี generator รองรับในเวอร์ชันนี้ (รองรับ \"ฟิตเนส-ยิม\" กับ \"ที่บ้าน\") — ตอบแบบสอบถามต่อได้ตามปกติ แต่ระบบจะยังสร้างตารางออกกำลังกายให้ไม่ได้จนกว่าจะรองรับ ถ้าต้องการสร้างตารางตอนนี้ ให้กลับไปเลือก \"ฟิตเนส-ยิม\" หรือ \"ที่บ้าน\" แทน",
        warn = true,
    )
    if (q.id == "Q28") Note(
        "Safety Gate",
        "คำตอบข้อนี้ใช้เป็นจุดหยุดจริง (hard block) ก่อนสร้างตาราง — ถ้าตอบอย่างอื่นนอกจาก \"ได้รับอนุญาตแล้ว\" ระบบจะยังไม่สร้างตารางออกกำลังกายให้จนกว่าจะได้รับอนุญาตจากแพทย์",
        warn = true,
    )
}

private fun timeFeedback(a: Answers): String? {
    val b = a.str("Q1")?.let { Questions.BENCH[it] } ?: return null
    val days = a.list("Q2")
    val t = a.str("Q3") ?: return null
    if (a.raw("Q2") == null) return null
    val est = Questions.Q3_MIN[t] ?: 0
    return if (days.size < b.days.first || est < b.mins.first) "เวลาที่มีน้อยกว่าที่แนะนำ ระบบจะปรับความเข้มข้นให้เหมาะกับเวลาที่มีแทน" else null
}

@Composable
private fun BenchTable(goal: String) {
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(GB.surface2).padding(10.dp)) {
        Text("ข้อความอัตโนมัติจากระบบ (ไม่ใช่คำถาม)", fontSize = 11.sp, color = GB.text3)
        Questions.BENCH.forEach { (g, b) ->
            Row(Modifier.padding(vertical = 2.dp)) {
                Text(g, fontSize = 12.5.sp, modifier = Modifier.weight(1f), color = if (g == goal) GB.accent else GB.text2, fontWeight = if (g == goal) FontWeight.SemiBold else FontWeight.Normal)
                Text(b.label, fontSize = 12.sp, modifier = Modifier.weight(1f), color = GB.text3)
            }
        }
    }
}

/** เทียบความเป็นไปได้ของแต่ละเป้าหมายกับวัน/เวลาที่ตอบไว้ — ไม่ปิดกั้น แค่ให้ข้อมูล */
@Composable
private fun GoalFeasibility(a: Answers) {
    val days = a.list("Q2")
    val t = a.str("Q3")
    if (days.isEmpty() || t == null) return
    val est = Questions.Q3_MIN[t] ?: 0
    Column(Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(GB.surface2).padding(10.dp)) {
        Text("เทียบกับวัน/เวลาที่ตอบไว้ (เลือกได้ทุกเป้าหมาย — เวลาไม่พอระบบจะปรับความเข้มข้นให้แทน ไม่ปิดกั้น)", fontSize = 11.sp, color = GB.text3)
        Questions.BENCH.forEach { (g, b) ->
            val ok = days.size >= b.days.first && est >= b.mins.first
            Row(Modifier.padding(vertical = 2.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(g, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
                if (ok) Pill("พอเวลา", GB.ok, GB.okSoft) else Pill("เวลาน้อยกว่าที่แนะนำ")
            }
        }
    }
}

/* ---------- หน้าสรุปคำตอบ ---------- */

@Composable
private fun SummaryPage(onb: Onboarding, hasProgram: Boolean, update: ((Onboarding) -> Onboarding) -> Unit) {
    val a = onb.answers
    var confirmRestart by remember { mutableStateOf(false) }
    TileGrid(
        listOf(
            Triple("ข้อที่ตอบแล้ว", Questions.countAnswered(a).toString(), null),
            Triple("ข้อที่เจอในเส้นทางนี้", Questions.countVisibleTotal(a).toString(), null),
        ),
    )
    Questions.CATEGORIES.forEach { cat ->
        val qs = Questions.QUESTIONS.filter { q ->
            q.cat == cat.id && q.visible(a) && a.raw(q.id).let { it != null && it !is kotlinx.serialization.json.JsonNull && a.str(q.id) != "" }
        }
        if (qs.isEmpty()) return@forEach
        Card {
            Text("หมวด ${cat.id} — ${cat.name}", fontWeight = FontWeight.SemiBold)
            qs.forEach { q ->
                Column {
                    Text("${q.id} · ${q.label}", color = GB.text3, fontSize = 12.sp)
                    Text(answerText(a, q.id), fontSize = 14.sp)
                }
            }
        }
    }
    val ready = Readiness(a)
    if (ready) Button(onClick = { update { it.copy(mode = "results") } }, Modifier.fillMaxWidth()) { Text("สร้างตารางออกกำลังกายของฉัน →") }
    OutlinedButton(onClick = { update { it.copy(step = 8, mode = null) } }, Modifier.fillMaxWidth()) { Text("← กลับไปแก้คำตอบ") }
    TextButton(onClick = { confirmRestart = true }) { Text("เริ่มทำแบบสอบถามใหม่ทั้งหมด", color = GB.warn) }
    if (confirmRestart) AlertDialog(
        onDismissRequest = { confirmRestart = false },
        title = { Text("ล้างคำตอบทั้งหมด?") },
        text = { Text("คำตอบแบบสอบถามจะถูกล้างทั้งบนเครื่องและบนเว็บ" + if (hasProgram) " (แผนที่ใช้อยู่ไม่เปลี่ยนจนกว่าจะกดเริ่มโปรแกรมใหม่)" else "") },
        confirmButton = {
            TextButton(onClick = {
                confirmRestart = false
                update { Onboarding(editPlan = hasProgram) }
            }) { Text("ล้างและเริ่มใหม่", color = GB.warn) }
        },
        dismissButton = { TextButton(onClick = { confirmRestart = false }) { Text("ยกเลิก") } },
    )
}

private fun answerText(a: Answers, id: String): String {
    val raw = a.raw(id)
    return if (raw is kotlinx.serialization.json.JsonArray) a.list(id).joinToString(", ") else (raw as? JsonPrimitive)?.content ?: ""
}

/** ตรวจขอบเขต/ความปลอดภัย/ค่าผิดปกติ แล้วแสดงผล — คืน true ถ้าพร้อมสร้างตาราง */
@Composable
private fun Readiness(a: Answers): Boolean {
    val scope = Generator.inScope(a)
    val issues = Generator.sanityIssues(a)
    val gate = Generator.safetyGate(a)
    val ready = scope && issues.isEmpty() && !gate.blocked
    if (ready) {
        Note("พร้อมสร้างตาราง", "คำตอบของคุณผ่านเงื่อนไขความปลอดภัยและอยู่ในขอบเขตที่รองรับแล้ว กดปุ่มด้านล่างเพื่อสร้างตารางออกกำลังกาย + เป้าหมายโภชนาการของคุณ")
        return true
    }
    val parts = buildList {
        if (!scope) add("ขอบเขต MVP: สร้างตารางได้สำหรับ 4 เป้าหมาย (ลดไขมัน / เพิ่มกล้ามเนื้อ / Recomposition / รักษาสุขภาพทั่วไป) และเฉพาะสถานที่ \"ฟิตเนส-ยิม\" หรือ \"ที่บ้าน\" เท่านั้น")
        if (gate.blocked) add("Safety Gate: ${gate.reason}")
        if (issues.isNotEmpty()) add("ตรวจค่านี้อีกครั้ง: " + issues.joinToString(" · "))
    }
    Note("ยังสร้างตารางไม่ได้ตอนนี้", parts.joinToString("\n\n"), warn = gate.blocked || issues.isNotEmpty())
    return false
}

/* ---------- หน้าตรวจแผนก่อนเริ่ม ---------- */

@OptIn(ExperimentalMaterial3Api::class, ExperimentalLayoutApi::class)
@Composable
private fun ResultsPage(onb: Onboarding, store: TrackStore, hasProgram: Boolean, update: ((Onboarding) -> Onboarding) -> Unit) {
    val a = onb.answers
    val plan = onb.plan
    if (!Readiness(a)) {
        OutlinedButton(onClick = { update { it.copy(mode = null) } }) { Text("← กลับไปหน้าสรุปคำตอบ") }
        return
    }
    val t = Generator.computeTargets(a)
    val split = Generator.effectiveSplit(a, plan)
    val splitDef = Catalog.SPLIT_DEFS.getValue(split)
    val feas = Generator.splitFeasibility(a)
    val auto = Generator.autoSplit(a)
    val assignment = Generator.assignSessions(split, a.list("Q2"))
    val dayToSession = assignment.associate { it.day to it.session }
    var openSwap by remember { mutableStateOf<String?>(null) }
    var demo by remember { mutableStateOf<Candidate?>(null) }
    var pickDate by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }

    a.str("Q27")?.takeIf { it.isNotEmpty() }?.let {
        Note("⚠️ ท่าที่คุณระบุเองว่าต้องหลีกเลี่ยง", "\"$it\" — ระบบยังกรองท่าให้อัตโนมัติจากข้อความนี้ไม่ได้ 100% กรุณาตรวจสอบตารางด้านล่างอีกครั้งก่อนเริ่ม", warn = true)
    }
    a.str("Q4c")?.takeIf { it != "ไม่เคย" }?.let {
        Note("ⓘ", "คุณระบุว่าเคย yo-yo มาก่อน — ระบบจะเน้นความสม่ำเสมอมากกว่าความเร็ว และแนะนำให้ดู % ทำตามแผนรายสัปดาห์แทนตัวเลขน้ำหนักรายวัน")
    }

    val h = a.parseFloat("Q11")
    val bmiNow = Generator.bmiOf(a.parseFloat("Q12"), h)
    val bmiTarget = t.goalWeight?.let { Generator.bmiOf(it, h) }
    TileGrid(
        listOfNotNull(
            Triple("BMI ปัจจุบัน", String.format(java.util.Locale.US, "%.1f", bmiNow), Generator.bmiLabel(bmiNow)),
            bmiTarget?.let { Triple("BMI เป้าหมาย", String.format(java.util.Locale.US, "%.1f", it), Generator.bmiLabel(it)) },
            Triple("TDEE โดยประมาณ", Fmt.kcal(t.tdee), "kcal/วัน"),
            Triple("เป้าแคลอรี่ต่อวัน", Fmt.kcal(t.kcal), t.kcalDirection + if (t.kcalFloored) " · ปรับขึ้นถึง floor ขั้นต่ำ" else ""),
        ),
    )
    Hint("โปรตีน ${t.proteinG ?: "—"} g · ไขมัน ${t.fatG ?: "—"} g · คาร์บ ${t.carbG ?: "—"} g · น้ำ ${t.waterL?.let { Fmt.one(it) } ?: "—"} ลิตร/วัน · ${t.meals} มื้อ/วัน · นอน ${Fmt.hours(t.sleepH)}/คืน" + if (t.sleepHygiene) " · มีข้อ sleep hygiene ในเช็คลิสต์" else "")
    if (t.macroClamped) Hint("⚠️ ปรับสัดส่วนอัตโนมัติเพราะโปรตีน+ไขมันตั้งต้นเกินเป้าแคลอรี่ที่คำนวณได้", color = GB.warn)

    SectionTitle("รูปแบบโปรแกรมและตารางรายสัปดาห์")
    Catalog.SPLIT_DEFS.forEach { (key, def) ->
        val f = feas.getValue(key)
        val active = key == split
        Column(
            Modifier.fillMaxWidth().clip(CardShape)
                .background(if (active) GB.accentSoft else GB.surface)
                .border(if (active) 2.dp else 1.dp, if (active) GB.accent else GB.border, CardShape)
                .clickable(enabled = f.eligible) { update { it.copy(plan = it.plan.copy(splitOverride = key, manualPick = emptyMap())) } }
                .padding(12.dp),
            verticalArrangement = Arrangement.spacedBy(3.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Text(def.label, fontWeight = FontWeight.SemiBold, color = if (f.eligible) GB.text else GB.text4)
                if (f.eligible && key == auto) Pill("แนะนำอัตโนมัติ", GB.ok, GB.okSoft)
                else if (f.eligible && !f.recommended) Pill("ไม่ค่อยแนะนำ", GB.warn, GB.warnSoft)
            }
            Hint(if (!f.eligible) "ต้องมีวันว่างอย่างน้อย ${def.minDays} วัน/สัปดาห์ (ตอนนี้เลือกไว้ ${a.list("Q2").size} วัน)" else def.desc)
        }
    }
    if (plan.splitOverride != null) {
        LinkButton("คุณเลือกรูปแบบนี้เอง — ให้ระบบแนะนำอัตโนมัติแทน") {
            update { it.copy(plan = it.plan.copy(splitOverride = null, manualPick = emptyMap())) }
        }
    } else Hint("ระบบแนะนำอัตโนมัติตามวันว่างและประสบการณ์ที่ตอบไว้ — แตะเลือกรูปแบบอื่นด้านบนได้ถ้าต้องการ")

    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
        Catalog.DAYS.forEachIndexed { i, d ->
            val active = d in a.list("Q2")
            Column(
                Modifier.clip(RoundedCornerShape(6.dp)).background(if (active) GB.surface2 else GB.bg)
                    .border(1.dp, GB.border, RoundedCornerShape(6.dp)).padding(8.dp),
            ) {
                Text(Catalog.DAYS_SHORT[i], color = GB.text3, fontSize = 11.sp)
                Text(if (active) dayToSession[d] ?: "" else "พัก", fontSize = 12.5.sp, color = if (active) GB.text else GB.text4)
            }
        }
    }
    Note("เหตุผล", reasoning(a, split, splitDef.label, plan.splitOverride != null, feas.getValue(split).recommended))
    if (plan.forceLowTier.isNotEmpty()) Note("ⓘ", "คุณเพิ่งแจ้งว่าหายจากอาการบาดเจ็บสำหรับบางท่า — ระบบเริ่มท่าในกลุ่มนั้นใหม่จาก Tier ต่ำสุดก่อนเสมอเพื่อความปลอดภัย")

    SectionTitle("รายละเอียดเซสชัน")
    Hint(Catalog.TIER_LABEL.entries.joinToString(" · ") { "Tier ${it.key} ${it.value}" })
    splitDef.sessions.forEach { se ->
        val daysFor = assignment.filter { it.session == se.key }.map { it.day }
        Card {
            Text("เซสชัน \"${se.key}\"", fontWeight = FontWeight.SemiBold)
            Hint("${daysFor.size}x/สัปดาห์ — ${daysFor.joinToString(", ").ifEmpty { "—" }} · ~${a.str("Q3") ?: "45-60 นาที"} รวมวอร์มอัพ")
            se.patterns.forEach { p ->
                ExerciseChoice(p, a, onb, openSwap == p, { openSwap = if (openSwap == p) null else p }, { demo = it }, update)
            }
        }
    }

    error?.let { Note("ยังเริ่มไม่ได้", it, warn = true) }
    Button(onClick = { pickDate = true }, Modifier.fillMaxWidth()) {
        Text(if (hasProgram) "บันทึกแผนใหม่ (ตั้งวันเริ่ม) →" else "เริ่มโปรแกรม →")
    }
    OutlinedButton(onClick = { update { it.copy(mode = null) } }, Modifier.fillMaxWidth()) { Text("← กลับไปหน้าสรุปคำตอบ") }

    demo?.let { d ->
        AlertDialog(
            onDismissRequest = { demo = null },
            title = { Text(d.exercise.th) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(6.dp)) {
                    Text(Catalog.PATTERN_LABEL[d.exercise.pattern] ?: d.exercise.pattern, color = GB.text3, fontSize = 12.sp)
                    if (d.exercise.sub.isNotEmpty()) Text(d.exercise.sub)
                    Text("Tier ${d.tier} — ${Catalog.TIER_LABEL[d.tier]}: ${Catalog.TIER_DESC[d.tier]}", fontSize = 12.5.sp, color = GB.text2)
                    Text("ℹ️ ปรึกษาเทรนเนอร์ก่อนทำจริง เพื่อฟอร์มที่ถูกต้องเป๊ะรายท่า", fontSize = 12.5.sp, color = GB.text2)
                }
            },
            confirmButton = { TextButton(onClick = { demo = null }) { Text("ปิด") } },
        )
    }

    if (pickDate) {
        val dp = rememberDatePickerState(initialSelectedDateMillis = LocalDate.now().atStartOfDay(ZoneOffset.UTC).toInstant().toEpochMilli())
        DatePickerDialog(
            onDismissRequest = { pickDate = false },
            confirmButton = {
                TextButton(onClick = {
                    pickDate = false
                    dp.selectedDateMillis?.let { ms ->
                        error = store.startProgram(Instant.ofEpochMilli(ms).atZone(ZoneOffset.UTC).toLocalDate().toString())
                    }
                }) { Text("เริ่มโปรแกรม") }
            },
            dismissButton = { TextButton(onClick = { pickDate = false }) { Text("ยกเลิก") } },
        ) {
            Column {
                DatePicker(dp)
                Hint(
                    "ระบบจะผูกเซสชันเข้ากับวันในสัปดาห์ตามวันที่คุณเลือกไว้ แล้วนับต่อเนื่องจากวันเริ่มนี้" +
                        if (hasProgram) " — บันทึกเก่ายังอยู่ครบ แต่แผนจะเปลี่ยนเป็นชุดใหม่นี้" else "",
                    Modifier.padding(12.dp),
                )
            }
        }
    }
}

private fun reasoning(a: Answers, split: String, label: String, isOverride: Boolean, recommended: Boolean): String {
    val lead = if (isOverride) "คุณเลือก $label เอง" else "ระบบแนะนำ $label ให้อัตโนมัติ"
    val warnRec = if (isOverride && !recommended) " — รูปแบบนี้ปกติแนะนำสำหรับคนที่มีประสบการณ์มากกว่านี้ ระบบยังสร้างตารางให้ตามที่คุณเลือกได้ แต่โปรดสังเกตความเหนื่อยล้า/ฟอร์มท่าให้ดีเป็นพิเศษในช่วงแรก" else ""
    val days = a.list("Q2")
    val daysStr = days.joinToString(", ")
    val body = when (split) {
        "fullbody" -> " เพราะวันที่เลือก ($daysStr) " +
            (if (Generator.weekdayAdjacencyWarning(days)) "มีวันที่ติดกัน — โปรดสังเกตว่ากล้ามเนื้อกลุ่มเดิมอาจได้พักไม่ถึง ~48 ชม. แนะนำให้เว้นอย่างน้อย 1 วันระหว่างเซสชันถ้าเป็นไปได้"
            else "ไม่ติดกัน ทำให้แต่ละกลุ่มกล้ามเนื้อได้พัก ≥48 ชม. ระหว่างเซสชันพอดี") +
            " และประสบการณ์ระดับ \"${a.str("Q16") ?: ""}\" เหมาะกับ Full Body ที่สุดในบรรดา 4 รูปแบบที่รองรับ"
        "ul" -> " เพราะมีวันว่าง ${days.size} วัน/สัปดาห์ ($daysStr) พอจะแยกวันบน-ล่างสลับกันได้"
        "ppl" -> " เพราะมีวันว่าง ${days.size} วัน/สัปดาห์ ($daysStr) พอจะหมุนวน Push → Pull → Legs ได้"
        else -> " เพราะมีวันว่าง ${days.size} วัน/สัปดาห์ ($daysStr) พอจะแยกฝึกกล้ามเนื้อทีละกลุ่มได้ครบ 5 วัน (ข้อควรรู้: แต่ละกลุ่มได้ฝึก ~1 ครั้ง/สัปดาห์ แลกกับโวลุ่มต่อครั้งที่สูงกว่า)"
    }
    return lead + body + warnRec
}

/** ท่าที่ระบบเลือกในแต่ละ pattern + สลับท่า / แจ้งว่าหายจากอาการบาดเจ็บ (ตรงกับ buildExRow ของเว็บ) */
@Composable
private fun ExerciseChoice(
    pattern: String,
    a: Answers,
    onb: Onboarding,
    open: Boolean,
    toggle: () -> Unit,
    showDemo: (Candidate) -> Unit,
    update: ((Onboarding) -> Onboarding) -> Unit,
) {
    val sel = Generator.selectionFor(pattern, a, onb.plan)
    val picked = sel.picked
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(GB.surface2).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        Text(Catalog.PATTERN_LABEL[pattern] ?: pattern, color = GB.text3, fontSize = 11.5.sp)
        if (picked == null) {
            Text("✕ ไม่มีท่าที่เหมาะสมเหลือให้เลือก (อุปกรณ์ไม่พอ หรือถูกล็อกทั้งหมด) — ต้องการอุปกรณ์เพิ่มเติม/ปรึกษาเทรนเนอร์", color = GB.warn, fontSize = 13.sp)
            return@Column
        }
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(picked.exercise.th, fontWeight = FontWeight.Medium, modifier = Modifier.weight(1f).clickable { showDemo(picked) })
            Pill("Tier ${picked.tier}")
        }
        if (picked.exercise.sub.isNotEmpty()) Text(picked.exercise.sub, color = GB.text3, fontSize = 12.sp)
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(if (pattern == "core") "3 x 30-45 วิ" else Generator.repSchemeFor(a.str("Q1")), color = GB.accent, fontSize = 12.5.sp, modifier = Modifier.weight(1f))
            LinkButton(if (open) "ซ่อน ▴" else "สลับท่า ▾", toggle)
        }
        if (open) sel.all.filter { it.id != picked.id }.forEach { x ->
            val pickedThis = onb.plan.manualPick[pattern] == x.id
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(6.dp)).background(if (pickedThis) GB.accentSoft else GB.bg).padding(8.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Column(Modifier.weight(1f)) {
                    Text("${x.exercise.th} · Tier ${x.tier}", fontSize = 13.sp, color = if (x.locked || !x.equipOk) GB.text3 else GB.text,
                        modifier = Modifier.clickable { showDemo(x) })
                    when {
                        x.locked -> Text("ล็อกอยู่ — เนื่องจากอาการที่ ${x.lockedBy.joinToString(", ")} ที่คุณแจ้งไว้", fontSize = 11.5.sp, color = GB.warn)
                        !x.equipOk -> Text("ต้องใช้อุปกรณ์ที่คุณไม่มีตามที่แจ้งไว้", fontSize = 11.5.sp, color = GB.text3)
                    }
                }
                when {
                    x.locked -> TextButton(onClick = {
                        update {
                            it.copy(plan = it.plan.copy(
                                unlockedEx = it.plan.unlockedEx + (x.id to true),
                                forceLowTier = it.plan.forceLowTier + (pattern to true),
                                manualPick = it.plan.manualPick - pattern,
                            ))
                        }
                    }) { Text("แจ้งว่าหายแล้ว", fontSize = 12.sp) }
                    x.equipOk -> TextButton(onClick = {
                        update { it.copy(plan = it.plan.copy(manualPick = it.plan.manualPick + (pattern to x.id))) }
                    }) { Text("เลือกท่านี้แทน", fontSize = 12.sp) }
                }
            }
        }
    }
}

