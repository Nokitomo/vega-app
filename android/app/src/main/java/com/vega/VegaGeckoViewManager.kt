package com.vega

import android.content.Intent
import android.net.Uri
import android.util.Log
import com.facebook.react.bridge.Arguments
import com.facebook.react.bridge.ReactContext
import com.facebook.react.common.MapBuilder
import com.facebook.react.uimanager.SimpleViewManager
import com.facebook.react.uimanager.ThemedReactContext
import com.facebook.react.uimanager.annotations.ReactProp
import com.facebook.react.uimanager.events.RCTEventEmitter
import org.json.JSONObject
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoSession
import org.mozilla.geckoview.GeckoSessionSettings
import org.mozilla.geckoview.GeckoView
import org.mozilla.geckoview.WebExtension
import org.mozilla.geckoview.WebRequestError
import java.util.Collections
import java.util.WeakHashMap

class VegaGeckoViewManager : SimpleViewManager<GeckoView>() {
  companion object {
    private const val TAG = "VegaGeckoViewManager"
    const val REACT_CLASS = "VegaGeckoView"

    private const val EVENT_LOADING_START = "onLoadingStart"
    private const val EVENT_LOADING_FINISH = "onLoadingFinish"
    private const val EVENT_LOADING_ERROR = "onLoadingError"
    private const val EVENT_EXTERNAL_OPEN = "onExternalOpen"
    private const val EVENT_BRIDGE_MESSAGE = "onBridgeMessage"
    private const val EVENT_FULLSCREEN_CHANGE = "onFullScreenChange"
  }

  private data class SessionHolder(
    val reactContext: ThemedReactContext,
    val view: GeckoView,
    val session: GeckoSession,
    var currentUrl: String? = null,
  )

  private val holders =
    Collections.synchronizedMap(WeakHashMap<GeckoView, SessionHolder>())

  override fun getName(): String = REACT_CLASS

  override fun getExportedCustomDirectEventTypeConstants(): MutableMap<String, Any> =
    MapBuilder.builder<String, Any>()
      .put(
        EVENT_LOADING_START,
        MapBuilder.of("registrationName", EVENT_LOADING_START),
      )
      .put(
        EVENT_LOADING_FINISH,
        MapBuilder.of("registrationName", EVENT_LOADING_FINISH),
      )
      .put(
        EVENT_LOADING_ERROR,
        MapBuilder.of("registrationName", EVENT_LOADING_ERROR),
      )
      .put(
        EVENT_EXTERNAL_OPEN,
        MapBuilder.of("registrationName", EVENT_EXTERNAL_OPEN),
      )
      .put(
        EVENT_BRIDGE_MESSAGE,
        MapBuilder.of("registrationName", EVENT_BRIDGE_MESSAGE),
      )
      .put(
        EVENT_FULLSCREEN_CHANGE,
        MapBuilder.of("registrationName", EVENT_FULLSCREEN_CHANGE),
      )
      .build()
      .toMutableMap()

  override fun createViewInstance(reactContext: ThemedReactContext): GeckoView {
    val geckoView = GeckoView(reactContext)

    try {
      val settings = GeckoSessionSettings.Builder()
        .allowJavascript(true)
        .build()
      val session = GeckoSession(settings)

      val holder = SessionHolder(
        reactContext = reactContext,
        view = geckoView,
        session = session,
      )

      configureSessionDelegates(holder)

      val runtime = VegaGeckoRuntime.getOrCreate(reactContext)
      session.open(runtime)
      geckoView.setSession(session)
      holders[geckoView] = holder

      VegaGeckoRuntime.ensureBuiltInExtension(reactContext) { extension ->
        if (extension == null) {
          Log.e(TAG, "Built-in Gecko extension is unavailable, continuing without bridge")
          return@ensureBuiltInExtension
        }

        attachExtensionDelegate(holder, extension)
      }
    } catch (error: Throwable) {
      Log.e(TAG, "Unable to initialize GeckoView", error)
      geckoView.post {
        emitEvent(
          geckoView,
          EVENT_LOADING_ERROR,
          mapOf(
            "message" to (error.message ?: "GeckoView initialization failed"),
            "fatal" to true,
          ),
        )
      }
    }

    return geckoView
  }

