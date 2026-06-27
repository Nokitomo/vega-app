const fs = require('fs');
const path = require('path');
const {withDangerousMod, withMainApplication} = require('@expo/config-plugins');

const SAF_COPY_MODULE_SOURCE = `package com.vega

import android.net.Uri
import com.facebook.react.ReactPackage
import com.facebook.react.bridge.NativeModule
import com.facebook.react.bridge.Promise
import com.facebook.react.bridge.ReactApplicationContext
import com.facebook.react.bridge.ReactContextBaseJavaModule
import com.facebook.react.bridge.ReactMethod
import com.facebook.react.uimanager.ViewManager
import java.io.File
import java.io.FileInputStream
import java.io.IOException

class SafCopyModule(private val reactContext: ReactApplicationContext) : ReactContextBaseJavaModule(reactContext) {
  override fun getName(): String = "SafCopyModule"

  @ReactMethod
  fun copyFileToUri(fromPath: String, toUriString: String, promise: Promise) {
    try {
      val sourceFile = resolveSourceFile(fromPath)
      if (!sourceFile.exists()) {
        throw IOException("Source file does not exist: $fromPath")
      }

      val targetUri = Uri.parse(toUriString)
      val outputStream = reactContext.contentResolver.openOutputStream(targetUri, "w")
        ?: throw IOException("Unable to open SAF output stream for $toUriString")

      FileInputStream(sourceFile).use { input ->
        outputStream.use { output ->
          val buffer = ByteArray(64 * 1024)
          var bytesRead = input.read(buffer)

          while (bytesRead != -1) {
            output.write(buffer, 0, bytesRead)
            bytesRead = input.read(buffer)
          }

          output.flush()
        }
      }

      promise.resolve(null)
    } catch (error: Exception) {
      promise.reject("SAF_COPY_FAILED", error.message, error)
    }
  }

  private fun resolveSourceFile(fromPath: String): File {
    return if (fromPath.startsWith("file://")) {
      val uri = Uri.parse(fromPath)
      val path = uri.path ?: throw IOException("Invalid file URI: $fromPath")
      File(path)
    } else {
      File(fromPath)
    }
  }
}

@Suppress("DEPRECATION", "OVERRIDE_DEPRECATION")
class SafCopyPackage : ReactPackage {
  override fun createNativeModules(reactContext: ReactApplicationContext): List<NativeModule> {
    return listOf(SafCopyModule(reactContext))
  }

  override fun createViewManagers(reactContext: ReactApplicationContext): List<ViewManager<*, *>> {
    return emptyList()
  }
}
`;

function withSafCopyModule(config) {
  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const projectRoot = cfg.modRequest.projectRoot;
      const packageName = cfg.android?.package || 'com.vega';
      const packagePath = packageName.replace(/\./g, '/');
      const targetFile = path.join(
        projectRoot,
        'android',
        'app',
        'src',
        'main',
        'java',
        packagePath,
        'SafCopyModule.kt',
      );

      fs.mkdirSync(path.dirname(targetFile), {recursive: true});
      fs.writeFileSync(targetFile, SAF_COPY_MODULE_SOURCE, 'utf8');

      return cfg;
    },
  ]);

  return withMainApplication(config, cfg => {
    const currentContents = cfg.modResults.contents;

    if (!currentContents.includes('add(SafCopyPackage())')) {
      cfg.modResults.contents = currentContents.replace(
        /PackageList\(this\)\.packages\.apply \{\n/,
        match => `${match}              add(SafCopyPackage())\n`,
      );
    }

    return cfg;
  });
}

module.exports = withSafCopyModule;
