import { useCallback, useRef, useState } from 'react';
import { useNavigation } from '@react-navigation/native';
import {
  cancelAllDownloads,
  cancelDownload,
  deleteAllDownloadedAssets,
  deleteAllQueuedItems,
  deleteDownloadedAsset,
  deleteQueuedItem,
  downloadStream,
  expireDownloadedAssetAt,
  getAvailableTracks,
  pauseDownload,
  resumeDownload,
  type AvailableTracksByType,
  type DownloadOptions,
  type DownloadStatus,
} from 'react-native-stream-downloader';

import type { CatalogTitle, SidecarSubtitle } from '../catalog/titles';
import { useToast } from '../components/Toast';
import { drmForDownload } from '../config/drm';
import { useMountedRef } from '../hooks/useMountedRef';
import { useRentals } from '../rentals/RentalsProvider';
import { AUTO_DELETE_MS, useSettings } from '../settings/SettingsProvider';
import type { RootNavigation } from '../types/navigation';
import { confirmDestructive } from '../utils/confirm';
import { useDownloader } from './DownloaderProvider';
import { buildMetadata, readMeta, type StoredSubtitle } from './downloadMeta';
import { downloadLog } from './downloadLog';
import {
  defaultChoice,
  describeChoice,
  hasChoices,
  toTracksRequest,
  WHOLE_FILE,
  type TrackChoice,
} from './trackChoices';

const DAY = 24 * 60 * 60 * 1000;
/** Download metadata is limited to 1 MiB; subtitles get most of it. */
const SUBTITLE_BUDGET_CHARS = 600_000;

/** Fetches the chosen sidecar subtitle files so they can travel with the download. */
async function fetchSidecarSubtitles(
  files: readonly SidecarSubtitle[],
  pick: TrackChoice['sidecar'],
): Promise<{ saved: StoredSubtitle[]; failed: number }> {
  const wanted = pick === 'off' ? [] : pick === 'all' ? files : files.filter(file => file.language === pick);
  const results = await Promise.all(
    wanted.map(async file => {
      try {
        const response = await fetch(file.url);
        if (!response.ok) return null;
        return { language: file.language, label: file.label, text: await response.text() };
      } catch {
        return null;
      }
    }),
  );
  const saved: StoredSubtitle[] = [];
  let used = 0;
  for (const result of results) {
    if (result === null || used + result.text.length > SUBTITLE_BUDGET_CHARS) continue;
    used += result.text.length;
    saved.push(result);
  }
  return { saved, failed: wanted.length - saved.length };
}

function sidecarLabel(saved: readonly StoredSubtitle[]): string {
  if (saved.length === 0) return 'Off';
  if (saved.length === 1) return saved[0]?.label ?? 'Off';
  return `${saved.length} languages`;
}

/**
 * Every download action in the app. Each one calls the package, re-reads
 * state from the package afterwards, and turns failures into a toast.
 * `isBusy(key)` blocks double taps while a call is in flight.
 */
