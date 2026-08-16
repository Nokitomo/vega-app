# Provider ed Estensioni

## Obiettivo
I contenuti non sono hardcoded: il catalogo e la logica di scraping/streaming vengono forniti da moduli esterni (provider) caricati dinamicamente.

## ExtensionManager
File: src/lib/services/ExtensionManager.ts
- Gestisce una o piu sorgenti provider configurabili dall'app.
- Se non esistono sorgenti locali, crea automaticamente la sorgente ufficiale:
  https://raw.githubusercontent.com/Nokitomo/vega-providers/refs/heads/main/manifest.json
- Migra i provider installati prima del supporto multi-sorgente associandoli alla sorgente di default.
- Gestisce installazione, aggiornamento e cache dei moduli separando manifest e moduli per sorgente.
- Supporta modalita test con baseUrl alternativo.

## Struttura dei moduli provider
Per ogni provider vengono scaricati file JS:
- posts.js (obbligatorio)
- meta.js (obbligatorio)
- stream.js (obbligatorio)
- catalog.js (obbligatorio)
- episodes.js (opzionale)

Nota: per AnimeUnity, il campo `filter` del catalogo puo includere query params per i filtri archivio. I valori possono essere passati in inglese e vengono normalizzati dal provider.
Esempi: `archive?order=rating`, `archive?type=tv&status=ongoing&genres=Action,Fantasy`.

## Contratto filtri (UI)
- `catalog.js` puo esportare `archiveFilters` con metadati (order, status, type, season, years, dubbed, genres).
- `ProviderManager.getArchiveFilters()` espone questi metadati all'interfaccia senza rendere obbligatoria l'esportazione: i provider meno recenti continuano a restituire un oggetto vuoto.
- `genres` espone scorciatoie per filtri di archive (usabili come sezioni o menu).
- AltadefinizioneZ include i filtri `catalog/all?sorting=popserie` e `catalog/all?sorting=popfilm` per le sezioni "Serie TV del momento" e "Film del momento" in home.
- StreamingUnity usa `browse/trending`, `browse/latest`, `browse/top10`, `browse/upcoming` e `browse/genre?g=...` per le sezioni home, oltre ad `archive` per l'archivio.
- Per le sezioni genre di StreamingUnity il provider usa i percorsi `browse/genre` (sito/API) invece del fallback `archive?genre[]`, cosi ordine e contenuti restano allineati al sito.
- In home app, per StreamingUnity le sezioni `archive?type=movie` e `archive?type=tv` restano nel catalogo provider ma vengono nascoste solo nella schermata Home.
- La UI rispetta anche `staleTimeMs: 0`: le sezioni casuali mostrano subito l'eventuale cache ma vengono aggiornate a ogni nuova attivazione della Home, invece di ereditare la cache lunga dell'archivio.

## i18n dai provider (AnimeUnity)
- Alcuni campi possono includere chiavi i18n opzionali per tradurre etichette in app.
- `catalog.js`: `titleKey`/`titleParams` per i titoli delle sezioni.
- `posts`: `episodeLabelKey`/`episodeLabelParams` (con fallback su `episodeLabel`).
- `meta` e `episodes`: `titleKey`/`titleParams` per titoli (stagioni/episodi e fallback titolo), `tagKeys` per tradurre tag.
- L'app usa le chiavi se presenti, altrimenti mostra il testo originale.
- Al momento queste chiavi sono usate solo da AnimeUnity e dai provider futuri.

## Campi card e artwork opzionali
- I post possono includere `rating`, `dubStatus`/`dubStatusKey` e `variants`. `variants` conserva destinazioni SUB e ITA dello stesso titolo mantenendo `link` come fallback retrocompatibile.
- Le card Home, ricerca, calendario e lista completa mostrano badge coerenti per episodio, disponibilita SUB/ITA e voto; i dati delle varianti vengono mantenuti nella navigazione verso Info.
- Quando un post contiene piu `variants`, Info mostra il selettore di versione e ricarica metadata, episodi, player e azioni libreria usando il link SUB/ITA realmente selezionato. Il `Post.link` originario resta la selezione predefinita.
- I metadata possono includere `logo`, `background`, `poster` e `trailers` (URL completi). Tutti i campi sono opzionali e non cambiano il contratto dei provider esistenti.

