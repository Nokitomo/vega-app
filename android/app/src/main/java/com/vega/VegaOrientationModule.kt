package com.vega

import android.content.pm.ActivityInfo
import android.util.Log
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod

class VegaOrientationModule(reactContext: ReactApplicationContext) :
  ReactContextBaseJavaModule(reactContext) {
  companion object {
    private const val TAG = "VegaOrientationModule"
  }

  override fun getName(): String = "VegaOrientation"

  @ReactMethod
  fun setUserOrientation() {
    val activity = reactApplicationContext.currentActivity
    if (activity == null) {
      Log.w(TAG, "setUserOrientation ignored because currentActivity is null")
      return
    }

    reactApplicationContext.runOnUiQueueThread {
      activity.requestedOrientation = ActivityInfo.SCREEN_ORIENTATION_USER
    }
  }
}
