package com.carlog.ui

import android.content.Intent
import android.location.LocationManager
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AlertDialog
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.service.GpsTrackService
import kotlinx.coroutines.*

class MainActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private var lastRefreshTime: Long = 0
    private var obdReader: com.carlog.tracker.ObdReader? = null
    private var obdConnected = false
    private lateinit var historyAdapter: HistoryTripAdapter
    private lateinit var btnObd: Button
    private lateinit var btnStart: Button

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        setContentView(R.layout.activity_main)
        db = CarLogDatabase.getInstance(this)

        // View references
        val tvServer = findViewById<TextView>(R.id.tvServerStatus)
        val tvGps = findViewById<TextView>(R.id.tvGpsStatus)
        val tvTripMode = findViewById<TextView>(R.id.tvTripMode)
        val tvTripDuration = findViewById<TextView>(R.id.tvTripDuration)
        val tvTripPoints = findViewById<TextView>(R.id.tvTripPoints)
        val tvGpsData = findViewById<TextView>(R.id.tvGpsData)
        val tvObdData = findViewById<TextView>(R.id.tvObdData)
        val btnStart = findViewById<Button>(R.id.btnStart).also { this.btnStart = it }
        val btnStop = findViewById<Button>(R.id.btnStop)
        val btnRefresh = findViewById<ImageButton>(R.id.btnRefresh)
        val btnObd = findViewById<Button>(R.id.btnObdConnect).also { this.btnObd = it }
        val lvHistory = findViewById<ListView>(R.id.lvHistoryTrips)

        // Init history adapter
        historyAdapter = HistoryTripAdapter(this, emptyList())
        lvHistory.adapter = historyAdapter

        // Periodic refresh every 5s
        scope.launch {
            while (isActive) {
                checkServer(tvServer)
                checkGps(tvGps, tvGpsData)
                checkTripStatus(tvTripMode, tvTripDuration, tvTripPoints, btnStart)
                loadHistoryTrips(lvHistory)
                delay(5000)
            }
        }

        // Manual refresh
        btnRefresh.setOnClickListener {
            scope.launch {
                tvServer.text = "🔄 刷新中..."
                tvServer.setTextColor(android.graphics.Color.parseColor("#FF9800"))
                checkServer(tvServer)
                checkGps(tvGps, tvGpsData)
                checkTripStatus(tvTripMode, tvTripDuration, tvTripPoints, btnStart)
                loadHistoryTrips(lvHistory)
                Toast.makeText(this@MainActivity, "已刷新", Toast.LENGTH_SHORT).show()
            }
        }

        // Auto start tracking
        scope.launch {
            checkServer(tvServer)
            checkGps(tvGps, tvGpsData)
            startForegroundService(Intent(this@MainActivity, GpsTrackService::class.java).apply {
                action = "com.carlog.START_TRACKING"
            })
        }

        // Manual start
        btnStart.setOnClickListener {
            startForegroundService(Intent(this, GpsTrackService::class.java).apply {
                action = "com.carlog.FORCE_START"
            })
        }

        // Stop
        btnStop.setOnClickListener {
            AlertDialog.Builder(this)
                .setTitle("结束行程")
                .setMessage("确定结束当前行程？")
                .setPositiveButton("确定") { _, _ ->
                    startService(Intent(this, GpsTrackService::class.java).apply {
                        action = GpsTrackService.ACTION_STOP
                    })
                }
                .setNegativeButton("取消", null)
                .show()
        }

        // OBD toggle
        btnObd.setOnClickListener {
            scope.launch { handleObdToggle(tvObdData) }
        }

        // Settings + Diagnostic nav (bottom bar via navigation if added, or keep as-is)
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
                tv.setTextColor(android.graphics.Color.parseColor("#22c55e"))
            } else {
                tv.text = "🔴 无法连接"
                tv.setTextColor(android.graphics.Color.parseColor("#ef4444"))
            }
        } catch (e: Exception) {
            tv.text = "🔴 服务器离线"
            tv.setTextColor(android.graphics.Color.parseColor("#ef4444"))
        }
    }

    private fun checkGps(tvHeader: TextView, tvData: TextView) {
        val lm = getSystemService(LOCATION_SERVICE) as? LocationManager ?: return
        val gpsOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
        val hasPermission = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == 0

        if (!gpsOn || !hasPermission) {
            tvHeader.text = "📡 GPS: 未开启"
            tvHeader.setTextColor(android.graphics.Color.parseColor("#ef4444"))
            tvData.text = "请开启位置信息并授予定位权限"
            tvData.setTextColor(android.graphics.Color.parseColor("#ef4444"))
            return
        }

        val lastLoc = try { lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (_: Exception) { null }
        if (lastLoc != null && (System.currentTimeMillis() - lastLoc.time) < 60000) {
            tvHeader.text = "🟢 GPS: 已定位"
            tvHeader.setTextColor(android.graphics.Color.parseColor("#22c55e"))
            val speed = lastLoc.speed * 3.6f
            tvData.text = buildString {
                append("纬度: %.5f\n".format(lastLoc.latitude))
                append("经度: %.5f\n".format(lastLoc.longitude))
                append("速度: %.1f km/h\n".format(speed))
                append("精度: %.0f m | 高度: %.0f m".format(lastLoc.accuracy, lastLoc.altitude))
            }
            tvData.setTextColor(android.graphics.Color.parseColor("#cbd5e1"))
        } else {
            tvHeader.text = "🟡 GPS: 搜星中..."
            tvHeader.setTextColor(android.graphics.Color.parseColor("#f59e0b"))
            tvData.text = lastLoc?.let {
                "最后: %.5f, %.5f\n请到室外开阔处".format(it.latitude, it.longitude)
            } ?: "搜索GPS信号中..."
            tvData.setTextColor(android.graphics.Color.parseColor("#f59e0b"))
        }
    }

    private suspend fun checkTripStatus(
        tvMode: TextView, tvDuration: TextView, tvPoints: TextView, btnStart: Button
    ) {
        val active = db.tripDao().getActiveTrip()
        val carId = db.configDao().getString("car_id")
        val trackingMode = db.configDao().getString("tracking_mode")

        if (active != null && active.endTime == null) {
            btnStart.isEnabled = false
            btnStart.alpha = 0.5f

            // 显示自动/手动
            val modeText = if (trackingMode == "manual") "🔵 手动记录" else "🟢 自动记录"
            tvMode.text = modeText

            val elapsed = (System.currentTimeMillis() - active.startTime) / 1000
            val hours = elapsed / 3600
            val mins = (elapsed % 3600) / 60
            val secs = elapsed % 60
            tvDuration.text = if (hours > 0) {
                "%d:%02d:%02d".format(hours, mins, secs)
            } else {
                "%02d:%02d".format(mins, secs)
            }
            tvDuration.setTextColor(android.graphics.Color.parseColor("#e2e8f0"))

            // 获取已上传点数
            val uploaded = withContext(Dispatchers.IO) {
                db.tripDao().getUploadedPointCount(active.id)
            }
            tvPoints.text = "已记录 ${active.pointCount} 点 | 已上传 $uploaded"
            tvPoints.setTextColor(android.graphics.Color.parseColor("#94a3b8"))
        } else {
            btnStart.isEnabled = true
            btnStart.alpha = 1f
            tvMode.text = "🟢 等待行驶..."
            tvMode.setTextColor(android.graphics.Color.parseColor("#64748b"))
            tvDuration.text = "--:--:--"
            tvDuration.setTextColor(android.graphics.Color.parseColor("#64748b"))
            tvPoints.text = "行驶后自动记录GPS轨迹"
            tvPoints.setTextColor(android.graphics.Color.parseColor("#64748b"))
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

    /** 加载历史行程列表 */
    private suspend fun loadHistoryTrips(lv: ListView) {
        withContext(Dispatchers.IO) {
            try {
                val baseUrl = db.configDao().getString("server_url") ?: "http://192.168.5.193:3012"
                val apiKey = db.configDao().getString("api_key")
                if (apiKey.isNullOrBlank()) {
                    withContext(Dispatchers.Main) {
                        historyAdapter = HistoryTripAdapter(this@MainActivity, emptyList())
                        lv.adapter = historyAdapter
                    }
                    return@withContext
                }
                val url = java.net.URL("$baseUrl/api/trips?limit=20")
                val conn = url.openConnection() as java.net.HttpURLConnection
                conn.setRequestProperty("X-API-Key", apiKey)
                conn.connectTimeout = 5000
                conn.readTimeout = 5000
                if (conn.responseCode !in 200..299) {
                    throw Exception("HTTP ${conn.responseCode}")
                }
                val body = conn.inputStream.bufferedReader().readText()
                val json = com.google.gson.Gson().fromJson(body, Map::class.java)
                val trips = json["trips"] as? List<Map<*, *>> ?: emptyList<Any>()
                val tripList = trips.mapNotNull { t ->
                    @Suppress("UNCHECKED_CAST")
                    val tMap = t as Map<String, Any>
                    TripSummary(
                        startTime = tMap["startTime"] as? String ?: "",
                        endTime = tMap["endTime"] as? String ?: "",
                        duration = (tMap["duration"] as? Number)?.toInt() ?: 0,
                        distance = (tMap["distance"] as? Number)?.toFloat() ?: 0f,
                    )
                }
                withContext(Dispatchers.Main) {
                    historyAdapter = HistoryTripAdapter(this@MainActivity, tripList)
                    lv.adapter = historyAdapter
                }
            } catch (e: Exception) {
                withContext(Dispatchers.Main) {
                    historyAdapter = HistoryTripAdapter(this@MainActivity, emptyList())
                    lv.adapter = historyAdapter
                }
            }
        }
    }

    data class TripSummary(
        val startTime: String,
        val endTime: String?,
        val duration: Int,
        val distance: Float,
    )

    /** OBD 连接/断开 */
    private suspend fun handleObdToggle(tvObd: TextView) {
        val btn = btnObd
        if (obdConnected) {
            obdReader?.disconnect()
            obdReader = null
            obdConnected = false
            btn.text = "连接 OBD"
            tvObd.text = "未连接"
            tvObd.setTextColor(android.graphics.Color.parseColor("#ef4444"))
        } else {
            btn.text = "连接中..."
            withContext(Dispatchers.IO) {
                val reader = com.carlog.tracker.ObdReader()
                val devices = reader.listBondedDevices()
                val device = reader.findObdDevice()
                    ?: if (devices.isNotEmpty()) devices[0] else null

                if (device != null) {
                    val err = reader.connect(device)
                    if (err == null) {
                        obdReader = reader
                        obdConnected = true
                        val data = reader.readData()
                        withContext(Dispatchers.Main) {
                            updateObdDisplay(tvObd, data)
                            btn.text = "断开 OBD"
                        }
                        return@withContext
                    }
                }
                withContext(Dispatchers.Main) {
                    btn.text = "连接 OBD"
                    tvObd.text = "⚠️ 连接失败"
                    tvObd.setTextColor(android.graphics.Color.parseColor("#ef4444"))
                }
            }
        }
    }

    private fun updateObdDisplay(tv: TextView, data: com.carlog.tracker.ObdData) {
        tv.text = buildString {
            append("✅ 已连接\n")
            data.fuelLevel?.let { append("⛽ 油量: %.1f%%\n".format(it)) }
            data.rpm?.let { append("🔄 转速: ${it} RPM\n") }
            data.speed?.let { append("🚗 车速: %.0f km/h\n".format(it)) }
            data.coolantTemp?.let { append("🌡️ 水温: ${it}°C\n") }
            if (length > 0) deleteCharAt(length - 1) // remove trailing newline
        }
        tv.setTextColor(android.graphics.Color.parseColor("#38bdf8"))
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
