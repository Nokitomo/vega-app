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

## Smoke test WebView/GeckoView
- Android:
  - Da Info -> menu -> `Open in Web`, verificare apertura pagina nello screen Webview.
  - Verificare che link/popup in nuova finestra vengano aperti esternamente senza chiudere lo screen corrente.
  - Verificare che pagine con JavaScript client-side funzionino correttamente.
  - Simulare errore fatale init Gecko (o disabilitare feature flag) e verificare fallback a WebView legacy.
- iOS:
  - Verificare che lo screen Webview continui a usare `react-native-webview` con UX invariata.
