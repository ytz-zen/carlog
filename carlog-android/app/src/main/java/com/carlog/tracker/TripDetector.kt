package com.carlog.tracker

import java.util.concurrent.TimeUnit

class TripDetector {
    enum class TripState { IDLE, STARTING, STARTED }
    var state: TripState = TripState.IDLE
    var idleDuration: Long = 0
        private set

    private var startTimestamp: Long = 0
    private var idleStartTimestamp: Long = 0

    fun onSpeedChange(speed: Float) {
        when (state) {
            TripState.IDLE -> {
                if (speed > 5f) { state = TripState.STARTING; startTimestamp = System.currentTimeMillis() }
            }
            TripState.STARTING -> {
                if (speed < 5f) state = TripState.IDLE
            }
            TripState.STARTED -> {
                if (speed == 0f) { idleStartTimestamp = System.currentTimeMillis(); state = TripState.IDLE; idleDuration = 0 }
            }
        }
    }

    fun resetIdleTimer() {
        if (state == TripState.STARTING) {
            if (System.currentTimeMillis() - startTimestamp > TimeUnit.MINUTES.toMillis(2)) {
                state = TripState.STARTED
            }
        }
        idleDuration = 0
    }
}
