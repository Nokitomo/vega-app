# Testing e Qualita

## Lint
```
npm run lint
```

## Test
```
npm test
```

## Note
- Gli errori bloccanti (rossi) e i warning (gialli) vanno corretti prima del commit.
- Gli info possono essere ignorati.
- Per nuove stringhe UI, aggiornare en/it e verificare che la lingua sia consistente.

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
- Trascinare la seekbar su stream diretti, HLS (inclusi URL playlist senza estensione) e stream con header: verificare timestamp, comparsa rapida della thumbnail, prosecuzione del seek anche quando la thumbnail non e disponibile e assenza di blocchi durante richieste rapide.
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