## Disponibilita contenuti futuri (upcoming)
- I provider possono valorizzare in `Info.linkList[]` i campi opzionali:
  - `availabilityStatus`: `upcoming` o `available`
  - `availabilityDate`: data normalizzata (`YYYY-MM-DD` o `YYYY`)
  - `availabilityPrecision`: `day`, `year` o `unknown`
- Quando una stagione/film e `upcoming` e non ci sono episodi/link, la UI mostra uno stato "In arrivo" con data (se disponibile) invece di una lista vuota.
- Implementato attualmente per: `streamingunity`, `altadefinizionez`, `animeunity`.
- Per StreamingUnity e attiva una reconciliation mirata per evitare falsi upcoming: se un titolo/stagione risulta `upcoming` ma con data non futura (es. data passata), il provider verifica la disponibilita reale.
- Film StreamingUnity: probe su `watch/iframe`; se viene rilevato un embed/playlist VixCloud valido (`/embed/<id>` o `/playlist/<id>`), il contenuto viene marcato `available`.
- Stagioni StreamingUnity: probe sulla pagina stagione; se `loadedSeason.episodes` contiene episodi, la stagione viene marcata `available`.
- Fail-safe: se la probe fallisce (timeout/rete/parsing), lo stato resta `upcoming` per non introdurre false disponibilita.
- Rationale: i campi editoriali sorgente (`status`/`release_date`) possono essere stale o incoerenti rispetto alla reale disponibilita stream.

## Metadati episodio/stagione per resume
- I provider possono valorizzare su `EpisodeLink` e `Link.directLinks[]`:
  - `episodeNumber`: numero episodio strutturato
  - `seasonNumber`: numero stagione reale (quando applicabile)
- La UI usa questi campi per:
  - badge episodio in "Continua a guardare"
  - etichetta del bottone resume (`Sx-Epy` per stagioni reali, `Epy` negli altri casi)
- Fallback retrocompatibile: se i campi mancano, la UI prova a estrarre il numero dal titolo episodio.

## Priorita metadati (sinossi)
- Quando sono presenti metadati esterni (Stremio per imdbId, AniList/Jikan per malId/anilistId), la UI usa quelli esterni.
- Se manca l'imdbId ma sono disponibili malId/anilistId, la UI prova prima AniList e poi Jikan.
- Per AnimeUnity, se mancano malId/anilistId non viene richiesto alcun metadata esterno.
- Per AnimeUnity la sinossi usa sempre quella del provider.
- Per AnimeUnity con malId/anilistId, i metadati del provider vengono usati per sinossi, stato e studio; generi/cast/anno/durata/rating usano i metadata esterni quando disponibili, con fallback al provider se mancanti.
- Per AnimeUnity il titolo mostrato in app usa sempre quello del provider.
- In Info, per AnimeUnity doppiati, viene mostrata la dicitura "Doppiato in italiano" sotto il titolo usando info.extra.flags.dub.
- Per AltadefinizioneZ la sinossi viene sempre dal provider (anche se esistono metadati esterni).
- Per StreamingUnity la sinossi usa sempre quella del provider; se manca fa fallback ai metadati esterni.
- Per StreamingUnity il titolo mostrato in app usa prima il logo del provider (se presente); altrimenti la traduzione italiana se diversa dall'originale o con caratteri latini, ma se coincide con l'originale e contiene CJK viene ignorata; poi inglese con la stessa regola, quindi lo slug normalizzato e infine il titolo originale.
- Per AltadefinizioneZ gli altri metadati del provider sono usati solo se i metadati esterni sono assenti.
- Per StreamingUnity, quando sono presenti metadati esterni (imdbId), la UI usa fallback per campo: anno, durata, rating, generi e cast usano prima i metadati esterni e, se mancanti, i corrispondenti campi del provider; il badge "Episodi" usa sempre il conteggio del provider.
- In assenza di metadati esterni, la UI usa i campi del provider (anno, durata, rating, generi, cast) per popolare le stesse sezioni mostrate con Stremio.
- Per AltadefinizioneZ e StreamingUnity, quando mancano metadati esterni, lo sfondo in Info usa il background del provider se disponibile.
- In Home, per StreamingUnity l'hero viene estratto dall'archivio con filtro casuale (`archive?random=true`) per evitare una selezione limitata alle sole sezioni in pagina.
- Se un'immagine esterna non e caricabile (es. 404), la UI fa fallback alle immagini del provider quando disponibili.
- Se l'immagine dell'hero fallisce, il titolo viene scartato e si seleziona un altro hero casuale.
- Se i metadati esterni falliscono ma il provider risponde correttamente, la scheda Info resta disponibile usando i dati del provider.

