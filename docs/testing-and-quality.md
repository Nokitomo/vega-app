# Testing e Qualita

## Lint

```
npm run lint
```

## Test

```
npm test
```

## Preferenze TMDB

- In Impostazioni > Preferenze > Metadati, salvare una chiave di prova e verificare che AnimeUnity, StreamingUnity e StreamCenter usino la stessa impostazione, senza campi duplicati nei provider. Sostituirla o rimuoverla, riaprire Info e poster, e verificare che i dati vengano recuperati di nuovo senza alterare gli episodi visti e la cronologia.

## Cronologia ed episodi visti

- `Svuota cronologia` e `Elimina selezionati` rimuovono anche il progresso degli episodi dei titoli eliminati. Gli altri titoli conservano il proprio stato.
- La cronologia conserva tutti i titoli senza espellere automaticamente il piu vecchio dopo 100 voci. La Home mostra al massimo 30 card di `Continua a guardare`; `Altro` mostra tutte le voci ancora da guardare.
- La lista `Watch History` calcola il progresso solo delle card renderizzate. La sincronizzazione dei titoli provenienti dai provider controlla un piccolo gruppo per visita, cosi una cronologia lunga non avvia richieste per tutti i titoli insieme.
- `Segna come visto` e `Segna come visti fino a qui` inseriscono o aggiornano una sola card nella cronologia, con l'episodio segnato come riferimento. La card compare in `Continua a guardare` se restano episodi; se la serie e completa resta soltanto nella cronologia. Una riproduzione successiva aggiorna il riferimento.
- Nella scheda della serie, `Riproduci` aggiorna subito episodio, stagione e azione dopo un cambio manuale dello stato visto. Se tutta la serie disponibile e completa, diventa `Riproduci dall'inizio` e avvia il primo episodio; una nuova puntata ripristina il normale target successivo.
- Il menu di pressione prolungata su un episodio offre l'azione per segnare come visti tutti gli episodi disponibili fino a quello selezionato, incluso, anche nelle stagioni precedenti. Il comando si applica subito, senza conferma, e mostra un indicatore durante il caricamento.
- L'azione riusa il catalogo completo quando disponibile; altrimenti carica solo le stagioni necessarie, fino a tre alla volta. Se manca una stagione necessaria, non modifica alcun episodio. Gli speciali in stagione 0 non vengono inclusi automaticamente.
- Smoke test: segnare due episodi manualmente, svuotare la cronologia e riaprire la serie; le barre arancioni devono essere scomparse. Ripetere eliminando un solo titolo dalla Watch History e verificare che un secondo titolo mantenga le barre.
- Smoke test: su una serie con almeno due stagioni, segnare come visti fino a un episodio della seconda stagione. Verificare barra arancione per tutti gli episodi precedenti, assenza della barra per quelli successivi, comportamento identico con ordinamento inverso e corretto stato di `Continua a guardare`.
- Smoke test: ripetere su una stagione avanzata di una serie lunga dopo riavvio dell'app. Verificare assenza di richiesta di conferma, indicatore di caricamento, completamento coerente e nessun episodio segnato parzialmente se il provider non risponde.
- Smoke test: su una serie mai riprodotta, segnare manualmente un episodio e verificare una sola card in cronologia e in `Continua a guardare`, diretta al prossimo episodio. Ripetere con tutti gli episodi completati: la card resta in cronologia ma scompare da `Continua a guardare`. Verificare poi una nuova puntata, una riproduzione successiva e la cancellazione selettiva.
- Prima di riprodurre una puntata StreamCenter, verificare che la scheda e la stagione siano controllate con attesa massima di 1,2 secondi; una puntata nuova entra nella coda del player quando il controllo termina in tempo. Verificare anche il pulsante Riprendi, la ricerca nella stagione, l'ordine inverso e la riproduzione offline con dati salvati.
- Smoke test: senza chiudere la scheda, segnare il primo episodio e verificare che `Riproduci` mostri e apra il secondo. Segnare l'ultimo episodio di una stagione e verificare il passaggio alla stagione successiva; togliere il segno di visto e verificare il ricalcolo. Completare la serie e verificare `Riproduci dall'inizio` e l'avvio del primo episodio.
- Smoke test: creare oltre 100 titoli nella cronologia; verificare che i piu vecchi restino accessibili e che la Home continui a mostrare massimo 30 card, mentre `Altro` ne mostri tutte le idonee.

Per misurare separatamente dev client e APK release locale durante i test di
Home, Info, episodi e poster, seguire [Profilazione Home e Info](performance-profiling.md).

## Note

- Gli errori bloccanti (rossi) e i warning (gialli) vanno corretti prima del commit.
- Gli info possono essere ignorati.
- Per nuove stringhe UI, aggiornare en/it e verificare che la lingua sia consistente.

## Smoke test aggiornamenti provider

- Con provider installato e moduli completi, verificare che dopo 24 ore un controllo automatico o manuale non mostri aggiornamenti se il manifest ha la stessa versione.
- Con una versione piu recente nel manifest, verificare che l'aggiornamento scarichi i nuovi moduli e mantenga impostazioni e provider attivo.
- Con un modulo richiesto mancante o incompatibile, verificare che l'app lo riscarichi; se il download fallisce, la versione installata deve restare invariata.
- Dal Provider Manager, usare il pulsante per riscaricare un provider gia aggiornato e verificare che restino le sue impostazioni.

## Smoke test suggerimenti di ricerca

- Nella ricerca globale digitare almeno due caratteri e verificare la comparsa dei suggerimenti IMDb.
- Selezionare un suggerimento e verificare che `SearchResults` interroghi tutti i provider installati.
- Dalla Home aprire la ricerca, selezionare un suggerimento e verificare che `ScrollList` usi solo il provider attivo.
- Con AnimeUnity, aprire la Home con poster preferiti gia in cache, chiudere e riaprire l'app: le card devono mostrare il poster preferito senza passare dal poster del catalogo. Scorrere le sezioni in orizzontale e verticale e tornare sulle card: nessun lampeggio dovuto a rimontaggi forzati per URL invariati; verificare anche una card con immagine non disponibile e la griglia `ScrollList`.
- Verificare che cancellazione, back Android, invio manuale e assenza di rete non blocchino la ricerca.
- Con `EXPO_PUBLIC_OMDB_API_KEY` configurata, simulare una risposta IMDb vuota e verificare che i suggerimenti provengano da OMDb; senza chiave non deve partire alcuna richiesta OMDb.

## Smoke test cast Android

- Verificare `Preferences -> Player -> Cast Provider` su `native`, `vega` e `wvc`.
- Da Player e da lista server:
  - cast nativo: apertura dialog device, start playback remoto, next/prev da queue quando disponibile.
  - vega cast: generazione codice pairing, apertura receiver web, inserimento codice e riproduzione in browser TV/PC.
  - vega cast fallback: con API pairing non disponibile, copia link sessione diretto e apertura receiver via URL.
  - vega cast sync: durante riproduzione da receiver verificare aggiornamento minutaggio/episodio in cronologia app.
  - vega cast skip intro: su contenuti con AniSkip disponibile verificare comparsa pulsante e salto all'end dell'intro.
  - fallback: se cast nativo non parte, prompt di conferma per aprire WVC.
  - WVC: apertura app e avvio stream con headers/sottotitoli quando disponibili.
- Durante cast nativo da Player, verificare aggiornamento progresso episodio in cronologia/cache.

## Smoke test Player Android

- Da player nativo app (non Webview), attivare fullscreen e verificare che status/navigation bar Android siano nascoste.
- In fullscreen player nativo, mettere app in background e tornare in foreground: verificare che status/navigation bar restino nascoste senza dover togglare il pulsante fullscreen.
- Uscire dal fullscreen player nativo: verificare ripristino corretto delle system bars.
- Su una serie, aprire il drawer episodi dal chevron laterale: verificare animazione, chiusura tramite backdrop/X, thumbnail con fallback, episodio attivo e scorrimento automatico.
- Aprire il drawer mentre i controlli sono visibili: cast, blocco e fullscreen devono scomparire e nessun comando del player deve restare sopra o ricevere tocchi attraverso il drawer.
- Con una serie multi-stagione, cambiare lista nel drawer e verificare caricamento on-demand e riproduzione dell'episodio selezionato senza perdere provider, header o sottotitoli.
- Con controlli nascosti e gesto 2x attivo, tenere premuto sul video: verificare feedback aptico/visivo, velocita 2x e ripristino della velocita precedente al rilascio.
- Ripetere il gesto muovendo il dito oltre la soglia e con l'opzione 2x disattivata: in entrambi i casi la velocita non deve cambiare.
- Trascinare la seekbar su stream diretti, HLS (inclusi URL playlist senza estensione) e stream con header: verificare il timestamp di destinazione, la prosecuzione fluida del seek e l'assenza di richieste o placeholder per thumbnail.
- Con i controlli nascosti, tenere premuto fino all'attivazione del 2x e spostare il dito senza sollevarlo: il 2x deve restare attivo fino al rilascio. Con i controlli visibili non deve attivarsi.
- Durante il trascinamento, tornare vicino al punto di partenza: verificare snap visivo/aptico; su un episodio con AniSkip verificare il segmento marcato nella seekbar.
- Eseguire pinch-to-zoom sul video e verificare che non interferisca con tap, doppio tap, luminosita/volume o pressione prolungata 2x.
- Lasciare scomparire automaticamente i controlli, quindi toccare centro, lato sinistro e lato destro del video: ogni singolo tap deve mostrare i controlli; ripetere nella fascia inferiore per verificare che l'intera superficie abbia lo stesso comportamento.
- Disattivare solo gli swipe verticali lasciando attivo il gesto 2x: luminosita/volume devono restare disattivati, mentre la pressione prolungata deve continuare ad attivare e ripristinare il 2x.

## Smoke test WebView/GeckoView

- Android:
  - Da Info -> menu -> `Open in Web`, verificare apertura pagina nello screen Webview.
  - In Webview con auto-rotate OFF, verificare che lo schermo non ruoti.
  - In Webview con auto-rotate ON, verificare che lo schermo ruoti correttamente.
  - In Webview verificare che la tabbar inferiore dell'app sia nascosta.
  - Verificare che link/popup in nuova finestra vengano aperti esternamente senza chiudere lo screen corrente.
  - Verificare che pagine con JavaScript client-side funzionino correttamente.
  - Verificare che AdGuard risulti installata e attiva di default (almeno su una pagina con ads/banner noti).
  - Aprire pannello AdBlock dalla barra top Webview:
    - toggle OFF: AdGuard disattivata e navigazione invariata.
    - toggle ON: AdGuard riattivata.
    - "Riprova installazione": tenta reinstall e, se riuscita, ricarica la pagina corrente.
  - In assenza rete o con AMO non raggiungibile, verificare che lo screen Webview continui ad aprirsi senza crash (degrado senza adblock).
  - Durante fullscreen video del provider in Webview verificare:
    - assenza tabbar inferiore.
    - assenza header superiore ("Webview", open-in-browser, close).
    - status bar e navigation bar Android nascoste.
    - lock landscape finche il contenuto resta fullscreen.
  - Durante fullscreen in Webview, mettere app in background e poi tornare in foreground: verificare che status/navigation bar restino nascoste finche il provider resta fullscreen.
  - Uscendo dal fullscreen provider, verificare ripristino header e system bars.
  - Simulare errore fatale init Gecko (o disabilitare feature flag) e verificare fallback a WebView legacy.
- iOS:
  - Verificare che lo screen Webview continui a usare `react-native-webview` con UX invariata.
