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

Lo scope delle cache del provider viene riutilizzato in memoria finche non
cambiano moduli installati, elenco provider o sorgenti. Ogni scrittura o
cancellazione di queste chiavi lo invalida, anche se lo storage viene svuotato
direttamente. Le sezioni Home persistite vengono lette una volta per montaggio
e scope; gli aggiornamenti successivi passano dai risultati React Query, senza
rileggere SQLite e MMKV a ogni render. Durate, refresh manuale e priorita delle
sezioni restano invariati. Nei confronti prima/dopo controllare specialmente i
conteggi `provider_modules.read` e `home_category_cache`, oltre ai picchi
`js_lag`; non sommare tempi annidati.

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

## Catalogo delle serie

La scheda attende anche gli aggiornamenti della stagione attiva prima di avviare la
sincronizzazione del catalogo completo. Per ogni serie e provider viene eseguita
una scansione alla volta; se la stagione o l'elenco cambiano durante la scansione,
si conserva solo l'ultima richiesta in coda. Le stagioni recuperate vengono
salvate nella cache condivisa degli episodi e riutilizzate nelle aperture
successive per quattro ore. Una stagione non disponibile mantiene il catalogo
incompleto, quindi la serie non viene segnata come interamente vista.

Con `EXPO_PUBLIC_PERF_TRACE=1`, `series.catalog` misura la scansione e
`series_catalog_summary` riporta numero di gruppi, cache hit, fetch, esito
completo e sostituzione da una richiesta piu recente. `series_catalog_coalesced`
segnala una richiesta accodata. Nessuno di questi eventi registra link, titoli
o identificativi. Per confrontare prima e dopo, aprire una serie con molte
stagioni, cambiare stagione mentre il catalogo carica e riaprire la stessa
scheda. Controllare che le richieste `provider.episodes` diminuiscano dopo il
primo caricamento e che il catalogo completo, la continuazione e le azioni
"segna come visto" restino corretti.

Per la Home e i metadati confrontare separatamente `home.category`,
`provider.posts`, `provider.meta` e `js_lag`, sia con cache fredda sia dopo un
riavvio. Una pausa `js_lag` che precede `series.catalog` non puo essere attribuita
alla sincronizzazione delle stagioni. Gli span `provider.meta` includono rete e
codice del provider; per individuare la porzione sincrona responsabile di un
blocco serve una traccia del thread JavaScript.

### Misura del 20 ottobre 2026 (dev client, Medium_phone_API_35)

I log temporanei sono in `.codex/perf-run-20261020/after-fix/` e restano fuori
dal commit. Nessun episodio e stato avviato. Sono state percorse Home e schede
dei tre provider, cambiate stagioni e riaperta l'app.

- Scheda con 37 stagioni: la prima scansione ha recuperato 33 stagioni in
  32,7 s, con una sola scansione attiva alla volta. Al cambio stagione e alla
  riapertura successiva: 36 cache hit e **0 fetch** del catalogo; la scansione
  a cache calda ha richiesto 36-41 ms. In una traccia precedente alla modifica
  comparivano 11 richieste di episodi nei primi 12 s della scheda. La prima
  apertura resta costosa e il confronto non e una misura controllata della rete.
- Scheda con 29 stagioni: prima scansione con 26 fetch in 23,3 s; al cambio
  stagione 28 cache hit e 0 fetch. Una scheda con 23 gruppi ha riportato 22
  cache hit e 0 fetch al cambio saga. Il menu di pressione prolungata su un
  episodio e il menu delle opzioni della scheda erano disponibili.
- Home: le quattro sezioni misurate su AnimeUnity hanno richiesto 1,3-4,0 s
  (`provider.posts` 1,2-3,9 s) e il massimo `js_lag` e stato 2,0 s. Su
  StreamCenter tre sezioni hanno richiesto 1,7-2,9 s e il massimo `js_lag` e
  stato 1,35 s. Le letture sincrone della cache Home hanno totalizzato
  rispettivamente 19 ms e 11 ms nei campioni: da sole non spiegano le pause.
- Metadati non presenti in cache: `provider.meta` ha richiesto 21,3 s su
  StreamingUnity e 13,5 s su StreamCenter; i massimi `js_lag` durante quelle
  aperture sono stati 2,76 s e 1,46 s. Nel primo caso la traccia comprende
  12 richieste a TMDB web e 18 a TVDB, oltre alle richieste iniziali. La fase
  dei metadati e stata misurata prima della scansione del catalogo. Anche una
  scheda senza catalogo di stagioni ha mostrato pause JS mentre caricava i
  metadati.

Il riutilizzo degli episodi elimina i fetch ripetuti del catalogo finche la
cache resta valida. Le pause della Home e dei metadati richiedono una verifica
separata: tracciare il lavoro JS dei moduli provider, il numero e la concorrenza
delle richieste dei metadati e il costo di rendering delle card. I dati di
`gfxinfo` del dev client su questo emulatore includono il costo di rendering
dell'emulatore stesso e non sono un benchmark di dispositivi reali.
