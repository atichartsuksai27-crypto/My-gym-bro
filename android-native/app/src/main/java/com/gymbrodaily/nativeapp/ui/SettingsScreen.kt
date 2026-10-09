package com.gymbrodaily.nativeapp.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.AlertDialog
import androidx.compose.material3.Button
import androidx.compose.material3.ButtonDefaults
import androidx.compose.material3.CircularProgressIndicator
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExposedDropdownMenuAnchorType
import androidx.compose.material3.ExposedDropdownMenuBox
import androidx.compose.material3.ExposedDropdownMenuDefaults
import androidx.compose.material3.Icon
import androidx.compose.material3.IconButton
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.OutlinedTextFieldDefaults
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.SupabaseProvider
import com.gymbrodaily.nativeapp.data.TrackState
import com.gymbrodaily.nativeapp.data.TrackStore
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.boolean
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.HttpURLConnection
import java.net.URL

/* ============================================================
   การตั้งค่า: บัญชี / ซิงก์ / ออกจากระบบ / ลบบัญชีถาวร
   ลบบัญชีเรียกเซิร์ฟเวอร์ตัวเดียวกับเว็บ (functions/api/delete-account.js) ซึ่งลบข้อมูลทุกตารางของผู้ใช้
   + auth.users ด้วย service_role แล้วตรวจซ้ำว่าไม่เหลืออะไร — แอปไม่มีสิทธิ์ลบ auth.users เองและห้ามฝัง key นั้น
   ============================================================ */

private const val DELETE_URL = "$WEB_APP_URL/api/delete-account"

/** ข้อความที่ผู้ใช้ต้องพิมพ์ยืนยัน (ตรงตัวอักษร ตัวพิมพ์ใหญ่) */
private const val CONFIRM_PHRASE = "GBGYMBRO"

/** ต้องตรงกับ ALLOWED_REASONS ใน functions/api/delete-account.js เป๊ะทุกตัวอักษร (server ตรวจซ้ำ) */
private val DELETE_REASONS = listOf(
    "ไม่ได้ใช้งานแอปแล้ว",
    "เจอแอป/บริการอื่นที่ดีกว่า",
    "ฟีเจอร์ไม่ตรงกับที่ต้องการ",
    "ใช้งานยาก/ซับซ้อนเกินไป",
    "กังวลเรื่องความเป็นส่วนตัวของข้อมูล",
    "เจอปัญหา/บั๊กทางเทคนิคบ่อย",
    "อื่นๆ",
)

private const val GEAR_ICON =
    "M12 9a3 3 0 1 0 0 6a3 3 0 1 0 0-6z M19.4 13.5a7.7 7.7 0 0 0 0-3l1.9-1.5-2-3.5-2.3.9a7.7 7.7 0 0 0-2.6-1.5L14 2.5h-4l-.4 2.4a7.7 7.7 0 0 0-2.6 1.5l-2.3-.9-2 3.5 1.9 1.5a7.7 7.7 0 0 0 0 3l-1.9 1.5 2 3.5 2.3-.9c.8.7 1.7 1.2 2.6 1.5l.4 2.4h4l.4-2.4c.9-.3 1.8-.8 2.6-1.5l2.3.9 2-3.5z"
const val SETTINGS_ICON = GEAR_ICON

@OptIn(ExperimentalMaterial3Api::class)
@Composable
fun SettingsScreen(email: String?, anonymous: Boolean, state: TrackState, store: TrackStore, onBack: () -> Unit, onSignOut: () -> Unit) {
    var deleting by rememberSaveable { mutableStateOf(false) }
    BackHandler(enabled = !deleting, onBack = onBack)

    Scaffold(
        containerColor = GB.bg,
        topBar = {
            TopAppBar(
                title = { Text("การตั้งค่า", fontWeight = FontWeight.ExtraBold) },
                navigationIcon = {
                    IconButton(onClick = onBack) { Icon(strokeIcon("M15 5l-7 7 7 7"), contentDescription = "ย้อนกลับ") }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GB.bg),
            )
        },
    ) { inner ->
        Column(
            Modifier.fillMaxSize().padding(inner).verticalScroll(rememberScrollState()).padding(horizontal = 16.dp, vertical = 8.dp),
            verticalArrangement = Arrangement.spacedBy(12.dp),
        ) {
            SectionLabel("บัญชี")
            Card {
                Text(if (anonymous) "ใช้งานโดยไม่ล็อกอิน" else email ?: "—", fontWeight = FontWeight.SemiBold, fontSize = 16.sp)
                Hint((if (anonymous) "ข้อมูลซิงก์ขึ้น server ผูกกับแอปในเครื่องนี้ · " else "เข้าสู่ระบบด้วย Google · ") + syncText(state))
                Row(horizontalArrangement = Arrangement.spacedBy(8.dp)) {
                    OutlinedButton(onClick = { store.syncNow() }) { Text("ซิงก์ตอนนี้") }
                    // anonymous ห้ามออกจากระบบ (เหมือนเว็บ) — ออกแล้วกลับเข้า user เดิมไม่ได้อีก
                    if (!anonymous) OutlinedButton(onClick = onSignOut) { Text("ออกจากระบบ") }
                }
            }
            // ลบบัญชีมีเฉพาะผู้ใช้ที่ล็อกอินจริง (เว็บก็ซ่อนปุ่มนี้ตอนเป็น anonymous)
            if (anonymous) return@Column

            SectionLabel("โซนอันตราย")
            Column(
                Modifier.fillMaxWidth().clip(RoundedCornerShape(28.dp)).background(GB.warnSoft).padding(18.dp),
                verticalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text("ลบบัญชีถาวร", fontWeight = FontWeight.ExtraBold, fontSize = 17.sp, color = GB.warn)
                Text(
                    "ข้อมูลทั้งหมดของคุณ (แผนออกกำลังกาย บันทึกประจำวัน น้ำหนัก ความคืบหน้า) จะถูกลบออกจากระบบถาวร กู้คืนไม่ได้",
                    fontSize = 13.5.sp, lineHeight = 20.sp,
                )
                Text(
                    "หากยืนยันที่จะลบบัญชี Subscription ของคุณจะหายไปด้วย และ No refund approve (ไม่มีการคืนเงินทุกกรณี)",
                    fontSize = 13.5.sp, lineHeight = 20.sp, fontWeight = FontWeight.Bold,
                )
                Button(
                    onClick = { deleting = true },
                    colors = ButtonDefaults.buttonColors(containerColor = GB.warn, contentColor = GB.bg),
                ) { Text("ลบบัญชี", fontWeight = FontWeight.Bold) }
            }
        }
    }

    if (deleting) DeleteAccountFlow(store = store, onCancel = { deleting = false })
}

