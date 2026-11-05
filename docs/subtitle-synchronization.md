# Sincronizzazione dei sottotitoli (Android)

Nel player, selezionare una traccia e aprire **Sottotitoli → Sincronizzazione sottotitoli**. Anticipa/Ritarda modificano la bozza di 100 ms o 1 secondo. Il campo accetta secondi, punto o virgola decimale e segno: positivo ritarda, negativo anticipa. Il limite è ±600 secondi. **Applica** conferma, **Azzera** applica zero, **Annulla** scarta la bozza.

Il pannello compatto mostra la traccia, il valore centrale e quattro pulsanti (−1 s, −0,1 s, +0,1 s, +1 s). Toccare il valore apre l'inserimento numerico; il pulsante di aiuto espande la spiegazione. Le azioni Annulla/Azzera/Applica restano in una barra separata dallo scorrimento del contenuto. Le regolazioni modificano solo la bozza fino alla conferma, evitando ricaricamenti a ogni pressione.

Verifica UI del 2026-11-06 su Medium_phone_API_35: layout orizzontale standard, aiuto espanso, inserimento manuale −1,5 s, annullamento senza applicazione, incrementi di 100 ms/1 s, applicazione e azzeramento con conservazione di pausa/posizione. Screenshot conservato fuori dalla repo. La prova al 130% non è stata completata perché il cambio di configurazione ha ricreato il dev client; il font scale è stato ripristinato a 1.0.

I valori sono conservati solo nella sessione del player, separati per traccia. Pausa, seek, background e ricreazione del componente video non devono cancellarli. Cambio episodio e uscita dal player li azzerano. Le tracce esterne sono identificate dal loro URI; quelle incorporate dall'identità dello stream e della traccia, mai dalla sola lingua. Non viene scritto alcun offset nelle impostazioni, nei file dei sottotitoli o nella cronologia.

## Implementazione nativa

La patch versionata di `react-native-video` 6.18.0 espone `subtitleDelayMs` su Android. `DelayedSubtitleParserFactory` avvolge i parser Media3 1.4.1 e sposta `CuesWithTiming.startTimeUs`, conservando contenuto, stile, durata e comportamento di sostituzione. Gestisce anche i tempi relativi al campione (`TIME_UNSET`) e traduce la soglia temporale delle richieste di parsing dopo un seek.

Per i contenitori progressivi (MP4/MKV), `SubtitlePrerollExtractorsFactory` anticipa la posizione di lettura del file quando il ritardo è positivo. Il punto temporale richiesto resta invariato: le code audio/video scartano i campioni precedenti, mentre i sottotitoli ritardati rimangono disponibili anche dopo un seek. Questo può richiedere di leggere dati precedenti al punto scelto.

La factory è creata per ogni sorgente, senza stato statico condiviso. Viene usata dagli estrattori MP4/MKV, dalle factory HLS/DASH/SmoothStreaming e dalle sorgenti di sottotitoli esterni. Con offset zero restituisce direttamente il parser originale. La disponibilità dei formati rimane quella dei parser Media3: non aggiunge decoder per formati precedentemente non supportati o per closed captions che non passano da `SubtitleParser`.

Quando cambia il valore, il player ricostruisce la sorgente alla posizione corrente per ricalcolare anche i cue già bufferizzati. Questo può comportare un breve buffering. Gli elenchi vuoti transitori durante la sostituzione della timeline non cancellano la traccia selezionata. L'evento `onLoad` contrassegnato `subtitleTimingReload` evita di ripristinare la posizione della cronologia, riprendere il video in pausa o azzerare la velocità. L'evento Android di velocità include lo stato di pausa richiesto, acquisito sul thread del player prima di costruire l'evento JavaScript. Una sospensione in background non viene confusa con una pausa dell'utente. Il caricamento completato dei sottotitoli disattiva il watchdog di avvio anche se il video è in pausa. La fine del buffering nel componente media-console conserva lo stato di pausa dell'utente; i gesti sulla seekbar continuano a ripristinare lo stato precedente alla ricerca.

La sincronizzazione riguarda il player locale Android. Non viene esposta su iOS e non viene esportata verso cast, player esterni o download. Non cambia DRM, gestione licenze o selezione degli indici delle tracce. È necessaria una nuova build Android dopo l'applicazione della patch; non eseguire prebuild.

## Verifica

I test `subtitleTiming.test.tsx` coprono input e limiti, applicazione/annullamento/azzeramento, identità delle tracce e ciclo di vita della sessione. Le prove native usano un video locale con due tracce incorporate e una traccia esterna, contenenti cue in intervalli temporali noti. Le catture dell'emulatore e i log di verifica sono conservati fuori dal repository.

### Verifiche eseguite sul dev client

- Build Android x86_64 riuscita e installata su `Medium_phone_API_35` (API 35).
- Sottotitoli incorporati: cue originale a 10–12 s visibile a 26 s con ritardo di 15 s dopo seek, e a 9 s con anticipo di 2 s.
- Sottotitoli esterni SRT: ritardo di 2 s, anticipo di 1 s e azzeramento verificati con cue noti e catture del player.
- Applicazione durante la pausa, conservazione della velocità 1,5×, passaggio in background e ritorno verificati. Gli offset distinti delle tracce vengono recuperati al cambio selezione; cambio episodio e nuova sessione ripartono da zero.
- Pannello, scorrimento, pulsanti, annullamento e inserimento manuale negativo/decimale verificati. Il campo usa la tastiera numerica; in orizzontale Android può mostrare il proprio editor a tutto schermo.
- Campione pubblico DASH ClearKey riprodotto con avanzamento della posizione, mantenendo la superficie protetta.
- `npx tsc --noEmit` e `npm run lint` senza errori o warning; suite completa Jest: 76 suite, 368 test superati. Test mirati ripetuti dopo la regolazione della tastiera: 2 suite, 5 test superati.
- Patch verificata contro i sorgenti originali e contro la dipendenza installata.

Le prove temporali native coprono MKV con testo incorporato e SRT esterno. Non certificano ogni formato/stream: in particolare i seek con grandi ritardi attraverso segmenti HLS/DASH non sono stati verificati sull'emulatore. Il preroll aggiuntivo descritto sopra riguarda i file progressivi. Il cambio manuale di traccia conserva il comportamento preesistente di ricaricare il componente video, riprendere la riproduzione e riportare la velocità a 1×; la sola applicazione di un offset conserva invece pausa e velocità.

Durante le prove l'emulatore e il collegamento diagnostico hanno avuto alcuni timeout transitori; le verifiche sono state ripetute. I video e gli adattatori diagnostici sono esterni alla repo e non fanno parte della funzionalità distribuita.
