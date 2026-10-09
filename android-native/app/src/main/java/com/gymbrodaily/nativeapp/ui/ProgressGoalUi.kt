package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
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
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.Checkbox
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.data.FatSeen
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.FAT_KCAL_PER_KG
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.PG_GAIN_PCT_MONTH
import com.gymbrodaily.nativeapp.domain.PG_STR_WINDOW
import com.gymbrodaily.nativeapp.domain.PG_WINDOW
import com.gymbrodaily.nativeapp.domain.PgEval
import com.gymbrodaily.nativeapp.domain.PgIssue
import com.gymbrodaily.nativeapp.domain.PgLevel
import com.gymbrodaily.nativeapp.domain.ProgressGoal
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import com.gymbrodaily.nativeapp.domain.jsLocale
import com.gymbrodaily.nativeapp.domain.jsRound
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put
import kotlin.math.abs
import kotlin.math.ceil
import kotlin.math.floor
import kotlin.math.max
import kotlin.math.min

/* ============================================================
   หน้าตาแถบไขมัน + กรอบแผน Progression & Goal (ตรงกับ fatBarHTML / pgSectionHTML ของเว็บ)
   ตัวเลข/ข้อความมาจาก domain/ProgressGoal.kt ทั้งหมด ไฟล์นี้จัดหน้าตาและปุ่มอย่างเดียว
   ============================================================ */

/** สถานะเปิด/ปิดที่ต้องข้ามหน้า (แจ้งเตือนหน้า "วันนี้" กดแล้วเปิดผลประเมินที่หน้าความคืบหน้าให้เลย) */
object PgUi {
    var more by mutableStateOf(false)
}

private val CAUTION = Color(0xFFFFB067)
private val CAUTION_SOFT = Color(0xFF33230F)

private fun levelColor(l: PgLevel) = when (l) {
    PgLevel.NA -> GB.text3
    PgLevel.OK -> GB.ok
    PgLevel.WATCH -> GB.branch
    PgLevel.ANOMALY -> CAUTION
    PgLevel.ADJUST -> GB.warn
}

private fun levelSoft(l: PgLevel) = when (l) {
    PgLevel.NA -> GB.surface2
    PgLevel.OK -> GB.okSoft
    PgLevel.WATCH -> GB.branchSoft
    PgLevel.ANOMALY -> CAUTION_SOFT
    PgLevel.ADJUST -> GB.warnSoft
}

private fun loc(x: Double) = jsLocale(x)
private fun locR(x: Double) = jsLocale(jsRound(x))

/* ---------- การกระทำที่แก้ program.pg / targets (ตรงกับ pgSave / pgApply ของเว็บ) ---------- */
private fun withPg(raw: JsonObject, patch: Map<String, JsonElement>): JsonObject {
    val cur = raw["pg"] as? JsonObject ?: JsonObject(emptyMap())
    return JsonObject(raw + ("pg" to JsonObject(cur + patch)))
}

private fun pgArr(raw: JsonObject, key: String): List<JsonElement> = ((raw["pg"] as? JsonObject)?.get(key) as? JsonArray) ?: emptyList()

private fun applyNewTarget(store: TrackStore, t: TrackData, ev: PgEval, today: String) {
    if (ev.level != PgLevel.ADJUST) return
    val rec = ProgressGoal.recommend(t, ev)
    val kcal = rec.kcal ?: return
    val tg = Tracking.targetsOf(t)
    store.patchProgram { raw ->
        val base = t.program.pg?.baseDirection?.takeIf { it.isNotEmpty() } ?: tg.kcalDirection
        val macro = Generator.computeMacro(kcal.toDouble(), if (tg.proteinG != null && tg.proteinG != 0) tg.proteinG / 2.0 else Tracking.bodyweightAsOf(t, today))
        val curTargets = raw["targets"] as? JsonObject
            ?: TrackStore.json.encodeToJsonElement(com.gymbrodaily.nativeapp.domain.Targets.serializer(), tg) as JsonObject
        val nt = JsonObject(
            curTargets + mapOf(
                "kcal" to JsonPrimitive(kcal),
                "tdee" to (rec.tdee?.let { JsonPrimitive(it) } ?: JsonNull),
                "fatG" to (macro.fatG?.let { JsonPrimitive(it) } ?: JsonNull),
                "carbG" to (macro.carbG?.let { JsonPrimitive(it) } ?: JsonNull),
                "macroClamped" to JsonPrimitive(macro.clamped),
                "kcalDirection" to JsonPrimitive("$base · ปรับตามผลจริงเมื่อ ${ProgressGoal.shortDateTH(today)}"),
            ),
        )
        val adj = buildJsonObject {
            put("date", today); put("fromKcal", tg.kcal); put("toKcal", kcal); put("fromTdee", tg.tdee); put("toTdee", rec.tdee)
        }
        withPg(
            JsonObject(raw + ("targets" to nt)),
            mapOf(
                "evalFrom" to JsonPrimitive(today), "confirmedAt" to JsonNull, "baseDirection" to JsonPrimitive(base),
                "adjustments" to JsonArray(pgArr(raw, "adjustments") + adj),
            ),
        )
    }
}

/* ---------- แจ้งเตือน (หน้า "วันนี้" + หน้าความคืบหน้า) ---------- */
@Composable
private fun Banner(icon: String, bg: Color, line: Color, content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(bg).border(1.dp, line, RoundedCornerShape(20.dp)).padding(14.dp),
        horizontalArrangement = Arrangement.spacedBy(10.dp),
    ) {
        Text(icon, fontSize = 18.sp)
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(6.dp)) { content() }
    }
}

