# Ricerca home: geometria e scorrimento (2026-10-29)

Stato: fix geometrico verificato e committato in `3236a09` su `cruncy-ui`.
Il report raccoglie il reverse engineering Android della home; distingue
misure, osservazioni, differenze intenzionali e limiti del campione.

## Come usare il report

- Per correggere la toolbar: formula e catena di chiamate nella sezione Toolbar.
- Per il carosello: geometria nelle evidenze statiche e acquisizioni delle sei
  pagine; animazioni gia documentate in `home-cruncy-ui.md`, sezione del 28 ottobre.
- Per pianificare i prossimi interventi: matrice e priorita nelle sezioni finali.
- I file di prova sono locali, in `.codex/screenshots/home-research-20261029/`,
  esclusi da Git. Gli XML e le immagini originali usano pixel fisici; i provini
  JPEG sono ridotti e non vanno usati per misurare distanze.

## Perimetro

Correggere l'altezza variabile del carosello Vega, confrontare la home Android
di Crunchyroll e documentare le differenze ancora da implementare. Conservare
funzioni Vega, servizi, lingue e ordine dei fallback dei metadata. La protezione
dei loghi scuri e esclusa per richiesta dell'utente.

## Evidenze statiche confermate

Riferimento locale: `C:/dev/app_streaming_kotlin_compose/docs/research/crunchyroll-mobile/artifacts/`.
Campione decompilato: Crunchyroll 3.126.0; la versione runtime va ricontrollata.

- `jadx-fallback/sources/pr/l.java` (HeroCarousel.kt), righe 220-231:
  il pager riceve `fillMaxWidth(1)` e un rapporto 0.6666667 su smartphone,
  2.0 su tablet. Il rapporto e larghezza/altezza: sul telefono l'altezza
  del pager corrisponde a 1.5 volte la larghezza. Questo non comprende
  automaticamente indicatori e altri elementi esterni al pager.
- `androidx/compose/foundation/layout/b.java` conferma che il modificatore
  crea un `AspectRatioElement`; `layout/h.java`, metodo `e`, conferma
  `fillMaxWidth`. `uf0/d.java`, metodo `b`, legge la risorsa 0x7f05000c,
  denominata `isTablet` in `apktool-base/res/values/public.xml`.
- Vega `src/components/Hero.tsx`: la card usa `minHeight`, uno spacer con
  altezza minima e un blocco contenuti di altezza intrinseca. Titolo testuale
  fino a tre righe, logo, generi e sinossi hanno ingombri diversi. Solo la
  slide visibile partecipa al flusso; uscente e precaricate sono assolute.
  Ne consegue che superare l'altezza minima puo spostare indicatori e righe.
  La riproduzione runtime dei casi segnalati resta da completare.
- `src/components/HomeHeader.tsx` seleziona direttamente `#141519` oppure
  `transparent` dal booleano `scrolled`: non interpola il colore.

## Acquisizioni iniziali

AVD usato: Medium_Phone_API_35, seriale emulator-5556. Nessuna cancellazione
dei dati; connessione ADB ripristinata dopo rimozione di client di lettura
orfani diretti esclusivamente a questo emulatore.

Immagini locali escluse da Git: `.codex/screenshots/home-research-20261029/`.
`vega-streamcenter-before-0.png` ... `vega-streamcenter-before-5.png` e il provino
`comparison-before.jpg` documentano il primo campionamento. In queste immagini
CTA e indicatori restano allineati; l'ultimo tentativo torna alla prima slide,
quindi non prova l'acquisizione di sei contenuti distinti. Non e ancora prova
di assenza del difetto. Nessun fix applicato in questa fase.

## Piano iniziale (completamenti descritti nelle sezioni successive)

- Riproduzione con AnimeUnity e StreamCenter e misura degli spostamenti.
- Confronto runtime Crunchyroll: limiti del pager, indicatori, scroll e topbar.
- Correzione stabile al cambio slide, con controlli di caratteri ingranditi,
  titolo senza logo, sinossi e azioni, senza tagliare contenuti accessibili.
- Test mirati, TypeScript, lint e verifica emulatore prima del commit su cruncy-ui.
- Registrazioni di gesti e stati della home; distinzione tra osservazioni,
  parametri ricavati dal codice e comportamenti non verificabili.

## Confronto runtime Crunchyroll acquisito

