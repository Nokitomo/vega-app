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
La lettura degli hash usa pagine da 2.000 righe e un cursore sull'ID con collazione
BINARY su una proiezione temporanea di soli ID/hash, costruita con scansione
sequenziale e ordinamento su disco. Questo evita sia una chiamata nativa per ogni
record sia milioni di accessi casuali ai grandi payload JSON.

Le liste e le opzioni immagini usano `views-<revisione>-1.sqlite`, una cache
derivata separata: conserva colonne di filtro/ordinamento delle opere attive e
tutte le combinazioni fonte/lingua/campo delle assegnazioni eleggibili. I payload
completi vengono letti dal database originale solo per le opere della pagina.
Non modifica record, URL, override, revisioni o hash della pubblicazione.
La cache viene chiusa e rinominata atomicamente prima dell'attivazione; in caso
di interruzione si elimina soltanto il file `.building`. Per installazioni gia
presenti viene ricostruita una volta al primo accesso. La rimozione e la pulizia
delle generazioni includono anche questi file e rispettano i lettori ancora attivi.

La nuova generazione viene selezionata solo dopo verifica e chiusura della
connessione di preparazione. I lettori precedenti terminano prima della rimozione
dei relativi file. Uno snapshot preparato in attesa di attivazione viene conservato
e ricontrollato tramite SHA-256 prima del riuso; le copie incomplete degli
aggiornamenti vengono rimosse. Rimuovere il catalogo conserva preferenze e dati personali.

La preparazione distingue controllo del download, estrazione, verifica della copia,
compatibilita, applicazione delta e attivazione. Mostra avanzamento dei file e tempo
trascorso. Interrompi preparazione conserva il download e richiede una ripresa
esplicita, anche dopo riavvio; il passaggio in background interrompe la preparazione.
L'annullamento del download rimuove anche i candidati non attivi. La breve fase
finale di attivazione non espone il comando di interruzione.

Gli snapshot vengono verificati tramite SHA-256 sia compressi sia estratti, quindi
con controlli di schema, metadati e conteggio FTS. Non si ripetono sul dispositivo
le scansioni complete integrity_check e foreign_key_check gia eseguite dal publisher.
Per i delta si mantengono conteggi e revisione logica completa, con foreign_keys
abilitato sulla stessa connessione della transazione.

Prima dell'attivazione viene costruita una cache derivata separata,
`views-<revision>-1.sqlite`, per gli ordinamenti della Home e le opzioni immagini.
Il database del publisher rimane immutato, inclusi tutti i link e gli override.
Una scansione sequenziale a blocchi prepara solo i campi necessari: le liste
selezionano prima gli ID e recuperano poi i metadati delle sole opere visibili.
La fase espone avanzamento e interruzione; un file `.building` incompleto non viene
usato dai lettori. La cache e ricostruibile e viene eliminata insieme alla
generazione ritirata. I cataloghi gia installati la preparano al primo accesso.

La verifica della revisione di un delta proietta ID e hash in un database SQLite
di lavoro `revision-hashes.sqlite`, separato dalla generazione attiva, e li legge
in pagine ordinate. La proiezione usa blocchi da 10.000 righe e aggiorna la
percentuale, lasciando intervenire la pausa tra i blocchi. Il controllo dello
spazio include una riserva proporzionale al numero di record per questo file.
Non usa tabelle TEMP: alcune build SQLite Android possono
conservarle in memoria anche con `temp_store=FILE`. Il file di lavoro viene
eliminato al termine della verifica e ricreato se un processo precedente si e
interrotto. Evita milioni di accessi casuali ai payload originali senza
cambiare l'algoritmo di revisione del publisher. Anche l'input temporaneo della
cache delle liste e una tabella del file `.building`, rimossa prima di pubblicarlo.

Le impostazioni Database sono divise in Archivio, Immagini e Home. La Home
conserva almeno una sezione attiva; se una preferenza precedente aveva svuotato
le sezioni, vengono ripristinate quelle predefinite. La scelta del riquadro
principale attiva la sezione scelta e la disattivazione della sezione principale
assegna il riquadro alla prima sezione ancora attiva. L'eliminazione chiede
conferma. Nell'editor i generi vengono confrontati con quelli presenti nel
catalogo; il titolo delle sezioni predefinite puo rimanere vuoto per usare la
traduzione dell'app, mentre una nuova sezione richiede un titolo.