@Composable
fun FatAlert(t: TrackData, today: String, store: TrackStore, seen: FatSeen) {
    if (!ProgressGoal.fatBarEnabled(t.program)) return
    val tug = remember(t, today) { ProgressGoal.fatTug(t, today) }
    val fixed = FatSeen(min(seen.gains, tug.gains.size), min(seen.losses, tug.losses.size))
    val nl = tug.losses.size - fixed.losses
    val ng = tug.gains.size - fixed.gains
    if (nl <= 0 && ng <= 0) return
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        if (nl > 0) Banner("🎉", GB.okSoft, GB.ok) {
            Text("คุณลดไขมันได้ $nl กก.", fontWeight = FontWeight.Bold)
            Hint("จากการกินน้อยกว่าที่ร่างกายใช้สะสมครบ ${jsLocale(nl * FAT_KCAL_PER_KG)} kcal — รวมลดได้แล้ว ${tug.losses.size} ครั้ง", color = GB.text2)
        }
        if (ng > 0) Banner("⚠️", GB.warnSoft, GB.warn) {
            Text("ไขมันของคุณเพิ่มขึ้น $ng กก.", fontWeight = FontWeight.Bold)
            Hint("จากการกินเกินที่ร่างกายใช้สะสมครบ ${jsLocale(ng * FAT_KCAL_PER_KG)} kcal — รวมเพิ่มแล้ว ${tug.gains.size} ครั้ง", color = GB.text2)
        }
        OutlinedButton(onClick = { store.setFatSeen(FatSeen(tug.gains.size, tug.losses.size)) }) { Text("รับทราบ") }
    }
}

/** แจ้งเตือนหน้า "วันนี้" เมื่อกรอบแผนผิดปกติ/ควรปรับ — รายละเอียดอยู่หน้าความคืบหน้า */
@Composable
fun PgAlert(t: TrackData, today: String, onGo: () -> Unit) {
    if (t.program.startDate == null) return
    val ev = remember(t, today) { ProgressGoal.current(t, today) }
    if (ev.level.n < 3) return
    Banner(ev.level.icon, CAUTION_SOFT, CAUTION) {
        Text("กรอบแผน: ${ev.level.label}", fontWeight = FontWeight.Bold)
        Hint(
            if (ev.level == PgLevel.ADJUST) "ระบบมีคำแนะนำให้ปรับแผนจากผลจริงของคุณ"
            else "ผลลัพธ์ไม่เป็นไปตามกรอบของแผน ช่วยตรวจว่าข้อมูลที่บันทึกครบและถูกต้อง",
            color = GB.text2,
        )
        OutlinedButton(onClick = { PgUi.more = true; onGo() }) { Text("ดูที่หน้าความคืบหน้า →") }
    }
}

