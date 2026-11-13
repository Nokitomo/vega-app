package com.vega

import android.app.NotificationChannel
import android.app.NotificationManager
import android.content.Context
import android.content.pm.ServiceInfo
import android.os.Build
import android.net.ConnectivityManager
import android.net.NetworkCapabilities
import androidx.core.app.NotificationCompat
import androidx.work.*
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.*
import com.facebook.react.modules.network.OkHttpClientProvider
import com.facebook.react.uimanager.ViewManager
import org.json.JSONObject
import org.json.JSONArray
import okhttp3.Request
import java.io.*
import java.security.MessageDigest
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import java.util.concurrent.atomic.AtomicBoolean
import java.util.zip.GZIPInputStream

private const val MANIFEST = "https://raw.githubusercontent.com/Nokitomo/database/cinema-sqlite-lite/manifest.json"
private val SHA = Regex("[a-f0-9]{64}")
private val ASSET_URL = Regex("https://github.com/Nokitomo/database/releases/download/cinema-sqlite(?:-lite)?-v1-[a-f0-9]{64}/[a-zA-Z0-9._-]+\\.gz")
internal object CatalogFiles {
  val transferMutex = Object()
  fun root(c: Context) = File(c.noBackupFilesDir, "catalogs/cinema").apply { mkdirs() }
  fun prefs(c: Context) = c.getSharedPreferences("vega-catalog", Context.MODE_PRIVATE)
  fun networkAllowed(c: Context): Boolean {
    if (prefs(c).getBoolean("cellular", false)) return true
    val manager = c.getSystemService(Context.CONNECTIVITY_SERVICE) as ConnectivityManager
    val capabilities = manager.getNetworkCapabilities(manager.activeNetwork) ?: return false
    return !manager.isActiveNetworkMetered && !capabilities.hasTransport(NetworkCapabilities.TRANSPORT_CELLULAR)
  }
  fun file(c: Context, name: String): File {
    val root = root(c).canonicalFile
    val target = File(name).canonicalFile
    require(target.parentFile == root) { "catalog.invalidPath" }
    return target
  }
  fun state(c: Context, status: String, bytes: Long = 0, total: Long = 0, error: String? = null) {
    val value = JSONObject().put("status", status).put("bytes", bytes).put("total", total)
    if (error != null) value.put("error", error)
    prefs(c).edit().putString("state", value.toString()).apply()
  }
  fun hash(file: File): String {
    val hash = MessageDigest.getInstance("SHA-256")
    file.inputStream().buffered().use { input ->
      val buffer = ByteArray(256 * 1024)
      while (true) { val n = input.read(buffer); if (n < 0) break; hash.update(buffer, 0, n) }
    }
    return hash.digest().joinToString("") { "%02x".format(it) }
  }
  fun assets(manifest: JSONObject, revision: String): List<JSONObject> {
    val lite = manifest.optString("format") == "vega-cinema-lite-v1"
    require(manifest.getString("catalogId") == "cinema" && manifest.getInt("schemaVersion") == 1 &&
      (lite || manifest.getInt("minimumReaderVersion") == 1 && !manifest.getBoolean("validationOnly")) &&
      SHA.matches(manifest.getString("revision"))) { "catalog.invalidManifest" }
    val snapshot = manifest.getJSONObject("snapshot")
    val raw = snapshot.getLong("uncompressedBytes")
    require(raw in 1..(32L * 1024 * 1024 * 1024) && SHA.matches(snapshot.getString("uncompressedSha256")))
    val deltas = if (lite) JSONArray() else manifest.getJSONArray("deltas")
    require(deltas.length() <= 100)
    fun valid(a: JSONObject) {
      require(ASSET_URL.matches(a.getString("url")) && SHA.matches(a.getString("sha256")) &&
        a.getLong("bytes") in 1..(16L * 1024 * 1024 * 1024) &&
        a.getString("url").endsWith("/" + a.getString("name")))
    }
    valid(snapshot)
    if (lite) require(snapshot.getString("name") == "cinema.sqlite.gz" && snapshot.getString("url").contains("/cinema-sqlite-lite-v1-"))
    if (revision == manifest.getString("revision")) return emptyList()
    var start = -1
    for (i in 0 until deltas.length()) {
      val d = deltas.getJSONObject(i); valid(d)
      require(SHA.matches(d.getString("fromRevision")) && SHA.matches(d.getString("toRevision")))
      if (d.getString("fromRevision") == revision) start = i
    }
    var current = revision
    val result = mutableListOf<JSONObject>()
    if (start >= 0) for (i in start until deltas.length()) {
      val d = deltas.getJSONObject(i)
      if (d.getString("fromRevision") != current) break
      result.add(d); current = d.getString("toRevision")
      if (current == manifest.getString("revision")) {
        if (result.sumOf { it.getLong("bytes") } < snapshot.getLong("bytes")) return result
        break
      }
    }
    return listOf(snapshot)
  }
}

