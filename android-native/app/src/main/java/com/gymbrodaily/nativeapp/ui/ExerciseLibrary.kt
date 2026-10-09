package com.gymbrodaily.nativeapp.ui

import androidx.activity.compose.PredictiveBackHandler
import androidx.compose.foundation.ExperimentalFoundationApi
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.horizontalScroll
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.lazy.rememberLazyListState
import androidx.compose.runtime.rememberCoroutineScope
import kotlinx.coroutines.launch
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.LargeTopAppBar
import androidx.compose.material3.MaterialShapes
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.material3.toShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableFloatStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Shape
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.nestedscroll.nestedScroll
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.domain.Catalog
import com.gymbrodaily.nativeapp.domain.Exercise
import com.gymbrodaily.nativeapp.domain.LibraryCatalog
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import kotlin.coroutines.cancellation.CancellationException

/* ============================================================
   คลังท่าออกกำลังกาย — รวมท่าใน LibraryCatalog.ALL และท่าเสริมเฉพาะคลังจาก LibraryCatalog
   ค้นหา / กรองตามกลุ่มกล้ามเนื้อ อุปกรณ์ และท่าที่อยู่ในแผน แตะเพื่อดูรายละเอียดใน bottom sheet
   ============================================================ */

private val GROUP_ORDER = LibraryCatalog.GROUP_ORDER

internal val EQUIP_LABEL = linkedMapOf(
    "bodyweight" to "น้ำหนักตัว", "dumbbell" to "ดัมเบล", "barbell" to "บาร์เบล", "machine" to "เครื่อง",
    "cable" to "เคเบิล", "pullupbar" to "บาร์โหน", "stepper" to "สเต็ปเปอร์", "yogaball" to "ลูกบอลโยคะ",
    "abroller" to "ล้อโรลหน้าท้อง", "kettlebell" to "เคตเทิลเบลล์",
)

private val GROUP_COLOR = mapOf(
    "squat" to GB.accent, "hinge" to GB.branch, "hpush" to GB.pink, "hpull" to GB.food, "vpull" to GB.sleep,
    "vpush" to Color(0xFFFFB27A), "core" to GB.ok, "biceps" to Color(0xFF8FD3FF), "triceps" to Color(0xFFFF9EA8),
    "delts" to Color(0xFFC7E86B), "calves" to Color(0xFFFFC2A0), "cardio" to Color(0xFFFF7A7A),
)

private object Ic {
    const val BACK = "M15 5l-7 7 7 7"
    const val SEARCH = "M4 11a7 7 0 1 0 14 0a7 7 0 1 0 -14 0 M16 16l4 4"
    const val CLEAR = "M7 7l10 10M17 7L7 17"
    const val CHEVRON = "M9 6l6 6-6 6"
}

internal fun groupColor(p: String) = GROUP_COLOR[p] ?: GB.accent

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
private fun groupShape(p: String): Shape {
    // รูปทรง Expressive ประจำกลุ่มกล้ามเนื้อ (MaterialShapes อ่านได้เฉพาะใน composable)
    val poly = when (p) {
        "squat" -> MaterialShapes.Cookie9Sided
        "hinge" -> MaterialShapes.Arch
        "hpush" -> MaterialShapes.Pentagon
        "hpull" -> MaterialShapes.Clover4Leaf
        "vpull" -> MaterialShapes.Gem
        "vpush" -> MaterialShapes.Sunny
        "core" -> MaterialShapes.Cookie6Sided
        "biceps" -> MaterialShapes.Pill
        "triceps" -> MaterialShapes.SoftBurst
        "delts" -> MaterialShapes.Flower
        "calves" -> MaterialShapes.Oval
        "cardio" -> MaterialShapes.Heart
        else -> MaterialShapes.Circle
    }
    return poly.toShape()
}

internal fun Exercise.matches(q: String): Boolean {
    if (q.isBlank()) return true
    val needle = q.trim().lowercase()
    return listOf(th, sub, LibraryCatalog.GROUP_LABEL[pattern].orEmpty(), EQUIP_LABEL[equip].orEmpty())
        .any { it.lowercase().contains(needle) }
}

/** id ของท่า → ชื่อเซสชันในแผนปัจจุบันที่มีท่านี้ */
private fun planSessions(t: TrackData?): Map<String, List<String>> {
    val out = mutableMapOf<String, MutableList<String>>()
    t?.program?.sessions?.forEach { s -> s.exercises.forEach { out.getOrPut(it.id) { mutableListOf() } += s.key } }
    return out
}

