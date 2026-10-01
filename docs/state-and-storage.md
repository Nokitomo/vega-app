# Stato e Storage

## Zustand (stato in memoria)
Store principali:
- src/lib/zustand/contentStore.ts: provider attivo, catalogo e contenuti.
- src/lib/zustand/themeStore.ts: tema e colori principali.
- src/lib/zustand/herostore.ts: contenuto in evidenza (hero).
- src/lib/zustand/searchCacheStore.ts: cache risultati ricerca (LRU max 10 query); resta valida finché la tab Search è attiva, poi scade dopo 10 minuti dall'uscita.
- src/lib/zustand/watchListStore.ts: watchlist in memoria.
- src/lib/zustand/watchHistrory.ts: cronologia.
- src/lib/zustand/downloadsStore.ts: download in corso e completati.

## Storage persistente (MMKV)
Wrapper: src/lib/storage/StorageService.ts
- mainStorage: storage principale
- cacheStorage: storage secondario per cache
- secureStorage: istanza MMKV cifrata per token e sessioni sensibili

Manager specifici:
- SettingsStorage: preferenze UI, feedback, player, telemetry, lingua app.
- WatchListStorage / WatchHistoryStorage: liste persistenti.
- DownloadsStorage: stato download e cache file/thumbnails.
- ProvidersStorage / ExtensionStorage: provider disponibili e installati.
- CacheStorage: cache generica.
- cacheStorage include cache home/hero con TTL settimanale.
- Il database filler usa `mainStorage`: la copia valida non scade e un controllo SHA settimanale scarica il file solo quando cambia.
- La sessione AnimeSkip usa `secureStorage`; la password non viene persistita.

## Principi
- Stato volatile in Zustand, persistenza tramite MMKV.
- Le chiavi di storage sono centralizzate negli enum delle classi.
- La progressione episodi salva anche `seasonEpisodesLink` per riprendere la stagione corretta.
