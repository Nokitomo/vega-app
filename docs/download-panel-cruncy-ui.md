# Pannello di scelta download

Aggiornamento del 2 novembre 2026: `DownloadBottomSheet` usa font della Home,
superfici #141519/#23252b, righe con altezza minima 48, titolo su massimo due
righe e schede Video/Sottotitoli con accento del tema. Sfondo oscurato,
larghezza massima 640 e altezza espansa limitata allo spazio disponibile;
padding inferiore basato sulla safe area. Il gesto di espansione resta disponibile.

Lo stesso componente serve sia alla scelta per scaricare sia alla scelta
per aprire un server. Entrambi ricevono quindi lo stesso aggiornamento.
Callback, ordinamento dei server, disponibilita dei sottotitoli, copia link,
formati e motore download restano invariati; confronto sintattico dei callback
effettuato rispetto al commit precedente.

## Verifiche

- TypeScript e lint senza errori o warning dopo la correzione dei tipi nel test.
- Suite completa: 65 suite, 311 test superati.
- Test dedicati: selezione video, sottotitoli VTT/SUBRIP, copia link con
  pressione prolungata, chiusura, loading, stato vuoto ed errore.
- Medium_Phone_API_35 con dev client: apertura da Info di GialappaShow con
  server reali StreamingUnity, caricamento e risultati, espansione trascinando
  la maniglia, chiusura con Indietro, riapertura tramite pressione prolungata
  del download (variante apertura server), chiusura toccando lo sfondo.
- Screenshot locali: `D:/codex-temp/final-ui-20261102/sheet-loaded.png`,
  `sheet-expanded.png`, `sheet-longpress-open.png`.

Il test segnala la deprecazione preesistente di Clipboard da react-native:
la copia e verificata, la migrazione della dipendenza e fuori da questo fix.
Nessun trasferimento completo di file e stato usato come criterio del test UI;
il motore download non e modificato. iOS e resa finale su tablet non verificati
in questo intervento. Il tentativo di montare una fixture a runtime sul tablet
ha prodotto un errore di vista nativa: non e considerato una prova valida del
pannello. La verifica conclusiva usa il normale flusso dell'app su smartphone.
