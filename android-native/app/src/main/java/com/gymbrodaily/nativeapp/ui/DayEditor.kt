package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Checkbox
import androidx.compose.material3.CheckboxDefaults
import androidx.compose.material3.FilterChip
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.key
import androidx.compose.runtime.mutableStateMapOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.Benchmarks
import com.gymbrodaily.nativeapp.domain.Catalog
import com.gymbrodaily.nativeapp.domain.E1rmEntry
import com.gymbrodaily.nativeapp.domain.ExerciseLog
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.LoggedSet
import com.gymbrodaily.nativeapp.domain.PlanExercise
import com.gymbrodaily.nativeapp.domain.SetEntry
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import kotlin.math.abs
import kotlin.math.max

/* ============================================================
   แก้บันทึกของวันหนึ่ง (ออกกำลังกาย / โภชนาการ / การนอน / น้ำหนัก) — ใช้ทั้งหน้า "วันนี้"
   และแผ่นบันทึกย้อนหลังในหน้าตารางฝึก (เหมือน dayEditor ของเว็บ)
   ============================================================ */

@Composable
fun DayEditor(t: TrackData, iso: String, store: TrackStore) {
    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        WorkoutSection(t, iso, store)
        FoodSection(t, iso, store)
        SleepSection(t, iso, store)
        BodySection(t, iso, store)
    }
}

@Composable
private fun CheckRow(
    on: Boolean,
    onToggle: ((Boolean) -> Unit)?,
    content: @Composable () -> Unit,
) {
    Row(
        Modifier
            .fillMaxWidth()
            .clip(RoundedCornerShape(8.dp))
            .background(if (on) GB.okSoft else GB.surface2)
            .padding(horizontal = 6.dp, vertical = 8.dp),
        verticalAlignment = Alignment.Top,
    ) {
        if (onToggle != null) {
            Checkbox(
                checked = on, onCheckedChange = onToggle,
                colors = CheckboxDefaults.colors(checkedColor = GB.ok, checkmarkColor = GB.accentInk),
            )
        } else {
            Text(if (on) "✓" else "○", color = if (on) GB.ok else GB.text4, modifier = Modifier.padding(12.dp))
        }
        Column(Modifier.weight(1f).padding(top = 6.dp, end = 6.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
            content()
        }
    }
}

@Composable
private fun RowTitle(text: String) = Text(text, fontWeight = FontWeight.Medium, fontSize = 15.sp)

/* ---------- ออกกำลังกาย ---------- */

@Composable
private fun WorkoutSection(t: TrackData, iso: String, store: TrackStore) {
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
        exercises.forEach { ex -> key(iso, ex.id) { ExerciseRow(t, iso, ex, exData[ex.id], store) } }
        Row(
            Modifier.fillMaxWidth().clickable { store.updateLog(iso) { it.copy(completed = !it.completed) } },
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Checkbox(
                checked = log?.completed == true,
                onCheckedChange = { c -> store.updateLog(iso) { it.copy(completed = c) } },
                colors = CheckboxDefaults.colors(checkedColor = GB.ok, checkmarkColor = GB.accentInk),
            )
            Text("ทำเซสชันนี้ครบแล้ว (ข้อนี้คือตัวที่นับสตรีคและ % ทำตามแผน)", fontSize = 13.5.sp, color = GB.text2)
        }
    }
}