@OptIn(ExperimentalMaterial3Api::class, ExperimentalFoundationApi::class)
@Composable
fun ExerciseLibraryScreen(data: TrackData?, onBack: () -> Unit) {
    var query by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf<String?>(null) }
    var equip by rememberSaveable { mutableStateOf<String?>(null) }
    var onlyMine by rememberSaveable { mutableStateOf(false) }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    var backProgress by remember { mutableFloatStateOf(0f) }
    // รูปร่างเริ่มต้นตามเพศที่ตอบในแบบสอบถาม สลับเองได้
    var female by rememberSaveable { mutableStateOf(data?.answers?.str("Q9") == "หญิง") }
    val listState = rememberLazyListState()
    val scope = rememberCoroutineScope()

    val mine = remember(data) { planSessions(data) }
    val filtered = LibraryCatalog.ALL.filter {
        it.matches(query) && (group == null || it.pattern == group) && (equip == null || it.equip == equip) &&
            (!onlyMine || it.id in mine)
    }
    val grouped = GROUP_ORDER.mapNotNull { g -> filtered.filter { it.pattern == g }.sortedBy { it.tier }.takeIf { it.isNotEmpty() }?.let { g to it } }

    // ปัดย้อนกลับแบบ predictive: หน้าย่อตามนิ้วก่อนปิดจริง
    PredictiveBackHandler(enabled = openId == null) { events ->
        try {
            events.collect { backProgress = it.progress }
            onBack()
        } catch (e: CancellationException) {
            backProgress = 0f
            throw e
        }
    }

    val scroll = TopAppBarDefaults.exitUntilCollapsedScrollBehavior()
    Scaffold(
        modifier = Modifier
            .graphicsLayer {
                val s = 1f - 0.1f * backProgress
                scaleX = s; scaleY = s
                translationX = 24.dp.toPx() * backProgress
                shape = RoundedCornerShape(32.dp * backProgress)
                clip = backProgress > 0f
            }
            .nestedScroll(scroll.nestedScrollConnection),
        containerColor = GB.bg,
        topBar = {
            LargeTopAppBar(
                title = { Text("คลังท่าออกกำลังกาย", fontWeight = FontWeight.ExtraBold, maxLines = 1, overflow = TextOverflow.Ellipsis) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(strokeIcon(Ic.BACK), contentDescription = "ย้อนกลับ") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GB.bg, scrolledContainerColor = GB.surface),
                scrollBehavior = scroll,
            )
        },
    ) { inner ->
        LazyColumn(
            Modifier.fillMaxSize(),
            state = listState,
            contentPadding = PaddingValues(top = inner.calculateTopPadding(), bottom = inner.calculateBottomPadding() + 24.dp),
        ) {
            item(key = "search") {
                Column(Modifier.padding(horizontal = 16.dp), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("${LibraryCatalog.ALL.size} ท่า · ${GROUP_ORDER.size} กลุ่มกล้ามเนื้อ · 4 ระดับความยาก", color = GB.text3, fontSize = 13.sp)
                    SearchField(query) { query = it }
                }
            }
            item(key = "bodymap") {
                Column(
                    Modifier.padding(start = 16.dp, end = 16.dp, top = 12.dp).clip(RoundedCornerShape(28.dp))
                        .background(GB.surface).padding(vertical = 16.dp, horizontal = 24.dp),
                    horizontalAlignment = Alignment.CenterHorizontally,
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                        GbChip(!female, { female = false }, { Text("ชาย") })
                        GbChip(female, { female = true }, { Text("หญิง") })
                    }
                    Text(
                        group?.let { "${LibraryCatalog.GROUP_LABEL[it] ?: it} · ${LibraryCatalog.ALL.count { e -> e.pattern == it }} ท่า" }
                            ?: "แตะกล้ามเนื้อเพื่อดูท่าของมัดนั้น",
                        color = group?.let { groupColor(it) } ?: GB.text2, fontWeight = FontWeight.Bold, fontSize = 14.sp,
                    )
                    BodyMap(group, female, onSelect = { g ->
                        val picking = group != g
                        group = if (picking) g else null
                        onlyMine = false
                        // เด้งลงไปที่รายการท่าของมัดที่แตะ (index 2 = แถวตัวกรอง ตามด้วยรายการ)
                        if (picking) scope.launch { listState.animateScrollToItem(2) }
                    }, Modifier.fillMaxWidth())
                }
            }
            item(key = "filters") {
                Column(Modifier.padding(top = 12.dp, bottom = 4.dp), verticalArrangement = Arrangement.spacedBy(4.dp)) {
                    ChipRow {
                        GbChip(group == null && !onlyMine, { group = null; onlyMine = false }, { Text("ทั้งหมด") })
                        if (mine.isNotEmpty()) GbChip(onlyMine, { onlyMine = !onlyMine }, { Text("★ ในแผนของฉัน") })
                        GROUP_ORDER.forEach { g ->
                            GbChip(group == g, { group = if (group == g) null else g }, {
                                Row(verticalAlignment = Alignment.CenterVertically) {
                                    Box(Modifier.size(8.dp).clip(CircleShape).background(groupColor(g)))
                                    Spacer(Modifier.width(6.dp))
                                    Text(LibraryCatalog.GROUP_SHORT[g] ?: g)
                                }
                            })
                        }
                    }
                    ChipRow {
                        EQUIP_LABEL.forEach { (k, label) ->
                            GbChip(equip == k, { equip = if (equip == k) null else k }, { Text(label, fontSize = 12.5.sp) })
                        }
                    }
                }
            }
            if (grouped.isEmpty()) item(key = "empty") {
                Column(Modifier.fillMaxWidth().padding(48.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                    Text("ไม่พบท่าที่ตรงกับตัวกรอง", fontWeight = FontWeight.Bold, fontSize = 17.sp)
                    LinkButton("ล้างตัวกรองทั้งหมด") { query = ""; group = null; equip = null; onlyMine = false }
                }
            }
            grouped.forEach { (g, list) ->
                stickyHeader(key = "h-$g") { GroupHeader(g, list.size) }
                items(list, key = { it.id }) { e ->
                    ExerciseRow(e, inPlan = e.id in mine, modifier = Modifier.animateItem()) { openId = e.id }
                }
            }
        }
    }

    openId?.let { id ->
        val sheet = rememberModalBottomSheetState(skipPartiallyExpanded = true)
        ModalBottomSheet(onDismissRequest = { openId = null }, sheetState = sheet, containerColor = GB.surface) {
            ExerciseDetail(id, data, mine) { openId = it }
        }
    }
}

