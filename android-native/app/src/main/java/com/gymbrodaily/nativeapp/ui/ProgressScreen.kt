package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.ExperimentalLayoutApi
import androidx.compose.foundation.layout.FlowRow
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.domain.Benchmarks
import com.gymbrodaily.nativeapp.domain.E1rmEntry
import com.gymbrodaily.nativeapp.domain.HistoryEntry
import com.gymbrodaily.nativeapp.domain.PlanExercise
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import com.gymbrodaily.nativeapp.domain.jsRound
import java.time.LocalDate
import java.time.temporal.ChronoUnit
import kotlin.math.abs
import kotlin.math.max

@Composable
fun ProgressScreen(t: TrackData, today: LocalDate) {
    val p = t.program
    val tg = Tracking.targetsOf(t)
    val series = Tracking.weightSeries(t)
    val first = series.firstOrNull()
    val last = series.lastOrNull()
    val startW = first?.kg ?: p.startWeight
    val since = p.startDate?.let { max(0L, ChronoUnit.DAYS.between(LocalDate.parse(it), today)) }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            p.startDate?.let { "ตั้งแต่ ${Fmt.shortDate(it)} · $since วัน" }, "ความคืบหน้า",
            "ทุกตัวเลขในหน้านี้คำนวณจากสิ่งที่คุณบันทึกไว้จริงเท่านั้น — ช่องไหนยังว่างแปลว่ายังไม่มีข้อมูลพอ",
        )

        Card {
            val deltaFirst = if (last != null && startW != null) last.kg - startW else null
            val remain = if (last != null && tg.goalWeight != null) last.kg - tg.goalWeight else null
            TileGrid(
                listOf(
                    Triple("น้ำหนักล่าสุด", last?.let { "${Fmt.one(it.kg)} กก." } ?: "—", last?.let { Fmt.shortDate(it.date) } ?: "ยังไม่ได้บันทึก"),
                    Triple(
                        "เทียบวันแรกที่ชั่ง",
                        deltaFirst?.let { (if (it > 0) "+" else "") + Fmt.one(it) + " กก." } ?: "—",
                        startW?.let { "วันแรก ${Fmt.one(it)} กก." + (first?.let { f -> " (${Fmt.shortDate(f.date)})" } ?: " (จากแบบสอบถาม)") } ?: "ยังไม่มีค่าเริ่มต้น",
                    ),
                    Triple("เหลือถึงเป้า", remain?.let { "${Fmt.one(abs(it))} กก." } ?: "—", tg.goalWeight?.let { "เป้า ${Fmt.one(it)} กก." } ?: "ยังไม่ได้ตั้งเป้าตัวเลข"),
                    Triple("จำนวนครั้งที่ชั่ง", series.size.toString(), "ยิ่งชั่งสม่ำเสมอ เส้นแนวโน้มยิ่งเชื่อถือได้"),
                ),
            )
            if (series.size >= 2) {
                val d0 = LocalDate.parse(series[0].date)
                LineChart(
                    series.map { ChartPoint(ChronoUnit.DAYS.between(d0, LocalDate.parse(it.date)).toFloat(), it.kg, Fmt.shortDate(it.date)) },
                    goal = tg.goalWeight, base = startW,
                )
                Hint("เส้นทึบ = น้ำหนักที่บันทึกจริง · เส้นประเทา = น้ำหนักวันแรกที่ชั่ง · เส้นประส้ม = เป้าหมาย")
            } else {
                Hint("ต้องชั่งอย่างน้อย 2 วันจึงจะวาดเส้นแนวโน้มได้ — บันทึกน้ำหนักได้ที่หน้า “วันนี้”")
            }
        }

        SectionTitle("ทำตามแผนได้กี่ % ต่อสัปดาห์")
        Card { AdherenceBars(t, today) }

        SectionTitle("Progression การยกน้ำหนักรายท่า")
        Card { ExerciseProgress(t) }

        SectionTitle("Milestone")
        Card {
            Tracking.milestones(t, today).forEach { m ->
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Text(if (m.on) "✓" else "·", color = if (m.on) GB.ok else GB.text4, fontSize = 18.sp, modifier = Modifier.width(26.dp))
                    Column(Modifier.weight(1f)) {
                        Text(m.title, color = if (m.on) GB.text else GB.text2)
                        Text(if (m.on) "ปลดล็อกแล้ว" else m.sub, color = GB.text3, fontSize = 12.sp)
                    }
                }
            }
            Hint("เงื่อนไขทุกข้อผูกกับข้อมูลจริงในระบบ ไม่มีการปลดล็อกให้ล่วงหน้า")
        }
    }
}

