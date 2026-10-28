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

Questa implementazione non costituisce una replica pixel-perfect verificata: mantiene marchio e quattro destinazioni Vega; non introduce Store, Premium o controlli senza funzione equivalente. La home usa ora Atyp Bold e DM Sans dai riferimenti locali (provenienza e limiti di distribuzione in `assets/fonts/README.md`). La revisione riguarda la home, non le altre schermate.

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


## Checklist del confronto con il campione smartphone

Riferimenti: `05-authenticated-navigation.md`, `08-reconstruction-notes.md` e
`artifacts/home-hero-swipe-before.png` della ricerca Crunchyroll mobile 3.126.0.
La parita va verificata a stessa risoluzione, densita e scala caratteri; il report
non definisce tutte le misure o tutti gli stati possibili dell'app originale.

1. Tipografia: applicati Atyp Bold a titoli e intestazioni, DM Sans a testi e
   controlli; sinossi 14/20 dp, metadati 12 dp, intestazioni 20/26 dp. Font locali
   caricati prima della navigazione, con fallback in caso di errore. L'effetto di
   orientamento attende che il navigator sia pronto.
2. Hero: gradienti rivisti, logo limitato a 78 dp sul telefono e 100 dp sul tablet,
   spaziature uniformate. Il layout del tablet limita larghezza dei testi e
   altezza dell'artwork in orizzontale; in verticale lascia piu spazio all'immagine.
   Il crop resta cover centrato: non sono disponibili punti focali affidabili.
3. Artwork: per poster/fallback e immagini effettivamente verticali, il blocco
   titolo ha un fondo nero che evita la sovrapposizione diretta con scritte.
   Non e OCR: non riconosce ogni scritta incorporata e non elimina ogni possibile
   duplicazione. Priorita di servizi, lingue e immagini selezionate invariate.
4. Controlli: CTA e bookmark conservano target di almeno 44 dp, indicatori con
   larghezza adattiva e target verticale ampliato. Timer 10,5 s, pausa, selezione,
   preparazione completa e Riduci movimento conservati. La dissolvenza di 240 ms
   resta un'approssimazione, non una misura certificata del riferimento.
5. Sezioni: tipografia e azione Altro uniformate, poster 2:3; larghezza delle card
   adattiva sul tablet, aggiornamento esplicito delle liste dopo rotazione. Stessa
   presentazione in Continua a guardare, senza cambiare progresso o azioni.
6. Shell: marchio Vega con nuova tipografia, font delle etichette inferiori
   coerente. Preferenze di visibilita delle etichette e quattro destinazioni
   mantenute. Il selettore provider resta un adattamento esclusivo di Vega.
7. Verifica: confronto visivo del campione smartphone e controlli su telefono e
   tablet, anche ruotato e con font al 150%. Gli stati privi di evidenza nel report
   e il layout tablet non possono essere dichiarati identici a Crunchyroll.

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

## Rifinitura responsive (28 ottobre 2026)

- TypeScript (`npx tsc --noEmit`) ed ESLint (`npm run lint`) senza errori o warning.
  58 test passati nelle sette suite homeResponsiveLayout, heroArtwork,
  heroMetadataFailure, providerSheet, sliderSkeleton, continueWatchingHome e
  continueWatchingFixes. Corretto anche il passaggio di `key` nell'helper del test
  del hero: l'avviso React non proveniva dall'app.
- Medium_Phone_API_35: home con AnimeUnity, StreamingUnity e StreamCenter,
  cambio provider, apertura ricerca, dettaglio dalla CTA e ritorno. Controllati
  loghi larghi e alti, fallback testuale, sinossi corta/lunga e font al 150%.
  Le intestazioni lunghe si troncano conservando l'azione Altro; il hero cresce
  quanto necessario senza sovrapporre testo e pulsanti.
- Medium_Tablet_API_35: 1280x800 e 800x1280 dp, rotazione del sensore emulato,
  scroll, ridimensionamento delle card, etichette delle schede e pannello provider
  centrato con larghezza massima 560 dp. Controllati anche caratteri al 150%.
  Verificati ricerca, apertura del dettaglio e ritorno, poi rotazione inversa.
  Il tablet usa una copia isolata dell'AVD in `D:/codex-temp/vega-tablet-ui-avd`,
  dev client gia disponibile e bundle Metro corrente. Nessun prebuild.
- Durante gli avvii di sviluppo si sono verificati timeout di Metro e un ANR
  della schermata di errore DevLauncher. Riavviato Metro e completata la
  compilazione della variante Hermes richiesta dal client, l'avvio pulito e i
  percorsi finali sono riusciti. Usato inoltro ADB della porta 8081 sul tablet.
  Questi tentativi non sono una misura delle prestazioni di una build release.
- Gli screenshot `refined-*.png` sono in `.codex/screenshots/cruncy-ui/`, ignorati.
  Il dev client Android installato resta 3.3.19: l'avviso di aggiornamento 3.3.20
  riguarda il binario nativo, non indica un rollback del codice JavaScript.
- La verifica riguarda la presentazione e i percorsi interessati, non una nuova
  certificazione di player, download, cast o iOS. Nessun cambio ai servizi o alle
  preferenze dei metadati. Non sono stati misurati miglioramenti di FPS in questa
  sessione; la diagnostica eventualmente attiva resta quella opt-in esistente.

### Limiti residui

