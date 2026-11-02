# Impostazioni: presentazione coerente con la Home

Intervento del 2 novembre 2026, branch `cruncy-ui`.

## Ambito

Impostazioni, Preferenze, Account, Sottotitoli, Informazioni, Gestione provider
e i componenti incorporati per DNS, chiavi API, cartella download e sorgenti.
Il riferimento e l'organizzazione visiva documentata in
`C:/dev/Cynavo/docs/research/crunchyroll-mobile/06-account-and-profile.md`;
le funzioni specifiche di Vega restano nella loro collocazione.

Font condivisi con la Home, titoli di 22 punti, superfici scure e separatori
uniformi. Safe area superiore e laterale al posto degli spazi superiori fissi.
Informazioni diventa scorrevole. Le tile provider hanno larghezza limitata
e altezza minima adattata alla dimensione del testo, senza un contenitore
interno alto il 100% che ne dilaterebbe la riga.

Non cambiano persistenza, login, gestione delle chiavi, azioni sui provider,
impostazioni di rete o preferenze dei metadata. Il confronto sintattico dei
callback UI, dei flag dei campi password e degli stati disabled/editable
conferma che sono invariati.

## Verifiche

- `npx tsc --noEmit` e `npm run lint` senza errori o warning.
- Suite completa: 63 suite e 307 test superati.
- Medium_Phone_API_35: apertura di Impostazioni, Preferenze, Account,
  Sottotitoli, Provider e Informazioni; dimensione sottotitoli da 16 a 17
  e ritorno a 16 attraverso i controlli della pagina.
- Tablet API 35: impostazioni, preferenze, espansione Account, sottotitoli,
  Informazioni e lista provider; finestra Android limitata e orizzontale libero,
  inclusa verifica di Provider/Informazioni con testo al 130%.
- Acquisizioni locali non versionate: `D:/codex-temp/final-ui-20261102/`.

Non sono stati eseguiti login, aggiornamenti/installazioni dei provider,
salvataggi di chiavi o modifiche della rete per verificare lo stile.
Le impostazioni temporanee di rotazione e dimensione del testo sono ripristinate.
iOS non verificato; l'aspetto dei dialoghi nativi dipende dal sistema operativo.
