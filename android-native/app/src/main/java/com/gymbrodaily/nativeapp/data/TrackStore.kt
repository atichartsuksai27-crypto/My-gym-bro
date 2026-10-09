package com.gymbrodaily.nativeapp.data

import android.content.Context
import com.gymbrodaily.nativeapp.BodyWeightRow
import com.gymbrodaily.nativeapp.DailyLogRow
import com.gymbrodaily.nativeapp.OnboardingRow
import com.gymbrodaily.nativeapp.ProgramRow
import com.gymbrodaily.nativeapp.SupabaseProvider
import com.gymbrodaily.nativeapp.domain.Answers
import com.gymbrodaily.nativeapp.domain.DailyLog
import com.gymbrodaily.nativeapp.domain.Generator
import com.gymbrodaily.nativeapp.domain.PlanOverrides
import com.gymbrodaily.nativeapp.domain.Program
import com.gymbrodaily.nativeapp.domain.TrackData
import com.gymbrodaily.nativeapp.domain.Tracking
import io.github.jan.supabase.postgrest.from
import io.github.jan.supabase.realtime.PostgresAction
import io.github.jan.supabase.realtime.RealtimeChannel
import io.github.jan.supabase.realtime.channel
import io.github.jan.supabase.realtime.postgresChangeFlow
import io.github.jan.supabase.realtime.realtime
import io.github.jan.supabase.realtime.PostgresChangeFilter
import io.github.jan.supabase.postgrest.query.filter.FilterOperator
import kotlinx.coroutines.flow.launchIn
import kotlinx.coroutines.flow.onEach
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.asStateFlow
import kotlinx.coroutines.flow.update
import kotlinx.coroutines.launch
import kotlinx.coroutines.sync.Mutex
import kotlinx.coroutines.sync.withLock
import kotlinx.coroutines.withContext
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.decodeFromJsonElement
import kotlinx.serialization.json.encodeToJsonElement
import kotlinx.serialization.json.jsonObject
import java.io.File
import java.time.Instant

/* ============================================================
   ที่เก็บข้อมูลติดตามผล — บันทึกลงเครื่องก่อนเสมอ แล้วค่อยซิงก์ขึ้น Supabase
   ------------------------------------------------------------
   ทุกการแก้ไขเขียนลงไฟล์ในเครื่องทันที และเข้าคิว "รอส่ง" ไว้ ถ้าเน็ตหลุด/Supabase ล่ม
   ข้อมูลไม่หาย และส่งให้เองเมื่อกลับมาออนไลน์ (เว็บเดิมยิงขึ้นไปครั้งเดียวแล้วทิ้ง error เงียบๆ)
   ตอนดึงข้อมูลจาก server: server เป็นตัวจริง ยกเว้นรายการที่ยังรอส่งอยู่ในคิว ให้ของในเครื่องชนะ
   ============================================================ */

@Serializable
data class PendingOp(
    val kind: String, // "log" | "delete-log" | "weight" | "program"
    val date: String? = null,
    val payload: JsonObject? = null,
    val kg: Double? = null,
) {
    /** รายการเดียวกันใช้ key เดียวกัน — แก้ซ้ำหลายรอบก่อนส่งได้ ส่งแค่ค่าสุดท้าย */
    val key get() = if (kind == "delete-log") "log:$date" else "$kind:${date ?: ""}"
}

@Serializable
private data class LocalCache(
    val program: JsonObject? = null,
    val logs: Map<String, JsonObject> = emptyMap(),
    val weights: Map<String, Double> = emptyMap(),
    val onboarding: JsonObject? = null,
    val pending: List<PendingOp> = emptyList(),
    val lastSyncedAt: String? = null,
)

enum class SyncPhase { IDLE, SYNCING, OFFLINE }

