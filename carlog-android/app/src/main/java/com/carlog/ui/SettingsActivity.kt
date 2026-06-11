package com.carlog.ui

import android.os.Bundle
import android.widget.*
import androidx.appcompat.app.AppCompatActivity
import androidx.appcompat.widget.SwitchCompat
import com.carlog.R
import com.carlog.data.db.CarLogDatabase
import kotlinx.coroutines.*

class SettingsActivity : AppCompatActivity() {
    private lateinit var db: CarLogDatabase
    private val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main)

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        supportActionBar?.hide()
        setContentView(R.layout.activity_settings)
        db = CarLogDatabase.getInstance(this)

        val etCarName = findViewById<EditText>(R.id.etCarName)
        val etServer = findViewById<EditText>(R.id.etServerUrl)
        val etKey = findViewById<EditText>(R.id.etApiKey)
        val etTank = findViewById<EditText>(R.id.etTankCapacity)
        val switchPushLogs = findViewById<SwitchCompat>(R.id.switchPushLogs)
        val btnSave = findViewById<Button>(R.id.btnSave)

        scope.launch {
            db.configDao().getString("car_name")?.let { etCarName.setText(it) }
            db.configDao().getString("server_url")?.let { etServer.setText(it) }
            db.configDao().getString("api_key")?.let { etKey.setText(it) }
            db.configDao().getString("tank_capacity")?.let { etTank.setText(it) }
            db.configDao().getString("push_logs")?.let {
                switchPushLogs.isChecked = it == "true"
            }
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
                db.configDao().saveString("push_logs", switchPushLogs.isChecked.toString())
                
                // 保存后立即识别车辆
                if (name.isNotEmpty() && key.isNotEmpty()) {
                    try {
                        val uploadRepo = com.carlog.repo.UploadRepo(this@SettingsActivity, db)
                        val result = withContext(Dispatchers.IO) {
                            uploadRepo.identifyCar(name)
                        }
                        if (result != null) {
                            db.configDao().saveString("car_id", result.carId)
                            db.configDao().saveString("tank_id", result.tankId)
                            Toast.makeText(this@SettingsActivity, "✅ 车辆已识别: ${result.name}", Toast.LENGTH_LONG).show()
                        } else {
                            Toast.makeText(this@SettingsActivity, "⚠️ 车辆识别失败，请检查服务器设置", Toast.LENGTH_LONG).show()
                        }
                    } catch (e: Exception) {
                        Toast.makeText(this@SettingsActivity, "⚠️ 识别失败: ${e.message}", Toast.LENGTH_LONG).show()
                    }
                }
                
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
