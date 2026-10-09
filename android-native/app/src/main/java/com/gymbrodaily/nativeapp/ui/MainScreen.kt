package com.gymbrodaily.nativeapp.ui

import androidx.compose.foundation.clickable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.imePadding
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.rememberScrollState
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.ui.draw.clip
import androidx.compose.foundation.verticalScroll
import androidx.compose.material3.Button
import androidx.compose.material3.ExperimentalMaterial3Api
import androidx.compose.material3.ExperimentalMaterial3ExpressiveApi
import androidx.compose.material3.Icon
import androidx.compose.material3.LoadingIndicator
import androidx.compose.material3.NavigationBar
import androidx.compose.material3.NavigationBarItem
import androidx.compose.material3.NavigationBarItemDefaults
import androidx.compose.material3.OutlinedButton
import androidx.compose.material3.Scaffold
import androidx.compose.material3.Text
import androidx.compose.material3.TextButton
import androidx.compose.material3.TopAppBar
import androidx.compose.material3.TopAppBarDefaults
import androidx.compose.material3.pulltorefresh.PullToRefreshBox
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.collectAsState
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.saveable.rememberSaveable
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.animation.AnimatedVisibility
import androidx.compose.animation.fadeIn
import androidx.compose.animation.fadeOut
import androidx.compose.animation.slideInHorizontally
import androidx.compose.animation.slideOutHorizontally
import androidx.compose.material3.IconButton
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.platform.LocalUriHandler
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.lifecycle.compose.LifecycleResumeEffect
import com.gymbrodaily.nativeapp.data.Crm
import com.gymbrodaily.nativeapp.data.SyncPhase
import com.gymbrodaily.nativeapp.data.TrackState
import com.gymbrodaily.nativeapp.data.TrackStore
import com.gymbrodaily.nativeapp.domain.Generator
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.LocalDate

enum class Tab(val label: String, val icon: String) {
    TODAY("วันนี้", "M4 5.5h16v15H4z M4 10h16M8.5 3v4M15.5 3v4 M9 15l2 2 4-4"),
    SCHEDULE("ตาราง", "M4 5.5h16v15H4z M4 10h16M8.5 3v4M15.5 3v4 M8 13.5h2M14 13.5h2M8 17.5h2M14 17.5h2"),
    PROGRESS("คืบหน้า", "M4 4v16h16 M7.5 15l3.5-4 3 2.5L20 7"),
    PLAN("แผน", "M6 4h12v17H6z M9.5 2.5h5v3h-5z M9 11h6M9 15h6"),
    COACH("โค้ช", "M4.5 5h15v11h-9l-4 3.5V16h-2z M9 10.5h6"),
}

/* ไอคอนแท็บใช้ path ชุดเดียวกับ SVG บนเว็บ (NAV_ICONS ใน app.js) วาดเป็นเส้นตามสีของแท็บ */
private fun Tab.vector(): ImageVector = strokeIcon(icon)

/** ไอคอนดัมเบล — ปุ่มเปิดคลังท่าบนแถบด้านบน */
private const val LIBRARY_ICON = "M3 9.5v5M6 7v10M18 7v10M21 9.5v5M6 12h12"