data class TrackState(
    val loaded: Boolean = false,
    val programRaw: JsonObject? = null,
    val program: Program? = null,
    val logs: Map<String, DailyLog> = emptyMap(),
    /** payload ดิบของแต่ละวันตามที่ server/เว็บเขียนมา — เก็บ field ที่แอปยังไม่รู้จักไว้ ไม่ให้หายตอนแก้แล้วส่งกลับ */
    val logsRaw: Map<String, JsonObject> = emptyMap(),
    val weights: Map<String, Double> = emptyMap(),
    val onboarding: JsonObject? = null,
    val pendingCount: Int = 0,
    val phase: SyncPhase = SyncPhase.IDLE,
    val lastError: String? = null,
    val lastSyncedAt: String? = null,
) {
    val answers: Answers
        get() = Answers((onboarding?.get("answers") as? JsonObject) ?: JsonObject(emptyMap()))

    val planOverrides: PlanOverrides
        get() = onboarding?.get("plan")?.let { runCatching { TrackStore.json.decodeFromJsonElement<PlanOverrides>(it) }.getOrNull() }
            ?: PlanOverrides()

    fun trackData(): TrackData? = program?.let { TrackData(it, logs, weights, answers) }

    val onb: Onboarding get() = Onboarding.from(onboarding)
}

/**
 * สถานะแบบสอบถาม (shape เดียวกับ state ของ app.js ที่เก็บใน onboarding_state.payload)
 * step 0-8 = หมวดคำถาม, 9 = สรุป (mode null) / ตรวจแผน (mode "results")
 * editPlan = กำลังแก้แผนทั้งที่มีโปรแกรมอยู่แล้ว (เว็บใช้ค่านี้ตัดสินว่าจะเปิดหน้าแบบสอบถามไหม)
 */
data class Onboarding(
    val step: Int = 0,
    val answers: Answers = Answers(),
    val mode: String? = null,
    val editPlan: Boolean = false,
    val plan: PlanOverrides = PlanOverrides(),
    private val raw: JsonObject = JsonObject(emptyMap()),
) {
    fun toJson(): JsonObject = JsonObject(
        raw + mapOf(
            "step" to JsonPrimitive(step),
            "answers" to answers.json,
            "mode" to (mode?.let { JsonPrimitive(it) } ?: kotlinx.serialization.json.JsonNull),
            "editPlan" to JsonPrimitive(editPlan),
            "plan" to TrackStore.json.encodeToJsonElement(PlanOverrides.serializer(), plan),
            "nav" to (raw["nav"] ?: JsonPrimitive("today")),
        ),
    )

    companion object {
        fun from(o: JsonObject?): Onboarding {
            if (o == null) return Onboarding()
            fun prim(k: String) = o[k] as? JsonPrimitive
            return Onboarding(
                step = prim("step")?.content?.toDoubleOrNull()?.toInt() ?: 0,
                answers = Answers((o["answers"] as? JsonObject) ?: JsonObject(emptyMap())),
                mode = prim("mode")?.takeIf { it.isString }?.content,
                editPlan = prim("editPlan")?.content == "true",
                plan = o["plan"]?.let { runCatching { TrackStore.json.decodeFromJsonElement<PlanOverrides>(it) }.getOrNull() }
                    ?: PlanOverrides(),
                raw = o,
            )
        }
    }
}

class TrackStore(context: Context, private val userId: String, private val scope: CoroutineScope) {

    companion object {
        /** อ่านข้อมูลที่เว็บเขียนแบบผ่อนปรน (field เกิน/ค่า null ในช่องที่ไม่ควร null ไม่ทำให้ล้ม) */
        val json = Json {
            ignoreUnknownKeys = true
            coerceInputValues = true
            isLenient = true
            explicitNulls = false
            encodeDefaults = true
        }

        /** เขียนค่า null ออกมาตรงๆ — ตอนผสานกับ payload ดิบ ช่องที่ผู้ใช้ลบค่าทิ้งต้องกลายเป็น null จริง ไม่ใช่ค้างค่าเก่า */
        private val jsonExplicit = Json(json) { explicitNulls = true }

        /**
         * วางค่าที่แอปแก้ทับ payload ดิบทีละ field (ลงไปถึง object/array ซ้อนข้างใน) — field ที่แอปไม่รู้จัก
         * (เช่น stress / อาการหลังฝึก / อาหาร / warm-up ที่เว็บเพิ่มทีหลัง) ยังอยู่ครบ ส่วน field ที่แอปรู้จักใช้ค่าของแอป
         */
        internal fun mergeRaw(raw: JsonElement?, typed: JsonElement): JsonElement = when {
            raw is JsonObject && typed is JsonObject -> JsonObject(raw + typed.mapValues { (k, v) -> mergeRaw(raw[k], v) })
            raw is JsonArray && typed is JsonArray -> JsonArray(typed.mapIndexed { i, v -> mergeRaw(raw.getOrNull(i), v) })
            else -> typed
        }
    }