class CatalogDownloadWorker(context: Context, params: WorkerParameters) : Worker(context, params) {
  override fun doWork(): Result {
    synchronized(CatalogFiles.transferMutex) {
    // A manual check and a periodic check share one transfer. Never let them
    // write the same partial archive concurrently.
    val lockFile = RandomAccessFile(File(CatalogFiles.root(applicationContext), "transfer.lock"), "rw")
    val lock = try { lockFile.channel.tryLock() } catch (_: java.nio.channels.OverlappingFileLockException) { null }
    if (lock == null) {lockFile.close(); return Result.retry()}
    return try { download() } finally {lock.release(); lockFile.close()}
    }
  }
  private fun download(): Result {
    val context = applicationContext
    val prefs = CatalogFiles.prefs(context)
    if (prefs.getBoolean("paused", false)) return Result.success()
    if (inputData.getBoolean("periodic", false) && !prefs.getBoolean("automatic", false)) return Result.success()
    val root = CatalogFiles.root(context)
    // Do not overwrite a downloaded generation awaiting foreground installation.
    if (File(root, "pending.json").exists()) return Result.success()
    if (!CatalogFiles.networkAllowed(context)) {CatalogFiles.state(context, "queued"); return Result.retry()}
    try {
      val manager = context.getSystemService(Context.NOTIFICATION_SERVICE) as NotificationManager
      val title = prefs.getString("title", "Vega") ?: "Vega"
      if (Build.VERSION.SDK_INT >= 26) manager.createNotificationChannel(NotificationChannel("catalog", title, NotificationManager.IMPORTANCE_LOW))
      val notification = NotificationCompat.Builder(context, "catalog").setSmallIcon(android.R.drawable.stat_sys_download)
        .setContentTitle(title).setOngoing(true).setProgress(0, 0, true).build()
      val foreground = if (Build.VERSION.SDK_INT >= 29) ForegroundInfo(7194, notification, ServiceInfo.FOREGROUND_SERVICE_TYPE_DATA_SYNC) else ForegroundInfo(7194, notification)
      setForegroundAsync(foreground).get()
      val client = OkHttpClientProvider.getOkHttpClient().newBuilder().callTimeout(0, TimeUnit.MILLISECONDS)
        .connectTimeout(30, TimeUnit.SECONDS).readTimeout(60, TimeUnit.SECONDS).build()
      val text = client.newCall(Request.Builder().url(MANIFEST).build()).execute().use { response ->
        require(response.isSuccessful)
        val body = response.body ?: error("catalog.network")
        body.byteStream().use { input ->
          val bytes = input.readBytesLimited(1024 * 1024)
          String(bytes, Charsets.UTF_8)
        }
      }
      val manifest = JSONObject(text)
      if (prefs.getBoolean("forceSnapshot", false)) manifest.put("deltas", JSONArray())
      val assets = CatalogFiles.assets(manifest, prefs.getString("revision", "") ?: "")
      if (assets.isEmpty()) {CatalogFiles.state(context, "ready"); return Result.success()}
      val total = assets.sumOf { it.getLong("bytes") }
      val multiplier = if (assets.first().getString("sha256") == manifest.getJSONObject("snapshot").getString("sha256")) 1 else 3
      require(root.usableSpace >= total + manifest.getJSONObject("snapshot").getLong("uncompressedBytes") * multiplier + 256L * 1024 * 1024) { "catalog.noSpace" }
      var completed = 0L
      for (asset in assets) {
        if (isStopped) return Result.retry()
        val digest = asset.getString("sha256")
        val target = File(root, "$digest.gz")
        val partial = File(root, "$digest.gz.part")
        val expected = asset.getLong("bytes")
        if (target.length() == expected && CatalogFiles.hash(target) == digest) {completed += expected; continue}
        if (partial.length() > expected) partial.delete()
        val offset = partial.length()
        val request = Request.Builder().url(asset.getString("url"))
        if (offset > 0) request.header("Range", "bytes=$offset-")
        client.newCall(request.build()).execute().use { response ->
          require(response.isSuccessful && response.request.url.isHttps) { "catalog.network" }
          val append = offset > 0 && response.code == 206
          if (append) require(response.header("Content-Range")?.startsWith("bytes $offset-") == true)
          var done = if (append) offset else 0L
          response.body!!.byteStream().use { input -> FileOutputStream(partial, append).buffered().use { output ->
            val buffer = ByteArray(256 * 1024)
            var lastUpdate = 0L
            while (true) {
              if (isStopped || prefs.getBoolean("paused", false)) throw InterruptedIOException()
              if (!CatalogFiles.networkAllowed(context)) throw CatalogNetworkWait()
              val n = input.read(buffer); if (n < 0) break
              done += n; require(done <= expected) { "catalog.checksum" }; output.write(buffer, 0, n)
              val now = System.currentTimeMillis()
              if (now - lastUpdate > 500) { CatalogFiles.state(context, "downloading", completed + done, total); lastUpdate = now }
            }
          } }
        }
        if (partial.length() != expected || CatalogFiles.hash(partial) != digest) {partial.delete(); error("catalog.checksum")}
        require(partial.renameTo(target))
        completed += expected
      }
      val staging = File(root, "pending.json.tmp"); staging.writeText(manifest.toString())
      require(staging.renameTo(File(root, "pending.json")))
      CatalogFiles.state(context, "downloaded", total, total)
      return Result.success()
    } catch (e: Exception) {
      if (isStopped || prefs.getBoolean("paused", false)) return Result.retry()
      if (e is CatalogNetworkWait) {CatalogFiles.state(context, "queued"); return Result.retry()}
      val code = if (e.message == "catalog.noSpace") "catalog.noSpace" else if (e.message == "catalog.checksum") "catalog.checksum" else "catalog.transferFailed"
      CatalogFiles.state(context, "error", error = code)
      return if (runAttemptCount < 3) Result.retry() else Result.failure()
    }
  }
}
private class CatalogNetworkWait : IOException()
private fun InputStream.readBytesLimited(limit: Int): ByteArray {
  val output = ByteArrayOutputStream()
  val buffer = ByteArray(8192)
  while (true) {val n = read(buffer); if (n < 0) break; require(output.size() + n <= limit); output.write(buffer, 0, n)}
  return output.toByteArray()
}