@Composable
private fun ExerciseRow(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?, store: TrackStore) {
    var open by rememberSaveable { mutableStateOf(false) }
    val isBW = ex.equip == "bodyweight" && !ex.timeBased
    val prev = Tracking.lastBestBefore(t, ex.id, iso)
    val prevTxt = if (prev == null) "ยังไม่เคยบันทึกท่านี้" else buildString {
        append("ครั้งก่อน ")
        append(Fmt.shortDate(prev.date)).append(" · ")
        if (isBW) append(prev.reps?.let { Fmt.num(it) + " ครั้ง" } ?: "—")
        else {
            append(Fmt.num(prev.weight)).append(if (ex.timeBased) " วิ" else " กก.")
            if (prev.reps != null && !ex.timeBased) append(" × ").append(Fmt.num(prev.reps)).append(" ครั้ง")
        }
    }
    val done = e?.done == true
    fun patch(change: (ExerciseLog) -> ExerciseLog) = store.updateLog(iso) { log ->
        val cur = log.exercises[ex.id] ?: ExerciseLog()
        log.copy(exercises = log.exercises + (ex.id to change(cur)))
    }
    CheckRow(done, { c -> patch { it.copy(done = c) } }) {
        RowTitle(ex.th)
        Hint("${ex.setsReps} · ${Catalog.PATTERN_SHORT[ex.pattern] ?: ex.pattern} · $prevTxt")
        LinkButton(
            if (open) "ซ่อนช่องบันทึกเซ็ต ▴" else if (isBW) "บันทึกจำนวนครั้งต่อเซ็ต ▾" else "บันทึกน้ำหนัก/ครั้งต่อเซ็ต ▾",
        ) { open = !open }
        if (open) {
            val n = Generator.setCountFor(ex.setsReps)
            val sets = e?.sets ?: emptyList()
            for (i in 0 until n) {
                val sv = sets.getOrNull(i) ?: SetEntry()
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Text("เซ็ต ${i + 1}", color = GB.text3, fontSize = 13.sp, modifier = Modifier.width(44.dp))
                    /* ตรงกับ setsFromDom ของเว็บ: เขียนทุกเซ็ตที่แสดงอยู่ (n แถว) ใหม่ทั้งชุด */
                    fun write(entry: SetEntry) = patch { cur ->
                        val list = (0 until max(n, cur.sets.size)).map { j -> cur.sets.getOrNull(j) ?: SetEntry() }.toMutableList()
                        list[i] = entry
                        cur.copy(sets = list.take(n))
                    }
                    if (!isBW) NumberField(
                        sv.weight, { _, v -> write(sv.copy(weight = v)) },
                        if (ex.timeBased) "วินาที" else "น.น.(กก.)", Modifier.weight(1f),
                    )
                    if (!ex.timeBased) NumberField(
                        sv.reps, { _, v -> write(sv.copy(reps = v)) }, "ครั้ง", Modifier.weight(1f), integer = true,
                    )
                }
            }
        }
        if (!isBW && !ex.timeBased) PerfBlock(t, iso, ex, e)
    }
}

