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

I punti 2 (robustezza carosello), 3 (transizioni/indicatori/ritorno in cima) e 4 (matrice dispositivi/provider/accessibilita) restano da completare in quest'ordine, con verifica e commit separati. L'analisi estetica finale deve includere il selettore provider nell'header.
