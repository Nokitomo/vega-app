# Configurazione

## Expo
File: app.config.js
- newArchEnabled: false (disabilitato per stabilita).
- android.package: com.vega
- plugins: custom Android (android-native-config, with-android-notification-icons, with-android-release-gradle, with-android-signing, with-android-okhttp), react-native-video, react-native-edge-to-edge, react-native-bootsplash, expo-build-properties, expo-dev-client.
- firebase: @react-native-firebase/app e crashlytics sono opzionali. In Gradle i plugin Firebase sono commentati per default; per abilitarli serve decommentare i classpath in `android/build.gradle`, gli apply plugin in `android/app/build.gradle` e aggiungere i file `google-services.json`/`GoogleService-Info.plist`.
- android: minSdkVersion 24, edgeToEdgeEnabled true, supportsPictureInPicture true, launchMode singleTask, queries per http/https/vlc.

## Cast (Android)
### Cast nativo Google Cast (default)
- Dipendenza: `react-native-google-cast`.
- Inizializzazione Android:
  - `AndroidManifest.xml`: metadata cast options provider + receiver app id.
  - `MainActivity.kt`: `RNGCCastContext.getSharedInstance(this)` in `onCreate`.
- Receiver App ID configurato via placeholder Gradle:
  - variabile ambiente build: `VEGA_CAST_RECEIVER_APP_ID`
  - fallback: `CC1AD845`
- In `app.config.js` sono esposti anche:
  - `extra.castReceiverAppId`
  - `extra.castReceiverWebUrl`

### Cast Web Video Caster (fallback/alternativa)
- Android: integrazione via `Intent ACTION_VIEW` con package `com.instantbits.cast.webvideo`.
- iOS: integrazione via URL scheme `wvc-x-callback://open?...`.
- Supporta passaggio URL stream, headers HTTP e sottotitoli (quando disponibili).
- Se WVC non e installata, l'app tenta apertura store (market/play store URL).

### Scelta provider cast
- Impostazione utente: `Preferences -> Player -> Cast Provider`.
- Valori supportati:
  - `native` (default)
  - `wvc`

## Signing release
- La build release usa `signingConfigs.release`. Le credenziali (keystore path/password/alias) devono essere presenti nelle variabili d'ambiente o in `gradle.properties`.

## Metro
File: metro.config.js
- usa expo/metro-config
- integra NativeWind via withNativeWind con input `src/global.css`.

## Babel
File: babel.config.js
- plugin nativewind/babel
- react-native-reanimated/plugin

## Tailwind / NativeWind
- tailwind.config.js: content su src/**
- nativewind: plugin babel
- patch-package: patches/@dr.pogodin+react-native-fs+2.34.0.patch

## Typescript
- tsconfig.json definisce target e path.

## Localizzazione (i18n)
- Configurazione in `src/i18n/index.ts` con i18next + react-i18next.
- Lingue supportate: en, it. Risorse in `src/i18n/en.json` e `src/i18n/it.json`.
