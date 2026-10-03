package com.gymbrodaily.nativeapp

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.material3.Button
import androidx.compose.material3.MaterialTheme
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Surface
import androidx.compose.material3.Text
import androidx.compose.material3.darkColorScheme
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.unit.dp
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.status.SessionStatus
import io.github.jan.supabase.postgrest.from
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        SupabaseProvider.client.handleDeeplinks(intent)
        setContent {
            MaterialTheme(colorScheme = darkColorScheme()) {
                Surface(Modifier.fillMaxSize(), color = Color(0xFF121212), contentColor = Color(0xFFEDEDED)) { App() }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        SupabaseProvider.client.handleDeeplinks(intent)
    }
}

@Composable
private fun App() {
    val auth = SupabaseProvider.client.auth
    val status by auth.sessionStatus.collectAsState()
    when (status) {
        is SessionStatus.Initializing -> Centered { Text("กำลังโหลด…") }
        is SessionStatus.Authenticated -> HomeScreen()
        else -> LoginScreen()
    }
}

@Composable
private fun Centered(content: @Composable () -> Unit) {
    Column(
        Modifier.fillMaxSize().padding(24.dp),
        verticalArrangement = Arrangement.Center,
        horizontalAlignment = Alignment.CenterHorizontally,
    ) { content() }
}

@Composable
private fun LoginScreen() {
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    Centered {
        Text("GYMBRO DAILY", style = MaterialTheme.typography.labelMedium)
        Text("เข้าสู่ระบบ", style = MaterialTheme.typography.headlineMedium)
        Text("เข้าสู่ระบบด้วย Google เพื่อให้ข้อมูลของคุณซิงก์ข้ามอุปกรณ์ได้", Modifier.padding(vertical = 16.dp))
        Button(
            onClick = {
                error = null
                scope.launch {
                    try {
                        SupabaseProvider.client.auth.signInWith(Google)
                    } catch (e: Exception) {
                        error = "เชื่อมต่อไม่ได้: ${e.message}"
                    }
                }
            },
            modifier = Modifier.fillMaxWidth(),
        ) { Text("ดำเนินการต่อด้วย Google") }
        error?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(top = 12.dp)) }
    }
}

@Composable
private fun HomeScreen() {
    val scope = rememberCoroutineScope()
    val user = SupabaseProvider.client.auth.currentUserOrNull()
    var summary by remember { mutableStateOf("กำลังดึงข้อมูลจาก Supabase…") }

    /* พิสูจน์ว่า auth + RLS + sync ทำงานจริง: นับแถวของผู้ใช้คนนี้ในตารางเดิมที่แอปเว็บเขียนไว้ */
    LaunchedEffect(user?.id) {
        summary = try {
            val db = SupabaseProvider.client.from("daily_logs")
            val logs = db.select().decodeList<DailyLogRow>()
            val weights = SupabaseProvider.client.from("body_weights").select().decodeList<BodyWeightRow>()
            val latest = weights.maxByOrNull { it.logDate }
            "บันทึกรายวัน ${logs.size} วัน · น้ำหนักที่ชั่ง ${weights.size} ครั้ง" +
                (latest?.let { "\nล่าสุด ${it.kg} กก. (${it.logDate})" } ?: "")
        } catch (e: Exception) {
            "ดึงข้อมูลไม่สำเร็จ: ${e.message}"
        }
    }

    Centered {
        Text("เข้าสู่ระบบแล้ว", style = MaterialTheme.typography.headlineMedium)
        Text(user?.email ?: "", Modifier.padding(vertical = 8.dp))
        Text(summary, Modifier.padding(vertical = 16.dp))
        OutlinedButton(onClick = { scope.launch { SupabaseProvider.client.auth.signOut() } }) {
            Text("ออกจากระบบ")
        }
    }
}