/* ---------- แถบไขมัน ---------- */
@Composable
fun FatBarSection(t: TrackData, today: String) {
    if (!ProgressGoal.fatBarEnabled(t.program)) return
    val tg = Tracking.targetsOf(t)
    SectionTitle("แถบไขมัน (ชักเย่อแคลอรี่)")
    Card {
        val tdee = tg.tdee
        if (tdee == null) {
            Hint("ยังคำนวณไม่ได้ — ข้อมูลแบบสอบถามไม่พอคำนวณพลังงานที่ร่างกายต้องการ (TDEE)")
            return@Card
        }
        val tug = remember(t, today) { ProgressGoal.fatTug(t, today) }
        val acc = tug.acc
        val pct = min(1.0, abs(acc) / FAT_KCAL_PER_KG).toFloat()
        Row(
            Modifier.fillMaxWidth().height(22.dp).clip(RoundedCornerShape(50)).background(GB.surface2)
                .border(1.dp, GB.borderStrong, RoundedCornerShape(50)),
        ) {
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.CenterEnd) {
                Box(Modifier.fillMaxWidth(if (acc < 0) pct else 0f).fillMaxHeight().background(GB.warn))
            }
            Box(Modifier.width(2.dp).fillMaxHeight().background(GB.text))
            Box(Modifier.weight(1f).fillMaxHeight(), contentAlignment = Alignment.CenterStart) {
                Box(Modifier.fillMaxWidth(if (acc > 0) pct else 0f).fillMaxHeight().background(GB.ok))
            }
        }
        Row(Modifier.fillMaxWidth()) {
            Text("ไขมัน +1 กก.\n−7,700 kcal", color = GB.warn, fontSize = 11.sp, lineHeight = 14.sp, modifier = Modifier.weight(1f))
            Text("0", color = GB.text3, fontSize = 11.sp, modifier = Modifier.weight(1f), textAlign = TextAlign.Center)
            Text("ไขมัน −1 กก.\n+7,700 kcal", color = GB.ok, fontSize = 11.sp, lineHeight = 14.sp, modifier = Modifier.weight(1f), textAlign = TextAlign.End)
        }
        var open by rememberSaveable { mutableStateOf(false) }
        LinkButton(if (open) "ซ่อนข้อมูล ▴" else "แสดงข้อมูล ▾") { open = !open }
        if (!open) return@Card

        val now = when {
            acc > 0 -> "กินขาดสะสม ${locR(acc)} / 7,700 kcal → อีก ${locR(FAT_KCAL_PER_KG - acc)} kcal จะลดไขมันได้ 1 กก."
            acc < 0 -> "กินเกินสะสม ${locR(-acc)} / 7,700 kcal → อีก ${locR(FAT_KCAL_PER_KG + acc)} kcal ไขมันจะเพิ่ม 1 กก."
            else -> "แถบอยู่ที่ 0"
        }
        Text(now, color = if (acc > 0) GB.ok else if (acc < 0) GB.warn else GB.text2, fontWeight = FontWeight.SemiBold)
        val net = tug.losses.size - tug.gains.size
        TileGrid(
            listOf(
                Triple("ลดไขมันได้แล้ว", "${tug.losses.size} ครั้ง (กก.)", "ฝั่งขวาครบ 7,700 kcal"),
                Triple("ไขมันเพิ่มขึ้น", "${tug.gains.size} ครั้ง (กก.)", "ฝั่งซ้ายครบ 7,700 kcal"),
                Triple("สุทธิ", (if (net > 0) "−" else if (net < 0) "+" else "") + "${abs(net)} กก. ไขมัน", "นับจาก ${tug.days.size} วันที่กรอกแคลอรี่"),
            ),
        )
        val te = ProgressGoal.dayEnergy(t, today)
        Hint(
            if (te != null) {
                val bal = te.tdee + te.ex - te.kcal
                "วันนี้กินไป ${loc(te.kcal)} kcal · ร่างกายใช้ ${loc(te.tdee + te.ex)} kcal (TDEE ${loc(te.tdee)}" +
                    (if (te.ex != 0.0) " + ออกกำลังกายที่บันทึกแล้ว ~${loc(te.ex)}" else " — ยังไม่มีการออกกำลังกายที่บันทึกวันนี้") +
                    ") — ถ้าจบวันที่ตัวเลขนี้ แถบจะขยับ" + (if (bal >= 0) "ไปทางขวา +${loc(bal)}" else "ไปทางซ้าย ${loc(bal)}") + " kcal (นับตอนเที่ยงคืน)"
            } else "วันนี้ยังไม่ได้กรอกแคลอรี่ — กรอกที่หน้า “วันนี้” แล้วระบบจะนับให้ตอนจบวัน",
        )
        val events = tug.days.filter { it.ev != null }.reversed().take(10)
        if (events.isNotEmpty()) {
            Text("ประวัติการครบ 1 กก.", fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp)
            events.forEach { d ->
                Row {
                    Text(if (d.ev == "loss") "🟢 ลดไขมัน 1 กก." else "🔴 ไขมันเพิ่ม 1 กก.", color = if (d.ev == "gain") GB.warn else GB.text, modifier = Modifier.weight(1f), fontSize = 13.sp)
                    Text(ProgressGoal.shortDateTH(d.date), color = GB.text3, fontSize = 13.sp)
                }
            }
        }
        val recent = tug.days.takeLast(7).reversed()
        if (recent.isNotEmpty()) {
            TableRow(listOf("วันที่", "กิน (kcal)", "ร่างกายใช้", "ขยับแถบ"), header = true)
            recent.forEach { d ->
                TableRow(
                    listOf(
                        ProgressGoal.shortDateTH(d.date), loc(d.kcal),
                        loc(d.burn) + if (d.ex != 0.0) "\n${loc(d.tdee)} + ฝึก ${loc(d.ex)}" else "",
                        (if (d.bal >= 0) "+" else "") + loc(d.bal),
                    ),
                    lastColor = if (d.bal >= 0) GB.ok else GB.warn,
                )
            }
        }
        Hint(
            "ร่างกายใช้ = TDEE ${jsLocale(tdee)} kcal (BMR × ระดับกิจกรรมจากลักษณะงาน) + แคลที่เผาจากการฝึกและ cardio ที่บันทึกว่าทำจริงวันนั้น · " +
                "เป้าแคลอรี่ของแผน (${ProgressGoal.fmtKcal(tg.kcal)} kcal) คือเป้าที่ควรกิน ไม่ใช่พลังงานที่ใช้ — กินตามเป้าในวันฝึก แถบจะขยับไปทางขวาเท่ากับแคลที่เผาจากการฝึก · 1 กก. ไขมัน ≈ 7,700 kcal · กินขาด = ขยับขวา (เขียว) กินเกิน = ขยับซ้าย (แดง) ครบฝั่งใดฝั่งหนึ่งแล้วเริ่มที่ 0 ใหม่ · นับเมื่อจบวัน และไม่นับวันที่ไม่ได้กรอกแคลอรี่ · เป็นการประมาณ ไม่ใช่การวัดไขมันจริง",
        )
    }
}

@Composable
private fun TableRow(cells: List<String>, header: Boolean = false, lastColor: Color? = null) {
    Row(Modifier.fillMaxWidth().padding(vertical = 3.dp), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        cells.forEachIndexed { i, c ->
            Text(
                c, modifier = Modifier.weight(if (cells.size == 2 && i == 0) 0.6f else 1f),
                color = if (header) GB.text3 else if (i == cells.lastIndex && lastColor != null) lastColor else GB.text2,
                fontSize = if (header) 12.sp else 13.sp, lineHeight = 17.sp,
                fontWeight = if (header) FontWeight.SemiBold else FontWeight.Normal,
            )
        }
    }
}

@Composable
private fun H4(text: String) = Text(text, fontWeight = FontWeight.Bold, fontSize = 14.5.sp, modifier = Modifier.padding(top = 6.dp))

@Composable
private fun Bullets(items: List<String>, issues: List<PgIssue>? = null) {
    Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
        issues?.forEach { Text("• ${it.text}", color = if (it.lvl == "warn") CAUTION else GB.text2, fontSize = 13.sp, lineHeight = 18.sp) }
        items.forEach { Text("• $it", color = GB.text2, fontSize = 13.sp, lineHeight = 18.sp) }
    }
}

/* ---------- กรอบแผน Progression & Goal ---------- */
@Composable
fun PgSection(t: TrackData, today: String, store: TrackStore) {
    if (t.program.startDate == null) return
    val ev = remember(t, today) { ProgressGoal.current(t, today) }
    SectionTitle("เป้าหมาย & กรอบพัฒนาการ (Progression & Goal)")
    PgPlanCard(t, ev, today)
    if (PgUi.more) PgEvalCard(t, ev, today, store)
}

