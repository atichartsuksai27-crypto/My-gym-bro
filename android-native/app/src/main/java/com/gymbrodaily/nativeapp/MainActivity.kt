package com.gymbrodaily.nativeapp

import android.content.Intent
import android.os.Bundle
import androidx.activity.ComponentActivity
import androidx.activity.compose.setContent
import androidx.activity.enableEdgeToEdge
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import androidx.lifecycle.viewmodel.compose.viewModel
import com.gymbrodaily.nativeapp.ui.GB
import com.gymbrodaily.nativeapp.ui.GymbroTheme
import com.gymbrodaily.nativeapp.ui.MainScreen
import io.github.jan.supabase.auth.auth
import io.github.jan.supabase.auth.handleDeeplinks
import io.github.jan.supabase.auth.providers.Google
import io.github.jan.supabase.auth.status.SessionStatus
import kotlinx.coroutines.launch

class MainActivity : ComponentActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        enableEdgeToEdge()
        SupabaseProvider.client.handleDeeplinks(intent)
        setContent {
            GymbroTheme {
                Surface(Modifier.fillMaxSize(), color = GB.bg, contentColor = GB.text) { App() }
            }
        }
    }

    override fun onNewIntent(intent: Intent) {
        super.onNewIntent(intent)
        SupabaseProvider.client.handleDeeplinks(intent)
    }
}

@Composable
private fun App(vm: AppViewModel = viewModel()) {
    val auth = SupabaseProvider.client.auth
    val status by auth.sessionStatus.collectAsState()
    val scope = rememberCoroutineScope()
    /* ANON_SYNC แบบเดียวกับเว็บ: ไม่มีหน้าล็อกอิน — ยังไม่มี session = สมัครแบบ anonymous อัตโนมัติ
       (ได้ user_id จริง RLS/ซิงก์เดิมใช้ได้หมด) ต้องเปิด "Allow anonymous sign-ins" ใน Supabase Dashboard
       ถ้าผู้ใช้ Google เพิ่งกดออกจากระบบเอง จะไม่สมัครให้อัตโนมัติ ให้เลือกเองที่หน้าล็อกอิน */
    var signedOutByUser by rememberSaveable { mutableStateOf(false) }
    var anonError by remember { mutableStateOf<String?>(null) }
    var anonAttempt by remember { mutableStateOf(0) }
    val needAnon = status is SessionStatus.NotAuthenticated && !signedOutByUser
    LaunchedEffect(needAnon, anonAttempt) {
        if (!needAnon) return@LaunchedEffect
        anonError = null
        try {
            auth.signInAnonymously()
        } catch (e: Exception) {
            anonError = "เชื่อมต่อไม่ได้: ${e.message}"
        }
    }
    when (val s = status) {
        is SessionStatus.Initializing -> Centered { Text("กำลังโหลด…") }
        is SessionStatus.Authenticated -> {
            val user = s.session.user
            if (user == null) Centered { Text("กำลังโหลดบัญชี…") }
            else MainScreen(vm.storeFor(user.id), user.email, anonymous = user.isAnonymous == true) {
                signedOutByUser = true
                scope.launch { auth.signOut() }
            }
        }
        else -> if (needAnon && anonError == null) Centered { Text("กำลังเตรียมแอป…") }
        else LoginScreen(
            anonError,
            onAnonymous = { signedOutByUser = false; anonAttempt++ },
        )
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
private fun LoginScreen(anonError: String?, onAnonymous: () -> Unit) {
    val scope = rememberCoroutineScope()
    var error by remember { mutableStateOf<String?>(null) }
    Centered {
        Text("GYMBRO DAILY", style = MaterialTheme.typography.labelMedium)
        Text("เริ่มใช้งาน", style = MaterialTheme.typography.headlineMedium)
        Text("ใช้งานได้ทันทีโดยไม่ต้องล็อกอิน หรือเข้าสู่ระบบด้วย Google เพื่อใช้บัญชีเดิม", Modifier.padding(vertical = 16.dp))
        Button(onClick = onAnonymous, modifier = Modifier.fillMaxWidth()) {
            Text(if (anonError != null) "ลองอีกครั้ง" else "ใช้งานโดยไม่ล็อกอิน")
        }
        anonError?.let { Text(it, color = MaterialTheme.colorScheme.error, modifier = Modifier.padding(vertical = 8.dp)) }
        OutlinedButton(
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
