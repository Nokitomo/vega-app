package com.vega

import android.os.Build
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule

class DeviceAbiModule(reactContext: ReactApplicationContext) :
    ReactContextBaseJavaModule(reactContext) {

  override fun getName(): String = "DeviceAbi"

  override fun getConstants(): MutableMap<String, Any> {
    val supportedAbis = Build.SUPPORTED_ABIS?.toList() ?: emptyList()
    return mutableMapOf("supportedAbis" to supportedAbis)
  }
}