  @ReactProp(name = "url")
  fun setUrl(view: GeckoView, url: String?) {
    val holder = holders[view] ?: return
    if (url.isNullOrBlank()) {
      return
    }

    if (holder.currentUrl == url) {
      return
    }

    holder.currentUrl = url
    try {
      holder.session.loadUri(url)
    } catch (error: Throwable) {
      Log.e(TAG, "Unable to load URI in GeckoView: $url", error)
      emitEvent(
        view,
        EVENT_LOADING_ERROR,
        mapOf(
          "uri" to url,
          "message" to (error.message ?: "Unable to load URI"),
          "fatal" to false,
        ),
      )
    }
  }

  @ReactProp(name = "javaScriptEnabled", defaultBoolean = true)
  fun setJavaScriptEnabled(view: GeckoView, enabled: Boolean) {
    val holder = holders[view] ?: return
    try {
      holder.session.settings.setAllowJavascript(enabled)
    } catch (error: Throwable) {
      Log.e(TAG, "Unable to change javascript setting", error)
      emitEvent(
        view,
        EVENT_LOADING_ERROR,
        mapOf(
          "message" to (error.message ?: "Unable to update javascript policy"),
          "fatal" to false,
        ),
      )
    }
  }

  override fun onDropViewInstance(view: GeckoView) {
    val holder = holders.remove(view)
    if (holder != null) {
      try {
        holder.session.setNavigationDelegate(null)
        holder.session.setProgressDelegate(null)
        holder.session.setContentDelegate(null)
      } catch (_: Throwable) {
      }

      try {
        view.releaseSession()
      } catch (_: Throwable) {
      }

      try {
        holder.session.close()
      } catch (_: Throwable) {
      }
    }

    super.onDropViewInstance(view)
  }

  private fun configureSessionDelegates(holder: SessionHolder) {
    holder.session.setContentDelegate(object : GeckoSession.ContentDelegate {
      override fun onFullScreen(
        session: GeckoSession,
        fullScreen: Boolean,
      ) {
        emitEvent(
          holder.view,
          EVENT_FULLSCREEN_CHANGE,
          mapOf("fullScreen" to fullScreen),
        )
      }
    })

    holder.session.setNavigationDelegate(object : GeckoSession.NavigationDelegate {
      override fun onLoadRequest(
        session: GeckoSession,
        request: GeckoSession.NavigationDelegate.LoadRequest,
      ): GeckoResult<AllowOrDeny>? {
        val uri = request.uri
        val isNewWindow =
          request.target == GeckoSession.NavigationDelegate.TARGET_WINDOW_NEW

        if (isNewWindow) {
          openExternally(holder, uri, "new_window")
          return GeckoResult.deny()
        }

        if (shouldOpenExternally(uri)) {
          openExternally(holder, uri, "external_scheme")
          return GeckoResult.deny()
        }

        return null
      }

      override fun onNewSession(
        session: GeckoSession,
        uri: String,
      ): GeckoResult<GeckoSession>? {
        openExternally(holder, uri, "on_new_session")
        return null
      }

      override fun onLoadError(
        session: GeckoSession,
        uri: String?,
        error: WebRequestError,
      ): GeckoResult<String>? {
        emitEvent(
          holder.view,
          EVENT_LOADING_ERROR,
          mapOf(
            "uri" to uri,
            "code" to error.code,
            "category" to error.category,
            "fatal" to false,
          ),
        )
        return null
      }
    })

    holder.session.setProgressDelegate(object : GeckoSession.ProgressDelegate {
      override fun onPageStart(
        session: GeckoSession,
        url: String,
      ) {
        emitEvent(
          holder.view,
          EVENT_LOADING_START,
          mapOf("uri" to url),
        )
      }

      override fun onPageStop(
        session: GeckoSession,
        success: Boolean,
      ) {
        emitEvent(
          holder.view,
          EVENT_LOADING_FINISH,
          mapOf("success" to success),
        )
      }
    })
  }

