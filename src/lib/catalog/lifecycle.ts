import {useEffect} from 'react';
import {AppState} from 'react-native';
import {catalogNative} from './native';
import {
  configureCatalogTransfer,
  installPendingCatalog,
  isCatalogPreparationPaused,
} from './installer';
import {useCatalogStore} from './store';
import {cleanupDormantCatalogs} from './reader';

export function useCatalogLifecycle() {
  useEffect(() => {
    let disposed = false;
    let checking = false;
    let lastCheck = 0;
    let cleaned = false;
    const refresh = async () => {
      if (checking || disposed || AppState.currentState !== 'active') {
        return;
      }
      checking = true;
      try {
        await configureCatalogTransfer();
        if (!cleaned) {
          await cleanupDormantCatalogs();
          cleaned = true;
        }
        await installPendingCatalog();
        const state = useCatalogStore.getState();
        if (
          state.installed &&
          !isCatalogPreparationPaused() &&
          state.preferences.automatic &&
          Date.now() - lastCheck > 2 * 60 * 60 * 1000
        ) {
          lastCheck = Date.now();
          await catalogNative().start(false);
        }
      } catch (error) {
        const code =
          error instanceof Error && /^catalog\.[a-zA-Z]+$/.test(error.message)
            ? error.message
            : 'catalog.transferFailed';
        if (
          code !== 'catalog.nativeRequired' &&
          code !== 'catalog.foregroundRequired'
        ) {
          useCatalogStore
            .getState()
            .setTransfer({status: 'error', bytes: 0, total: 0, error: code});
        }
      } finally {
        checking = false;
      }
    };
    refresh();
    const subscription = AppState.addEventListener('change', s => {
      if (s === 'active') {
        refresh();
      }
    });
    return () => {
      disposed = true;
      subscription.remove();
    };
  }, []);
}