Prova Android del 12 novembre 2026 su Medium_Phone_API_35: la verifica logica
completa di 5.263.903 record del catalogo installato e terminata sia con 5 GiB
sia con 3 GiB di RAM, con revisione SHA-256 valida e rimozione del file di lavoro.
Il picco PSS osservato e stato circa 1,05 GiB con 5 GiB e circa 0,97 GiB con
3 GiB, contro circa 4,9 GiB della precedente implementazione TEMP. Su 3 GiB
e stata ricostruita anche la cache derivata delle liste dal catalogo completo:
Home caricata, file `.building` sostituito dalla cache pronta e PSS osservato
intorno a 0,53 GiB. Questo esercita le due fasi che causavano pressione di
memoria, ma non sostituisce una prova end-to-end di un nuovo delta pubblicato.
La variante finale a blocchi e stata riprovata sull'intero catalogo con 3 GiB:
percentuale della proiezione visibile, 5.263.903 hash verificati, nessuna
chiusura del processo, PSS massimo osservato circa 1,16 GiB e file di lavoro
eliminato. L'emulatore ha richiesto circa undici minuti per questa verifica;
non e una previsione dei tempi su dispositivi fisici.
Nella schermata nuova sono state provate le tre schede, il salvataggio di una
sezione predefinita senza titolo, la validazione di un genere assente, la
conferma prima di scartare modifiche o eliminare una sezione, la creazione e
successiva rimozione di una sezione di prova, il cambio qualita TMDB e
l'espansione delle ulteriori fonti immagini. Le preferenze di prova sono state
riportate ai valori iniziali. Nessun comando diagnostico resta nell'app.

Tutte le connessioni del catalogo disabilitano finalizeUnusedStatementsBeforeClosing:
la finalizzazione automatica di expo-sqlite 16.0.10 puo finalizzare statement interni
FTS e causare un crash alla chiusura. Gli statement espliciti dell'app devono essere
finalizzati nei rispettivi finally. Non aggiornare la versione Expo solo per questo
workaround senza verificare la compatibilita del progetto nativo.

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

### Presentazione condivisa con i provider

Il catalogo alimenta la Home, il carousel, le righe, la lista/griglia e la scheda
Info originali di `cruncy-ui`. Le schermate alternative `CatalogHome`,
`CatalogBrowse` e `CatalogInfo` sono state rimosse. La ricerca della Home usa il
catalogo selezionato; la ricerca globale conserva le richieste a tutti i provider
installati e aggiunge una riga locale con gli stessi componenti delle altre righe.

I post locali portano `catalogRef` e non assumono il provider selezionato. I
metadati e le immagini sono letti da SQLite, con ordine/qualita configurabili;
il recupero automatico di artwork e metadati online delle schermate provider non
sovrascrive le scelte del catalogo. La selezione della fonte di riproduzione resta
esplicita quando sono disponibili piu fonti compatibili. Senza provider installato
rimane possibile consultare i dettagli.

La lista stagioni originale legge `catalogSeasonRef`, conservando titoli,
sinossi, thumbnail verificate e coordinate di riproduzione canoniche. Cronologia,
libreria e passaggio al player conservano `catalogRef`, compresa la conversione
dello store della cronologia verso la persistenza. Un aggiornamento del provider
senza quel riferimento non cancella quello gia salvato.

Verifica del ripristino UI (12 novembre 2026): TypeScript e lint senza errori,
83 suite Jest / 426 test passati. Su un AVD temporaneo Medium_Phone_API_35 su D,
con partizione da 24 GiB, scaricato e installato dall'app il catalogo pubblico
completo (1.16 GiB compressi, 4.31 GiB installati). Verificate Home originale,
ricerca locale, ricerca globale con Cinema/AnimeUnity/StreamingUnity, scheda
Breaking Bad (62 episodi), cambio stagione, riproduzione S2E1, ripresa e avanzamento
agli episodi successivi, lista salvati e ritorno da Continua a guardare alla
scheda Cinema. Verificata anche la scheda film El Camino e la sua riproduzione:
il primo avvio ha avuto un timeout, seguito da recupero e avanzamento del video.
Non e stata determinata la causa del ritardo dello stream. Provato il riordino dei
poster e ripristinato l'ordine iniziale; disattivando Cinema ritorna la Home
AnimeUnity, senza modificare la selezione del provider.

