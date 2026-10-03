package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.PathEffect
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.drawText
import androidx.compose.ui.text.rememberTextMeasurer
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

data class ChartPoint(val x: Float, val y: Double, val label: String)

/** กราฟเส้นแบบเดียวกับ plotSVG ของเว็บ: เส้นข้อมูล + เส้นประวันแรก (เทา) + เส้นประเป้าหมาย (ส้ม) */
@Composable
fun LineChart(
    points: List<ChartPoint>,
    modifier: Modifier = Modifier,
    height: Dp = 200.dp,
    goal: Double? = null,
    base: Double? = null,
    yFormat: (Double) -> String = { Fmt.one(it) },
) {
    if (points.isEmpty()) return
    val measurer = rememberTextMeasurer()
    val labelStyle = TextStyle(color = GB.text3, fontSize = 10.sp)
    Canvas(modifier.fillMaxWidth().height(height)) {
        val pl = 44.dp.toPx(); val pr = 10.dp.toPx(); val pt = 10.dp.toPx(); val pb = 20.dp.toPx()
        val ys = points.map { it.y } + listOfNotNull(goal, base)
        var minY = ys.min(); var maxY = ys.max()
        if (maxY == minY) { maxY = minY + 1; minY -= 1 }
        val pad = (maxY - minY) * 0.12
        minY -= pad; maxY += pad
        val minX = points.minOf { it.x }
        var maxX = points.maxOf { it.x }
        if (maxX == minX) maxX = minX + 1
        val w = size.width - pl - pr
        val h = size.height - pt - pb
        fun sx(x: Float) = pl + (x - minX) / (maxX - minX) * w
        fun sy(y: Double) = (pt + (1 - (y - minY) / (maxY - minY)) * h).toFloat()

        for (i in 0..3) {
            val v = minY + (maxY - minY) * i / 3
            val y = sy(v)
            drawLine(GB.border, Offset(pl, y), Offset(size.width - pr, y), 1f)
            drawText(measurer, yFormat(v), Offset(0f, y - 7.dp.toPx()), labelStyle)
        }
        val dash = PathEffect.dashPathEffect(floatArrayOf(10f, 8f))
        base?.let { drawLine(GB.text3, Offset(pl, sy(it)), Offset(size.width - pr, sy(it)), 2f, pathEffect = dash) }
        goal?.let { drawLine(GB.branch, Offset(pl, sy(it)), Offset(size.width - pr, sy(it)), 2.5f, pathEffect = dash) }

        val path = Path()
        points.forEachIndexed { i, p -> if (i == 0) path.moveTo(sx(p.x), sy(p.y)) else path.lineTo(sx(p.x), sy(p.y)) }
        drawPath(path, GB.accent, style = Stroke(width = 2.5.dp.toPx()))
        points.forEach { drawCircle(GB.accent, 3.dp.toPx(), Offset(sx(it.x), sy(it.y))) }

        drawText(measurer, points.first().label, Offset(pl, size.height - pb + 4.dp.toPx()), labelStyle)
        if (points.size > 1) {
            val last = measurer.measure(points.last().label, labelStyle)
            drawText(last, topLeft = Offset(size.width - pr - last.size.width, size.height - pb + 4.dp.toPx()))
        }
    }
}
