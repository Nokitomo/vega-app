# Ricerca: presentazione coerente con la Home

## Ambito concordato

- Ricerca Home: solo provider selezionato, nessuna cronologia, apertura con tastiera e collegamenti diretti invariati.
- Ricerca globale: tutti i provider installati, cronologia locale delle query fino a 30 elementi, eliminazione singola o completa.
- Ricerca dei provider solo su invio o selezione di un suggerimento; nessuna ricerca automatica nei provider durante la digitazione.
- Suggerimenti invariati: IMDb, poi fallback OMDb; soglia di due caratteri e debounce di 250 ms.
- Card verticali coerenti con la Home: angoli retti, titoli DM Sans allineati a sinistra e spaziatura condivisa. Immagini, badge, disposizione griglia/lista e caroselli conservati. Nessun cambiamento ai metadata o alle loro preferenze.

## Presentazione

La barra condivisa usa sfondo #23252b, font della Home e accento dal tema. La Home conserva il pulsante Indietro e mostra il provider come contesto; la globale resta una scheda principale, senza un finto pulsante Indietro. La cronologia usa righe rettangolari con cancellazione separata e azione di cancellazione completa nel colore del tema.

I suggerimenti hanno stati di attesa, caricamento e assenza di suggerimenti, con invito a inviare comunque la ricerca. Le risposte obsolete vengono ignorate e i suggerimenti della query precedente non rimangono selezionabili. I servizi sottostanti possono rappresentare indisponibilita di rete come array vuoti: il messaggio non afferma quindi che il catalogo dei provider sia vuoto.

## Risultati e recupero dagli errori

La ricerca globale mantiene l'ordine dei provider installati e visualizza una sezione anche durante il caricamento, in caso di risposta vuota o di errore. Il retry riguarda soltanto il provider fallito; i risultati degli altri restano disponibili. La cache di cinque minuti viene popolata soltanto quando tutti i provider hanno risposto correttamente, incluse le risposte vuote. Vecchie cache prive di uno o piu provider vengono scartate. Le richieste completate dopo l'uscita dalla schermata non aggiornano stato o cache.

Nella lista di ricerca del singolo provider, gli errori vengono distinti dai risultati vuoti. Il retry mantiene i risultati gia caricati e ripete la pagina fallita; la paginazione automatica resta ferma fino al recupero. Le modifiche di presentazione alla lista e alle intestazioni dei caroselli sono circoscritte alla ricerca, con card verticali nello stile della Home.

## Riferimento e differenze intenzionali

Riferimento: report locale `crunchyroll-mobile/05-authenticated-navigation.md` e acquisizioni `search-viewall-ready.png`, `search-cleared.png`, `search-series-viewall-loaded.png` nel progetto di reverse engineering.

Crunchyroll mostra risultati del catalogo durante la digitazione, miniature orizzontali e informazioni diverse. Queste differenze restano intenzionali in Vega: non si dichiara identita 1:1 della ricerca. Non vengono aggiunte richieste per arricchire ogni risultato.

## Verifiche

Verifica automatica completata: `npx tsc --noEmit` e `npm run lint` senza errori o warning; 34 test superati in otto suite (ricerche, recupero errori, Hero, stati Home e filtri archivio).

Test automatici dedicati: `searchScreens`, `searchSuggestionLifecycle`, `searchResultsStates`, `providerSearchRetry`, oltre a `searchSuggestions` per l'ordine delle fonti.

Verifica Android completata il 30 ottobre 2026 su Medium_Phone_API_35, con dati AVD e temporanei su D:, barra Android a tre pulsanti e dev client gia installato (versione nativa 3.3.19, JavaScript del working tree corrente via Metro). Non e stata generata una nuova build nativa: le modifiche riguardano JavaScript/TypeScript.

Controlli eseguiti nell'emulatore:
- Ricerca Home StreamCenter: apertura, tastiera, suggerimenti, invio e risultati del solo provider; assenza di cronologia nella ricerca Home.
- Ricerca globale: apertura senza autofocus, suggerimenti, invio, risultati distinti AnimeUnity/StreamCenter/StreamingUnity, ritorno e ripetizione dalla cronologia.
- Pulsante Altro di AnimeUnity, risultati e passaggio griglia/lista con scorrimento, mantenendo le card esistenti.
- Cancellazione del campo, eliminazione singola e completa della cronologia, invio vuoto senza ricerca.
- Query senza risultati: stato vuoto per ogni provider. Tema Sky applicato a cursore e sezioni, poi ripristinato Vega.
- Testo Android al 130%: barra di ricerca, cronologia e stati vuoti leggibili; ripristinato al 100%. Cambio provider Home verificato con AnimeUnity.

Gli errori isolati dei provider, il retry della pagina fallita, la cache e le risposte obsolete sono verificati con test automatici deterministici; non e stato provocato un guasto dei servizi remoti nell'emulatore. La riproduzione video non fa parte di questa verifica. iOS non verificato in questo ambiente Windows.

