package com.gymbrodaily.nativeapp

import io.github.jan.supabase.auth.Auth
import io.github.jan.supabase.createSupabaseClient
import io.github.jan.supabase.postgrest.Postgrest
import io.github.jan.supabase.serializer.KotlinXSerializer
import kotlinx.serialization.json.Json

/* anon key เป็น public key ตั้งใจฝังในแอปได้ (เหมือน supabase-client.js ฝั่งเว็บ)
   ความปลอดภัยจริงอยู่ที่ Row Level Security ใน supabase/schema.sql */
object SupabaseProvider {
    private const val URL = "https://uttlvgfhltwwdkowzckd.supabase.co"
    private const val ANON_KEY =
        "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InV0dGx2Z2ZobHR3d2Rrb3d6Y2tkIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5NDE0NjMsImV4cCI6MjEwMTUxNzQ2M30.HVY17kySYyxvHkbMefBA7Ktj2v2p-fbF8j9Uwdv1R5M"

    val client = createSupabaseClient(URL, ANON_KEY) {
        // ตารางมีคอลัมน์ที่แอปไม่ได้ใช้ (updated_at ฯลฯ) — ไม่ให้ decode ล้มเพราะ field เกิน
        defaultSerializer = KotlinXSerializer(Json { ignoreUnknownKeys = true })
        install(Auth) {
            scheme = "gymbrodailybeta"
            host = "auth-callback"
        }
        install(Postgrest)
    }
}
