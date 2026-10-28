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

### Metadati `hero` dei provider del 21 ottobre 2026

L'app richiedeva gia `purpose: 'hero'` per la Home. StreamCenter ora inoltra
questo scopo al provider delegato. StreamingUnity mantiene gli stessi campi
visibili, le preferenze artwork e i fallback, ma nella sola richiesta `hero`
non costruisce i link delle stagioni e non esegue i controlli di disponibilita
dei film. Quando si apre la scheda, `purpose: 'full'` continua a produrre i
link e a fare i controlli precedenti. AnimeUnity riceve `hero` anche tramite
StreamCenter. Le fixture confrontano i campi visibili `hero` e `full` e
verificano che il controllo stagionale sia saltato solo nella Home.

Sul dev client `Medium_phone_API_35` sono stati caricati i bundle locali dei
tre provider. Le Home mostravano immagini, titoli, generi e sezioni; sono state
aperte una serie StreamingUnity e una scheda AnimeUnity delegata da
StreamCenter, con stagioni ed episodi presenti. Sono stati effettuati scroll
verticali e orizzontali, senza avviare il player. Le tracce non mostrano crash
o eccezioni non gestite. Il massimo `js_lag` del campione e stato 1,76 s;
`provider.meta` della Home ha impiegato circa 9,8-10,6 s su AnimeUnity,
10,1 s su StreamingUnity e 7,4-21,5 s su StreamCenter. Questi span includono
rete, cache e provider delegati; non sono misure isolate del lavoro JS.

Le pause JS non sono eliminate da questo fix. Durante una pausa di 1,76 s
erano in corso piu richieste a pagine TMDB; le letture sincrone tracciate
nello stesso intervallo totalizzavano poche decine di millisecondi, quindi
non spiegano da sole la pausa. All'avvio si e vista anche una pausa di 1,52 s
prima che le schede fossero caricate. Il campione indica contesa tra lavoro
provider, rendering della Home e carico del dev client, ma non attribuisce
con certezza la pausa a una singola funzione. Per il passo successivo servono
profili temporizzati del thread JS e del rendering delle card durante avvio e
scroll, separando il parsing delle risposte dal commit React e dal caricamento
immagini. `gfxinfo` dell'emulatore ha registrato 295 frame lenti su 717
(41,1%); questo valore include il costo dell'emulatore e del dev client e non
va interpretato come prestazione di un dispositivo reale.

Tracce, `gfxinfo`, `meminfo` e schermate sono in
`.codex/perf-provider-hero-20261021/`; restano fuori dai commit. La
configurazione temporanea per il server locale e stata rimossa.

### Catalogo delle serie e progressi del 21 ottobre 2026

Il calcolo in blocco dei progressi ora determina una sola volta se la serie usa
identita episodio condivise fra AnimeUnity e StreamCenter. La scheda Info evita
scansioni ripetute quando provider, gruppi, episodi attivi e versione di
aggiornamento sono equivalenti e la cache degli episodi e ancora valida. Il
controllo riparte dopo un risultato incompleto o un errore, alla successiva
richiesta dopo la scadenza del record piu vecchio, oppure quando cambiano i
dati rilevanti. Non cambiano i
campi del catalogo, il significato di `complete` o le regole dei provider.

Sul dev client `Medium_phone_API_35`, con `EXPO_PUBLIC_PERF_TRACE=1`, una
lettura di prova dei progressi di 1.180 episodi di One Piece e passata da
322-332 ms prima del fix a 9 ms dopo il fix. La lettura usa gli stessi dati
salvati; la sonda temporanea non e presente nel codice finale. Nell'apertura
AnimeUnity con cache calda e stata eseguita una scansione del catalogo di
42 ms e la richiesta equivalente successiva e stata saltata; prima del fix
erano state osservate piu scansioni nella stessa apertura. Su StreamCenter la
scansione e stata di 120 ms e la successiva e stata saltata. Su StreamingUnity,
Tulsa King ha richiesto tre letture di stagioni non ancora in cache; alla
riapertura, tre gruppi erano in cache, nessuna lettura esterna era necessaria
e il catalogo ha richiesto 3 ms. Un cambio stagione su AnimeUnity e uno su
StreamingUnity hanno continuato ad aggiornare gli episodi visibili. Nessun
player e stato avviato e nelle tracce filtrate non compaiono crash.

Le pause JavaScript non sono scomparse: durante l'apertura AnimeUnity il
campione ha registrato un `js_lag` di 858 ms, e la prima lettura della stagione
di Tulsa King ha richiesto tempo di rete. Questi tempi del dev client non sono
un benchmark controllato della fluidita complessiva della Home. Tracce e
schermate temporanee sono in `.codex/series-catalog-analysis-20261021/` e
restano fuori dai commit.

