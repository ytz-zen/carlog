package com.carlog.ui

import android.content.Intent
import android.location.LocationManager
import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.repo.UploadRepo
import com.carlog.tracker.ObdReader
import com.carlog.tracker.ObdData
import com.carlog.tracker.LogBuffer
import com.google.gson.Gson
import kotlinx.coroutines.*

class DiagnosticActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private lateinit var uploadRepo: UploadRepo
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val gson = Gson()
    private var obdReader: ObdReader? = null
    private var obdConnected = false

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        setContentView(R.layout.activity_diagnostic)
        db = CarLogDatabase.getInstance(this)
        uploadRepo = UploadRepo(this, db)

        val tvGps = findViewById<TextView>(R.id.diagGpsInfo)
        val tvServer = findViewById<TextView>(R.id.diagServerInfo)
        val tvLocal = findViewById<TextView>(R.id.diagLocalInfo)
        val tvConfig = findViewById<TextView>(R.id.diagConfigInfo)
        val tvLog = findViewById<TextView>(R.id.diagLog)

        // Refresh all on load
        scope.launch { refreshAll(tvGps, tvServer, tvLocal, tvConfig) }

        // GPS refresh button
        findViewById<Button>(R.id.btnRefreshGps).setOnClickListener {
            scope.launch { refreshGps(tvGps); addLog(tvLog, "GPS 已刷新") }
        }

        // Test connection
        findViewById<Button>(R.id.btnTestConn).setOnClickListener {
            scope.launch {
                addLog(tvLog, "测试连接中...")
                refreshServer(tvServer)
            }
        }

        // Test upload
        findViewById<Button>(R.id.btnTestUpload).setOnClickListener {
            scope.launch {
                addLog(tvLog, "========== 开始测试 ==========")
                
                // 1. 测试 identifyCar
                val carName = db.configDao().getString("car_name") ?: "(未设置)"
                addLog(tvLog, "🚗 车辆名称: $carName")
                val result = withContext(Dispatchers.IO) {
                    uploadRepo.identifyCar(carName)
                }
                if (result != null) {
                    addLog(tvLog, "✅ identifyCar 成功")
                    addLog(tvLog, "   carId: ${result.carId}")
                    addLog(tvLog, "   tankId: ${result.tankId}")
                    addLog(tvLog, "   isNew: ${result.isNew}")
                } else {
                    addLog(tvLog, "❌ identifyCar 返回 null")
                }
                
                // 2. 测试上传
                val active = db.tripDao().getActiveTrip()
                if (active != null && active.endTime == null) {
                    val pending = db.tripDao().getPendingPointCount(active.id)
                    addLog(tvLog, "📍 当前行程 ${pending} 个未上传GPS点")
                    if (pending > 0) {
                        uploadRepo.uploadPendingPoints(active.id)
                        addLog(tvLog, "⬆️ 已尝试上传 $pending 个点")
                    } else {
                        addLog(tvLog, "ℹ️ 当前行程无待上传的点")
                    }
                } else {
                    addLog(tvLog, "ℹ️ 当前没有进行中的行程")
                }
                
                addLog(tvLog, "========== 测试完成 ==========")
                refreshLocal(tvLocal)
            }
        }

        // Clean data
        findViewById<Button>(R.id.btnCleanData).setOnClickListener {
            scope.launch {
                addLog(tvLog, "清除未上传数据...")
                val pending = db.tripDao().getPendingTrips()
                pending.collect { trips ->
                    for (t in trips) {
                        db.tripDao().deleteGpsPoints(t.id)
                        db.tripDao().updateUploadState(t.id, "CLEANED")
                        addLog(tvLog, "🗑️ 已清除行程 ${t.id} 的未上传数据")
                    }
                }
                refreshLocal(tvLocal)
            }
        }

        // OBD Connect
        val tvObd = findViewById<TextView>(R.id.diagObdInfo)
        findViewById<Button>(R.id.btnObdConnect).setOnClickListener {
            scope.launch { handleObdToggle(tvObd, tvLog) }
        }

        // 定时刷新日志和GPS（每5秒）
        scope.launch {
            while (isActive) {
                refreshLog(tvLog)
                refreshGps(tvGps)
                delay(5000)
            }
        }

        // 日志可滚动
        tvLog.movementMethod = android.text.method.ScrollingMovementMethod()
    }

    private suspend fun handleObdToggle(tvObd: TextView, tvLog: TextView) {
        val btn = findViewById<Button>(R.id.btnObdConnect)
        if (obdConnected) {
            obdReader?.disconnect(); obdReader = null; obdConnected = false
            btn.text = "连接 OBD"; tvObd.text = "未连接"; addLog(tvLog, "🔌 OBD 已断开")
        } else {
            btn.text = "连接中..."; addLog(tvLog, "🔌 正在搜索 OBD 设备...")
            withContext(Dispatchers.IO) {
                val reader = ObdReader()
                // 列出所有蓝牙设备
                val devices = reader.listBondedDevices()
                addLog(tvLog, "🔍 已配对蓝牙设备: ${devices.size}个")
                for (d in devices) {
                    addLog(tvLog, "  ${d.name} (${d.address})")
                }
                val device = reader.findObdDevice()
                if (device != null) {
                    addLog(tvLog, "🔌 找到设备: ${device.name}")
                    val err = reader.connect(device)
                    if (err == null) {
                        obdReader = reader; obdConnected = true
                        val data = reader.readData()
                        withContext(Dispatchers.Main) {
                            updateObdDisplay(tvObd, data)
                            btn.text = "断开 OBD"
                            addLog(tvLog, "✅ OBD 连接成功 油量: ${data.fuelLevel?.let{"%.1f%%".format(it)} ?: "读取中"}")
                        }
                    } else {
                        withContext(Dispatchers.Main) { btn.text = "连接 OBD"; tvObd.text = "❌ $err"; addLog(tvLog, "❌ OBD 连接失败: $err") }
                    }
                } else if (devices.isNotEmpty()) {
                    // 自动查找没找到，尝试逐个连接
                    addLog(tvLog, "⚠️ 未识别到OBD设备，逐个尝试连接...")
                    for (d in devices) {
                        addLog(tvLog, "尝试连接: ${d.name}")
                        val err = reader.connect(d)
                        if (err == null) {
                            obdReader = reader; obdConnected = true
                            val data = reader.readData()
                            withContext(Dispatchers.Main) {
                                updateObdDisplay(tvObd, data)
                                btn.text = "断开 OBD"
                                addLog(tvLog, "✅ OBD 连接成功 (${d.name})")
                            }
                            return@withContext
                        }
                        addLog(tvLog, "  ${d.name} 连接失败: $err")
                    }
                    withContext(Dispatchers.Main) {
                        btn.text = "连接 OBD"
                        tvObd.text = "⚠️ 所有设备连接失败\n车机自带OBD应用可能占用了连接"
                        addLog(tvLog, "❌ 所有设备连接失败")
                    }
                } else {
                    withContext(Dispatchers.Main) { btn.text = "连接 OBD"; tvObd.text = "⚠️ 未找到已配对的 OBD 设备\n请先在系统蓝牙设置中配对"; addLog(tvLog, "⚠️ 未找到已配对的 OBD 设备") }
                }
            }
        }
    }

    private fun updateObdDisplay(tv: TextView, data: com.carlog.tracker.ObdData) {
        tv.text = buildString {
            append(if (data.connected) "✅ 已连接" else "未连接"); append('\n')
            data.fuelLevel?.let { append("⛽ 油量: %.1f%%".format(it)); append('\n') }
            data.rpm?.let { append("🔄 转速: ${it} RPM"); append('\n') }
            data.speed?.let { append("🚗 车速: %.0f km/h".format(it)); append('\n') }
            data.coolantTemp?.let { append("🌡️ 水温: ${it}°C"); append('\n') }
            data.error?.let { append("⚠️ 错误: $it") }
        }
    }

    private suspend fun refreshAll(tvGps: TextView, tvServer: TextView, tvLocal: TextView, tvConfig: TextView) {
        refreshServer(tvServer)
        refreshLocal(tvLocal)
        refreshConfig(tvConfig)
    }

    private fun refreshGps(tv: TextView) {
        val lm = getSystemService(LOCATION_SERVICE) as? LocationManager ?: return
        val gpsOn = lm.isProviderEnabled(LocationManager.GPS_PROVIDER)
        val hasPermission = checkSelfPermission(android.Manifest.permission.ACCESS_FINE_LOCATION) == 0

        // 获取最近定位并检查时效性
        val lastLoc = if (hasPermission) try { lm.getLastKnownLocation(LocationManager.GPS_PROVIDER) } catch (e: Exception) { null } else null
        val isFresh = lastLoc != null && (System.currentTimeMillis() - lastLoc.time) < 60000  // 60秒内有效

        tv.text = buildString {
            append(if (gpsOn) "📡 GPS: 已开启" else "📡 GPS: 未开启"); append(" | ")
            append(if (hasPermission) "权限: ✅" else "权限: ❌"); append('\n')
            if (isFresh) {
                lastLoc?.let { loc ->
                    append("纬度: %.5f".format(loc.latitude)); append('\n')
                    append("经度: %.5f".format(loc.longitude)); append('\n')
                    append("速度: %.1f km/h".format(loc.speed * 3.6f)); append('\n')
                    append("精度: %.0f m".format(loc.accuracy)); append('\n')
                    append("高度: %.0f m".format(loc.altitude)); append('\n')
                    append("时间: ${java.text.SimpleDateFormat("HH:mm:ss", java.util.Locale.CHINA).format(java.util.Date(loc.time))}")
                }
            } else if (gpsOn && hasPermission) {
                append("⏳ 搜索GPS信号中...\n")
                append("最后定位: ${lastLoc?.let {
                    "%.5f, %.5f".format(it.latitude, it.longitude)
                } ?: "无"}\n")
                append("请到室外开阔处")
            } else {
                append("⚠️ GPS 无信号")
                if (!gpsOn) append("\n请开启位置信息")
                if (!hasPermission) append("\n请授予定位权限")
            }
        }
    }

    private suspend fun refreshServer(tv: TextView) {
        val serverUrl = withContext(Dispatchers.IO) { db.configDao().getString("server_url") ?: "http://192.168.5.193:3012" }
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
            tv.text = buildString {
                append(if (ok) "✅ 已连接 (${ms}ms)" else "❌ 连接失败")
                append('\n'); append("服务器: $serverUrl")
            }
        } catch (e: Exception) {
            tv.text = "❌ 连接异常: ${e.message}"
        }
    }

    private suspend fun refreshLocal(tv: TextView) {
        val active = withContext(Dispatchers.IO) { db.tripDao().getActiveTrip() }
        val pendingPts = if (active != null) withContext(Dispatchers.IO) { db.tripDao().getPendingPointCount(active.id) } else 0
        tv.text = buildString {
            if (active != null && active.endTime == null) {
                val elapsed = (System.currentTimeMillis() - active.startTime) / 1000
                append("🚗 当前行程进行中"); append('\n')
                append("行程ID: ${active.id.take(12)}..."); append('\n')
                append("时长: ${elapsed / 60}分${elapsed % 60}秒"); append('\n')
                append("GPS点数: ${active.pointCount}"); append('\n')
                append("未上传: $pendingPts")
            } else {
                append("🟢 当前无进行中行程"); append('\n')
                append("上次行程: ${active?.endTime ?: '-'}")
            }
        }
    }

    private suspend fun refreshConfig(tv: TextView) {
        withContext(Dispatchers.IO) {
            val server = db.configDao().getString("server_url") ?: "(未设置)"
            val key = db.configDao().getString("api_key")?.take(8) ?: "(未设置)"
            val carName = db.configDao().getString("car_name") ?: "(未设置)"
            val carId = db.configDao().getString("car_id")?.take(12) ?: "(未注册)"
            val tankId = db.configDao().getString("tank_id")?.take(12) ?: "(未注册)"
            val tankCap = db.configDao().getString("tank_capacity") ?: "(未设置)"
            withContext(Dispatchers.Main) {
                tv.text = buildString {
                    append("车辆名称: $carName"); append('\n')
                    append("车辆ID: $carId..."); append('\n')
                    append("油箱ID: $tankId..."); append('、')
                    append("油箱容量: ${tankCap}L"); append('\n')
                    append("服务器: $server"); append('\n')
                    append("API Key: $key...")
                }
                // 提示开机自启
                tv.append("\n\n📌 如需开机自动追踪，请在系统设置中允许")
                tv.append("\n    APP自启动权限（不同机型名称不同）")
            }
        }
    }

    private fun addLog(tv: TextView, msg: String) {
        LogBuffer.add("DIAG", msg)
        tv.text = LogBuffer.getAll().joinToString("\n")
    }

    /** 定时刷新日志显示 */
    private fun refreshLog(tv: TextView) {
        tv.text = LogBuffer.getAll().joinToString("\n")
        // 自动滚动到最底部
        tv.post { tv.scrollTo(0, tv.bottom) }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
