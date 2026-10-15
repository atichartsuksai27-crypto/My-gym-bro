package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalFocusManager
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.DayActions
import com.gymbrodaily.nativeapp.domain.DayExtras
import com.gymbrodaily.nativeapp.domain.ExerciseLog
import com.gymbrodaily.nativeapp.domain.LibraryCatalog
import com.gymbrodaily.nativeapp.domain.LoadPlan
import com.gymbrodaily.nativeapp.domain.PlanExercise
import com.gymbrodaily.nativeapp.domain.Prep
import com.gymbrodaily.nativeapp.domain.ProgressGoal
import com.gymbrodaily.nativeapp.domain.Progression
import com.gymbrodaily.nativeapp.domain.SetEntry
import com.gymbrodaily.nativeapp.domain.StressLog
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import com.gymbrodaily.nativeapp.domain.WuStep
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.jsRound
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlin.math.max

/* ============================================================
   ส่วนออกกำลังกาย / Cardio / ความเครียด ของบันทึกรายวัน — ตรงกับ sectionWorkout / sectionCardio / sectionStress ของเว็บ
   (progressive overload อัตโนมัติ, warm-up set, ความเข้มข้น + เวลาพัก, ความรู้สึกหลังเล่น, อาการหลังเล่น,
   วอร์มร่างกาย/คลายกล้ามเนื้อ) ตรรกะอยู่ใน domain/Progression.kt, DayExtras.kt, DayActions.kt (มี golden/เทสต์ครอบ)
   ============================================================ */

@Composable
internal fun WorkoutSection(t: TrackData, iso: String, store: TrackStore) {
    val p = t.program
    val sKey = Tracking.sessionKeyFor(p, iso)
    Card {
        if (sKey == null) {
            SectionHead("วันพัก", GB.text4, "ไม่มีเซสชันตามตาราง")
            Hint("วันนี้ไม่ได้อยู่ในวันที่คุณเลือกไว้ (${p.days.joinToString(" · ")}) — โฟกัสที่โภชนาการ การนอน และการฟื้นตัวแทน เดินเบาๆ หรือยืดกล้ามเนื้อได้ตามสบาย")
            return@Card
        }
        val sess = Tracking.sessionDefFor(p, sKey)
        val exercises = sess?.exercises ?: emptyList()
        val log = t.logs[iso]
        val exData = log?.exercises ?: emptyMap()
        val doneN = exercises.count { exData[it.id]?.done == true }
        SectionHead(
            "ออกกำลังกาย", GB.accent,
            "$sKey · ~${p.minutesEstimate ?: "45-60 นาที"} · ${p.trainTime ?: ""}",
            "$doneN/${exercises.size}",
        )
        DayExtras.seriousSymptoms(log).forEach { s ->
            val info = DayExtras.info(s.level)
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.warnSoft).padding(12.dp),
                verticalArrangement = Arrangement.spacedBy(2.dp),
            ) {
                Text("${info.icon} ${s.name.orEmpty()}: ${s.text}", fontWeight = FontWeight.Bold, color = GB.warn, fontSize = 13.5.sp)
                Text("${info.label} · ${info.advice}", fontSize = 12.5.sp, lineHeight = 18.sp, color = GB.text2)
            }
        }
        val wuSteps = Progression.warmupStepsFor(sess)
        PrepRow(
            iso, store, log?.prep?.warm == true, "วอร์มร่างกายก่อนเริ่ม (5-10 นาที)",
            "เดินเร็ว/ปั่นจักรยาน/กระโดดตบเบา ๆ 3-5 นาทีให้ตัวอุ่น แล้วขยับข้อต่อแบบเคลื่อนไหว — ทำก่อน warm-up set ช่วยให้กล้ามเนื้อพร้อมใช้งานและลดการบาดเจ็บ",
            DayExtras.warmTips(sess),
        ) { cur, c -> (cur ?: Prep()).copy(warm = c) }
        exercises.forEachIndexed { idx, ex ->
            key(iso, ex.id) { ExerciseCard(t, iso, ex, idx, exercises.size, exData[ex.id], wuSteps[ex.id] ?: emptyList(), store) }
        }
        PrepRow(
            iso, store, log?.prep?.cool == true, "คลายกล้ามเนื้อหลังฝึก (5-10 นาที)",
            "เดินช้า ๆ 2-3 นาทีให้หัวใจเต้นช้าลง แล้วยืดค้างท่าละ 20-30 วินาที ไม่กระตุก ช่วยลดความตึงและช่วยการฟื้นตัว",
            DayExtras.coolTips(sess),
        ) { cur, c -> (cur ?: Prep()).copy(cool = c) }
        Row(
            Modifier.fillMaxWidth().clickable {
                store.updateLog(iso) { DayActions.completeSession(t, iso, sess, it, !it.completed) }
            },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = log?.completed == true,
                onCheckedChange = { c -> store.updateLog(iso) { DayActions.completeSession(t, iso, sess, it, c) } },
                colors = CheckboxDefaults.colors(checkedColor = GB.ok, checkmarkColor = GB.accentInk),
            )
            Text("ทำเซสชันนี้ครบแล้ว (ข้อนี้คือตัวที่นับสตรีคและ % ทำตามแผน)", fontSize = 13.5.sp, color = GB.text2)
        }
    }
}