### Identita delle sezioni Home

La Home conserva l'array vuoto delle card e riutilizza l'oggetto di una sezione
quando filtro, titolo, card, stato di caricamento ed errore sono invariati. Se
tutte le sezioni sono uguali conserva anche l'array verticale; al cambio di
provider o versione del provider riparte con uno snapshot separato. Questo
riduce il rendering ripetuto degli skeleton delle sezioni ancora vuote durante
le risposte delle altre categorie. Non modifica `staleTimeMs`, richieste ai
provider, cache SQLite/MMKV, refresh manuale, preferenze artwork o fallback.
Per valutare il beneficio confrontare a parita di percorso e cache le pause
`js_lag`, i commit React della Home e i frame Android. I tempi del dev client
non equivalgono a quelli di una build release su dispositivo fisico.

Nella prova del 21 ottobre 2026 sul dev client `Medium_phone_API_35`, le
sezioni StreamingUnity ancora in loading hanno registrato 15 aggiornamenti
React per 1298 ms prima della riconciliazione; dopo, 166 aggiornamenti hanno
richiesto 2 ms complessivi. Il confronto conferma la rimozione del costo degli
aggiornamenti inutili, ma non un miglioramento globale della fluidita: i nuovi
montaggi degli skeleton hanno ancora richiesto 3099 ms, e lo stesso percorso
ha avuto 219 frame lenti su 440. AnimeUnity e StreamCenter hanno mostrato
rispettivamente 149/366 e 42/122 frame lenti; questi campioni variano con lo
stato del caricamento e non sono benchmark controllati. Dopo reinstallazione,
le tre Home e le schede di The Mentalist, One Piece, South Park e Detective
Conan si sono caricate senza crash; su The Mentalist hanno funzionato cambio
stagione, menu e pressione prolungata di un episodio. Le tracce locali sono in
`.codex/home-section-fix-20261021/`, ignorata da Git.

### Segnaposto responsive delle sezioni Home

La riga di caricamento di `Slider` non e scorrevole: mostra soltanto i
segnaposto che entrano nella larghezza disponibile. Il numero viene ora
calcolato dalla larghezza della finestra, dalla larghezza della card, dai
margini e dallo spazio tra card, con una card aggiuntiva per coprire il bordo
durante un ridimensionamento. Una finestra da 393 dp crea 4 segnaposto
anziche 20 (8 gradienti invece di 40); a 768 dp ne crea 7 e a 1024 dp 9.
Le card vere, la lista FlashList, l'animazione condivisa, i dati e le
preferenze non cambiano.

Il 21 ottobre 2026, sul dev client `Medium_phone_API_35`, una sezione
StreamCenter non ancora caricata ha mostrato gli skeleton fino al bordo della
finestra. Una sonda React temporanea ha registrato 2 montaggi di sezioni in
loading per 82 ms complessivi; gli aggiornamenti di quelle sezioni sono
rimasti trascurabili. La sonda e stata rimossa. La prova con dimensione
simulata da tablet (1600 x 2560 px, 300 dpi) ha mostrato la Home e le card
popolate; l'emulatore e stato riportato a 1080 x 2400 px e 420 dpi. I test
unitari verificano il conteggio per 320, 393, 768, 1024 e 2048 dp.

Questo misura la riduzione certa dei componenti inutilmente creati, non un
guadagno complessivo di FPS: i campioni prima e dopo hanno cache, sezioni e
richieste diverse. Persistono frame lenti: durante lo scorrimento StreamCenter
208/497, durante quello StreamingUnity 150/292 e AnimeUnity 164/390. Le
tracce mostrano anche aggiornamenti delle sezioni popolate, caricamenti di
bitmap e pause `js_lag` durante richieste ai provider. Sono necessari profili
separati del disegno delle card e delle immagini prima di attribuire quei
ritardi a un componente specifico. Tracce e schermate locali sono in
`.codex/skeleton-fix-20261021/`, ignorata da Git.


## Presentazione del hero

`hero_ready` misura dal montaggio della card al completamento dei metadati e dei caricamenti nativi di sfondo/logo; `hero_presented` riporta l'attesa dalla richiesta di selezione alla pubblicazione della card. Contengono soltanto provider e durata, senza identificativi o URL. Il primo evento puo riguardare una slide preparata fuori vista; non equivale alla sua presentazione. La prima selezione include l'attesa del catalogo dal montaggio del carosello. Per i test a freddo chiudere il processo e svuotare anche il database SQLite dei metadati e le cache immagini nel solo profilo QA: Cancella cache nelle impostazioni non basta. Conservare provider e impostazioni per confronti equivalenti.