## ProviderManager
File: src/lib/services/ProviderManager.ts
- Esegue i moduli in un contesto isolato (new Function).
- Espone API per catalogo, ricerca, metadata, stream, episodi.
- Usa providerContext con axios, cheerio, estrattori e utility.
- I provider possono fornire piu stream per lo stesso episodio (es. AnimeUnity via VixCloud Server1/Server2 con fallback Download e varianti qualita da master playlist).
- Nel player, su errori HTTP 403/503, viene fatto un refetch dei link stream per rigenerare i token prima di provare altri server, con cooldown per server e riuso della cache stream su mount.
- Nel player, quando si arriva all'ultimo episodio di una stagione, il passaggio alla stagione successiva usa prima `directLinks`/cache locale e, se mancanti, prova un fetch on-demand tramite `getEpisodes` (se il provider espone `episodes.js`) per mantenere il tasto "Avanti" anche cross-stagione.
- I messaggi utente (errori e toast relativi ai provider) sono localizzati via i18n.
- Se i provider restituiscono `Stream.headers`, l'app li usa per scaricare i sottotitoli esterni protetti e li salva in cache locale, poi li passa al player come file locali.
- Se sono presenti sottotitoli esterni, il player attende brevemente il loro download prima di avviare lo stream; se arrivano in ritardo, viene fatto un solo reload automatico per agganciarli.

## ProviderContext
File: src/lib/providers/providerContext.ts
- axios, cheerio, Crypto (expo-crypto)
- headers comuni e funzioni di estrazione (hubcloud, gofile, gdflix, superVideo)
- `openWebView(url, options)` per provider che devono risolvere una challenge WAF/captcha da WebView.
- `openWebView` mostra un dialog WebView globale, carica solo URL `http/https`, puo attendere un cookie specifico (`waitForCookie`, es. `cf_clearance`) e restituisce HTML renderizzato, cookie string e cookie map al provider.
- I cookie WebView vengono letti tramite `@preeternal/react-native-cookie-manager`; su Android il modulo e autolinkato nel dev client. Su iOS va rieseguito il normale flusso Pods quando si aggiorna il progetto nativo.

## Storage provider
- ExtensionStorage gestisce sorgenti provider, cache locale per sorgente e stato installato/abilitato.
- UpdateProvidersService verifica versioni per sorgente e aggiorna automaticamente.
- Le cache di catalogo, metadata, episodi e stream includono sorgente, nome e versione del modulo provider. Dopo un aggiornamento l'app sincronizza subito il provider attivo e rimuove soltanto le query della vecchia versione, senza cancellare cronologia, watchlist o preferenze.
- Le notifiche di aggiornamento provider usano testi localizzati.

## Dove stanno i provider
- I provider non sono hardcoded nel repository dell'app.
- Sono moduli JS ospitati su GitHub e scaricati a runtime.
- Sorgente ufficiale predefinita: `Nokitomo/vega-providers`
- Sorgenti aggiuntive: configurabili dal tab "Disponibili" del Provider Manager.
- Le nuove sorgenti vengono validate scaricando `manifest.json` prima di salvarle nello storage locale.
- Non esiste un backend privato: l'app consuma solo risorse pubbliche via HTTP.

## Dipendenze DNS e rete
- I provider eseguono chiamate HTTP direttamente dal device utente verso i domini target.
- Se il resolver DNS del device/rete restituisce `NXDOMAIN` o blocca un dominio provider, la chiamata fallisce prima della risposta HTTP.
- In questo scenario e possibile vedere provider installato ma risultati vuoti, anche con moduli corretti.
- Mitigazioni lato utente: DNS privato affidabile, app DNS (es. `1.1.1.1`) o VPN.
- Questo comportamento puo colpire solo alcuni provider e non altri, nella stessa installazione.

## Come aggiungere provider personalizzati
- Devi pubblicare un tuo set di provider (manifest + moduli JS) in un repository GitHub accessibile pubblicamente.
- Dal Provider Manager, tab "Disponibili", usa il selettore sorgenti e aggiungi un autore GitHub o un URL `github.com`/`raw.githubusercontent.com`.
- L'app converte la sorgente in URL raw GitHub, scarica `manifest.json`, salva la sorgente solo se il manifest e valido e mantiene cache/update separati per autore.
