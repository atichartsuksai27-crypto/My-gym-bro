package com.gymbrodaily.nativeapp.ui

import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color

/** สีชุดเดียวกับโหมดมืดของเว็บ (ตัวแปร CSS ใน style.css) */
object GB {
    val bg = Color(0xFF121212)
    val surface = Color(0xFF1A1A1A)
    val surface2 = Color(0xFF202020)
    val border = Color(0xFF333333)
    val borderStrong = Color(0xFF444444)
    val text = Color(0xFFEAEAEA)
    val text2 = Color(0xFFB5B5B5)
    val text3 = Color(0xFF8F8F8F)
    val text4 = Color(0xFF6F6F6F)
    val accent = Color(0xFF5B8DEF)
    val accentInk = Color(0xFF0D1117)
    val accentSoft = Color(0xFF18233A)
    val accentLine = Color(0xFF2C4A80)
    val ok = Color(0xFF4ADE80)
    val okSoft = Color(0xFF0F2417)
    val okLine = Color(0xFF1F4A30)
    val warn = Color(0xFFF87171)
    val warnSoft = Color(0xFF2A1414)
    val warnLine = Color(0xFF5A2626)
    val food = Color(0xFF2DD4BF)
    val sleep = Color(0xFFA78BFA)
    val branch = Color(0xFFE0AC5C)
    val branchSoft = Color(0xFF241D0F)
}

@Composable
fun GymbroTheme(content: @Composable () -> Unit) {
    MaterialTheme(
        colorScheme = darkColorScheme(
            primary = GB.accent,
            onPrimary = GB.accentInk,
            primaryContainer = GB.accentSoft,
            onPrimaryContainer = GB.text,
            secondary = GB.accent,
            secondaryContainer = GB.accentSoft,
            onSecondaryContainer = GB.text,
            background = GB.bg,
            onBackground = GB.text,
            surface = GB.bg,
            onSurface = GB.text,
            surfaceVariant = GB.surface2,
            onSurfaceVariant = GB.text2,
            surfaceContainer = GB.surface,
            surfaceContainerLow = GB.surface,
            surfaceContainerHigh = GB.surface2,
            surfaceContainerHighest = GB.surface2,
            outline = GB.borderStrong,
            outlineVariant = GB.border,
            error = GB.warn,
        ),
        content = content,
    )
}
