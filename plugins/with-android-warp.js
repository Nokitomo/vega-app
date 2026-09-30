const fs = require('fs');
const path = require('path');
const {withDangerousMod, withGradleProperties} = require('@expo/config-plugins');

const APPLY_LINE = "apply from: 'with-android-warp.gradle'";
const DO_NOT_STRIP_KEY = 'android.packagingOptions.doNotStrip';
const LEGACY_PACKAGING_KEY = 'expo.useLegacyPackaging';

module.exports = function withAndroidWarp(config) {
  config = withGradleProperties(config, cfg => {
    const properties = cfg.modResults;
    const legacyPackaging = properties.find(
      item => item.key === LEGACY_PACKAGING_KEY,
    );
    if (legacyPackaging) {
      legacyPackaging.value = 'true';
    } else {
      properties.push({
        type: 'property',
        key: LEGACY_PACKAGING_KEY,
        value: 'true',
      });
    }

    const existing = properties.find(item => item.key === DO_NOT_STRIP_KEY);
    if (existing) {
      const values = new Set(String(existing.value).split(',').filter(Boolean));
      values.add('**/libusque.so');
      existing.value = [...values].join(',');
    } else {
      properties.push({
        type: 'property',
        key: DO_NOT_STRIP_KEY,
        value: '**/libusque.so',
      });
    }
    return cfg;
  });

  return withDangerousMod(config, [
    'android',
    async cfg => {
      const projectRoot = cfg.modRequest.projectRoot;
      const appDir = path.join(projectRoot, 'android', 'app');
      const buildGradle = path.join(appDir, 'build.gradle');
      const warpGradle = path.join(appDir, 'with-android-warp.gradle');

      fs.writeFileSync(
        warpGradle,
        '// Auto-applied by with-android-warp config plugin\nandroid {\n    sourceSets {\n        main {\n            jniLibs.srcDirs += [\'../../native-src/android/jniLibs\']\n        }\n    }\n}\n',
        'utf8',
      );

      let gradleText = fs.readFileSync(buildGradle, 'utf8');
      if (!gradleText.includes(APPLY_LINE)) {
        const anchor = "apply from: 'with-okhttp.gradle'";
        gradleText = gradleText.includes(anchor)
          ? gradleText.replace(anchor, `${anchor}\n${APPLY_LINE}`)
          : `${APPLY_LINE}\n${gradleText}`;
        fs.writeFileSync(buildGradle, gradleText, 'utf8');
      }

      return cfg;
    },
  ]);
};
