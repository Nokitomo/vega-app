# Cloudflare WARP

## Supporto e comportamento

WARP e disponibile solo su Android in `Impostazioni > Preferenze > Rete` ed e
disattivato per impostazione predefinita. Al primo avvio Vega registra un client
WARP personale tramite `usque`, progetto indipendente non affiliato a Cloudflare.
La conferma nell'interfaccia informa l'utente che l'attivazione accetta i termini
Cloudflare.

Non viene creata una VPN Android e non viene modificata la rete del dispositivo.
Vega avvia invece un proxy HTTP locale legato esclusivamente a `127.0.0.1` e
instrada verso di esso le nuove connessioni del client OkHttp condiviso. Sono
quindi coperti:

- `fetch` e Axios di React Native;
- richieste dei provider che usano lo stack React Native;
- download HLS eseguiti tramite Axios;
- player interno Android tramite `react-native-video`/OkHttp.

Non sono coperti WebView/GeckoView, casting, app o player esterni, download nativi
con uno stack diverso, ne iOS. WARP e quindi app-scoped anche se l'indirizzo IP
pubblico delle richieste coperte cambia.

## Relazione con DNS over HTTPS

WARP e DNS over HTTPS sono impostazioni distinte. DoH cifra soltanto la risoluzione
dei nomi e continua a essere la configurazione usata quando WARP e spento. Quando
WARP e attivo, il proxy risolve nel tunnel i nomi delle destinazioni coperte; Vega
mantiene comunque intatta la preferenza DoH, pronta per il ritorno alla connessione
diretta. Il client bootstrap DoH esclude esplicitamente il proxy per evitare cicli.

## Avvio, verifica e recupero dagli errori

`VegaWarpController` serializza avvio e arresto. Prima pubblica il proxy al client
condiviso solo dopo aver verificato tutte queste condizioni:

1. il processo ascolta sulla porta loopback assegnata;
2. una richiesta HTTPS attraverso il proxy raggiunge il trace Cloudflare;
3. la risposta conferma che WARP non e `off`.

Se una porta viene occupata nella breve finestra tra selezione e bind, l'avvio
riprova fino a tre volte. Se la verifica fallisce, il processo viene terminato e
il traffico non viene deviato. Se il processo termina inaspettatamente, il proxy
viene rimosso immediatamente dal client OkHttp e le connessioni successive tornano
al percorso normale con il DoH selezionato.

## Dati locali e sicurezza

La configurazione generata da `usque` contiene chiavi e token. E salvata in
`noBackupFilesDir/warp/config.json`, directory privata dell'app esclusa dai backup
Android, con permessi limitati al proprietario. I comandi vengono avviati con
`ProcessBuilder` e argomenti separati, senza shell. Nessun segreto viene passato al
livello TypeScript.

Il binario e fissato a `usque` v4.2.1. Sono inclusi `armeabi-v7a`, `arm64-v8a` e
`x86_64`: i primi due coprono gli APK di rilascio, mentre `x86_64` consente il test
sull'emulatore di progetto. Provenienza, hash e licenza sono documentati in
`native-src/android/jniLibs/README.md`.

`libusque.so` e un eseguibile PIE denominato come libreria nativa. Vega usa il
legacy packaging delle librerie Android affinche PackageManager lo estragga nella
directory nativa privata ed eseguibile su tutte le versioni supportate; il binario
viene inoltre escluso dallo stripping.

## File coinvolti

- `VegaWarpController`, `VegaWarpModule` e `VegaWarpPackage` per processo e bridge;
- `VegaDnsController` per la selezione proxy dinamica nel client condiviso;
- `src/lib/services/warp.ts` per preferenza e sincronizzazione all'avvio;
- `DnsSettings.tsx` per interfaccia, conferma e stato;
- `plugins/with-android-warp.js` e `android/app/with-android-warp.gradle` per
  includere i binari ABI senza duplicarli nella cartella Android generata.
