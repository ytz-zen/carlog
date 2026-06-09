package com.carlog.tracker

class TripDetector {
    enum class TripState { IDLE, STARTED, IDLING }

    var state: TripState = TripState.IDLE
    var idleDuration: Long = 0
        private set

    private var idleStartTimestamp: Long = 0

    /** 速度变化时调用 */
    fun onSpeedChange(speed: Float) {
        when (state) {
            TripState.IDLE -> {
                if (speed > 5f) {
                    state = TripState.STARTED  // 立即开始，不等2分钟
                }
            }
            TripState.STARTED -> {
                if (speed == 0f) {
                    state = TripState.IDLING
                    idleStartTimestamp = System.currentTimeMillis()
                    idleDuration = 0
                }
            }
            TripState.IDLING -> {
                if (speed > 5f) {
                    state = TripState.STARTED  // 又动了→回到行程中
                    idleDuration = 0
                } else {
                    idleDuration = System.currentTimeMillis() - idleStartTimestamp
                }
            }
        }
    }

    /** 是否应该结束行程（停车超过5分钟） */
    fun shouldEndTrip(): Boolean {
        return state == TripState.IDLING &&
               (System.currentTimeMillis() - idleStartTimestamp) > 5 * 60 * 1000L
    }

    fun reset() {
        state = TripState.IDLE
        idleDuration = 0
    }
}
