package com.carlog.repo

import android.content.Context
import com.carlog.data.db.CarLogDatabase
import com.carlog.tracker.FuelEvent
import com.carlog.tracker.LogBuffer
import com.google.gson.Gson
import kotlinx.coroutines.runBlocking
import okhttp3.*
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.IOException
import java.util.concurrent.TimeUnit

class UploadRepo(
    private val context: Context,
    private val db: CarLogDatabase
) {
    companion object {
        private const val HEADER_API_KEY = "X-API-Key"
        private val JSON_MEDIA_TYPE = "application/json".toMediaType()
    }

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .readTimeout(60, TimeUnit.SECONDS)
        .build()

    private val gson = Gson()

    private fun getApiKey(): String? = runBlocking { db.configDao().getString("api_key") }
    private fun getBaseUrl(): String = runBlocking { db.configDao().getString("server_url") } ?: "http://192.168.5.193:3012"

    private fun log(msg: String) {
        LogBuffer.add("UPLOAD", msg)
    }

    suspend fun uploadPendingPoints(tripId: String) {
        try {
            val apiKey = getApiKey()
            if (apiKey == null) {
                log("❌ 无法上传GPS点: API Key 未设置")
                return
            }
            val baseUrl = getBaseUrl()
            log("⬆️ 准备上传 $tripId 的GPS点到 $baseUrl")
            
            val pending = db.tripDao().getGpsPoints(tripId).filter { !it.uploaded }.take(50)
            log("⬆️ 待上传点数: ${pending.size}")
            if (pending.isEmpty()) return

            val points = pending.map { p ->
                mapOf("timestamp" to p.timestamp, "lat" to p.latitude, "lng" to p.longitude,
                      "speed" to p.speed, "fuelLevel" to p.fuelLevel)
            }

            val body = gson.toJson(mapOf("action" to "upload-points", "tripId" to tripId, "points" to points))
            val request = Request.Builder()
                .url("$baseUrl/api/trips")
                .header(HEADER_API_KEY, apiKey)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    log("⬆️ 响应: code=${response.code}")
                    if (response.isSuccessful) {
                        val respBody = response.body?.string() ?: ""
                        log("⬆️ 上传成功: $respBody")
                    } else {
                        val errBody = response.body?.string() ?: "(无body)"
                        log("❌ 上传失败: HTTP ${response.code} - $errBody")
                    }
                }
            } catch (e: IOException) {
                log("❌ 上传异常: ${e.message}")
            }
        } catch (e: Exception) {
            log("❌ uploadPendingPoints 异常: ${e.message}")
        }
    }

    suspend fun uploadTrip(tripId: String, endTime: Long, distance: Float, avgSpeed: Float, maxSpeed: Float, duration: Int) {
        try {
            val apiKey = getApiKey() ?: return
            val baseUrl = getBaseUrl()
            log("⬆️ 上传行程结束: $tripId")
            val body = gson.toJson(mapOf("action" to "end", "tripId" to tripId, "endTime" to endTime,
                "distance" to distance, "avgSpeed" to avgSpeed, "maxSpeed" to maxSpeed, "duration" to duration))

            val request = Request.Builder()
                .url("$baseUrl/api/trips")
                .header(HEADER_API_KEY, apiKey)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    log("⬆️ 行程结束响应: code=${response.code}")
                    if (response.isSuccessful) {
                        db.tripDao().updateUploadState(tripId, "DONE")
                        log("✅ 行程结束上传成功: $tripId")
                    } else {
                        val errBody = response.body?.string() ?: ""
                        log("❌ 行程结束失败: HTTP ${response.code} - $errBody")
                        db.tripDao().updateUploadState(tripId, "FAILED")
                    }
                }
            } catch (e: IOException) {
                log("❌ 行程结束异常: ${e.message}")
                db.tripDao().updateUploadState(tripId, "FAILED")
            }
        } catch (e: Exception) {
            log("❌ uploadTrip 异常: ${e.message}")
        }
    }

    suspend fun uploadFuelEvent(event: FuelEvent, tripId: String? = null) {
        try {
            val apiKey = getApiKey() ?: return
            val baseUrl = getBaseUrl()
            val body = gson.toJson(mapOf("action" to "auto", "tripId" to tripId,
                "fuelBefore" to event.fuelBefore, "fuelAfter" to event.fuelAfter, "timestamp" to event.timestamp))

            val request = Request.Builder()
                .url("$baseUrl/api/fuel")
                .header(HEADER_API_KEY, apiKey)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            try {
                client.newCall(request).execute().use { response ->
                    log("⛽ 加油事件响应: code=${response.code}")
                }
            } catch (e: IOException) {
                log("❌ 加油事件上传失败: ${e.message}")
            }
        } catch (e: Exception) {
            log("❌ uploadFuelEvent 异常: ${e.message}")
        }
    }

    suspend fun initializeTrip(): String? {
        try {
            val apiKey = getApiKey() ?: return null
            val baseUrl = getBaseUrl()
            log("⬆️ 请求开始行程")
            val body = gson.toJson(mapOf("action" to "start"))

            val request = Request.Builder()
                .url("$baseUrl/api/trips")
                .header(HEADER_API_KEY, apiKey)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()

            return try {
                client.newCall(request).execute().use { response ->
                    log("⬆️ 开始行程响应: code=${response.code}")
                    if (response.isSuccessful) {
                        val json = response.body?.string() ?: ""
                        log("⬆️ 开始行程响应体: $json")
                        val map = gson.fromJson(json, Map::class.java)
                        map["tripId"] as? String
                    } else {
                        val errBody = response.body?.string() ?: ""
                        log("❌ 开始行程失败: HTTP ${response.code} - $errBody")
                        null
                    }
                }
            } catch (e: IOException) {
                log("❌ 开始行程异常: ${e.message}")
                null
            }
        } catch (e: Exception) {
            log("❌ initializeTrip 异常: ${e.message}")
            null
        }
    }

    suspend fun identifyCar(carName: String): CarIdentifyResult? {
        try {
            val apiKey = getApiKey()
            if (apiKey == null) {
                log("❌ identifyCar: API Key 未设置")
                return null
            }
            val baseUrl = getBaseUrl()
            log("🚗 请求车辆识别: name=$carName, url=$baseUrl/api/cars/identify")
            
            val body = gson.toJson(mapOf("carName" to carName))
            val request = Request.Builder()
                .url("$baseUrl/api/cars/identify")
                .header(HEADER_API_KEY, apiKey)
                .post(body.toRequestBody(JSON_MEDIA_TYPE))
                .build()
            
            return try {
                client.newCall(request).execute().use { response ->
                    log("🚗 identifyCar 响应: code=${response.code}")
                    if (response.isSuccessful) {
                        val respBody = response.body?.string() ?: ""
                        log("🚗 identifyCar 响应体: $respBody")
                        gson.fromJson(respBody, CarIdentifyResult::class.java)
                    } else {
                        val errBody = response.body?.string() ?: ""
                        log("❌ identifyCar 失败: HTTP ${response.code} - $errBody")
                        null
                    }
                }
            } catch (e: IOException) {
                log("❌ identifyCar 异常: ${e.message}")
                null
            }
        } catch (e: Exception) {
            log("❌ identifyCar 异常: ${e.message}")
            null
        }
    }
}

data class CarIdentifyResult(val carId: String, val tankId: String, val name: String)
