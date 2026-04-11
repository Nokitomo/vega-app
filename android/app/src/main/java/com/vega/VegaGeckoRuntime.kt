package com.vega

import android.content.Context
import android.util.Log
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.WebExtension

object VegaGeckoRuntime {
  private const val TAG = "VegaGeckoRuntime"

  const val EXTENSION_ID = "gecko-bridge@vega.app"
  const val EXTENSION_URI = "resource://android/assets/gecko-bridge/"
  const val NATIVE_APP = "vega_bridge"

  @Volatile
  private var runtime: GeckoRuntime? = null

  @Volatile
  private var extension: WebExtension? = null

  @Volatile
  private var extensionInitInFlight = false

  private val extensionCallbacks = mutableListOf<(WebExtension?) -> Unit>()

  fun getOrCreate(context: Context): GeckoRuntime {
    val existing = runtime
    if (existing != null) {
      return existing
    }

    synchronized(this) {
      val doubleCheck = runtime
      if (doubleCheck != null) {
        return doubleCheck
      }

      val created = GeckoRuntime.create(context.applicationContext)
      runtime = created
      return created
    }
  }

  fun ensureBuiltInExtension(
    context: Context,
    callback: (WebExtension?) -> Unit,
  ) {
    val cachedExtension = extension
    if (cachedExtension != null) {
      callback(cachedExtension)
      return
    }

    val runtimeInstance = getOrCreate(context.applicationContext)

    synchronized(this) {
      val ready = extension
      if (ready != null) {
        callback(ready)
        return
      }

      extensionCallbacks.add(callback)
      if (extensionInitInFlight) {
        return
      }
      extensionInitInFlight = true
    }

    try {
      runtimeInstance.webExtensionController
        .ensureBuiltIn(EXTENSION_URI, EXTENSION_ID)
        .accept(
          { installed ->
            val callbacksToRun = synchronized(this) {
              extension = installed
              extensionInitInFlight = false
              val callbacks = extensionCallbacks.toList()
              extensionCallbacks.clear()
              callbacks
            }
            callbacksToRun.forEach { it(installed) }
          },
          { error ->
            Log.e(TAG, "Unable to initialize built-in Gecko extension", error)
            val callbacksToRun = synchronized(this) {
              extensionInitInFlight = false
              val callbacks = extensionCallbacks.toList()
              extensionCallbacks.clear()
              callbacks
            }
            callbacksToRun.forEach { it(null) }
          },
        )
    } catch (error: Throwable) {
      Log.e(TAG, "Unexpected Gecko extension initialization failure", error)
      val callbacksToRun = synchronized(this) {
        extensionInitInFlight = false
        val callbacks = extensionCallbacks.toList()
        extensionCallbacks.clear()
        callbacks
      }
      callbacksToRun.forEach { it(null) }
    }
  }
}
