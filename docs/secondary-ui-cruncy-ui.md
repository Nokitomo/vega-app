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

La prova del servizio sottotitoli usa risposte simulate nei test, non un
download reale autenticato OpenSubtitles. iOS, tablet e prova combinata
orizzontale/caratteri ingranditi non certificati in questo ciclo. La fixture
runtime non e sopravvissuta alla ricreazione dell'Activity durante quest'ultima
prova; non e una verifica riuscita del layout. Nessuna modifica a metadati,
provider, motori player/download, networking o progetti nativi.
