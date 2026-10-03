package com.gymbrodaily.nativeapp

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable

/* shape ตรงกับตารางใน supabase/schema.sql (payload เป็น jsonb ที่ app.js เดิมเขียนไว้) */
@Serializable
data class DailyLogRow(@SerialName("log_date") val logDate: String)

@Serializable
data class BodyWeightRow(@SerialName("log_date") val logDate: String, val kg: Double)
