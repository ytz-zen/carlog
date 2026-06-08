package com.carlog.repo

import android.content.Context
import com.carlog.data.db.CarLogDatabase
import com.carlog.tracker.FuelEvent
import com.google.gson.Gson
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

    private fun getApiKey(): String? = db.configDao().getString("api_key")

    private fun getBaseUrl(): String =
        db.configDao().getString("server_url") ?: "http://192.168.5.193:3000"

    suspend fun uploadPendingPoints(tripId: String) {
        val apiKey = getApiKey() ?: return
        val baseUrl = getBaseUrl()
        val pending = db.tripDao().getGpsPoints(tripId).filter { !it.uploaded }.take(50)
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

        try { client.newCall(request).execute().use { if (it.isSuccessful) {} } }
        catch (e: IOException) {}
    }

    suspend fun uploadTrip(tripId: String, endTime: Long, distance: Float, avgSpeed: Float, maxSpeed: Float, duration: Int) {
        val apiKey = getApiKey() ?: return
        val baseUrl = getBaseUrl()
        val body = gson.toJson(mapOf("action" to "end", "tripId" to tripId, "endTime" to endTime,
            "distance" to distance, "avgSpeed" to avgSpeed, "maxSpeed" to maxSpeed, "duration" to duration))

        val request = Request.Builder()
            .url("$baseUrl/api/trips")
            .header(HEADER_API_KEY, apiKey)
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        try {
            client.newCall(request).execute().use {
                if (it.isSuccessful) db.tripDao().updateUploadState(tripId, "DONE")
                else db.tripDao().updateUploadState(tripId, "FAILED")
            }
        } catch (e: IOException) {
            db.tripDao().updateUploadState(tripId, "FAILED")
        }
    }

    suspend fun uploadFuelEvent(event: FuelEvent, tripId: String? = null) {
        val apiKey = getApiKey() ?: return
        val baseUrl = getBaseUrl()
        val body = gson.toJson(mapOf("action" to "auto", "tripId" to tripId,
            "fuelBefore" to event.fuelBefore, "fuelAfter" to event.fuelAfter, "timestamp" to event.timestamp))

        val request = Request.Builder()
            .url("$baseUrl/api/fuel")
            .header(HEADER_API_KEY, apiKey)
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        try { client.newCall(request).execute().use { } } catch (e: IOException) {}
    }

    suspend fun initializeTrip(): String? {
        val apiKey = getApiKey() ?: return null
        val baseUrl = getBaseUrl()
        val body = gson.toJson(mapOf("action" to "start"))

        val request = Request.Builder()
            .url("$baseUrl/api/trips")
            .header(HEADER_API_KEY, apiKey)
            .post(body.toRequestBody(JSON_MEDIA_TYPE))
            .build()

        return try {
            client.newCall(request).execute().use {
                if (it.isSuccessful) {
                    val json = it.body?.string() ?: ""
                    val map = gson.fromJson(json, Map::class.java)
                    map["tripId"] as? String
                } else null
            }
        } catch (e: IOException) { null }
    }
}
