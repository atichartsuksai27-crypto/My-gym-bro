package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.border
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

val CardShape = RoundedCornerShape(10.dp)

@Composable
fun Card(modifier: Modifier = Modifier, content: @Composable () -> Unit) {
    Column(
        modifier
            .fillMaxWidth()
            .clip(CardShape)
            .background(GB.surface)
            .border(1.dp, GB.border, CardShape)
            .padding(14.dp),
        verticalArrangement = Arrangement.spacedBy(10.dp),
    ) { content() }
}

/** หัวการ์ดแบบเว็บ: สี่เหลี่ยมสี + ชื่อ + meta + ตัวนับ done/total */
@Composable
fun SectionHead(title: String, color: Color, meta: String? = null, count: String? = null) {
    Column {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(10.dp).clip(RoundedCornerShape(2.dp)).background(color))
            Spacer(Modifier.width(8.dp))
            Text(title, fontWeight = FontWeight.SemiBold, fontSize = 17.sp, modifier = Modifier.weight(1f))
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
        Text(title, fontSize = 26.sp, fontWeight = FontWeight.Bold)
        if (sub != null) Text(sub, color = GB.text2, fontSize = 13.sp, lineHeight = 19.sp, modifier = Modifier.padding(top = 4.dp))
    }
}

@Composable
fun ProgressBar(fraction: Float, modifier: Modifier = Modifier, color: Color = GB.accent, height: Dp = 8.dp) {
    Box(modifier.fillMaxWidth().height(height).clip(RoundedCornerShape(height)).background(GB.surface2)) {
        Box(Modifier.fillMaxWidth(fraction.coerceIn(0f, 1f)).fillMaxHeight().background(color))
    }
}

@Composable
fun Pill(text: String, color: Color = GB.text2, bg: Color = GB.surface2) {
    Text(
        text, color = color, fontSize = 11.5.sp,
        modifier = Modifier.clip(RoundedCornerShape(50)).background(bg).padding(horizontal = 8.dp, vertical = 2.dp),
    )
}

@Composable
fun StatTile(label: String, value: String, detail: String? = null, modifier: Modifier = Modifier, valueColor: Color = GB.text) {
    Column(
        modifier.clip(RoundedCornerShape(8.dp)).background(GB.surface2).padding(12.dp),
        verticalArrangement = Arrangement.spacedBy(2.dp),
    ) {
        Text(label, color = GB.text3, fontSize = 12.sp)
        Text(value, color = valueColor, fontSize = 20.sp, fontWeight = FontWeight.SemiBold)
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
            focusedContainerColor = GB.bg,
            unfocusedContainerColor = GB.bg,
        ),
    )
}
