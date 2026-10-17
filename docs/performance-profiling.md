# Profilazione Home e Info

La traccia diagnostica e disattivata per impostazione predefinita e non ha un
interruttore nella UI. Per abilitarla nel dev client o in un APK release locale,
impostare `EXPO_PUBLIC_PERF_TRACE=1` **prima** di avviare Metro o Gradle. Il
valore viene incorporato nel bundle: cambiare la variabile dopo la compilazione
non modifica un APK gia installato. Non modificare il codice per accenderla.
Per confrontare dev client e release usare lo stesso provider, emulatore e stato
iniziale della cache. Non avviare stream durante i test di Home e Info.

```powershell
$env:EXPO_PUBLIC_PERF_TRACE='1'
npx expo start -c --dev-client --scheme com.vega --port 8081
```

```powershell
$env:EXPO_PUBLIC_PERF_TRACE='1'
Set-Location android
.\gradlew.bat :app:assembleRelease --no-daemon --max-workers=2 -x lintVitalRelease
```

Al termine della build diagnostica, rimuovere la variabile dalla shell con
`Remove-Item Env:EXPO_PUBLIC_PERF_TRACE` e ricompilare l'APK normale. La build
normale deve essere verificata separatamente: non deve emettere `[VEGA_PERF]`.
Non committare file `.env` usati solo per questo test.

Su Android leggere le righe `[VEGA_PERF]` con
`adb logcat -v epoch -s ReactNativeJS:I`. Le coppie `start`/`end` hanno lo
stesso `spanId` e riportano `durationMs`. Le fasi comprendono
`home.category`, `provider.posts`, `provider.meta`, `provider.artwork` e
`provider.episodes`. `poster_queued`/`poster_dequeued` misurano l'attesa nella
coda artwork, mentre `content_info_cache`, `episodes_cache` e
`poster_cache_hits` distinguono cache calda e fredda. Quest'ultimo evento
riporta un conteggio cumulativo campionato ogni 25 hit. Le coppie
`http_start`/`http_end` hanno lo stesso `requestId` e distinguono servizio,
tipo di percorso, stato HTTP e durata.

`sync_summary` aggrega ogni 5 secondi le operazioni ripetute: numero di
chiamate, tempo totale, massimo e p95 campionato. Le fasi includono letture e
scritture SQLite (`metadata.*`), lettura/deserializzazione dei moduli provider
(`provider_modules.read`), calcolo delle chiavi di cache, cache delle sezioni
Home, cache poster, valutazione di moduli dinamici e caricamento nativo dei
poster. I tempi annidati, ad esempio `provider_cache_scope` e
`provider_modules.read`, **non** devono essere sommati. `js_lag` segnala una
pausa del thread JavaScript superiore a 120 ms, escludendo timer sospesi per
oltre 5 secondi. `info_navigation_start` e `info_navigation_stage` distinguono
tap, mount, dati disponibili e primo layout della scheda; il primo layout non
garantisce che tutte le immagini siano gia visibili. La traccia resta valida
fino a 120 secondi, per includere anche schede fredde particolarmente lente.

Per analizzare un rallentamento ripetere il percorso Home -> Info su piu card,
poi chiudere e riaprire l'app e riprovare. Confrontare i tempi sincroni, i picchi
`js_lag`, i tempi di rete/provider e il tempo fino al primo layout. I log JS da
soli non misurano con certezza il ritardo tra il tocco fisico e la consegna
dell'evento al thread JS; se necessario usare una traccia Android UI/JS.
In una installazione pulita, installare e selezionare prima un provider. La Home
deve restare utilizzabile anche quando l'Hero non ha ancora alcun candidato
logo o fallback salvato.

La traccia non registra URL completi, query string, header, corpi, titoli o
identificativi dei contenuti e non carica dati automaticamente su server. Non
attiva i vecchi `console.log` dell'app, che possono contenere dati non
anonimizzati. Le chiamate tramite `fetch` e WebView non passano negli
interceptor Axios; le immagini native hanno una misura separata del caricamento.
Le durate dei singoli span non vanno sommate se si sovrappongono. Ripetere i test
con cache calda e vuota; `am start -W` misura l'Activity Android, non la Home.