@Composable
private fun PrepRow(
    iso: String, store: TrackStore, on: Boolean, title: String, sub: String, tips: List<String>,
    change: (Prep?, Boolean) -> Prep,
) {
    CheckRow(on, { c -> store.updateLog(iso) { it.copy(prep = change(it.prep, c)) } }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Text(title, fontWeight = FontWeight.Medium, fontSize = 15.sp, modifier = Modifier.weight(1f, fill = false))
            Pill("ไม่นับในเช็คลิสต์")
        }
        Hint(sub)
        tips.forEach { Hint("• $it") }
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExerciseCard(
    t: TrackData, iso: String, ex: PlanExercise, idx: Int, total: Int, e: ExerciseLog?, wu: List<WuStep>, store: TrackStore,
) {
    var open by rememberSaveable { mutableStateOf(false) }
    var symOpen by rememberSaveable { mutableStateOf(false) }
    val cur = e ?: ExerciseLog()
    val isBW = ex.equip == "bodyweight" && !ex.timeBased
    val intense = Progression.isIntense(ex)
    val rest = Progression.restFor(ex)
    val prev = Tracking.lastBestBefore(t, ex.id, iso)
    val plan = Progression.progressionPlan(t, ex, iso)
    val logged = Progression.hasSets(cur)
    val usePlan = plan != null && !logged
    val prevTxt = when {
        prev == null && plan != null -> "ครั้งก่อน ${Fmt.shortDate(plan.prevDate!!)} · ${Progression.setsText(plan.base, plan.kind)}"
        prev != null -> buildString {
            append("ครั้งก่อน ")
            if (prev.date != iso) append(Fmt.shortDate(prev.date)).append(" · ")
            if (isBW) append(prev.reps?.let { Progression.n(it) + " ครั้ง" } ?: "—")
            else {
                append(Progression.n(prev.weight)).append(if (ex.timeBased) " วิ" else " กก.")
                if (prev.reps != null && !ex.timeBased) append(" × ").append(Progression.n(prev.reps)).append(" ครั้ง")
            }
        }
        else -> "ยังไม่เคยบันทึกท่านี้"
    }
    fun patch(change: (ExerciseLog) -> ExerciseLog) = store.updateLog(iso) { log ->
        log.copy(exercises = log.exercises + (ex.id to change(log.exercises[ex.id] ?: ExerciseLog())))
    }

    CheckRow(cur.done, { c -> patch { DayActions.setDone(t, iso, ex, it, c) } }) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            RowTitle(ex.th)
            if (intense) Pill("เข้มข้น", GB.warn, GB.warnSoft)
        }
        Hint("${ex.setsReps}${if (intense) " (จนหมดแรง)" else ""} · ${LibraryCatalog.GROUP_SHORT[ex.pattern] ?: ex.pattern} · $prevTxt")
        Hint("พักระหว่างเซ็ต ${rest.set}" + if (idx < total - 1) " · พักก่อนเปลี่ยนท่า ${rest.next}" else "")
        if (intense) Text(Progression.intenseNote(ex, prev), fontSize = 12.5.sp, lineHeight = 18.sp, color = GB.warn)
        WarmupSets(ex, cur, wu, prev, if (usePlan && plan!!.kind == "weight") Progression.topWeight(plan.sets) else 0.0) { i, c ->
            patch { DayActions.setWarmup(it, i, c) }
        }
        LoadLine(ex, cur, plan, open, { open = !open }, isBW,
            onRevert = { plan?.let { pl -> patch { DayActions.revert(pl, it) } } },
            onReapply = { plan?.let { pl -> patch { DayActions.reapply(pl, it) } } })
        if (open) {
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.bg).padding(10.dp),
                verticalArrangement = Arrangement.spacedBy(8.dp),
            ) {
                if (usePlan) Hint("ค่าที่ใส่ไว้มาจากครั้งก่อน/ที่ระบบปรับให้ — แก้เฉพาะช่องที่ต่าง ระบบบันทึกทุกเซ็ตให้")
                val n = Generator.setCountFor(ex.setsReps)
                val shown: List<SetEntry?> = if (usePlan) plan!!.sets else cur.sets
                for (i in 0 until n) {
                    val sv = shown.getOrNull(i) ?: SetEntry()
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        Text("เซ็ต ${i + 1}", color = GB.text3, fontSize = 13.sp, modifier = Modifier.width(44.dp))
                        /* ตรงกับ setsFromDom ของเว็บ: เขียนทุกเซ็ตที่แสดงอยู่ (n แถว) ใหม่ทั้งชุด */
                        fun write(entry: SetEntry) {
                            val list = (0 until n).map { j -> if (j == i) entry else (shown.getOrNull(j) ?: SetEntry()) }
                            patch { DayActions.writeSets(t, iso, ex, it, list) }
                        }
                        if (!isBW) NumberField(sv.weight, { _, v -> write(sv.copy(weight = v)) }, if (ex.timeBased) "วินาที" else "น.น.(กก.)", Modifier.weight(1f))
                        if (!ex.timeBased) NumberField(sv.reps, { _, v -> write(sv.copy(reps = v)) }, "ครั้ง", Modifier.weight(1f), integer = true)
                    }
                }
                if (!isBW && !ex.timeBased && ex.equip in Progression.WARMUP_WEIGHTED) {
                    val w = (if (usePlan) Progression.topWeight(plan!!.base) else Progression.topWeight(Progression.cleanSets(cur.sets))).takeIf { it != 0.0 }
                        ?: prev?.weight?.takeIf { it != 0.0 } ?: 0.0
                    StepPicker(t, ex, w, store)
                }
            }
        }
        FeelRow(t, ex, cur, plan) { k -> patch { DayActions.toggleFeel(t, iso, ex, it, k) } }
        SymptomBlock(ex, cur, symOpen, { symOpen = !symOpen }) { text -> patch { DayActions.saveSymptom(it, text, ex.th) } }
        if (!isBW && !ex.timeBased) PerfBlock(t, iso, ex, e)
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun WarmupSets(ex: PlanExercise, e: ExerciseLog, steps: List<WuStep>, prev: com.gymbrodaily.nativeapp.domain.HistoryEntry?, planTop: Double, onToggle: (Int, Boolean) -> Unit) {
    if (steps.isEmpty()) return
    val ref = Progression.warmupRef(ex, e, steps, prev, planTop)
    Text("Warm-up (ไม่บังคับ):", fontSize = 12.5.sp, color = GB.text3)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(2.dp)) {
        steps.forEachIndexed { i, st ->
            val on = e.warmup.getOrNull(i) == true
            Row(
                Modifier.clip(RoundedCornerShape(50)).clickable { onToggle(i, !on) }.padding(end = 10.dp),
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(
                    checked = on, onCheckedChange = { onToggle(i, it) },
                    colors = CheckboxDefaults.colors(checkedColor = GB.ok, checkmarkColor = GB.accentInk),
                )
                Text("W${i + 1} · ${Progression.warmupLabel(st, ref.refKg, ex.equip)}", fontSize = 13.sp, color = if (on) GB.ok else GB.text2)
            }
        }
    }
    if (ref.basis.isNotEmpty()) Hint(ref.basis)
}

