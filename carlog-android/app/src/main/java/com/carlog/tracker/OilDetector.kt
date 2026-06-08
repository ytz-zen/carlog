package com.carlog.tracker

data class FuelEvent(
    val fuelBefore: Float, val fuelAfter: Float, val fuelAdded: Float,
    val timestamp: Long, val odometer: Float? = null, val isManual: Boolean = false
)

class OilDetector(
    private val tankCapacity: Float, private val threshold: Float = 10f
)
