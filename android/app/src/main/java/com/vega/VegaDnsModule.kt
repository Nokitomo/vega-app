package com.vega

import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import java.util.concurrent.Executors

class VegaDnsModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val TEST_HOSTNAME = "example.com"
  }

  private val executor = Executors.newSingleThreadExecutor()

  override fun getName(): String = "VegaDns"

  @ReactMethod
  fun getState(promise: Promise) {
    val result = Arguments.createMap().apply {
      putString("selectedProviderId", VegaDnsController.getSelectedProviderId())
      putArray(
        "providers",
        Arguments.createArray().apply {
          VegaDnsController.providers.forEach { provider ->
            pushMap(Arguments.createMap().apply {
              putString("id", provider.id)
              putString("name", provider.name)
              putBoolean("encrypted", provider.url != null)
            })
          }
        },
      )
    }
    promise.resolve(result)
  }

  @ReactMethod
  fun setSelectedProvider(providerId: String, promise: Promise) {
    try {
      VegaDnsController.setSelectedProvider(providerId)
      promise.resolve(providerId)
    } catch (error: IllegalArgumentException) {
      promise.reject("DNS_PROVIDER_INVALID", error.message, error)
    } catch (error: Throwable) {
      promise.reject("DNS_PROVIDER_UPDATE_FAILED", error.message, error)
    }
  }

  @ReactMethod
  fun testSelectedProvider(promise: Promise) {
    executor.execute {
      val startedAt = System.nanoTime()
      try {
        val addresses = VegaDnsController.lookup(TEST_HOSTNAME)
        val elapsedMs = (System.nanoTime() - startedAt) / 1_000_000
        val result = Arguments.createMap().apply {
          putString("providerId", VegaDnsController.getSelectedProviderId())
          putDouble("elapsedMs", elapsedMs.toDouble())
          putArray(
            "addresses",
            Arguments.createArray().apply {
              addresses.forEach { address -> pushString(address.hostAddress) }
            },
          )
        }
        promise.resolve(result)
      } catch (error: Throwable) {
        promise.reject("DNS_TEST_FAILED", error.message, error)
      }
    }
  }

  override fun invalidate() {
    executor.shutdownNow()
    super.invalidate()
  }
}
