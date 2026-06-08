package com.carlog.ui

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.service.GpsTrackService

class MainActivity : AppCompatActivity() {
    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        val btnStart = findViewById<Button>(R.id.btnStart)
        val btnStop = findViewById<Button>(R.id.btnStop)
        val btnSettings = findViewById<Button>(R.id.btnSettings)

        btnStart.setOnClickListener {
            startForegroundService(Intent(this, GpsTrackService::class.java).apply {
                action = GpsTrackService.ACTION_START
            })
            Toast.makeText(this, "开始行驶记录", Toast.LENGTH_SHORT).show()
        }

        btnStop.setOnClickListener {
            startService(Intent(this, GpsTrackService::class.java).apply {
                action = GpsTrackService.ACTION_STOP
            })
            Toast.makeText(this, "停止行驶记录", Toast.LENGTH_SHORT).show()
        }

        btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }
}