@Composable
fun SectionTitle(text: String) = Text(text, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.padding(top = 4.dp))

@Composable
fun TileGrid(tiles: List<Triple<String, String, String?>>) {
    tiles.chunked(2).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { (l, v, d) -> StatTile(l, v, d, Modifier.weight(1f)) }
            if (row.size == 1) Box(Modifier.weight(1f))
        }
    }
}

@Composable
private fun AdherenceBars(t: TrackData, today: LocalDate) {
    val adh = Tracking.weeklyAdherence(t, 8, today).filter { it.planned > 0 }
    if (adh.isEmpty()) {
        Hint("ยังไม่มีวันฝึกที่ผ่านมาให้คำนวณ — ตัวเลขจะขึ้นหลังผ่านวันฝึกวันแรก")
        return
    }
    val avg = jsRound(adh.sumOf { it.pct ?: 0 }.toDouble() / adh.size).toInt()
    Row {
        Text("ค่าเฉลี่ย ${adh.size} สัปดาห์ที่ผ่านมา", color = GB.text2, modifier = Modifier.weight(1f))
        Text("$avg%", fontWeight = FontWeight.SemiBold)
    }
    Row(Modifier.fillMaxWidth().height(150.dp), horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.Bottom) {
        adh.forEach { w ->
            val pct = w.pct ?: 0
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Text("$pct%", fontSize = 10.sp, color = GB.text2)
                Box(
                    Modifier.fillMaxWidth().height((max(3, pct) * 1.05).dp)
                        .clip(RoundedCornerShape(topStart = 3.dp, topEnd = 3.dp))
                        .background(if (pct >= 80) GB.ok else GB.accent),
                )
                Text(Fmt.shortDate(w.start), fontSize = 9.sp, color = GB.text3, maxLines = 1)
            }
        }
    }
    Hint("นับจากวันฝึกที่ติ๊ก “ทำเซสชันนี้ครบแล้ว” หารด้วยวันฝึกทั้งหมดในสัปดาห์นั้น (ไม่รวมวันในอนาคต)")
}

@OptIn(ExperimentalLayoutApi::class)
@Composable
private fun ExerciseProgress(t: TrackData) {
    val allEx = t.program.sessions.flatMap { it.exercises }.distinctBy { it.id }
    if (allEx.isEmpty()) { Hint("แผนนี้ยังไม่มีท่าให้ติดตาม"); return }
    var picked by rememberSaveable { mutableStateOf(allEx.first().id) }
    val cur = allEx.firstOrNull { it.id == picked } ?: allEx.first()
    FlowRow(horizontalArrangement = Arrangement.spacedBy(6.dp)) {
        allEx.forEach { e -> GbChip(selected = e.id == cur.id, onClick = { picked = e.id }, label = { Text(e.th, fontSize = 12.sp) }) }
    }
    val hist = Tracking.exerciseHistory(t, cur.id)
    StrengthSummary(t, cur, hist)
    when {
        hist.size >= 2 -> {
            val d0 = LocalDate.parse(hist[0].date)
            LineChart(
                hist.map { ChartPoint(ChronoUnit.DAYS.between(d0, LocalDate.parse(it.date)).toFloat(), it.e1rm, Fmt.shortDate(it.date)) },
                height = 180.dp, yFormat = { "${jsRound(it).toInt()} กก." },
            )
            val delta = hist.last().e1rm - hist.first().e1rm
            Hint("แกนตั้ง = ความแข็งแรงโดยประมาณ (e1RM สูตร Epley) จากเซ็ตที่ดีที่สุดของแต่ละวัน — เปลี่ยนแปลง ${if (delta >= 0) "+" else ""}${Fmt.one(delta)} กก. จากครั้งแรกที่บันทึก")
        }
        hist.size == 1 -> Hint("มีข้อมูลวันเดียว (${Fmt.shortDate(hist[0].date)} — ${Fmt.num(hist[0].weight)} กก. × ${hist[0].reps?.let { Fmt.num(it) } ?: "?"} ครั้ง) ต้องบันทึกอย่างน้อย 2 วันจึงจะเห็นแนวโน้ม")
        else -> Hint("ยังไม่มีบันทึกน้ำหนักต่อเซ็ตของท่านี้ — เปิด “บันทึกน้ำหนัก/ครั้งต่อเซ็ต” ในหน้าวันนี้เพื่อเริ่มเก็บข้อมูล")
    }
    if (hist.isNotEmpty()) {
        Column(verticalArrangement = Arrangement.spacedBy(4.dp)) {
            TableRow("วันที่", "เซ็ตที่ดีที่สุด", "e1RM", "ปริมาตรรวม", header = true)
            hist.takeLast(8).reversed().forEach { h ->
                TableRow(
                    Fmt.shortDate(h.date),
                    "${Fmt.num(h.weight)} กก." + (h.reps?.let { " × ${Fmt.num(it)}" } ?: ""),
                    "${Fmt.one(h.e1rm)} กก.",
                    "${String.format(java.util.Locale.US, "%,d", h.volume)} กก.",
                )
            }
        }
    }
}

