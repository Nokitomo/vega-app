# Testing e Qualita

## Lint
```
npm run lint
```

## Test
```
npm test
```

## Note
- Gli errori bloccanti (rossi) e i warning (gialli) vanno corretti prima del commit.
- Gli info possono essere ignorati.
- Per nuove stringhe UI, aggiornare en/it e verificare che la lingua sia consistente.

## Smoke test cast Android
- Verificare `Preferences -> Player -> Cast Provider` su `native` e `wvc`.
- Da Player e da lista server:
  - cast nativo: apertura dialog device, start playback remoto, next/prev da queue quando disponibile.
  - fallback: se cast nativo non parte, prompt di conferma per aprire WVC.
  - WVC: apertura app e avvio stream con headers/sottotitoli quando disponibili.
- Durante cast nativo da Player, verificare aggiornamento progresso episodio in cronologia/cache.