L'emulatore con GPU host si e chiuso durante una prova; al riavvio con rendering
software si e verificato un ANR in condizioni di forte carico Android. Le prove
successive a 720x1600/280 dpi sono proseguite. Questi risultati non certificano
prestazioni su smartphone, iOS, cast, download video o ogni combinazione di fonti
e preferenze. Evidenze locali in `D:/codex-temp/vega-ui-restore/evidence`.
I risultati storici sotto riguardano le prove precedenti dell'installatore.

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
Medium_Phone_API_35. Una successiva prova dello snapshot completo su un AVD
temporaneo su D, con partizione dati da 24 GiB, ha riprodotto un crash nativo
in sqlite3_close dopo circa 15 minuti di preparazione nell'APK precedente al fix.
La prova successiva con il dev client ha completato l'installazione dello snapshot
integrale, verificato pausa/ripresa e persistenza della pausa dopo riavvio. Con la
cache derivata sono state aperte Home, scheda, stagioni/episodi e ricerca locale;
la ricerca globale ha mostrato anche i risultati di StreamingUnity.
Il costruttore finale della cache e stato interrotto durante la scansione del
catalogo completo: il temporaneo e stato eliminato e lo snapshot conservato.
La ripresa, comprendente un nuovo hash del file da 4.63 GB e la costruzione della
cache, e terminata in circa cinque minuti sull'AVD. Questo tempo non e un
benchmark per telefoni: l'emulatore ha mostrato anche rallentamenti di System UI.

Un delta generato dal publisher su un campione di due opere e stato applicato
dal vero modulo Android e dall'installatore JS. Il file risultante, estratto
dall'AVD, ha superato tutti i controlli del publisher (inclusi hash dei record,
integrita, relazioni e revisione); verificata anche la ricerca FTS del titolo
aggiornato. Questo verifica il percorso nativo incrementale, non le prestazioni
di un delta sull'intero catalogo. Il calcolo della revisione completa e stato
verificato separatamente sul PC su tutti i 5.262.964 record, con hash identico.
Il codice iOS non e compilabile/verificabile su questa postazione
Windows e richiede Xcode e un dispositivo/simulatore appropriato.

Non dichiarare assenza di regressioni o affidabilita dei trasferimenti su iOS
finche questi controlli non sono stati eseguiti.

### Prova locale del 12 novembre 2026

Verifiche automatiche: `npx tsc --noEmit`, lint (esclusa la directory degli output
Android) e suite Jest completa finale (81 suite, 416 test), incluso il test
negativo di disaccordo tra manifest e delta.
Compilazione Kotlin riuscita anche dopo gli ultimi controlli
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
in `D:/codex-temp/vega-catalog`. Un successivo dev client x86_64 e stato compilato
con il modulo di preparazione interrompibile, senza prebuild.

## Cinema SQLite Lite

Vega scarica gli snapshot completi del formato `vega-cinema-lite-v1` dal
manifest `cinema-sqlite-lite`. Android e iOS continuano a leggere le
installazioni del formato precedente fino all'attivazione di uno snapshot
Lite verificato. Home, ricerca e preferenze delle immagini leggono dal
catalogo locale. La scheda carica il JSON originale dell'opera dal commit
indicato nel manifest e controlla dimensione e SHA-256 prima di usarlo.

La cache dei dettagli conserva il JSON completo per opera, comprese le
stagioni, senza scadenza. In Database si può cambiare il limite predefinito
di 200 MB (1 MB = 1.000.000 byte). Alla riduzione del limite o all'aggiunta
di un documento, Vega rimuove prima i dettagli consultati meno di recente.
Un documento più grande del limite si può consultare durante il caricamento
online. I file immagine seguono la cache immagini dell'app.

### Confini del download Lite

Il manifest e gli asset provengono dalla pubblicazione GitHub di Cinema.
Il downloader costruisce il percorso dei dettagli da commit e ID opera
validati. Un file locale viene accettato solo se dimensione, SHA-256 e ID
coincidono con quelli dello snapshot. Il JSON viene interpretato come dati
del catalogo. L'autenticità di manifest e hash dipende dal controllo della
repo di pubblicazione e da HTTPS.

Una risposta incompleta o alterata può rendere indisponibili i dettagli
dell'opera. La scheda locale resta consultabile. La scrittura temporanea,
il controllo del trasferimento rispetto alla dimensione attesa e il limite
di spazio riducono l'impatto sul dispositivo. I riferimenti di riproduzione
verificati passano al resolver StreamingUnity già installato.

Per Cinema Lite Vega prepara anche le liste indicizzate da `works` durante
l'installazione. Per gli snapshot già installati crea il file derivato al
primo accesso, senza riscaricare il catalogo. Home e ricerca usano gli
indici delle liste per filtri e ordinamenti. Per ogni pagina Lite i
candidati poster vengono letti insieme e passati al selettore immagini
esistente.
Le righe Cinema ricevono i poster già risolti dal catalogo e saltano il
tracciamento di visibilità usato dalle righe provider per l'artwork remoto.
