package com.gymbrodaily.nativeapp.domain

/* ============================================================
   แก้แผน: เลือกรูปแบบ / วันฝึก / วัน cardio / ความเข้มข้นรายท่า / ด่านก่อนเริ่มโปรแกรม / ความครอบคลุมกล้ามเนื้อ
   พอร์ตจาก app.js (chooseSplit, startGateError, seedPlanFromProgram, setIntensityAll, trainDayBlockMsg,
   schedDraftNext, planCoverage, programCoverage, planOutdated, programClash, progAvailDays)
   เป็นฟังก์ชันล้วน รับ/คืน PlanOverrides กับ Program เพื่อให้เทสต์ได้ — ตรวจด้วย PlanEditParityTest เทียบ golden/planedit.json
   ============================================================ */

/** ร่างวันฝึก/cardio ของโปรแกรมที่ใช้อยู่ (track.schedDraft ของเว็บ) */
data class SchedDraft(val days: List<String>, val cardioDays: List<String>, val cardioMinByDay: Map<String, Double>)

/** ผลของการกด "บันทึกวันฝึก" — error ถ้ายังบันทึกไม่ได้ ไม่งั้นคือโปรแกรมใหม่ */
data class SchedDraftResult(val error: String? = null, val next: Program? = null)

object PlanEditing {
    val MUSCLE_ORDER = listOf(
        "hpush", "incline", "chestfly", "vpush", "latraise", "reardelt", "hpull", "vpull", "biceps", "triceps",
        "squat", "lunge", "hinge", "glute", "legcurl", "calf", "core", "oblique",
    )

    /** ท่าเสริม: ถ้าไม่มีท่าที่ใช้อุปกรณ์ที่มี ข้ามได้ ไม่กระทบตารางหลัก */
    val OPTIONAL_PATTERNS = listOf("lunge", "glute", "legcurl", "calf", "incline", "chestfly", "latraise", "reardelt", "oblique", "biceps", "triceps")

    /** ส่วนที่ครอบคลุมจากเซสชันที่ได้ฝึกจริงในสัปดาห์ตามวันที่เลือก (ท่าเสริมที่ข้ามเพราะอุปกรณ์ไม่นับ) */
    fun planCoverage(split: String, trainDays: List<String>, a: Answers, plan: PlanOverrides): List<String> {
        val used = Schedule.assignSessions(split, trainDays).map { it.session }.toSet()
        val covered = mutableListOf<String>()
        Catalog.SPLIT_DEFS.getValue(split).sessions.forEach { se ->
            if (se.key !in used) return@forEach
            se.patterns.forEach { slot ->
                val b = Schedule.slotBase(slot)
                if (b !in covered && Generator.selectionFor(slot, a, plan).picked != null) covered += b
            }
        }
        return covered
    }

    fun programCoverage(p: Program): List<String> {
        val used = p.days.mapNotNull { p.dayToSession[it]?.takeIf { s -> s.isNotEmpty() } }.toSet()
        val covered = mutableListOf<String>()
        p.sessions.forEach { se ->
            if (se.key !in used) return@forEach
            se.exercises.forEach { ex -> if (ex.pattern !in covered) covered += ex.pattern }
        }
        return covered
    }

    /** แผนที่สร้างก่อนมีตารางหมุนเวียนท่า A/B/C — เซสชันไม่ตรงกับแบบปัจจุบัน */
    fun planOutdated(p: Program): Boolean {
        val def = Catalog.SPLIT_DEFS[p.splitKey] ?: return false
        return def.sessions.joinToString("|") { it.key } != p.sessions.joinToString("|") { it.key }
    }

    /** ตารางที่ใช้อยู่จริงมีวันติดกันที่ฝึกกล้ามเนื้อกลุ่มเดียวกันหรือไม่ */
    fun programClash(p: Program): SchedClash? {
        val days = Schedule.weekOrder(p.days)
        for (pr in Schedule.adjacentPairs(days)) {
            val a = Tracking.sessionDefFor(p, p.dayToSession[days[pr.first]])
            val b = Tracking.sessionDefFor(p, p.dayToSession[days[pr.second]])
            if (a == null || b == null) continue
            val g = Schedule.sessionGroups(Schedule.of(a), false).filter { it in Schedule.sessionGroups(Schedule.of(b), false) }
            if (g.isNotEmpty()) return SchedClash(days[pr.first], days[pr.second], g)
        }
        return null
    }

    /** วันว่างของโปรแกรมที่เริ่มแล้ว — แผนเก่าไม่มี availableDays ใช้คำตอบ Q2 แทน */
    fun progAvailDays(p: Program, a: Answers): List<String> {
        val avail = p.availableDays?.takeIf { it.isNotEmpty() } ?: a.list("Q2")
        return Catalog.DAYS.filter { it in avail || it in p.days }
    }

    /** ด่านสุดท้ายก่อนล็อกแผนจริง — คืนข้อความที่ยังสร้างไม่ได้ หรือ null */
    fun startGateError(a: Answers, plan: PlanOverrides): String? {
        val issues = Generator.sanityIssues(a)
        val gate = Generator.safetyGate(a)
        if (!Generator.inScope(a) || issues.isNotEmpty() || gate.blocked) {
            return "ยังสร้างตารางไม่ได้ — ข้อมูลไม่ครบหรืออยู่นอกขอบเขตที่รองรับ (" +
                (if (gate.blocked) gate.reason else (issues.firstOrNull() ?: "เป้าหมาย/สถานที่ยังไม่รองรับ")) + ") กลับไปแก้แบบสอบถามก่อน"
        }
        val split = Generator.effectiveSplit(a, plan)
        val days = Generator.planTrainDays(a, plan)
        val need = Schedule.minTrainDays(split, a.list("Q2"))
        if (days.size < need) return "ยังสร้างตารางไม่ได้ — ${Catalog.SPLIT_DEFS.getValue(split).label} ต้องมีวันฝึกอย่างน้อย $need วัน/สัปดาห์"
        val sch = Schedule.bestSchedule(Schedule.ofSplit(split), days)
        if (sch.hard != 0) return "ยังสร้างตารางไม่ได้ — ${sch.clash?.let { Schedule.clashText(it) } ?: ""} กล้ามเนื้อต้องพัก ~48 ชม. ปรับวันฝึกก่อน"
        return null
    }

