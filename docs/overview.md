# Panoramica

Vega e una app Android e iOS per lo streaming di contenuti multimediali. La UI e costruita con React Native + Expo (SDK 54) e integra un sistema di provider esterni caricati dinamicamente. Il web non e supportato.

## Obiettivo principale
- Consentire all'utente di cercare contenuti, consultarne i dettagli e riprodurli.
- Supportare watchlist, cronologia, download e riproduzione con player interno/esterno.

## Flussi principali utente
1) Home
- Visualizza contenuti in base al provider attivo.
- Slider per categorie e hero in evidenza.
- Le card per episodi recenti e calendario mostrano il badge "Ep. X" quando disponibile.
- Le card con titoli AnimeUnity che includono "(ITA)" mostrano un badge "ITA" in alto a sinistra sul poster.
- I titoli nelle card di home/ricerca/lista possono andare su due righe con ellissi finale per ridurre il taglio aggressivo.
- La vista "more" del calendario usa una griglia con sezioni per giorno.
- La vista "more" del calendario include anche la sezione "Undetermined".
- L'hero usa una cache giornaliera (24 ore) per provider; il refresh manuale della home non invalida la selezione, che cambia solo a scadenza o se l'immagine hero risulta non valida.
- Per il titolo Hero, quando e disponibile un logo viene usata priorita: logo provider -> logo Cinemeta (fallback) -> titolo testuale.
- La home usa cache e refresh per categoria (chiave provider+filter): all'avvio vengono richieste solo le categorie stale, e una categoria con dati invariati non forza l'aggiornamento delle altre.
- Il refresh automatico della home e progressivo per sezione (non globale): all'avvio (e al cambio provider) le categorie stale vengono richieste a batch fino a 4 in parallelo, con priorita alle sezioni archivio/catalogo completo; inoltre lo stale-check viene triggerato su focus Home, resume app e con polling leggero ogni 1 ora solo quando Home e attiva.
- La lista verticale della Home e virtualizzata (FlatList): vengono montate principalmente le sezioni visibili e quelle vicine, riducendo memoria e lavoro sul thread JS rispetto a una ScrollView unica.
- Ogni slider in home gestisce loading/error in modo indipendente; un refresh di una sezione non blocca le altre gia mostrate.
- L'apertura swipe del drawer provider in Home usa un edge-handle dedicato sul bordo sinistro (16px) con gesture custom; il drawer nativo non ascolta piu l'apertura globale quando e chiuso. Durante i drag orizzontali degli slider il drawer resta temporaneamente bloccato e viene riabilitato con un piccolo delay.

2) Ricerca
- Ricerca per titolo o filtro.
- La schermata Search usa OMDb per suggerimenti rapidi e salva la cronologia locale.
- Risultati raggruppati per provider.
- La ricerca globale usa cache LRU (max 10 query): resta valida mentre la tab Search e attiva, poi scade dopo 10 minuti dall'uscita.
- La cache della ricerca globale include un fingerprint dei provider installati (value/version/lastUpdated) e una TTL interna: se cambiano provider o versione, la stessa query viene ricalcolata evitando risultati parziali.

3) Dettaglio contenuto (Info)
- Metadati, poster, trama e accesso alle sorgenti/episodi.
- Supporta vista Episodi e vista Correlati.
- Include controlli di chiusura e ritorno al contenuto precedente.
- Mostra il pulsante "Riprendi"; se non esiste riproduzione salvata mostra "Riproduci Ep. 1 00:00".
- La lista episodi mostra una barra di avanzamento per gli episodi gia iniziati.
- Il pulsante "Riprendi/Riproduci" cambia automaticamente pagina quando il provider usa range di episodi (es. AnimeUnity).
- Se il provider fornisce rating e generi, vengono mostrati; per AnimeUnity i generi compaiono sotto "Studio".
- Se manca l'imdbId ma il provider espone malId/anilistId (es. AnimeUnity), la UI prova a recuperare metadata esterni da AniList/Jikan.
- Per AnimeUnity la sinossi in Info usa sempre quella del provider, anche se sono presenti metadata esterni.
- Per AnimeUnity con malId/anilistId, i dettagli del provider in Info sono limitati a sinossi, stato e studio; generi/cast/anno/durata/rating usano i metadata esterni quando disponibili, con fallback al provider se mancanti.
- Per AnimeUnity il titolo mostrato in app usa sempre quello del provider.
- In Info, per AnimeUnity doppiati, viene mostrata la dicitura "Doppiato in italiano" sotto il titolo usando info.extra.flags.dub.

4) Player
- Riproduzione video con supporto a qualita, sottotitoli, controlli.
- Il pulsante "Next" appare quando mancano circa 90 secondi alla fine e passa al prossimo episodio; se esiste una stagione successiva apre il primo episodio.
- Per AnimeUnity, il pulsante "Skip Intro" appare quando AniSkip fornisce un intervallo OP/mixed-op e permette di saltare l'intro.
- Su Android e disponibile l'apertura in player esterno (es. VLC).
- Su Android e disponibile il cast nativo Google Cast (default) dal player e dalla selezione server.
- Il cast nativo usa una queue episodi (quando disponibile) e prova a mantenere il tracking progresso su cronologia/cache anche durante la riproduzione remota.
- E mantenuto anche Web Video Caster (WVC) come alternativa selezionabile in Preferenze -> Player -> Cast Provider.
- Se il cast nativo non parte, l'app chiede conferma prima di aprire WVC come fallback.
- Per usare WVC, l'app Web Video Caster deve essere installata sul telefono. In caso contrario l'app prova ad aprire lo store.
- L'app resta in verticale fuori dal player; il player blocca l'orizzontale.

5) Watchlist e Cronologia
- Salva e consulta elementi preferiti e gia visti.
- La sezione Continue Watching mostra il badge episodio quando disponibile.
- La pulizia della cronologia rimuove anche i progressi salvati.
- La rimozione di un titolo dalla cronologia azzera anche i progressi episodio.

6) Download
- Download locale con stato e gestione file.
- Per AnimeUnity il download in-app usa solo il server "AnimeUnity Download"; i server HLS non supportati vengono esclusi.
- Nella lista episodi di una serie (da Downloads) e possibile selezionare ed eliminare singoli episodi.

## Estensioni/Provider
- I provider sono moduli JS remoti che forniscono catalogo, metadata e stream.
- Il sistema supporta aggiornamenti automatici e installazione/rimozione.
- Per AnimeUnity, se un'immagine fallisce il caricamento in lista, viene cercato il poster dai metadata.
- Alcuni provider (es. AnimeUnity) usano una lista Pastebin per risolvere il base URL; i fallback restano nel provider.

## Persistenza dati
- Impostazioni utente, watchlist, cronologia e download vengono salvati in storage locale MMKV.

## Lingua e localizzazione (i18n)
- Lingue supportate: inglese e italiano (selezione in Preferenze).
- Al primo avvio, la lingua predefinita e italiano.
- Le stringhe UI usano `react-i18next` con chiavi in `src/i18n/en.json` e `src/i18n/it.json`.
- Per nuove funzionalita, aggiungere la chiave in entrambi i file e usare `t(...)` nei componenti o `i18n.t(...)` nei servizi.