@Composable
private fun PgPlanCard(t: TrackData, ev: PgEval, today: String) {
    val ctx = ev.ctx!!
    val ak = ctx.anchorKg
    val plan = ev.plan
    Card {
        if (ak != null) CorridorChart(t, ev, today)
        else Hint("ยังไม่มีน้ำหนักตั้งต้น — บันทึกน้ำหนักที่หน้า “วันนี้” แล้วระบบจะวาดกราฟกรอบให้")
        LinkButton(if (PgUi.more) "ซ่อนผลเพิ่มเติม ▴" else "แสดงผลเพิ่มเติม ▾") { PgUi.more = !PgUi.more }
        if (!PgUi.more) return@Card
        val rounds = t.program.pg?.adjustments?.size ?: 0
        Text(
            "ถ้าทำตามแผนนี้ต่อเนื่อง · รอบประเมินเริ่ม ${ProgressGoal.shortDateTH(ev.anchor)}" + if (rounds > 0) " (ปรับเป้าแล้ว $rounds ครั้ง)" else "",
            color = GB.text3, fontSize = 12.sp,
        )
        Text(ProgressGoal.goalLine(t, plan), fontWeight = FontWeight.Bold, fontSize = 16.sp, lineHeight = 22.sp)
        if (ak == null) return@Card
        val now = ProgressGoal.nowKg(ev) ?: return@Card
        val tiles = mutableListOf<Triple<String, String, String?>>()
        listOf(4, 8, 12).forEach { wk ->
            val a = now.kg + plan.lo * wk; val b = now.kg + plan.hi * wk
            tiles += Triple(
                "อีก $wk สัปดาห์", "${Fmt.one(now.kg + plan.c * wk)} กก.",
                "ช่วง ${Fmt.one(min(a, b))}–${Fmt.one(max(a, b))} · ${ProgressGoal.shortDateTH(ProgressGoal.addDays(today, 7 * wk))}",
            )
        }
        ProgressGoal.eta(t, ev, today)?.let { e ->
            val head = "ถึงเป้า ${Fmt.one(e.goal)} กก."
            tiles += when {
                e.done -> Triple(head, "ถึงแล้ว", "น้ำหนักล่าสุดอยู่ที่เป้าหมาย")
                e.mismatch -> Triple(
                    head, "—",
                    when (t.program.goal) {
                        "Recomposition (ลด+เพิ่มพร้อมกัน)" -> "Recomposition เน้นเปลี่ยนสัดส่วน น้ำหนักแทบไม่เปลี่ยน — ดูความแข็งแรงและรูปร่างแทน"
                        "รักษาสุขภาพทั่วไป" -> "แผนนี้ตั้งแคลอรี่เพื่อรักษาน้ำหนัก — ถ้าต้องการถึงเป้านี้ให้เปลี่ยนเป้าหมายในแบบสอบถาม"
                        else -> "แผนนี้ไม่ได้พาน้ำหนักไปทางเป้า"
                    },
                )
                else -> {
                    val fast = max(1L, jsRound(e.fast!!).toLong())
                    Triple(
                        head, "~${max(1L, jsRound(e.weeks!!).toLong())} สัปดาห์",
                        "ประมาณ ${ProgressGoal.dateY(e.date!!)}" + (e.slow?.let { " (ช่วง $fast–${jsRound(it).toLong()} สัปดาห์)" } ?: " (เร็วสุด ~$fast สัปดาห์)"),
                    )
                }
            }
        }
        TileGrid(tiles)
        Hint("คาดการณ์จากน้ำหนักตอนนี้ ~${Fmt.one(now.kg)} กก. (${now.how})")
        Hint("กราฟ: แถบเขียว = กรอบน้ำหนักที่ควรเป็นถ้าทำตามแผน (ตั้งต้นจาก ${Fmt.one(ak.kg)} กก. เมื่อ ${ProgressGoal.shortDateTH(ak.date)}) · เส้นประเขียว = ค่ากลาง · จุดน้ำเงิน = น้ำหนักที่ชั่งจริง — น้ำหนักรายวันแกว่ง ±1 กก. ได้ ระบบดูแนวโน้มหลายวันรวมกัน")
        var crit by rememberSaveable { mutableStateOf(false) }
        LinkButton(if (crit) "ซ่อนเกณฑ์และจุดตรวจ ▴" else "ดูเกณฑ์รายสัปดาห์ จุดตรวจ และเป้าความแข็งแรง ▾") { crit = !crit }
        if (crit) PgCriteria(t, ev, today)
    }
}