/** Estimated 1RM + ระดับเทียบ Benchmark + Personal Progress (ตรงกับ perfBlockFor ของเว็บ) */
@Composable
private fun PerfBlock(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?) {
    val pick = Benchmarks.pickAssessmentSet((e?.sets ?: emptyList()).map { it?.let { s -> LoggedSet(s.weight, s.reps) } })
        ?: return
    var open by rememberSaveable { mutableStateOf(false) }
    val a = t.answers
    val bw = Tracking.bodyweightAsOf(t, iso)
    val rel = Benchmarks.calculateRelativeStrength(pick.e1rm, bw)
    val benchKey = Benchmarks.resolveBenchmarkKey(ex.id)
    val benchmark = benchKey?.let { Benchmarks.getStrengthBenchmark(it, a.str("Q9"), bw, a.str("Q16")) }
    val perf = Benchmarks.getPerformanceLevel(pick.e1rm, benchmark)
    val histAll = Tracking.exerciseHistory(t, ex.id).filter { it.date <= iso }
    val histBefore = histAll.filter { it.date < iso }
    val pb = histAll.maxByOrNull { it.e1rm }
    val progress = if (histBefore.isNotEmpty())
        Benchmarks.calculatePersonalProgress(pick.e1rm, histBefore.map { E1rmEntry(it.date, it.e1rm) }) else null

    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(8.dp)).background(GB.bg).padding(10.dp),
        verticalArrangement = Arrangement.spacedBy(3.dp),
    ) {
        Text("${Fmt.num(pick.weight)} กก. × ${Fmt.num(pick.reps)} ครั้ง", fontSize = 13.sp, color = GB.text2)
        Text("Estimated 1RM: ${Fmt.one(pick.e1rm)} กก.", fontSize = 14.sp, fontWeight = FontWeight.Medium)
        Pill("${perf.level.icon} ${perf.level.label}")
        progress?.let {
            Text("Personal Progress: ${arrow(it.direction)}${Fmt.one(abs(it.deltaPct))}% เทียบครั้งก่อน", fontSize = 13.sp)
        }
        if (pick.lowConfidence) Hint("⚠️ เซ็ตนี้ทำมากกว่า 12 ครั้ง — Estimated 1RM อาจคลาดเคลื่อนกว่าปกติ")
        LinkButton(if (open) "ซ่อนรายละเอียด ▴" else "ดูรายละเอียด ▾") { open = !open }
        if (open) {
            DetailRow("Benchmark ของคุณ", benchmark?.let { "${Fmt.one(it.benchmarkValueKg)} กก. · ${it.sourceName}" } ?: "ยังไม่มี Benchmark สำหรับข้อมูลนี้")
            DetailRow(
                "Relative Strength",
                rel?.let { Fmt.num(com.gymbrodaily.nativeapp.domain.jsRound(it * 100) / 100) + "× น้ำหนักตัว" + (bw?.let { w -> " (${Fmt.one(w)} กก.)" } ?: "") }
                    ?: "ยังไม่มีข้อมูลน้ำหนักตัว",
            )
            DetailRow("Personal Best", pb?.let { "${Fmt.one(it.e1rm)} กก. (${Fmt.shortDate(it.date)})" } ?: "ยังไม่เคยบันทึกท่านี้มาก่อน")
            DetailRow(
                "Personal Progress",
                progress?.let { "${arrow(it.direction)}${Fmt.one(abs(it.deltaPct))}% เทียบกับครั้งก่อน (${Fmt.shortDate(it.baselineDate)})" }
                    ?: "ยังไม่มีข้อมูลครั้งก่อนให้เทียบ",
            )
            DetailRow("ระดับ Performance", "${perf.level.icon} ${perf.level.label}")
        }
    }
}

private fun arrow(direction: String) = when (direction) { "up" -> "📈 +"; "down" -> "📉 "; else -> "▪️ " }

@Composable
private fun DetailRow(k: String, v: String) {
    Row(Modifier.fillMaxWidth().padding(vertical = 2.dp)) {
        Text(k, color = GB.text3, fontSize = 12.5.sp, modifier = Modifier.weight(0.42f))
        Text(v, fontSize = 12.5.sp, modifier = Modifier.weight(0.58f))
    }
}

