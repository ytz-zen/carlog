package com.carlog.tracker

import java.text.SimpleDateFormat
import java.util.*

object LogBuffer {
    private val logs = mutableListOf<String>()
    private val maxLines = 200
    private val dateFormat = SimpleDateFormat("HH:mm:ss", Locale.CHINA)

    fun add(tag: String, msg: String) {
        synchronized(logs) {
            val ts = dateFormat.format(Date())
            logs.add("[$ts][$tag] $msg")
            while (logs.size > maxLines) logs.removeAt(0)
        }
        // Also output to logcat
        android.util.Log.d("CarLog-$tag", msg)
    }

    fun getAll(): List<String> = synchronized(logs) { logs.toList() }

    fun clear() = synchronized(logs) { logs.clear() }
}