@Composable
private fun LoadLine(
    ex: PlanExercise, e: ExerciseLog, plan: LoadPlan?, open: Boolean, onToggle: () -> Unit, isBW: Boolean,
    onRevert: () -> Unit, onReapply: () -> Unit,
) {
    val logged = Progression.hasSets(e)
    val kind = if (logged) Progression.exKind(ex, Progression.cleanSets(e.sets)) else plan?.kind
    val editLabel = if (open) "ซ่อนช่องแก้ไข ▴"
    else if (logged || plan != null) "แก้ไขน้ำหนัก/ครั้ง ▾"
    else if (isBW) "บันทึกจำนวนครั้งต่อเซ็ต ▾" else "บันทึกน้ำหนัก/ครั้งต่อเซ็ต ▾"
    if (!logged && plan == null) {
        Hint("ครั้งแรก — กรอกค่าที่ใช้จริงแล้วเลือกความรู้สึกด้านล่าง ครั้งหน้าระบบจะตั้งค่าให้เอง")
        LinkButton(editLabel, onToggle)
        return
    }
    val prog = e.prog
    val up = Progression.isUpChange(plan)
    var badge: String? = null
    var btn: Pair<String, () -> Unit>? = null
    val txt: String
    if (logged) {
        txt = "บันทึกแล้ว: ${Progression.setsText(e.sets, kind)}"
        if (prog != null && prog.reverted && plan != null) btn = "ใช้ค่าที่ระบบเพิ่มให้ (${Progression.setsText(plan.sets, plan.kind)})" to onReapply
        else if (prog != null && plan != null && up) btn = "ไม่ไหว — กลับไปค่าเดิม (${Progression.setsText(plan.base, plan.kind)})" to onRevert
        badge = if (prog != null && prog.reverted) "กลับไปค่าเดิมแล้ว" else if (prog != null && plan != null && up) "↑ เพิ่มจากครั้งก่อน" else null
    } else {
        plan!!
        txt = "วันนี้: ${Progression.setsText(plan.sets, plan.kind)}"
        val c = plan.change
        badge = if (up) "↑ " + (if (c!!.kind == "weight") "+${Progression.n(c.inc!!)} กก." else if (c.kind == "time") "+5 วิ" else "+1 ครั้ง")
        else if (c != null && c.kind == "back") "↓ กลับ ${Progression.n(c.to!!)} กก." else "= เท่าครั้งก่อน"
        if (up) btn = "ไม่ไหว — ใช้ค่าเดิม (${Progression.setsText(plan.base, plan.kind)})" to onRevert
    }
    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(txt, fontWeight = FontWeight.Medium, fontSize = 14.sp, modifier = Modifier.weight(1f, fill = false))
        badge?.let { Pill(it, if (it.startsWith("↑")) GB.ok else GB.text2) }
    }
    if (plan != null && !logged) {
        Hint("ตั้งให้จากครั้งก่อน (${Fmt.shortDate(plan.prevDate!!)})" + (if (plan.note.isNotEmpty()) " · ${plan.note}" else "") + " — ติ๊กว่าทำแล้วระบบบันทึกค่านี้ให้")
    }
    LinkButton(editLabel, onToggle)
    btn?.let { (label, act) -> OutlinedButton(onClick = act) { Text(label, fontSize = 13.sp) } }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun StepPicker(t: TrackData, ex: PlanExercise, w: Double, store: TrackStore) {
    val opts = Progression.EQUIP_STEP_OPTS[ex.equip] ?: listOf(1.0, 2.5, 5.0)
    val cur = t.program.equipSteps[ex.id]
    fun set(v: Double?) = store.patchProgram { raw ->
        val steps = (raw["equipSteps"] as? JsonObject) ?: JsonObject(emptyMap())
        val next = if (v != null && v > 0) steps + (ex.id to JsonPrimitive(v)) else steps - ex.id
        JsonObject(raw + ("equipSteps" to JsonObject(next)))
    }
    val step = Progression.equipStep(t.program, ex, w)
    val tier = if (w > 0) Progression.loadTier(step, w) else null
    Text(
        "อุปกรณ์ของคุณเพิ่มน้ำหนักได้ทีละ" + (if (ex.equip == "barbell") " (รวมสองข้าง)" else if (ex.equip == "dumbbell") " (ต่อข้าง)" else "") + ":",
        fontSize = 12.5.sp, color = GB.text3,
    )
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        GbChip(cur == null, { set(null) }, { Text("อัตโนมัติ (${Progression.n(Progression.defaultStep(ex.equip, w))} กก.)") })
        opts.forEach { v -> GbChip(cur == v, { set(v) }, { Text("${Progression.n(v)} กก.") }) }
    }
    if (tier != null) {
        val info = Progression.LOAD_TIER.getValue(tier)
        Hint("ตอนนี้ท่านี้อยู่ระดับ ${info.label} — ขั้นละ ${Progression.n(step)} กก. = ${jsRound(step / w * 100).toLong()}% ของ ${Progression.n(w)} กก. → ${info.how}")
    }
    if (ex.equip == "barbell") Hint("เช่น มีแผ่น 1.25 กก. ใส่ข้างละแผ่น = 2.5 กก. · มีแผ่นเล็ก 0.5 กก. = 1 กก. · มีแค่แผ่น 2.5 กก. = 5 กก.")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FeelRow(t: TrackData, ex: PlanExercise, e: ExerciseLog, plan: LoadPlan?, onFeel: (String) -> Unit) {
    val cur = e.feel
    Text("แรงเหลือหลังเล่น:", fontSize = 12.5.sp, color = GB.text3)
    FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
        Progression.FEEL_OPTS.forEach { o -> GbChip(cur == o.k, { onFeel(o.k) }, { Text("${o.icon} ${o.label}") }) }
    }
    val base: List<SetEntry>? = if (Progression.hasSets(e)) Progression.cleanSets(e.sets) else plan?.sets
    if (cur != null && !base.isNullOrEmpty()) {
        val nx = Progression.planFrom(t.program, ex, base, cur, if (Progression.hasSets(e)) e.prog else Progression.progRecord(plan), e.symptom)
        Text(
            "ครั้งหน้า: ${Progression.setsText(nx.sets, nx.kind)}" + (if (nx.note.isNotEmpty()) " — ${nx.note}" else ""),
            fontSize = 13.sp, lineHeight = 18.sp, color = GB.text2,
        )
    } else if (cur == null) {
        Hint("เล่นเสร็จแล้วเลือกว่ายังมีแรงเหลือไหม — ระบบใช้ปรับน้ำหนักครั้งหน้าให้อย่างปลอดภัย")
    }
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun SymptomBlock(ex: PlanExercise, e: ExerciseLog, open: Boolean, onToggle: () -> Unit, onSave: (String) -> Unit) {
    val s = e.symptom
    val info = s?.let { DayExtras.info(it.level) }
    if (s != null && info != null) {
        Text(
            "${info.icon} อาการหลังเล่น: ${s.text} — ${info.label}",
            fontSize = 13.sp, lineHeight = 18.sp,
            color = when (info.cls) { "danger" -> GB.warn; "warn" -> GB.branch; "ok" -> GB.ok; else -> GB.text2 },
        )
    }
    LinkButton(if (open) "ซ่อนช่องอาการ ▴" else if (s != null) "แก้ไขอาการหลังเล่น ▾" else "บันทึกอาการหลังเล่น ▾", onToggle)
    if (!open) return
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.bg).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        CommitTextField(s?.text.orEmpty(), "เช่น ปวดเข่าด้านในตอนย่อ, ไหล่มีเสียงดังกึก", 200, onSave)
        FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            DayExtras.SYMPTOM_CHIPS.forEach { c ->
                GbChip(false, { onSave(if (s?.text.isNullOrEmpty()) c else "${s!!.text}, $c") }, { Text(c) })
            }
            if (s != null) GbChip(false, { onSave("") }, { Text("ล้าง") })
        }
        info?.let { Hint(it.advice, color = GB.text2) }
        Hint("ระบบคัดกรองจากคำที่พิมพ์เท่านั้น ไม่ใช่การวินิจฉัยทางการแพทย์")
    }
}

