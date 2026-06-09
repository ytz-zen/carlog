package com.carlog.service

import android.app.*
import android.content.Context
import android.content.Intent
import android.content.IntentFilter
import android.location.Location
import android.location.LocationListener
import android.location.LocationManager
import android.os.*
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import com.carlog.data.db.GpsPointEntity
import com.carlog.data.db.TripEntity
import com.carlog.tracker.TripDetector
import com.carlog.tracker.OilDetector
import com.carlog.repo.UploadRepo
import com.carlog.tracker.FuelEvent
import kotlinx.coroutines.*
import kotlin.math.*
import java.util.concurrent.TimeUnit

class GpsTrackService : Service(), LocationListener {

    companion object {
        const val NOTIFICATION_ID = 1
        const val CHANNEL_ID = "carlog_location"
        const val ACTION_START = "com.carlog.START_TRACKING"
        const val ACTION_STOP = "com.carlog.STOP_TRACKING"
    }

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var locationManager: LocationManager
    private lateinit var db: CarLogDatabase
    private lateinit var tripDetector: TripDetector
    private lateinit var uploadRepo: UploadRepo

    private var currentTripId: String? = null
    private var carId: String? = null
    private var tankId: String? = null
    private var tankCapacity: Float = 60f
    private var pointCount = 0
    private var lastFuelLevel: Float? = null
    private val serviceStartTime = System.currentTimeMillis()

    private fun log(msg: String) {
        com.carlog.tracker.LogBuffer.add("SVC", msg)
    }

    override fun onCreate() {
        super.onCreate()
        db = CarLogDatabase.getInstance(this)
        uploadRepo = UploadRepo(this, db)
        createNotificationChannel()
        startForeground(NOTIFICATION_ID, buildNotification("启动中..."))
        // 自动开始追踪（开应用即开始，不用等按按钮）
        tripDetector = TripDetector()
        serviceScope.launch { recoverPendingTrips() }
    }

    /** 恢复上次断电未结束的行程 */
    private suspend fun recoverPendingTrips() {
        log("开始恢复检查")
        identifyCar()
        
        val active = db.tripDao().getActiveTrip()
        if (active != null && active.endTime == null) {
            // 跳过本轮启动后才创建的行程（避免跟 startTracking 竞争）
            if (active.startTime > serviceStartTime - 5000) {
                log("跳过最近创建的行程: ${active.id}")
            } else {
                log("发现未结束行程: ${active.id}, 开始时间=${active.startTime}")
                val now = System.currentTimeMillis()
                val points = db.tripDao().getGpsPoints(active.id)
                var distance = 0f; var maxSpeed = 0f; var totalSpeed = 0f; var speedCount = 0
                for (i in 1 until points.size) {
                    distance += haversine(points[i-1].latitude, points[i-1].longitude,
                        points[i].latitude, points[i].longitude)
                    if (points[i].speed > maxSpeed) maxSpeed = points[i].speed
                    if (points[i].speed > 5f) { totalSpeed += points[i].speed; speedCount++ }
                }
                distance = round(distance * 10) / 10
                val avgSpeed = if (speedCount > 0) round(totalSpeed / speedCount * 10) / 10f else 0f
                val duration = ((now - active.startTime) / 1000).toInt()
                log("恢复行程: 里程=${distance}km, 时长=${duration}s")
                db.tripDao().updateUploadState(active.id, "IDLE")
                uploadRepo.uploadTrip(active.id, now, distance, avgSpeed, maxSpeed, duration)
                log("恢复行程完成: ${active.id}")
            }
        }

        // Upload any pending GPS points from previous trips
        val pendingTrips = db.tripDao().getPendingTrips()
        pendingTrips.collect { trips ->
            for (t in trips) {
                if (t.uploadState != "DONE") {
                    val remaining = db.tripDao().getPendingPointCount(t.id)
                    if (remaining > 0) uploadRepo.uploadPendingPoints(t.id)
                }
            }
        }
    }

    /** Identify this car on the server (create or find by name) */
    private suspend fun identifyCar() {
        val carName = db.configDao().getString("car_name") ?: return
        val result = uploadRepo.identifyCar(carName)
        if (result != null) {
            carId = result.carId
            tankId = result.tankId
            db.configDao().saveString("car_id", result.carId)
            db.configDao().saveString("tank_id", result.tankId)
        }
    }

    /** 获取或创建本地车辆ID */
    private suspend fun getOrCreateCarId(): String {
        if (carId == null) {
            carId = db.configDao().getString("car_id")
            if (carId == null) {
                carId = "local_car_${System.currentTimeMillis()}"
                db.configDao().saveString("car_id", carId!!)
            }
        }
        return carId!!
    }