@Composable
private fun CorridorChart(t: TrackData, ev: PgEval, today: String) {
    val ak = ev.ctx!!.anchorKg!!
    val plan = ev.plan
    val goal = Tracking.targetsOf(t).goalWeight
    val elapsed = max(0, ProgressGoal.daysBetween(ak.date, today))
    val bigX = max(84, ceil((elapsed + 14) / 28.0).toInt() * 28)
    val pts = ev.ctx!!.series.filter { it.date >= ak.date && it.date <= today }.map { ProgressGoal.daysBetween(ak.date, it.date) to it.kg }
    fun at(rate: Double, x: Int) = ak.kg + rate * x / 7
    val ys = listOf(at(plan.lo, 0), at(plan.hi, 0), at(plan.lo, bigX), at(plan.hi, bigX)) + pts.map { it.second }
    var minY = ys.min(); var maxY = ys.max()
    val showGoal = goal != null && goal >= minY - 2 && goal <= maxY + 2
    if (showGoal) { minY = min(minY, goal!!); maxY = max(maxY, goal) }
    if (maxY - minY < 2) { val m = (maxY + minY) / 2; minY = m - 1; maxY = m + 1 }
    val pad = (maxY - minY) * 0.1
    minY -= pad; maxY += pad
    val measurer = rememberTextMeasurer()
    val small = TextStyle(color = GB.text3, fontSize = 10.sp)
    val goalStyle = TextStyle(color = GB.branch, fontSize = 10.sp, fontWeight = FontWeight.SemiBold)
    Canvas(Modifier.fillMaxWidth().height(220.dp)) {
        val pl = 42.dp.toPx(); val pr = 8.dp.toPx(); val pt = 10.dp.toPx(); val pb = 22.dp.toPx()
        fun px(v: Int) = pl + v.toFloat() / bigX * (size.width - pl - pr)
        fun py(v: Double) = (pt + (maxY - v) / (maxY - minY) * (size.height - pt - pb)).toFloat()
        listOf(maxY, (maxY + minY) / 2, minY).forEach { v ->
            drawLine(GB.border, Offset(pl, py(v)), Offset(size.width - pr, py(v)), 1f)
            drawText(measurer, Fmt.one(v), Offset(0f, py(v) - 7.dp.toPx()), small)
        }
        val band = Path().apply {
            moveTo(px(0), py(at(plan.lo, 0))); lineTo(px(bigX), py(at(plan.lo, bigX)))
            lineTo(px(bigX), py(at(plan.hi, bigX))); lineTo(px(0), py(at(plan.hi, 0))); close()
        }
        drawPath(band, GB.okSoft)
        drawPath(band, GB.ok.copy(alpha = 0.45f), style = Stroke(1.5f))
        val dash = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))
        drawLine(GB.ok, Offset(px(0), py(ak.kg)), Offset(px(bigX), py(at(plan.c, bigX))), 2.5f, pathEffect = dash)
        if (showGoal) {
            drawLine(GB.branch, Offset(pl, py(goal!!)), Offset(size.width - pr, py(goal)), 2f, pathEffect = dash)
            val label = "เป้า ${Fmt.one(goal)} กก."
            val m = measurer.measure(label, goalStyle)
            drawText(m, topLeft = Offset(size.width - pr - m.size.width, py(goal) - m.size.height - 2.dp.toPx()))
        }
        val step = if (bigX > 168) 56 else 28
        var dd = 0
        while (dd <= bigX) {
            val label = if (dd == 0) "เริ่มรอบ" else "สัปดาห์ ${dd / 7}"
            val m = measurer.measure(label, small)
            val x = when {
                dd == 0 -> px(dd)
                dd + step > bigX -> px(dd) - m.size.width
                else -> px(dd) - m.size.width / 2f
            }
            drawText(m, topLeft = Offset(x, size.height - m.size.height))
            dd += step
        }
        if (elapsed in 1..bigX) {
            drawLine(GB.text4, Offset(px(elapsed), pt), Offset(px(elapsed), size.height - pb), 1.5f, pathEffect = PathEffect.dashPathEffect(floatArrayOf(4f, 6f)))
            drawText(measurer, "วันนี้", Offset(px(elapsed) + 4.dp.toPx(), pt), small)
        }
        if (pts.size > 1) {
            val line = Path()
            pts.forEachIndexed { i, (x, y) -> if (i == 0) line.moveTo(px(x), py(y)) else line.lineTo(px(x), py(y)) }
            drawPath(line, GB.accent, style = Stroke(2.5f))
        }
        pts.forEachIndexed { i, (x, y) ->
            drawCircle(GB.accent, if (i == pts.lastIndex) 4.5.dp.toPx() else 3.dp.toPx(), Offset(px(x), py(y)))
        }
    }
}

