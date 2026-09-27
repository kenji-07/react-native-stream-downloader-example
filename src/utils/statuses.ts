import type { DownloadStatus } from 'react-native-stream-downloader';

export type DownloadState = DownloadStatus['status'];

/** pending, downloading and paused downloads can still change; the rest are final. */
export function isUnfinished(state: DownloadState): boolean {
  return state === 'pending' || state === 'downloading' || state === 'paused';
}
