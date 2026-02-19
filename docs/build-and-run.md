# Build e Avvio

## Prerequisiti
- Node >= 20.19.4 (vedi package.json -> volta).
- Android SDK configurato.
- Per iOS: Xcode + CocoaPods.

## Installazione
```
npm install
```

## Avvio Metro (dev client)
```
npx expo start -c --dev-client --scheme com.vega --port 8081
```
Nota: serve il dev client; non usare Expo Go per funzioni native.

## Avvio Android (dev client)
```
npx expo run:android --device "Medium_phone_API_35"
```
Nota: non usare l'emulatore Pixel_6_Pro_API_35.
Nota: il wrapper Gradle usa 8.14.3; se vedi errori di versione minima, verifica `android/gradle/wrapper/gradle-wrapper.properties`.
Nota: la New Architecture e' disattivata.
Nota (cast nativo custom receiver): puoi impostare l'App ID con variabile ambiente prima della build:
```powershell
$env:VEGA_CAST_RECEIVER_APP_ID="ABCD1234"
npx expo run:android --device "Medium_phone_API_35"
```
Nota (Vega Cast pairing code): per usare codice corto con API Vercel, imposta anche:
```powershell
$env:EXPO_PUBLIC_CAST_RECEIVER_WEB_URL="https://nokitomo.github.io/vega-cast-receiver/"
$env:EXPO_PUBLIC_CAST_PAIR_API_BASE_URL="https://your-vercel-domain.vercel.app"
npx expo run:android --device "Medium_phone_API_35"
```

## Prebuild (rigenera android/ios)
Attenzione: non eseguire `npx expo prebuild` per Android (sovrascrive customizzazioni in `android/`).
Per iOS, usarlo solo se strettamente necessario e concordato:
```
npx expo prebuild -p ios --clean
```
Nota: il progetto contiene customizzazioni native; evitare prebuild se non richiesto.

## Avvio iOS (dev client)
```
npx expo run:ios
```

## Build produzione
- Android: usa EAS o build gradle manuale.
- fastlane/ contiene metadata per Play Store.

## Build iOS unsigned (GitHub Actions)
- Workflow: `.github/workflows/ios-unsigned.yml`.
- Trigger: tag `v*` o avvio manuale.
- Output: artifact `Vega-unsigned-ipa` e asset release `Vega-unsigned.ipa` (solo su tag).
- Nota: l'IPA non e' firmato; serve firma per installarlo su device.

## Verifica lingua (i18n)
- In app: Settings -> Preferences -> App Language.
- Testare sia inglese che italiano durante QA, includendo notifiche e messaggi di errore.
