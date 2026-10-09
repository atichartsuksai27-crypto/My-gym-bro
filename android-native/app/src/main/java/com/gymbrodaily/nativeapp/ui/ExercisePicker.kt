package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.navigationBarsPadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.items
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ModalBottomSheet
import androidx.compose.material3.Text
import androidx.compose.material3.rememberModalBottomSheetState
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.domain.Exercise
import com.gymbrodaily.nativeapp.domain.LibraryCatalog

/* ============================================================
   เลือกท่าจากคลังทั้งหมดเข้าตาราง — ใช้ตอนเปลี่ยน/เพิ่มท่าในเซสชันของแผน
   แตะแถวเพื่อดูว่าท่าเหมาะกับใคร เสี่ยงแค่ไหน แล้วค่อยกด "เลือกท่านี้"
   ============================================================ */

/** ความเสี่ยงของท่า + เหมาะกับใคร + ข้อควรระวัง (injuries = อาการที่ผู้ใช้แจ้งไว้ในแบบสอบถาม) */
@Composable
fun GuideBlock(e: Exercise, injuries: List<String>) {
    val g = LibraryCatalog.guideFor(e)
    val cautions = LibraryCatalog.cautionsFor(e.id)
    val hit = cautions.filter { it in injuries }
    val riskColor = when (g.risk) { 0 -> GB.ok; 1 -> GB.branch; else -> GB.warn }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(20.dp)).background(GB.surface2).padding(16.dp),
        verticalArrangement = Arrangement.spacedBy(8.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            Pill(g.riskLabel, color = GB.bg, bg = riskColor)
            Text("ระดับ Tier ${e.tier}", color = GB.text3, fontSize = 12.sp)
        }
        if (g.why.isNotEmpty()) Text(g.why, fontSize = 13.5.sp, lineHeight = 19.sp, color = riskColor)
        Text("เหมาะกับใคร", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GB.text2)
        Text(g.suits, fontSize = 14.sp, lineHeight = 20.sp)
        Text("ข้อควรระวัง", fontWeight = FontWeight.Bold, fontSize = 13.sp, color = GB.text2)
        g.tips.forEach { Text("• $it", fontSize = 13.5.sp, lineHeight = 19.sp, color = GB.text) }
        if (cautions.isNotEmpty()) {
            Text("• ระวังถ้ามีอาการที่ ${cautions.joinToString(" · ")}", fontSize = 13.5.sp, lineHeight = 19.sp, color = GB.text)
        }
        if (hit.isNotEmpty()) {
            Text(
                "ตรงกับอาการที่คุณแจ้งไว้ (${hit.joinToString(" · ")}) — ไม่แนะนำให้เลือกท่านี้ ถ้าจะทำควรปรึกษาแพทย์หรือเทรนเนอร์ก่อน",
                color = GB.warn, fontWeight = FontWeight.SemiBold, fontSize = 13.5.sp, lineHeight = 19.sp,
                modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(GB.warnSoft).padding(12.dp),
            )
        }
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun ExercisePickerSheet(
    title: String,
    injuries: List<String>,
    inPlan: Set<String>,
    startGroup: String?,
    onPick: (Exercise) -> Unit,
    onDismiss: () -> Unit,
) {
    var query by rememberSaveable { mutableStateOf("") }
    var group by rememberSaveable { mutableStateOf(startGroup) }
    var equip by rememberSaveable { mutableStateOf<String?>(null) }
    var openId by rememberSaveable { mutableStateOf<String?>(null) }
    val filtered = LibraryCatalog.ALL.filter {
        it.matches(query) && (group == null || it.pattern == group) && (equip == null || it.equip == equip)
    }.sortedWith(compareBy({ LibraryCatalog.GROUP_ORDER.indexOf(it.pattern) }, { it.tier }))

    ModalBottomSheet(
        onDismissRequest = onDismiss,
        sheetState = rememberModalBottomSheetState(skipPartiallyExpanded = true),
        containerColor = GB.surface,
    ) {
        Column(Modifier.fillMaxSize().navigationBarsPadding(), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            Text(title, fontWeight = FontWeight.ExtraBold, fontSize = 20.sp, modifier = Modifier.padding(horizontal = 20.dp))
            Box(Modifier.padding(horizontal = 16.dp)) { SearchField(query) { query = it } }
            ChipRow {
                GbChip(group == null, { group = null }, { Text("ทั้งหมด") })
                LibraryCatalog.GROUP_ORDER.forEach { g ->
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
            if (filtered.isEmpty()) Text("ไม่พบท่าที่ตรงกับตัวกรอง", color = GB.text3, modifier = Modifier.padding(24.dp))
            LazyColumn(
                Modifier.weight(1f),
                contentPadding = PaddingValues(horizontal = 12.dp, vertical = 4.dp),
                verticalArrangement = Arrangement.spacedBy(6.dp),
            ) {
                items(filtered, key = { it.id }) { e ->
                    PickerRow(e, injuries, e.id in inPlan, open = openId == e.id,
                        onToggle = { openId = if (openId == e.id) null else e.id }, onPick = { onPick(e) })
                }
            }
        }
    }
}

@Composable
private fun PickerRow(e: Exercise, injuries: List<String>, inPlan: Boolean, open: Boolean, onToggle: () -> Unit, onPick: () -> Unit) {
    val g = LibraryCatalog.guideFor(e)
    val riskColor = when (g.risk) { 0 -> GB.ok; 1 -> GB.branch; else -> GB.warn }
    val hit = LibraryCatalog.cautionsFor(e.id).any { it in injuries }
    Column(
        Modifier.fillMaxWidth().clip(RoundedCornerShape(24.dp)).background(if (open) GB.surface2 else GB.bg)
            .clickable(onClick = onToggle).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            ShapeBadge(e, 44.dp)
            Spacer(Modifier.width(12.dp))
            Column(Modifier.weight(1f), verticalArrangement = Arrangement.spacedBy(3.dp)) {
                Text(e.th, fontWeight = FontWeight.Bold, fontSize = 15.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(e.sub, color = GB.text2, fontSize = 12.5.sp, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    Box(Modifier.size(8.dp).clip(CircleShape).background(riskColor))
                    Text(g.riskLabel, color = riskColor, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
                    Text("Tier ${e.tier} · ${EQUIP_LABEL[e.equip] ?: e.equip}", color = GB.text3, fontSize = 12.sp)
                    if (hit) Text("⚠ ตรงอาการ", color = GB.warn, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                    if (inPlan) Text("★ ในแผน", color = GB.branch, fontSize = 12.sp, fontWeight = FontWeight.Bold)
                }
            }
        }
        if (open) {
            GuideBlock(e, injuries)
            Button(
                onClick = onPick,
                modifier = Modifier.fillMaxWidth(),
                colors = ButtonDefaults.buttonColors(containerColor = GB.accent, contentColor = GB.accentInk),
            ) { Text("เลือกท่านี้", fontWeight = FontWeight.Bold) }
        }
    }
}
