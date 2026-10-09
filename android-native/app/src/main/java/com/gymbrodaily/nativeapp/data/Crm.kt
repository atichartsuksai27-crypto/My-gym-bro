package com.gymbrodaily.nativeapp.data

import android.content.Context
import com.gymbrodaily.nativeapp.SupabaseProvider
import io.github.jan.supabase.postgrest.postgrest
import kotlinx.serialization.json.buildJsonObject
import kotlinx.serialization.json.put

/**
 * ส่งสัญญาณ "ผู้ใช้เปิดแอป" ไปที่ crm_profiles (ฟังก์ชัน touch_crm_profile ใน supabase/schema.sql)
 * ส่งแค่แพลตฟอร์ม + เวอร์ชันแอป ไม่ส่งข้อมูลสุขภาพใดๆ — ล้มเหลวเงียบๆ ได้ (ออฟไลน์ หรือยังไม่ได้รัน SQL)
 * เพราะเป็นข้อมูลเสริมที่ไม่ควรกระทบการใช้งานแอป
 */
object Crm {
    private var lastTouch = 0L

    suspend fun touch(context: Context) {
        val now = System.currentTimeMillis()
        if (now - lastTouch < 10 * 60_000) return // กันยิงทุกครั้งที่สลับแอปไปมา
        val version = runCatching { context.packageManager.getPackageInfo(context.packageName, 0).versionName }.getOrNull()
        runCatching {
            SupabaseProvider.client.postgrest.rpc(
                "touch_crm_profile",
                buildJsonObject { put("p_platform", "android"); put("p_app_version", version ?: "") },
            )
            lastTouch = now
        }
    }
}
