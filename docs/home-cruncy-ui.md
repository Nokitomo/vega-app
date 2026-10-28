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

Resta il punto 4 (matrice dispositivi/provider/accessibilita), seguito dall'analisi estetica finale, che deve includere il selettore provider nell'header.
