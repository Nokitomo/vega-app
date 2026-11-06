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

## Passaggio 4: tab e stagioni

Tab Episodi/Correlati con sottolineatura e stato accessibile. Selettore stagioni
in modal a schermo intero con lista virtualizzata e indicazione della scelta.
Usa gli stessi oggetti, etichette localizzate, ordine e handleSeasonChange.
Non altera catalogo, ricerca o ordinamento degli episodi.

TypeScript e lint superati. Su Medium_Phone_API_35: ricerca StreamingUnity di
Breaking Bad, apertura dai risultati, picker con cinque stagioni, selezione
stagione 2 e verifica episodi (Tutto cambia, Grigliato). Passaggio Correlati /
Episodi conserva stagione 2; riapertura e Back chiudono senza cambiare scelta.
Evidenze `step4-picker.png`, `step4-season2.png`, `step4-season2-rows.png`.

## Passaggio 5: righe episodi

Miniature 16:9 fino a 160 dp, numero episodio, titolo e sinossi con font Home.
Download e menu esplicito sono azioni separate dal target di riproduzione;
il menu richiama le azioni esistenti, disponibili anche con pressione lunga.
Fallback senza miniatura, filler, progressi e controller restano invariati.
Rimosso il calcolo fisso di altezza dei link diretti, ora ad altezza variabile.

TypeScript, lint e tre test EpisodeMetadata superati. StreamingUnity sul telefono:
numero e titolo visibili, ordinamento crescente/decrescente, menu episodio e
selettore server download verificati; nessun download avviato. Evidenze
`step5-fresh-rows.png`, `step5-options.png`, `step5-download.png`, `step5-sort.png`.
Il tap della miniatura apre il player; la successiva riproduzione non e stata
confermata per un blocco dell'emulatore anche sui comandi ADB. La riproduzione
era stata osservata al passaggio 3; nessuna modifica al player in questo punto.
Metro in watch mode ha avuto un errore infrastrutturale; riavviato in modalita
CI senza watcher per caricare il bundle aggiornato, senza cambiare configurazioni.

## Passaggio 6: stati e responsive

Caricamento iniziale non interattivo con scheletro, etichetta accessibile e X
sempre disponibile. Scheletro episodi allineato alle nuove righe; errori con
accento del tema e retry disabilitato durante la richiesta. Il selettore stagioni
resta disponibile in caso di errore episodi. Ricerca senza corrispondenze distinta
dal catalogo senza stream; ricerca e ordinamento hanno etichette accessibili e
target di almeno 48 dp. Nessuna modifica a richieste, retry di rete o metadata.

Colonna centrale e azioni limitate a 840 dp sui tablet, sfondo nero a tutta
larghezza sotto il hero. Il test tablet ha rilevato e permesso di correggere
strisce della copertina ai lati della colonna durante lo scroll. Transizione
toolbar anticipata per evitare la sovrapposizione con il logo; reset di scroll
animato e stato CTA quando caricamento iniziale/errore smontano la lista.

Verifiche Android con StreamingUnity:
- Medium_Phone_API_35: Dexter, testo al 150%, righe ad altezza variabile, barra
  Riprendi leggibile, ricerca senza risultati e toolbar durante scorrimento.
- Medium_Tablet_API_35: Breaking Bad e Lupin; verticale/orizzontale, passaggio
  da tab inferiori a rail laterale, picker e selezione stagione 4, righe e barra
  azioni entro i margini, senza strisce laterali dopo la correzione.
- Caricamento iniziale reale osservato sul tablet. Errore Info simulato solo
  nello stato React Query in memoria (data null/status error), senza modificare
  provider o storage persistente; Riprova ha recuperato il contenuto reale.
- TypeScript e lint puliti. 46 test mirati su artworkSelection,
  EpisodeMetadata, adaptiveNavigation, episodesThroughTarget e continueWatchingFixes.

Evidenze locali nella cartella indicata sopra: `step6-large-episodes.png`,
`step6-empty-back.png`, `step6-tablet-hero-detail.png` (caricamento reale),
`step6-tablet-portrait.png`, `step6-tablet-picker.png`,
`step6-tablet-landscape-final.png`, `step6-error-sim.png`, `step6-retry-result.png`.
I primi tentativi di simulazione sul telefono non hanno prodotto uno stato
visibile attendibile e non sono conteggiati come test superati.
Ripetuto errore/riprova sul bundle finale: query tornata success con dati reali
e toolbar trasparente dopo il recupero (`step6-toolbar-recovered.png`).
Ripristinate le preferenze di rotazione tablet precedenti e la scala testo del
telefono. Screenshot e script diagnostici restano fuori Git su D:.

