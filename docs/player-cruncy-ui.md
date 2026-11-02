# Player: presentazione e numerazione episodi

Intervento del 2 novembre 2026 sul branch `cruncy-ui`.

## Comportamento

- Pannelli episodi, audio, sottotitoli, velocita e qualita con font condivisi
  con la Home, superfici scure e righe squadrate; accento dal tema corrente.
- Dimensioni dei pannelli aggiornate rispetto alla finestra disponibile.
- La lista mostra sempre la dicitura localizzata "Episodio N", anche quando
  esiste un titolo descrittivo. Lo stesso numero compare nel sottotitolo del
  player per le serie; i film non ricevono questa aggiunta.
- Il numero usa `episodeNumber`, poi un prefisso episodio riconoscibile nel
  titolo, infine la posizione nella lista. Sono preservati zero e decimali.
  Questo fallback e solo di presentazione: non modifica metadati, identita,
  cronologia, sorgenti o logica di cambio episodio.
- Un titolo composto soltanto dalla dicitura episodio non viene duplicato.

## Verifiche

- `npx tsc --noEmit` e `npm run lint`: superati senza problemi.
- Suite completa: 68 suite, 319 test superati. Rimane il messaggio di
  deprecazione Clipboard gia presente nel test del pannello download.
- Test dedicati: metadati prima della posizione, speciali e decimali,
  fallback, deduplicazione del titolo e callback di selezione/chiusura.
- Medium_Phone_API_35, dev client Android: video locale H.264/AAC di due
  minuti, cronologia disabilitata per la fixture. Riproduzione completata,
  apertura lista, numeri 12/13, selezione del secondo episodio con ripartenza
  e aggiornamento titolo, pausa e menu velocita con selezione 1x verificati.
- Evidenze locali non versionate in `D:/codex-temp/final-ui-20261102/`:
  `player-drawer.png`, `player-next-episode.png`, `player-speed-panel.png`,
  `player-pause-confirmed.png`.

## Limiti

Intervento UI: motore, gesti, callback di riproduzione e preferenze non
modificati. La prova locale non certifica tutti i codec o i server dei
provider. Cast, PiP, tracce remote multiple, tablet e iOS non verificati
in questo ciclo. Non si dichiara una parita pixel per pixel con Crunchyroll
o la risoluzione dei precedenti problemi di riproduzione dei provider.
