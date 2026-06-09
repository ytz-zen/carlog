package com.carlog.tracker

import android.bluetooth.BluetoothAdapter
import android.bluetooth.BluetoothDevice
import android.bluetooth.BluetoothSocket
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import java.io.InputStream
import java.io.OutputStream
import java.util.*

data class ObdData(
    val connected: Boolean = false,
    val fuelLevel: Float? = null,
    val rpm: Int? = null,
    val speed: Float? = null,
    val coolantTemp: Int? = null,
    val error: String? = null
)

class ObdReader {
    private var socket: BluetoothSocket? = null
    private var input: InputStream? = null
    private var output: OutputStream? = null

    /** 搜索已配对的 ELM327 OBD 设备 */
    fun findObdDevice(): BluetoothDevice? {
        val adapter = BluetoothAdapter.getDefaultAdapter() ?: return null
        if (!adapter.isEnabled) return null
        return adapter.bondedDevices.firstOrNull { device ->
            device.name?.contains("OBD", true) == true ||
            device.name?.contains("ELM", true) == true ||
            device.name?.contains("obd", true) == true ||
            device.name?.contains("elm", true) == true ||
            device.name?.contains("CAR", true) == true ||
            device.name?.contains("蓝牙", true) == true
        }
    }

    /** 连接到 OBD 设备 */
    suspend fun connect(device: BluetoothDevice): String? = withContext(Dispatchers.IO) {
        try {
            val uuid = UUID.fromString("00001101-0000-1000-8000-00805F9B34FB") // SPP
            socket = device.createRfcommSocketToServiceRecord(uuid)
            socket?.connect()
            input = socket?.inputStream
            output = socket?.outputStream

            // 初始化 ELM327
            sendCmd("ATZ")        // 复位
            Thread.sleep(1000)
            sendCmd("ATE0")       // 关闭回显
            Thread.sleep(500)
            sendCmd("ATL0")       // 关闭换行
            Thread.sleep(200)
            sendCmd("ATS0")       // 关闭空格
            Thread.sleep(200)

            null // 连接成功
        } catch (e: Exception) {
            disconnect()
            e.message ?: "连接失败"
        }
    }

    /** 读取 OBD 数据 */
    suspend fun readData(): ObdData = withContext(Dispatchers.IO) {
        if (socket == null || socket?.isConnected != true) return@withContext ObdData()

        try {
            val fuel = readFuelLevel()
            val rpm = readRpm()
            val speed = readSpeed()
            val temp = readCoolantTemp()
            ObdData(connected = true, fuelLevel = fuel, rpm = rpm, speed = speed, coolantTemp = temp)
        } catch (e: Exception) {
            ObdData(error = e.message)
        }
    }

    private fun sendCmd(cmd: String) {
        output?.write((cmd + "\r").toByteArray())
        output?.flush()
    }

    private fun readResponse(): String? {
        Thread.sleep(200)
        val buf = ByteArray(1024)
        val n = input?.read(buf) ?: return null
        return String(buf, 0, n).trim()
    }

    /** 读取油量 % (PID 012F) */
    private fun readFuelLevel(): Float? {
        sendCmd("012F")
        val resp = readResponse() ?: return null
        // 响应格式: "412F <hex>" 或 "412F<hex>"
        val clean = resp.replace(" ", "").replace("\r", "").replace("\n", "")
        return if (clean.length >= 6) {
            val hex = clean.substring(4, 6)
            hex.toIntOrNull(16)?.div(2.55f)
        } else null
    }

    /** 读取转速 (PID 010C) */
    private fun readRpm(): Int? {
        sendCmd("010C")
        val resp = readResponse() ?: return null
        val clean = resp.replace(" ", "").replace("\r", "").replace("\n", "")
        return if (clean.length >= 8) {
            val a = clean.substring(4, 6).toIntOrNull(16) ?: return null
            val b = clean.substring(6, 8).toIntOrNull(16) ?: return null
            (a * 256 + b) / 4
        } else null
    }

    /** 读取车速 (PID 010D) */
    private fun readSpeed(): Float? {
        sendCmd("010D")
        val resp = readResponse() ?: return null
        val clean = resp.replace(" ", "").replace("\r", "").replace("\n", "")
        return if (clean.length >= 6) {
            clean.substring(4, 6).toIntOrNull(16)?.toFloat()
        } else null
    }

    /** 读取水温 (PID 0105) */
    private fun readCoolantTemp(): Int? {
        sendCmd("0105")
        val resp = readResponse() ?: return null
        val clean = resp.replace(" ", "").replace("\r", "").replace("\n", "")
        return if (clean.length >= 6) {
            clean.substring(4, 6).toIntOrNull(16)?.minus(40)
        } else null
    }

    fun disconnect() {
        try { socket?.close() } catch (_: Exception) {}
        socket = null
        input = null
        output = null
    }
}
