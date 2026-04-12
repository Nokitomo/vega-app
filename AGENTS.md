# AGENTS

Queste regole sono vincolanti per ogni intervento su questo progetto.

## Contesto tecnico
- App Expo/React Native con progetto nativo prebuildato (cartelle android/ e ios/ presenti).
- Piattaforme supportate: Android e iOS. Web non supportato.
- Dev client richiesto: non usare Expo Go per testare funzionalita native.
- Emulatore da usare: Medium_phone_API_35. Non avviare Pixel_6_Pro_API_35.

## Comandi standard
- Avvio Metro (dev client): `npx expo start -c --dev-client --scheme com.vega --port 8081`
- Build Android (dev client): `npx expo run:android --device \"Medium_phone_API_35\"`
- Prebuild Android pulito: `npx expo prebuild -p android --clean` (NON ESEGUIRE: sovrascrive le customizzazioni native in android/)
- Lint: `npm run lint`

## Git hygiene
- Non committare: `node_modules/`, `android/.gradle/`, `ios/Pods/`, `*.log`, `*.tmp`, `*.keystore`, `local.properties`, `key.properties`, output build (`android/app/build/`, `ios/build/`).
- Se una modifica genera file temporanei o cache, rimuoverli prima del commit.
- Usare commit piccoli e descrittivi; evitare di includere modifiche non correlate.

## Regole di lavoro
1) Creare commit atomici e coerenti per implementazione (feature/fix/refactor/docs). Evitare commit per singolo file, salvo casi eccezionali.
2) Aggiornare questo file (AGENTS.md) quando vengono introdotte nuove regole, flussi di lavoro o vincoli di progetto stabili.
3) Mantenere la documentazione in `docs/` sincronizzata con lo stato reale del progetto. Se una modifica influisce su comportamento, build, CI o funzionalita, aggiornare la documentazione nello stesso set/PR di modifiche.
4) Rispondere sempre in italiano.
5) Eseguire il comando di analisi/lint appropriato prima di ogni commit che modifica codice e sempre prima di push/PR (es. `npm run lint`, `flutter analyze` o equivalente). Gli info possono essere ignorati. Correggere errori bloccanti (rossi) e warning (gialli) introdotti dalle modifiche senza cambiare comportamento o rompere l'app. Se non e certo che il fix non alteri il comportamento, fermarsi e fornire un report dettagliato con possibili soluzioni.
6) Quando si eseguono git e commit, verificare con attenzione cosa si sta salvando nella storia del progetto (es. `git status` e `git diff --staged`). Se ci sono file che non andrebbero committati, non farlo e informare l'utente indicando quali file e perche.
7) Sono presenti customizzazioni manuali in `android/`: non eseguire `npx expo prebuild` (neanche con `--clean`).
8) Standard EOL del progetto: LF. Eccezione: script `.bat`/`.cmd` restano CRLF per compatibilita Windows. Regole in `.gitattributes`.
9) Lingue supportate: inglese e italiano. Non aggiungere altre lingue senza richiesta esplicita.
10) Ogni nuova stringa UI o messaggio utente va aggiunta in `src/i18n/en.json` e `src/i18n/it.json`. Nei componenti usare `t(...)`, nei servizi usare `i18n.t(...)`.
11) Per testi provenienti dai provider (es. AnimeUnity) usare `titleKey`/`titleParams`, `episodeLabelKey`/`episodeLabelParams` e `tagKeys` quando presenti, mantenendo il fallback su `title`/`episodeLabel`.
12) Autolinking iOS per `@react-native-firebase/*` e disabilitato in `react-native.config.js`; riattivarlo richiede configurazione Firebase e chiavi.
13) Usare la skill `gh-fix-ci` quando una pipeline GitHub Actions e rossa o una PR e bloccata da controlli CI, prima di tentare fix manuali non strutturati.
14) Usare la skill `security-threat-model` quando applicabile e affidabile per modifiche che introducono o alterano superfici di attacco (provider dinamici/remoti, networking, permessi, gestione token, download, esecuzione contenuti esterni).
15) Usare la skill `security-best-practices` quando applicabile e affidabile per modifiche a dipendenze, configurazioni sensibili, gestione segreti/chiavi, storage locale di dati sensibili e preparazione release.
16) Usare la skill `doc` solo quando applicabile (es. file `.docx`). Per documentazione del repository (`docs/`, `AGENTS.md`, Markdown) aggiornare i file direttamente nello stesso set di modifiche.
17) Usare la skill `screenshot` quando una modifica cambia UI/UX in modo visibile e serve evidenza grafica (es. PR, verifica o documentazione), oppure quando richiesto esplicitamente.
18) Se una skill richiesta non e disponibile o non applicabile in modo affidabile, procedere con fallback manuale esplicitando nel report finale motivazione, limiti e verifiche eseguite.
19) Prima di ogni commit eseguire sempre una scansione completa dei problemi con almeno `npx tsc --noEmit` e `npm run lint`. Se emergono errori o warning, NON committare subito: riportare prima all'utente l'elenco dei problemi trovati, spiegare cosa significano, indicare il rischio e proporre come risolverli senza rompere app e funzionalita. Procedere col commit solo dopo fix/verifica o conferma esplicita dell'utente.
