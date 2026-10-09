package com.gymbrodaily.nativeapp.ui

import androidx.compose.animation.core.animateFloatAsState
import androidx.compose.animation.core.spring
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.gestures.detectTapGestures
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.aspectRatio
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.asAndroidPath
import androidx.compose.ui.graphics.asComposePath
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.withTransform
import androidx.compose.ui.graphics.lerp
import androidx.compose.ui.graphics.vector.PathParser
import androidx.compose.ui.input.pointer.pointerInput
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.domain.LibraryCatalog
import kotlin.math.min

/* ============================================================
   แผนที่กล้ามเนื้อ ชาย/หญิง ด้านหน้า/ด้านหลัง — รูปทรงมาจาก BodyMapData (สร้างจาก tools/bodymap)
   แตะมัดกล้ามเนื้อ → ส่งกลุ่มท่า (pattern) ของมัดนั้นออกไปให้หน้าคลังกรอง
   ============================================================ */

private const val VW = 100f
private const val VH = 200f

private val BASE = Color(0xFF3A3E48)
private val HAIR = Color(0xFF23252C)
private val FORE = Color(0xFF4A4F5B)

private val DECOR = setOf("base", "hair", "fore", "line")

/** ชิ้นที่พร้อมวาด: hit = พื้นที่แตะ (เฉพาะมัดที่เป็นกลุ่มท่า) */
private class Shape(val kind: String, val path: Path, private val hit: android.graphics.Region?) {
    val group get() = kind.takeIf { it !in DECOR }
    // Region เป็นจำนวนเต็ม — ขยาย path ×10 ก่อนสร้างเพื่อให้แตะได้แม่นพอ
    fun contains(x: Float, y: Float) = hit?.contains((x * 10).toInt(), (y * 10).toInt()) == true
}

private fun build(parts: List<BodyPart>): List<Shape> = parts.flatMap { p ->
    val base = PathParser().parsePathString(p.d).toPath().asAndroidPath()
    val paths = if (!p.m) listOf(base) else listOf(
        base,
        android.graphics.Path(base).apply { transform(android.graphics.Matrix().apply { setScale(-1f, 1f, VW / 2, 0f) }) },
    )
    paths.map { ap ->
        val region = if (p.g in DECOR) null else {
            val big = android.graphics.Path(ap).apply { transform(android.graphics.Matrix().apply { setScale(10f, 10f) }) }
            android.graphics.Region().apply {
                setPath(big, android.graphics.Region(0, 0, (VW * 10).toInt(), (VH * 10).toInt()))
            }
        }
        Shape(p.g, ap.asComposePath(), region)
    }
}

private val MALE by lazy { build(BodyMapData.MALE_FRONT) to build(BodyMapData.MALE_BACK) }
private val FEMALE by lazy { build(BodyMapData.FEMALE_FRONT) to build(BodyMapData.FEMALE_BACK) }

/**
 * แผนที่กล้ามเนื้อสองด้าน — selected = กลุ่มที่เลือกอยู่ (เน้นสี กลุ่มอื่นจาง)
 * female = ใช้รูปร่างผู้หญิง, onSelect ได้ pattern ของมัดที่แตะ
 */
@Composable
fun BodyMap(selected: String?, female: Boolean, onSelect: (String) -> Unit, modifier: Modifier = Modifier) {
    // ความเข้มของแต่ละกลุ่มเคลื่อนแบบสปริงเวลาเลือก/เลิกเลือก
    val emphasis = LibraryCatalog.GROUP_ORDER.associateWith { g ->
        val target = when (selected) { null -> 0.85f; g -> 1f; else -> 0.15f }
        val v by animateFloatAsState(target, spring(dampingRatio = 0.6f, stiffness = 400f), label = "muscle-$g")
        v
    }
    val (front, back) = if (female) FEMALE else MALE
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.SpaceEvenly) {
        listOf("ด้านหน้า" to front, "ด้านหลัง" to back).forEach { (label, shapes) ->
            Column(Modifier.weight(1f), horizontalAlignment = Alignment.CenterHorizontally) {
                Figure(shapes, selected, emphasis, onSelect)
                Text(label, color = GB.text3, fontSize = 12.sp, fontWeight = FontWeight.SemiBold)
            }
        }
    }
}

@Composable
private fun Figure(shapes: List<Shape>, selected: String?, emphasis: Map<String, Float>, onSelect: (String) -> Unit) {
    Canvas(
        Modifier
            .fillMaxWidth()
            .aspectRatio(VW / VH)
            .pointerInput(shapes) {
                detectTapGestures { pos ->
                    val s = min(size.width / VW, size.height / VH)
                    val fx = (pos.x - (size.width - VW * s) / 2) / s
                    val fy = (pos.y - (size.height - VH * s) / 2) / s
                    shapes.lastOrNull { it.contains(fx, fy) }?.group?.let(onSelect)
                }
            },
    ) {
        val s = min(size.width / VW, size.height / VH)
        withTransform({
            translate((size.width - VW * s) / 2, (size.height - VH * s) / 2)
            scale(s, s, pivot = Offset.Zero)
        }) {
            shapes.forEach { sh ->
                when (sh.kind) {
                    "base" -> drawPath(sh.path, BASE)
                    "hair" -> drawPath(sh.path, HAIR)
                    "fore" -> {
                        drawPath(sh.path, FORE)
                        drawPath(sh.path, GB.bg, style = Stroke(width = 0.9f))
                    }
                    "line" -> drawPath(sh.path, GB.bg.copy(alpha = 0.55f), style = Stroke(width = 0.7f))
                    else -> {
                        drawPath(sh.path, lerp(BASE, groupColor(sh.kind), emphasis[sh.kind] ?: 0.85f))
                        drawPath(sh.path, if (sh.kind == selected) Color.White else GB.bg, style = Stroke(width = 0.9f))
                    }
                }
            }
        }
    }
}
