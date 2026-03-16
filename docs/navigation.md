# Navigazione

## Root
- RootStack (createNativeStackNavigator)
  - TabStack
  - Player (landscape)

## Orientamento
- Gestione centralizzata in `src/App.tsx`: portrait per tutte le schermate, landscape solo per `Player`.

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
- WatchHistoryStack
- SubTitlesPreferences

## Note UI
- Tab bar personalizzata con haptic feedback opzionale, padding bottom dinamico (safe area) e offset verso l'alto calcolato in base al font scale quando le etichette sono attive, per evitare sovrapposizione con la barra di sistema su Android.
- Su Android la navigation bar e nascosta di default (immersive); riappare temporaneamente con swipe dal basso.
- Uso di SafeAreaView e tema scuro custom.
- In Info, il pulsante X torna alla schermata precedente senza reset dello stack.
- Preferenze: "Show Tab Bar Labels" controlla la visibilita delle etichette nella tab bar; "Show Recently Watched" abilita/disabilita la sezione Continue Watching in Home (attivo di default).
- Da Home, il pulsante "Vedi tutti" della sezione Continue Watching apre `SettingsStack -> WatchHistoryStack -> WatchHistory`.
- Etichette tab e titoli schermata usano i18n (`t(...)`) per supportare inglese/italiano.