    private val file = File(context.filesDir, "track-$userId.json")
    private val _state = MutableStateFlow(TrackState())
    val state: StateFlow<TrackState> = _state.asStateFlow()

    private var pending: List<PendingOp> = emptyList()
    private val syncMutex = Mutex()
    private val fileMutex = Mutex()
    private var flushJob: Job? = null

    /** true หลังลบบัญชีสำเร็จ — ห้ามซิงก์/เขียนไฟล์อีก ไม่งั้นข้อมูลที่เพิ่งลบจะถูกส่งกลับขึ้น server */
    @Volatile private var wiped = false
    private val db get() = SupabaseProvider.client

    init {
        scope.launch {
            loadCache()
            refresh()
        }
    }

    /* ---------- อ่าน/เขียนไฟล์ในเครื่อง ---------- */

    private suspend fun loadCache() = withContext(Dispatchers.IO) {
        val cache = runCatching { json.decodeFromString<LocalCache>(file.readText()) }.getOrNull() ?: LocalCache()
        pending = cache.pending
        _state.value = buildState(cache.program, cache.logs, cache.weights, cache.onboarding)
            .copy(loaded = cache.program != null || cache.lastSyncedAt != null, lastSyncedAt = cache.lastSyncedAt)
    }

    private fun saveCache() {
        if (wiped) return
        val s = _state.value
        val snapshot = LocalCache(
            program = s.programRaw,
            logs = s.logsRaw,
            weights = s.weights,
            onboarding = s.onboarding,
            pending = pending,
            lastSyncedAt = s.lastSyncedAt,
        )
        scope.launch(Dispatchers.IO) {
            fileMutex.withLock {
                val tmp = File(file.parentFile, file.name + ".tmp")
                tmp.writeText(json.encodeToString(LocalCache.serializer(), snapshot))
                if (!tmp.renameTo(file)) { file.delete(); tmp.renameTo(file) }
            }
        }
    }

    private fun buildState(
        programRaw: JsonObject?,
        logs: Map<String, JsonObject>,
        weights: Map<String, Double>,
        onboarding: JsonObject?,
    ): TrackState = _state.value.copy(
        programRaw = programRaw,
        program = programRaw?.let { runCatching { json.decodeFromJsonElement<Program>(it) }.getOrNull() },
        logs = logs.mapNotNull { (d, p) -> decodeLog(d, p)?.let { d to it } }.toMap(),
        logsRaw = logs,
        weights = weights,
        onboarding = onboarding,
        pendingCount = pending.size,
    )

    private fun decodeLog(date: String, payload: JsonObject): DailyLog? =
        runCatching { json.decodeFromJsonElement<DailyLog>(JsonObject(payload + ("date" to JsonPrimitive(date)))) }.getOrNull()

    private fun encodeLog(log: DailyLog, raw: JsonObject?): JsonObject =
        mergeRaw(raw, jsonExplicit.encodeToJsonElement(log)).jsonObject

    /* ---------- ซิงก์กับ Supabase ---------- */

