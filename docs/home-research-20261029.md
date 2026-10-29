# Ricerca home: geometria e scorrimento (2026-10-29)

Stato: indagine in corso, non attestazione di fix o collaudo completato.

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
`vega-streamcenter-before-0.png` ... `before-5.png` e il provino
`comparison-before.jpg` documentano il primo campionamento. In queste immagini
CTA e indicatori restano allineati; l'ultimo tentativo torna alla prima slide,
quindi non prova l'acquisizione di sei contenuti distinti. Non e ancora prova
di assenza del difetto. Nessun fix applicato in questa fase.

## Verifiche da completare

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

Controlli iniziali: 35 test passati nelle suite homeResponsiveLayout,
heroCarouselMotion, heroMetadataFailure; `npx tsc --noEmit` e `npm run lint`
completati senza diagnostiche. Restano il collaudo finale sugli altri provider,
le azioni e la revisione prima del commit. Questo stato non certifica ancora
il completamento del lavoro.

Verifica successiva: StreamCenter, sei contenuti distinti in
`streamcenter-fixed-0..5.png`, indicatori tra y=1671 e y=1688 px in ogni
acquisizione a scala 1.0. StreamingUnity, sei selezioni campionate con la stessa
fascia verticale; una acquisizione e durante la transizione, le altre mostrano
cinque opere differenti (`streaming-fixed-contact.jpg`). CTA apre il dettaglio
di Lupin, Indietro ritorna alla home e ricerca apre la schermata corretta
(`fixed-actions-contact.jpg`). Cambi provider effettuati attraverso il pannello.
Nessun player o download avviato. Questa verifica copre il layout interessato
e i percorsi descritti, non una certificazione di ogni funzione dell'app.
