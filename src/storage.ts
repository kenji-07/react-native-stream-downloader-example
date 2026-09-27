import { createMMKV, type MMKV } from 'react-native-mmkv';

/**
 * Settings and rentals live in MMKV. If the native module is unavailable (e.g. a
 * stale native build) the app keeps working with in-memory defaults.
 */
let store: MMKV | null | undefined;

function getStore(): MMKV | null {
  if (store === undefined) {
    try {
      store = createMMKV({ id: 'nova-app' });
    } catch {
      store = null;
    }
  }
  return store;
}

export function readJson(key: string): unknown {
  const raw = getStore()?.getString(key);
  if (raw === undefined) return undefined;
  try {
    return JSON.parse(raw) as unknown;
  } catch {
    return undefined;
  }
}

export function writeJson(key: string, value: unknown): void {
  getStore()?.set(key, JSON.stringify(value));
}