/** ช่องข้อความที่บันทึกตอนออกจากช่อง/กด Done (เหมือน event change ของเว็บ) */
@Composable
internal fun CommitTextField(value: String, placeholder: String, maxLen: Int, onCommit: (String) -> Unit) {
    var text by remember { mutableStateOf(value) }
    var focused by remember { mutableStateOf(false) }
    val focusManager = LocalFocusManager.current
    LaunchedEffect(value) { if (!focused) text = value }
    OutlinedTextField(
        value = text,
        onValueChange = { text = it.take(maxLen) },
        modifier = Modifier.fillMaxWidth().onFocusChanged {
            if (focused && !it.isFocused) onCommit(text)
            focused = it.isFocused
        },
        placeholder = { Text(placeholder, fontSize = 13.sp, color = GB.text4) },
        singleLine = true,
        keyboardOptions = androidx.compose.foundation.text.KeyboardOptions(imeAction = androidx.compose.ui.text.input.ImeAction.Done),
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = { onCommit(text); focusManager.clearFocus() }),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = GB.borderStrong, focusedContainerColor = GB.surface2, unfocusedContainerColor = GB.surface2,
        ),
        shape = RoundedCornerShape(16.dp),
    )
}

/* ---------- Cardio ---------- */

@Composable
internal fun CardioSection(t: TrackData, iso: String, store: TrackStore) {
    val p = t.program
    val planned = ProgressGoal.cardioPlannedFor(p, iso)
    val mins = ProgressGoal.cardioMinutesOn(t, iso)
    val target = ProgressGoal.cardioMinFor(p, Tracking.thaiWeekday(iso))
    var rejected by remember { mutableStateOf(false) }
    Card {
        SectionHead(
            "Cardio", GB.branch,
            if (planned) "ตามแผน ~${Progression.n(target)} นาที" else "ไม่ได้อยู่ในแผนวันนี้ — ถ้าทำก็บันทึกได้",
            if (planned) "${if (mins != null) 1 else 0}/1" else null,
        )
        CheckRow(mins != null, null) {
            RowTitle("เวลาที่ทำ cardio วันนี้")
            Hint("กรอกจำนวนนาทีที่ทำจริง (เดินเร็ว วิ่ง ปั่นจักรยาน ฯลฯ)")
            if (rejected) Hint("ค่าที่กรอกต้องอยู่ระหว่าง 0-600 นาที ระบบไม่ได้บันทึกค่านี้", color = GB.warn)
            Row(verticalAlignment = Alignment.CenterVertically) {
                NumberField(
                    mins,
                    { text, v ->
                        // ช่องว่าง = ล้าง · นอก 0-600 ปฏิเสธไม่บันทึก (numInRange ของเว็บ)
                        val valid = text.isBlank() || (v != null && v.isFinite() && v in 0.0..600.0)
                        rejected = !valid
                        if (valid) store.updateLog(iso) { it.copy(cardio = com.gymbrodaily.nativeapp.domain.CardioLog(if (text.isBlank()) null else jsRound(v!!))) }
                    },
                    "นาที", Modifier.weight(1f), integer = true, isError = rejected, commitOnBlur = true,
                )
                Text("  " + if (planned) "/ ${Progression.n(target)} นาที" else "นาที", color = GB.text3, fontSize = 13.sp)
            }
        }
    }
}

