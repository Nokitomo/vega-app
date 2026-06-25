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
- Se auto-download e abilitato, scarica APK in `Download`.
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
