# Navigazione e preferiti responsive

## Comportamento

Tre correzioni verificate in sequenza il 30 ottobre 2026:

1. La barra inferiore occupa spazio nel layout del navigatore. Rimossi il posizionamento assoluto e lo spostamento negativo; HomeNavigationInset riserva il margine di sistema e il navigatore non lo aggiunge una seconda volta.
2. La griglia dei preferiti misura un contenitore stabile esterno alla FlatList, al netto di padding e menu laterale. Attende la prima misura invece di usare provvisoriamente tutta la finestra. Supporta anche la colonna singola. Preferiti esistenti, ordine, poster e apertura dettagli conservano il comportamento precedente.
3. Rotazione e posizione del menu sono separate. La classificazione tablet usa il lato corto dello schermo (almeno 600 dp), evitando riclassificazioni quando tastiera o multitasking riducono la finestra. Una finestra tablet larga almeno 900 dp usa il menu laterale; le altre usano la barra inferiore. La stessa regola viene usata da navigatore e margine Android. La preferenza controlla solo la richiesta di orientamento e resta disponibile sui tablet anche in finestre strette. Le eccezioni Player/Webview sono invariate.

Il layout segue lo spazio reale anche se Android ignora la richiesta di blocco verticale. Questo non forza il sistema a rispettare un orientamento che le sue regole di compatibilita possono sovrascrivere.

## Verifiche automatiche

- `npx tsc --noEmit`: superato senza errori.
- `npm run lint`: superato senza warning/errori.
- `git diff --check`: superato.
- Sei suite Jest, 18 test superati: adaptiveNavigation, watchListLayout, homeNavigationBar, homeNavigationInset, searchScreens, searchResultsStates.
- Il test griglia verifica 40 elementi preesistenti, ridimensionamenti da 80 a 1200 dp, occupazione entro il contenitore, colonna singola e parametri della navigazione ai dettagli.
- I test di navigazione verificano smartphone orizzontale, tablet, finestra stretta e soglia del menu laterale.

## Prove Android

Dev client nativo, JavaScript corrente da Metro. AVD su D: Medium_Phone_API_35 e Medium_Tablet_API_35, Android 15/API 35. Non usato Expo Go; nessun prebuild. La versione nativa del dev client telefono e 3.3.19: l'avviso di aggiornamento 3.3.20 e stato annullato e non indica un bundle JavaScript vecchio.

### Primo intervento

- Tablet: Home, preferiti e Impostazioni, orientamento verticale/orizzontale, etichette disattive e taskbar Android a tre tasti. Barra visibile e pulsanti funzionanti.
- Smartphone: Home, Impostazioni, preferiti vuoti, ricerca globale; barra nascosta durante la tastiera e nuovamente visibile alla chiusura. Verificate etichette attive e scala caratteri 1.3.

### Secondo intervento

- Smartphone: popolati 40 preferiti reali AnimeUnity dalla lista inizialmente vuota, controllate tre colonne e scorrimento senza tagli laterali. Apertura della scheda verificata; il caricamento remoto dei dettagli e risultato lento e non costituisce una verifica end-to-end dei provider.
- Tablet: 40 preferiti gia persistiti, 11 colonne con barra inferiore, 10 con barra laterale in orizzontale, 6 con barra laterale in verticale. Ultima colonna interamente visibile in tutti questi casi.

### Terzo intervento e verifica combinata

- Tablet: opzione rotazione attiva/disattiva, verticale/orizzontale, menu laterale nelle finestre larghe e inferiore in verticale (800 dp). Preferiti conservati e griglia corretta; sette colonne in verticale con barra inferiore.
- Simulata la compatibilita Android che ignora il blocco tramite `OVERRIDE_ANY_ORIENTATION_TO_USER`, poi ripristinata con `am compat reset`. Navigazione utilizzabile anche in quel caso.
- Configurazione Android standard: ricerca con tastiera in verticale e orizzontale, ritorno del menu alla chiusura, etichette attive/disattive, apertura Impostazioni e rotazione mantenendo la schermata.
- Smartphone: Home, 40 preferiti persistiti, Impostazioni e ricerca con apertura/chiusura tastiera. Barra inferiore conservata. Scala caratteri ripristinata a 1.0 ed etichette disattivate come prima della prova; tablet ripristinato con rotazione ed etichette disattive. Navigazione Android a tre tasti mantenuta.

## Evidenze locali e limiti

Screenshot non committati in `D:\codex-temp\vega-search-cards-20261030`:

- `fix1-tablet-settings-pair.png`, `fix1-settings-settled.png`, `fix1-search-keyboard-verified.png`, `fix1-search-close-settled.png`.
- `fix2-phone-counted.png`, `fix2-phone-scroll3.png`, `fix2-tablet-favorites.png`, `fix2-tablet-side-portrait.png`, `fix2-tablet-side-landscape.png`.
- `fix3-on-portrait.png`, `fix3-off-portrait.png`, `fix3-off-landscape.png`, `fix3-tablet-keyboard.png`, `fix3-tablet-keyboard-closed.png`, `fix3-tablet-labels.png`, `fix3-tablet-settings-portrait.png`.
- `fix3-phone-favorites-settled.png`, `fix3-phone-keyboard.png`, `fix3-phone-final.png`.

L'ambiente ha avuto timeout/ANR durante caricamento e ricaricamento del dev client. Un comando di riavvio e stato respinto dal controllo automatico; non ripetuto per aggirare il blocco. Il caricamento si e poi concluso e sono state eseguite le prove interattive. Non sono emersi errori di layout nei casi finali verificati.

Non verificati iOS e il tablet fisico della foto. Serve conferma su quel dispositivo per le particolarita del sistema del produttore. Download e player esclusi per richiesta dell'utente; nessuna modifica a metadata, fallback o provider. Le prove non costituiscono una garanzia di assenza di qualsiasi bug nell'intera app.