@Composable
private fun SectionLabel(text: String) =
    Text(text, color = GB.text2, fontWeight = FontWeight.Bold, fontSize = 14.sp, modifier = Modifier.padding(start = 8.dp, top = 4.dp))

private enum class DeleteStage { REASON, CONFIRM, DONE }

/** เรียกเซิร์ฟเวอร์ลบบัญชี — คืนข้อความ error หรือ null ถ้าลบสำเร็จจริง (ต้องได้ {"ok":true} เท่านั้น) */
private suspend fun requestDelete(reason: String): String? = withContext(Dispatchers.IO) {
    val token = SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken
        ?: return@withContext "ยังไม่ได้เข้าสู่ระบบ ลองเข้าสู่ระบบใหม่แล้วทำอีกครั้ง"
    try {
        val conn = (URL(DELETE_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("content-type", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        conn.outputStream.use { it.write(buildJsonObject { put("reason", reason) }.toString().toByteArray()) }
        val ok = conn.responseCode in 200..299
        val body = (if (ok) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        val json = runCatching { Json.parseToJsonElement(body) as? JsonObject }.getOrNull()
        val confirmed = (json?.get("ok") as? JsonPrimitive)?.let { runCatching { it.boolean }.getOrNull() } == true
        when {
            ok && confirmed -> null
            else -> json?.get("error")?.jsonPrimitive?.content
                ?: "ลบบัญชีไม่สำเร็จ (ติดต่อเซิร์ฟเวอร์ไม่ได้) ยังไม่มีข้อมูลใดถูกลบ ลองใหม่อีกครั้ง"
        }
    } catch (e: Exception) {
        "ลบบัญชีไม่สำเร็จ (ติดต่อเซิร์ฟเวอร์ไม่ได้) ยังไม่มีข้อมูลใดถูกลบ ลองใหม่อีกครั้ง"
    }
}

@OptIn(ExperimentalMaterial3Api::class)
@Composable
private fun DeleteAccountFlow(store: TrackStore, onCancel: () -> Unit) {
    var stage by rememberSaveable { mutableStateOf(DeleteStage.REASON) }
    var reason by rememberSaveable { mutableStateOf<String?>(null) }
    var typed by rememberSaveable { mutableStateOf("") }
    var busy by rememberSaveable { mutableStateOf(false) }
    var error by rememberSaveable { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun doDelete() {
        val r = reason ?: return
        busy = true
        error = null
        scope.launch {
            val err = requestDelete(r)
            busy = false
            if (err == null) {
                store.wipeLocal()
                stage = DeleteStage.DONE
            } else error = err
        }
    }

    when (stage) {
        DeleteStage.REASON -> AlertDialog(
            onDismissRequest = onCancel,
            containerColor = GB.surface,
            title = { Text("ลบบัญชีถาวร", fontWeight = FontWeight.ExtraBold) },
            text = {
                Column(Modifier.verticalScroll(rememberScrollState()), verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text("ข้อมูลทั้งหมดจะถูกลบถาวร กู้คืนไม่ได้ ก่อนลบ ช่วยบอกเราหน่อยว่าเพราะอะไร:", fontSize = 14.sp, lineHeight = 20.sp)
                    var open by rememberSaveable { mutableStateOf(false) }
                    ExposedDropdownMenuBox(expanded = open, onExpandedChange = { open = it }) {
                        OutlinedTextField(
                            value = reason ?: "",
                            onValueChange = {},
                            readOnly = true,
                            placeholder = { Text("เลือกเหตุผล", color = GB.text4) },
                            trailingIcon = { ExposedDropdownMenuDefaults.TrailingIcon(expanded = open) },
                            colors = OutlinedTextFieldDefaults.colors(
                                unfocusedBorderColor = GB.borderStrong, focusedContainerColor = GB.surface2, unfocusedContainerColor = GB.surface2,
                            ),
                            shape = RoundedCornerShape(16.dp),
                            modifier = Modifier.fillMaxWidth().menuAnchor(ExposedDropdownMenuAnchorType.PrimaryNotEditable),
                        )
                        androidx.compose.material3.DropdownMenu(expanded = open, onDismissRequest = { open = false }, containerColor = GB.surface2) {
                            DELETE_REASONS.forEach { r ->
                                androidx.compose.material3.DropdownMenuItem(
                                    text = { Text(r) },
                                    onClick = { reason = r; open = false },
                                )
                            }
                        }
                    }
                    Text(
                        "หากยืนยันที่จะลบบัญชี Subscription ของคุณจะหายไปด้วย และ No refund approve (ไม่มีการคืนเงินทุกกรณี)",
                        color = GB.warn, fontWeight = FontWeight.Bold, fontSize = 13.5.sp, lineHeight = 19.sp,
                        modifier = Modifier.fillMaxWidth().clip(RoundedCornerShape(14.dp)).background(GB.warnSoft).padding(12.dp),
                    )
                }
            },
            confirmButton = {
                TextButton(onClick = { stage = DeleteStage.CONFIRM }, enabled = reason != null) {
                    Text("ถัดไป", color = if (reason != null) GB.warn else GB.text4, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = onCancel) { Text("ยกเลิก") } },
        )

        DeleteStage.CONFIRM -> AlertDialog(
            onDismissRequest = { if (!busy) onCancel() },
            containerColor = GB.surface,
            title = { Text("ยืนยันการลบบัญชี", fontWeight = FontWeight.ExtraBold) },
            text = {
                Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
                    Text(
                        "พิมพ์ $CONFIRM_PHRASE เพื่อยืนยันการลบบัญชี ข้อมูลทั้งหมดบนระบบจะถูกลบถาวร ไม่มีการคืนเงิน และ Subscription จะหายไปทันที",
                        fontSize = 14.sp, lineHeight = 20.sp,
                    )
                    OutlinedTextField(
                        value = typed,
                        onValueChange = { typed = it.trim() },
                        singleLine = true,
                        enabled = !busy,
                        placeholder = { Text(CONFIRM_PHRASE, color = GB.text4) },
                        isError = typed.isNotEmpty() && typed != CONFIRM_PHRASE,
                        shape = RoundedCornerShape(16.dp),
                        colors = OutlinedTextFieldDefaults.colors(
                            unfocusedBorderColor = GB.borderStrong, focusedContainerColor = GB.surface2, unfocusedContainerColor = GB.surface2,
                        ),
                        modifier = Modifier.fillMaxWidth(),
                    )
                    if (busy) Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(10.dp)) {
                        CircularProgressIndicator(Modifier.padding(2.dp), strokeWidth = 2.dp)
                        Text("กำลังลบบัญชีและข้อมูลทั้งหมด…", color = GB.text2, fontSize = 13.5.sp)
                    }
                    error?.let { Text(it, color = GB.warn, fontSize = 13.5.sp, lineHeight = 19.sp) }
                }
            },
            confirmButton = {
                val ready = typed == CONFIRM_PHRASE && !busy
                TextButton(onClick = { doDelete() }, enabled = ready) {
                    Text("ลบบัญชีถาวร", color = if (ready) GB.warn else GB.text4, fontWeight = FontWeight.Bold)
                }
            },
            dismissButton = { TextButton(onClick = { stage = DeleteStage.REASON; typed = ""; error = null }, enabled = !busy) { Text("ย้อนกลับ") } },
        )

        DeleteStage.DONE -> AlertDialog(
            onDismissRequest = {},
            containerColor = GB.surface,
            title = { Text("ลบบัญชีเรียบร้อยแล้ว", fontWeight = FontWeight.ExtraBold) },
            text = { Text("ข้อมูลทั้งหมดของคุณถูกลบออกจากระบบถาวรแล้ว ขอบคุณที่เคยใช้งาน Gymbro Daily", fontSize = 14.sp, lineHeight = 20.sp) },
            confirmButton = {
                TextButton(onClick = {
                    scope.launch {
                        // บัญชีถูกลบที่ server แล้ว token ใช้ไม่ได้ (signOut ปกติจะเรียก server แล้วพัง) — ล้าง session ในเครื่อง
                        // เฉยๆ แอปจะกลับไปหน้าเข้าสู่ระบบเองเมื่อสถานะ auth เปลี่ยน
                        runCatching { SupabaseProvider.client.auth.clearSession() }
                    }
                }) { Text("ปิด", fontWeight = FontWeight.Bold) }
            },
        )
    }
}
