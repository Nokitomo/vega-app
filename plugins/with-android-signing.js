const fs = require('fs');
const path = require('path');
const {withDangerousMod} = require('@expo/config-plugins');

/**
 * Adds release signing configuration after prebuild.
 * Priority: android/signing.local.properties, then env vars fallback.
 */
module.exports = function withAndroidSigning(config) {
  return withDangerousMod(config, [
    'android',
    async cfg => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appDir = path.join(projectRoot, 'android', 'app');
      const buildGradle = path.join(appDir, 'build.gradle');
      const signingGradle = path.join(appDir, 'with-signing.gradle');

      // Create signing gradle that extends signingConfigs during android block.
      const signingContent = `// Auto-applied by with-android-signing config plugin
import java.util.Properties

def signingProps = new Properties()
def signingPropsFile = new File(rootProject.projectDir, 'signing.local.properties')

if (signingPropsFile.exists()) {
    signingPropsFile.withInputStream { signingProps.load(it) }
    println "Loaded signing properties from \${signingPropsFile.absolutePath}"
}

def fileStoreFile = signingProps.getProperty('storeFile')
def fileStorePassword = signingProps.getProperty('storePassword')
def fileKeyAlias = signingProps.getProperty('keyAlias')
def fileKeyPassword = signingProps.getProperty('keyPassword')
def useReleaseSigningForDebug = signingProps
    .getProperty('useReleaseSigningForDebug', 'true')
    .toBoolean()
project.ext.set('useReleaseSigningForDebugLocal', useReleaseSigningForDebug)

def envStoreFile = System.getenv('MYAPP_UPLOAD_STORE_FILE')
def envStorePassword = System.getenv('MYAPP_UPLOAD_STORE_PASSWORD')
def envKeyAlias = System.getenv('MYAPP_UPLOAD_KEY_ALIAS')
def envKeyPassword = System.getenv('MYAPP_UPLOAD_KEY_PASSWORD')

def storeFileValue = fileStoreFile ?: envStoreFile
def storePasswordValue = fileStorePassword ?: envStorePassword
def keyAliasValue = fileKeyAlias ?: envKeyAlias
def keyPasswordValue = fileKeyPassword ?: envKeyPassword

android {
    signingConfigs {
        release {
            if (storeFileValue && storePasswordValue && keyAliasValue && keyPasswordValue) {
                def keystoreFile = file(storeFileValue)
                if (keystoreFile.exists()) {
                    storeFile keystoreFile
                    storePassword storePasswordValue
                    keyAlias keyAliasValue
                    keyPassword keyPasswordValue
                    println "Release signing config configured successfully"
                } else {
                    println "Configured keystore file not found: \${storeFileValue}"
                }
            } else {
                println "Missing release signing credentials (file/env)."
            }
        }
    }
}

// Force release signing and optionally reuse it for debug in local builds.
afterEvaluate {
    def releaseSigningConfig = android.signingConfigs.release
    if (releaseSigningConfig.storeFile && releaseSigningConfig.storeFile.exists()) {
        android.buildTypes.release.signingConfig = releaseSigningConfig
        println "Applied release signing config: \${releaseSigningConfig.storeFile.absolutePath}"
    } else {
        println 'Release signing config not applied. Debug keystore will be used.'
    }
}
`;
      fs.writeFileSync(signingGradle, signingContent, 'utf8');

      // Idempotently add apply from with-signing.gradle
      let gradleText = fs.readFileSync(buildGradle, 'utf8');
      if (!gradleText.includes("apply from: 'with-signing.gradle'")) {
        // Find the last apply from line and add our line after it
        const applyFromLines = gradleText.match(/apply from: '[^']+'/g);
        if (applyFromLines && applyFromLines.length > 0) {
          const lastApplyFrom = applyFromLines[applyFromLines.length - 1];
          gradleText = gradleText.replace(
            lastApplyFrom,
            `${lastApplyFrom}\napply from: 'with-signing.gradle'`,
          );
        } else {
          // If no apply from lines found, add after React plugin
        gradleText = gradleText.replace(
          /apply plugin: "com\.facebook\.react"/,
          'apply plugin: "com.facebook.react"\\napply from: \'with-signing.gradle\'',
        );
        }
        fs.writeFileSync(buildGradle, gradleText, 'utf8');
      }

      // Fix release buildType to use signingConfigs.release instead of debug
      gradleText = fs.readFileSync(buildGradle, 'utf8');
      gradleText = gradleText.replace(
        /release\s*\{[^}]*signingConfig\s+signingConfigs\.debug/,
        match =>
          match.replace('signingConfigs.debug', 'signingConfigs.release'),
      );
      fs.writeFileSync(buildGradle, gradleText, 'utf8');

      return cfg;
    },
  ]);
};