Versione installata confermata con Package Manager: 3.126.0. AVD 1080x2400 px,
densita 420 dpi. Il renderer `swiftshader_indirect` ha bloccato nuovamente
l'emulatore durante lo splash (anche le richieste getprop/dumpsys scadevano).
Riavviato lo stesso AVD con `-gpu host -feature -Vulkan`, conservando userdata:
login mantenuto, home caricata, acquisizioni e input nuovamente funzionanti.
Non attribuire i tempi di questi tentativi alle prestazioni dell'app.

- Sei selezioni tramite indicatori: `cr-slide-0..5.png` e corrispondenti XML.
  In tutte le sei acquisizioni `Trending in Italy` ha bounds
  `[42,1788][412,1832]`: altezza del blocco superiore stabile fra le slide.
- `cr-home-carousel.mp4`: registrazione delle selezioni (40 secondi).
- `cr-home-scroll.mp4`: scroll lento, ulteriore scroll, ritorno parziale e
  nuovo tocco Home. `cr-scroll-small/medium/large/reverse/reselect.png` e
  `cr-scroll-contact.jpg` mostrano toolbar parzialmente e completamente opaca.
  Il nuovo tocco Home riporta in cima. Il banner Premium scompare durante
  lo scroll e ricompare in cima; non e una funzione da aggiungere a Vega.