export function useDownloadActions() {
  const { upsertStatus, refreshStatuses, refreshAssets, refreshAll } = useDownloader();
  const { settings } = useSettings();
  const { activeRental } = useRentals();
  const toast = useToast();
  const navigation = useNavigation<RootNavigation>();
  const mounted = useMountedRef();
  const inFlight = useRef(new Set<string>());
  const [busy, setBusy] = useState<ReadonlySet<string>>(() => new Set());

  const run = useCallback(
    async (key: string, work: () => Promise<void>): Promise<boolean> => {
      if (inFlight.current.has(key)) return false;
      inFlight.current.add(key);
      setBusy(new Set(inFlight.current));
      try {
        await work();
        return true;
      } catch (error) {
        downloadLog.actionFailed(key, error);
        toast.showError(error);
        return false;
      } finally {
        inFlight.current.delete(key);
        if (mounted.current) setBusy(new Set(inFlight.current));
      }
    },
    [mounted, toast],
  );

  const openDownloads = () => navigation.navigate('Main', { tab: 'downloads' });

  /**
   * DownloadOptions.expiresAt (epoch ms): the auto-delete setting, and never
   * later than the end of a rental.
   */
  const expiresAtFor = (rentalEndsAt: number | undefined): number | undefined => {
    const keepFor = AUTO_DELETE_MS[settings.autoDelete];
    const autoDelete = keepFor === null ? undefined : Date.now() + keepFor;
    if (rentalEndsAt === undefined) return autoDelete;
    return autoDelete === undefined ? rentalEndsAt : Math.min(autoDelete, rentalEndsAt);
  };

  const admit = async (title: CatalogTitle, choice: TrackChoice, tracks: AvailableTracksByType | null) => {
    if (title.source === null) throw new Error('This title is not available for download yet.');
    const rental = activeRental(title.id);
    if (title.rental && !rental) throw new Error(`Rent “${title.name}” to download it.`);

    // Progressive MP4 files are downloaded whole; adaptive streams send the chosen tracks.
    const tracksRequest = title.source.type === 'mp4' ? undefined : toTracksRequest(choice, settings.includeAllTracks);
    const sidecar = title.subtitles ? await fetchSidecarSubtitles(title.subtitles, choice.sidecar) : { saved: [], failed: 0 };
    if (sidecar.failed > 0) toast.show({ message: "Some subtitles couldn't be saved for offline viewing." });
    // Protected titles carry a DRM config; the downloader fetches and stores the offline license.
    const drm = title.protected ? await drmForDownload(title.id) : undefined;
    const expiresAt = expiresAtFor(rental?.endsAt);

    const labels = describeChoice(choice, tracks, settings.includeAllTracks);
    if (title.source.type === 'mp4') labels.quality = 'Original';
    if (title.subtitles) labels.subtitles = sidecarLabel(sidecar.saved);

    const options: DownloadOptions = {
      checkStorageBeforeDownload: settings.checkStorage,
      ...(expiresAt !== undefined ? { expiresAt } : {}),
      ...(settings.includeAllTracks ? { includeAllTracks: true } : {}),
      ...(tracksRequest !== undefined ? { tracks: tracksRequest } : {}),
      ...(drm !== undefined ? { drm } : {}),
      metadata: buildMetadata({
        titleId: title.id,
        title: title.name,
        format: title.source.type,
        protected: title.protected === true,
        labels,
        subtitles: sidecar.saved,
        rentalEndsAt: rental?.endsAt,
        includeAllTracks: settings.includeAllTracks,
        tracks: tracksRequest,
      }),
    };
    // Resolves once the download is admitted to the queue; completion arrives via onDownloadEnd.
    downloadLog.request(title.source.url, options);
    const status = await downloadStream(title.source.url, options);
    downloadLog.admitted(status);
    upsertStatus(status);
    toast.show({
      message: status.status === 'pending' ? `“${title.name}” is waiting to download` : `Downloading “${title.name}”`,
      action: { label: 'View', onPress: openDownloads },
    });
  };

  /** Start with an explicit choice from the download sheet. */
  const start = (title: CatalogTitle, choice: TrackChoice, tracks: AvailableTracksByType | null) =>
    run(`start:${title.id}`, () => admit(title, choice, tracks));

  /** Start without asking: video quality from Settings, every language and subtitle. */
  const startWithDefaults = (title: CatalogTitle) =>
    run(`start:${title.id}`, async () => {
      if (title.source === null || title.source.type === 'mp4') {
        await admit(title, WHOLE_FILE, null);
        return;
      }
      const tracks = await getAvailableTracks(title.source.url);
      await admit(title, hasChoices(tracks) ? defaultChoice(tracks, settings.videoQuality) : WHOLE_FILE, tracks);
    });

  const pause = (status: DownloadStatus) =>
    run(`pause:${status.id}`, async () => {
      downloadLog.action('pause', status.id);
      await pauseDownload(status.id);
      await refreshStatuses();
    });

  const resume = (status: DownloadStatus) =>
    run(`resume:${status.id}`, async () => {
      downloadLog.action('resume', status.id);
      await resumeDownload(status.id);
      await refreshStatuses();
    });

  /** Stops the download and discards what was downloaded so far. */
  const cancel = (status: DownloadStatus) =>
    run(`cancel:${status.id}`, async () => {
      downloadLog.action('cancel', status.id);
      await cancelDownload(status.id);
      await refreshStatuses();
    });

  /** Removes a waiting, paused or failed item from the queue. */
  const removeFromQueue = (status: DownloadStatus) =>
    run(`remove:${status.id}`, async () => {
      await deleteQueuedItem(status.id);
      await refreshStatuses();
    });

  /** Re-submits a failed download with the request (and subtitles) stored in its metadata. */
  const retry = (status: DownloadStatus) =>
    run(`retry:${status.id}`, async () => {
      const meta = readMeta(status.metadata);
      if (meta.rentalEndsAt !== undefined && meta.rentalEndsAt <= Date.now()) throw new Error('This rental has ended.');
      if (meta.protected && meta.titleId === undefined) throw new Error('This protected download cannot be retried.');
      const drm = meta.protected && meta.titleId !== undefined ? await drmForDownload(meta.titleId) : undefined;
      const expiresAt = expiresAtFor(meta.rentalEndsAt);
      const options: DownloadOptions = {
        checkStorageBeforeDownload: settings.checkStorage,
        ...(expiresAt !== undefined ? { expiresAt } : {}),
        ...(meta.request.includeAllTracks ? { includeAllTracks: true } : {}),
        ...(meta.request.tracks !== undefined ? { tracks: meta.request.tracks } : {}),
        ...(drm !== undefined ? { drm } : {}),
        ...(status.metadata !== undefined ? { metadata: status.metadata } : {}),
      };
      downloadLog.request(status.url, options);
      const next = await downloadStream(status.url, options);
      downloadLog.admitted(next);
      upsertStatus(next);
      // The failed attempt is replaced by the new one.
      await deleteQueuedItem(status.id);
      await refreshStatuses();
    });

  const deleteDownload = (assetId: string, name: string) =>
    run(`delete:${assetId}`, async () => {
      await deleteDownloadedAsset(assetId);
      await refreshAll();
      toast.show({ message: `“${name}” was deleted` });
    });

  /** Changes how long a downloaded title stays on the device (null: until deleted). */
  const keepFor = (assetId: string, days: number | null) =>
    run(`expire:${assetId}`, async () => {
      await expireDownloadedAssetAt(assetId, days === null ? 0 : Date.now() + days * DAY);
      await refreshAssets();
      toast.show({
        message: days === null ? 'Kept until you delete it' : `Available offline for ${days} more days`,
        tone: 'success',
      });
    });

  const cancelAll = async () => {
    const confirmed = await confirmDestructive('Cancel all downloads?', 'Everything in progress will stop.', 'Cancel all');
    if (!confirmed) return false;
    return run('cancelAll', async () => {
      await cancelAllDownloads();
      await refreshStatuses();
    });
  };

  const clearQueue = () =>
    run('clearQueue', async () => {
      // Removes waiting, paused and failed items; active transfers keep going.
      await deleteAllQueuedItems();
      await refreshStatuses();
    });

  const deleteAll = async () => {
    const confirmed = await confirmDestructive(
      'Delete all downloads?',
      'Every downloaded title will be removed from this device.',
      'Delete all',
    );
    if (!confirmed) return false;
    return run('deleteAll', async () => {
      await deleteAllDownloadedAssets();
      await refreshAll();
      toast.show({ message: 'All downloads were deleted' });
    });
  };

  const isBusy = (key: string) => busy.has(key);

  return {
    start,
    startWithDefaults,
    pause,
    resume,
    cancel,
    removeFromQueue,
    retry,
    deleteDownload,
    keepFor,
    cancelAll,
    clearQueue,
    deleteAll,
    isBusy,
  };
}
