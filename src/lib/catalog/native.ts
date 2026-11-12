import {NativeModules} from 'react-native';
import type {TransferState} from './types';

export interface CatalogNative {
  root(): Promise<string>;
  configure(
    automatic: boolean,
    cellular: boolean,
    revision: string,
    title: string,
  ): Promise<void>;
  start(forceSnapshot: boolean): Promise<void>;
  pause(): Promise<void>;
  cancel(): Promise<void>;
  status(): Promise<TransferState>;
  pending(): Promise<string | null>;
  acknowledge(): Promise<void>;
  gunzip(source: string, target: string, limit: number): Promise<void>;
  openLines(file: string): Promise<void>;
  readLines(): Promise<string[]>;
  closeLines(): Promise<void>;
  beginHash(prefix: string): Promise<void>;
  appendHash(values: string[]): Promise<void>;
  finishHash(): Promise<string>;
}
export function catalogNative(): CatalogNative {
  const module = NativeModules.VegaCatalog as CatalogNative | undefined;
  if (!module) {
    throw new Error('catalog.nativeRequired');
  }
  return module;
}