@Composable
private fun PgCriteria(t: TrackData, ev: PgEval, today: String) {
    val tg = Tracking.targetsOf(t)
    val plan = ev.plan
    val sb = ProgressGoal.strengthBand(t)
    val ak = ev.ctx!!.anchorKg!!
    val cw = ProgressGoal.cardioWeek(t.program)
    val sb0 = (if (sb[0] > 0) "+" else "") + ProgressGoal.jsNum(sb[0])
    H4("เกณฑ์ที่ควรเห็นทุกสัปดาห์ถ้าทำตามแผน")
    listOfNotNull(
        "น้ำหนักตัว" to "${ProgressGoal.rate(plan.lo)} ถึง ${ProgressGoal.rate(plan.hi)} กก./สัปดาห์",
        "เข้าฝึก" to "${t.program.days.size} ครั้ง/สัปดาห์ (นับว่าทำตามแผนเมื่อ ≥ 75%)",
        if (cw != 0.0) "Cardio" to "${ProgressGoal.jsNum(cw)} นาที/สัปดาห์" else null,
        tg.kcal?.let { "แคลอรี่" to "เฉลี่ย ${jsLocale(ceil(it * 0.9))}–${jsLocale(floor(it * 1.1))} kcal/วัน และกรอกอย่างน้อย 70% ของวัน" },
        tg.proteinG?.takeIf { it != 0 }?.let { "โปรตีน" to "≥ ${jsRound(it * 0.9).toLong()} g/วัน" },
        tg.sleepH?.let { "การนอน" to "≥ ${Fmt.one(it - 0.5)} ชม./คืน" },
        "ความแข็งแรง" to "e1RM ท่าที่ใช้น้ำหนัก $sb0 ถึง +${ProgressGoal.jsNum(sb[1])}% ต่อ 4 สัปดาห์",
        "การชั่งน้ำหนัก" to "3-7 ครั้ง/สัปดาห์ ตอนเช้าหลังเข้าห้องน้ำ ก่อนกิน (ให้ระบบแยกแนวโน้มจริงออกจากน้ำได้)",
    ).forEach { (k, v) -> TableRow(listOf(k, v)) }

    H4("จุดตรวจระหว่างทาง (น้ำหนักเฉลี่ยช่วง ±3 วันของจุดตรวจ)")
    TableRow(listOf("จุดตรวจ", "กรอบ", "จริง", "ผล"), header = true)
    val tol = max(0.5, ak.kg * 0.005)
    listOf(2, 4, 8, 12).forEach { wk ->
        val d = ProgressGoal.addDays(ak.date, 7 * wk)
        val a = min(ak.kg + plan.lo * wk, ak.kg + plan.hi * wk)
        val b = max(ak.kg + plan.lo * wk, ak.kg + plan.hi * wk)
        val near = ev.ctx!!.series.filter { abs(ProgressGoal.daysBetween(d, it.date)) <= 3 && it.date <= today }
        val act = ProgressGoal.mean(near.map { it.kg })
        val (res, color) = when {
            d > today -> "รอถึงวัน" to GB.text3
            act == null -> "ไม่ได้ชั่ง" to GB.text3
            act >= a - tol && act <= b + tol -> "ในกรอบ ✓" to GB.ok
            else -> (if (act < a) "ต่ำกว่ากรอบ" else "สูงกว่ากรอบ") to GB.warn
        }
        TableRow(listOf("สัปดาห์ $wk · ${ProgressGoal.shortDateTH(d)}", "${Fmt.one(a)}–${Fmt.one(b)}", act?.let { Fmt.one(it) } ?: "—", res), lastColor = color)
    }
    val lifts = ProgressGoal.lifts(t.program).mapNotNull { ex -> ev.ctx!!.hist[ex.id]?.lastOrNull()?.let { ex.th to it.e1rm } }.take(6)
    if (lifts.isNotEmpty()) {
        H4("ความแข็งแรงที่ควรไปถึง (e1RM โดยประมาณ)")
        TableRow(listOf("ท่า", "ล่าสุด", "+4 สัปดาห์", "+12 สัปดาห์"), header = true)
        lifts.forEach { (th, cur) ->
            fun g(n: Int) = "${jsRound(cur * (1 + sb[0] * n / 100)).toLong()}–${jsRound(cur * (1 + sb[1] * n / 100)).toLong()}"
            TableRow(listOf(th, "${jsRound(cur).toLong()} กก.", g(1), g(3)))
        }
    } else {
        Hint("บันทึกน้ำหนัก/ครั้งต่อเซ็ตในหน้า “วันนี้” แล้วระบบจะตั้งกรอบความแข็งแรงรายท่าให้")
    }
    Hint(
        "ที่มาของกรอบ: " + (if (t.program.goal == "เพิ่มกล้ามเนื้อ")
            "ช่วงเพิ่มกล้าม น้ำหนักควรขึ้น ${PG_GAIN_PCT_MONTH[ProgressGoal.expRank(t)].joinToString("–") { ProgressGoal.jsNum(it) }}% ของน้ำหนักตัวต่อเดือนตามระดับประสบการณ์ (เร็วกว่านี้ส่วนเกินมักเป็นไขมัน)"
        else "เป้าแคลอรี่ − (TDEE ${ProgressGoal.fmtKcal(tg.tdee)} + การออกกำลังกายตามแผน ~${plan.exPerDay} kcal/วัน) ÷ 7,700 kcal ต่อ 1 กก. ± ช่วงคลาดเคลื่อน" +
            if (t.program.goal == "ลดไขมัน") " · ไม่ควรลดเร็วเกิน 1% ของน้ำหนักตัว/สัปดาห์" else "") +
            " · ความแข็งแรงตามระดับประสบการณ์ (มือใหม่พัฒนาเร็วกว่า) · เป็นค่าประมาณจากแนวทางทั่วไป ไม่ใช่การรับประกันผล",
    )
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun PgEvalCard(t: TrackData, ev: PgEval, today: String, store: TrackStore) {
    val streak = if (ev.level.n >= 3) ev.run + 1 else 0
    Card(Modifier.border(1.dp, if (ev.level.n >= 3) levelColor(ev.level) else Color.Transparent, CardShape)) {
        Text("ผลการประเมินอัตโนมัติ · ข้อมูล ${ProgressGoal.shortDateTH(ev.ws)} – ${ProgressGoal.shortDateTH(ev.asOf)}", color = GB.text3, fontSize = 12.sp)
        Pill("${ev.level.icon} ${ev.level.label}", levelColor(ev.level), levelSoft(ev.level))
        Text(ProgressGoal.summaryText(ev) + if (streak >= 2) " (หลุดกรอบต่อเนื่อง $streak สัปดาห์)" else "", fontSize = 14.sp, lineHeight = 20.sp)
        if (ev.history.isNotEmpty()) {
            FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
                ev.history.forEach { Pill("สัปดาห์ ${it.week}", levelColor(it.level), levelSoft(it.level)) }
                Pill("ตอนนี้", levelColor(ev.level), levelSoft(ev.level))
            }
        }
        ev.signals.forEach { s ->
            Row(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                    .background(if (s.level == PgLevel.WATCH || s.level == PgLevel.ANOMALY) levelSoft(s.level) else GB.surface2).padding(12.dp),
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(s.level.icon)
                Column(Modifier.weight(1f)) {
                    Text(s.title, fontWeight = FontWeight.SemiBold, fontSize = 14.sp)
                    Text(s.text, color = GB.text2, fontSize = 13.sp, lineHeight = 18.sp)
                }
            }
        }
        if ((ev.level == PgLevel.NA || ev.level == PgLevel.OK || ev.level == PgLevel.WATCH) && ev.causes.isNotEmpty()) {
            H4("ปัจจัยที่ควรเฝ้าดู (อาจกระทบพัฒนาการ)")
            Bullets(ev.causes)
        }
        when {
            ev.level == PgLevel.ANOMALY -> PgCheck(t, ev, today, store)
            ev.level == PgLevel.ADJUST -> PgAdjust(t, ev, today, store)
            ev.issues.any { it.lvl == "warn" } ->
                Text("⚠️ คุณภาพข้อมูล: พบ ${ev.issues.size} จุดที่ควรบันทึกให้ครบ/แม่นขึ้น เพื่อให้ระบบประเมินได้ถูกต้อง (ดูในรายละเอียด)", color = CAUTION, fontSize = 13.sp)
        }
        var open by rememberSaveable { mutableStateOf(false) }
        LinkButton(if (open) "ซ่อนข้อมูลที่ใช้ประเมิน ▴" else "ดูข้อมูลที่ใช้ประเมิน ▾") { open = !open }
        if (open) PgDetails(t, ev)
    }
}