  private fun attachExtensionDelegate(
    holder: SessionHolder,
    extension: WebExtension,
  ) {
    try {
      val delegate = object : WebExtension.MessageDelegate {
        override fun onMessage(
          nativeApp: String,
          message: Any,
          sender: WebExtension.MessageSender,
        ): GeckoResult<Any> {
          emitEvent(
            holder.view,
            EVENT_BRIDGE_MESSAGE,
            mapOf(
              "nativeApp" to nativeApp,
              "message" to stringifyBridgePayload(message),
            ),
          )
          return GeckoResult.fromValue(message)
        }

        override fun onConnect(port: WebExtension.Port) {
          port.setDelegate(object : WebExtension.PortDelegate {
            override fun onPortMessage(message: Any, port: WebExtension.Port) {
              emitEvent(
                holder.view,
                EVENT_BRIDGE_MESSAGE,
                mapOf(
                  "nativeApp" to VegaGeckoRuntime.NATIVE_APP,
                  "port" to port.name,
                  "message" to stringifyBridgePayload(message),
                ),
              )
            }
          })
        }
      }

      holder.session.webExtensionController.setMessageDelegate(
        extension,
        delegate,
        VegaGeckoRuntime.NATIVE_APP,
      )
    } catch (error: Throwable) {
      Log.e(TAG, "Unable to attach extension message delegate", error)
      emitEvent(
        holder.view,
        EVENT_LOADING_ERROR,
        mapOf(
          "message" to (error.message ?: "Extension delegate setup failed"),
          "fatal" to false,
        ),
      )
    }
  }

  private fun shouldOpenExternally(uri: String?): Boolean {
    if (uri.isNullOrBlank()) {
      return false
    }

    val parsed = Uri.parse(uri)
    val scheme = parsed.scheme?.lowercase() ?: return false
    return scheme != "http" &&
      scheme != "https" &&
      scheme != "about" &&
      scheme != "data" &&
      scheme != "blob"
  }

  private fun openExternally(
    holder: SessionHolder,
    uri: String?,
    source: String,
  ) {
    if (uri.isNullOrBlank()) {
      return
    }

    try {
      val intent = Intent(Intent.ACTION_VIEW, Uri.parse(uri)).apply {
        addCategory(Intent.CATEGORY_BROWSABLE)
        addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      }

      holder.reactContext.startActivity(intent)
      emitEvent(
        holder.view,
        EVENT_EXTERNAL_OPEN,
        mapOf(
          "uri" to uri,
          "source" to source,
        ),
      )
    } catch (error: Throwable) {
      Log.e(TAG, "Unable to open URL externally: $uri", error)
      emitEvent(
        holder.view,
        EVENT_LOADING_ERROR,
        mapOf(
          "uri" to uri,
          "message" to (error.message ?: "Unable to open external URL"),
          "fatal" to false,
        ),
      )
    }
  }

  private fun stringifyBridgePayload(message: Any?): String {
    return when (message) {
      null -> "null"
      is JSONObject -> message.toString()
      else -> message.toString()
    }
  }

  private fun emitEvent(
    view: GeckoView,
    eventName: String,
    payload: Map<String, Any?>,
  ) {
    val reactContext = view.context as? ReactContext ?: return
    if (!reactContext.hasActiveReactInstance()) {
      return
    }

    val eventPayload = Arguments.createMap()
    payload.forEach { (key, value) ->
      when (value) {
        null -> eventPayload.putNull(key)
        is Boolean -> eventPayload.putBoolean(key, value)
        is Int -> eventPayload.putInt(key, value)
        is Double -> eventPayload.putDouble(key, value)
        is Float -> eventPayload.putDouble(key, value.toDouble())
        is String -> eventPayload.putString(key, value)
        else -> eventPayload.putString(key, value.toString())
      }
    }

    reactContext
      .getJSModule(RCTEventEmitter::class.java)
      .receiveEvent(view.id, eventName, eventPayload)
  }
}