/* ---------- ความเครียด / อารมณ์ ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
internal fun StressSection(t: TrackData, iso: String, store: TrackStore) {
    val s = t.logs[iso]?.stress
    val lvl = s?.level?.toInt()?.takeIf { it in 1..5 }
    fun patch(change: (StressLog?) -> StressLog) = store.updateLog(iso) { it.copy(stress = change(it.stress)) }
    Card {
        SectionHead("ความเครียด / อารมณ์", GB.pink, "บันทึกเป็นข้อมูล ไม่นับในเช็คลิสต์", lvl?.let { "$it/5" })
        CheckRow(false, null) {
            RowTitle("ระดับความเครียดวันนี้")
            Hint("ความเครียดสะสมมีผลต่อการนอน การฟื้นตัว ความอยากอาหาร และน้ำหนักตัว — ระบบใช้ประกอบการเฝ้าระวังในหน้าความคืบหน้า (กดระดับเดิมซ้ำเพื่อล้าง)")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DayExtras.STRESS_LEVELS.forEach { x ->
                    GbChip(lvl == x.v, { patch { DayActions.setStressLevel(it, x.v) } }, { Text("${x.icon} ${x.v} · ${x.label}") })
                }
            }
            CommitTextField(s?.note.orEmpty(), "สาเหตุของความเครียด เช่น งานเร่ง ประชุมทั้งวัน เรื่องที่บ้าน", 200) { txt -> patch { DayActions.setStressNote(it, txt) } }
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                DayExtras.STRESS_CHIPS.forEach { c -> GbChip(false, { patch { DayActions.stressNoteWithChip(it, c) } }, { Text(c) }) }
                if (!s?.note.isNullOrEmpty()) GbChip(false, { patch { DayActions.setStressNote(it, "") } }, { Text("ล้างสาเหตุ") })
            }
            DayExtras.stressTip(lvl)?.let { Hint(it, color = GB.text2) }
        }
    }
}
