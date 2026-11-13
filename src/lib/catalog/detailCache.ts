import * as RNFS from '@dr.pogodin/react-native-fs';
import {useCatalogStore} from './store';

const directory = () => `${RNFS.DocumentDirectoryPath}/cinema-details`;
const sha256 = /^[a-f0-9]{64}$/;
const pending = new Map<string, Promise<unknown>>();
let recent: {key: string; detail: unknown} | undefined;
let fileOperations = Promise.resolve();

function serialize<T>(operation: () => Promise<T>): Promise<T> {
  const result = fileOperations.then(operation);
  fileOperations = result.then(
    () => undefined,
    () => undefined,
  );
  return result;
}

async function trim(protectedFile?: string) {
  const root = directory();
  if (!(await RNFS.exists(root))) {
    return;
  }
  const budget =
    useCatalogStore.getState().preferences.detailCacheMb * 1_000_000;
  const files = (await RNFS.readDir(root))
    .filter(file => file.isFile() && /^[a-f0-9]{64}\.json$/.test(file.name))
    .sort(
      (a, b) =>
        (a.mtime?.getTime() ?? 0) - (b.mtime?.getTime() ?? 0) ||
        a.name.localeCompare(b.name),
    );
  let size = files.reduce((total, file) => total + Number(file.size), 0);
  for (const file of files) {
    if (size <= budget) {
      break;
    }
    if (file.path !== protectedFile) {
      await RNFS.unlink(file.path);
      size -= Number(file.size);
    }
  }
}

export function trimCatalogDetailCache(): Promise<void> {
  recent = undefined;
  return serialize(() => trim());
}

type DetailReference = {
  workId: string;
  sourceCommit: string;
  hash: string;
  bytes: number;
};

export function loadCatalogDetail(ref: DetailReference): Promise<unknown> {
  if (
    !/^work-\d+$/.test(ref.workId) ||
    !/^[a-f0-9]{40}$/.test(ref.sourceCommit) ||
    !sha256.test(ref.hash) ||
    !Number.isSafeInteger(ref.bytes) ||
    ref.bytes <= 0
  ) {
    return Promise.reject(new Error('catalog.invalidDatabase'));
  }
  const key = `${ref.workId}:${ref.hash}:${ref.bytes}`;
  const existing = pending.get(key);
  if (existing) {
    return existing;
  }
  const task = readDetail(ref, key)
    .then(detail => {
      recent = {key, detail};
      return detail;
    })
    .finally(() => pending.delete(key));
  pending.set(key, task);
  return task;
}

async function readDetail(ref: DetailReference, key: string): Promise<unknown> {
  const root = directory();
  const target = `${root}/${ref.hash}.json`;
  const readVerified = async (file: string) => {
    const stat = await RNFS.stat(file);
    if (
      Number(stat.size) !== ref.bytes ||
      (await RNFS.hash(file, 'sha256')) !== ref.hash
    ) {
      throw new Error('catalog.invalidDatabase');
    }
    const detail = JSON.parse(await RNFS.readFile(file, 'utf8'));
    if (
      detail?.id !== ref.workId ||
      !detail.info ||
      !Array.isArray(detail.seasons) ||
      !detail.providers
    ) {
      throw new Error('catalog.invalidDatabase');
    }
    return detail;
  };

  const cached = await serialize(async () => {
    if (!(await RNFS.exists(target))) {
      return undefined;
    }
    let detail: unknown;
    try {
      detail = recent?.key === key ? recent.detail : await readVerified(target);
    } catch {
      await RNFS.unlink(target);
      return undefined;
    }
    await RNFS.touch(target, new Date());
    return detail;
  });
  if (cached) {
    return cached;
  }

  await RNFS.mkdir(root);
  const partial = `${target}.${Date.now()}-${Math.random().toString(36).slice(2)}.tmp`;
  try {
    const url = `https://raw.githubusercontent.com/Nokitomo/database/${ref.sourceCommit}/cinema/data/items/${ref.workId}.json`;
    const download = RNFS.downloadFile({
      fromUrl: url,
      toFile: partial,
      connectionTimeout: 15000,
      readTimeout: 15000,
      progressInterval: 100,
      progress: ({bytesWritten}) => {
        if (bytesWritten > ref.bytes) {
          RNFS.stopDownload(download.jobId);
        }
      },
    });
    if ((await download.promise).statusCode !== 200) {
      throw new Error('catalog.transferFailed');
    }
    const detail = await readVerified(partial);
    await serialize(async () => {
      const budget =
        useCatalogStore.getState().preferences.detailCacheMb * 1_000_000;
      if (ref.bytes <= budget && !(await RNFS.exists(target))) {
        await RNFS.moveFile(partial, target);
        await RNFS.touch(target, new Date());
        await trim(target);
      }
    });
    return detail;
  } finally {
    if (await RNFS.exists(partial)) {
      await RNFS.unlink(partial);
    }
  }
}
