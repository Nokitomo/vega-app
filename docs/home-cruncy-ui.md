# Home: revisione visiva cruncy-ui

Il branch `cruncy-ui` introduce la prima revisione della home smartphone, basata sulla ricerca locale `C:/dev/app_streaming_kotlin_compose/docs/research/crunchyroll-mobile/`, in particolare `05-authenticated-navigation.md`, `08-reconstruction-notes.md` e lo screenshot `artifacts/home-hero-swipe-before.png`.

## Presentazione

- Hero a tutta larghezza, gradiente nero, logo/titolo, generi e sinossi su tre righe.
- CTA arancione (#FF640A), bookmark circolare collegato alla lista Vega.
- Fino a sei titoli distinti del provider, indicatori selezionabili, swipe senza attraversamento dei bordi e avanzamento ciclico ogni 10,5 secondi. La rotazione si ferma fuori dalla home, durante ricerca/drawer e quando si scorre oltre l'inizio.
- Barra superiore fissa con marchio Vega, selettore provider (secondo le preferenze esistenti) e ricerca con suggerimenti.
- Poster squadrati e piu grandi nelle sezioni della home, intestazioni bianche. Le altre istanze di Slider mantengono lo stile precedente.
- Barra inferiore grigio scuro e selezione arancione nella home; destinazioni Vega invariate.

## Compatibilita e limiti

Provider, cache, aggiornamento tramite trascinamento, continua a guardare e navigazione al dettaglio restano quelli di Vega. Il pulsante Play continua ad aprire il dettaglio, come prima della revisione. Il bookmark usa lo stesso storage della lista esistente. Le immagini e i metadati provengono dai provider: non sono fissati ai titoli del campione Crunchyroll.

Questa implementazione non costituisce una replica pixel-perfect verificata: mantiene marchio, font di sistema e quattro destinazioni Vega; non introduce Store, Premium o controlli senza funzione equivalente. La revisione riguarda la home, non le altre schermate.

## Verifica locale

Gli screenshot di revisione vengono salvati in `.codex/screenshots/cruncy-ui/`, directory esclusa da Git. Il test Android usa il dev client su Medium_Phone_API_35. Poiche C: non dispone dello spazio richiesto dall'emulatore, la sessione di verifica usa una copia dei dati dello stesso AVD in `D:/codex-temp/vega-cruncy-ui-avd`, senza modificare l'originale, su porta ADB 5556.

### Esito della sessione

- Screenshot reali: `home.png` e `home-scroll.png` nella cartella locale indicata sopra.
- Dev client debug gia disponibile, collegato al bundle corrente di Metro; non e stata eseguita una nuova build nativa.
- AnimeUnity installato nel profilo isolato per popolare il catalogo. Verificati ricerca (apertura/chiusura), scroll con toolbar fissa e bookmark (aggiunta e successiva rimozione), apertura del dettaglio dalla CTA e ritorno alla home.
- Controlli: TypeScript, ESLint e test di regressione `heroMetadataFailure.test.tsx`. Il test usa timeout 60 secondi per la macchina sotto carico durante l'avvio Android.
- Prima revisione salvata nel commit `f315073`; screenshot esclusi da Git. iOS e riproduzione video non verificati in quella sessione.

## Completamento in quattro passi

### Punto 1 — stati e Continua a guardare

- Continua a guardare usa poster squadrati della stessa larghezza delle sezioni, intestazione bianca, testo allineato a sinistra e progresso arancione. Conserva navigazione al dettaglio, target di ripresa, selezione multipla e rimozione dalla sola sezione.
- Gli skeleton delle sezioni home hanno le stesse dimensioni delle card caricate; le altre istanze Slider conservano il layout precedente.
- Vuoto ed errore sono distinti; l'errore offre Riprova usando il refresh esistente. Un errore di aggiornamento non nasconde eventuali poster gia disponibili. La home ora inoltra alle righe gli errori di categoria. Nessun messaggio di errore globale duplicato sotto le sezioni.
- Rimosso il margine negativo della prima sezione, per evitare sovrapposizioni con Continua a guardare.
- Verifiche: TypeScript e lint senza problemi; 40 test in cinque suite (interazioni Continua a guardare, progressi/ripresa, refresh, skeleton e riconciliazione sezioni).
- Emulatore Medium_Phone_API_35: controllo visivo dei componenti reali con fixture temporanea in memoria per cronologia, caricamento, vuoto ed errore. Catture `step1-qa-cards.png` e `step1-qa-states.png` nella directory screenshot ignorata. Harness rimosso prima del commit; non rappresenta un test end-to-end del provider. Prova aggiuntiva del catalogo reale dopo il ripristino.
- Catalogo reale: verificati scorrimento verticale con toolbar fissa, scorrimento orizzontale dei poster e apertura del dettaglio di una card. Evidenze locali `step1-real.png`, `step1-nav.png` e `step1-return.png`. Il dev client installato riporta 3.3.19/build 178, mentre i sorgenti sono 3.3.20/build 179: Metro aggiorna JavaScript, non la versione nativa; da qui l'avviso di aggiornamento.

### Punto 2 — robustezza del carosello

- La selezione segue il link del titolo quando le sezioni si riordinano; se il titolo scompare, torna a una slide valida.
- Lo store associa il hero al contesto del provider (inclusa la revisione dell'estensione). Il carosello si ricrea al cambio contesto, senza interrogare i metadati del hero precedente con il nuovo provider.
- Un errore di una slide secondaria esclude quella slide senza invalidare il hero principale. I fallimenti vengono ricordati nella sessione per evitare cicli; il refresh manuale consente un nuovo tentativo.
- Le immagini provano tutti i candidati, incluso il poster del catalogo. Gli eventi tardivi di un'immagine precedente non fanno fallire la slide corrente. Se i metadati sono ancora in caricamento, il fallimento del poster preliminare non esclude il titolo. Rimosso il placeholder remoto; il fondo di caricamento e locale.
- Rotazione sospesa anche con app in background; alla riapertura parte un nuovo intervallo completo. Restano le pause per ricerca, drawer, scorrimento e caricamento metadati.
- Verifiche: TypeScript e lint senza errori o warning; 15 test tra regressioni hero, interazioni Continua a guardare e riconciliazione sezioni. Otto casi del hero coprono errori, fallback, eventi tardivi, riordinamento/rimozione, contesto provider, background, ricerca, attesa metadati e recupero dopo refresh.
- Emulatore: catalogo reale, selezione tramite indicatori, swipe al bordo finale, pausa in background (slide 3 prima/dopo) e ripresa della rotazione. Evidenze ignorate in Git: `step2-top.png`, `step2-boundary.png` e dump `step2-before.xml`, `step2-after.xml`, `step2-resumed.xml`. Errori di rete e cambio contesto sono verificati dai test controllati; la matrice di provider reali resta nel punto 4.

### Punto 3 — movimento e ritorno in cima

- Il segmento attivo si riempie in arancione durante lo stesso intervallo di 10,5 secondi che governa l'avanzamento. Durante le pause resta arancione pieno; alla ripresa il timer e il riempimento ripartono insieme.
- Le immagini caricate compaiono con una dissolvenza di 240 ms eseguita dal driver nativo. La durata e una scelta di implementazione, non una misura ricavata dal report Crunchyroll. Gli eventi di caricamento arrivati dopo la rimozione dell'immagine vengono ignorati.
- La preferenza di sistema Riduci movimento disattiva dissolvenza e riempimento animato, mantenendo selezione e navigazione.
- Un secondo tocco sulla scheda Home gia selezionata riporta la FlatList in cima tramite `useScrollToTop`; il normale ritorno da un'altra scheda conserva la posizione.
- Emulatore: verificati ritorno in cima (`step3-scrolled.png`, `step3-top.png`) e riempimento crescente sulla stessa slide (`step3-progress-start.png`, `step3-progress-later.png`). Catture nella cartella ignorata. La dissolvenza e verificata dai test di ciclo di vita; i campioni statici non ne misurano la fluidita.
- Undici test coprono carosello e caricamento delle immagini, inclusi eventi tardivi, caricamenti duplicati e riduzione del movimento. TypeScript e lint completati senza errori o warning prima del commit.

### Punto 4 — matrice di verifica completata su Android

- Regressione ampliata: 70 test superati in 10 suite (hero, artwork, Continua a guardare, refresh, skeleton, riconciliazione sezioni, ProviderImage e riuso del contesto provider).
- Android Medium_Phone_API_35: prova con densita 540 (larghezza equivalente a 320 dp) e `font_scale=1.5`, ripetuta dopo arresto completo e riapertura dell'app. CTA, bookmark, indicatori, intestazioni e poster rimangono utilizzabili; i titoli delle card occupano piu righe. Evidenze finali `step4-cold-small3.png` e `step4-cold-small-scroll.png`. Il contenuto sotto la barra fissa resta raggiungibile scorrendo.
- Il cambio di densita a caldo aveva mantenuto temporaneamente dimensioni obsolete nel dev client: per questo la verifica finale usa un avvio completo. Ripristinati densita fisica 420 e font scale 1.0 al termine. Durante la sessione Metro si e arrestato e il dev launcher ha mostrato errore di connessione/ANR; dopo riavvio di Metro e dell'app il bundle si e caricato. Nessuna modifica al codice per questo problema dell'ambiente di sviluppo.
- Installato StreamingUnity 1.0.32 nel solo profilo QA e verificato il passaggio da AnimeUnity alla sua home con catalogo reale (`step4-streamingunity.png`). La CTA apre la schermata dettaglio; la cattura `step4-streamingunity-detail.png` mostra ancora lo skeleton, quindi non certifica il completamento dei metadati ne la riproduzione. La prova a caratteri grandi usa il catalogo StreamingUnity.
- Accessibilita: controllo statico di ruoli/etichette per provider, ricerca, bookmark e indicatori e degli stati selezionati. La riduzione del movimento e coperta dai test. Non eseguita una sessione completa con TalkBack/VoiceOver: questa verifica non costituisce una certificazione di accessibilita.
- TypeScript (`npx tsc --noEmit`) ed ESLint (`npm run lint`) completati senza errori o warning prima del commit. Nessuna ulteriore modifica al codice necessaria per i casi controllati del punto 4.
- iOS: non verificato, come concordato. L'utente dispone di un iPhone, ma non e stata ancora preparata/installata una development build iOS di Vega. I test React non sostituiscono una prova sul runtime iOS. Restano fuori da questa matrice riproduzione video e verifica esaustiva di tutti i provider.

## Confronto estetico finale: rifiniture consigliate

Il selettore provider e ora a destra, immediatamente prima della ricerca, con icona a livelli e area toccabile 44 dp. Apre un pannello modale dal basso con sfondo #141519, selezione arancione, lista scorrevole e chiusura tramite X, area esterna o Indietro Android. Il pannello rispetta safe area e Riduci movimento. Restano le preferenze persistite (con etichette aggiornate), il gesto dal bordo sinistro, la scelta del provider e della sorgente autore, e la pausa del carosello durante il menu. Il nome interno ProviderDrawer e le chiavi delle preferenze sono mantenuti per compatibilita.
Restano differenze visibili rispetto al campione: font/pesi delle intestazioni, posizione verticale e dimensioni dei loghi dei titoli, spazio tra indicatori e prima sezione, e icone/etichette della barra inferiore. Inoltre alcuni poster del catalogo contengono gia il titolo e producono una duplicazione visiva quando sopra viene mostrato il logo. La scelta artwork del provider va considerata nella rifinitura, senza fissare immagini o titoli del campione.

Le quattro destinazioni Vega, l'assenza del banner Premium e i metadati disponibili nei provider restano differenze funzionali rispetto a Crunchyroll. Non vanno aggiunte destinazioni o azioni fittizie per simulare la parita. La home e vicina nella struttura, ma non e ancora una replica estetica 1:1 verificata.

## Hero: presentazione completa e preparazione anticipata

Il carosello distingue la slide richiesta da quella visibile. Al primo avvio mostra uno skeleton finche la query completa dei metadati e il caricamento nativo dello sfondo e del logo selezionati sono terminati. Durante un cambio conserva la slide precedente, incluse le azioni legate al suo titolo. Gli indicatori seguono la slide effettivamente visibile e il timer riparte dopo la presentazione.

Dopo la prima presentazione prepara una sola slide successiva. Non avvia il pre-caricamento successivo durante background, ricerca, drawer o quando la home non e attiva. Le card preparate sono escluse dai tocchi e dall'accessibilita. Richieste gia partite possono terminare nella cache React Query. Una selezione rapida sostituisce la preparazione precedente senza pubblicarne gli eventi tardivi.

Restano invariati query, merge Cinemeta, priorita artwork/lingua, fallback del logo e navigazione. Un logo assente dopo la risoluzione usa il titolo testuale; durante il recupero asincrono del logo la card resta in preparazione. Il pre-caricamento non riduce la latenza di rete della prima slide: evita presentazioni parziali e anticipa il lavoro per le successive.

Verifica Android su Medium_Phone_API_35: arresto del processo e rimozione delle sole cache QA (SQLite dei metadati, MMKV cache, cache immagini/HTTP e file provider), mantenendo provider installati e impostazioni. Il normale comando Cancella cache non elimina tutte queste copie. Controllati AnimeUnity, StreamingUnity e StreamCenter, navigazione al dettaglio e cambio slide. Evidenze in `.codex/screenshots/cruncy-ui/hero-*.png` e video locale, esclusi da Git. iOS resta non verificato.


## Lista delle differenze residue rispetto al campione smartphone

Riferimenti: `05-authenticated-navigation.md`, `08-reconstruction-notes.md` e
`artifacts/home-hero-swipe-before.png` della ricerca Crunchyroll mobile 3.126.0.
La parita va verificata a stessa risoluzione, densita e scala caratteri; il report
non definisce tutte le misure o tutti gli stati possibili dell'app originale.

1. Tipografia: famiglia, pesi, dimensioni, interlinea e troncamenti di titoli,
   metadati, sinossi, CTA e intestazioni. Vega usa ancora font di sistema.
2. Hero: rifinire altezza, ritaglio/focalizzazione dell'immagine e gradienti
   superiore/inferiore, allineamento e dimensione massima del logo, distanze tra
   logo, metadati, sinossi, azioni e indicatori. Nel campione il gradiente superiore
   assicura contrasto alle icone anche sopra immagini chiare.
3. Artwork: gestire visivamente immagini che contengono gia il titolo senza
   sovrapporre un secondo titolo. Non cambiare implicitamente le priorita dei
   servizi o delle lingue; serve una strategia basata su dati affidabili, non
   sull'ipotesi che tutti i poster siano privi di scritte.
4. Controlli del hero: verificare geometria, spessore icone, bordi del bookmark,
   segmenti/progresso e transizioni. Il timer e i bordi sono gia implementati;
   la dissolvenza da 240 ms non e una misura certificata del riferimento.
5. Sezioni: confrontare margine dopo indicatori, intestazioni, azione Altro,
   dimensioni/aspect ratio e distanza delle card, titoli e badge; confrontare
   anche Continua a guardare e i relativi progressi con evidenze equivalenti.
6. Shell: rifinire proporzioni del marchio Vega, altezza toolbar, safe area e
   barra inferiore (icone, dimensioni, spaziature, etichette). Le etichette restano
   soggette alla preferenza Vega e le quattro destinazioni non diventano cinque.
7. Verifica finale: confronto visivo con screenshot equivalenti in cima e dopo
   scroll, su piu dimensioni/font, con loghi larghi/alti/assenti e nomi lunghi;
   controllare caricamento, vuoto, errore, menu e ritorno dal dettaglio. Gli stati
   privi di evidenza nel report non possono essere dichiarati identici.

Differenze intenzionali: brand Vega, selettore provider, cataloghi/metadati,
assenza di Store/Premium e CTA che apre il dettaglio invece di avviare direttamente
l'episodio. Non sono rifiniture estetiche: copiarle richiederebbe modificare le
funzionalita, fuori dallo scopo concordato. Il riferimento ha inoltre il controllo
Cast nella toolbar: non va aggiunta un'icona senza una funzione reale collegata.


## Verifica del selettore provider

- TypeScript ed ESLint senza errori/warning; 18 test passati nelle suite
  providerSheet, heroMetadataFailure e searchSuggestions. Coperti selezione di
  provider omonimi di autori diversi, compatibilita legacy, chiusure senza cambio
  provider, Riduci movimento e regressioni del carosello/ricerca.
- Medium_Phone_API_35: apertura, cambio StreamCenter -> StreamingUnity, spunta al
  ritorno nel pannello, chiusura con X, Indietro e tocco esterno, ricerca ancora
  associata al provider selezionato. Verifica conclusiva dopo arresto completo:
  un ricaricamento a caldo del dev client aveva lasciato un residuo della modale,
  non riprodotto nell'avvio pulito. Nessuna modifica nativa o ai provider.
- Screenshot ignorati: `provider-sheet.png`, `provider-sheet-selected.png`,
  `provider-menu-home.png`, `provider-menu-search.png`, `provider-menu-back.png`,
  `provider-menu-close.png` in `.codex/screenshots/cruncy-ui/`.
- iOS, TalkBack/VoiceOver e la matrice completa di dimensioni/font non verificati
  per questo intervento; il gesto dal bordo conserva il riconoscitore precedente.
