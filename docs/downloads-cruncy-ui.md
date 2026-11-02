# Libreria download ed episodi

Intervento UI del 2 novembre 2026 sul branch `cruncy-ui`.

Downloads e SeriesEpisodes usano font condivisi con la Home, safe area,
intestazioni e superfici coerenti. Le miniature hanno larghezza limitata
e rapporto 16:9; le righe episodi non hanno piu altezza fissa. Il nome file
ha testo leggibile su due righe e il titolo della serie viene troncato dal
layout, senza tagliare manualmente la stringa. Durante il caricamento della
libreria compare un indicatore invece di un contenitore vuoto.

Non cambiano scansione dei file, raggruppamento, ordinamento, cancellazione,
permessi, destinazione download o parametri del player. I callback UI sono
stati confrontati sintatticamente con la versione precedente.

## Verifiche

- TypeScript e lint senza errori o warning; 64 suite e 309 test superati.
- Test dedicati: raggruppamento serie/film, apertura delle rispettive
  destinazioni, ordine episodi, selezione e cancellazione del solo file scelto
  con filesystem simulato.
- Medium_Phone_API_35: apertura libreria e lista di 12 episodi di prova,
  selezione e annullamento.
- Tablet API 35: libreria vuota, lista episodi con titolo lungo nella finestra
  limitata e a larghezza completa in orizzontale; selezione, annullamento,
  scorrimento. Preferenza di rotazione ripristinata a false.
- I dati degli episodi erano parametri temporanei di navigazione, senza
  creare o cancellare file video. La riproduzione effettiva non e validata.
- Screenshot locali non versionati: `D:/codex-temp/final-ui-20261102/`.

La cartella `/storage/emulated/0/Download/vega` assente produce ancora
l'errore preesistente di lettura, visibile nel LogBox del dev client.
Il motore download e i problemi del player restano esclusi dalla richiesta.
iOS non verificato.
