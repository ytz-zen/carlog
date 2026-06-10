package com.carlog.ui

import android.content.Context
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.BaseAdapter
import android.widget.TextView
import java.text.SimpleDateFormat
import java.util.Locale

class HistoryTripAdapter(
    private val ctx: Context,
    private val trips: List<MainActivity.TripSummary>
) : BaseAdapter() {

    private val dateFormat = SimpleDateFormat("MM/dd HH:mm", Locale.CHINA)

    override fun getCount() = trips.size
    override fun getItem(position: Int) = trips[position]
    override fun getItemId(position: Int) = position.toLong()

    override fun getView(position: Int, convertView: View?, parent: ViewGroup?): View {
        val view = convertView ?: LayoutInflater.from(ctx)
            .inflate(R.layout.item_history_trip, parent, false)

        val trip = trips[position]
        val tvTime = view.findViewById<TextView>(com.carlog.R.id.tvTripTime)
        val tvDuration = view.findViewById<TextView>(com.carlog.R.id.tvTripDuration)
        val tvDistance = view.findViewById<TextView>(com.carlog.R.id.tvTripDistance)

        val start = dateFormat.format(java.util.Date(trip.startTime.toLong()))
        val end = trip.endTime?.let {
            if (it.isNotEmpty()) " - " + dateFormat.format(java.util.Date(it.toLong())) else ""
        } ?: ""
        tvTime.text = start + end

        val mins = trip.duration / 60
        val secs = trip.duration % 60
        tvDuration.text = "${mins}分${secs}秒"

        tvDistance.text = "📏 ${"%.1f".format(trip.distance)}km"

        return view
    }
}
