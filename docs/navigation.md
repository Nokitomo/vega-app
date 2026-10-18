# Navigazione

## Root
- RootStack (createNativeStackNavigator)
  - TabStack
  - Player (landscape)

## Orientamento
- Gestione centralizzata in `src/App.tsx`:
  - `Player`: lock landscape.
  - `Webview` Android: modalita `USER` (rispetta il lock auto-rotate del dispositivo).
  - Altre schermate: portrait (salvo impostazioni tablet che abilitano rotazione non-player).

## TabStack (Bottom Tabs)
- HomeStack
- SearchStack
- WatchListStack
- SettingsStack

## HomeStack
- Home
- Info (param: link, provider?, poster?, infoStack?)
- ScrollList (param: filter, title?, providerValue?, isSearch)
- Webview (param: link)

## SearchStack
- Search
- ScrollList
- Info
- SearchResults (param: filter, availableProviders?)

## WatchListStack
- WatchList
- Info

## WatchHistoryStack
- WatchHistory
- Info
- SeriesEpisodes (param: series, episodes, thumbnails)
Nota: lo stack WatchHistory e raggiungibile da Settings.

## SettingsStack
- Settings
- About
- Preferences
- Downloads
- Extensions
- Account (login/logout AnimeSkip e collegamento alla creazione account)
- WatchHistoryStack
- SubTitlesPreferences

## Note UI
- Tab bar personalizzata con haptic feedback opzionale, padding bottom dinamico (safe area) e offset verso l'alto calcolato in base al font scale quando le etichette sono attive, per evitare sovrapposizione con la barra di sistema su Android.
- Su Android la navigation bar e nascosta di default (immersive); riappare temporaneamente con swipe dal basso.
- Uso di SafeAreaView e tema scuro custom.
- In `Webview` Android, durante fullscreen HTML5 del contenuto web:
  - header superiore dello screen nascosto;
  - status/navigation bar Android nascoste;
  - lock landscape finche il provider resta in fullscreen.
- In Info, il pulsante X torna alla schermata precedente senza reset dello stack.
- Preferenze: "Show Tab Bar Labels" controlla la visibilita delle etichette nella tab bar; "Show Recently Watched" abilita/disabilita la sezione Continue Watching in Home (attivo di default).
- Da Home, il pulsante "Altro" della sezione Continue Watching apre `HomeStack -> ContinueWatchingAll`. La rimozione da questa sezione nasconde il titolo fino alla prossima riproduzione senza cancellare WatchHistory o progressi.
- La schermata WatchHistory consente selezione multipla con "Seleziona" o pressione prolungata, conferma la rimozione dei soli titoli scelti e conferma anche "Cancella" per tutta la cronologia. La rimozione dalla cronologia elimina anche le rispettive card Continue Watching e i progressi.
- La card di una serie in Continue Watching passa a `Info` la stagione e l'episodio suggeriti. La scheda apre quella stagione e il pulsante Riproduci/Riprendi usa l'episodio suggerito; se e gia iniziato, mantiene la ripresa. Questo vale anche nella schermata "Altro".
- Il pannello Filtri dell'Archivio usa il margine inferiore della safe area per tenere Ripristina e Applica sopra la barra di navigazione Android, anche con i tre pulsanti.
- Etichette tab e titoli schermata usano i18n (`t(...)`) per supportare inglese/italiano.
