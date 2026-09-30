package com.vega

import android.content.Context
import android.os.Build
import android.util.Log
import java.io.File
import java.net.InetAddress
import java.net.InetSocketAddress
import java.net.Proxy
import java.net.ServerSocket
import java.net.Socket
import java.util.concurrent.TimeUnit
import okhttp3.Dns
import okhttp3.OkHttpClient
import okhttp3.Request

data class VegaWarpStatus(
  val supported: Boolean,
  val state: String,
  val running: Boolean,
  val registered: Boolean,
  val port: Int?,
  val abi: String,
)

/**
 * Owns the app-scoped usque process used to proxy Vega's shared OkHttp traffic through WARP.
 * The proxy is published to VegaDnsController only after an end-to-end WARP check succeeds.
 */
object VegaWarpController {
  private const val TAG = "VegaWarpController"
  private const val BINARY_NAME = "libusque.so"
  private const val CONFIG_NAME = "config.json"
  private const val TRACE_URL = "https://www.cloudflare.com/cdn-cgi/trace"
  private const val START_ATTEMPTS = 3
  private const val START_TIMEOUT_MS = 15_000L
  private const val REGISTRATION_TIMEOUT_SECONDS = 30L
  private const val VERIFY_TIMEOUT_SECONDS = 15L

  private val lock = Any()

  @Volatile
  private var state = "stopped"

  private var process: Process? = null
  private var activePort: Int? = null
  private var generation = 0L

  fun getStatus(context: Context): VegaWarpStatus = synchronized(lock) {
    statusLocked(context.applicationContext)
  }

  fun start(context: Context): VegaWarpStatus = synchronized(lock) {
    val appContext = context.applicationContext
    val existing = process
    if (existing?.isAlive == true && activePort != null) {
      return statusLocked(appContext)
    }

    val binary = resolveBinary(appContext)
      ?: throw IllegalStateException("WARP is not available for this Android ABI")
    val config = configFile(appContext)
    val currentGeneration = ++generation
    state = "starting"

    try {
      if (!config.isFile || config.length() == 0L) {
        register(binary, config)
      }

      var lastError: Throwable? = null
      repeat(START_ATTEMPTS) {
        val port = findAvailablePort()
        val candidate = startProxy(binary, config, port)
        process = candidate
        activePort = null

        try {
          waitUntilListening(candidate, port)
          verifyWarp(port)
          activePort = port
          state = "running"
          VegaDnsController.setWarpProxyPort(port)
          watchProcess(candidate, currentGeneration)
          Log.i(TAG, "WARP proxy started for ABI ${primaryAbi()}")
          return statusLocked(appContext)
        } catch (error: Throwable) {
          lastError = error
          stopProcess(candidate)
          if (process === candidate) {
            process = null
          }
        }
      }

      throw IllegalStateException("Unable to start and verify the WARP tunnel", lastError)
    } catch (error: Throwable) {
      activePort = null
      process = null
      state = "error"
      VegaDnsController.setWarpProxyPort(null)
      throw error
    }
  }

  fun stop(context: Context): VegaWarpStatus = synchronized(lock) {
    generation += 1
    state = "stopping"
    VegaDnsController.setWarpProxyPort(null)
    val current = process
    process = null
    activePort = null
    if (current != null) {
      stopProcess(current)
    }
    state = "stopped"
    Log.i(TAG, "WARP proxy stopped")
    statusLocked(context.applicationContext)
  }

  private fun register(binary: File, config: File) {
    config.parentFile?.mkdirs()
    val registration = ProcessBuilder(
      binary.absolutePath,
      "-c",
      config.absolutePath,
      "register",
      "--accept-tos",
    )
      .directory(config.parentFile)
      .redirectErrorStream(true)
      .start()
    drainOutput(registration, "registration")

    if (!registration.waitFor(REGISTRATION_TIMEOUT_SECONDS, TimeUnit.SECONDS)) {
      stopProcess(registration)
      config.delete()
      throw IllegalStateException("WARP registration timed out")
    }
    if (registration.exitValue() != 0 || !config.isFile || config.length() == 0L) {
      config.delete()
      throw IllegalStateException("WARP registration failed")
    }

    config.setReadable(false, false)
    config.setWritable(false, false)
    config.setReadable(true, true)
    config.setWritable(true, true)
  }