private val PG_CHECKS = listOf(
    "weigh" to "ชั่งน้ำหนักตอนเช้าหลังเข้าห้องน้ำ ก่อนกิน/ดื่ม ด้วยเครื่องชั่งเดิมทุกครั้ง",
    "food" to "บันทึกทุกอย่างที่กินและดื่มครบทุกวัน รวมเครื่องดื่มหวาน กาแฟ ของว่าง ซอส และน้ำมันที่ใช้ปรุง",
    "portion" to "ปริมาณอาหารมาจากการชั่ง/ตวงหรือฉลากโภชนาการ ไม่ได้กะด้วยตาหรือกรอกตามเป้า",
    "lift" to "น้ำหนักและจำนวนครั้งที่กรอกในแต่ละเซ็ตเป็นค่าที่ทำได้จริง",
)

@Composable
private fun PgCheck(t: TrackData, ev: PgEval, today: String, store: TrackStore) {
    val checks = PG_CHECKS + ("water" to "ช่วงนี้ไม่มีปัจจัยที่ทำให้น้ำคั่งผิดปกติ เช่น กินเค็มจัด ป่วย เปลี่ยนยา" +
        if (ProgressGoal.sex(t) == "หญิง") " หรือช่วงก่อน/ระหว่างมีประจำเดือน" else "")
    var ticked by rememberSaveable { mutableStateOf(setOf<String>()) }
    var resetAsk by rememberSaveable { mutableStateOf(false) }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.surface2).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        H4("1. จุดที่ระบบพบในข้อมูลของคุณ")
        if (ev.issues.isNotEmpty()) Bullets(emptyList(), ev.issues)
        else Hint("ระบบไม่พบจุดผิดสังเกตจากตัวข้อมูลเอง — ช่วยตรวจตามรายการในข้อ 2")
        if (ev.causes.isNotEmpty()) { H4("ปัจจัยที่อาจเกี่ยวข้อง"); Bullets(ev.causes) }
        H4("2. ช่วยยืนยันว่าบันทึกครบและถูกต้อง")
        checks.forEach { (k, label) ->
            Row(
                Modifier.fillMaxWidth().clickable { ticked = if (k in ticked) ticked - k else ticked + k },
                verticalAlignment = Alignment.CenterVertically,
            ) {
                Checkbox(checked = k in ticked, onCheckedChange = { ticked = if (it) ticked + k else ticked - k })
                Text(label, fontSize = 13.5.sp, lineHeight = 19.sp, modifier = Modifier.weight(1f))
            }
        }
        Button(
            onClick = {
                ticked = emptySet()
                store.patchProgram { withPg(it, mapOf("confirmedAt" to JsonPrimitive(today))) }
            },
            enabled = ticked.size >= checks.size,
        ) { Text("ตรวจแล้ว ข้อมูลถูกต้องครบ (${ticked.size}/${checks.size})") }
        if (!resetAsk) {
            OutlinedButton(onClick = { resetAsk = true }) { Text("พบว่าบันทึกไม่ครบ/ไม่ถูก — เริ่มเก็บข้อมูลใหม่") }
        } else {
            Text("เริ่มรอบประเมินใหม่ตั้งแต่วันนี้? ข้อมูลเดิมยังอยู่ครบ แต่ระบบจะไม่ใช้ข้อมูลก่อนวันนี้ในการประเมิน และจะประเมินใหม่เมื่อมีข้อมูลพอ (~2 สัปดาห์)", fontSize = 13.5.sp, lineHeight = 19.sp)
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                Button(onClick = {
                    resetAsk = false; ticked = emptySet()
                    store.patchProgram { raw ->
                        withPg(raw, mapOf(
                            "evalFrom" to JsonPrimitive(today), "confirmedAt" to JsonNull,
                            "resets" to JsonArray(pgArr(raw, "resets") + JsonPrimitive(today)),
                        ))
                    }
                }) { Text("ยืนยัน เริ่มเก็บข้อมูลใหม่") }
                OutlinedButton(onClick = { resetAsk = false }) { Text("ยกเลิก") }
            }
        }
        Hint("ถ้าเมื่อวาน/วันนี้กรอกผิด แก้ได้ที่หน้า “ตาราง” · ยืนยันว่าข้อมูลถูกต้อง → ระบบจะเสนอวิธีปรับแผน · พบว่าบันทึกไม่ครบ → เริ่มเก็บใหม่ให้แม่นขึ้น แล้วระบบประเมินใหม่เอง")
    }
}

@Composable
private fun PgAdjust(t: TrackData, ev: PgEval, today: String, store: TrackStore) {
    val rec = ProgressGoal.recommend(t, ev)
    val tg = Tracking.targetsOf(t)
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(18.dp)).background(GB.surface2).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        H4("สิ่งที่ระบบแนะนำให้ปรับ")
        rec.kcal?.let { k ->
            Text("ปรับเป้าแคลอรี่: ${ProgressGoal.fmtKcal(tg.kcal)} → ${ProgressGoal.fmtKcal(k)} kcal/วัน", fontWeight = FontWeight.Bold)
            Hint(
                "จากข้อมูลจริง ร่างกายใช้พลังงานประมาณ ${ProgressGoal.fmtKcal(jsRound(ev.energy.implied!!))} kcal/วัน — ถ้าจะให้ผลตามกรอบ (${ProgressGoal.rate(ev.plan.c)} กก./สัปดาห์) ควรกินประมาณ ${ProgressGoal.fmtKcal(rec.want)} kcal" +
                    if (rec.capped) " · ระบบปรับทีละไม่เกิน 300 kcal เพื่อความปลอดภัย แล้วค่อยประเมินรอบถัดไป" else "",
                color = GB.text2,
            )
            Button(onClick = { applyNewTarget(store, t, ev, today) }) { Text("ใช้เป้าใหม่ ${ProgressGoal.fmtKcal(k)} kcal") }
        }
        if (rec.text.isNotEmpty()) Bullets(rec.text)
        if (rec.kcal == null && rec.text.isEmpty()) Hint("ยังไม่มีตัวเลขพอให้ระบบเสนอเป้าใหม่ — ปรับวันฝึก/ท่าได้ที่หน้า “แผนของฉัน” หรือถามโค้ช")
        TextButton(onClick = { store.patchProgram { withPg(it, mapOf("confirmedAt" to JsonNull)) } }) { Text("กลับไปตรวจข้อมูลอีกครั้ง") }
        t.program.pg?.confirmedAt?.let {
            Hint("ยืนยันข้อมูลเมื่อ ${ProgressGoal.shortDateTH(it)} · หลังปรับเป้า ระบบเริ่มรอบประเมินใหม่และติดตามผลต่ออีก 2-3 สัปดาห์")
        }
    }
}

