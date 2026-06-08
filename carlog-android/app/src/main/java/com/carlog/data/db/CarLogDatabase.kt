package com.carlog.data.db

import android.content.Context
import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface TripDao {
    @Query("SELECT * FROM trips WHERE uploadState = 'IDLE' OR uploadState = 'FAILED' ORDER BY startTime DESC LIMIT 50")
    fun getPendingTrips(): Flow<List<TripEntity>>

    @Query("UPDATE trips SET uploadState = :state WHERE id = :tripId")
    suspend fun updateUploadState(tripId: String, state: String)

    @Query("SELECT * FROM trips WHERE id = :tripId LIMIT 1")
    suspend fun getTripById(tripId: String): TripEntity?

    @Query("SELECT * FROM trips WHERE endTime IS NULL LIMIT 1")
    suspend fun getActiveTrip(): TripEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertTrip(trip: TripEntity): Long

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insertGpsPoints(points: List<GpsPointEntity>)

    @Query("SELECT * FROM gps_points WHERE tripId = :tripId ORDER BY timestamp ASC")
    suspend fun getGpsPoints(tripId: String): List<GpsPointEntity>

    @Query("DELETE FROM gps_points WHERE tripId = :tripId")
    suspend fun deleteGpsPoints(tripId: String)

    @Query("SELECT COUNT(*) FROM gps_points WHERE tripId = :tripId AND uploaded = 0")
    suspend fun getPendingPointCount(tripId: String): Int
}

@Dao
interface ConfigDao {
    @Query("SELECT value FROM config WHERE key = :key LIMIT 1")
    suspend fun getString(key: String): String?

    @Query("INSERT OR REPLACE INTO config (key, value) VALUES (:key, :value)")
    suspend fun saveString(key: String, value: String)
}

@Entity(tableName = "trips")
data class TripEntity(
    @PrimaryKey val id: String,
    val tankId: String,
    val carId: String,
    val startTime: Long,
    val endTime: Long? = null,
    val duration: Int? = null,
    val distance: Float? = null,
    val avgSpeed: Float? = null,
    val maxSpeed: Float? = null,
    val fuelConsumed: Float? = null,
    val fuelPer100km: Float? = null,
    val pointCount: Int = 0,
    val uploadState: String = "IDLE"
)

@Entity(tableName = "gps_points")
data class GpsPointEntity(
    @PrimaryKey(autoGenerate = true) val id: Long = 0,
    val tripId: String,
    val timestamp: Long,
    val latitude: Double,
    val longitude: Double,
    val speed: Float,
    val altitude: Float? = null,
    val bearing: Float? = null,
    val fuelLevel: Float? = null,
    val uploaded: Boolean = false
)

@Entity(tableName = "config", primaryKeys = ["key"])
data class ConfigEntity(
    val key: String,
    val value: String
)

@Database(entities = [TripEntity::class, GpsPointEntity::class, ConfigEntity::class], version = 1, exportSchema = false)
abstract class CarLogDatabase : RoomDatabase() {
    abstract fun tripDao(): TripDao
    abstract fun configDao(): ConfigDao

    companion object {
        @Volatile private var INSTANCE: CarLogDatabase? = null
        fun getInstance(context: Context): CarLogDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    CarLogDatabase::class.java,
                    "carlog.db"
                ).build().also { INSTANCE = it }
            }
        }
    }
}