@Composable
internal fun ChipRow(content: @Composable () -> Unit) {
    Row(
        Modifier.fillMaxWidth().horizontalScroll(rememberScrollState()).padding(horizontal = 16.dp),
        horizontalArrangement = Arrangement.spacedBy(8.dp),
    ) { content() }
}

@Composable
internal fun SearchField(value: String, onChange: (String) -> Unit) {
    Row(
        Modifier.fillMaxWidth().height(56.dp).clip(CircleShape).background(GB.surface2).padding(horizontal = 18.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(strokeIcon(Ic.SEARCH), contentDescription = null, tint = GB.text2)
        Spacer(Modifier.width(12.dp))
        Box(Modifier.weight(1f)) {
            if (value.isEmpty()) Text("ค้นหาท่า กลุ่มกล้ามเนื้อ หรืออุปกรณ์", color = GB.text3, fontSize = 15.sp)
            BasicTextField(
                value, onChange, singleLine = true,
                textStyle = MaterialTheme.typography.bodyLarge.copy(color = GB.text),
                cursorBrush = SolidColor(GB.accent),
                modifier = Modifier.fillMaxWidth(),
            )
        }
        if (value.isNotEmpty()) IconButton(onClick = { onChange("") }) {
            Icon(strokeIcon(Ic.CLEAR), contentDescription = "ล้าง", tint = GB.text2)
        }
    }
}

@Composable
private fun GroupHeader(g: String, count: Int) {
    Row(
        Modifier.fillMaxWidth().background(GB.bg).padding(start = 20.dp, end = 20.dp, top = 14.dp, bottom = 8.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Text(LibraryCatalog.GROUP_LABEL[g] ?: g, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = groupColor(g), modifier = Modifier.weight(1f))
        Text("$count", color = GB.text3, fontSize = 13.sp)
    }
}

@Composable
internal fun ShapeBadge(e: Exercise, size: Dp) {
    Box(
        Modifier.size(size).clip(groupShape(e.pattern)).background(groupColor(e.pattern)),
        contentAlignment = Alignment.Center,
    ) {
        Text("${e.tier}", color = GB.bg, fontWeight = FontWeight.ExtraBold, fontSize = (size.value * 0.36f).sp)
    }
}

@Composable
internal fun TierMeter(tier: Int, color: Color, modifier: Modifier = Modifier, height: Dp = 4.dp) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(3.dp)) {
        (1..4).forEach { i ->
            Box(Modifier.weight(1f).height(height).clip(CircleShape).background(if (i <= tier) color else GB.surface2))
        }
    }
}

