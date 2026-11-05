# DRM nel player

Il campo opzionale `Stream.drm` consente ai provider di descrivere stream protetti.
Gli stream senza questo campo mantengono il percorso normale, inclusi i torrent.
Il provider deve fornire una licenza valida o chiavi ClearKey autorizzate: il player
non genera licenze e non aggira i requisiti del servizio.

## Contratto provider

```ts
{
  server: 'DASH Widevine',
  link: 'https://media.example.test/manifest.mpd',
  type: 'dash',
  headers: {Referer: 'https://media.example.test/'},
  drm: {
    type: 'widevine', // Android: widevine, playready, clearkey
    licenseUrl: 'https://license.example.test/',
    licenseHeaders: {Authorization: 'Bearer ...'},
    keyRequestParameters: {}, // parametri MediaDrm, distinti dagli header HTTP
    multiSession: true,
  },
}
```

Per ClearKey locale usare `type: 'clearkey'` e
`clearKeys: [{kid: '...', key: '...'}]`, senza `licenseUrl`.
KID e chiave devono rappresentare 16 byte: sono accettati hex, UUID per il KID,
base64 o base64url. Sono supportate piu coppie. La risposta JWK temporanea viene
passata direttamente a `LocalMediaDrmCallback`, senza server HTTP locale e senza
scrivere la licenza su disco. ClearKey remoto usa invece `licenseUrl`.

Widevine e PlayReady richiedono il supporto del dispositivo e della licenza.
La presenza dello schema nel codice non rende PlayReady disponibile su ogni telefono.
Su iOS il contratto accetta FairPlay con `certificateUrl`, `licenseUrl` e,
se richiesti dal servizio, `contentId` e `base64Certificate`. Gli schemi Android
vengono rifiutati su iOS. Il percorso FairPlay usa il gestore della libreria;
non e una conversione di Widevine/ClearKey in FairPlay.

## Integrazione e limiti

- `patches/react-native-video+6.18.0.patch` estende il bridge e il gestore Media3
  per ClearKey locale e parametri MediaDrm. La dipendenza e fissata a 6.18.0;
  `postinstall` applica la patch. Una modifica alla patch richiede una nuova build
  nativa, non solo un aggiornamento JavaScript.
- Le richieste di licenza usano il client OkHttp React Native, mantenendo la
  configurazione di rete dell'app, ma non ereditano gli header del video.
  I provider devono fornire esplicitamente gli header richiesti dalla licenza.
- La superficie Android protetta usa SurfaceView. Il pinch zoom basato su
  trasformazioni TextureView e disabilitato solo per DRM; controlli, seek,
  luminosita e volume rimangono disponibili.
- La prima riproduzione DRM ha 60 secondi per provisioning/licenza. Il timeout
  rapido degli stream ordinari e quello dei torrent restano distinti.
- Gli errori DRM non sono trattati come token video HTTP scaduti. Viene mostrato
  un messaggio dedicato e resta disponibile il fallback alla sorgente successiva.
- URL, formato, header e DRM vengono risolti insieme per la sorgente selezionata:
  durante il cambio server non si combinano il vecchio manifest e il nuovo formato.
- Download, cast e player esterni che trasferiscono soltanto URL/header sono
  bloccati per gli stream DRM: non dispongono di gestione licenze offline o di
  un receiver DRM configurato. I relativi percorsi non DRM restano disponibili.
- Non inserire configurazioni DRM complete, chiavi o token nei log, nella
  cronologia o nei payload di download. La cache video e disabilitata per DRM.

## Verifica

Eseguire TypeScript, lint, suite Jest e build Android con la patch applicata.
Sul dev client Medium_phone_API_35 verificare ClearKey locale e remoto usando
le fixture pubbliche del [catalogo demo Shaka](https://github.com/shaka-project/shaka-player/blob/main/demo/common/assets.js),
poi Widevine dove il dispositivo lo supporta. Controllare avanzamento, seek,
pausa/ripresa, background/foreground, cambio sorgente, chiave errata e uscita.
Provare anche MP4, HLS non cifrato e torrent. PlayReady e FairPlay richiedono
dispositivi compatibili: un emulatore Android non prova FairPlay o Widevine L1.
La cattura dello schermo puo mostrare il video DRM nero per la superficie protetta;
verificare anche posizione e stato del decoder, senza registrare le licenze.

### Risultati del 5 novembre 2026

- TypeScript e lint senza errori o warning; Jest: 71 suite, 342 test superati.
- Build Android debug x86_64 riuscita; APK installato su Medium_phone_API_35.
- ClearKey locale: riproduzione, pausa stabile, seek da 45 a 10 secondi e ripresa.
  In background la posizione si ferma e al ritorno il player conserva la sessione.
- ClearKey remoto: riproduzione oltre 50 secondi. Il server di prova riceve
  l'header licenza, senza ricevere l'header riservato al video.
- Widevine: riproduzione della fixture pubblica e seek/ripresa verificati.
- Licenza HTTP 403, configurazione ClearKey non valida e PlayReady non supportato:
  passaggio a HLS non cifrato con riproduzione. La prova del 403 e stata ripetuta
  da avvio pulito dopo aver corretto l'aggiornamento atomico della sorgente.
- Regressioni: MP4 locale riprodotto oltre un minuto; torrent pubblico Big Buck
  Bunny avviato tramite magnet, riproduzione oltre 26 secondi mentre scarica.
  Uscita dal player e apertura di un'altra sorgente verificate.
- FairPlay, PlayReady su hardware compatibile e Widevine L1 non verificati in
  questo ambiente; richiedono dispositivi e licenze appropriati.

I provider esistenti non acquisiscono automaticamente contenuti DRM: devono
restituire il nuovo campo `drm` con i dati autorizzati del servizio.

## Ripristino

Il commit puo essere annullato con `git revert`. Dopo il ripristino riallineare
le dipendenze con `npm ci`, ricompilare e reinstallare il dev client Android:
il solo reload di Metro non sostituisce il codice nativo gia installato.
Non eseguire Expo prebuild per questa operazione.
