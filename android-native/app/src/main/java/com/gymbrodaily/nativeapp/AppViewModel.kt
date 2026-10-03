package com.gymbrodaily.nativeapp

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.gymbrodaily.nativeapp.data.TrackStore

/** ถือ TrackStore ของผู้ใช้ที่ล็อกอินอยู่ไว้ข้ามการหมุนจอ/สร้าง Activity ใหม่ */
class AppViewModel(app: Application) : AndroidViewModel(app) {
    private var current: Pair<String, TrackStore>? = null

    fun storeFor(userId: String): TrackStore {
        current?.let { (id, store) -> if (id == userId) return store }
        return TrackStore(getApplication(), userId, viewModelScope).also { current = userId to it }
    }
}
