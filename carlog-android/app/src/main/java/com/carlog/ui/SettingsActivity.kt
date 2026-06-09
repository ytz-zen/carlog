package com.carlog.ui

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import kotlinx.coroutines.*

class SettingsActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_settings)
        db = CarLogDatabase.getInstance(this)

        val etCarName = findViewById<EditText>(R.id.etCarName)
        val etServer = findViewById<EditText>(R.id.etServerUrl)
        val etKey = findViewById<EditText>(R.id.etApiKey)
        val etTank = findViewById<EditText>(R.id.etTankCapacity)
        val btnSave = findViewById<Button>(R.id.btnSave)

        scope.launch {
            db.configDao().getString("car_name")?.let { etCarName.setText(it) }
            db.configDao().getString("server_url")?.let { etServer.setText(it) }
            db.configDao().getString("api_key")?.let { etKey.setText(it) }
            db.configDao().getString("tank_capacity")?.let { etTank.setText(it) }
        }

        btnSave.setOnClickListener {
            scope.launch {
                val name = etCarName.text.toString().trim()
                val server = etServer.text.toString().trim()
                val key = etKey.text.toString().trim()
                val tank = etTank.text.toString().trim().ifEmpty { "60" }
                if (name.isNotEmpty()) db.configDao().saveString("car_name", name)
                if (server.isNotEmpty()) db.configDao().saveString("server_url", server)
                if (key.isNotEmpty()) db.configDao().saveString("api_key", key)
                db.configDao().saveString("tank_capacity", tank)
                Toast.makeText(this@SettingsActivity, "保存成功", Toast.LENGTH_SHORT).show()
                finish()
            }
        }
    }

    override fun onDestroy() {
        super.onDestroy()
        scope.cancel()
    }
}
