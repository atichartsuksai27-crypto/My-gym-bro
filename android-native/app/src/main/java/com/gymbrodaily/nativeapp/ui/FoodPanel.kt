package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.layout.*
import androidx.compose.material3.*
import androidx.compose.runtime.*
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.*

private fun macroLine(m: FoodEntry) = "โปรตีน ${Fmt.num(m.p)} g (${Fmt.num(jsRound(m.p * 4))} kcal) · คาร์บ ${Fmt.num(m.c)} g (${Fmt.num(jsRound(m.c * 4))} kcal) · ไขมัน ${Fmt.num(m.f)} g (${Fmt.num(jsRound(m.f * 9))} kcal) = ${Fmt.num(m.kcal)} kcal"

@Composable
fun FoodPanel(iso: String, cat: String, n: Nutrition, store: TrackStore) {
    val choices = remember(cat) { Foods.catalog.filter { it.cat == cat } }
    var open by rememberSaveable(iso, cat) { mutableStateOf(false) }
    var selected by rememberSaveable(iso, cat) { mutableStateOf(choices.first().id) }
    var grams by rememberSaveable(iso, cat) { mutableStateOf<Double?>(null) }
    var error by rememberSaveable(iso, cat) { mutableStateOf(false) }
    var menu by remember { mutableStateOf(false) }
    val food = choices.first { it.id == selected }
    val label = when (cat) { "protein" -> "แหล่งโปรตีน"; "carb" -> "แหล่งคาร์โบไฮเดรต"; else -> "แหล่งไขมัน" }
    LinkButton(if (open) "ซ่อนช่องเพิ่มอาหาร ▴" else "+ เพิ่มอาหาร ($label) ▾") { open = !open }
    if (open) {
        Box {
            OutlinedButton(onClick = { menu = true }, modifier = Modifier.fillMaxWidth()) { Text("${food.name} ▾") }
            DropdownMenu(expanded = menu, onDismissRequest = { menu = false }) {
                choices.forEach { choice ->
                    DropdownMenuItem(text = { Text(choice.name) }, onClick = { selected = choice.id; menu = false })
                }
            }
        }
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            NumberField(grams, { _, v -> grams = v; error = false }, "กรัม", Modifier.weight(1f), isError = error)
            Button(onClick = {
                val g = grams
                if (g == null || !g.isFinite() || g !in 1.0..3000.0) error = true
                else {
                    store.updateLog(iso) { it.copy(nutrition = Foods.add(it.nutrition, food, g)) }
                    grams = null
                    error = false
                }
            }) { Text("เพิ่ม") }
        }
        val g = grams?.takeIf { it.isFinite() && it in 1.0..3000.0 }
        val preview = Foods.entry(food, g ?: 100.0)
        Hint((if (g == null) "ต่อ 100 g: " else "${Fmt.num(g)} g → ") + macroLine(preview) + if (g == null && food.unit != null) " · ${food.unit}" else "")
        if (error) Hint("กรอกน้ำหนักอาหารเป็นกรัม (1–3000)", color = GB.warn)
        Hint("อาหารที่เพิ่มจะบวกโปรตีน/คาร์บ/ไขมัน/แคลอรี่เข้ายอดรวมของวันให้อัตโนมัติ — ค่าประมาณต่อ 100 g จาก USDA")
    }
    n.foods.forEachIndexed { index, entry ->
        if (entry.cat == cat) {
            Row(Modifier.fillMaxWidth()) {
                Column(Modifier.weight(1f)) {
                    Text("${entry.name} ${Fmt.num(entry.g)} g")
                    Hint(macroLine(entry))
                }
                TextButton(onClick = { store.updateLog(iso) { it.copy(nutrition = Foods.remove(it.nutrition, index)) } }) {
                    Text("ลบ")
                }
            }
        }
    }
}