@OptIn(ExperimentalMaterial3Api::class, ExperimentalMaterial3ExpressiveApi::class)
@Composable
fun MainScreen(store: TrackStore, email: String?, anonymous: Boolean = false, onSignOut: () -> Unit) {
    val state by store.state.collectAsState()
    var tab by rememberSaveable { mutableStateOf(Tab.TODAY) }
    var libraryOpen by rememberSaveable { mutableStateOf(false) }
    var settingsOpen by rememberSaveable { mutableStateOf(false) }
    var today by remember { mutableStateOf(LocalDate.now()) }
    val scope = rememberCoroutineScope()
    val appContext = androidx.compose.ui.platform.LocalContext.current.applicationContext

    // กลับเข้าแอป: ดึงข้อมูลล่าสุด (เผื่อแก้จากเว็บ) และอัปเดต "วันนี้" ถ้าข้ามเที่ยงคืนไปแล้ว
    LifecycleResumeEffect(Unit) {
        today = LocalDate.now()
        store.syncNow()
        scope.launch { Crm.touch(appContext) }
        onPauseOrDispose { }
    }
    LaunchedEffect(Unit) {
        while (true) { delay(60_000); today = LocalDate.now() }
    }

    Box(Modifier.fillMaxSize()) {
    Scaffold(
        containerColor = GB.bg,
        topBar = {
            TopAppBar(
                title = { Text("GYMBRO DAILY", fontSize = 18.sp, fontWeight = FontWeight.ExtraBold, letterSpacing = 0.5.sp) },
                actions = {
                    val (label, color) = when {
                        state.phase == SyncPhase.SYNCING -> "กำลังซิงก์…" to GB.text3
                        state.pendingCount > 0 -> "รอส่ง ${state.pendingCount}" to GB.branch
                        state.phase == SyncPhase.OFFLINE -> "ออฟไลน์" to GB.branch
                        else -> "ซิงก์แล้ว ✓" to GB.ok
                    }
                    Box(Modifier.clip(CircleShape).clickable { store.syncNow() }) {
                        Pill(label, color = color, bg = GB.surface2)
                    }
                    IconButton(onClick = { libraryOpen = true }) {
                        Icon(strokeIcon(LIBRARY_ICON), contentDescription = "คลังท่าออกกำลังกาย", tint = GB.text)
                    }
                    IconButton(onClick = { settingsOpen = true }, modifier = Modifier.padding(end = 4.dp)) {
                        Icon(strokeIcon(SETTINGS_ICON), contentDescription = "การตั้งค่า", tint = GB.text)
                    }
                },
                colors = TopAppBarDefaults.topAppBarColors(containerColor = GB.bg),
            )
        },
        bottomBar = {
            if (state.program != null && !state.onb.editPlan) {
                NavigationBar(containerColor = GB.surface, tonalElevation = 0.dp) {
                    // โค้ชต้องเป็นผู้ใช้ที่ล็อกอินจริง (เหมือน realUser() ของเว็บ) — anonymous ไม่เห็นแท็บนี้
                    Tab.entries.filter { !anonymous || it != Tab.COACH }.forEach { t ->
                        NavigationBarItem(
                            selected = tab == t,
                            onClick = { tab = t },
                            icon = { Icon(t.vector(), contentDescription = null) },
                            label = { Text(t.label, fontSize = 12.sp, fontWeight = if (tab == t) FontWeight.Bold else FontWeight.Medium) },
                            colors = NavigationBarItemDefaults.colors(
                                selectedIconColor = Color(0xFFDCE5FF), selectedTextColor = GB.accent,
                                indicatorColor = GB.accentSoft, unselectedIconColor = GB.text3, unselectedTextColor = GB.text3,
                            ),
                        )
                    }
                }
            }
        },
    ) { inner ->
        val data = state.trackData()
        when {
            !state.loaded -> Box(Modifier.fillMaxSize().padding(inner), contentAlignment = Alignment.Center) {
                Column(horizontalAlignment = Alignment.CenterHorizontally) {
                    LoadingIndicator()
                    Text("กำลังโหลดข้อมูล…", color = GB.text2, modifier = Modifier.padding(top = 12.dp))
                    if (state.phase == SyncPhase.OFFLINE) {
                        Hint("เชื่อมต่อ server ไม่ได้: ${state.lastError ?: ""}", Modifier.padding(16.dp))
                        Button(onClick = { store.syncNow() }) { Text("ลองใหม่") }
                    }
                }
            }
            // ยังไม่มีแผน หรือกำลังแก้แผน → แบบสอบถาม (เหมือน currentView() ของเว็บ)
            data == null || state.onb.editPlan -> Column(
                Modifier.fillMaxSize().padding(inner).imePadding().verticalScroll(rememberScrollState())
                    .padding(horizontal = 16.dp, vertical = 8.dp),
                verticalArrangement = Arrangement.spacedBy(12.dp),
            ) {
                OnboardingFlow(state, store, hasProgram = data != null)
                if (data == null && !anonymous) TextButton(onClick = onSignOut) { Text("ออกจากระบบ", color = GB.warn) }
                Box(Modifier.padding(bottom = 24.dp))
            }
            else -> PullToRefreshBox(
                isRefreshing = state.phase == SyncPhase.SYNCING,
                onRefresh = { scope.launch { store.refresh() } },
                modifier = Modifier.fillMaxSize().padding(inner),
            ) {
                val scroll = rememberScrollState()
                LaunchedEffect(tab) { scroll.scrollTo(0) }
                Column(
                    Modifier.fillMaxSize().imePadding().verticalScroll(scroll).padding(horizontal = 16.dp, vertical = 8.dp),
                    verticalArrangement = Arrangement.spacedBy(12.dp),
                ) {
                    when (tab) {
                        Tab.TODAY -> TodayScreen(data, today, store) { tab = it }
                        Tab.SCHEDULE -> ScheduleScreen(data, today, store)
                        Tab.PROGRESS -> ProgressScreen(data, today)
                        Tab.PLAN -> PlanScreen(data, state, today, store, email, anonymous, onSignOut)
                        Tab.COACH -> if (anonymous) TodayScreen(data, today, store) { tab = it } else CoachScreen()
                    }
                    Box(Modifier.padding(bottom = 24.dp))
                }
            }
        }
    }
    // คลังท่า: หน้าเต็มจอซ้อนบนแอป เลื่อนเข้าจากขวา ปิดด้วยปุ่มย้อนกลับ/ปัดย้อนกลับ
    AnimatedVisibility(
        visible = libraryOpen,
        enter = slideInHorizontally { it } + fadeIn(),
        exit = slideOutHorizontally { it / 3 } + fadeOut(),
    ) {
        ExerciseLibraryScreen(state.trackData()) { libraryOpen = false }
    }
    AnimatedVisibility(
        visible = settingsOpen,
        enter = slideInHorizontally { it } + fadeIn(),
        exit = slideOutHorizontally { it / 3 } + fadeOut(),
    ) {
        SettingsScreen(email, anonymous, state, store, onBack = { settingsOpen = false }, onSignOut = onSignOut)
    }
    }
}