  private fun startProxy(binary: File, config: File, port: Int): Process {
    val proxy = ProcessBuilder(
      binary.absolutePath,
      "-c",
      config.absolutePath,
      "l4-http-proxy",
      "--bind",
      "127.0.0.1",
      "--port",
      port.toString(),
    )
      .directory(config.parentFile)
      .redirectErrorStream(true)
      .start()
    drainOutput(proxy, "proxy")
    return proxy
  }

  private fun waitUntilListening(candidate: Process, port: Int) {
    val deadline = System.nanoTime() + TimeUnit.MILLISECONDS.toNanos(START_TIMEOUT_MS)
    while (System.nanoTime() < deadline) {
      if (!candidate.isAlive) {
        throw IllegalStateException("WARP proxy exited before becoming ready")
      }
      try {
        Socket().use { socket ->
          socket.connect(InetSocketAddress("127.0.0.1", port), 250)
          return
        }
      } catch (_: Throwable) {
        Thread.sleep(100)
      }
    }
    throw IllegalStateException("WARP proxy did not become ready")
  }

  private fun verifyWarp(port: Int) {
    val client = OkHttpClient.Builder()
      .proxy(Proxy(Proxy.Type.HTTP, InetSocketAddress("127.0.0.1", port)))
      .dns(Dns.SYSTEM)
      .connectTimeout(VERIFY_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      .readTimeout(VERIFY_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      .writeTimeout(VERIFY_TIMEOUT_SECONDS, TimeUnit.SECONDS)
      .build()
    val request = Request.Builder().url(TRACE_URL).get().build()

    client.newCall(request).execute().use { response ->
      val body = response.body?.string().orEmpty()
      val warpValue = body.lineSequence()
        .firstOrNull { it.startsWith("warp=") }
        ?.substringAfter('=')
      if (!response.isSuccessful || warpValue == null || warpValue == "off") {
        throw IllegalStateException("WARP tunnel verification failed")
      }
    }
  }

  private fun watchProcess(candidate: Process, expectedGeneration: Long) {
    Thread({
      val exitCode = runCatching { candidate.waitFor() }.getOrDefault(-1)
      synchronized(lock) {
        if (generation == expectedGeneration && process === candidate) {
          process = null
          activePort = null
          state = "error"
          VegaDnsController.setWarpProxyPort(null)
          Log.w(TAG, "WARP proxy exited unexpectedly with code $exitCode")
        }
      }
    }, "VegaWarpWatcher").apply {
      isDaemon = true
      start()
    }
  }

  private fun drainOutput(candidate: Process, label: String) {
    Thread({
      runCatching {
        candidate.inputStream.bufferedReader().useLines { lines ->
          lines.forEach { _ -> Unit }
        }
      }
    }, "VegaWarpOutput-$label").apply {
      isDaemon = true
      start()
    }
  }

  private fun stopProcess(candidate: Process) {
    if (!candidate.isAlive) {
      return
    }
    candidate.destroy()
    if (!candidate.waitFor(2, TimeUnit.SECONDS)) {
      candidate.destroyForcibly()
      candidate.waitFor(2, TimeUnit.SECONDS)
    }
  }

  private fun statusLocked(context: Context): VegaWarpStatus {
    val currentProcess = process
    val isRunning = currentProcess?.isAlive == true && activePort != null && state == "running"
    if (!isRunning && state == "running") {
      activePort = null
      state = "error"
      VegaDnsController.setWarpProxyPort(null)
    }
    return VegaWarpStatus(
      supported = resolveBinary(context) != null,
      state = state,
      running = isRunning,
      registered = configFile(context).let { it.isFile && it.length() > 0L },
      port = if (isRunning) activePort else null,
      abi = primaryAbi(),
    )
  }

  private fun configFile(context: Context): File =
    File(File(context.noBackupFilesDir, "warp"), CONFIG_NAME)

  private fun resolveBinary(context: Context): File? {
    val candidate = File(context.applicationInfo.nativeLibraryDir, BINARY_NAME)
    return candidate.takeIf { it.isFile && it.canExecute() && it.length() > 0L }
  }

  private fun primaryAbi(): String = Build.SUPPORTED_ABIS.firstOrNull().orEmpty()

  private fun findAvailablePort(): Int =
    ServerSocket(0, 1, InetAddress.getByName("127.0.0.1")).use { it.localPort }
}
