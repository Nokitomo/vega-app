# Servizi

## Notifiche
File: src/lib/services/Notification.ts
- Usa Notifee per canali: default, download, update.
- Gestisce progress download, completamento e fallimenti.
- Gestisce azioni (cancel download, installazione APK).
- Titoli e testi notifica sono localizzati via i18n.

## Aggiornamento app (APK)
File: src/screens/settings/About.tsx
- Verifica release da GitHub e confronto versione app locale/remota.
- Su Android seleziona l'APK piu compatibile per ABI device (arm64/armeabi-v7a, fallback universal).
- L'installazione automatica degli aggiornamenti e abilitata per impostazione predefinita; se attiva, scarica l'APK in `Download`.
- Dopo update riuscito, al primo avvio con nuova versione elimina automaticamente l'APK scaricato in precedenza.

## Download
- DownloadManager (src/lib/services/DownloadManager.ts) gestisce stato e persistenza.
- Utilizza RNFS per operazioni su file.
- HLS downloader: src/lib/hlsDownloader.ts e src/lib/hlsDownloader2.ts.

## Aggiornamenti provider
File: src/lib/services/UpdateProviders.ts
- Confronta versioni provider per sorgente e avvia update automatici dopo aver refreshato i manifest delle sorgenti usate dai provider installati.
- Scarica i moduli aggiornati prima di aggiornare il record installato, evitando di lasciare provider disinstallati se il download fallisce.
- Mostra notifiche di progresso tramite NotificationService solo se le notifiche sono abilitate.
- Controllo automatico ogni 6 ore; se chiamato piu volte evita timer duplicati.
- Messaggi di update sono localizzati via i18n.

## Estensioni
ExtensionManager (src/lib/services/ExtensionManager.ts)
- Gestisce sorgenti provider multiple, con sorgente ufficiale `Nokitomo/vega-providers` creata automaticamente se non esiste configurazione locale.
- Migra i provider installati legacy senza metadati `source` verso la sorgente di default.
- Download moduli, cache per sorgente e modalita test.

## OMDb
File: src/lib/services/omdb.ts
- Integrazione con OMDb per metadata aggiuntivi.

## Metadata anime
File: src/lib/services/animeMeta.ts
- Integrazione con AniList (GraphQL) e fallback Jikan per metadata anime quando non c'e imdbId.
File: src/lib/services/enhancedMeta.ts
- Seleziona la fonte esterna (Cinemeta/Stremio o AniList/Jikan) in base agli ID disponibili.

## Timestamp video e AnimeSkip
File: `src/lib/services/videoSkip.ts`
- Interroga i resolver nello stesso ordine di Cloudstream: AniSkip, TheIntroDB, IntroDB e AnimeSkip.
- Restituisce il primo risultato non vuoto senza fondere timestamp provenienti da fonti diverse.
- AniSkip e AnimeSkip sono usati per anime/OVA; TheIntroDB copre film e serie; IntroDB copre contenuti episodici con ID IMDb.
- I timestamp validi vengono mantenuti nella cache MMKV e il player mostra il testo appropriato per opening, ending, recap, crediti, intro e anteprima.
- AnimeSkip viene interrogato solo se esiste una sessione salvata dalla schermata Account.

File: `src/lib/services/animeSkipAuth.ts`
- Replica il login usato da Cloudstream: hash MD5 della password, login GraphQL e recupero del primo client API dell'account.
- Password e hash non vengono salvati. Token, refresh token, dati profilo e client ID vengono conservati nello storage MMKV cifrato.

## Database filler
File: `src/lib/services/fillerDatabase.ts`
- Usa `recloudstream/anime-db` direttamente da GitHub senza API key.
- Il JSON scaricato resta nello storage principale senza scadenza. Ogni sette giorni viene confrontato lo SHA del file tramite GitHub Contents API; viene sostituito solo quando lo SHA cambia e il nuovo JSON supera la validazione.
- In caso di errore di rete o payload non valido resta disponibile l'ultima copia valida.
- La ricerca segue la priorita di Cloudstream: MAL, AniList, Kitsu, IMDb, stagione TMDB e titolo normalizzato.
- Gli ID anime vengono normalizzati sia dai campi singoli sia dagli array restituiti dai provider. La ricerca TMDB riconosce sia `themoviedb_id` sia l'eventuale ID della stagione.
- La lista episodi mantiene come riferimento il numero assoluto del provider, quindi le etichette filler restano corrette indipendentemente dalla suddivisione in stagioni usata per i metadata.
