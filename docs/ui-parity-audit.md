# Audit UI del 2 novembre 2026

Verifica delle route di `src/App.tsx`, dei componenti condivisi e dei pannelli
secondari dopo i tre interventi su cronologia, impostazioni e libreria download.

## Pagine allineate

- Home, ricerca provider e ricerca globale, Info.
- Lista da guardare: mantiene intenzionalmente la griglia con card coerenti
  con la Home, come richiesto dall'utente.
- ScrollList, catalogo/archivio/calendario.
- ContinueWatchingAll e WatchHistory: font, card e griglia adattiva condivisi.
- Settings, Preferences, Account, SubtitleSettings, About, Extensions e
  componenti per DNS, chiavi, cartella download e provider.
- Downloads e SeriesEpisodes: presentazione aggiornata, motore invariato.

Info viene riutilizzata negli stack Home, ricerca, preferiti e cronologia;
ScrollList negli stack Home e ricerca. Non esistono copie separate di queste
pagine nelle route che richiedano una seconda migrazione. InfoDialog e
InfoSeasonPicker appartengono gia al lavoro sulla pagina Info.

## Presentazioni ancora distinte

1. `Player.tsx`, `PlayerMenuRow`, `PlayerEpisodeSidebar`: successivamente
   aggiornati con font e pannelli coerenti con la Home e numero episodio
   visibile nella lista e nel titolo delle serie. Verifiche e limiti in
   `player-cruncy-ui.md`; motore e callback di riproduzione invariati.
2. `DownloadBottomSheet`, usato da `Downloader`: successivamente aggiornato
   con font, superfici e accenti coerenti. Verifiche e limiti documentati in
   `download-panel-cruncy-ui.md`; vale anche per la variante apertura server.
3. `WebView.tsx`, condivisa da Home e ricerca: intestazione e pannello AdBlock
   successivamente aggiornati; il contenuto del sito resta esterno.
4. `WafWebViewDialog`: cornice e controlli successivamente aggiornati,
   mantenendo il flusso tecnico. Verifiche e limiti di entrambi gli interventi
   in `browser-waf-cruncy-ui.md`, inclusa la mancata prova nativa Gecko.

`StreamModal` non risulta importato da altri file in src; la route
`DisableProviders` e commentata. Non sono schermate attive da presentare
come regressioni visive. I dialoghi nativi restano gestiti dal sistema.

## Limiti della conclusione

I tre interventi sono completati nel loro ambito UI. Questo non certifica
assenza assoluta di bug su ogni dispositivo o parita pixel per pixel con
Crunchyroll. Funzioni esclusive di Vega mantengono la propria organizzazione.
Restano esclusi motore player/download, loghi scuri e scritte incorporate
nelle immagini. iOS e smartphone fisico richiedono verifiche dedicate.

Verifiche di questo ciclo: TypeScript, lint, suite completa 64/309; prove
Android smartphone e tablet documentate in history-cruncy-ui.md,
settings-cruncy-ui.md e downloads-cruncy-ui.md. Gli emulatori sono stati
eseguiti anche separatamente per limitare la pressione sulla RAM dell'host.
