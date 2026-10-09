package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.MaterialExpressiveTheme
import androidx.compose.material3.MotionScheme
import androidx.compose.material3.Shapes
import androidx.compose.material3.Typography
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp

/** ชุดสี M3 Expressive โหมดมืด: น้ำเงิน (หลัก) / เหลือง (รอง) / ชมพู (เสริม) บนพื้น tonal หลายระดับ */
object GB {
    val bg = Color(0xFF101114)
    val surface = Color(0xFF1B1D23)
    val surface2 = Color(0xFF282B33)
    val border = Color(0xFF33363F)
    val borderStrong = Color(0xFF4A4E59)
    val text = Color(0xFFEDEEF3)
    val text2 = Color(0xFFBEC1CB)
    val text3 = Color(0xFF9296A2)
    val text4 = Color(0xFF727683)
    val accent = Color(0xFFA9C0FF)
    val accentInk = Color(0xFF00296B)
    val accentSoft = Color(0xFF1F3F82)
    val accentLine = Color(0xFF3F64BA)
    val ok = Color(0xFF6EE79A)
    val okSoft = Color(0xFF0F2A1B)
    val okLine = Color(0xFF1F4A30)
    val warn = Color(0xFFFF8A8A)
    val warnSoft = Color(0xFF331617)
    val warnLine = Color(0xFF5A2626)
    val food = Color(0xFF3EE0CB)
    val sleep = Color(0xFFB9A2FF)
    val branch = Color(0xFFFFD04D)
    val branchSoft = Color(0xFF2B2310)
    val pink = Color(0xFFFFB1CE)
    val pinkSoft = Color(0xFF5C1F3A)
}

/** รูปทรงโค้งมนแบบ Expressive — การ์ด/ไดอะล็อกใหญ่ ปุ่มและชิปเป็นแคปซูล */
val GymbroShapes = Shapes(
    extraSmall = RoundedCornerShape(8.dp),
    small = RoundedCornerShape(12.dp),
    medium = RoundedCornerShape(20.dp),
    large = RoundedCornerShape(28.dp),
    extraLarge = RoundedCornerShape(36.dp),
)

/** หัวข้อ/ตัวเลขเด่นใช้น้ำหนักหนาขึ้น (emphasized) ที่เหลือใช้ค่า default ของ M3 */
private val GymbroTypography = Typography().let { base ->
    base.copy(
        headlineLarge = base.headlineLarge.copy(fontWeight = FontWeight.ExtraBold),
        headlineMedium = base.headlineMedium.copy(fontWeight = FontWeight.ExtraBold),
        headlineSmall = base.headlineSmall.copy(fontWeight = FontWeight.Bold),
        titleLarge = base.titleLarge.copy(fontWeight = FontWeight.Bold),
        titleMedium = base.titleMedium.copy(fontWeight = FontWeight.Bold),
        labelLarge = base.labelLarge.copy(fontWeight = FontWeight.Bold),
    )
}

@OptIn(ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun GymbroTheme(content: @Composable () -> Unit) {
    MaterialExpressiveTheme(
        colorScheme = darkColorScheme(
            primary = GB.accent,
            onPrimary = GB.accentInk,
            primaryContainer = GB.accentSoft,
            onPrimaryContainer = Color(0xFFDCE5FF),
            secondary = GB.branch,
            onSecondary = Color(0xFF3B2F00),
            secondaryContainer = Color(0xFF5A4700),
            onSecondaryContainer = Color(0xFFFFE9A6),
            tertiary = GB.pink,
            onTertiary = Color(0xFF541A36),
            tertiaryContainer = GB.pinkSoft,
            onTertiaryContainer = Color(0xFFFFD9E6),
            background = GB.bg,
            onBackground = GB.text,
            surface = GB.bg,
            onSurface = GB.text,
            surfaceVariant = GB.surface2,
            onSurfaceVariant = GB.text2,
            surfaceContainerLowest = GB.bg,
            surfaceContainerLow = GB.surface,
            surfaceContainer = GB.surface,
            surfaceContainerHigh = GB.surface2,
            surfaceContainerHighest = Color(0xFF32363F),
            outline = GB.borderStrong,
            outlineVariant = GB.border,
            error = GB.warn,
        ),
        shapes = GymbroShapes,
        typography = GymbroTypography,
        motionScheme = MotionScheme.expressive(),
        content = content,
    )
}