    /** ส่งคิวที่ค้างก่อน แล้วดึงข้อมูลล่าสุดจาก server มาแทน (ยกเว้นรายการที่ยังส่งไม่สำเร็จ) */
    suspend fun refresh() = syncMutex.withLock {
        if (wiped) return@withLock
        _state.update { it.copy(phase = SyncPhase.SYNCING) }
        try {
            flushLocked()
            val program = db.from("programs").select { filter { eq("user_id", userId) } }
                .decodeSingleOrNull<ProgramRow>()?.payload
            val logs = db.from("daily_logs").select { filter { eq("user_id", userId) } }
                .decodeList<DailyLogRow>().associate { it.logDate to it.payload }
            val weights = db.from("body_weights").select { filter { eq("user_id", userId) } }
                .decodeList<BodyWeightRow>().associate { it.logDate to it.kg }
            val onboarding = db.from("onboarding_state").select { filter { eq("user_id", userId) } }
                .decodeSingleOrNull<OnboardingRow>()?.payload

            // รายการที่ยังรอส่ง (แก้ระหว่างดึงข้อมูล/ส่งไม่ผ่าน) ต้องชนะข้อมูลจาก server
            val mergedLogs = logs.toMutableMap()
            val mergedWeights = weights.toMutableMap()
            var mergedProgram = program
            var mergedOnboarding = onboarding
            pending.forEach { op ->
                when (op.kind) {
                    "log" -> mergedLogs[op.date!!] = op.payload!!
                    "delete-log" -> mergedLogs.remove(op.date)
                    "weight" -> mergedWeights[op.date!!] = op.kg!!
                    "program" -> mergedProgram = op.payload
                    "onboarding" -> mergedOnboarding = op.payload
                }
            }
            _state.value = buildState(mergedProgram, mergedLogs, mergedWeights, mergedOnboarding).copy(
                loaded = true, phase = if (pending.isEmpty()) SyncPhase.IDLE else SyncPhase.OFFLINE,
                lastError = null, lastSyncedAt = Instant.now().toString(),
            )
        } catch (e: Exception) {
            _state.update {
                it.copy(loaded = it.loaded || it.program != null, phase = SyncPhase.OFFLINE, lastError = e.message)
            }
        }
        saveCache()
    }

    private suspend fun flushLocked() {
        while (pending.isNotEmpty()) {
            val op = pending.first()
            when (op.kind) {
                "log" -> db.from("daily_logs").upsert(DailyLogRow(userId, op.date!!, op.payload!!)) {
                    onConflict = "user_id,log_date"
                }
                "delete-log" -> db.from("daily_logs").delete {
                    filter { eq("user_id", userId); eq("log_date", op.date!!) }
                }
                "weight" -> db.from("body_weights").upsert(BodyWeightRow(userId, op.date!!, op.kg!!)) {
                    onConflict = "user_id,log_date"
                }
                "program" -> db.from("programs").upsert(ProgramRow(userId, op.payload!!)) {
                    onConflict = "user_id"
                }
                "onboarding" -> db.from("onboarding_state").upsert(OnboardingRow(userId, op.payload!!)) {
                    onConflict = "user_id"
                }
            }
            // ระหว่างส่งอาจมีการแก้รายการเดียวกันซ้ำ — ลบเฉพาะ op ตัวที่ส่งไปจริงเท่านั้น
            pending = pending.filterNot { it === op }
            _state.update { it.copy(pendingCount = pending.size) }
            saveCache()
        }
    }

    /** รอให้ผู้ใช้หยุดพิมพ์สักครู่ค่อยส่ง ไม่ยิงทุกตัวอักษร */
    private fun scheduleFlush() {
        if (wiped) return
        flushJob?.cancel()
        flushJob = scope.launch {
            delay(1200)
            syncMutex.withLock {
                _state.update { it.copy(phase = SyncPhase.SYNCING) }
                try {
                    flushLocked()
                    _state.update { it.copy(phase = SyncPhase.IDLE, lastError = null) }
                } catch (e: Exception) {
                    _state.update { it.copy(phase = SyncPhase.OFFLINE, lastError = e.message) }
                }
            }
        }
    }

    private fun enqueue(op: PendingOp) {
        pending = pending.filterNot { it.key == op.key } + op
        _state.update { it.copy(pendingCount = pending.size) }
        saveCache()
        scheduleFlush()
    }

    /* ---------- การแก้ไขจากหน้าจอ (ตรงกับ saveDay/saveWeight/clear-day ของเว็บ) ---------- */