/* ---------- โภชนาการ ---------- */

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun FoodSection(t: TrackData, iso: String, store: TrackStore) {
    val tg = Tracking.targetsOf(t)
    val n = t.logs[iso]?.nutrition ?: com.gymbrodaily.nativeapp.domain.Nutrition()
    val pOk = Tracking.proteinOk(n, tg)
    val kOk = Tracking.kcalOk(n.kcal, tg.kcal)
    val wOk = Tracking.waterOk(n, tg)
    val mealsDone = (0 until tg.meals).count { n.meals.getOrNull(it) == true }
    val doneN = listOf(pOk, kOk, wOk).count { it } + mealsDone
    fun patch(change: (com.gymbrodaily.nativeapp.domain.Nutrition) -> com.gymbrodaily.nativeapp.domain.Nutrition) =
        store.updateLog(iso) { it.copy(nutrition = change(it.nutrition)) }
    val proteinTxt = tg.proteinG?.toString() ?: "—"
    val waterTxt = tg.waterL?.let { Fmt.one(it) } ?: "—"

    Card {
        SectionHead(
            "โภชนาการ", GB.food,
            "${Fmt.kcal(tg.kcal)} kcal · โปรตีน $proteinTxt g · น้ำ $waterTxt ล.",
            "$doneN/${3 + tg.meals}",
        )
        CheckRow(pOk, null) {
            RowTitle("โปรตีนวันนี้")
            Hint("เป้า $proteinTxt g (2 g ต่อน้ำหนักตัว 1 กก.) — ติ๊กผ่านเมื่อถึง 90% ขึ้นไป")
            ValueRow("/ $proteinTxt g") { NumberField(n.proteinG, { _, v -> patch { it.copy(proteinG = v) } }, "g", Modifier.weight(1f)) }
        }
        CheckRow(kOk, null) {
            RowTitle("พลังงานที่กินวันนี้")
            Hint(
                "เป้า ${Fmt.kcal(tg.kcal)} kcal · ${tg.kcalDirection}" + (tg.kcal?.let {
                    " — ผ่านเมื่ออยู่ในช่วง ${Fmt.kcal(com.gymbrodaily.nativeapp.domain.jsRound(it * 0.9).toInt())}–${Fmt.kcal(com.gymbrodaily.nativeapp.domain.jsRound(it * 1.1).toInt())} kcal (กินน้อยเกินไปก็ยังไม่ผ่าน)"
                } ?: ""),
            )
            ValueRow("/ ${Fmt.kcal(tg.kcal)}") { NumberField(n.kcal, { _, v -> patch { it.copy(kcal = v) } }, "kcal", Modifier.weight(1f)) }
        }
        CheckRow(wOk, null) {
            RowTitle("น้ำดื่ม")
            Hint("เป้า $waterTxt ลิตร (≈35 มล. ต่อน้ำหนักตัว 1 กก.)")
            ValueRow("/ $waterTxt ล.") { NumberField(n.waterL, { _, v -> patch { it.copy(waterL = v) } }, "ลิตร", Modifier.weight(1f)) }
        }
        CheckRow(mealsDone == tg.meals && tg.meals > 0, null) {
            RowTitle("มื้ออาหารตามแผน")
            Hint("${tg.meals} มื้อ/วัน ตามที่ตอบไว้ — กดเพื่อติ๊กเมื่อกินแล้ว")
            FlowRow(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                for (i in 0 until tg.meals) {
                    val on = n.meals.getOrNull(i) == true
                    FilterChip(
                        selected = on,
                        onClick = {
                            patch { cur ->
                                val meals = (0 until max(cur.meals.size, i + 1)).map { j -> cur.meals.getOrNull(j) }.toMutableList()
                                meals[i] = meals[i] != true
                                cur.copy(meals = meals)
                            }
                        },
                        label = { Text("มื้อ ${i + 1}" + if (on) " ✓" else "") },
                    )
                }
            }
        }
        Hint("ยังไม่มีเมนูอาหารรายมื้อ — บันทึกเป็นตัวเลขรวมของวันก่อน (โปรตีน/พลังงาน/น้ำ)")
    }
}

@Composable
private fun ValueRow(target: String, field: @Composable androidx.compose.foundation.layout.RowScope.() -> Unit) {
    Row(verticalAlignment = Alignment.CenterVertically) {
        field()
        Spacer(Modifier.width(8.dp))
        Text(target, color = GB.text3, fontSize = 13.sp)
    }
}

/* ---------- การนอน ---------- */

