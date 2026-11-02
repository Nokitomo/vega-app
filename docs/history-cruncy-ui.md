# Continua a guardare e cronologia

Aggiornamento del 2 novembre 2026 sul branch `cruncy-ui`.

Le due pagine usano poster 2:3, titoli e font condivisi con la Home,
intestazioni bianche e safe area. La griglia misura la propria larghezza utile
con `usePosterGrid`, includendo i margini: il numero di colonne cambia con
la finestra, senza dimensioni calcolate sull'intero display.

Restano invariati selezione dei contenuti, progressi, destinazione Info,
episodio da riprendere, rimozione da Continua a guardare, selezione multipla
e conferma della cancellazione della cronologia. Nessuna migrazione dei dati
o modifica ai provider e alle preferenze dei metadata.

## Verifiche

- TypeScript e lint senza errori.
- Tre suite mirate, 30 test superati: geometria della griglia, navigazione,
  rimozione mirata e conferma della cancellazione, oltre alle regole esistenti
  di Continua a guardare.
- Medium_Phone_API_35: apertura delle due pagine con cronologia reale.
- Medium_Tablet_API_35: finestra limitata da Android e rotazione libera;
  griglie con 40 elementi temporanei in memoria, progressi, pressione prolungata,
  selezione e annullamento della conferma di cancellazione. Verificata la
  ricomposizione in verticale e orizzontale. Cronologia originale ripristinata;
  nessuna cancellazione dei progressi salvati.
- Acquisizioni locali in `D:/codex-temp/final-ui-20261102/`, non versionate.

Il primo avvio del dev client sul telefono ha prodotto un timeout e un ANR
nella schermata di errore Expo. Dopo il riavvio e la connessione a Metro
le pagine sono state verificate. Non attribuito alle modifiche UI.
Player e motore download esclusi da questo intervento; iOS non verificato.