    /** แก้บันทึกของวันหนึ่ง โดย merge กับของเดิมเสมอ ไม่ให้ข้อมูลหมวดอื่นของวันนั้นหาย */
    fun updateLog(iso: String, change: (DailyLog) -> DailyLog) {
        val s = _state.value
        val program = s.program ?: return
        val cur = s.logs[iso] ?: DailyLog(iso)
        val next = change(cur).copy(
            date = iso,
            sessionKey = cur.sessionKey ?: Tracking.sessionKeyFor(program, iso),
            planId = cur.planId ?: program.planId,
            updatedAt = Instant.now().toString(),
        )
        val payload = encodeLog(next, s.logsRaw[iso])
        _state.update { it.copy(logs = it.logs + (iso to next), logsRaw = it.logsRaw + (iso to payload)) }
        enqueue(PendingOp("log", iso, payload = payload))
    }

    /** ล้างบันทึกทั้งวัน — ลบบน server ด้วย (เว็บเดิมลบแค่ในเครื่อง ทำให้ข้อมูลเด้งกลับมาตอนซิงก์) */
    fun clearDay(iso: String) {
        _state.update { it.copy(logs = it.logs - iso, logsRaw = it.logsRaw - iso) }
        enqueue(PendingOp("delete-log", iso))
    }

    fun saveWeight(iso: String, kg: Double) {
        _state.update { it.copy(weights = it.weights + (iso to kg)) }
        enqueue(PendingOp("weight", iso, kg = kg))
    }

    /** ตั้งวันเริ่มโปรแกรมใหม่ — แก้เฉพาะ startDate ของแผนเดิม (field อื่นใน payload คงเดิมทุกตัว) */
    fun setStartDate(iso: String) {
        val raw = _state.value.programRaw ?: return
        val next = JsonObject(raw + ("startDate" to JsonPrimitive(iso)))
        _state.update { buildState(next, it.logsRaw, it.weights, it.onboarding) }
        enqueue(PendingOp("program", payload = next))
    }

    /**
     * แก้รายการท่าของเซสชันหนึ่งในแผนที่ติดตามอยู่ (เปลี่ยน/เพิ่ม/ลบ) — แก้เฉพาะ sessions ของ payload
     * field อื่นคงเดิม เว็บอ่านท่าจาก snapshot ในแผนจึงแสดงท่าที่เลือกได้ตามปกติ
     */
    fun editSession(sessionKey: String, change: (List<com.gymbrodaily.nativeapp.domain.PlanExercise>) -> List<com.gymbrodaily.nativeapp.domain.PlanExercise>) {
        val s = _state.value
        val raw = s.programRaw ?: return
        val program = s.program ?: return
        val sessions = program.sessions.map { if (it.key == sessionKey) it.copy(exercises = change(it.exercises)) else it }
        val next = JsonObject(raw + ("sessions" to mergeRaw(raw["sessions"], jsonExplicit.encodeToJsonElement(sessions))))
        _state.update { buildState(next, it.logsRaw, it.weights, it.onboarding) }
        enqueue(PendingOp("program", payload = next))
    }

    /**
     * เริ่มโปรแกรมจากคำตอบแบบสอบถามที่บันทึกไว้ (ตรงกับปุ่ม "เริ่มโปรแกรม" ของเว็บ) — คืนข้อความ error
     * ถ้ายังสร้างไม่ได้ ด่านตรวจชุดเดียวกับเว็บ: ขอบเขตที่รองรับ + ข้อมูลสมเหตุสมผล + ความปลอดภัย
     */
    /** แก้สถานะแบบสอบถาม (คำตอบ/หมวดที่อยู่/การปรับแผน) — บันทึกลงเครื่องและซิงก์เหมือนข้อมูลอื่น */
    fun updateOnboarding(change: (Onboarding) -> Onboarding) {
        val next = change(_state.value.onb).toJson()
        _state.update { it.copy(onboarding = next) }
        enqueue(PendingOp("onboarding", payload = next))
    }

