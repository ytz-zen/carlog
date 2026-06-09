package com.carlog.tracker

import java.util.concurrent.TimeUnit

class TripDetector {
    enum class TripState { IDLE, STARTING, STARTED, IDLING }
    
    var state: TripState = TripState.IDLE
    var idleDuration: Long = 0
        private set

    private var startTimestamp: Long = 0
    private var idleStartTimestamp: Long = 0

    fun onSpeedChange(speed: Float) {
        when (state) {
            TripState.IDLE -> {
                if (speed > 5f) {
                    state = TripState.STARTING
                    startTimestamp = System.currentTimeMillis()
                }
            }
            TripState.STARTING -> {
                if (speed > 5f) {
                    // Keep accelerating - check if 2 minutes passed
                    if (System.currentTimeMillis() - startTimestamp > TimeUnit.MINUTES.toMillis(2)) {
                        state = TripState.STARTED
                    }
                } else {
                    state = TripState.IDLE
                }
            }
            TripState.STARTED -> {
                if (speed == 0f) {
                    // Car stopped - start idling timer
                    state = TripState.IDLING
                    idleStartTimestamp = System.currentTimeMillis()
                    idleDuration = 0
                }
            }
            TripState.IDLING -> {
                if (speed > 5f) {
                    // Started moving again - back to started
                    state = TripState.STARTED
                    idleDuration = 0
                } else {
                    // Still idling - update duration
                    idleDuration = System.currentTimeMillis() - idleStartTimestamp
                }
            }
        }
    }

    /** Returns true if the trip should be ended (idle > 5 min) */
    fun shouldEndTrip(): Boolean {
        return state == TripState.IDLING && 
               (System.currentTimeMillis() - idleStartTimestamp) > TimeUnit.MINUTES.toMillis(5)
    }

    /** Check if the trip just started (speed > 5 for 2+ min) */
    fun isJustStarted(): Boolean {
        return state == TripState.STARTED && (System.currentTimeMillis() - startTimestamp) <= TimeUnit.MINUTES.toMillis(2)
    }

    fun reset() {
        state = TripState.IDLE
        idleDuration = 0
    }
}
