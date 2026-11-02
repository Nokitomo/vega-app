# Browser e verifica anti-bot: presentazione

Intervento UI del 2 novembre 2026 sul branch `cruncy-ui`.

## Modifiche

- WebView: font della Home, intestazione senza margine superiore fisso,
  safe area su tutti i lati tranne in fullscreen, controlli con padding
  maggiore. Pannello AdBlock con superfici #141519/#23252b, accento del tema,
  larghezza limitata alla finestra e posizione sotto l'intestazione.
- WafWebViewDialog: safe area, tipografia condivisa, titolo su due righe,
  descrizione su tre, pulsanti di almeno 48 punti e superfici coerenti.
- Il contenuto dei siti, script iniettati, whitelist, user agent, cookie,
  risoluzione URL, timer, coda delle richieste e callback non cambiano.

Il browser utente resta disabilitato per default nella configurazione Expo:
i link continuano ad aprirsi esternamente. La verifica anti-bot e indipendente.
Non sono stati modificati flag di progetto, networking o moduli nativi.

## Verifiche

- `npx tsc --noEmit` e `npm run lint`: nessun errore o warning finale.
- Suite completa: 67 suite, 316 test superati. Resta il messaggio preesistente
  di deprecazione Clipboard nel test del pannello download.
- Test browser: apertura esterna, chiusura, toggle AdBlock, fullscreen,
  errore Gecko non fatale/fatale, fallback Legacy, flag disabilitato.
- Test WAF: reload, HTML/cookie/URL/user-agent restituiti, completamento unico,
  annullamento senza perdere la richiesta successiva, timeout e cookie atteso.
- Confronto sintattico dei callback UI invariato rispetto a HEAD precedente.
- Medium_Phone_API_35: caricamento pagina di esempio nella WebView standard,
  chiusura; WAF con pagina di esempio, ricarica, Fatto (HTML restituito),
  annullamento Android (WAF_DIALOG_CANCELLED). Non e stata simulata una prova
  CAPTCHA reale e non si certifica il superamento di challenge di terze parti.

Per la verifica browser e stato avviato Metro separatamente sulla porta 8082
con EXPO_PUBLIC_VEGA_USER_WEBVIEW_ENABLED=true nel solo processo di test.
Il dev client installato non contiene VegaGeckoView: il tentativo Gecko ha
restituito un errore di componente nativo assente. La prova visiva e quindi
limitata alla WebView standard; Gecko/AdBlock/fullscreen sono coperti dai test
dei callback, non da una verifica del motore nativo. La preferenza Gecko
originale (true) e la sessione Metro normale 8081 sono state ripristinate.

Screenshot non versionati in `D:/codex-temp/final-ui-20261102/`:
`browser-final.png`, `browser-closed.png`, `waf-phone.png`, `waf-reloaded.png`.
iOS e tablet non verificati in questo intervento.
