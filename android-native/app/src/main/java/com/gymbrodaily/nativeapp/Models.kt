package com.gymbrodaily.nativeapp

import kotlinx.serialization.SerialName
import kotlinx.serialization.Serializable
import kotlinx.serialization.json.JsonObject

/* แถวในตาราง Supabase (ดู supabase/schema.sql) — payload เก็บ shape เดียวกับที่เว็บเขียน */

@Serializable
data class ProgramRow(
    @SerialName("user_id") val userId: String,
    val payload: JsonObject,
)

@Serializable
data class DailyLogRow(
    @SerialName("user_id") val userId: String,
    @SerialName("log_date") val logDate: String,
    val payload: JsonObject,
)

@Serializable
data class BodyWeightRow(
    @SerialName("user_id") val userId: String,
    @SerialName("log_date") val logDate: String,
    val kg: Double,
)

@Serializable
data class OnboardingRow(
    @SerialName("user_id") val userId: String,
    val payload: JsonObject,
)
