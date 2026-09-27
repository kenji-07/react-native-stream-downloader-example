/**
 * A viewer-friendly version of anything a downloader call rejects with.
 *
 * The docs do not define a rejection shape. The local package attaches a
 * string `code` to its errors; it is read defensively to pick a friendly
 * message, and kept so it can be shown as a small "error code".
 */
export interface FriendlyError {
  message: string;
  code?: string;
}

const MESSAGES: Record<string, string> = {
  E_NOT_REGISTERED: 'Downloads are turned off. Turn them on in Settings.',
  E_LINKING: 'The download engine is missing from this build of the app.',
  E_NETWORK: 'Check your internet connection and try again.',
  E_MANIFEST: 'This title could not be loaded right now.',
  E_INVALID_STREAM: 'This title could not be loaded right now.',
  E_MEDIA_INSPECTION: 'This title could not be loaded right now.',
  E_INVALID_URL: 'This title has an invalid address.',
  E_INSUFFICIENT_STORAGE: 'Not enough storage. Delete some downloads and try again.',
  E_STORAGE: 'Your device storage could not be used for this download.',
  E_ASSET_IN_USE: 'Close the player first, then try again.',
  E_ASSET_NOT_FOUND: 'This download is no longer available.',
  E_CORRUPT_ASSET: 'This download is damaged. Delete it and download it again.',
  E_UNSUPPORTED_MEDIA: "This title can't be downloaded on this device.",
  E_UNSUPPORTED_CAPABILITY: "This title can't be downloaded on this device.",
  E_INVALID_TRACKS: "That quality and language combination isn't available. Try other options.",
  E_BUSY: 'Just a moment, then try again.',
  E_INVALID_STATE: "This download can't be changed right now.",
};

const DRM_MESSAGE = "This protected title couldn't be licensed for offline viewing.";

function readString(source: object, key: string): string | undefined {
  const value: unknown = Reflect.get(source, key);
  return typeof value === 'string' && value.length > 0 ? value : undefined;
}

export function formatError(error: unknown): FriendlyError {
  if (typeof error === 'string') return { message: error };
  if (error === null || typeof error !== 'object') return { message: 'Something went wrong.' };

  const code = readString(error, 'code');
  const raw = readString(error, 'message') ?? 'Something went wrong.';
  const friendly = code === undefined ? undefined : code.startsWith('E_DRM') ? DRM_MESSAGE : MESSAGES[code];
  return { message: friendly ?? raw, ...(code !== undefined ? { code } : {}) };
}
