package com.vega

import android.content.Context
import android.util.Log
import org.mozilla.geckoview.AllowOrDeny
import org.mozilla.geckoview.GeckoResult
import org.mozilla.geckoview.GeckoRuntime
import org.mozilla.geckoview.WebExtension
import org.mozilla.geckoview.WebExtensionController

object VegaGeckoRuntime {
  private const val TAG = "VegaGeckoRuntime"

  const val EXTENSION_ID = "gecko-bridge@vega.app"
  const val EXTENSION_URI = "resource://android/assets/gecko-bridge/"
  const val NATIVE_APP = "vega_bridge"

  const val ADGUARD_EXTENSION_ID = "adguardadblocker@adguard.com"
  private const val ADGUARD_EXTENSION_URI =
    "https://addons.mozilla.org/firefox/downloads/latest/adguard-adblocker/latest.xpi"

  @Volatile
  private var runtime: GeckoRuntime? = null

  @Volatile
  private var extension: WebExtension? = null

  @Volatile
  private var extensionInitInFlight = false

  @Volatile
  private var adGuardInitInFlight = false

  @Volatile
  private var adGuardDisableInFlight = false

  @Volatile
  private var adGuardInstalled = false

  @Volatile
  private var adGuardWanted = true

  @Volatile
  private var adGuardLastError: String? = null

