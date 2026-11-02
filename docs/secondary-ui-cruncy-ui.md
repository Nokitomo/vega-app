# Pannelli secondari e recupero errori

Intervento del 2 novembre 2026, successivo all'aggiornamento del player.

## Modifiche

- Ricerca sottotitoli: font condivisi con la Home, campo ricerca separato,
  filtri con ritorno a capo e pulsante Cerca esplicito. Contenuto scorrevole
  con gestione tastiera; risultati verticali per contenere titoli lunghi.
  Restano invariati ricerca manuale, lingua iniziale, parametri del servizio
  e inserimento del sottotitolo selezionato nelle tracce esterne.
- Stato senza provider: pannello e font coerenti, contenuto scorrevole.
  `NoProvidersMessage` separa la presentazione dal controllo provider e
  dalla navigazione alle estensioni, che restano in `Tutorial`.
- Errori globali e di Home/Info: font e superfici coerenti; recupero,
  riavvio, dettagli e report invariati. La misura della finestra di errore
  globale segue gli aggiornamenti delle dimensioni.
- Filtri catalogo: font di campi, dropdown, generi e pulsanti allineati.
  Bozza locale, reset, applicazione e valori provider invariati.
- Copia link download/sottotitoli e report errore: uso dell'utilita
  `setClipboardString` gia presente, con selezione modulo e fallback esistenti.

## Verifiche

- TypeScript e lint finali senza diagnostiche. Corretto un errore di tipo
  nel nuovo `beforeEach` del test prima del commit.
- Suite completa finale: 69 suite, 323 test superati.
- Test dei parametri della ricerca sottotitoli e della selezione, nessuna
  ricerca durante la digitazione; applicazione/reset/chiusura filtri senza
  mutare il valore originale; riprova errore e destinazione Estensioni.
- Test download: copia dei link tramite utilita condivisa e payload di
  download video/sottotitoli invariati.
- Verifica visiva Medium_Phone_API_35 in dev client: ricerca sottotitoli
  in verticale anche con tastiera aperta, pannello filtri, errore globale,
  errore locale e presentazione senza provider. Fixture solo in memoria,
  senza cancellazione dei provider o scrittura di preferenze dell'app.
  Le fixture sono rimosse riavviando l'app. Scala caratteri Android
  ripristinata a 1.0 dopo il tentativo di verifica con caratteri ingranditi.
- Evidenze non versionate in `D:/codex-temp/final-ui-20261102/`:
  `secondary-sub-keyboard-final.png`, `secondary-filters.png`,
  `secondary-error.png`, `secondary-global-error.png`,
  `secondary-no-provider-final.png`.

## Limiti

### Verifica integrativa con caratteri ingranditi

Eseguita successivamente con scala Android 1.5 (150%) sui dev client
Medium_Phone_API_35 e Medium_Tablet_API_35, caricando il JavaScript corrente
da Metro. Ricerca sottotitoli, filtri catalogo, stato senza provider ed errori
locale/globale sono stati montati con fixture solo in memoria.

- Smartphone verticale e orizzontale: testi e controlli leggibili; il pannello
  senza provider in orizzontale richiede scorrimento, verificato fino al pulsante.
- Tablet orizzontale e verticale: controllati campi, pulsanti e pannelli senza
  tagli laterali. La prova verticale finale ruota realmente il display a
  1600x2560; i primi tentativi con finestra compatibile nel display orizzontale
  non sono conteggiati come prova verticale.
- Nessun fix di codice necessario nei casi osservati. TypeScript e lint
  superati; suite completa nuovamente superata: 69 suite, 323 test.
- Scala caratteri ripristinata a 1.0 su entrambi; preferenza rotazione tablet
  ripristinata a false, rotazione automatica Android ripristinata; fixture
  rimosse arrestando e riavviando i processi dell'app.
- Evidenze aggiuntive nella stessa cartella su D:, prefissi `font15-phone-`,
  `font15-tablet-land-` e `font15-tablet-portrait-`. I file `font15-tablet-port-`
  sono tentativi intermedi con display ancora orizzontale.

Questa integrazione copre i pannelli elencati, non ogni schermata o funzione
dell'app con ogni scala caratteri. La tastiera software non era visibile nei
tentativi aggiuntivi al 150%; tali immagini provano il campo focalizzato,
non il comportamento con tastiera aperta. Restano valide le precedenti prove
con tastiera a scala standard. Nessuna nuova verifica nativa iOS, Cast, PiP,
Gecko o download autenticato del servizio sottotitoli.

### Limiti del ciclo precedente (superati in parte dall'integrazione)

La prova del servizio sottotitoli usa risposte simulate nei test, non un
download reale autenticato OpenSubtitles. iOS, tablet e prova combinata
orizzontale/caratteri ingranditi non certificati in questo ciclo. La fixture
runtime non e sopravvissuta alla ricreazione dell'Activity durante quest'ultima
prova; non e una verifica riuscita del layout. Nessuna modifica a metadati,
provider, motori player/download, networking o progetti nativi.