Il primo avvio con GPU swiftshader_indirect ha causato un ANR nel renderer Android durante la chiusura dello splash (RenderProxy::destroy). Riavviando lo stesso AVD con GPU host il blocco non si e ripresentato nelle prove delle ricerche; nessuna modifica all'app e stata introdotta per aggirarlo. Il primo giro Jest, eseguito durante boot e bundling, ha superato il timeout standard: ripetizione sequenziale con timeout 30 secondi, 34/34 test superati.

Schermate locali escluse da Git: `.codex/search-verification-20261030/`. I temporanei della sessione su D: possono essere rimossi dopo aver fermato Metro e l'emulatore; l'AVD preesistente va conservato per i test futuri.

## Allineamento delle card di ricerca

Home e caroselli della ricerca globale condividono misure responsive e stile del titolo. Al cambio di larghezza il carosello viene ricreato per ricalcolare l'altezza di immagini e titoli: la posizione orizzontale torna all'inizio dopo una rotazione, evitando il taglio dei titoli dovuto alle misure precedenti. La griglia dei risultati conserva tre colonne sui telefoni e adatta il numero di colonne allo spazio disponibile sui tablet, con poster 2:3, larghezza limitata e spazio tra le card; la modalita lista conserva il poster verticale piccolo e assegna al titolo lo spazio disponibile, senza larghezza fissa. L'intestazione di ricerca permette al titolo di restringersi per mantenere accessibili Indietro e cambio vista. Calendario e archivio conservano la presentazione precedente.

Verifica delle nuove card completata il 30 ottobre 2026 con dev client e Metro: TypeScript e lint senza errori/warning; 34 test in otto suite superati. Phone Medium_Phone_API_35: ricerca Home, globale, Altro, griglia/lista, titoli lunghi e apertura dettagli. Tablet Medium_Tablet_API_35: stessi flussi in verticale e orizzontale, griglia adattiva (4/5 colonne nel dispositivo usato), caroselli senza taglio dei titoli dopo rotazione e tema Sky, poi ripristino Vega. Nessuna modifica a immagini, metadata, preferenze o fallback dei provider.

### Audit tablet aggiuntivo

Prove estese oltre la ricerca: Home e menu provider, elenco provider installati, account (form senza autenticazione), Download, stile sottotitoli, cronologia, preferenze, temi, dettagli ed episodi, preferiti e rotazione. Questo audit non equivale a una certificazione di tutte le funzionalita: accesso account, cast, download effettivo, player esterni e iOS non sono validati.

- Preferiti: 40 titoli reali AnimeUnity ottenuti dalle ricerche Naruto, Dragon Ball e One Piece e inseriti tramite lo store esistente nel dev client, senza modifica del sorgente. Verificati persistenza dei 40 titoli dopo riavvio dell'emulatore, scorrimento fino all'ultima riga, apertura dei dettagli e rimozione/riaggiunta tramite UI (40 -> 39 -> 40). Nessun taglio a destra osservato: 7 colonne in verticale e 11 in orizzontale con rotazione attiva, 5 con menu laterale e rotazione disattivata. Il difetto storico della larghezza calcolata sull'intero schermo e gia corretto da `47ec0fc`: `onLayout` misura lo spazio effettivo dopo il menu laterale. I 40 titoli restano nell'emulatore per ripetere le prove.
- Rotazione tablet: attiva consente portrait/landscape mantenendo la barra inferiore; disattiva richiede portrait e usa il menu laterale quando lo spazio lo permette. Con display Android orizzontale e blocco portrait compare la modalita di compatibilita Android con bande laterali. Durante questo passaggio e stato osservato un ritorno alla Home: anomalia da approfondire su build standalone/dispositivo reale, non attribuita alle card. Opzione ripristinata attiva.
- Download: cartella configurata `/storage/emulated/0/Download/vega` assente; `readDirectoryAsync` fallisce e la pagina rimane sul messaggio di lista vuota. Difetto preesistente: `Downloads.tsx` registra l'errore senza uno stato UI distinto. Non corretto in questo intervento.
- Player: tentativo su ONE PIECE FAN LETTER; con rotazione disattivata ritorno alla Home, con rotazione attiva successiva chiusura dell'intero emulatore (dispositivo scomparso da ADB). Riproduzione NON validata; non ci sono elementi sufficienti per imputare il problema alla RAM, al player o alla GPU. Nessun fix del player incluso.

Acquisizioni escluse da Git in `D:/codex-temp/vega-search-cards-20261030/`: `tablet-adaptive-grid-pair.png`, `tablet-global-fixed-pair.png`, `tablet-watchlist40-pair.png`, `tablet-watchlist-off-bottom-verified.png`, `tablet-favorites-landscape-bottom.png`, oltre alle prove phone e alle altre schermate tablet. AVD e prove conservati su D: per ulteriori verifiche.
