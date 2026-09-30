package com.vega

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors

class VegaWarpModule(
  private val reactContext: ReactApplicationContext,
) : ReactContextBaseJavaModule(reactContext) {
  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "VegaWarp"

  @ReactMethod
  fun getStatus(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(statusMap(VegaWarpController.getStatus(reactContext)))
      } catch (error: Throwable) {
        promise.reject("WARP_STATUS_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun start(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(statusMap(VegaWarpController.start(reactContext)))
      } catch (error: Throwable) {
        promise.reject("WARP_START_FAILED", error.message, error)
      }
    }
  }

  @ReactMethod
  fun stop(promise: Promise) {
    executor.execute {
      try {
        promise.resolve(statusMap(VegaWarpController.stop(reactContext)))
      } catch (error: Throwable) {
        promise.reject("WARP_STOP_FAILED", error.message, error)
      }
    }
  }

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }

  private fun statusMap(status: VegaWarpStatus) = Arguments.createMap().apply {
    putBoolean("supported", status.supported)
    putString("state", status.state)
    putBoolean("running", status.running)
    putBoolean("registered", status.registered)
    if (status.port == null) {
      putNull("port")
    } else {
      putInt("port", status.port)
    }
    putString("abi", status.abi)
  }
}
