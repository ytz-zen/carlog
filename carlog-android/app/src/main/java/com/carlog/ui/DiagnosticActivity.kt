package com.carlog.ui

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.repo.UploadRepo
import com.carlog.tracker.LogBuffer
import com.google.gson.Gson
import kotlinx.coroutines.*

class DiagnosticActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private lateinit var uploadRepo: UploadRepo
    private lateinit var logScrollView: ScrollView
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)
    private val gson = Gson()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        setContentView(R.layout.activity_diagnostic)
        db = CarLogDatabase.getInstance(this)
        uploadRepo = UploadRepo(this, db)
        logScrollView = findViewById(R.id.logScrollView)

        val tvConfig = findViewById<TextView>(R.id.diagConfigInfo)
        val tvDb = findViewById<TextView>(R.id.diagDbInfo)
        val tvLog = findViewById<TextView>(R.id.diagLog)

        // 初始加载
        scope.launch {
            refreshConfig(tvConfig)
            refreshDbInfo(tvDb)
        }

        // 测试服务器连接
        findViewById<Button>(R.id.btnTestConn).setOnClickListener {
            scope.launch {
                addLog(tvLog, "========== 测试服务器连接 ==========")
                val serverUrl = db.configDao().getString("server_url") ?: "http://192.168.5.193:3012"
                addLog(tvLog, "📡 服务器: $serverUrl")
                val result = withContext(Dispatchers.IO) {
                    try {
                        val url = java.net.URL("$serverUrl/api/auth/me")
                        val conn = url.openConnection() as java.net.HttpURLConnection
                        conn.connectTimeout = 5000
                        conn.readTimeout = 5000
                        conn.inputStream
                        val responseCode = conn.responseCode
                        responseCode to true
                    } catch (e: Exception) {
                        null to false
                    }
                }
                if (result.second) {
                    addLog(tvLog, "✅ 连接成功，HTTP ${result.first}")
                } else {
                    addLog(tvLog, "❌ 连接失败")
                }
                addLog(tvLog, "================================")
            }
        }

        // 测试上传
        findViewById<Button>(R.id.btnTestUpload).setOnClickListener {
            scope.launch {
                addLog(tvLog, "========== 开始测试上传 ==========")
                val carName = db.configDao().getString("car_name") ?: "(未设置)"
                addLog(tvLog, "🚗 车辆名称: $carName")
                val result = withContext(Dispatchers.IO) {
                    uploadRepo.identifyCar(carName)
                }
                if (result != null) {
                    addLog(tvLog, "✅ identifyCar 成功")
                    addLog(tvLog, "   carId: ${result.carId}")
                    addLog(tvLog, "   tankId: ${result.tankId}")
                } else {
                    addLog(tvLog, "❌ identifyCar 返回 null")
                }
                val active = db.tripDao().getActiveTrip()
                if (active != null && active.endTime == null) {
                    val pending = db.tripDao().getPendingPointCount(active.id)
                    val serverTripId = active.serverTripId
                    addLog(tvLog, "📍 当前行程 ${pending} 个未上传GPS点")
                    addLog(tvLog, "📍 服务端行程ID: ${serverTripId ?: "(无)"}")
                    if (pending > 0) {
                        if (serverTripId.isNullOrEmpty()) {
                            addLog(tvLog, "⚠️ 无服务端行程ID，先创建...")
                            val created = uploadRepo.initializeTrip()
                            if (!created.isNullOrEmpty()) {
                                db.tripDao().updateServerTripId(active.id, created)
                                addLog(tvLog, "✅ 服务端行程已创建: $created")
                                uploadRepo.uploadPendingPoints(active.id, created)
                            } else {
                                addLog(tvLog, "❌ 服务端行程创建失败")
                            }
                        } else {
                            uploadRepo.uploadPendingPoints(active.id, serverTripId)
                        }
                        addLog(tvLog, "⬆️ 已尝试上传 $pending 个点")
                    } else {
                        addLog(tvLog, "ℹ️ 当前行程无待上传的点")
                    }
                } else {
                    addLog(tvLog, "ℹ️ 当前没有进行中的行程")
                }
                addLog(tvLog, "========== 测试完成 ==========")
                refreshDbInfo(findViewById(R.id.diagDbInfo))
            }
        }

        // 重新识别车辆
        findViewById<Button>(R.id.btnIdentifyCar).setOnClickListener {
            scope.launch {
                addLog(tvLog, "========== 重新识别车辆 ==========")
                val carName = db.configDao().getString("car_name") ?: "(未设置)"
                addLog(tvLog, "🚗 车辆名称: $carName")
                val result = withContext(Dispatchers.IO) {
                    uploadRepo.identifyCar(carName)
                }
                if (result != null) {
                    addLog(tvLog, "✅ 车辆识别成功")
                    addLog(tvLog, "   carId: ${result.carId}")
                    addLog(tvLog, "   tankId: ${result.tankId}")
                    addLog(tvLog, "   name: ${result.name}")
                    db.configDao().saveString("car_id", result.carId)
                    db.configDao().saveString("tank_id", result.tankId)
                } else {
                    addLog(tvLog, "❌ 车辆识别失败")
                }
                addLog(tvLog, "========== 完成 ==========")
            }
        }

        // 清除未上传数据
        findViewById<Button>(R.id.btnCleanData).setOnClickListener {
            scope.launch {
                addLog(tvLog, "========== 清除未上传数据 ==========")
                val trips = db.tripDao().getPendingTrips()
                trips.collect { tripList ->
                    if (tripList.isEmpty()) {
                        addLog(tvLog, "ℹ️ 没有待上传的行程")
                    } else {
                        for (t in tripList) {
                            db.tripDao().deleteGpsPoints(t.id)
                            db.tripDao().updateUploadState(t.id, "CLEANED")
                            addLog(tvLog, "🗑️ 已清除行程 ${t.id.take(12)} 的未上传数据")
                        }
                    }
                }
                addLog(tvLog, "========== 完成 ==========")
                refreshDbInfo(findViewById(R.id.diagDbInfo))
            }
        }

        // 清空日志
        findViewById<Button>(R.id.btnClearLog).setOnClickListener {
            tvLog.text = "日志已清空"
            LogBuffer.clear()
        }

        // 日志滚动
        tvLog.movementMethod = android.text.method.ScrollingMovementMethod()

        // 定时刷新日志
        scope.launch {
            while (isActive) {
                refreshLog(tvLog)
                delay(3000)
            }
        }
    }

    private suspend fun refreshConfig(tv: TextView) {
        withContext(Dispatchers.IO) {
            val server = db.configDao().getString("server_url") ?: "(未设置)"
            val key = db.configDao().getString("api_key") ?: "(未设置)"
            val carName = db.configDao().getString("car_name") ?: "(未设置)"
            val carId = db.configDao().getString("car_id") ?: "(未注册)"
            val tankId = db.configDao().getString("tank_id") ?: "(未注册)"
            val tankCap = db.configDao().getString("tank_capacity") ?: "(未设置)"
            val trackingMode = db.configDao().getString("tracking_mode") ?: "auto"
            withContext(Dispatchers.Main) {
                tv.text = buildString {
                    append("车辆名称: $carName\n")
                    append("车辆ID: $carId\n")
                    append("油箱ID: $tankId\n")
                    append("油箱容量: ${tankCap}L\n")
                    append("服务器: $server\n")
                    append("API Key: $key\n")
                    append("跟踪模式: ${if (trackingMode == "manual") "手动" else "自动"}")
                }
            }
        }
    }

    private suspend fun refreshDbInfo(tv: TextView) {
        withContext(Dispatchers.IO) {
            val active = db.tripDao().getActiveTrip()
            val pendingPts = if (active != null && active.endTime == null) {
                db.tripDao().getPendingPointCount(active.id)
            } else 0
            val uploadedPts = if (active != null && active.endTime == null) {
                db.tripDao().getUploadedPointCount(active.id)
            } else 0
            val pendingTrips = db.tripDao().getPendingTrips()
            withContext(Dispatchers.Main) {
                pendingTrips.collect { tripList ->
                    tv.text = buildString {
                        if (active != null && active.endTime == null) {
                            append("🚗 当前行程: ${active.id.take(12)}...\n")
                            append("GPS点数: ${active.pointCount}\n")
                            append("未上传: $pendingPts | 已上传: $uploadedPts\n")
                        } else {
                            append("🟢 当前无进行中的行程\n")
                        }
                        append("待上传行程: ${tripList.size}个")
                    }
                }
            }
        }
    }

    private fun addLog(tv: TextView, msg: String) {
        LogBuffer.add("DIAG", msg)
        tv.text = getLogText()
        tv.post {
            logScrollView.fullScroll(ScrollView.FOCUS_DOWN)
            tv.postInvalidate()
        }
    }

    private fun refreshLog(tv: TextView) {
        val log = getLogText()
        if (log != tv.text.toString()) {
            tv.text = log
            tv.post {
                logScrollView.fullScroll(ScrollView.FOCUS_DOWN)
                tv.postInvalidate()
            }
        }
    }

    private fun getLogText(): String {
        val lines = LogBuffer.getAll()
        return if (lines.isNullOrEmpty()) "(暂无日志)" else lines.joinToString("\n")
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
