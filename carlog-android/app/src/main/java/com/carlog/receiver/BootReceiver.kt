package com.carlog.receiver
import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import com.carlog.service.GpsTrackService

class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED) {
            context.startForegroundService(Intent(context, GpsTrackService::class.java).apply {
                action = "com.carlog.START_TRACKING"
            })
        }
    }
}