La fedelta pixel per pixel richiede campioni equivalenti per tutti gli stati,
mentre la ricerca fornita riguarda soprattutto lo smartphone. Restano da validare
iOS e lettori di schermo. La separazione dei poster non riconosce tutte le scritte
incorporate; loghi molto scuri forniti dai servizi possono avere contrasto ridotto.
Per eliminare questi casi servono informazioni affidabili sull'artwork senza
alterare le priorita concordate. Il timer e la dissolvenza restano approssimazioni.
Prima della distribuzione dei font di riferimento occorre disporre delle relative
licenze: l'estrazione dall'APK documenta la provenienza, non i diritti di riuso.


### Hero: recupero cache e deduplicazione (2026-10-28)

- Le risposte senza titolo/nome o sinossi non sono idonee alla presentazione
  hero: non vengono persistite e i vecchi record parziali SQLite/MMKV vengono
  ignorati. Non si presume che un campo assente sia necessariamente un errore
  remoto: un'opera realmente priva di sinossi resta disponibile nelle righe e
  nel dettaglio, ma non viene presentata nel carosello.
- Logo e generi restano facoltativi. Servizi, lingue, ordine delle sorgenti e
  fallback di artwork/metadati restano quelli esistenti. Un aggiornamento che
  perde sinossi, logo o tag gia disponibili non sovrascrive la scheda precedente:
  React Query conserva il risultato precedente e gestisce due tentativi aggiuntivi
  con attesa crescente. Nessuna fusione arbitraria fra campi di snapshot diversi.
- La freschezza non e piu infinita: 24 ore per risultati ricchi; 5 minuti se manca
  il logo o l'arricchimento ha generato un errore. La scadenza abilita il recupero
  ai normali eventi React Query (rimontaggio/riconnessione), senza polling continuo.
- Senza una prima scheda pronta, dopo 45 secondi di attesa in primo piano il
  carosello sospende la preparazione e offre Riprova; le righe restano utilizzabili.
  La scadenza riguarda la UI, non annulla le richieste interne dei provider.
  Una scheda gia visibile resta invece disponibile mentre si prepara la successiva.
- Deduplicazione prima del limite di sei slide: ID delle opere nelle route AU/SU,
  route StreamCenter decodificate, ID AniList/MAL e collegamenti delle varianti.
  Per SU le stagioni della stessa serie valgono una sola opera nel hero.
  Si conserva il primo Post con la sua navigazione e le sue varianti; nessuna
  modifica a cataloghi, dettaglio o preferenze doppiaggio. Titoli uguali da soli
  non sono prova di identita (remake e omonimi restano distinti). Opere senza
  alcuna identita condivisa non possono essere accorpate con certezza.


Verifiche del fix:

- 44 test passati in sette suite: heroMetadataCache, heroMetadataFailure,
  heroPolicy, heroArtwork, homeResponsiveLayout, providerSheet e streamCenterMetadata.
  Coprono anche cache parziale preesistente, rifiuto degli aggiornamenti peggiorativi,
  fallback dopo errore dell'arricchimento, attesa delle immagini/loghi, timeout e
  riprova, navigazione del carosello, varianti transitive, omonimi e route aggregate.
- TypeScript ed ESLint senza errori o warning. Il primo controllo TypeScript ha
  rilevato import Jest mancanti nel nuovo test, corretti. Un primo test ha avuto
  timeout durante il blocco dell'ambiente ADB; superato dopo il ripristino senza
  aumentare il timeout del test. Eliminato un import dinamico ridondante del
  ProviderManager, gia importato staticamente, per eseguire i test con Jest.
- Prove su Medium_Phone_API_35 con dev client installato 3.3.19 e bundle del
  branch corrente via Metro. Nessun prebuild o cambio alle preferenze dei servizi.
  Svuotati i 26 record SQLite heroMetadata/heroMetadata:sourceAware e l'istanza
  MMKV cache a processo fermo, conservando gli altri record SQLite e gli archivi
  impostazioni, secure e provider_kv. E un test senza cache hero dell'app, non una
  reinstallazione e non un reset di tutte le cache interne dei provider/CDN.
- StreamingUnity: ricostruzione hero con logo, generi e sinossi; CTA verso dettaglio
  ed episodi e ritorno. StreamCenter: caricamento lento, comparsa di Riprova,
  recupero con logo e sinossi e avanzamento del carosello. AnimeUnity: caricamento
  senza cache hero, Riprova e recupero con titolo, tag e sinossi; verificato anche
  il fallback testuale previsto quando il logo non e disponibile e il ritorno
  dalla schermata Home di Android, con carosello ancora funzionante.
- L'ambiente inizialmente aveva migliaia di processi ADB bloccati diretti al nostro
  emulatore; ripristinato solo quel collegamento e riavviato Medium_Phone_API_35.
  Un avvio del dev launcher ha avuto timeout prima che Metro completasse il bundle.
  Rimangono avvisi preesistenti (require cycle downloader/notifiche, SafeAreaView,
  architettura Legacy), errori intermittenti del manifest remoto e messaggi sulla
  cartella download non esistente nel dispositivo di test. Nessuno riguarda il
  codice modificato. Non sono stati modificati downloader, player o cast.
- Screenshot e registrazioni in `.codex/screenshots/hero-fix-20261028/`, ignorati
  da Git. La registrazione StreamingUnity iniziale comprende il dialogo di
  aggiornamento del dev client. Nessun benchmark di velocita; iOS non verificato.