@Composable
private fun SleepSection(t: TrackData, iso: String, store: TrackStore) {
    val tg = Tracking.targetsOf(t)
    val sl = t.logs[iso]?.sleep ?: com.gymbrodaily.nativeapp.domain.Sleep()
    val rejected = remember { mutableStateMapOf<String, Boolean>() }
    val outOfRange = sl.hours != null && !Tracking.sleepHoursValid(sl.hours)
    val okH = Tracking.sleepOk(sl, tg)
    val total = if (tg.sleepHygiene) 2 else 1
    val doneN = (if (okH) 1 else 0) + (if (tg.sleepHygiene && sl.hygiene) 1 else 0)
    Card {
        SectionHead("การนอน", GB.sleep, "เป้า ${Fmt.hours(tg.sleepH)}", "$doneN/$total")
        CheckRow(okH, null) {
            RowTitle("ชั่วโมงนอนคืนที่ผ่านมา")
            Hint(tg.sleepH?.let { "ผ่านเมื่อได้ ${Fmt.one(it - 0.5)} ชม. ขึ้นไป" } ?: "ยังไม่ได้ตั้งเป้า — แก้แบบสอบถามข้อชั่วโมงนอนเพื่อให้ระบบคำนวณเป้าให้")
            if (rejected[iso] == true) Hint("ค่าที่กรอกต้องอยู่ระหว่าง 0-24 ชม. ระบบไม่ได้บันทึกค่านี้", color = GB.warn)
            else if (outOfRange) Hint("ค่าที่บันทึกไว้ (${Fmt.num(sl.hours)} ชม.) อยู่นอกช่วงที่เป็นไปได้จริง กรุณาแก้ไข — ระบบไม่นับเป็นวันที่ทำสำเร็จ", color = GB.warn)
            ValueRow("/ ${Fmt.hours(tg.sleepH)}") {
                NumberField(
                    sl.hours,
                    { text, v ->
                        // ปฏิเสธค่านอก 0-24 ชม. ไม่บันทึก ไม่ clamp เงียบๆ (เหมือน numInRange ของเว็บ)
                        val valid = text.isBlank() || (v != null && v.isFinite() && v in 0.0..24.0)
                        rejected[iso] = !valid
                        if (valid) store.updateLog(iso) { it.copy(sleep = it.sleep.copy(hours = if (text.isBlank()) null else v)) }
                    },
                    "ชม.", Modifier.weight(1f), isError = rejected[iso] == true, commitOnBlur = true,
                )
            }
        }
        if (tg.sleepHygiene) {
            CheckRow(sl.hygiene, { c -> store.updateLog(iso) { it.copy(sleep = it.sleep.copy(hygiene = c)) } }) {
                RowTitle("ทำ sleep hygiene ก่อนนอน")
                Hint("คุณตอบว่าอยากได้คำแนะนำนี้ (นอนน้อยกว่า 6 ชม.) — เลี่ยงจอ 30 นาทีก่อนนอน เข้านอนเวลาเดิมทุกคืน")
            }
        }
    }
}

/* ---------- น้ำหนักตัว ---------- */

@Composable
private fun BodySection(t: TrackData, iso: String, store: TrackStore) {
    val tg = Tracking.targetsOf(t)
    val kg = t.weights[iso]
    val first = Tracking.weightSeries(t).firstOrNull()
    val deltaTxt = when {
        kg != null && first != null -> {
            val d = kg - first.kg
            (if (d == 0.0) "เท่ากับ" else if (d > 0) "มากกว่า" else "น้อยกว่า") +
                "วันแรกที่ชั่ง (${Fmt.one(first.kg)} กก. เมื่อ ${Fmt.shortDate(first.date)}) ${Fmt.one(abs(d))} กก."
        }
        kg == null -> "ชั่งตอนเดิมของทุกวันจะเทียบกันได้แม่นที่สุด (เช่น หลังตื่นนอน ก่อนอาหาร)"
        else -> ""
    }
    Card {
        SectionHead(
            "น้ำหนักตัว", GB.branch,
            tg.goalWeight?.let { "เป้า ${Fmt.one(it)} กก." } ?: "ยังไม่ได้ตั้งเป้าตัวเลข",
            "${if (kg != null) 1 else 0}/1",
        )
        CheckRow(kg != null, null) {
            RowTitle("บันทึกน้ำหนักของวันนี้")
            if (deltaTxt.isNotEmpty()) Hint(deltaTxt)
            ValueRow("กก.") {
                // ช่องว่างไม่ลบค่าเดิม (เหมือนเว็บ) — ต้องกรอกตัวเลขใหม่ทับเท่านั้น
                NumberField(kg, { _, v -> if (v != null && v > 0) store.saveWeight(iso, v) }, "กก.", Modifier.weight(1f), commitOnBlur = true)
            }
        }
    }
}