    /** 获取或创建本地油箱ID */
    private suspend fun getOrCreateTankId(): String {
        if (tankId == null) {
            tankId = db.configDao().getString("tank_id")
            if (tankId == null) {
                tankId = "local_tank_${System.currentTimeMillis()}"
                db.configDao().saveString("tank_id", tankId!!)
            }
        }
        return tankId!!
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        when (intent?.action) {
            ACTION_START -> startTracking()
            ACTION_STOP -> stopTracking()
        }
        return START_NOT_STICKY
    }

    private fun startTracking() {
        log("startTracking 被调用")
        locationManager = getSystemService(Context.LOCATION_SERVICE) as LocationManager
        tripDetector = TripDetector()  // 初始化行程检测器
        runBlocking {
            tankCapacity = db.configDao().getString("tank_capacity")?.toFloatOrNull() ?: 60f
            carId = db.configDao().getString("car_id")
            tankId = db.configDao().getString("tank_id")
        }

        serviceScope.launch {
            val existing = db.tripDao().getActiveTrip()
            if (existing != null && existing.endTime == null) {
                currentTripId = existing.id
                pointCount = existing.pointCount
            }
        }

        try {
            locationManager.requestLocationUpdates(
                LocationManager.GPS_PROVIDER, 5000L, 5f, this
            )
        } catch (e: SecurityException) {}

        updateNotification("追踪中...")

        log("GPS定位已请求")

        // 手动点击"开始行驶"时立即创建行程
        serviceScope.launch {
            if (currentTripId == null) {
                log("手动模式: 创建新行程")
                val trip = TripEntity(
                    id = "trip_${System.currentTimeMillis()}",
                    tankId = getOrCreateTankId(), carId = getOrCreateCarId(),
                    startTime = System.currentTimeMillis()
                )
                db.tripDao().insertTrip(trip)
                currentTripId = trip.id
                pointCount = 0
                updateNotification("手动追踪中")
                log("手动行程已创建: ${trip.id}")
            } else {
                log("手动模式跳过: 已有行程 $currentTripId")
            }
        }
    }

    private fun stopTracking() {
        try { locationManager.removeUpdates(this) } catch (_: Exception) {}
        log("停止追踪")
        // 在协程里结束行程后 stopSelf
        serviceScope.launch {
            currentTripId?.let { endCurrentTrip(System.currentTimeMillis()) }
            log("行程已结束, 停止服务")
            withContext(Dispatchers.Main) { stopSelf() }
        }
    }

    override fun onLocationChanged(location: Location) {
        val speedKmh = location.speed * 3.6f
        val currentFuel = readFuelLevel()
        log("GPS定位: speed=${Math.round(speedKmh)}km/h, lat=${location.latitude}, lng=${location.longitude}")

        serviceScope.launch {
            val tripId = handleTripState(speedKmh, location.time)
            if (tripId != null) {
                val point = GpsPointEntity(
                    tripId = tripId, timestamp = location.time,
                    latitude = location.latitude, longitude = location.longitude,
                    speed = speedKmh, altitude = location.altitude?.toFloat(),
                    bearing = location.bearing?.toFloat(), fuelLevel = currentFuel
                )
                db.tripDao().insertGpsPoints(listOf(point))
                pointCount++

                // Fuel detection
                currentFuel?.let { fuel ->
                    lastFuelLevel?.let { last ->
                        val diff = fuel - last
                        if (diff > 10f) {
                            val fuelAdded = tankCapacity * diff / 100f
                            uploadRepo.uploadFuelEvent(
                                FuelEvent(fuelBefore = last, fuelAfter = fuel,
                                    fuelAdded = round(fuelAdded * 10) / 10f, timestamp = location.time
                                ), tripId
                            )
                            updateNotification("加油检测: +${String.format("%.1f", fuelAdded)}L")
                        }
                    }
                    lastFuelLevel = fuel
                }

                // Upload every 20 points (was 50) to reduce loss on sudden power-off
                if (pointCount % 20 == 0) {
                    uploadRepo.uploadPendingPoints(tripId)
                }

                updateNotification("已记录 $pointCount 个点")
            }
        }
    }

    override fun onStatusChanged(provider: String?, status: Int, extras: Bundle?) {}
    override fun onProviderEnabled(provider: String) {}
    override fun onProviderDisabled(provider: String) {}

