package com.carlog.ui

import android.content.Intent
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.service.GpsTrackService
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var lastCheckTime: Long = 0

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)
        db = CarLogDatabase.getInstance(this)

        val tvServer = findViewById<TextView>(R.id.tvServerStatus)
        val tvGps = findViewById<TextView>(R.id.tvGpsStatus)
        val tvTrip = findViewById<TextView>(R.id.tvTripStatus)
        val tvInfo = findViewById<TextView>(R.id.tvInfo)
        val btnStart = findViewById<Button>(R.id.btnStart)
        val btnStop = findViewById<Button>(R.id.btnStop)
        val btnSettings = findViewById<Button>(R.id.btnSettings)

        // Check server connection every 30 seconds
        scope.launch {
            while (isActive) {
                checkServer(tvServer)
                checkTripStatus(tvTrip, tvInfo)
                delay(30000)
            }
        }

        // Initial check
        scope.launch { checkServer(tvServer) }

        btnStart.setOnClickListener {
            startForegroundService(Intent(this, GpsTrackService::class.java).apply {
                action = GpsTrackService.ACTION_START
            })
            tvTrip.text = "状态: ⏳ 启动中..."
            tvInfo.text = "手动启动追踪"
        }

        btnStop.setOnClickListener {
            startService(Intent(this, GpsTrackService::class.java).apply {
                action = GpsTrackService.ACTION_STOP
            })
            tvTrip.text = "状态: ⏹️ 已停止"
            tvInfo.text = "手动结束行程"
        }

        btnSettings.setOnClickListener {
            startActivity(Intent(this, SettingsActivity::class.java))
        }
    }

    private suspend fun checkServer(tv: TextView) {
        val serverUrl = db.configDao().getString("server_url") ?: "http://192.168.5.193:3012"
        try {
            withContext(Dispatchers.IO) {
                val url = java.net.URL("$serverUrl/api/auth/me")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                conn.inputStream // trigger the request
                conn.responseCode
            }
            tv.text = "🟢 已连接服务器"
            tv.setTextColor(android.graphics.Color.parseColor("#2E7D32"))
        } catch (e: Exception) {
            tv.text = "🔴 服务器离线"
            tv.setTextColor(android.graphics.Color.parseColor("#C62828"))
        }
    }

    private suspend fun checkTripStatus(tvStatus: TextView, tvInfo: TextView) {
        val active = db.tripDao().getActiveTrip()
        if (active != null && active.endTime == null) {
            val elapsed = (System.currentTimeMillis() - active.startTime) / 1000
            val mins = elapsed / 60
            val secs = elapsed % 60
            tvStatus.text = "状态: 🚗 行驶中 (${mins}分${secs}秒)"
            tvInfo.text = "本次已记录 ${active.pointCount} 个GPS点"
        } else {
            tvStatus.text = "状态: 🟢 等待行驶..."
            tvInfo.text = "行驶后自动记录"
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
