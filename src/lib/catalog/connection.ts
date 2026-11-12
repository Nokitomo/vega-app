import {openDatabaseAsync} from 'expo-sqlite';

// FTS owns internal statements. Expo SQLite 16's automatic finalize-all loop
// also finalizes those statements, causing a native double free on close.
// Every statement created by our code is explicitly finalized instead.
export function openCatalogDatabase(file: string, directory: string) {
  return openDatabaseAsync(
    file,
    {
      useNewConnection: true,
      finalizeUnusedStatementsBeforeClosing: false,
    },
    directory,
  );
}
