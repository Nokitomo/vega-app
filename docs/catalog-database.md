# Catalogo Cinema installabile

Implementazione sul branch `cruncy-ui`. Il catalogo scaricato e la cache
`vega-metadata.db` dei provider hanno responsabilita e file distinti.

## Uso

Impostazioni → Database consente installazione manuale, controllo aggiornamenti,
pausa/ripresa, annullamento, attivazione del download pronto e rimozione. La scelta
"Usa Cinema nella Home" non cambia il provider selezionato. La ricerca globale
mantiene tutti i provider installati e aggiunge una sezione locale quando Cinema
e selezionato. Le pagine aperte dai risultati online conservano il percorso online.

Le preferenze per fonte, lingua, ordine e dimensione TMDB sono per catalogo e
persistono tramite SettingsStorage. Il cambiamento invalida le query locali;
non richiede un nuovo download. Sono configurabili sezioni Home, visibilita,
ordine, tipo, generi, intervallo di anni, ordinamento e sezione del riquadro Hero.
I contatori rappresentano lo snapshot, non una classifica in tempo reale.

Poster: TMDB it/en/original/xx, TVDB, StreamingUnity it. Background: TMDB xx,
TVDB, StreamingUnity. Logo: TMDB it/en/xx, StreamingUnity, TVDB. Poster stagionale:
TMDB it/en, TVDB, TMDB xx; fallback al poster dell'opera. Miniature: StreamingUnity,
TMDB, TVDB. I poster stagionali non introducono un nuovo elemento grafico nella
selezione testuale delle stagioni. Cover e cover mobile rimangono conservate.

Solo assegnazioni `eligible` possono essere selezionate. Le assegnazioni `forced`
precedono ogni preferenza e un override thumbnail nullo blocca ogni fallback.
Lingua sconosciuta e senza lingua (`xx`) sono distinte. Si riscrive la dimensione
solo per immagini attribuite a TMDB su `image.tmdb.org/t/p/`; SVG, TVDB e URL dei
provider rimangono invariati. I collegamenti originali non vengono modificati.

Info ed episodi locali non eseguono arricchimenti online. Gli episodi sono
consultabili anche senza provider installati. La riproduzione richiede una fonte
presente e compatibile; attualmente il collegamento e implementato per
StreamingUnity. Le coordinate canoniche e quelle del provider sono distinte:
le composizioni usano `playbackSources`, mai numeri ricavati dai titoli.

## Trasferimento e attivazione

Il manifest e quello del branch `cinema-sqlite` del repository Nokitomo/database;
gli asset sono release HTTPS dello stesso repository. Sono accettati schema e
reader versione 1 e pubblicazioni `validationOnly: false`. I checksum proteggono
l'integrita rispetto al manifest: non sono firme indipendenti del publisher.

Android usa WorkManager e il client OkHttp dell'app; iOS usa URLSession in
background e BGAppRefreshTask. I controlli automatici sono richiesti ogni due ore
e all'apertura, ma il sistema operativo ne decide l'esecuzione. Wi-Fi/rete non
misurata e il default; la rete cellulare e opt-in. I file risiedono in una directory
privata esclusa dai backup. Non sono richiesti permessi di accesso alla memoria
condivisa. Serve una nuova build nativa: non usare Expo Go o `expo prebuild`.

Il download continua indipendentemente dal JavaScript. La preparazione e
l'attivazione avvengono con app attiva. Gzip, hash e lettura NDJSON sono nativi e
limitati in memoria. Lo snapshot iniziale osservato richiede circa 1,24 GB di rete
e 4,63 GB installati, oltre allo spazio temporaneo. Lo spazio necessario viene
controllato prima del download e della preparazione.

