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

I moduli provider installati sono ora deserializzati una volta per revisione
della chiave MMKV e poi riutilizzati in memoria. `provider_modules.read`
continua a contare ogni richiesta del modulo, anche quando la copia e gia
disponibile: per valutare questo intervento confrontare soprattutto il tempo
totale e il massimo, non soltanto il numero delle chiamate. Il primo accesso
dopo l'avvio o un aggiornamento del provider continua a leggere lo storage.

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

### Misura dei parser provider del 20 ottobre 2026

I log e le schermate temporanei sono in `.codex/perf-provider-fix-20261020/`.
Il dev client su `Medium_phone_API_35` ha caricato i bundle locali aggiornati
dei tre provider tramite il server di sviluppo. La configurazione temporanea
dell'app e stata rimossa dopo le prove. Nessun episodio e stato avviato.

- Su una pagina Inertia sintetica di circa 250 KB, 50 estrazioni ripetute
  hanno richiesto in media 16,91 ms con il parsing completo Cheerio e 0,17 ms
  con l'estrazione mirata di `data-page`. Questa misura isola il parser e non
  rappresenta il tempo totale di apertura della scheda.
- In una prima apertura StreamingUnity, `provider.meta` completo ha richiesto
  14,1 s, `metadata_ready` 426 ms e `first_layout` 782 ms. Alla riapertura
  della stessa scheda, questi ultimi due valori sono stati 286 e 775 ms.
- In una prima apertura StreamCenter, `provider.meta` completo ha richiesto
  19,6 s e `metadata_ready` 20,0 s. Alla riapertura della stessa scheda,
  `metadata_ready` e `first_layout` sono stati 138 e 392 ms. La prima
  apertura ha registrato un `js_lag` massimo di 3,35 s.
- Una scheda anime delegata da StreamCenter e stata confrontata visivamente
  tra bundle installati e bundle aggiornati: artwork, testo, cast e 13 episodi
  erano presenti in entrambi. Un primo tentativo con i bundle aggiornati aveva
  fallito per richieste AnimeUnity con `network_error`; la ripetizione e
  riuscita. Il valore `provider.meta` della ripetizione e stato 10,3 s.

I tempi della prima apertura dipendono da rete e cache esterne non controllate;
non consentono di attribuire al solo parsing una variazione del tempo totale.
Il percorso locale di test ha anche prodotto un eccesso di download dei moduli
prima che il refresh automatico venisse disattivato nella configurazione
temporanea. Quel tentativo e il relativo arresto del processo non sono inclusi
nelle misure sopra. Le pause JS residue richiedono ulteriori misure mirate.

### Lookup TMDB mirato di StreamingUnity del 20 ottobre 2026

Il resolver usato per colmare i campi mancanti della scheda StreamingUnity
richiede ora solo i campi necessari. Il percorso TMDB condiviso usato da
AnimeUnity mantiene il comportamento precedente. La ricerca delle immagini
resta separata e continua a seguire le preferenze dell'app. Anche StreamCenter
usa il percorso mirato quando delega una scheda a StreamingUnity.

La fixture deterministica con il solo cast mancante ha prodotto un oggetto
`Info` identico prima e dopo. In una fixture TV, le richieste del resolver
TMDB sono passate da 15 a 3: le pagine delle stagioni e le gallerie immagini
non servono al recupero del cast. In una fixture film con preferenze immagini
attive le richieste totali sono rimaste 14, perche il resolver artwork ha
comunque richiesto le gallerie. Sono stati verificati anche il percorso con
chiave API e il fallback delle lingue.

Sul dev client `Medium_phone_API_35`, con `EXPO_PUBLIC_PERF_TRACE=1`, i bundle
locali aggiornati hanno aperto una scheda StreamingUnity con molte stagioni,
cambiato stagione e aperto la scheda equivalente tramite StreamCenter. La
scheda mostrava artwork, trama, cast, stagioni ed episodi; non sono stati
avviati episodi e non sono emersi crash nelle tracce raccolte. Nel campione,
`provider.meta` StreamingUnity completo ha richiesto 15,5 s; in una apertura
fredda `metadata_ready` e arrivato dopo 15,9 s. Le riaperture con metadati
gia in cache hanno raggiunto `metadata_ready` in 244-372 ms su StreamingUnity
e in 310/307 ms su StreamCenter. Il massimo `js_lag` durante le prove e stato
1,37 s. Questi tempi includono rete, cache e carico del dev client: il
confronto deterministico delle richieste misura l'effetto del
fix, mentre la prova sull'emulatore verifica l'integrazione senza isolare il
suo contributo ai tempi di apertura. Tracce e schermate temporanee sono in
`.codex/perf-provider-fix3-20261020/`.

### Layout stagioni TMDB mirato di AnimeUnity del 21 ottobre 2026

Il percorso che compone le stagioni e le saghe di AnimeUnity usa ora un resolver
TMDB dedicato al layout delle stagioni. Mantiene l'ordine di preferenza delle
stagioni API/web, i nomi localizzati, i conteggi, i link e i fallback. Evita in
quel percorso le gallerie immagini e i credits API che non servono a costruire
le stagioni. La risoluzione delle immagini della scheda
resta separata e segue le preferenze esistenti. StreamCenter usa lo stesso
percorso quando delega una scheda ad AnimeUnity.

Nelle fixture deterministiche, gli array delle stagioni sono identici a quelli
del resolver completo: le richieste del solo resolver sono passate da 15 a 6
senza chiave API, da 20 a 3 con stagioni API disponibili e da 20 a 9 quando
l'API non fornisce stagioni. L'oggetto `Info` completo di AnimeUnity e risultato
identico al bundle precedente. Nella fixture `getMeta` le richieste complessive
sono rimaste 19, perche il percorso artwork separato ha comunque richiesto le
gallerie. Questo fix riduce il lavoro del lookup delle stagioni, ma non prova
un miglioramento del tempo totale di apertura della scheda.

Sul dev client `Medium_phone_API_35`, con `EXPO_PUBLIC_PERF_TRACE=1` e bundle
locali aggiornati, sono state aperte schede One Piece tramite AnimeUnity e
StreamCenter, cambiata saga, aperta una scheda film AnimeUnity e riaperta
l'app. Artwork, testo, cast, stagioni ed episodi erano presenti; nessun episodio
e stato avviato. Le tracce filtrate non mostrano `FATAL EXCEPTION`.
Nel campione, la scheda completa AnimeUnity One Piece ha richiesto 19,4 s di
`provider.meta`, mentre una scheda gia in cache ha raggiunto `metadata_ready`
in circa 0,45 s; StreamCenter delegato in circa 0,45 s. Il massimo `js_lag`
registrato e stato 3,57 s. Rete, cache, lavoro della Home ed emulatore non
sono controllati in questa misura, quindi quei tempi non isolano l'effetto del
fix. Restano pause JS da indagare separatamente.

Log e schermate temporanei: `.codex/perf-anime-season-layout-20261021/`.
La configurazione temporanea usata per caricare i bundle locali e stata
rimossa dopo la prova.