Limiti: iOS non verificato in questo ambiente; AnimeUnity indisponibile e quindi
non usato per test remoti. Player e download end-to-end non certificati da questo
intervento UI; resta il blocco emulatore descritto al punto 5. Gli stati e le
funzioni esclusivi di Crunchyroll non presenti in Vega non vengono aggiunti.
La copertura non equivale a una garanzia di assenza di bug su ogni dispositivo.

## Passaggio 7: confronto diretto e layout tablet (2026-11-02)

Il limite centrale di 840 dp descritto al passaggio 6 e stato sostituito.
Confronto effettuato dopo login su Crunchyroll Android 3.126.0, sullo stesso
Medium_Tablet_API_35 (2560x1600, densita 320): schede di Hello, I am a Witch
e Our Last Crusade, in verticale e orizzontale, episodi, correlati, stagioni
e dettagli. Il layout APK `layout-sw600dp-land/activity_show_page.xml`
conferma la divisione 0.63 osservata sul dispositivo.

- Tablet orizzontale con almeno 900 dp disponibili: riepilogo al 63%, episodi
  e correlati al 37%; scorrimenti indipendenti, tab fissi sul pannello destro
  e azioni fisse sotto quello sinistro. Il rail Vega resta disponibile.
- Verticale: pagina unica, episodi su due colonne da 720 dp disponibili;
  correlati su cinque colonne (due nel pannello orizzontale). Le finestre
  piu strette mantengono il riepilogo sopra gli episodi.
- Stagioni e dettagli: dialog centrali scuri su tablet, chiusura a destra;
  su smartphone rimangono a schermo intero.
- Logo allineato a sinistra su tablet; CTA a pillola su entrambe le classi
  di dispositivo. Il riferimento smartphone archiviato conferma la forma
  arrotondata, correggendo la precedente interpretazione squadrata.
- Testo CTA iniziale condiviso con Home tramite heroCtaKey: serie "Inizia a
  guardare E1", film "Riproduci". Riprendi, prossimo episodio e ricomincia
  mantengono la selezione di riproduzione esistente. Nessun cambiamento a
  handler, preferenze metadata, fallback immagini o classificazione provider.
- La struttura dei componenti resta stabile durante la rotazione: stagione
  e filtro non si perdono. Gli scroller disabilitati azzerano il loro offset
  per evitare contenuto fuori schermo passando da una disposizione all'altra.

Verifiche: TypeScript e lint puliti; 37 test in sei suite (InfoAdaptiveLayout,
infoCta, heroCta, EpisodeMetadata, continueWatchingFixes, adaptiveNavigation).
Il test di rotazione controlla che lo stato della stagione sopravviva e non
compaiano CTA duplicate; i test CTA includono una serie terminata con 12 episodi,
che non deve essere trattata come film.

Su dev client Android con StreamingUnity: Breaking Bad, cinque stagioni,
selezione stagione 2, rotazioni ripetute, scorrimento fino al tredicesimo episodio
in verticale e ritorno in orizzontale, dettagli, chiusura dialog con Back.
Sul bundle finale ricontrollati CTA serie, picker, film El Camino (Riproduci),
correlati popolati e scorrimento indipendente, aggiunta/rimozione preferito con
ripristino dello stato iniziale. Scala testo al 150% verificata su serie in
entrambi gli orientamenti, inclusi episodi e correlati; poi ripristinata a 100%.
Ripristinata anche la preferenza iniziale di rotazione tablet (disattivata)
e le impostazioni Android di rotazione automatica precedenti.

Evidenze locali fuori Git in `D:\codex-temp\vega-search-cards-20261030`:
`crunchy-tablet-landscape-clean.png`, `crunchy-tablet-long-list.png`,
`crunchy-tablet-portrait-top.png`, `crunchy-tablet-season-landscape.png`,
`crunchy-tablet-details.png`; risultato finale `final-series-ready.png`,
`final-season-picker.png`, `final-film-check.png`, `final-details.png`,
`final-film-related.png`, `final-related-bottom.png`,
`final-film-bookmark.png`, `final-bookmark-restored.png`,
`final-large-series-ready.png`, `final-portrait-large.png`,
`final-portrait-related.png`. Le precedenti prove di scorrimento sono in
`vega-tablet-portrait-bottom2.png` e `vega-tablet-rotate-from-bottom.png`.

