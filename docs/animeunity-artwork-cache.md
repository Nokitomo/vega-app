# Cache dell'indice AniBridge per AnimeUnity

Le card AnimeUnity continuano a scegliere il poster TMDB prima di TVDB e del
catalogo. L'app conserva il poster risolto per 24 ore. Se il poster non e in
cache, il provider consulta le mappature AniBridge prima di cercarlo.

`ProviderManager` riutilizza il contesto dello stesso provider e sorgente nella
sessione corrente: le richieste contemporanee condividono l'indice e la
richiesta in corso. Una modifica del bundle o della versione del provider
crea un nuovo contesto.

L'app espone una cache su file solo ad AnimeUnity e solo per la chiave
`anibridge-v3`. Il provider salva il dataset pubblico dopo averne verificato
lo schema. La cache e limitata a 20 MiB per copia e usa due copie alternate:
durante un aggiornamento la copia piu recente resta disponibile. Il provider
accetta una copia valida per 24 ore; file assente, scaduto o non valido fanno
usare la normale richiesta di rete. Su una versione dell'app priva della
cache su file il provider continua a funzionare tramite rete.

La cache risiede nella directory temporanea dell'app, che il sistema puo
svuotare. Il pulsante **Svuota cache** e la disinstallazione di AnimeUnity la
rimuovono. Nessuna chiave TMDB o impostazione del provider e salvata in
questa cache.

Per verificare il comportamento: confrontare l'avvio a cache vuota con un
riavvio a cache calda, scorrere sezioni AnimeUnity nuove, aprire una pagina
Info e osservare le richieste ad AniBridge. Nella stessa sessione e, dopo la
prima scrittura, entro 24 ore dal riavvio, non dovrebbe servire una nuova
richiesta per lo stesso indice. Verificare anche Svuota cache, aggiornamento
provider e l'aspetto dei poster e delle stagioni.
