# Elenchi Home, archivio e calendario

Implementazione del 2 novembre 2026 sul branch `cruncy-ui`.

## Ambito e riferimento

Gli elenchi aperti da Altro nei cataloghi Home, l'archivio e il calendario usano
`ScrollList`, condivisa anche con i risultati della ricerca per provider.
Il collegamento Altro di Continua a guardare usa invece la cronologia e non e
stato modificato in questo intervento.

Riferimento consultato: `C:/dev/Cynavo/docs/research/crunchyroll-mobile/05-authenticated-navigation.md`,
sezione Browse: griglie di poster, intestazioni, ordinamento e filtri; View All
dei generi apre una griglia. Vega mantiene le proprie funzioni: griglia/lista,
filtri definiti dai provider e calendario raggruppato per giorno. Non si
introducono menu, stagioni, ordinamenti o metadata di Crunchyroll assenti in Vega.
Non si dichiara una replica 1:1: card coerenti con Home e ricerca restano una
scelta intenzionale.

## Modifiche

- Poster 2:3 ad angoli retti, font e titoli condivisi con la Home, fino a tre
  righe; modalita elenco con poster verticale piccolo e titolo flessibile.
- Griglia adattiva anche fuori dalla ricerca, basata sul contenitore misurato.
  Il calendario usa lo stesso numero di colonne e mantiene i giorni nell'ordine
  esistente. Le sezioni con pochi elementi non vengono centrate artificialmente.
- Intestazione con safe area, titolo bianco per cataloghi e calendario, separatore,
  pulsanti di almeno 48 punti; accento di ricerca e indicatori seguono il tema.
- Skeleton coerenti con la disposizione, incluso il calendario anche se la
  preferenza salvata e elenco. Stato vuoto dentro la lista, senza affiancamenti.
- Pannello filtri con intestazione coerente, colore #23252b e larghezza massima
  di 720 punti su tablet. Selezioni, applicazione, reset e chiusura preservati.
- Errori e Riprova disponibili anche per cataloghi e calendario. Le pagine gia
  caricate restano visibili e il retry ripete la pagina fallita.
- Una richiesta annullata non puo aggiornare lo stato di caricamento della
  richiesta successiva; un cambio filtro non viene saltato perche una vecchia
  richiesta era ancora occupata. Riapplicare lo stesso filtro ricarica la lista.
- Etichette accessibili del cambio griglia/lista in italiano e inglese.

Nessuna modifica ai provider, alle preferenze dei metadata, agli artwork hints,
ai fallback delle immagini, alla deduplicazione o ai parametri di apertura Info.
La preferenza griglia/lista resta condivisa e persistente come prima.

## Verifiche automatiche

- `npx tsc --noEmit` e `npm run lint`: superati senza errori o warning finali.
- `npx jest --runInBand --testTimeout=30000`: 62 suite, 304 test superati.
- Nuovi test: geometria entro il viewport, navigazione e poster preservati,
  cambio griglia/lista, filtro durante richiesta pendente, riapplicazione dello
  stesso filtro, giorni del calendario e retry. Il test di retry della ricerca
  viene eseguito anche per l'elenco non-search.
- Due proprieta di stile duplicate segnalate durante lo sviluppo sono state
  rimosse prima della verifica finale; restano i valori dello stile condiviso.

## Verifiche Android

Dev client esistenti con JavaScript corrente servito da Metro. Nessuna nuova
build nativa o prebuild. Smartphone Medium_Phone_API_35 e tablet
Medium_Tablet_API_35, temporanei e screenshot su D:.

- Smartphone: apertura reale da Altro della Home StreamingUnity, griglia a tre
  colonne, passaggio a elenco e ritorno; archivio, filtro Azione applicato e
  risultati aggiornati, indicatore filtro; ricerca archivio senza risultati.
- Scorrimento archivio: osservate richieste alle pagine 3 e 4, ciascuna con 60
  risultati. La diagnostica temporanea in memoria e stata rimossa dopo la prova.
- Apertura di Dexter: Resurrection dall'elenco, Info caricata e ritorno.
- Tablet: archivio a sette colonne in orizzontale; calendario a quattro colonne
  in verticale e sette in orizzontale. Nessun taglio laterale osservato.
- Calendario AnimeUnity con dati reali, giorni, badge e titoli; immagini inizialmente
  sostituite dai segnaposto e successivamente caricate. Font e geometria non
  alterano il percorso di caricamento di ProviderImage.
- Testo Android al 150% su tablet: card, titoli e pannello filtri utilizzabili.
  Font ripristinato a 1, rotazione tablet ripristinata disattivata.

Il collegamento iniziale del dev client a Metro ha avuto un timeout; usando
l'indirizzo host dell'emulatore 10.0.2.2 il bundle e stato caricato correttamente.
Il cambio di configurazione Android (font/abilitazione rotazione) puo ricreare
l'Activity e riportare alla Home, come gia osservato prima di questo intervento;
le schermate sono state riaperte per completare le prove.
I guasti delle richieste e le risposte obsolete sono verificati in modo
deterministico nei test automatici, senza interrompere i servizi remoti.

iOS, dispositivi fisici, player e download non verificati. Nessuna regressione
osservata nei percorsi provati; non e una garanzia di assenza assoluta di difetti.

## Evidenze locali non committate

Cartella `D:/codex-temp/catalog-20261102/`:

- `phone-more.png`, `phone-list.png`, `phone-grid-filtered.png`
- `phone-filters.png`, `phone-filter-result.png`, `phone-empty.png`
- `phone-info-ready.png`, `phone-info-return.png`
- `tablet-land-grid.png`, `tablet-large-archive.png`, `tablet-filters-large.png`
- `phone-calendar.png`, `tablet-calendar.png`, `tablet-calendar-land-ready.png`

Il perimetro di questo intervento e completato; ulteriori funzioni di catalogo
o modifiche alla cronologia vanno concordate separatamente.
