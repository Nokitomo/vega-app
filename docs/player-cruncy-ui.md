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

## Gesti, volume e luminosita

- Il trascinamento verticale si attiva dopo 16 dp e non parte se il movimento
  orizzontale prevale. Il lato scelto al primo tocco resta fisso per tutta la
  durata del gesto: sinistra per la luminosita, destra per il volume.
- Su Android gli swipe che iniziano presso i bordi riservati alle barre di
  sistema vengono ignorati. Questo permette di aprire la tendina dall'alto
  senza modificare luminosita o volume; tap, pinch e pressione per 2x restano
  indipendenti dal riconoscimento dello swipe verticale.
- Il volume modifica lo stream multimediale del dispositivo. L'indicatore del
  player segue anche i tasti fisici e il valore viene aggiornato quando l'app
  torna in primo piano.
- La luminosita modificata con lo swipe vale solo nella finestra del player.
  Mandare l'app in background mostra la luminosita di sistema; tornando allo
  stesso player resta la scelta precedente. Uscendo dal player viene rimossa
  la modifica temporanea e un nuovo ingresso parte dal valore di sistema.
- Quando i controlli sono visibili, la fascia superiore resta sopra la
  superficie dei gesti: il tap sulla freccia indietro raggiunge il pulsante e
  chiude il player. Con i controlli nascosti la fascia non intercetta i gesti.

## Verifiche

- `npx tsc --noEmit` e `npm run lint`: superati senza problemi.
- Suite completa: 70 suite, 326 test superati.
- Test dedicati: metadati prima della posizione, speciali e decimali,
  fallback, deduplicazione del titolo e callback di selezione/chiusura.
- Medium_Phone_API_35, dev client Android: video locale H.264/AAC di due
  minuti, cronologia disabilitata per la fixture. Riproduzione completata,
  apertura lista, numeri 12/13, selezione del secondo episodio con ripartenza
  e aggiornamento titolo, pausa e menu velocita con selezione 1x verificati.
- Evidenze locali non versionate in `D:/codex-temp/final-ui-20261102/`:
  `player-drawer.png`, `player-next-episode.png`, `player-speed-panel.png`,
  `player-pause-confirmed.png`.
- Il 5 novembre 2026, build dev client Android completata e installata su
  `Medium_phone_API_35`. Con un MP4 locale H.264/AAC da dieci minuti sono
  stati verificati swipe interni sui due lati, esclusione del bordo superiore,
  sincronizzazione del volume multimediale e ciclo della luminosita:
  selezione nel player, Home Android e ritorno, uscita dal player e nuovo
  ingresso. Il valore di sistema e rimasto invariato durante gli swipe.
- Evidenze locali non versionate in
  `D:/codex-temp/vega-player-gestures-20261105/`.
- Il 5 novembre 2026 la freccia indietro e stata provata sullo stesso dev
  client Android con MP4 locale: prima del fix piu tap lasciavano aperto il
  player; dopo il fix un tap torna alla schermata precedente, anche dopo un
  nuovo ingresso. Con i controlli nascosti restano operativi gli swipe per
  luminosita e volume e il tap riapre i controlli.

## Limiti

Motore, callback di riproduzione e preferenze non modificati. La prova locale
dei gesti non certifica tutti i codec o i server dei
provider. Cast, PiP, tracce remote multiple, tablet e iOS non verificati
in questo ciclo. Non si dichiara una parita pixel per pixel con Crunchyroll
o la risoluzione dei precedenti problemi di riproduzione dei provider.
