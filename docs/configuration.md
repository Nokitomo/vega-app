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
  - `extra.castPairApiBaseUrl`

### Cast Web Video Caster (fallback/alternativa)
- Android: integrazione via `Intent ACTION_VIEW` con package `com.instantbits.cast.webvideo`.
- iOS: integrazione via URL scheme `wvc-x-callback://open?...`.
- Supporta passaggio URL stream, headers HTTP e sottotitoli (quando disponibili).
- Se WVC non e installata, l'app tenta apertura store (market/play store URL).

### Vega Cast (LAN/Web)
- Provider cast aggiuntivo che genera una sessione web per receiver browser TV/PC.
- Base URL receiver letto da:
  - `extra.castReceiverWebUrl` (in `app.config.js`)
  - variabile ambiente `EXPO_PUBLIC_CAST_RECEIVER_WEB_URL`
  - fallback: `https://nokitomo.github.io/vega-cast-receiver/`
- Base URL API pairing letto da:
  - `extra.castPairApiBaseUrl` (in `app.config.js`)
  - variabile ambiente `EXPO_PUBLIC_CAST_PAIR_API_BASE_URL`
- Con API pairing configurata, l'app crea un codice breve one-time (TTL) e il receiver recupera la sessione tramite Vercel Function.
- Con pairing API attivo, il receiver invia progress episodico/minutaggio agli endpoint progress (`/api/session/progress/*`) per sync lato app.
- In fallback (API non configurata/non raggiungibile), l'app usa il link sessione diretto in query.
- La sessione include stream URL, headers e sottotitoli; la queue non e limitata dalla lunghezza URL quando il pairing API e attivo.
- Per contenuti anime con `malId` disponibile, il receiver puo mostrare `Skip Intro` via AniSkip.
- Il receiver puo funzionare in modalita standalone (browser TV/PC) con telecomando (play/pause/seek/next/prev).
- Backend richiesto per pairing professionale: Vercel Function + KV (serverless, senza VPS h24).

### Scelta provider cast
- Impostazione utente: `Preferences -> Player -> Cast Provider`.
- Valori supportati:
  - `native` (default)
  - `vega`
  - `wvc`

## Signing release
- La build Android legge prima `android/signing.local.properties` e, solo come fallback, le variabili d'ambiente legacy (`MYAPP_UPLOAD_*`).
- Esempio pronto: `android/signing.local.properties.example`.
- Chiavi supportate nel file locale:
  - `storeFile` (path assoluto del keystore `.jks`)
  - `storePassword`
  - `keyAlias`
  - `keyPassword`
  - `useReleaseSigningForDebug` (`true`/`false`)
- Con `useReleaseSigningForDebug=true`, anche `debug` usa la stessa chiave della `release` nei build locali.

## GitHub Nightly (Android)
- Workflow: `.github/workflows/main.yml`
- Firma in CI:
  - decodifica il keystore dal secret base64 in `android/ci-release.jks`
  - genera `android/signing.local.properties` al volo
  - esegue `./gradlew :app:assembleRelease --no-daemon --max-workers=2 -x lintVitalRelease`
  - usa `GRADLE_OPTS` con heap/metaspace aumentati per ridurre errori OOM (`Metaspace`) su runner GitHub
  - pulisce i file di signing a fine job
- Secrets richiesti (Repository Secrets):
  - `ANDROID_KEYSTORE_BASE64`
  - `ANDROID_KEYSTORE_PASSWORD`
  - `ANDROID_KEY_ALIAS`
  - `ANDROID_KEY_PASSWORD`

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
