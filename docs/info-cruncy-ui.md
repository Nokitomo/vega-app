# Scheda Info: presentazione coerente con la Home

## Ambito

Restyling in sei passaggi: copertina/toolbar, informazioni/dettagli,
azioni fisse, tab/stagioni, righe episodio, stati e adattamento.
Il tocco sugli episodi conserva il player attuale; non viene aggiunta
una pagina intermedia obbligatoria. Metadata, fallback, provider,
varianti, progressi, download e player esterni devono restare invariati.

Info e condivisa dagli stack Home, ricerca, preferiti e cronologia.
Le verifiche devono comprendere gli ingressi e il ritorno tra correlati.

## Riferimento

Crunchyroll Android 3.126.0, report e APK locali in
`C:/dev/app_streaming_kotlin_compose/docs/research/crunchyroll-mobile/`.
`activity_show_page.xml` e le risorse `show_page_hero_aspect_ratio`
indicano 2:3 su smartphone e 16:9 da sw600dp. Le acquisizioni runtime
confermano logo centrato, toolbar con titolo durante lo scroll,
CTA fissa, picker stagioni separato e ordinamento Oldest/Newest.

Il 2 novembre 2026 il tocco su un episodio di Frieren ha aperto la pagina
episodio (titolo, sinossi, menu, prossimo episodio e All Episodes).
L'account ha mostrato il blocco Premium: playback non verificato.
Acquisizioni locali su D:, cartella `codex-temp/vega-search-cards-20261030`,
prefisso `info-crunch-`. Nessun artefatto binario e incluso in Git.

## Passaggio 1: copertina e toolbar

La copertina usa la larghezza misurata del contenitore e le proporzioni
del riferimento; il blocco titolo puo crescere per testi ingranditi.
Logo centrato, titolo testuale senza taglio forzato, voto conservato.
La toolbar rispetta gli inset e interpola sfondo/titolo durante lo scroll.
Chiudi conserva il ritorno allo stack originario; Indietro tra opere
correlate conserva la navigazione precedente.

TypeScript e lint superati. Superati 17 test nelle suite artworkSelection,
animeArtwork ed EpisodeMetadata. Un timeout di EpisodeMetadata durante
il bundling Android non si e ripetuto nella riesecuzione isolata, senza
modificare test o timeout.

Verifica su Medium_Phone_API_35 con dev client e Metro su D:: scheda Naruto
aperta dai preferiti con copertina, logo e metadata caricati; scroll fino agli
episodi con toolbar opaca e titolo visibile; chiusura con X torna ai preferiti.
Apertura di un correlato verificata; il provider non ha restituito dati e il
pulsante Indietro dello stato errore ha ripristinato la scheda precedente.
Screenshot locali `resume-naruto.png`, `info-step1-toolbar-full.png`,
`info-step1-error-back.png` e `info-step1-close.png` nella cartella sopra.

Limiti: StreamCenter ha restituito errori di rete e il caricamento remoto del
correlato non e stato validato. Nessuna modifica a networking o provider.
Tablet, testo ingrandito e verifica iOS restano nella matrice del passaggio 6;
iOS richiede un dispositivo con build compatibile. I warning runtime osservati
riguardano il ciclo di import del downloader, SafeAreaView deprecata e Legacy
Architecture, componenti non modificati da questo passaggio. Un ANR della Home
prima della prova non si e ripetuto durante la navigazione della scheda.

## Passaggio 2: informazioni e dettagli

Metadata compatti con font Home; sinossi limitata a tre righe nella scheda.
Altri dettagli apre una vista scorrevole con sinossi integrale, cast, premi
e informazioni aggiuntive alle stesse condizioni di disponibilita precedenti.
Premi e cast non vengono piu troncati nel dettaglio. Varianti, trailer,
preferiti e menu restano disponibili; selezione e preferenze metadata invariate.

TypeScript e lint superati (corretto un warning di spazi finali).
Su Medium_Phone_API_35 verificati caricamento reale di Dexter: Resurrection
con StreamingUnity, apertura dettagli, chiusura con Back Android e con X,
e ritorno agli episodi. Evidenze locali `step2-dexter-ready.png`,
`step2-details-final.png`, `step2-details-back.png`, `step2-episodes.png`.
AnimeUnity indisponibile secondo conferma dell'utente: i successivi test
remoti usano StreamingUnity. Nessuna modifica ai provider.

## Passaggio 3: azioni fisse

Barra Riproduci/Riprendi e Preferiti come elemento flex sotto la lista,
che riserva spazio senza coprire gli episodi. SeasonList espone solamente
stato visuale e riferimento al suo handleResume esistente: nessuna nuova
query o logica di selezione. Resta montata nei correlati per mantenere
stagione, filtro, progressi e azione; il contenuto nascosto non occupa spazio.
La CTA e disabilitata durante caricamento/errore senza episodi disponibili.

TypeScript e lint puliti; 35 test superati su continueWatchingFixes,
episodesThroughTarget e prePlayEpisodes. Su Medium_Phone_API_35 StreamingUnity:
avvio del primo episodio di Dexter dal pulsante fisso e riproduzione osservata
(tempo avanzato a 00:05); ritorno dal player senza crash. Verificati anche
film Drive, barra durante scroll e nei correlati, aggiunta e rimozione dai
preferiti (stato originario ripristinato). Evidenze `step3-footer.png`,
`step3-player-exit.png`, `step3-film-save.png`, `step3-related.png`.
