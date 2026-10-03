package com.gymbrodaily.nativeapp.ui

import android.content.Context
import android.graphics.BitmapFactory
import androidx.compose.foundation.Image
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.clickable
import androidx.compose.foundation.gestures.detectHorizontalDragGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Slider
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableIntStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.produceState
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.graphics.ImageBitmap
import androidx.compose.ui.graphics.asImageBitmap
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.layout.ContentScale
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.compose.ui.window.Dialog
import androidx.compose.ui.window.DialogProperties
import com.gymbrodaily.nativeapp.domain.Questions
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.withContext
import kotlin.math.roundToInt

/* ตัวเลือกรูปร่าง/ระดับไขมันด้วยภาพ (Q0) + ภาพหมุน 360° — ใช้ไฟล์ชุดเดียวกับเว็บ (assets/bodyfat) */

private fun loadAsset(ctx: Context, path: String): ImageBitmap? =
    runCatching { ctx.assets.open(path).use { BitmapFactory.decodeStream(it)?.asImageBitmap() } }.getOrNull()

private fun folderFor(sex: String) = if (sex == "ชาย") "male" else "female"

@Composable
fun BodyFatPicker(sex: String?, selected: String?, onSelect: (String) -> Unit) {
    if (sex != "ชาย" && sex != "หญิง") {
        Hint("ตอบคำถาม \"เพศ\" ด้านบนก่อน ระบบจะเลือกภาพให้ตรงกับคุณ")
        return
    }
    var spinBand by remember { mutableStateOf<String?>(null) }
    val ctx = LocalContext.current
    val folder = folderFor(sex)
    Hint("แตะรูปร่างที่ใกล้เคียงกับคุณตอนนี้มากที่สุด ระบบจะแนะนำเป้าหมายเบื้องต้นให้ (เปลี่ยนภายหลังได้เสมอ ไม่ผูกมัด) — รูปร่างจริงอาจต่างกันแม้เปอร์เซ็นต์เท่ากัน ไม่ใช่เครื่องมือวัดที่แม่นยำ ข้ามข้อนี้ได้ถ้าไม่อยากตอบ")
    Questions.BODYFAT_BANDS.chunked(3).forEach { row ->
        Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            row.forEach { b ->
                val sel = selected == b.key
                val img by produceState<ImageBitmap?>(null, folder, b.key) {
                    value = withContext(Dispatchers.IO) { loadAsset(ctx, "bodyfat/bf-$folder-${b.key}.png") }
                }
                Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                    Column(
                        Modifier
                            .fillMaxWidth()
                            .clip(RoundedCornerShape(8.dp))
                            .background(if (sel) GB.accentSoft else GB.surface2)
                            .border(if (sel) 2.dp else 1.dp, if (sel) GB.accent else GB.border, RoundedCornerShape(8.dp))
                            .clickable { onSelect(b.key) }
                            .padding(4.dp),
                        horizontalAlignment = Alignment.CenterHorizontally,
                    ) {
                        Box(Modifier.fillMaxWidth().aspectRatio(0.6f), contentAlignment = Alignment.Center) {
                            img?.let { Image(it, b.pct, contentScale = ContentScale.Fit) }
                        }
                        Text(b.pct, fontSize = 12.5.sp, fontWeight = if (sel) FontWeight.SemiBold else FontWeight.Normal)
                    }
                    TextButton(onClick = { spinBand = b.key }) { Text("⟳ 360°", fontSize = 12.sp, color = GB.accent) }
                }
            }
        }
    }
    spinBand?.let { band -> SpinDialog(folder, sex, band) { spinBand = null } }
}

/** ภาพหมุนรอบตัว: ลากนิ้วซ้าย-ขวาเพื่อหมุน, เลื่อน slider หรือกดปุ่มทีละเฟรม — หมุนเองช่วงแรกจนกว่าจะแตะ */
@Composable
private fun SpinDialog(folder: String, sex: String, band: String, onClose: () -> Unit) {
    val ctx = LocalContext.current
    val n = Questions.BODYFAT_SPIN_FRAMES
    val frames by produceState<List<ImageBitmap?>?>(null, folder, band) {
        value = withContext(Dispatchers.IO) {
            (0 until n).map { i -> loadAsset(ctx, "bodyfat/spin/bf-$folder-$band-${i.toString().padStart(2, '0')}.webp") }
        }
    }
    var frame by remember { mutableIntStateOf(0) }
    var auto by remember { mutableStateOf(true) }
    fun show(f: Int) { frame = ((f % n) + n) % n }
    LaunchedEffect(frames, auto) {
        while (frames != null && auto) { delay(90); show(frame + 1) }
    }
    val pct = Questions.BODYFAT_BANDS.first { it.key == band }.pct

    Dialog(onDismissRequest = onClose, properties = DialogProperties(usePlatformDefaultWidth = false)) {
        Column(
            Modifier.fillMaxWidth().padding(16.dp).clip(CardShape).background(GB.surface).padding(16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.spacedBy(8.dp),
        ) {
            Row(verticalAlignment = Alignment.CenterVertically) {
                Text("ระดับไขมัน $pct ($sex)", fontWeight = FontWeight.SemiBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
                TextButton(onClick = onClose) { Text("✕", color = GB.text2) }
            }
            var dragAcc by remember { mutableStateOf(0f) }
            Box(
                Modifier
                    .fillMaxWidth()
                    .aspectRatio(420f / 720f)
                    .pointerInput(frames) {
                        detectHorizontalDragGestures(onDragStart = { auto = false; dragAcc = 0f }) { _, dx ->
                            dragAcc += dx
                            val step = 14.dp.toPx()
                            while (dragAcc >= step) { show(frame - 1); dragAcc -= step }
                            while (dragAcc <= -step) { show(frame + 1); dragAcc += step }
                        }
                    },
                contentAlignment = Alignment.Center,
            ) {
                val f = frames
                if (f == null) CircularProgressIndicator()
                else f[frame]?.let { Image(it, "มุม ${frame * 360 / n}°", Modifier.fillMaxWidth(), contentScale = ContentScale.Fit) }
            }
            Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(6.dp)) {
                OutlinedButton(onClick = { auto = false; show(frame - 1) }) { Text("‹") }
                Slider(
                    value = frame.toFloat(), onValueChange = { auto = false; show(it.roundToInt()) },
                    valueRange = 0f..(n - 1).toFloat(), modifier = Modifier.weight(1f),
                )
                OutlinedButton(onClick = { auto = false; show(frame + 1) }) { Text("›") }
            }
            Text("${frame * 360 / n}°", color = GB.text2, fontSize = 13.sp)
            Hint("ลากบนภาพเพื่อหมุนดูรอบตัว — เป็นภาพประกอบคร่าวๆ รูปร่างจริงอาจต่างกันแม้เปอร์เซ็นต์เท่ากัน")
        }
    }
}