  private val extensionCallbacks = mutableListOf<(WebExtension?) -> Unit>()
  private val adGuardCallbacks = mutableListOf<(Boolean, String?) -> Unit>()
  private val adGuardDisableCallbacks = mutableListOf<(Boolean, String?) -> Unit>()

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
      configurePromptDelegate(created)
      runtime = created
      return created
    }
  }

  fun setAdGuardWanted(enabled: Boolean) {
    Log.d(TAG, "setAdGuardWanted enabled=$enabled")
    synchronized(this) {
      adGuardWanted = enabled
      if (enabled) {
        adGuardLastError = null
      }
    }
  }

  fun isAdGuardInstalled(): Boolean = adGuardInstalled

  fun isAdGuardInstalling(): Boolean = adGuardInitInFlight

  fun getAdGuardLastError(): String? = adGuardLastError

  fun ensureAdGuardExtension(
    context: Context,
    callback: (Boolean, String?) -> Unit,
  ) {
    Log.d(
      TAG,
      "ensureAdGuardExtension start wanted=$adGuardWanted installed=$adGuardInstalled inFlight=$adGuardInitInFlight",
    )
    if (!adGuardWanted) {
      Log.d(TAG, "ensureAdGuardExtension skipped because wanted=false")
      callback(false, "disabled")
      return
    }

    if (adGuardInstalled) {
      Log.d(TAG, "ensureAdGuardExtension already installed")
      callback(true, null)
      return
    }

    val runtimeInstance = getOrCreate(context.applicationContext)
    val controller = runtimeInstance.webExtensionController

    synchronized(this) {
      if (!adGuardWanted) {
        Log.d(TAG, "ensureAdGuardExtension aborted in lock because wanted=false")
        callback(false, "disabled")
        return
      }

      if (adGuardInstalled) {
        Log.d(TAG, "ensureAdGuardExtension aborted in lock because already installed")
        callback(true, null)
        return
      }

      adGuardCallbacks.add(callback)
      if (adGuardInitInFlight) {
        Log.d(TAG, "ensureAdGuardExtension joined existing in-flight install")
        return
      }
      adGuardInitInFlight = true
    }

    try {
      controller
        .list()
        .accept(
          { installedExtensions ->
            if (!adGuardWanted) {
              completeAdGuardInit(false, "disabled")
              return@accept
            }

            val existing =
              installedExtensions?.firstOrNull { extension -> extension.id == ADGUARD_EXTENSION_ID }
            if (existing != null) {
              Log.d(TAG, "ensureAdGuardExtension found existing extension in list")
              completeAdGuardInit(true, null)
              return@accept
            }

            Log.d(TAG, "ensureAdGuardExtension installing from uri")
            installAdGuard(controller)
          },
          { error ->
            completeAdGuardInit(false, formatError("Unable to list Gecko extensions", error))
          },
        )
    } catch (error: Throwable) {
      completeAdGuardInit(false, formatError("Unexpected AdGuard initialization failure", error))
    }
  }

  fun disableAdGuardExtension(
    context: Context,
    callback: (Boolean, String?) -> Unit,
  ) {
    Log.d(
      TAG,
      "disableAdGuardExtension start installed=$adGuardInstalled inFlight=$adGuardDisableInFlight",
    )
    setAdGuardWanted(false)

    val runtimeInstance = getOrCreate(context.applicationContext)
    val controller = runtimeInstance.webExtensionController

    synchronized(this) {
      adGuardDisableCallbacks.add(callback)
      if (adGuardDisableInFlight) {
        Log.d(TAG, "disableAdGuardExtension joined existing in-flight uninstall")
        return
      }
      adGuardDisableInFlight = true
    }

    try {
      controller
        .list()
        .accept(
          { installedExtensions ->
            val target =
              installedExtensions?.firstOrNull { extension -> extension.id == ADGUARD_EXTENSION_ID }

            if (target == null) {
              Log.d(TAG, "disableAdGuardExtension no installed AdGuard found")
              completeAdGuardDisable(true, null)
              return@accept
            }

            Log.d(TAG, "disableAdGuardExtension uninstalling ${target.id}")
            uninstallExtension(controller, target) { success, error ->
              completeAdGuardDisable(success, error)
            }
          },
          { error ->
            completeAdGuardDisable(false, formatError("Unable to list Gecko extensions", error))
          },
        )
    } catch (error: Throwable) {
      completeAdGuardDisable(false, formatError("Unexpected AdGuard disable failure", error))
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

  private fun installAdGuard(controller: WebExtensionController) {
    Log.d(TAG, "installAdGuard request uri=$ADGUARD_EXTENSION_URI")
    try {
      controller
        .install(ADGUARD_EXTENSION_URI)
        .accept(
          { installed ->
            val installedId = installed?.id
            Log.d(TAG, "installAdGuard success installedId=$installedId")
            if (installedId != ADGUARD_EXTENSION_ID) {
              completeAdGuardInit(
                false,
                "Installed extension id mismatch while initializing AdGuard: $installedId",
              )
              return@accept
            }

            if (!adGuardWanted) {
              uninstallExtension(controller, installed) { _, _ ->
                completeAdGuardInit(false, "disabled")
              }
              return@accept
            }

            completeAdGuardInit(true, null)
          },
          { error ->
            Log.e(TAG, "installAdGuard failed", error)
            completeAdGuardInit(false, formatError("Unable to install AdGuard WebExtension", error))
          },
        )
    } catch (error: Throwable) {
      completeAdGuardInit(false, formatError("Unexpected AdGuard installation failure", error))
    }
  }

  private fun uninstallExtension(
    controller: WebExtensionController,
    extension: WebExtension?,
    callback: (Boolean, String?) -> Unit,
  ) {
    if (extension == null) {
      callback(false, "Missing extension instance")
      return
    }

    try {
      Log.d(TAG, "uninstallExtension request id=${extension.id}")
      controller
        .uninstall(extension)
        .accept(
          {
            Log.d(TAG, "uninstallExtension success id=${extension.id}")
            callback(true, null)
          },
          { error ->
            Log.e(TAG, "uninstallExtension failed id=${extension.id}", error)
            callback(false, formatError("Unable to uninstall AdGuard WebExtension", error))
          },
        )
    } catch (error: Throwable) {
      callback(false, formatError("Unexpected AdGuard uninstall failure", error))
    }
  }

  private fun completeAdGuardInit(success: Boolean, error: String?) {
    Log.d(TAG, "completeAdGuardInit success=$success error=$error")
    val callbacks = synchronized(this) {
      adGuardInitInFlight = false
      if (success) {
        adGuardInstalled = true
        adGuardLastError = null
      } else {
        adGuardInstalled = false
        adGuardLastError = if (error == "disabled") null else error
      }

      val pending = adGuardCallbacks.toList()
      adGuardCallbacks.clear()
      pending
    }

    callbacks.forEach { callback ->
      callback(success, error)
    }
  }

  private fun completeAdGuardDisable(success: Boolean, error: String?) {
    Log.d(TAG, "completeAdGuardDisable success=$success error=$error")
    val callbacks = synchronized(this) {
      adGuardDisableInFlight = false
      if (success) {
        adGuardInstalled = false
        adGuardLastError = null
      } else {
        adGuardLastError = error
      }

      val pending = adGuardDisableCallbacks.toList()
      adGuardDisableCallbacks.clear()
      pending
    }

    callbacks.forEach { callback ->
      callback(success, error)
    }
  }

  private fun formatError(prefix: String, error: Throwable?): String {
    val message = error?.message ?: "unknown"
    Log.e(TAG, "$prefix: $message", error)
    return "$prefix: $message"
  }

  private fun configurePromptDelegate(runtimeInstance: GeckoRuntime) {
    val controller = runtimeInstance.webExtensionController

    controller.setPromptDelegate(object : WebExtensionController.PromptDelegate {
      override fun onInstallPromptRequest(
        extension: WebExtension,
        permissions: Array<String>,
        origins: Array<String>,
        dataCollectionPermissions: Array<String>,
      ) = GeckoResult.fromValue(
        WebExtension.PermissionPromptResponse(
          extension.id == ADGUARD_EXTENSION_ID,
          false,
          false,
        ),
      )

      override fun onUpdatePrompt(
        extension: WebExtension,
        newPermissions: Array<String>,
        newOrigins: Array<String>,
        newDataCollectionPermissions: Array<String>,
      ) = GeckoResult.fromValue(
        if (extension.id == ADGUARD_EXTENSION_ID) {
          AllowOrDeny.ALLOW
        } else {
          AllowOrDeny.DENY
        },
      )

      override fun onOptionalPrompt(
        extension: WebExtension,
        permissions: Array<String>,
        origins: Array<String>,
        dataCollectionPermissions: Array<String>,
      ) = GeckoResult.fromValue(
        if (extension.id == ADGUARD_EXTENSION_ID) {
          AllowOrDeny.ALLOW
        } else {
          AllowOrDeny.DENY
        },
      )
    })
  }
}
