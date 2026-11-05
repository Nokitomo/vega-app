# Addon Stremio per sottotitoli

## Funzionamento

In Gestione provider, la voce **Addon Stremio** apre una schermata separata dai provider Vega. La prima lettura inizializza OpenSubtitles v3 ufficiale (`https://opensubtitles-v3.strem.io/manifest.json`), attivo. Disattivazione e rimozione sono persistenti: un elenco vuoto non reinstalla automaticamente il default.

Si possono verificare, aggiungere, attivare, aggiornare e rimuovere fino a 30 manifest HTTPS; i link `stremio://` vengono convertiti in HTTPS. La configurazione, quando dichiarata dal manifest, si apre sul sito dell'addon: dopo la configurazione occorre incollare il nuovo URL del manifest. Configurazioni diverse dello stesso addon possono coesistere; URL identici sono rifiutati.

Questa versione implementa esclusivamente la risorsa `subtitles`, per film e serie identificati da IMDb. Cataloghi, stream e metadati Stremio non sono implementati. Gli addon senza sottotitoli vengono conservati inattivi, quelli misti mostrano compatibilita parziale. Non viene eseguito codice JavaScript proveniente dagli addon.

## Player

Aprire Sottotitoli -> Cerca sottotitoli online -> Addon Stremio. L'ID IMDb e stagione/episodio vengono precompilati dai metadati disponibili; sono correggibili. Se manca IMDb, inserirlo manualmente. Film: `tt...`; serie: `tt...:stagione:episodio`, inclusa stagione 0 per gli speciali. Negli anime, verificare la numerazione rispetto a IMDb.

La lingua iniziale segue quella dell'app; la scelta viene ricordata. Le richieste usano gli addon attivi compatibili con tipo e prefisso ID; le lingue ISO 639-2 vengono normalizzate. I risultati sono filtrati per lingua e deduplicati per URL, con cache in memoria di cinque minuti. Errori di un addon non eliminano i risultati degli altri. Chiusura/cambio episodio annullano o scartano richieste e selezioni obsolete.

Toccando un risultato si scarica una copia temporanea, riconoscendo SRT, WebVTT, ASS o TTML dal contenuto. La traccia viene aggiunta al menu Sottotitoli, dove va selezionata come le altre tracce esterne. Il supporto effettivo del formato dipende dal player nativo. La scheda **API OpenSubtitles** mantiene il percorso precedente con chiave personale; la chiave non serve per l'addon ufficiale.

## Dati e limiti di sicurezza

- Registro e URL configurati in `secureStorage` cifrato (`stremioAddons.v1`); preferenza lingua `stremioSubtitleLanguage.v1`. Gli URL configurati possono includere token: non registrarli nei log o mostrarli nelle schede, che espongono solo hostname/versione.
- Validazione HTTPS, esclusione credenziali user/password, indirizzi IP letterali e nomi locali comuni; nessuna esecuzione di codice remoto. Non e una protezione completa contro DNS rebinding o redirect di un server ostile: installare addon fidati.
- Timeout di 12 secondi per manifest/ricerca, 20 per file; controlli su Content-Length e contenuto letto (2 MB JSON, 4 MB sottotitoli). Non sono limiti di streaming della memoria di rete: il fetch nativo puo bufferizzare la risposta prima del controllo finale.
- Copie UTF-8 nella cache privata `stremio-subtitles/`; pulizia dei soli file generati da questa funzione piu vecchi di 24 ore durante il download successivo. Nessuna modifica ai file dell'utente.
- Nessun inoltro di chiavi OpenSubtitles personali agli addon. Gli addon ricevono ID del contenuto e indirizzo IP della richiesta. Disponibilita, copertura e limiti di servizio dipendono dai rispettivi server.
- Nessuna nuova dipendenza. Android richiede una nuova build: la patch versionata di react-native-video unisce esplicitamente i sottotitoli esterni alla sorgente video con `MergingMediaSource`. Le factory specifiche per MP4/HLS/DASH non consumano da sole `MediaItem.subtitleConfigurations`. Il percorso senza tracce esterne resta invariato; i sottotitoli sono convertiti in cue Media3 durante l'estrazione, senza abilitare la decodifica legacy. I formati non riconosciuti dal parser nativo vengono ignorati. DRM, cache e factory del video restano quelli esistenti. Android e iOS condividono il codice di ricerca, ma la verifica runtime descritta sotto riguarda Android.

## Verifiche

La patch Android espone `sourceId` negli eventi delle tracce testuali. `mergeSubtitleTracks` riconosce gli ID `external-subtitle-N`, inclusi i prefissi numerici aggiunti da Media3, e conserva gli indici nativi evitando duplicati nel menu. Su iOS usa titolo/lingua per associare le tracce restituite da AVPlayer. Dopo aggiornamenti di react-native-video o Media3 verificare nuovamente questa associazione e rigenerare la patch includendo solo sorgenti, mai directory di build.

Il selettore Android interpreta gli indici testuali come posizione complessiva attraverso tutti i gruppi, nello stesso ordine degli eventi `onTextTracks`. Per applicare la scelta usa poi il gruppo e l'indice interno corrispondenti. Prima di questa correzione, la seconda traccia di gruppi distinti poteva risultare selezionata nel menu ma produrre `Text track not found` nel player nativo. La selezione per lingua non sostituisce quella per indice: piu tracce possono avere la stessa lingua.

Regressione della selezione verificata su Medium_phone_API_35 con build nativa aggiornata: seconda traccia SRT incorporata in MKV, seconda traccia SRT esterna su MP4, combinazione di due tracce incorporate e una esterna, due tracce italiane distinte, seek, ritorno alla prima traccia e disattivazione. Selezione eseguita attraverso gli handler del menu del player, senza override nativi per lingua. Didascalie verificate visivamente e nessun nuovo `Text track not found` nei log. TypeScript e lint superati; 25 test nelle suite playerTrackSelection, stremioSubtitleUi e streamDrm superati. La prima esecuzione concorrente alla build aveva due timeout UI di 5 secondi; la ripetizione con gli stessi timeout ha superato tutte le asserzioni. La prova non comprende lo specifico stream StreamingUnity segnalato dall'utente ne una verifica runtime iOS.

Test automatici: manifest e vincoli risorsa/tipo/ID, inizializzazione e rimozione persistente, configurazioni duplicate, refresh concorrente alla rimozione, ricerca/lingue/cache/errori parziali/cancellazione, riconoscimento formati, UI e regressione del percorso API diretto. Comandi: `npx tsc --noEmit`, `npm run lint`, `npx jest --runInBand`.

Verifica del 2026-11-05: TypeScript e lint senza errori o warning; 74 suite Jest, 363 test superati. Build Android x86_64 completata e installata sul dev client Medium_phone_API_35. Verificati gestione addon, layout italiano anche con caratteri al 130%, scroll/tastiera, ricerca reale OpenSubtitles v3 senza chiave personale, download e selezione di un SRT italiano, assenza di tracce duplicate e visualizzazione delle didascalie dopo seek su un MP4 locale. Verificata anche la riproduzione DASH ClearKey con il contenuto pubblico di test Angel One, senza sottotitoli esterni, dopo la modifica nativa. Le schermate di verifica sono conservate fuori dal repository nella cartella temporanea della sessione; nessun video o sottotitolo di test viene distribuito nell'app. Non eseguita una verifica runtime iOS.

Non sono inclusi sincronizzazione temporale dei sottotitoli, anteprime seekbar, discovery automatica di addon o compatibilita generica con tutte le risorse Stremio.