    private suspend fun handleTripState(speed: Float, timestamp: Long): String? {
        if (currentTripId == null) {
            // 自动检测
            tripDetector.onSpeedChange(speed)
            if (tripDetector.state == TripDetector.TripState.STARTED) {
                log("自动检测: 速度>5, 创建行程")
                val trip = TripEntity(
                    id = "trip_${System.currentTimeMillis()}",
                    tankId = getOrCreateTankId(), carId = getOrCreateCarId(),
                    startTime = timestamp
                )
                db.tripDao().insertTrip(trip)
                currentTripId = trip.id
                pointCount = 0
                return trip.id
            }
        } else {
            // 已有行程：检测是否该结束
            tripDetector.onSpeedChange(speed)
            if (tripDetector.shouldEndTrip()) {
                log("停车超5分钟, 结束行程: $currentTripId")
                endCurrentTrip(timestamp)
                tripDetector.reset()
            }
        }
        return currentTripId
    }

    private suspend fun endCurrentTrip(endTime: Long) {
        val tripId = currentTripId ?: return
        log("结束行程: $tripId")
        currentTripId = null
        tripDetector = TripDetector()
        pointCount = 0
        val points = db.tripDao().getGpsPoints(tripId)
        var distance = 0f; var maxSpeed = 0f; var totalSpeed = 0f; var speedCount = 0
        for (i in 1 until points.size) {
            distance += haversine(points[i-1].latitude, points[i-1].longitude,
                points[i].latitude, points[i].longitude)
            if (points[i].speed > maxSpeed) maxSpeed = points[i].speed
            if (points[i].speed > 5f) { totalSpeed += points[i].speed; speedCount++ }
        }
        distance = round(distance * 10) / 10
        val avgSpeed = if (speedCount > 0) round(totalSpeed / speedCount * 10) / 10f else 0f
        val duration = ((endTime - db.tripDao().getTripById(tripId)!!.startTime) / 1000).toInt()
        // 本地数据库标记行程已结束
        db.tripDao().endTripLocally(tripId, endTime, duration, distance, points.size)
        uploadRepo.uploadTrip(tripId, endTime, distance, avgSpeed, maxSpeed, duration)
        updateNotification("行程结束: ${distance}km, ${duration}s")
    }

    private fun haversine(lat1: Double, lon1: Double, lat2: Double, lon2: Double): Float {
        val R = 6371f
        val dLat = Math.toRadians(lat2 - lat1)
        val dLon = Math.toRadians(lon2 - lon1)
        val a = sin(dLat / 2) * sin(dLat / 2) +
                cos(Math.toRadians(lat1)) * cos(Math.toRadians(lat2)) *
                sin(dLon / 2) * sin(dLon / 2)
        return (R * 2f * atan2(sqrt(a), sqrt(1.0 - a))).toFloat()
    }

    private fun readFuelLevel(): Float? {
        return try {
            val intent = registerReceiver(null, IntentFilter(Intent.ACTION_BATTERY_CHANGED))
            val level = intent?.getIntExtra(BatteryManager.EXTRA_LEVEL, -1) ?: -1
            val scale = intent?.getIntExtra(BatteryManager.EXTRA_SCALE, -1) ?: -1
            if (level >= 0 && scale > 0) (level.toFloat() / scale.toFloat()) * 100f else null
        } catch (e: Exception) { null }
    }

    private fun updateNotification(text: String) {
        val notif = buildNotification(text)
        (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).notify(NOTIFICATION_ID, notif)
    }

    private fun buildNotification(text: String): Notification {
        val intent = Intent(this, com.carlog.ui.MainActivity::class.java).apply {
            flags = Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_CLEAR_TASK
        }
        val pi = PendingIntent.getActivity(this, 0, intent, PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE)
        return NotificationCompat.Builder(this, CHANNEL_ID)
            .setSmallIcon(android.R.drawable.ic_menu_mylocation).setContentTitle("🚗 车行记")
            .setContentText(text).setContentIntent(pi).setOngoing(true).build()
    }

    private fun createNotificationChannel() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val ch = NotificationChannel(CHANNEL_ID, "GPS定位服务", NotificationManager.IMPORTANCE_LOW)
            ch.description = "用于采集行车轨迹"
            (getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager).createNotificationChannel(ch)
        }
    }

    override fun onBind(intent: Intent?) = null
    override fun onDestroy() {
        log("onDestroy 服务销毁")
        super.onDestroy(); serviceScope.cancel(); try { locationManager.removeUpdates(this) } catch (_: Exception) {}
    }
}