@Composable
private fun ExerciseRow(e: Exercise, inPlan: Boolean, modifier: Modifier = Modifier, onClick: () -> Unit) {
    Row(
        modifier
            .fillMaxWidth()
            .padding(horizontal = 12.dp, vertical = 3.dp)
            .clip(RoundedCornerShape(24.dp))
            .background(GB.surface)
            .clickable(onClick = onClick)
            .padding(12.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        ShapeBadge(e, 52.dp)
        Spacer(Modifier.width(14.dp))
        Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
            Text(e.th, fontWeight = FontWeight.Bold, fontSize = 15.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(e.sub, color = GB.text2, fontSize = 13.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                TierMeter(e.tier, groupColor(e.pattern), Modifier.width(48.dp))
                Text(EQUIP_LABEL[e.equip] ?: e.equip, color = GB.text3, fontSize = 12.sp)
                if (inPlan) Text("★ ในแผน", color = GB.branch, fontSize = 12.sp, fontWeight = FontWeight.Bold)
            }
        }
        Icon(strokeIcon(Ic.CHEVRON), contentDescription = null, tint = GB.text4, modifier = Modifier.size(20.dp))
    }
}

@Composable
private fun ExerciseDetail(id: String, data: TrackData?, mine: Map<String, List<String>>, onOpen: (String) -> Unit) {
    val e = LibraryCatalog.ALL.firstOrNull { it.id == id } ?: return
    val color = groupColor(e.pattern)
    val siblings = LibraryCatalog.ALL.filter { it.pattern == e.pattern }.sortedBy { it.tier }
    val hist = data?.let { Tracking.exerciseHistory(it, id) }.orEmpty()

    Column(
        Modifier.fillMaxWidth().verticalScroll(rememberScrollState()).padding(horizontal = 20.dp).navigationBarsPadding()
            .padding(bottom = 24.dp),
        verticalArrangement = Arrangement.spacedBy(16.dp),
    ) {
        Column(Modifier.fillMaxWidth(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.spacedBy(8.dp)) {
            ShapeBadge(e, 96.dp)
            Text(e.th, fontWeight = FontWeight.ExtraBold, fontSize = 24.sp, lineHeight = 30.sp)
            Text(e.sub, color = GB.text2, fontSize = 14.sp, lineHeight = 20.sp)
            Row(Modifier.horizontalScroll(rememberScrollState()), horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                Pill(LibraryCatalog.GROUP_SHORT[e.pattern] ?: e.pattern, color = GB.bg, bg = color)
                Pill(EQUIP_LABEL[e.equip] ?: e.equip)
                if (LibraryCatalog.isLibraryOnly(id)) Pill("เฉพาะคลัง")
                mine[id]?.let { Pill("★ " + it.distinct().joinToString(" · "), GB.branch, GB.branchSoft) }
            }
        }

        DetailBlock("ระดับความยาก") {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("Tier ${e.tier}", fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, color = color)
                Spacer(Modifier.width(10.dp))
                Text(Catalog.TIER_LABEL[e.tier].orEmpty(), fontWeight = FontWeight.Bold)
            }
            TierMeter(e.tier, color, Modifier.fillMaxWidth(), height = 8.dp)
            Hint(Catalog.TIER_DESC[e.tier].orEmpty(), color = GB.text2)
        }

        GuideBlock(e, data?.answers?.list("Q26").orEmpty())

        if (hist.isNotEmpty()) DetailBlock("สถิติของคุณ") {
            val best = hist.maxBy { it.e1rm }
            val last = hist.last()
            Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                StatTile("บันทึกแล้ว", "${hist.size} วัน", modifier = Modifier.weight(1f))
                StatTile("e1RM สูงสุด", "${Fmt.one(best.e1rm)} kg", Fmt.shortDate(best.date), Modifier.weight(1f), valueColor = color)
            }
            Hint("ล่าสุด ${Fmt.shortDate(last.date)} · ${Fmt.one(last.weight)} kg" + (last.reps?.let { " × ${Fmt.num(it)}" } ?: ""), color = GB.text2)
        }

        DetailBlock("ท่าในกลุ่มเดียวกัน (ง่าย → ยาก)") {
            siblings.forEach { s ->
                val cur = s.id == id
                Row(
                    Modifier.fillMaxWidth().clip(RoundedCornerShape(16.dp))
                        .background(if (cur) GB.accentSoft else GB.surface2)
                        .clickable(enabled = !cur) { onOpen(s.id) }
                        .padding(10.dp),
                    verticalAlignment = Alignment.CenterVertically,
                ) {
                    ShapeBadge(s, 36.dp)
                    Spacer(Modifier.width(12.dp))
                    Column(Modifier.weight(1f)) {
                        Text(s.th, fontWeight = if (cur) FontWeight.ExtraBold else FontWeight.SemiBold, fontSize = 14.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                        Text(EQUIP_LABEL[s.equip] ?: s.equip, color = GB.text3, fontSize = 12.sp)
                    }
                    if (s.id in mine) Text("★", color = GB.branch)
                }
            }
        }

        Hint("ℹ️ ปรึกษาเทรนเนอร์ก่อนทำจริง เพื่อฟอร์มที่ถูกต้องเป๊ะรายท่า")
    }
}

@Composable
private fun DetailBlock(title: String, content: @Composable () -> Unit) {
    Column(verticalArrangement = Arrangement.spacedBy(8.dp)) {
        Text(title, fontWeight = FontWeight.Bold, fontSize = 15.sp, color = GB.text2)
        content()
    }
}
