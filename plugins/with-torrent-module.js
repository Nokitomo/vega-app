const fs = require('fs');
const path = require('path');
const {
  withAppBuildGradle,
  withDangerousMod,
  withMainApplication,
} = require('expo/config-plugins');

const DEPENDENCIES = [
  "implementation 'org.nanohttpd:nanohttpd:2.3.1'",
  "implementation 'org.libtorrent4j:libtorrent4j:2.1.0-39'",
  "implementation 'org.libtorrent4j:libtorrent4j-android-arm64:2.1.0-39'",
  "implementation 'org.libtorrent4j:libtorrent4j-android-x86_64:2.1.0-39'",
];

module.exports = function withTorrentModule(config) {
  config = withDangerousMod(config, [
    'android',
    async cfg => {
      const root = cfg.modRequest.projectRoot;
      const packageName = cfg.android?.package || 'com.vega';
      const sourceDir = path.join(
        root,
        'native-src',
        'android',
        'com',
        'vega',
      );
      const targetDir = path.join(
        root,
        'android',
        'app',
        'src',
        'main',
        'java',
        ...packageName.split('.'),
      );
      fs.mkdirSync(targetDir, {recursive: true});
      for (const fileName of [
        'TorrentModule.kt',
        'TorrentPackage.kt',
        'TorrentStreamServer.kt',
      ]) {
        const sourcePath = path.join(sourceDir, fileName);
        if (!fs.existsSync(sourcePath)) {
          continue;
        }
        const contents = fs
          .readFileSync(sourcePath, 'utf8')
          .replace(/^package com\.vega$/m, `package ${packageName}`);
        fs.writeFileSync(path.join(targetDir, fileName), contents, 'utf8');
      }

      const proguardPath = path.join(
        root,
        'android',
        'app',
        'proguard-rules.pro',
      );
      if (fs.existsSync(proguardPath)) {
        const marker = '# libtorrent4j';
        const current = fs.readFileSync(proguardPath, 'utf8');
        if (!current.includes(marker)) {
          fs.appendFileSync(
            proguardPath,
            `\n${marker}\n-keep class org.libtorrent4j.** { *; }\n-keep interface org.libtorrent4j.** { *; }\n-keep enum org.libtorrent4j.** { *; }\n-keep class ${packageName}.Torrent** { *; }\n`,
          );
        }
      }
      return cfg;
    },
  ]);

  config = withMainApplication(config, cfg => {
    if (!cfg.modResults.contents.includes('add(TorrentPackage())')) {
      cfg.modResults.contents = cfg.modResults.contents.replace(
        /PackageList\(this\)\.packages\.apply \{\n/,
        match => `${match}              add(TorrentPackage())\n`,
      );
    }
    return cfg;
  });

  config = withAppBuildGradle(config, cfg => {
    for (const dependency of DEPENDENCIES) {
      if (!cfg.modResults.contents.includes(dependency)) {
        cfg.modResults.contents = cfg.modResults.contents.replace(
          /dependencies\s*\{/,
          match => `${match}\n    ${dependency}`,
        );
      }
    }
    return cfg;
  });

  return config;
};