- Il carosello cambia contenuto anche mentre la home e parzialmente scorsa
  (Apothecary Diaries -> A Returner's Magic nelle acquisizioni). Vega sospende
  l'autoplay al primo offset positivo: differenza osservata da discutere,
  non modificata implicitamente dal fix geometrico.

## Toolbar: formula ricavata dal codice

`zq/i3.java` (ToolbarOpacityHandler.kt) osserva indice e offset del primo item
della lista. Passa `cr.k(verticalScrollOffset, feedHeight)` al listener; quando
l'indice supera zero usa Integer.MAX_VALUE come offset, saturando il risultato.
`kn0/j1.java` calcola `clamp(offset / (feedHeight * 0.3), 0, 1)` e invia
l'evento `mainv2.c.t`. Il reducer `mainv2/e.java` aggiorna il campo float
`kn0.n.f40574f`, passato alla UI da `mainv2/d.java`.
Il percorso parallelo `qm0/e.java` usa la medesima formula e ArgbEvaluator
da trasparente a nero. Il comportamento runtime della home conferma una
comparsa progressiva, reversibile durante il gesto, fino al fondo opaco.
Non e corretto sostituirlo semplicemente con un fade temporale al primo pixel.

Vega `src/screens/home/Home.tsx:223` usa invece `offset > 0` e
`HomeHeader.tsx:117` seleziona immediatamente un colore pieno. Una futura
implementazione dovra conservare separati l'offset visivo e le decisioni
funzionali (ad esempio pausa autoplay), evitando di alterarle accidentalmente.

## Riproduzione e prima verifica del fix geometrico

Nel campione corrente AnimeUnity a scala 1.0 i sei contenuti non superano
l'altezza minima. A scala caratteri Android 1.5 il difetto si riproduce:
`anime-largefont-before.png` (Reideen, sinossi tre righe) e
`anime-longtitle-before.png` (Tenken, sinossi due righe; il nome del file non
descrive correttamente il contenuto) mostrano indicatori e intestazione
`Ultimi episodi` a quote diverse. Il problema dipende dallo spazio richiesto
dai contenuti, non da una diversa immagine richiesta al provider.

Prima implementazione: altezza esplicita comune, rapporto smartphone 2:3 quando
lo spazio e sufficiente; un budget indipendente dalla slide riserva spazio ai
testi ingranditi e alle azioni. Lo spacer ora assorbe lo spazio residuo senza
imporre un minimo che allarghi il contenitore. Layout dello skeleton e delle
slide usa la stessa funzione. Nessuna modifica ai metadata o alle animazioni.

Prima verifica a scala 1.5: `anime-fixed-large-0..5.png`, con indicatori grigi
sempre tra y=1729 e y=1746 px. La seconda acquisizione contiene una transizione
e un banner del dev client, quindi non prova da sola l'aspetto assestato del
titolo testuale; acquisizione aggiuntiva `anime-fixed-large-title.png`.
La scala Android e stata riportata a 1.0 dopo il campionamento.

Controlli del fix: 35 test passati nelle suite homeResponsiveLayout,
heroCarouselMotion, heroMetadataFailure; `npx tsc --noEmit` e `npm run lint`
completati senza diagnostiche. Il collaudo sugli altri provider e sulle azioni
e descritto sotto. Diff controllato, commit `3236a09`; nessun push in questa fase.

Verifica successiva: StreamCenter, sei contenuti distinti in
`streamcenter-fixed-0..5.png`, indicatori tra y=1671 e y=1688 px in ogni
acquisizione a scala 1.0. StreamingUnity, sei selezioni campionate con la stessa
fascia verticale; una acquisizione e durante la transizione, le altre mostrano
cinque opere differenti (`streaming-fixed-contact.jpg`). CTA apre il dettaglio
di Lupin, Indietro ritorna alla home e ricerca apre la schermata corretta
(`fixed-actions-contact.jpg`). Cambi provider effettuati attraverso il pannello.
Nessun player o download avviato. Questa verifica copre il layout interessato
e i percorsi descritti, non una certificazione di ogni funzione dell'app.

## Matrice aggiuntiva di gesti e stati Crunchyroll

| Caso | Risultato osservato | Evidenza locale |
| --- | --- | --- |
| Gesto corto orizzontale, circa 40 px / 15 dp | Resta sulla prima slide dopo il rilascio; non basta per avanzare. | `cr-gesture-first.png`, `cr-gesture-short.png`, `cr-gestures.mp4` |
| Trascinamento verso la pagina precedente dalla prima | Resta Black Clover; nessun riavvolgimento all'ultima pagina. | `cr-gesture-first-boundary.png` |
| Trascinamento orizzontale lungo | Passa alla seconda pagina, Dragon Ball Super: Beerus. | `cr-gesture-next.png` |
| Selezione ultima e trascinamento oltre il limite | Resta Dandivine; il ciclo automatico documentato non e il comportamento del gesto manuale. | `cr-gesture-last.png`, `cr-gesture-last-boundary.png` |
| Gesto prevalentemente verticale con componente orizzontale | Scorre il feed; nel campione resta selezionata la stessa opera. | `cr-gesture-diagonal.png` |
| Nuovo tocco Home | Ritorna in cima conservando la pagina hero selezionata nel campione. | `cr-gesture-home.png` |
| Trascinamento verso il basso da cima | Al rilascio resta il layout normale; non e stata osservata una schermata di aggiornamento distinta. Questo non prova assenza di richieste di rete. | `cr-gesture-pull.png`, video |
| Riga orizzontale | I poster scorrono lateralmente senza spostare verticalmente hero e intestazioni. | `cr-row-before.png`, `cr-row-after.png`, `cr-rows.mp4` |
| Tap poster della riga e Indietro | Apre Attack on Titan; tornando conserva offset verticale e posizione orizzontale della riga. | `cr-row-detail.png`, `cr-row-return.png` |
| Rete assente con home pronta | Restano visibili le informazioni e le immagini gia caricate nel breve campione. | `cr-offline-warm.png` |
| Avvio a freddo senza rete | Schermata dedicata con illustrazione, errore di connessione, Try Again e Go to Offline Viewing; toast di assenza rete. | `cr-offline-cold.png` |
| Ripristino rete | Home nuovamente disponibile senza cancellare dati o ripetere login. | `cr-online-recovery.png` |
| Font Android 150% | Il testo cresce e i generi possono andare a capo; il campione mantiene la struttura hero e consente lo scroll. | `cr-font150.png`, `cr-font150-scroll.png` |
| Caricamento iniziale | Toolbar e barra inferiore presenti, sfondo nero e indicatore centrale arancione prima dei dati. | `crunchy-host.png`, `cr-restored.png` |
| Scroll profondo | Alternanza di righe di poster, promozioni grandi con CTA e righe musicali; segnaposto grigi mentre alcune immagini arrivano. | `cr-feed-scroll-0/3/6/9.png`, `cr-feed-scroll.mp4` |
| Fine del feed | Messaggio di fine e pulsante View All; ripetere lo swipe non aggiunge altre righe nel campione. | `cr-feed-deep-7/11/15.png` |
| View All dal fondo | Apre Browse / All Anime. Indietro torna al fondo; toccare Home riporta all'hero. | `cr-footer-viewall.png`, `cr-footer-return.png`, `cr-final-home.png` |

Wi-Fi, dati mobili e font_scale sono stati ripristinati rispettivamente a
1, 1 e 1.0. Nessuna modifica alle preferenze dell'account Crunchyroll.
Il cambio scala puo ricreare l'Activity: una cattura subito dopo il ripristino
ha intercettato il launcher Android, non uno stato della home; esclusa dal report.

## Misure e composizione utili per Vega

Campione normale: 1080x2400, 420 dpi, quindi 2.625 pixel per dp. Conversioni
arrotondate; i bounds di accessibilita possono includere la zona tattile.

| Elemento | Riferimento verificabile | Implicazione |
| --- | --- | --- |
| Pager hero telefono | Aspect ratio 0.6666667, larghezza piena | 1080x1620 px, circa 411.4x617.1 dp; indicatori esterni. |
| Margine laterale contenuto | x=42 px nell'XML | 16 dp. |
| Area logo nell'hero campionato | `[42,951][1038,1161]` | Area circa 379x80 dp; non confondere il contenitore con i pixel opachi del logo. |
| Sinossi | Tre righe e troncamento visibile nel campione normale | Mantenere un limite leggibile senza variare il frame. |
| Bookmark CTA | Bounds 126x126 px | Target tattile 48x48 dp. Vega attualmente usa 44x44. |
| Indicatori | Ogni pagina ha target 126x126 px; passo 126 px | Target 48 dp. Vega usa altezza tattile 36 dp e barra 7 dp. |
| Toolbar | Nero pieno dopo lo scroll, contenuti e icone restano visibili | Animare solo fondo/opacita, non attenuare tutta la toolbar. |
| Barra inferiore | Fissa mentre scorre il feed | Conservare le destinazioni Vega. |
| Logo stretto | Apothecary Diaries allineato visivamente a sinistra | Vega centra il bitmap nel contenitore `contain`; verificare allineamento e padding trasparenti prima di cambiare scala. |

Nel codice `pr/a0.java` (HeroMediaCard.kt) il gradiente inferiore occupa meta
dell'altezza sul telefono; il ramo tablet usa un terzo e aggiunge un gradiente
laterale. `layout/h.c` conferma fillMaxHeight. `ep/d.f24192x` e trasparente,
`ep/d.f24169a` nero. Vega usa quattro stop sull'intera altezza: e una differenza
di composizione da provare con immagini identiche, non una ragione per cambiare
la priorita dei servizi immagini.

`pr/p.java` (HeroImagesUiModel.kt) separa wideImage, tallImage e logoImage.
`pr/o.java` (HeroImage.kt) distingue postersWide/postersTall. Crunchyroll dispone
quindi di artwork predisposti per formati diversi: un background dei servizi
Vega non garantisce lo stesso ritaglio o la stessa composizione. Non dedurre
da questi nomi un nuovo fallback TMDB o modificare le preferenze concordate.

## Prossime implementazioni proposte, da concordare

1. **Toolbar progressiva**: offset continuo, opacita saturata al 30% del viewport
   del feed; fondo nero, icone sempre opache. Controllare safe area, ritorno a
   zero, cambio provider e navigazione. Separare l'opacita dalla pausa autoplay.
2. **Misure di toolbar, CTA e indicatori**: confrontare i target 48 dp con quelli
   attuali e rifinire distanze verticali, mantenendo bottone provider e ricerca.
   Non cambiare routing, watchlist o destinazioni inferiori.
3. **Composizione hero**: allineamento dei loghi stretti, spazio fra logo,
   metadata e sinossi, gradiente inferiore. Prove su immagini chiare/scure e
   loghi larghi/alti, senza sostituzione di servizi o ricolorazione dei loghi.
4. **Righe del feed**: confronto a dimensioni uguali di interlinee, separazione
   intestazione/poster, titoli troncati e mantenimento della posizione al ritorno.
   Badge di provider/lingua/episodi e azione Altro restano funzioni Vega.
5. **Stati di caricamento/errore**: adottare solo la coerenza visiva utile.
   Conservare la barriera metadata di Vega, Riprova e i suoi dati in cache;
   non sostituirli automaticamente con lo spinner o la schermata offline CR.

La pausa autoplay dopo il primo pixel di scroll e una differenza da discutere
separatamente: nel riferimento il carosello continua mentre e parzialmente
visibile. Cambiarla insieme alla toolbar sarebbe una modifica funzionale non
necessaria al fade del fondo.

Le promozioni grandi e il footer View All sono varianti aggiuntive del feed,
non difetti del carosello Vega. La loro eventuale introduzione richiederebbe
una decisione di prodotto e dati adatti dei provider. La home non deve simulare
Game Vault, musica o Premium con controlli privi di una funzione reale.

## Confini della fedelta e della verifica

Questa ricerca integra quella in `docs/research/crunchyroll-mobile` del progetto
Kotlin, soprattutto `05-authenticated-navigation.md`, `07-coverage.md` e
`08-reconstruction-notes.md`. Non sostituisce i risultati gia raccolti su timer,
molla, selezioni, navigazione, liste o account. I valori piu recenti delle
animazioni Vega sono nella sezione del 28 ottobre di `home-cruncy-ui.md`, non
nelle vecchie note che descrivevano un fade da 240 ms.

Non sono riproducibili in modo esaustivo tutti i contenuti remoti, esperimenti
server, profili Premium o configurazioni regionali. Gli stati senza logo,
catalogo vuoto e feed personalizzato Continue Watching non sono tutti disponibili
nel profilo di prova: non vengono dichiarati verificati su Crunchyroll.
iOS, TalkBack e un benchmark FPS su dispositivo fisico non sono coperti.
Screenrecord dell'emulatore ha frequenza variabile; le registrazioni dimostrano
composizione e transizioni osservate, non uguaglianza temporale dei due motori.
I blocchi QEMU sono limiti dell'ambiente e non regressioni dimostrate di Vega.

Non replicare banner Premium, acquisti, Store, nomi di destinazioni o dati
inventati per ottenere somiglianza. Non aggiungere copie degli asset del catalogo.
La correzione dei loghi scuri e il riconoscimento delle scritte incorporate
restano esclusi, come richiesto. Le modifiche proposte sopra non sono ancora
implementate: il solo fix di questa ricerca e la geometria hero in `3236a09`.

## Esito e riproducibilita

Il perimetro Android accessibile della home e stato esplorato dall'ingresso
fino al fondo del feed, comprese selezioni, gesti, scroll, ritorni, caricamento,
perdita/ripristino rete e caratteri ingranditi. Le lacune di catalogo/profilo e
piattaforma sono esplicite sopra: non si dichiara copertura universale al 100%.
REA non era disponibile fra gli strumenti collegati; fallback usato: ADB,
screencap/screenrecord, UIAutomator e APK/Java/Smali gia presenti sul PC.

Per ripetere il confronto usare Medium_Phone_API_35 a 1080x2400, densita 420,
font_scale 1.0 e lo stesso campione APK. Separare i test a scala 1.5. Confrontare
prima gli ingombri dei contenitori, poi i pixel delle immagini: il catalogo puo
cambiare anche fra due avvii. Il renderer host e stato piu utilizzabile di
swiftshader_indirect, ma ha comunque richiesto un riavvio dopo un blocco al
ritorno nell'app. Non usare questi tempi come misura della latenza di rete.

Alla chiusura delle prove l'app di riferimento e tornata alla home, rete e
scala caratteri sono ripristinate. Nessun acquisto, riproduzione o modifica
dell'account; la ricerca ha modificato solo stato di navigazione locale.


## Aggiornamento implementazioni del 29 ottobre

Le proposte di toolbar, misure/composizione e stati sono state implementate in
seguito alla ricerca: toolbar progressiva in b4ecbed, composizione in 6260417,
e stati di caricamento/errore nel relativo commit. Dettagli e verifiche sono
nelle sezioni omonime di home-cruncy-ui.md. La precedente lista delle proposte
rimane come cronologia del confronto, non come elenco di lavori ancora aperti.

Restano differenze intenzionali: pausa autoplay durante lo scroll, immagini e
ritagli dei servizi Vega, font/branding e funzioni specifiche dei provider;
nessuna replica di promozioni Premium, righe musicali o footer privi di dati e
funzioni equivalenti. Loghi scuri e riconoscimento scritte esclusi. Non e
certificata uguaglianza pixel per pixel su tutti i contenuti, iOS o tablet fisici.
