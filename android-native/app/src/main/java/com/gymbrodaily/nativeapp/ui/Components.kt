package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp

val CardShape = RoundedCornerShape(28.dp)

/* ไอคอนเส้นจาก SVG path (viewport 24) — ใช้แทน material-icons ที่ไม่ได้ใส่เป็น dependency */
private val iconCache = mutableMapOf<String, androidx.compose.ui.graphics.vector.ImageVector>()
fun strokeIcon(path: String): androidx.compose.ui.graphics.vector.ImageVector = iconCache.getOrPut(path) {
    androidx.compose.ui.graphics.vector.ImageVector.Builder(defaultWidth = 24.dp, defaultHeight = 24.dp, viewportWidth = 24f, viewportHeight = 24f)
        .addPath(
            pathData = androidx.compose.ui.graphics.vector.addPathNodes(path),
            fill = null,
            stroke = androidx.compose.ui.graphics.SolidColor(Color.White),
            strokeLineWidth = 1.7f,
            strokeLineCap = androidx.compose.ui.graphics.StrokeCap.Round,
            strokeLineJoin = androidx.compose.ui.graphics.StrokeJoin.Round,
        ).build()
}

/** การ์ดแบบ Expressive: มุมโค้งใหญ่ แยกชั้นด้วยสีพื้น (tonal) ไม่ใช้เส้นขอบ */
@Composable
fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(GB.surface)
            .padding(18.dp),
        verticalArrangement = Arrangement.spacedBy(12.dp),
    ) { content() }
}

/** หัวการ์ด: จุดสีทรงกลม + ชื่อ + meta + ตัวนับ done/total */
@Composable
fun SectionHead(title: String, color: Color, meta: String? = null, count: String? = null) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(12.dp).clip(CircleShape).background(color))
            Spacer(Modifier.width(10.dp))
            Text(title, fontWeight = FontWeight.Bold, fontSize = 18.sp, modifier = Modifier.weight(1f))
            if (count != null) Text(count, color = GB.text2, fontSize = 13.sp)
        }
        if (meta != null) Text(meta, color = GB.text3, fontSize = 12.5.sp, modifier = Modifier.padding(top = 2.dp))
    }
}

@Composable
fun Hint(text: String, modifier: Modifier = Modifier, color: Color = GB.text3) {
    Text(text, modifier = modifier, color = color, fontSize = 12.5.sp, lineHeight = 18.sp)
}

@Composable
fun PageHead(eyebrow: String?, title: String, sub: String? = null) {
    Column(Modifier.padding(bottom = 4.dp)) {
        if (eyebrow != null) Text(eyebrow, color = GB.text3, fontSize = 12.sp)
        Text(title, fontSize = 30.sp, lineHeight = 36.sp, fontWeight = FontWeight.ExtraBold)
        if (sub != null) Text(sub, color = GB.text2, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier, color: Color = GB.accent, height: Dp = 12.dp) {
    val animated by androidx.compose.animation.core.animateFloatAsState(
        fraction.coerceIn(0f, 1f),
        androidx.compose.animation.core.spring(dampingRatio = 0.7f, stiffness = 300f),
        label = "progress",
    )
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(height)).background(GB.surface2)) {
        Box(Modifier.fillMaxWidth(animated).fillMaxHeight().clip(RoundedCornerShape(height)).background(color))
    }
}

@Composable
fun Pill(text: String, color: Color = GB.text2, bg: Color = GB.surface2) {
    Text(
        text, color = color, fontSize = 12.sp, fontWeight = FontWeight.SemiBold,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 10.dp, vertical = 4.dp),
    )
}

@Composable
fun StatTile(label: String, value: String, detail: String? = null, modifier: Modifier = Modifier, valueColor: Color = GB.text) {
    Column(
        modifier.clip(RoundedCornerShape(20.dp)).background(GB.surface2).padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = GB.text3, fontSize = 12.sp)
        Text(value, color = valueColor, fontSize = 24.sp, fontWeight = FontWeight.ExtraBold)
        if (detail != null) Text(detail, color = GB.text3, fontSize = 11.5.sp, lineHeight = 16.sp)
    }
}

