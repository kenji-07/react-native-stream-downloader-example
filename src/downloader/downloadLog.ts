import type { DownloadOptions, DownloadStatus } from 'react-native-stream-downloader';

import { progressLine } from '../utils/format';
import { readMeta } from './downloadMeta';

const TAG = '[download]';
/** Progress is logged once per this many percent, per download. */
const PROGRESS_STEP = 10;

const lastLoggedStep = new Map<string, number>();

function name(status: DownloadStatus): string {
  return `“${readMeta(status.metadata).title ?? status.url}” (${status.id})`;
}

/**
 * Development-only console log of the download lifecycle. Metadata and DRM
 * settings are summarised, not printed: metadata can hold subtitle files and
 * DRM headers can hold license tokens.
 */
export const downloadLog = {
  request(url: string, options: DownloadOptions) {
    if (!__DEV__) return;
    console.log(TAG, 'request', url, {
      tracks: options.tracks ?? 'whole file',
      includeAllTracks: options.includeAllTracks === true,
      drm: options.drm !== undefined,
      expiresAt: options.expiresAt !== undefined ? new Date(options.expiresAt).toISOString() : 'never',
      checkStorage: options.checkStorageBeforeDownload === true,
    });
  },

  admitted(status: DownloadStatus) {
    if (!__DEV__) return;
    console.log(TAG, 'admitted', name(status), status.status);
  },

  progress(statuses: readonly DownloadStatus[]) {
    if (!__DEV__) return;
    for (const status of statuses) {
      if (status.status !== 'downloading') continue;
      const step = Math.floor((status.progress * 100) / PROGRESS_STEP);
      if (lastLoggedStep.get(status.id) === step) continue;
      lastLoggedStep.set(status.id, step);
      console.log(TAG, 'progress', name(status), progressLine(status));
    }
  },

  end(status: DownloadStatus) {
    lastLoggedStep.delete(status.id);
    if (!__DEV__) return;
    if (status.status === 'failed') console.warn(TAG, 'failed', name(status), status.error ?? '');
    else console.log(TAG, status.status, name(status));
  },

  action(action: string, id: string) {
    if (!__DEV__) return;
    console.log(TAG, action, id);
  },

  actionFailed(key: string, error: unknown) {
    if (!__DEV__) return;
    console.warn(TAG, `${key} failed`, error);
  },

  error(message: string) {
    if (!__DEV__) return;
    console.warn(TAG, 'error', message);
  },
};