class VegaCatalogModule(private val context: ReactApplicationContext) : ReactContextBaseJavaModule(context) {
  private val executor = Executors.newSingleThreadExecutor()
  private val preparationCancelled = AtomicBoolean(false)
  @Volatile private var preparationProgress = JSONObject().put("active", false)
  private var lines: BufferedReader? = null
  private var digest: MessageDigest? = null
  override fun getName() = "VegaCatalog"
  private fun task(p: Promise, action: () -> Any?) {executor.execute {try {p.resolve(action())} catch (e: Exception) {p.reject("catalog.io", "catalog.io")}}}
  @ReactMethod fun root(p: Promise) {p.resolve(CatalogFiles.root(context).absolutePath)}
  @ReactMethod fun beginPreparation(p: Promise) {preparationCancelled.set(false); preparationProgress = JSONObject().put("active", false); p.resolve(null)}
  @ReactMethod fun cancelPreparation(p: Promise) {preparationCancelled.set(true); p.resolve(null)}
  @ReactMethod fun preparationStatus(p: Promise) {p.resolve(JSONArguments(preparationProgress))}
  @ReactMethod fun prepareFile(mode: String, source: String, target: String, limit: Double, phase: String, p: Promise) {
    executor.execute {
      try {
        require(limit > 0 && limit <= 64.0 * 1024 * 1024 * 1024)
        require(mode in listOf("hash", "extract", "copy"))
        val inputFile = CatalogFiles.file(context, source)
        val outputFile = if (mode == "hash") null else CatalogFiles.file(context, target)
        require(outputFile == null || outputFile != inputFile)
        val hash = MessageDigest.getInstance("SHA-256")
        var count = 0L
        var lastUpdate = 0L
        fun progress() {preparationProgress = JSONObject().put("active", true).put("phase", phase).put("bytes", count).put("total", limit)}
        progress()
        val raw = inputFile.inputStream().buffered()
        val input = if (mode == "extract") try {GZIPInputStream(raw)} catch (e: Exception) {raw.close(); throw e} else raw
        input.use { stream ->
          val output = outputFile?.outputStream()?.buffered()
          try {
            val buffer = ByteArray(256 * 1024)
            while (true) {
              if (preparationCancelled.get()) throw InterruptedIOException("catalog.preparationPaused")
              val n = stream.read(buffer); if (n < 0) break
              count += n; require(count <= limit.toLong()) {"catalog.checksum"}
              hash.update(buffer, 0, n); output?.write(buffer, 0, n)
              val now = System.currentTimeMillis()
              if (now - lastUpdate >= 200) {progress(); lastUpdate = now}
            }
          } finally {output?.close()}
        }
        if (preparationCancelled.get()) throw InterruptedIOException("catalog.preparationPaused")
        if (mode != "extract") require(count == limit.toLong()) {"catalog.checksum"}
        p.resolve(hash.digest().joinToString("") {"%02x".format(it)})
      } catch (e: Exception) {
        val code = if (preparationCancelled.get()) "catalog.preparationPaused" else if (e.message == "catalog.checksum") "catalog.checksum" else "catalog.io"
        p.reject(code, code)
      } finally {preparationProgress = JSONObject().put("active", false)}
    }
  }
  private fun constraints() = Constraints.Builder().setRequiredNetworkType(if (CatalogFiles.prefs(context).getBoolean("cellular", false)) NetworkType.CONNECTED else NetworkType.UNMETERED).setRequiresStorageNotLow(true).build()
  @ReactMethod fun configure(automatic: Boolean, cellular: Boolean, revision: String, title: String, p: Promise) {
    val prefs = CatalogFiles.prefs(context)
    val policyChanged = prefs.getBoolean("cellular", false) != cellular
    val previousState = JSONObject(prefs.getString("state", "{}")!!).optString("status")
    CatalogFiles.prefs(context).edit().putBoolean("automatic", automatic).putBoolean("cellular", cellular).putString("revision", revision).putString("title", title).apply()
    val work = WorkManager.getInstance(context)
    if (automatic) work.enqueueUniquePeriodicWork("catalog-check", ExistingPeriodicWorkPolicy.UPDATE,
      PeriodicWorkRequestBuilder<CatalogDownloadWorker>(2, TimeUnit.HOURS).setConstraints(constraints()).setInputData(workDataOf("periodic" to true)).build())
    else work.cancelUniqueWork("catalog-check")
    if (policyChanged && previousState in listOf("queued", "downloading") && !prefs.getBoolean("paused", false)) {
      work.enqueueUniqueWork("catalog-download", ExistingWorkPolicy.REPLACE,
        OneTimeWorkRequestBuilder<CatalogDownloadWorker>().setConstraints(constraints()).build())
    }
    p.resolve(null)
  }
  @ReactMethod fun start(forceSnapshot: Boolean, p: Promise) {
    if (File(CatalogFiles.root(context), "pending.json").exists()) {CatalogFiles.state(context, "downloaded"); p.resolve(null); return}
    CatalogFiles.prefs(context).edit().putBoolean("paused", false).apply()
    CatalogFiles.prefs(context).edit().putBoolean("forceSnapshot", forceSnapshot).apply()
    CatalogFiles.state(context, "queued")
    WorkManager.getInstance(context).enqueueUniqueWork("catalog-download", ExistingWorkPolicy.KEEP,
      OneTimeWorkRequestBuilder<CatalogDownloadWorker>().setConstraints(constraints()).build())
    p.resolve(null)
  }
  @ReactMethod fun pause(p: Promise) {
    CatalogFiles.prefs(context).edit().putBoolean("paused", true).apply()
    WorkManager.getInstance(context).cancelUniqueWork("catalog-download")
    WorkManager.getInstance(context).cancelUniqueWork("catalog-check")
    CatalogFiles.state(context, "paused"); p.resolve(null)
  }
  @ReactMethod fun cancel(p: Promise) {
    CatalogFiles.prefs(context).edit().putBoolean("paused", true).apply()
    task(p) {
      WorkManager.getInstance(context).cancelUniqueWork("catalog-download").result.get()
      WorkManager.getInstance(context).cancelUniqueWork("catalog-check").result.get()
      synchronized(CatalogFiles.transferMutex) {
        CatalogFiles.root(context).listFiles()?.filter { it.name.endsWith(".gz") || it.name.endsWith(".part") || it.name.startsWith("pending.json") }?.forEach { it.delete() }
        CatalogFiles.state(context, "idle"); null
      }
    }
  }
  @ReactMethod fun status(p: Promise) {p.resolve(JSONArguments(JSONObject(CatalogFiles.prefs(context).getString("state", "{\"status\":\"idle\",\"bytes\":0,\"total\":0}")!!)))}
  @ReactMethod fun pending(p: Promise) = task(p) {File(CatalogFiles.root(context), "pending.json").takeIf { it.exists() }?.readText()}
  @ReactMethod fun acknowledge(p: Promise) = task(p) {
    CatalogFiles.prefs(context).edit().putBoolean("forceSnapshot", false).apply()
    CatalogFiles.root(context).listFiles()?.filter { it.name.endsWith(".gz") || it.name.startsWith("pending.json") }?.forEach { it.delete() }; CatalogFiles.state(context, "ready"); null
  }
  @ReactMethod fun gunzip(source: String, target: String, limit: Double, p: Promise) = task(p) {
    require(limit > 0 && limit <= 64.0 * 1024 * 1024 * 1024)
    val dest = CatalogFiles.file(context, target)
    GZIPInputStream(CatalogFiles.file(context, source).inputStream().buffered()).use { input -> dest.outputStream().buffered().use { output ->
      val buffer = ByteArray(256 * 1024); var count = 0L
      while (true) {val n = input.read(buffer); if (n < 0) break; count += n; require(count <= limit); output.write(buffer, 0, n)}
    } }; null
  }
  @ReactMethod fun openLines(file: String, p: Promise) = task(p) {lines?.close(); lines = CatalogFiles.file(context, file).bufferedReader(); null}
  @ReactMethod fun readLines(p: Promise) = task(p) {
    val result = Arguments.createArray(); var count = 0
    while (count < 128) {
      val line = StringBuilder()
      val reader = lines ?: error("closed")
      while (true) {val c = reader.read(); if (c < 0 || c == 10) break; require(line.length < 8 * 1024 * 1024); line.append(c.toChar())}
      if (line.isEmpty()) break
      result.pushString(line.toString()); count++
      if (line.length > 256 * 1024) break
    }; result
  }
  @ReactMethod fun closeLines(p: Promise) = task(p) {lines?.close(); lines = null; null}
  @ReactMethod fun beginHash(prefix: String, p: Promise) = task(p) {digest = MessageDigest.getInstance("SHA-256").apply {update(prefix.toByteArray(Charsets.UTF_8))}; null}
  @ReactMethod fun appendHash(values: ReadableArray, p: Promise) = task(p) {for (i in 0 until values.size()) digest!!.update(values.getString(i)!!.toByteArray(Charsets.UTF_8)); null}
  @ReactMethod fun finishHash(p: Promise) = task(p) {digest!!.digest().joinToString("") { "%02x".format(it) }.also {digest = null}}
  private fun JSONArguments(value: JSONObject): WritableMap {
    val result = Arguments.createMap()
    value.keys().forEach { key -> when (val v = value.get(key)) {is String -> result.putString(key, v); is Boolean -> result.putBoolean(key, v); is Number -> result.putDouble(key, v.toDouble())} }
    return result
  }
}
class VegaCatalogPackage : ReactPackage {
  @Suppress("OVERRIDE_DEPRECATION")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> = listOf(VegaCatalogModule(reactContext))
  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> = emptyList()
}
