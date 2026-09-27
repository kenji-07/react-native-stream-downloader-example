import type {
  DownloadedAsset,
  DownloadStatus,
  Metadata,
} from 'react-native-stream-downloader';

import { TITLES } from '../catalog/titles';
import { formatExpiry } from '../utils/format';
import type { MediaType } from '../utils/media';
import { isUnfinished } from '../utils/statuses';
import type { ChoiceLabels, TracksRequest } from './trackChoices';

/** A sidecar subtitle file saved with an MP4 download (SRT or WebVTT text). */
export interface StoredSubtitle {
  language: string;
  label: string;
  text: string;
}

/**
 * What the app stores in DownloadOptions.metadata. It comes back on every
 * DownloadStatus and DownloadedAsset, so the Downloads screen can render
 * posters and labels, a failed download can be retried with the same request,
 * and sidecar subtitles play offline, without a separate database or file
 * store. Metadata is limited to 1 MiB of JSON. No DRM tokens or secrets go here.
 */
export interface DownloadMeta {
  titleId?: string;
  /** Documented field; also used by the downloader for file naming. */
  title?: string;
  format?: MediaType;
  protected: boolean;
  labels?: ChoiceLabels;
  subtitles: StoredSubtitle[];
  /** Set for rentals: the download must not outlive the rental. */
  rentalEndsAt?: number;
  request: { includeAllTracks: boolean; tracks?: TracksRequest };
}

export interface MetaInput {
  titleId: string;
  title: string;
  format: MediaType;
  protected: boolean;
  labels: ChoiceLabels;
  subtitles: StoredSubtitle[];
  rentalEndsAt: number | undefined;
  includeAllTracks: boolean;
  tracks: TracksRequest | undefined;
}

export function buildMetadata(input: MetaInput): Metadata {
  return {
    title: input.title,
    titleId: input.titleId,
    format: input.format,
    protected: input.protected,
    labels: { ...input.labels },
    subtitles: input.subtitles.map(subtitle => ({ ...subtitle })),
    ...(input.rentalEndsAt !== undefined ? { rentalEndsAt: input.rentalEndsAt } : {}),
    request: {
      includeAllTracks: input.includeAllTracks,
      ...(input.tracks !== undefined ? { tracks: input.tracks } : {}),
    },
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

function stringList(value: unknown): string[] | undefined {
  return Array.isArray(value) && value.every((item): item is string => typeof item === 'string') ? value : undefined;
}

function readTracks(value: unknown): TracksRequest | undefined {
  if (!isRecord(value)) return undefined;
  const request: TracksRequest = {};
  for (const key of ['video', 'audio', 'text'] as const) {
    const ids = stringList(value[key]);
    if (ids !== undefined) request[key] = ids;
  }
  return Object.keys(request).length > 0 ? request : undefined;
}

function readSubtitles(value: unknown): StoredSubtitle[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap(item => {
    if (!isRecord(item)) return [];
    const { language, label, text } = item;
    return typeof language === 'string' && typeof label === 'string' && typeof text === 'string'
      ? [{ language, label, text }]
      : [];
  });
}

function readLabels(value: unknown): ChoiceLabels | undefined {
  if (!isRecord(value)) return undefined;
  const { quality, audio, subtitles } = value;
  return typeof quality === 'string' && typeof audio === 'string' && typeof subtitles === 'string'
    ? { quality, audio, subtitles }
    : undefined;
}

/** Metadata values are `unknown`; every field is checked before use. */
export function readMeta(metadata: Metadata | undefined): DownloadMeta {
  const record: Record<string, unknown> = metadata ?? {};
  const request = isRecord(record.request) ? record.request : {};
  const tracks = readTracks(request.tracks);
  const labels = readLabels(record.labels);
  const format = record.format;
  return {
    ...(typeof record.titleId === 'string' ? { titleId: record.titleId } : {}),
    ...(typeof record.title === 'string' && record.title !== '' ? { title: record.title } : {}),
    ...(format === 'hls' || format === 'dash' || format === 'mp4' ? { format } : {}),
    protected: record.protected === true,
    ...(labels !== undefined ? { labels } : {}),
    subtitles: readSubtitles(record.subtitles),
    ...(typeof record.rentalEndsAt === 'number' ? { rentalEndsAt: record.rentalEndsAt } : {}),
    request: { includeAllTracks: request.includeAllTracks === true, ...(tracks !== undefined ? { tracks } : {}) },
  };
}

/** Which catalog title a download belongs to: by stored titleId, else by original URL. */
export function titleIdOf(item: { url: string; metadata?: Metadata }): string | undefined {
  return readMeta(item.metadata).titleId ?? TITLES.find(title => title.source?.url === item.url)?.id;
}

export type TitleDownloadState =
  | { kind: 'none' }
  | { kind: 'queued' | 'downloading' | 'paused' | 'failed'; status: DownloadStatus }
  | { kind: 'downloaded'; assetId: string; asset?: DownloadedAsset; status?: DownloadStatus };

/**
 * Derives a title's download state from package data. A DownloadedAsset (or a
 * 'completed' status) wins; otherwise the newest unfinished or failed attempt.
 * Removed attempts are ignored.
 */
export function downloadStateFor(
  titleId: string,
  statuses: readonly DownloadStatus[],
  assets: readonly DownloadedAsset[],
): TitleDownloadState {
  const asset = assets.find(item => titleIdOf(item) === titleId);
  const mine = statuses.filter(status => titleIdOf(status) === titleId);
  if (asset) return { kind: 'downloaded', assetId: asset.id, asset, ...optionalStatus(mine.find(s => s.id === asset.id)) };
  const completed = mine.find(status => status.status === 'completed');
  if (completed) return { kind: 'downloaded', assetId: completed.id, status: completed };
  const newestFirst = [...mine].reverse();
  const attempt = newestFirst.find(status => isUnfinished(status.status)) ?? newestFirst.find(status => status.status === 'failed');
  if (!attempt) return { kind: 'none' };
  const kind = attempt.status === 'pending' ? 'queued' : attempt.status === 'removed' || attempt.status === 'completed' ? 'failed' : attempt.status;
  return { kind, status: attempt };
}

function optionalStatus(status: DownloadStatus | undefined): { status?: DownloadStatus } {
  return status === undefined ? {} : { status };
}

/**
 * When a downloaded copy must go: its expiresAt (auto-delete setting or
 * rental) or, for rentals, the rental end. undefined means never.
 */
export function expiryOf(asset: DownloadedAsset): number | undefined {
  const rentalEndsAt = readMeta(asset.metadata).rentalEndsAt;
  const expiresAt = asset.expiresAt !== undefined && asset.expiresAt > 0 ? asset.expiresAt : undefined;
  if (rentalEndsAt === undefined) return expiresAt;
  return expiresAt === undefined ? rentalEndsAt : Math.min(expiresAt, rentalEndsAt);
}

/** "Expires in 5 days", "Rental ends in 23 hours" or "Kept until you delete it". */
export function expiryLabel(asset: DownloadedAsset, now: number): string {
  return formatExpiry(expiryOf(asset), now, readMeta(asset.metadata).rentalEndsAt !== undefined ? 'rental' : 'download');
}