@Composable
fun LinkButton(text: String, onClick: () -> Unit) {
    TextButton(onClick = onClick, contentPadding = androidx.compose.foundation.layout.PaddingValues(0.dp)) {
        Text(text, color = GB.accent, fontSize = 13.sp)
    }
}

/**
 * ช่องกรอกตัวเลข — เก็บข้อความที่พิมพ์ไว้เอง (ไม่จัดรูปใหม่ระหว่างพิมพ์ เช่น "7." ไม่กลายเป็น "7.0")
 * และส่งค่าที่ parse ได้ออกไปทันทีทุกครั้งที่แก้ ช่องว่าง = null
 */
@Composable
fun NumberField(
    value: Double?,
    onChange: (text: String, parsed: Double?) -> Unit,
    placeholder: String,
    modifier: Modifier = Modifier,
    integer: Boolean = false,
    isError: Boolean = false,
    /** true = ส่งค่าเมื่อพิมพ์เสร็จ (ออกจากช่อง/กด Done) ไม่ส่งทุกตัวอักษร — ใช้กับช่องที่มีการตรวจช่วงค่า */
    commitOnBlur: Boolean = false,
) {
    var text by remember { mutableStateOf(Fmt.num(value)) }
    var focused by remember { mutableStateOf(false) }
    val focusManager = androidx.compose.ui.platform.LocalFocusManager.current
    LaunchedEffect(value) { if (!focused) text = Fmt.num(value) }
    fun commit() = onChange(text.trim(), text.trim().toDoubleOrNull())
    OutlinedTextField(
        value = text,
        onValueChange = { t ->
            val clean = t.replace(',', '.')
            text = clean
            if (!commitOnBlur) onChange(clean, clean.trim().toDoubleOrNull())
        },
        modifier = modifier.onFocusChanged {
            if (commitOnBlur && focused && !it.isFocused) commit()
            focused = it.isFocused
        },
        placeholder = { Text(placeholder, fontSize = 13.sp, color = GB.text4) },
        singleLine = true,
        isError = isError,
        textStyle = MaterialTheme.typography.bodyMedium,
        keyboardOptions = KeyboardOptions(
            keyboardType = if (integer) KeyboardType.Number else KeyboardType.Decimal,
            imeAction = androidx.compose.ui.text.input.ImeAction.Done,
        ),
        keyboardActions = androidx.compose.foundation.text.KeyboardActions(onDone = {
            if (commitOnBlur) commit()
            focusManager.clearFocus()
        }),
        colors = OutlinedTextFieldDefaults.colors(
            unfocusedBorderColor = GB.borderStrong,
            focusedContainerColor = GB.surface2,
            unfocusedContainerColor = GB.surface2,
        ),
        shape = RoundedCornerShape(16.dp),
    )
}

/** ชิปตัวเลือกทรงแคปซูล: ตัวที่เลือกเติมสีน้ำเงินเข้ม ตัวที่ไม่เลือกเป็นพื้น tonal ไม่มีเส้นขอบ */
@Composable
fun GbChip(selected: Boolean, onClick: () -> Unit, label: @Composable () -> Unit, modifier: Modifier = Modifier) {
    androidx.compose.material3.FilterChip(
        selected = selected,
        onClick = onClick,
        label = label,
        modifier = modifier,
        shape = androidx.compose.foundation.shape.CircleShape,
        colors = androidx.compose.material3.FilterChipDefaults.filterChipColors(
            containerColor = GB.surface2,
            labelColor = GB.text,
            selectedContainerColor = GB.accentSoft,
            selectedLabelColor = androidx.compose.ui.graphics.Color(0xFFDCE5FF),
        ),
        border = null,
    )
}