@Composable
private fun PgDetails(t: TrackData, ev: PgEval) {
    val tg = Tracking.targetsOf(t)
    val adh = ev.adh
    val en = ev.energy
    val rows = mutableListOf<Pair<String, String>>()
    rows += "ช่วงข้อมูล" to "${ProgressGoal.shortDateTH(ev.ws)} – ${ProgressGoal.shortDateTH(ev.asOf)} (${adh.days} วันที่จบแล้ว)"
    if (adh.sess != 0) rows += "เข้าฝึก" to "${adh.sessDone}/${adh.sess} วัน (${jsRound(adh.sessPct!! * 100).toLong()}%) — เกณฑ์ 75%"
    if (adh.cardio != 0) rows += "Cardio ตามแผน" to "${adh.cardioDone}/${adh.cardio} วัน · รวม ${ProgressGoal.jsNum(adh.cardioMin)} นาที"
    rows += "กรอกแคลอรี่" to "${adh.kcal.size}/${adh.days} วัน — เกณฑ์ 70%"
    adh.avgIn?.let { rows += "กินเฉลี่ย" to "${locR(it)} kcal/วัน (เป้า ${ProgressGoal.fmtKcal(tg.kcal)} ±10%) · อยู่ในช่วงเป้า ${adh.kcalOkDays} วัน" }
    ProgressGoal.mean(adh.prot)?.let { rows += "โปรตีนเฉลี่ย" to "${jsRound(it).toLong()} g (เป้า ${tg.proteinG} g)" }
    ProgressGoal.mean(adh.sleep)?.let { rows += "นอนเฉลี่ย" to "${Fmt.one(it)} ชม. (เป้า ${tg.sleepH?.let { s -> Fmt.one(s) + " ชม." } ?: "ยังไม่ได้ตั้งเป้า (Q37 ยังไม่ได้ตอบ)"})" }
    val ss = ProgressGoal.stressSummary(ev)
    rows += "ความเครียด" to (ss?.text?.replace(Regex("^ความเครียด(สูง|เพิ่มขึ้น)?: "), "")
        ?: "ยังไม่ได้บันทึก — บันทึกได้ที่หน้า “วันนี้” (ไม่บังคับ แต่ช่วยให้ระบบหาสาเหตุได้แม่นขึ้น)")
    rows += "ชั่งน้ำหนัก" to "${ev.wpts.size} ครั้ง" + (ev.reg?.let { " · แนวโน้ม ${ProgressGoal.rate(it.b * 7)} ± ${com.gymbrodaily.nativeapp.domain.jsToFixed(it.se * 7, 2)} กก./สัปดาห์" } ?: "")
    en.implied?.let {
        rows += "พลังงาน" to "ระบบคาด ${ProgressGoal.fmtKcal(jsRound(en.expected!!))} (TDEE ${ProgressGoal.fmtKcal(tg.tdee)} + ออกกำลังกาย ~${jsRound(en.exAct!!).toLong()}) · คำนวณจากข้อมูลจริง ${ProgressGoal.fmtKcal(jsRound(it))} ± ${jsRound(en.unc!!).toLong()} kcal/วัน"
    }
    rows.forEach { (k, v) -> TableRow(listOf(k, v)) }
    H4("คุณภาพข้อมูล")
    if (ev.issues.isNotEmpty()) Bullets(emptyList(), ev.issues) else Hint("ไม่พบจุดผิดสังเกต")
    if (ev.causes.isNotEmpty()) { H4("ปัจจัยที่อาจกระทบผล"); Bullets(ev.causes) }
    val adj = t.program.pg?.adjustments ?: emptyList()
    if (adj.isNotEmpty()) {
        H4("ประวัติการปรับเป้า")
        Bullets(adj.reversed().map {
            "${ProgressGoal.shortDateTH(it.date)}: แคลอรี่ ${ProgressGoal.fmtKcal(it.fromKcal)} → ${ProgressGoal.fmtKcal(it.toKcal)} kcal (TDEE ${ProgressGoal.fmtKcal(it.fromTdee)} → ${ProgressGoal.fmtKcal(it.toTdee)})"
        })
    }
    Hint(
        "วิธีประเมิน: หาแนวโน้มน้ำหนักจากการชั่งย้อนหลัง $PG_WINDOW วัน (เส้นตรงที่ fit ดีที่สุด + ค่าความคลาดเคลื่อน) แล้วเทียบกรอบ · ความแข็งแรงดู e1RM ย้อนหลัง $PG_STR_WINDOW วัน · " +
            "พลังงานที่ใช้จริง = กินเฉลี่ย − น้ำหนักที่เปลี่ยน × 7,700 kcal · การนอน โปรตีน ความเครียด และอาการบาดเจ็บ ใช้เป็นปัจจัยอธิบายผล ไม่ใช่ตัวตัดสินระดับ · ผลที่หลุดกรอบนับว่าผิดปกติเฉพาะตอนเข้าฝึก ≥ 75% และกินตามเป้า (กรอก ≥ 70% ของวัน เฉลี่ยอยู่ใน ±10%) · 3 สัปดาห์แรกของรอบ ยังไม่ตัดสินว่าผิดปกติกรณีน้ำหนักเปลี่ยนเร็วกว่ากรอบ และกรณีข้อมูลพลังงานไม่สอดคล้อง เพราะน้ำและไกลโคเจนทำให้น้ำหนักแกว่งแรง",
    )
}
