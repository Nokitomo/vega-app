# Lista da guardare: presentazione coerente con la Home

Verifica e implementazione del 2 novembre 2026, branch `cruncy-ui`.

## Scelta concordata

La Lista da guardare mantiene la griglia di Vega, con lo stile delle card della
Home. Non replica le righe di Crunchyroll e non introduce filtri, ordinamenti,
schede o funzioni che Vega non possiede.

## Riferimento osservato

Prove nell'app Android Crunchyroll autenticata:

- Smartphone: righe con poster a sinistra, informazioni e menu a destra.
  L'app resta verticale anche avviandola dopo aver portato Android in orizzontale.
- Tablet: due colonne di righe sia in verticale sia in orizzontale. Per verificare
  entrambe le disposizioni e stato necessario riavviare l'app dopo la rotazione:
  nell'ambiente osservato Crunchyroll blocca l'orientamento corrente.
- Stato vuoto con illustrazione, testo e invito a esplorare; menu dei contenuti
  con rimozione, informazioni e condivisione.

I due titoli aggiunti per osservare la lista popolata sono stati rimossi al termine,
ripristinando la lista Crunchyroll inizialmente vuota.

## Implementazione

`src/screens/WatchList.tsx` usa i font, lo stile del titolo delle card e il
riferimento dimensionale condivisi in `homePresentation`. Poster 2:3 con angoli
retti, titoli allineati a sinistra fino a tre righe, spaziatura di 12 punti.
Il numero di colonne e la larghezza effettiva dipendono dal viewport misurato,
escludendo sidebar e padding: la griglia riempie lo spazio senza tagliare l'ultima
colonna. Il valore Home determina la densita, non una larghezza fissa identica.

Intestazione bianca allineata a sinistra, separatore e safe area superiore/laterale.
Stato vuoto centrato e scorrevole, con icona bookmark che segue il tema.
Sono riutilizzate le stringhe gia tradotte. Dati salvati, ordine, poster memorizzati,
provider e navigazione Info non cambiano; non viene introdotta alcuna migrazione
o richiesta di metadata aggiuntiva.

## Verifiche

- `npx tsc --noEmit`: superato.
- `npm run lint`: superato.
- `npx jest --runInBand --testTimeout=30000`: 61 suite, 300 test superati.
- Test WatchList: 40 elementi, variazioni del viewport, ultima colonna contenuta,
  proporzioni poster, fonte immagine e navigazione preservate, stato vuoto e
  successiva disponibilita degli elementi.
- Medium_Phone_API_35: tre colonne, scroll fino all'ultima card, apertura Info,
  rimozione e riaggiunta (40 -> 39 -> 40), stato vuoto e colore tema alternativo.
- Medium_Tablet_API_35: cinque colonne in verticale, otto in orizzontale con
  rotazione tablet abilitata, ultima riga completa, apertura Info e ritorno.
  Verificato anche font Android a 1,5 e stato vuoto.
- Il tentativo di rotazione sul telefono mantiene la policy verticale esistente.
- Dopo arresto e riavvio dei due dev client: 40 preferiti ancora presenti su
  entrambi; impostazione rotazione tablet ripristinata a false, font Android a 1.

Lo stato vuoto e il tema alternativo sono stati simulati nello store in memoria,
senza cancellare la persistenza. Al termine sono stati ripristinati dati, ordine
e tema originali. Le modifiche UI sono state servite da Metro ai dev client
esistenti: non e stata prodotta una nuova APK. Il dev client telefonico conserva
la versione nativa 3.3.19 e propone l'aggiornamento 3.3.20; il dialogo e stato
annullato. Il primo test isolato, eseguito durante l'avvio di Metro, ha superato
il timeout di 5 secondi; ripetizione con timeout 30 secondi e suite finale passate.

Nessuna regressione osservata nel percorso verificato. iOS e tablet fisici non
verificati; player e download esclusi da questo intervento. I test non garantiscono
assenza assoluta di difetti su ogni dispositivo.

## Evidenze locali

Screenshot non committati in `D:\codex-temp\watchlist-20261102`:

- `cr-phone-list.png`, `cr-phone-menu.png`
- `cr-tablet-two-port.png`, `cr-tablet-two-land.png`, `cr-cleaned.png`
- `vega-watchlist-phone.png`, `vega-phone-end.png`
- `vega-watchlist-tablet-land.png`, `vega-tablet-bottom.png`
- `vega-tablet-portrait.png`, `vega-tablet-large-list.png`
- `vega-phone-empty.png`, `vega-tablet-empty-large.png`, `vega-phone-sky-empty.png`

La differenza griglia/righe e intenzionale e approvata. Il perimetro concordato
della Lista da guardare e completato; eventuali funzioni aggiuntive richiedono
una scelta separata.