@Composable
private fun TableRow(a: String, b: String, c: String, d: String, header: Boolean = false) {
    val color = if (header) GB.text3 else GB.text
    val size = if (header) 11.5.sp else 12.5.sp
    Row(Modifier.fillMaxWidth()) {
        Text(a, color = color, fontSize = size, modifier = Modifier.weight(0.9f))
        Text(b, color = color, fontSize = size, modifier = Modifier.weight(1.3f))
        Text(c, color = color, fontSize = size, modifier = Modifier.weight(0.9f))
        Text(d, color = color, fontSize = size, modifier = Modifier.weight(1f))
    }
}

/** ตรงกับ strengthSummaryHTML ของเว็บ — ทุกค่ามาจาก Benchmarks/Tracking ไม่คำนวณซ้ำเอง */
@Composable
private fun StrengthSummary(t: TrackData, ex: PlanExercise, hist: List<HistoryEntry>) {
    if (hist.isEmpty()) return
    val a = t.answers
    val latest = hist.last()
    val prev = hist.getOrNull(hist.size - 2)
    val pb = hist.maxBy { it.e1rm }
    val bw = Tracking.bodyweightAsOf(t, latest.date)
    val rel = Benchmarks.calculateRelativeStrength(latest.e1rm, bw)
    val perf = Benchmarks.getPerformanceLevel(latest.e1rm, ex.id, a.str("Q9"), bw, a.str("Q16"))
    val progress = if (prev != null) Benchmarks.calculatePersonalProgress(latest.e1rm, hist.dropLast(1).map { E1rmEntry(it.date, it.e1rm) }) else null
    TileGrid(
        listOf(
            Triple("Estimated 1RM ล่าสุด", "${Fmt.one(latest.e1rm)} กก.", "${Fmt.shortDate(latest.date)} · ${Fmt.num(latest.weight)} กก. × ${latest.reps?.let { Fmt.num(it) } ?: "?"} ครั้ง"),
            Triple("Personal Best (e1RM)", "${Fmt.one(pb.e1rm)} กก.", Fmt.shortDate(pb.date) + if (pb.date == latest.date) " · ล่าสุดคือสถิติสูงสุด" else ""),
            Triple(
                "ครั้งก่อนหน้า", prev?.let { "${Fmt.one(it.e1rm)} กก." } ?: "—",
                progress?.let { (if (it.direction == "up") "+" else "") + Fmt.one(it.deltaPct) + "% Personal Progress" } ?: "ต้องมีอย่างน้อย 2 วันจึงเทียบได้",
            ),
            Triple(
                "Benchmark", "${perf.level.icon} ${perf.level.label}",
                perf.benchmark?.let { "มาตรฐาน ${Fmt.one(it.benchmarkValueKg)} กก. · ${it.sourceName}" } ?: "เทียบกับกลุ่มอ้างอิง — คนละเรื่องกับ Personal Progress",
            ),
            Triple(
                "Relative Strength", rel?.let { Fmt.num(jsRound(it * 100) / 100) + "× น้ำหนักตัว" } ?: "—",
                bw?.let { "น้ำหนักตัว ${Fmt.one(it)} กก." } ?: "ยังไม่มีข้อมูลน้ำหนักตัว",
            ),
        ),
    )
    Hint("ตัวเลขทั้งหมดเป็น ประมาณการ 1RM (Estimated 1RM) จากน้ำหนัก × ครั้งที่บันทึกไว้ ไม่ใช่ 1RM ที่ยกได้จริง — Benchmark เป็นข้อมูลเปรียบเทียบกับกลุ่มอ้างอิงเท่านั้น ไม่ใช่เป้าที่ต้องไปให้ถึง")
}