    fun startProgram(startIso: String): String? {
        val s = _state.value
        val a = s.answers
        val gate = Generator.safetyGate(a)
        val issues = Generator.sanityIssues(a)
        if (!Generator.inScope(a) || issues.isNotEmpty() || gate.blocked) {
            return "ยังสร้างตารางไม่ได้ — ข้อมูลไม่ครบหรืออยู่นอกขอบเขตที่รองรับ (" +
                (gate.reason ?: issues.firstOrNull() ?: "เป้าหมาย/สถานที่ยังไม่รองรับ") + ") กลับไปแก้แบบสอบถามก่อน"
        }
        val snap = json.encodeToJsonElement(Generator.buildPlanSnapshot(a, s.planOverrides)).jsonObject
        val now = Instant.now()
        val program = JsonObject(
            snap + mapOf(
                "startDate" to JsonPrimitive(startIso),
                "planId" to JsonPrimitive(now.toEpochMilli().toString(36)),
                "createdAt" to JsonPrimitive(now.toString()),
            ),
        )
        _state.update { buildState(program, it.logsRaw, it.weights, it.onboarding) }
        enqueue(PendingOp("program", payload = program))
        // เหมือนเว็บ: ออกจากโหมดแก้แผน กลับไปหน้าใช้งานประจำวัน
        updateOnboarding { it.copy(editPlan = false) }
        return null
    }

    fun syncNow() = scope.launch { refresh() }

    /* ---------- realtime: แก้จากเว็บ/เครื่องอื่นแล้วเห็นทันที ----------
       ฟังเฉพาะ INSERT/UPDATE ของแถวตัวเอง (ตั้งใจไม่ฟัง DELETE — ไม่ผ่าน RLS/filter ดู
       supabase/migrations/2026-10-realtime.sql) พอมี event ก็เรียก refresh() เดิม ไม่มีตรรกะผสานซ้ำ
       เรียก start/stop ตามวงจรหน้าจอ (เปิดตอน resume ปิดตอน pause) ไม่ค้างซ็อกเก็ตไว้ตอนอยู่เบื้องหลัง */
    private var rtJob: Job? = null
    private var rtChannel: RealtimeChannel? = null
    private var rtRefreshJob: Job? = null

    fun startRealtime() {
        if (wiped || rtJob?.isActive == true) return
        rtJob = scope.launch {
            try {
                val ch = db.channel("sync-$userId")
                for (table in listOf("daily_logs", "body_weights", "programs", "onboarding_state")) {
                    val f: PostgresChangeFilter.() -> Unit = {
                        this.table = table
                        filter("user_id", FilterOperator.EQ, userId)
                    }
                    ch.postgresChangeFlow<PostgresAction.Insert>("public", f).onEach { requestRefresh() }.launchIn(this)
                    ch.postgresChangeFlow<PostgresAction.Update>("public", f).onEach { requestRefresh() }.launchIn(this)
                }
                rtChannel = ch
                ch.subscribe(blockUntilSubscribed = true)
                kotlinx.coroutines.awaitCancellation()
            } catch (e: kotlinx.coroutines.CancellationException) {
                throw e
            } catch (_: Exception) {
                // เชื่อม realtime ไม่ได้ (ออฟไลน์/ยังไม่รัน migration) — ไม่กระทบการใช้งาน ยังซิงก์ตอนเปิดแอปเหมือนเดิม
            }
        }
    }

    fun stopRealtime() {
        rtJob?.cancel(); rtJob = null
        rtRefreshJob?.cancel()
        val ch = rtChannel; rtChannel = null
        if (ch != null) scope.launch { runCatching { db.realtime.removeChannel(ch) } }
    }

    /** event มาติดๆ กัน (เช่นบันทึกหลายช่อง) รวมเป็นการดึงครั้งเดียว */
    private fun requestRefresh() {
        if (wiped) return
        rtRefreshJob?.cancel()
        rtRefreshJob = scope.launch { delay(600); refresh() }
    }

    /** ล้างข้อมูลในเครื่องหลังลบบัญชีที่ server สำเร็จแล้ว: หยุดซิงก์ ทิ้งคิวที่ค้าง ลบไฟล์แคช และเคลียร์ state */
    fun wipeLocal() {
        wiped = true
        flushJob?.cancel()
        stopRealtime()
        pending = emptyList()
        _state.value = TrackState()
        scope.launch(Dispatchers.IO) { fileMutex.withLock { file.delete(); File(file.parentFile, file.name + ".tmp").delete() } }
    }
}
