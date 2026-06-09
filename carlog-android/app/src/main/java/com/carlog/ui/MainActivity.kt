package com.carlog.ui

import android.content.Intent
import android.location.LocationManager
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
    private var lastRefreshTime: Long = 0

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
        val btnRefresh = findViewById<ImageButton>(R.id.btnRefresh)

        // Periodic connection check (every 30s)
        scope.launch {
            while (isActive) {
                checkServer(tvServer)
                checkGps(tvGps)
                checkTripStatus(tvTrip, tvInfo)
                delay(30000)
            }
        }

        // Manual refresh
        btnRefresh.setOnClickListener {
            // Show immediate feedback
            tvServer.text = "🔄 刷新中..."
            tvServer.setTextColor(android.graphics.Color.parseColor("#FF9800"))
            scope.launch {
                checkServer(tvServer)
                checkGps(tvGps)
                checkTripStatus(tvTrip, tvInfo)
                Toast.makeText(this@MainActivity, "已刷新", Toast.LENGTH_SHORT).show()
            }
        }

        // Initial check
        scope.launch {
            checkServer(tvServer)
            checkGps(tvGps)
        }

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

        findViewById<Button>(R.id.btnDiagnostic).setOnClickListener {
            startActivity(Intent(this, DiagnosticActivity::class.java))
        }
    }

    private suspend fun checkServer(tv: TextView) {
        val serverUrl = db.configDao().getString("server_url") ?: "http://192.168.5.193:3012"
        try {
            val start = System.currentTimeMillis()
            val ok = withContext(Dispatchers.IO) {
                try {
                    val url = java.net.URL("$serverUrl/api/auth/me")
                    val conn = url.openConnection() as java.net.HttpURLConnection
                    conn.connectTimeout = 5000
                    conn.readTimeout = 5000
                    conn.inputStream
                    conn.responseCode in 200..499
                } catch (e: Exception) { false }
            }
            val ms = System.currentTimeMillis() - start
            if (ok) {
                tv.text = "🟢 已连接 (${ms}ms)"
                tv.setTextColor(android.graphics.Color.parseColor("#2E7D32"))
            } else {
                tv.text = "🔴 无法连接"
                tv.setTextColor(android.graphics.Color.parseColor("#C62828"))
            }
        } catch (e: Exception) {
            tv.text = "🔴 服务器离线"
            tv.setTextColor(android.graphics.Color.parseColor("#C62828"))
        }
    }

    private fun checkGps(tv: TextView) {
        val lm = getSystemService(LOCATION_SERVICE) as? LocationManager
        val gpsOn = lm?.isProviderEnabled(LocationManager.GPS_PROVIDER) == true
        if (gpsOn) {
            tv.text = "📡 GPS: 已开启"
            tv.setTextColor(android.graphics.Color.parseColor("#2E7D32"))
        } else {
            tv.text = "📡 GPS: 未开启"
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
            tvInfo.text = "已记录 ${active.pointCount} 个GPS点"
            // Also identify car if not done yet
            if (carId == null) identifyCar()
        } else {
            tvStatus.text = "状态: 🟢 等待行驶..."
            tvInfo.text = "行驶后自动记录"
        }
    }

    private var carId: String? = null
    private var tankId: String? = null

    private suspend fun identifyCar() {
        val carName = db.configDao().getString("car_name") ?: return
        val (cId, tId) = withContext(Dispatchers.IO) {
            try {
                val baseUrl = db.configDao().getString("server_url") ?: "http://192.168.5.193:3012"
                val apiKey = db.configDao().getString("api_key") ?: return@withContext null to null
                val url = java.net.URL("$baseUrl/api/cars/identify")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.requestMethod = "POST"
                conn.setRequestProperty("Content-Type", "application/json")
                conn.setRequestProperty("X-API-Key", apiKey)
                conn.doOutput = true
                conn.outputStream.write("{\"carName\":\"$carName\"}".toByteArray())
                conn.outputStream.close()
                if (conn.responseCode == 200) {
                    val body = conn.inputStream.bufferedReader().readText()
                    val json = com.google.gson.Gson().fromJson(body, Map::class.java)
                    json["carId"] as? String to json["tankId"] as? String
                } else null to null
            } catch (e: Exception) { null to null }
        }
        if (cId != null && tId != null) {
            carId = cId; tankId = tId
            db.configDao().saveString("car_id", cId)
            db.configDao().saveString("tank_id", tId)
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