Per gli aggiornamenti si usa l'ultima catena contigua dalla revisione installata,
se piu piccola dello snapshot. I delta vengono applicati in una copia privata con
transazioni SQL parametrizzate; vengono controllati hash delle righe, revisioni,
relazioni, conteggi e indice FTS. La revisione logica viene calcolata ordinando gli
hash per ID BINARY: non si confrontano i byte della copia aggiornata con quelli
dello snapshot del server. Delta non validi fanno richiedere lo snapshot completo.

La nuova generazione viene selezionata solo dopo verifica e chiusura della
connessione di preparazione. I lettori precedenti terminano prima della rimozione
dei relativi file. Dopo un'interruzione, i file di preparazione abbandonati sono
rimossi alla riapertura. Rimuovere il catalogo conserva preferenze e dati personali.

## Confini di sicurezza e compatibilita

Il codice del publisher e il manifest HTTPS del repository configurato sono il
confine di fiducia. Non si accettano URL di cataloghi arbitrari, SQL di delta,
percorsi remoti di output o estensioni SQLite. Dimensioni, percorsi locali,
versioni e hash vengono controllati prima dell'attivazione. Un errore non deve
modificare il puntatore alla versione attiva. Nessun URL, titolo, token o
identificativo viene aggiunto ai log diagnostici di questa funzionalita.

`catalogRef` identifica esplicitamente i percorsi locali. La riconciliazione della
cronologia usa solo ID di fonte e alias verificati nel catalogo, non titoli simili.
I contratti del player e DRM rimangono gli stessi; le stagioni locali vengono
caricate dal catalogo anche nel passaggio all'episodio/stagione successiva.

Le skill security-threat-model/security-best-practices sono state usate per i
confini di fiducia e i controlli dell'input. Le linee guida React web non coprono
interamente Kotlin/Objective-C++: la parte nativa richiede revisione e prove
specifiche, senza estendere automaticamente le garanzie delle linee guida web.

## Verifiche e limiti

Test automatici specifici coprono priorita, lingua, SVG e dimensioni, esclusioni
verificate, catene incrementali/revisioni ripetute, mapping delle composizioni,
fonti indisponibili, checksum errati, spazio insufficiente, preparazione interrotta,
attivazione dopo chiusura e serializzazione delle installazioni.

Build Android dev client verificata senza prebuild. Le prove visive usano
Medium_Phone_API_35. Questo emulatore dispone di meno di 1 GB libero: non consente
una prova dello snapshot completo da 4,63 GB. La prova completa di installazione,
aggiornamento reale e prestazioni su dispositivo sufficientemente capiente resta
necessaria. Il codice iOS non e compilabile/verificabile su questa postazione
Windows e richiede Xcode e un dispositivo/simulatore appropriato.

Non dichiarare assenza di regressioni o affidabilita dei trasferimenti su iOS
finche questi controlli non sono stati eseguiti.

### Prova locale del 12 novembre 2026

Verifiche automatiche: `npx tsc --noEmit`, `npm run lint` e suite Jest completa
(80 suite, 405 test). Compilazione Kotlin riuscita anche dopo gli ultimi controlli
sulla rete. Nessun prebuild eseguito.

La schermata delle impostazioni e stata aperta nel dev client Android e sono
state controllate le etichette italiane e le preferenze iniziali. Un campione
SQLite con due opere reali, verificato con il publisher, e stato preparato e
decompresso sul dispositivo. La prova di attivazione e navigazione non e stata
conclusa: l'emulatore ha manifestato blocchi di System UI e la postazione ha
esaurito quasi tutto lo spazio su C:. Il manifest e l'archivio del campione sono
stati rimossi dalla coda, senza pubblicare dati di prova. Questa prova non
certifica l'installazione del catalogo completo o gli aggiornamenti incrementali
su un dispositivo reale.

Gli output di build e i log di questa sessione sono conservati fuori repository
in `D:/codex-temp/vega-catalog`. L'APK generato precede gli ultimi controlli
nativi sulla rete: per testare lo stato finale occorre ricompilare il dev client.
