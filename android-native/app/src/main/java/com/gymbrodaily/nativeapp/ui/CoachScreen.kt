package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.material3.Button
import androidx.compose.material3.OutlinedTextField
import androidx.compose.material3.Text
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateListOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import com.gymbrodaily.nativeapp.SupabaseProvider
import io.github.jan.supabase.auth.auth
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.jsonPrimitive
import kotlinx.serialization.json.put
import java.net.HttpURLConnection
import java.net.URL

/* ============================================================
   ถามโค้ช — เรียก /api/coach (Cloudflare Pages Function ตัวเดียวกับเว็บ) ด้วย access token ของผู้ใช้
   server เป็นคนถือ API key, ดึงข้อมูลแผนของผู้ใช้เอง และจำกัดโควตารายวัน
   ประวัติแชทเก็บแค่ระหว่างเปิดแอป (เหมือนเว็บ)
   ============================================================ */

private const val COACH_URL = "$WEB_APP_URL/api/coach"
const val COACH_MAX_PER_DAY = 20 // ต้องตรงกับ MAX_QUESTIONS_PER_DAY ใน functions/api/coach.js — แค่ไว้แสดงผู้ใช้

data class CoachMessage(val fromUser: Boolean, val text: String)

/** เก็บไว้ระดับแอปเพื่อไม่ให้แชทหายตอนสลับแท็บ */
object CoachSession {
    val messages = mutableStateListOf<CoachMessage>()
}

private sealed interface CoachResult {
    data class Answer(val text: String) : CoachResult
    data class Error(val message: String) : CoachResult
}

private suspend fun askCoach(question: String): CoachResult = withContext(Dispatchers.IO) {
    val token = SupabaseProvider.client.auth.currentSessionOrNull()?.accessToken
        ?: return@withContext CoachResult.Error("ยังไม่ได้เข้าสู่ระบบ")
    try {
        val conn = (URL(COACH_URL).openConnection() as HttpURLConnection).apply {
            requestMethod = "POST"
            connectTimeout = 15_000
            readTimeout = 60_000
            doOutput = true
            setRequestProperty("content-type", "application/json")
            setRequestProperty("Authorization", "Bearer $token")
        }
        conn.outputStream.use { it.write(buildJsonObject { put("question", question) }.toString().toByteArray()) }
        val ok = conn.responseCode in 200..299
        val body = (if (ok) conn.inputStream else conn.errorStream)?.bufferedReader()?.use { it.readText() } ?: ""
        // ต้องได้ JSON ที่มี answer จริงเท่านั้นถึงนับว่าสำเร็จ (บทเรียนจากบั๊ก SPA fallback ตอบ 200 ของแอปเดิม)
        val json = runCatching { Json.parseToJsonElement(body) as? JsonObject }.getOrNull()
        val answer = (json?.get("answer") as? JsonPrimitive)?.takeIf { it.isString }?.content
        when {
            ok && answer != null -> CoachResult.Answer(answer.ifEmpty { "(ไม่มีคำตอบ)" })
            else -> CoachResult.Error(json?.get("error")?.jsonPrimitive?.content ?: "เชื่อมต่อระบบไม่สำเร็จ ลองใหม่อีกครั้ง")
        }
    } catch (e: Exception) {
        CoachResult.Error("เชื่อมต่อไม่สำเร็จ: ${e.message}")
    }
}

@Composable
fun CoachScreen() {
    val messages = CoachSession.messages
    var input by remember { mutableStateOf("") }
    var busy by remember { mutableStateOf(false) }
    var error by remember { mutableStateOf<String?>(null) }
    val scope = rememberCoroutineScope()

    fun send() {
        val q = input.trim()
        if (q.isEmpty() || busy) return
        messages += CoachMessage(true, q)
        input = ""
        busy = true
        error = null
        scope.launch {
            when (val r = askCoach(q)) {
                is CoachResult.Answer -> messages += CoachMessage(false, r.text)
                is CoachResult.Error -> error = r.message
            }
            busy = false
        }
    }

    Column(verticalArrangement = Arrangement.spacedBy(12.dp)) {
        PageHead(
            "ถามได้ทุกเรื่องเกี่ยวกับ Gymbro Daily", "ถามโค้ช",
            "โค้ชตอบจากข้อมูลที่แอปมีจริงเท่านั้น ไม่ใช่คำแนะนำทางการแพทย์ — จำกัด $COACH_MAX_PER_DAY คำถาม/วัน",
        )
        Card {
            if (messages.isEmpty()) Hint("ลองถามเช่น \"วันนี้ควรกินโปรตีนเท่าไหร่\" หรือ \"ทำไมท่าออกกำลังกายบางท่าเป็นชื่อภาษาอังกฤษ\"")
            messages.forEach { m -> Bubble(m) }
            if (busy) Bubble(CoachMessage(false, "กำลังพิมพ์..."))
        }
        error?.let { Hint(it, color = GB.warn) }
        Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(8.dp)) {
            OutlinedTextField(
                input, { if (it.length <= 500) input = it }, Modifier.weight(1f),
                placeholder = { Text("พิมพ์คำถาม...", color = GB.text4) }, enabled = !busy, maxLines = 4,
            )
            Button(onClick = ::send, enabled = !busy && input.isNotBlank()) { Text("ถาม") }
        }
    }
}

@Composable
private fun Bubble(m: CoachMessage) {
    Box(Modifier.fillMaxWidth(), contentAlignment = if (m.fromUser) Alignment.CenterEnd else Alignment.CenterStart) {
        Text(
            m.text, fontSize = 14.sp, lineHeight = 21.sp,
            modifier = Modifier
                .widthIn(max = 300.dp)
                .clip(RoundedCornerShape(20.dp))
                .background(if (m.fromUser) GB.accentSoft else GB.surface2)
                .padding(horizontal = 12.dp, vertical = 8.dp),
        )
    }
}