    /**
     * เลือกรูปแบบโปรแกรม (null = ให้ระบบแนะนำ) — ล้างท่าที่เลือกเอง และถ้าวันที่เลือกไว้ชนกัน/ไม่พอในแบบใหม่ กลับไปใช้ชุดวันอัตโนมัติ
     * รูปแบบที่วันว่างไม่พอถูกล้างทิ้งเหมือน effectiveSplit ของเว็บ
     */
    fun chooseSplit(plan: PlanOverrides, a: Answers, key: String?): PlanOverrides {
        val p1 = Generator.sanitizeOverrides(a, plan.copy(splitOverride = key, manualPick = emptyMap()))
        val split = Generator.effectiveSplit(a, p1)
        val avail = a.list("Q2")
        val nDays = p1.trainDays?.let { Schedule.inAvailable(it, avail) }
        val reset = nDays != null && (Schedule.bestSchedule(Schedule.ofSplit(split), nDays).hard != 0 || nDays.size < Schedule.minTrainDays(split, avail))
        return if (reset) p1.copy(trainDays = null) else p1
    }

    /** ปุ่ม "เข้มข้นทั้งหมด/ทั่วไปทั้งหมด" */
    fun setIntensityAll(plan: PlanOverrides, a: Answers, intense: Boolean): PlanOverrides {
        if (!intense) return plan.copy(intensity = emptyMap())
        val out = LinkedHashMap<String, String>()
        Catalog.SPLIT_DEFS.getValue(Generator.effectiveSplit(a, plan)).sessions.forEach { se ->
            se.patterns.forEach { pt ->
                val pk = Generator.selectionFor(pt, a, plan).picked
                if (pk != null && Progression.intensityEligible(pk.exercise.pattern, pk.equip)) out[pt] = "intense"
            }
        }
        return plan.copy(intensity = out)
    }

    /** กด "แก้ไขแผน": ตั้งวันฝึก/cardio/ความเข้มข้นในแบบสอบถามจากโปรแกรมที่ใช้อยู่ */
    fun seedPlanFromProgram(plan: PlanOverrides, p: Program): PlanOverrides {
        val mins = p.cardioDays.associateWith { ProgressGoal.cardioMinFor(p, it) }
        val intensity = LinkedHashMap<String, String>()
        p.sessions.forEach { se -> se.exercises.forEach { ex -> if (ex.intensity == "intense") intensity[ex.slot?.takeIf { it.isNotEmpty() } ?: ex.pattern] = "intense" } }
        return plan.copy(trainDays = p.days, cardioDays = p.cardioDays, cardioMinByDay = mins, intensity = intensity)
    }

    /** เพิ่มวันนี้เป็นวันฝึกแล้วกล้ามเนื้อกลุ่มเดียวกันชนกันในวันติดกันไหม — คืนข้อความห้าม หรือ null ถ้าเพิ่มได้ */
    fun trainDayBlockMsg(sessions: List<SchedSession>, list: List<String>, day: String): String? {
        val cur = Schedule.bestSchedule(sessions, list)
        val next = Schedule.bestSchedule(sessions, list + day)
        if (cur.hard == 0 && next.hard != 0) {
            return "เลือก${day}เป็นวันฝึกไม่ได้ — จะทำให้${next.clash?.let { Schedule.clashText(it) } ?: ""} กล้ามเนื้อต้องพัก ~48 ชม. (วันนี้ใช้เป็นวันพักหรือวัน cardio ได้)"
        }
        return null
    }

    fun openSchedDraft(p: Program) = SchedDraft(p.days, p.cardioDays, p.cardioDays.associateWith { ProgressGoal.cardioMinFor(p, it) })

    /** ผลของการกด "บันทึกวันฝึก" (ท่า/เป้าหมายเดิมไม่เปลี่ยน — วันที่ล็อกแล้วมี snapshot ของตัวเอง) */
    fun schedDraftNext(p: Program, dr: SchedDraft, a: Answers): SchedDraftResult {
        val avail = progAvailDays(p, a)
        val need = Schedule.minTrainDays(p.splitKey, avail)
        if (dr.days.size < need) return SchedDraftResult(error = "ยังบันทึกไม่ได้ — ${p.splitLabel} ต้องมีวันฝึกอย่างน้อย $need วัน/สัปดาห์")
        val sch = Schedule.bestSchedule(p.sessions.map { Schedule.of(it) }, dr.days)
        if (sch.hard != 0) {
            return SchedDraftResult(error = "ยังบันทึกไม่ได้ — ${sch.clash?.let { Schedule.clashText(it) } ?: ""} กล้ามเนื้อต้องพัก ~48 ชม. เอาวันใดวันหนึ่งออกก่อน")
        }
        return SchedDraftResult(
            next = p.copy(
                days = dr.days, dayToSession = sch.list.associate { it.day to it.session }, cardioDays = dr.cardioDays,
                cardioMinByDay = Generator.minsForDays(dr.cardioMinByDay, dr.cardioDays), availableDays = avail,
            ),
        )
    }
}
