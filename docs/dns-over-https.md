# DNS over HTTPS

## Supporto

Vega supporta DNS over HTTPS (DoH) su Android. La configurazione e disponibile in
`Impostazioni > Preferenze > Rete` e viene applicata alle nuove connessioni senza
riavviare l'app.

Provider disponibili:

- DNS di sistema (comportamento predefinito, DoH disattivato)
- Cloudflare (`https://cloudflare-dns.com/dns-query`)
- Google (`https://dns.google/dns-query`)
- Quad9 senza filtri (`https://dns10.quad9.net/dns-query`)

Gli endpoint DoH usano TLS con verifica standard del certificato e indirizzi bootstrap
ufficiali IPv4/IPv6. Non viene disabilitata la verifica TLS.

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
- `MainApplication` registra un `OkHttpClientFactory` prima dell'avvio di React Native.
- `VegaDnsModule` espone stato, cambio provider e diagnostica al livello TypeScript.
- La scelta e persistita in `SharedPreferences` nativo, per essere disponibile prima
  della creazione del bridge React Native al successivo avvio.

Quando cambia provider, le connessioni HTTP inattive vengono eliminate dal pool. Le
richieste gia in corso non vengono interrotte; le nuove connessioni usano subito il
resolver selezionato.
