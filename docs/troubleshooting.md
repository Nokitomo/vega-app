# Troubleshooting

## App bloccata sullo splashscreen
Sintomo: l'app non supera la schermata iniziale.

Cause frequenti:
1) Metro non attivo o porta occupata.
2) Dev client installato non allineato alla versione React Native/Expo del progetto.
3) Errore JS early (es. TurboModule mancante).

### Passi di risoluzione
1) Chiudi eventuali Metro attivi su 8081.
2) Avvia Metro in modo non interattivo:
```
npx expo start -c --dev-client --scheme com.vega --port 8081
```
3) Se in logcat compare:
"TurboModuleRegistry.getEnforcing(...): 'PlatformConstants' could not be found"
il problema e quasi sempre la New Architecture.
   - Assicurati che sia disattivata:
     - app.config.js: `newArchEnabled: false`
     - android/gradle.properties: `newArchEnabled=false`
   - Poi ricostruisci:
```
adb uninstall com.vega
npx expo run:android --device "Medium_phone_API_35"
```
Nota: non usare l'emulatore Pixel_6_Pro_API_35.
Questo riallinea binario nativo e bundle JS.
Nota: non eseguire `npx expo prebuild` (ci sono customizzazioni native).

## Errore Crashlytics: Default FirebaseApp not initialized
Se i plugin Firebase sono abilitati e mancano google-services.json o GoogleService-Info.plist, Crashlytics logga un errore.
- E' previsto se Firebase e attivo.
- Il log non dovrebbe bloccare l'app.

## Metro: Unable to resolve module node:stream
Sintomo: Metro fallisce con "Unable to resolve module node:stream" (es. da cheerio).
- Verifica che `stream-browserify`, `events`, `assert`, `buffer`, `process`, `util` siano tra le dipendenze.
- Verifica che `metro.config.js` risolva i moduli `node:` e faccia il mapping a `stream`, `events`, `assert`, `buffer`, `process`, `util`.

## Metro: Unable to resolve module node:net (undici)
Sintomo: Metro fallisce con "Unable to resolve module node:net" da `undici/...`.
- Verifica che esista `src/shims/undici.js`.
- Verifica che `metro.config.js` mappi `undici` (anche import profondi `undici/...`) allo shim.

## iOS: ExpoModulesCore richiede iOS 15.1
Sintomo: build iOS fallisce con "module 'ExpoModulesCore' has a minimum deployment target of iOS 15.1".
- Allinea `IPHONEOS_DEPLOYMENT_TARGET` a 15.1 nell'app iOS.

## iOS CI: GOOGLE_APP_ID mancante (Firebase non usato)
Sintomo: build iOS in GitHub Actions fallisce con "Could not get GOOGLE_APP_ID in Google Services file".
- Se Firebase non e usato, disabilita l'autolinking iOS per `@react-native-firebase/*` in `react-native.config.js`.
- In questo modo i pod Firebase non vengono installati e lo script Crashlytics non gira.

## React Native FS / Patch-package
- Fix applicato via patch-package: patches/@dr.pogodin+react-native-fs+2.34.0.patch
- Se si reinstallano i node_modules, il postinstall applica la patch.

## Expo Go in offline mode
Se Expo segnala che Expo Go non e installato in offline mode:
- Usa un dev client (`expo run:android`); Expo Go non e supportato per funzionalita native.

## Cast nativo: nessun device / dialog non si apre
Sintomi tipici:
- il pulsante cast non mostra device
- il cast dialog non si apre

Verifiche:
1) Assicurati che telefono e Chromecast/TV siano sulla stessa rete LAN.
2) Verifica Google Play Services aggiornato sul device Android.
3) Controlla metadata cast in `android/app/src/main/AndroidManifest.xml`.
4) Ricostruisci il dev client dopo modifiche native:
```
npx expo run:android --device "Medium_phone_API_35"
```
5) Se usi receiver custom, verifica App ID:
- variabile `VEGA_CAST_RECEIVER_APP_ID` valorizzata
- receiver registrato in Google Cast Developer Console
- URL receiver HTTPS raggiungibile.

## Cast nativo: stream non parte con alcuni provider
Possibili cause:
- stream richiede header HTTP (Referer/Cookie/Auth) non passati correttamente
- URL stream scaduto/tokenizzato

Verifiche:
1) Controlla che il receiver custom applichi `customData.headers` in `manifestRequestHandler/segmentRequestHandler`.
2) Avvia cast subito dopo fetch stream (evita URL scaduti).
3) Prova fallback WVC per confermare che il problema e specifico del receiver nativo.

## Vega Cast (LAN/Web): receiver non parte o non apre media
Sintomi tipici:
- il receiver non accetta il codice pairing
- il receiver si apre ma non avvia il video

Verifiche:
1) Controlla `EXPO_PUBLIC_CAST_RECEIVER_WEB_URL` (o fallback) e che l'URL receiver sia raggiungibile in HTTPS.
2) Controlla `EXPO_PUBLIC_CAST_PAIR_API_BASE_URL` e che l'endpoint Vercel risponda su `/api/session` e `/api/session/consume`.
3) Se usi GitHub Pages per il receiver, verifica `receiver-config.js` con `pairApiBaseUrl` corretto.
4) Il codice e one-time con TTL: se scade o viene gia usato, rigenera un nuovo codice dall'app.
5) Se l'API pairing non e disponibile, Vega fa fallback su link diretto: in quel caso assicurati che il link non venga troncato durante copia/incolla.
6) Se il provider richiede header/cookie stretti e il browser TV blocca la richiesta, usa fallback `native` o `wvc`.
7) Se il video parte ma l'app non aggiorna minutaggio/episodio, verifica endpoint `/api/session/progress/update` e `/api/session/progress/get` raggiungibili su Vercel.
8) Per stream HLS protetti che continuano a fallire in browser standalone anche con Hls.js, usare fallback `native` o `wvc`.

## Stringhe non tradotte / chiavi visibili
Sintomo: testi in inglese o chiavi raw (es. `Some Key`).
- Verifica che la chiave esista in `src/i18n/en.json` e `src/i18n/it.json`.
- Nei componenti usare `t(...)`; nei servizi usare `i18n.t(...)`.

## Provider installato ma nessun contenuto (DNS/NXDOMAIN)
Sintomi tipici:
- Il provider risulta installato ma home/search/info tornano liste vuote.
- In log compaiono errori di rete senza status HTTP (es. `ERR_NETWORK`, `NO_STATUS`).
- In Chrome sullo stesso device compare `dns_probe_finished_nxdomain` aprendo il dominio del provider.

Diagnosi:
- In questi casi il problema e spesso DNS/rete del device (resolver locale, carrier, hotspot, policy DNS), non necessariamente il codice del provider.
- Se con DNS alternativi o VPN il provider torna a funzionare, la causa e confermata.

Mitigazioni consigliate:
1) Imposta DNS privato affidabile sul device (es. Cloudflare o Google DNS).
2) In alternativa usa app DNS dedicata (es. `1.1.1.1`) o VPN.
3) Verifica da browser del device che il dominio provider sia raggiungibile.

Nota:
- Provider diversi possono avere esiti diversi sulla stessa rete: uno puo funzionare e un altro no, in base a come viene risolto il dominio.