Limiti del confronto: questa e la riproduzione della struttura tablet adattata
alle funzioni Vega, non una certificazione di identita pixel per pixel.
Restano intenzionalmente ricerca/ordinamento, sinossi degli episodi, overlay
Play, valutazioni e dati provider di Vega: le righe episodi risultano quindi
piu alte del riferimento. Il dialog dettagli mantiene i campi informativi Vega.
Non sono state introdotte funzioni esclusive del servizio Crunchyroll.
In questo passaggio non sono stati avviati stream o download, come richiesto;
iOS e nuovi test runtime su smartphone non eseguiti. AnimeUnity indisponibile.
Il renderer software dell'emulatore si chiudeva durante l'uso di Crunchyroll;
le prove sono state completate con GPU host e Vulkan disabilitato, senza
cancellare dati o sessione di login dell'AVD.

## Correzione sfondo schede Info (3 novembre 2026)

La fascia Episodi/Correlati ha ora uno sfondo nero opaco. In verticale,
l'immagine collocata dietro il contenuto scorrevole poteva essere visibile
attraverso questa fascia, prima trasparente. Non cambiano dimensioni, colonne,
rotazione, selezione delle schede, callback o preferenze dei metadati.

Verifica visiva sul dispositivo affidata all'utente: nessun emulatore avviato
per questo intervento, come richiesto. Controllare lo scorrimento della pagina
Info e il cambio scheda su smartphone e tablet nei due orientamenti.

TypeScript (`npx tsc --noEmit`) e lint superati senza diagnostiche.
Suite automatica completa: 70 suite e 326 test superati, incluso il controllo
di conservazione dello stato e della CTA durante le rotazioni del layout Info.

## Riproduzione e card dei film (6 novembre 2026)

La CTA fissa risolve anche i film con un solo link diretto senza numero episodio
(per esempio StreamingUnity). Prima cercava implicitamente l'episodio 1 e non
trovava il link intitolato `Play`. Restano prioritarie le corrispondenze per link,
titolo e numero; il recupero dell'unico elemento valido si applica solo ai film.
Non viene scelto arbitrariamente un elemento tra piu parti e le serie mantengono
il comportamento precedente.

I film con link diretti mostrano una card con immagine, titolo e sinossi al posto
della riga testuale Riproduci. Resta cliccabile, con download e menu invariati.
Le card dei film con episodi conservano i metadati dedicati. In assenza di
thumbnail, o se non si carica, viene usato il background effettivamente mostrato
in Info; se anche questo fallisce rimane un riquadro 16:9 con icona Play.
Non cambiano le preferenze dei servizi/lingue, gli identificativi dei contenuti,
i dati inviati al player o i criteri di scelta delle immagini nella scheda Info.
La singola sezione di un film non ripete piu il titolo generico Riproduci.

Controlli automatici: TypeScript e lint senza diagnostiche; suite completa,
77 suite e 372 test superati. Copertura dedicata per film senza numero,
film anime numerati, precedenza della ripresa, film multipart e serie, oltre
al fallback delle immagini e alla conservazione del layout in caso di errore.

Dev client Android su Medium_phone_API_35: verificati la nuova card su
Inception e Cunk on Life, l'apertura del player dalla CTA fissa (anche su
Inception senza cronologia precedente), il menu della card e l'apertura del
pannello download. Controllata anche la presentazione della serie Black Doves:
episodi numerati, stagione e CTA Inizia a guardare E1 conservati.
Screenshot locali fuori Git in `D:/codex-temp/final-ui-20261102`, prefisso
`movie-fix-`, in particolare `movie-fix-inception-card.png`,
`movie-fix-cunk-card.png` e `movie-fix-cunk-player.png`.

Limiti: su Inception il player ha restituito un errore video dopo l'apertura;
la riproduzione completa non e certificata da questa prova. Nessun download
completo o cast eseguito. AnimeUnity coperto dai test sul contratto degli episodi
numerati, non da una prova live del provider; iOS non verificato. Layout tablet
e rotazioni coperti dalla suite automatica, non da un nuovo test su tablet.
