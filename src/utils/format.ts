import type { DownloadStatus } from 'react-native-stream-downloader';

const BYTE_UNITS = ['KB', 'MB', 'GB', 'TB'];

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  let value = bytes / 1024;
  let unit = 0;
  while (value >= 1024 && unit < BYTE_UNITS.length - 1) {
    value /= 1024;
    unit += 1;
  }
  return `${value.toFixed(value >= 100 ? 0 : 1)} ${BYTE_UNITS[unit]}`;
}

/**
 * "45% · 120 MB of 300 MB". Byte counts are optional in DownloadStatus, so
 * only what the downloader reports is shown. Progress is a 0–1 fraction and
 * is rounded down, so 100% appears only when the download really completes.
 */
export function progressLine(status: DownloadStatus): string {
  if (status.waitingForNetwork) return 'Waiting for an allowed network';
  if (status.nextRetryAt && status.status === 'pending') return `Retry ${status.retryCount ?? 1} at ${new Date(status.nextRetryAt).toLocaleTimeString()}`;
  const parts = [`${Math.floor(status.progress * 100)}%`];
  if (status.receivedBytes !== undefined) {
    parts.push(
      status.totalBytes !== undefined
        ? `${formatBytes(status.receivedBytes)} of ${formatBytes(status.totalBytes)}`
        : formatBytes(status.receivedBytes),
    );
  }
  if (status.status === 'downloading' && status.bytesPerSecond !== undefined) parts.push(`${formatBytes(Math.round(status.bytesPerSecond))}/s`);
  if (status.status === 'downloading' && status.estimatedRemainingSeconds !== undefined) parts.push(`${formatClock(Math.ceil(status.estimatedRemainingSeconds))} left`);
  return parts.join(' · ');
}

export function formatBitrate(bitsPerSecond: number): string {
  if (bitsPerSecond >= 1_000_000) return `${(bitsPerSecond / 1_000_000).toFixed(1)} Mbps`;
  if (bitsPerSecond >= 1000) return `${Math.round(bitsPerSecond / 1000)} kbps`;
  return `${bitsPerSecond} bps`;
}

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

/** Player clock: 4:05 or 1:02:03. */
export function formatClock(totalSeconds: number): string {
  const safe = Math.max(0, Math.floor(totalSeconds));
  const hours = Math.floor(safe / 3600);
  const minutes = Math.floor((safe % 3600) / 60);
  const seconds = safe % 60;
  return hours > 0 ? `${hours}:${pad(minutes)}:${pad(seconds)}` : `${minutes}:${pad(seconds)}`;
}

/** DownloadedAsset.duration is in milliseconds. */
export function formatRuntime(ms: number): string {
  const minutes = Math.round(ms / 60000);
  if (ms < 60000) return `${Math.max(1, Math.round(ms / 1000))} sec`;
  if (minutes < 60) return `${minutes} min`;
  return `${Math.floor(minutes / 60)} h ${minutes % 60} min`;
}

const DAY = 24 * 60 * 60 * 1000;
const HOUR = 60 * 60 * 1000;

/** Epoch milliseconds; missing or 0 means the download never expires. */
export function formatExpiry(expiresAt: number | undefined, now: number, kind: 'download' | 'rental' = 'download'): string {
  if (expiresAt === undefined || expiresAt === 0) return 'Kept until you delete it';
  const what = kind === 'rental' ? 'Rental ends' : 'Expires';
  const left = expiresAt - now;
  if (left <= 0) return kind === 'rental' ? 'Rental ended' : 'Expired';
  if (left >= 2 * DAY) return `${what} in ${Math.floor(left / DAY)} days`;
  if (left >= 2 * HOUR) return `${what} in ${Math.floor(left / HOUR)} hours`;
  return `${what} in ${Math.max(1, Math.ceil(left / 60000))} min`;
}

export function expiresSoon(expiresAt: number | undefined, now: number): boolean {
  return expiresAt !== undefined && expiresAt !== 0 && expiresAt - now < 2 * DAY;
}
