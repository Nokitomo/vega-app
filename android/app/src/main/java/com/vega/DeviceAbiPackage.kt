package com.vega

import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.uimanager.ViewManager

class DeviceAbiPackage : ReactPackage {
  @Deprecated("ReactPackage legacy API")
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> =
      listOf(DeviceAbiModule(reactContext))

  @Deprecated("ReactPackage legacy API")
  override fun createViewManagers(
      reactContext: ReactApplicationContext
  ): List<ViewManager<*, *>> = emptyList()
}
