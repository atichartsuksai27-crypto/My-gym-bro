package com.gymbrodaily.nativeapp.domain

import kotlin.math.max

/* ============================================================
   การแก้บันทึกรายวันที่ผูกกับ progressive overload — พอร์ตจากตัวจัดการ event ของเว็บ
   (withPlan / ex-done / set / feel / prog-revert / prog-reapply / warmup / symptom / sess-complete / stress)
   เป็นฟังก์ชันล้วน รับสถานะแล้วคืนบันทึกใหม่ เพื่อให้เทสต์ได้โดยไม่ต้องมี UI
   ============================================================ */
object DayActions {

    /** วันนี้ยังไม่ได้บันทึกเซ็ตของท่านี้ → ใช้ค่าที่ระบบตั้งให้จากครั้งก่อน พร้อมจดว่าปรับจากครั้งก่อนอย่างไร (withPlan ของเว็บ) */
    fun planIfNoSets(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?): ExerciseLog {
        val cur = e ?: ExerciseLog()
        if (Progression.hasSets(cur)) return cur
        val plan = Progression.progressionPlan(t, ex, iso) ?: return cur
        return cur.copy(sets = plan.sets, prog = Progression.progRecord(plan))
    }

    /** ติ๊กทำท่าแล้ว = ทำตามค่าที่ตั้งให้ · เอาติ๊กออกไม่แตะเซ็ต */
    fun setDone(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?, done: Boolean): ExerciseLog =
        if (done) planIfNoSets(t, iso, ex, e).copy(done = true) else (e ?: ExerciseLog()).copy(done = false)

    /** กดความรู้สึกเดิมซ้ำ = ล้าง */
    fun toggleFeel(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?, k: String): ExerciseLog =
        planIfNoSets(t, iso, ex, e).copy(feel = if (e?.feel == k) null else k)

    /** เขียนเซ็ตทั้งชุด (ช่องที่แสดงอยู่ทุกช่อง) — ถ้ายังไม่เคยบันทึกและมีค่าที่ระบบตั้งให้ ให้จดว่ามาจากการปรับครั้งก่อนด้วย */
    fun writeSets(t: TrackData, iso: String, ex: PlanExercise, e: ExerciseLog?, sets: List<SetEntry?>): ExerciseLog {
        val cur = e ?: ExerciseLog()
        if (!Progression.hasSets(cur)) {
            val plan = Progression.progressionPlan(t, ex, iso)
            if (plan != null) return cur.copy(sets = sets, prog = Progression.progRecord(plan))
        }
        return cur.copy(sets = sets)
    }

    /** "ไม่ไหว — กลับไปค่าเดิม" */
    fun revert(plan: LoadPlan, e: ExerciseLog?): ExerciseLog {
        val c = plan.change
        return (e ?: ExerciseLog()).copy(sets = plan.base, prog = ProgRec(c?.kind, c?.from, c?.to, reverted = true))
    }

    /** "ใช้ค่าที่ระบบเพิ่มให้" */
    fun reapply(plan: LoadPlan, e: ExerciseLog?): ExerciseLog =
        (e ?: ExerciseLog()).copy(sets = plan.sets, prog = Progression.progRecord(plan))

    fun setWarmup(e: ExerciseLog?, idx: Int, checked: Boolean): ExerciseLog {
        val cur = e ?: ExerciseLog()
        val flags = (0 until max(cur.warmup.size, idx + 1)).map { cur.warmup.getOrNull(it) == true }.toMutableList()
        flags[idx] = checked
        return cur.copy(warmup = flags)
    }

    fun saveSymptom(e: ExerciseLog?, text: String, name: String): ExerciseLog {
        val tx = jsTrim(text).take(200)
        return (e ?: ExerciseLog()).copy(symptom = if (tx.isEmpty()) null else Symptom(tx, DayExtras.analyzeSymptom(tx).level, name))
    }

    /** กดชิปอาการ = ต่อท้ายข้อความเดิมด้วย ", " */
    fun symptomWithChip(e: ExerciseLog?, chip: String, name: String): ExerciseLog {
        val cur = e?.symptom?.text.orEmpty()
        return saveSymptom(e, if (cur.isNotEmpty()) "$cur, $chip" else chip, name)
    }

    /** ทำครบทั้งเซสชัน = ท่าที่ยังไม่ได้กรอกใช้ค่าที่ระบบตั้งให้ (ไม่แตะ done) */
    fun completeSession(t: TrackData, iso: String, sess: PlanSession?, log: DailyLog, checked: Boolean): DailyLog {
        if (!checked) return log.copy(completed = false)
        val exs = log.exercises.toMutableMap()
        sess?.exercises?.forEach { ex ->
            val ce = exs[ex.id] ?: ExerciseLog()
            if (Progression.hasSets(ce)) return@forEach
            val plan = Progression.progressionPlan(t, ex, iso) ?: return@forEach
            exs[ex.id] = ce.copy(sets = plan.sets, prog = Progression.progRecord(plan))
        }
        return log.copy(completed = true, exercises = exs)
    }

    /** ขั้นน้ำหนักที่อุปกรณ์ของผู้ใช้เพิ่มได้จริงรายท่า (null/0 = อัตโนมัติ) */
    fun withEquipStep(steps: Map<String, Double>, exId: String, v: Double?): Map<String, Double> =
        if (v != null && v > 0) steps + (exId to v) else steps - exId

    fun setStressLevel(s: StressLog?, v: Int): StressLog {
        val cur = s ?: StressLog()
        return cur.copy(level = if (cur.level != null && cur.level == v.toDouble()) null else v.toDouble())
    }
    fun setStressNote(s: StressLog?, note: String): StressLog = (s ?: StressLog()).copy(note = jsTrim(note).take(200))
    fun stressNoteWithChip(s: StressLog?, chip: String): StressLog {
        val sn = s?.note.orEmpty()
        return (s ?: StressLog()).copy(note = (if (sn.isNotEmpty()) "$sn, $chip" else chip).take(200))
    }
}
