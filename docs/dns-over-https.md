# DNS over HTTPS

## Supporto

Vega supporta DNS over HTTPS (DoH) su Android. La configurazione e disponibile in
`Impostazioni > Preferenze > Rete` e viene applicata alle nuove connessioni senza
riavviare l'app.

Provider disponibili:

- Cloudflare (`https://cloudflare-dns.com/dns-query`), predefinito sulle nuove installazioni
- Google (`https://dns.google/dns-query`)
- Quad9 senza filtri (`https://dns10.quad9.net/dns-query`)
- AdGuard Default (`https://dns.adguard-dns.com/dns-query`), con blocco di pubblicita e tracker
- endpoint DoH personalizzato
- DNS di sistema (DoH disattivato)

Le scelte gia salvate dagli utenti esistenti vengono mantenute. Cloudflare viene usato
come fallback anche se la preferenza persistita non e piu valida.

Gli endpoint DoH preconfigurati usano TLS con verifica standard del certificato e
indirizzi bootstrap ufficiali IPv4/IPv6. Non viene disabilitata la verifica TLS.

### Endpoint personalizzato

L'URL personalizzato viene validato sia in TypeScript sia nel modulo Android prima di
essere salvato. Deve essere un URL HTTPS assoluto, lungo al massimo 2048 caratteri,
senza credenziali incorporate, query string o frammento. Sono ammessi percorsi e porte
personalizzati, per esempio `https://resolver.example/dns-query`.

La configurazione viene conservata nelle preferenze native. L'hostname dell'endpoint
personalizzato viene inizialmente risolto tramite il DNS di sistema per avviare la
connessione HTTPS; le query DNS successive passano attraverso il resolver DoH scelto.
Vega non verifica che il server implementi correttamente DoH fino a `Verifica DNS` o
alla prima richiesta reale. Il gestore dell'endpoint personalizzato puo osservare i
nomi di dominio richiesti, quindi va usato solo un resolver fidato.

## Copertura

Il resolver e installato nel client OkHttp condiviso da React Native su Android. Copre:

- `fetch` e Axios eseguiti dal runtime React Native;
- richieste di catalogo, ricerca, metadata ed estrazione dei provider;
- download HLS eseguiti tramite Axios;
- riproduzione nel player interno Android tramite `react-native-video`/OkHttp.

Non copre stack di rete indipendenti:

- WebView Android e GeckoView;
- Google Cast, Vega Cast e Web Video Caster;
- browser, player e downloader esterni;
- eventuali download nativi che non usano il client React Native;
- iOS, dove `NSURLSession`, WebKit e AVPlayer usano il resolver di sistema.

Il DoH e app-scoped: non cambia il DNS del dispositivo e non e una VPN. Cifra le query
DNS verso il resolver scelto, ma non nasconde l'indirizzo IP dell'utente e non aggira
blocchi basati su IP.

L'impostazione WARP e separata. Quando e attiva, le destinazioni coperte vengono
risolte dal proxy dentro il tunnel e la preferenza DoH resta memorizzata per il
traffico diretto e per quando WARP viene disattivato. Il bootstrap DoH non usa mai
il proxy locale, evitando dipendenze circolari. Dettagli in `docs/warp.md`.

## Comportamento in caso di errore

La modalita e stretta: quando viene selezionato un provider DoH, Vega non esegue un
fallback silenzioso al DNS di sistema. In questo modo non vengono inviate query DNS in
chiaro senza che l'utente lo sappia. Se il resolver non e raggiungibile, le nuove
connessioni coperte falliscono finche non viene selezionato un altro provider o il DNS
di sistema.

Il pulsante `Verifica DNS` risolve `example.com` usando il resolver attivo e mostra
latenza e numero di indirizzi restituiti.

## Implementazione Android

- `VegaDnsController` implementa `okhttp3.Dns` e delega al DNS di sistema oppure a
  `okhttp3.dnsoverhttps.DnsOverHttps`.
- `MainApplication` registra un `OkHttpClientFactory` prima dell'avvio di React Native;
  la factory conserva il resolver DoH e aggiunge il selettore proxy dinamico usato
  da WARP.
- `VegaDnsModule` espone stato, cambio provider e diagnostica al livello TypeScript.
- La scelta e l'eventuale URL personalizzato sono persistiti in `SharedPreferences`
  nativo, per essere disponibili prima della creazione del bridge React Native al
  successivo avvio.

Quando cambia provider, le connessioni HTTP inattive vengono eliminate dal pool. Le
richieste gia in corso non vengono interrotte; le nuove connessioni usano subito il
resolver selezionato.
