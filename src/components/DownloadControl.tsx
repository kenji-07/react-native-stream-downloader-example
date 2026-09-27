import { useState } from 'react';
import { Pressable } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { getDRMLicenseStatus, renewDRMLicense } from 'react-native-stream-downloader';
import { drmForDownload, drmLicenseStatusOptions } from '../config/drm';

import type { CatalogTitle } from '../catalog/titles';
import { useDownloader } from '../downloader/DownloaderProvider';
import { expiryLabel, readMeta, type TitleDownloadState } from '../downloader/downloadMeta';
import { useDownloadActions } from '../downloader/useDownloadActions';
import { useRentals } from '../rentals/RentalsProvider';
import { useRentTitle } from '../rentals/useRentTitle';
import { useSettings } from '../settings/SettingsProvider';
import type { RootNavigation } from '../types/navigation';
import { progressLine } from '../utils/format';
import { Button } from './Buttons';
import { DownloadRing } from './DownloadRing';
import { Icon } from './Icon';
import { DownloadOptionsSheet } from './DownloadOptionsSheet';
import { ActionSheet, type SheetAction } from './Sheet';
import { useToast } from './Toast';

interface DownloadControlProps {
  state: TitleDownloadState;
  name: string;
  /** Needed to start a new download; rows for existing downloads may omit it. */
  title?: CatalogTitle;
  variant: 'full' | 'ring';
}

function percent(state: TitleDownloadState): number {
  return state.kind === 'none' || state.kind === 'downloaded' ? 0 : Math.floor(state.status.progress * 100);
}

function fullLabel(state: TitleDownloadState): string {
  switch (state.kind) {
    case 'none':
      return 'Download';
    case 'queued':
      return state.status.waitingForNetwork || state.status.nextRetryAt ? progressLine(state.status) : 'Waiting to download';
    case 'downloading':
      return `Downloading · ${percent(state)}%`;
    case 'paused':
      return `Paused · ${percent(state)}%`;
    case 'failed':
      return 'Download failed';
    case 'downloaded':
      return 'Downloaded';
  }
}

function menuSubtitle(state: TitleDownloadState, now: number): string | undefined {
  if (state.kind === 'downloaded') return state.asset ? expiryLabel(state.asset, now) : undefined;
  if (state.kind === 'none') return undefined;
  if (state.kind === 'failed') return state.status.error ?? 'Something went wrong while downloading.';
  return progressLine(state.status);
}

/**
 * The Download button / ring. Tapping it starts a download (optionally via
 * the quality sheet), or opens a menu with what the current state allows:
 * pause, resume, cancel, retry, remove, play, keep longer, delete.
 * Rentals must be rented first, and their downloads cannot outlive the rental.
 */
export function DownloadControl({ state, name, title, variant }: DownloadControlProps) {
  const actions = useDownloadActions();
  const { engine } = useDownloader();
  const { settings } = useSettings();
  const { now, activeRental } = useRentals();
  const rentTitle = useRentTitle();
  const toast = useToast();
  const navigation = useNavigation<RootNavigation>();
  const [menuOpen, setMenuOpen] = useState(false);
  const [licenseBusy, setLicenseBusy] = useState(false);
  const [optionsOpen, setOptionsOpen] = useState(false);
  const starting = title !== undefined && actions.isBusy(`start:${title.id}`);
  // A protected title stays locked until DRM is configured (src/config/drm.ts).
  const locked = state.kind === 'none' && title !== undefined && title.source === null;
  const needsRental = state.kind === 'none' && title?.rental !== undefined && activeRental(title.id) === undefined;
  const subtitle = menuSubtitle(state, now);

  const requestDownload = () => {
    if (!title) return;
    if (title.source === null) {
      toast.show({ message: `“${title.name}” isn't available to download yet.` });
      return;
    }
    if (needsRental) {
      rentTitle(title);
      return;
    }
    if (engine.phase !== 'ready') {
      toast.show({
        message: 'Downloads are turned off.',
        action: { label: 'Settings', onPress: () => navigation.navigate('Main', { tab: 'settings' }) },
      });
      return;
    }
    // MP4 files are downloaded whole, so there is only something to ask when they have subtitles.
    const hasOptions = title.source.type !== 'mp4' || (title.subtitles?.length ?? 0) > 0;
    if (hasOptions && settings.askBeforeDownload) setOptionsOpen(true);
    else void actions.startWithDefaults(title);
  };

  const onPress = () => (state.kind === 'none' ? requestDownload() : setMenuOpen(true));

  const manageLicense = async (renew: boolean) => {
    if (licenseBusy || state.kind !== 'downloaded' || !title?.protected) return;
    setLicenseBusy(true);
    try {
      if (renew) await renewDRMLicense(state.assetId, await drmForDownload(title.id));
      const license = await getDRMLicenseStatus(state.assetId, drmLicenseStatusOptions(title.id));
      const detail = license?.expiresAt !== undefined ? `Rights expire ${new Date(license.expiresAt).toLocaleString()}`
        : license?.state === 'valid' ? 'Offline license is valid'
        : license?.state === 'expired' ? 'Offline license has expired'
        : license?.state === 'missing' ? 'Offline license is missing'
        : 'The provider has not supplied an expiration date';
      toast.show({ message: renew ? `License renewed. ${detail}` : detail });
    } catch (error) { toast.showError(error); }
    finally { setLicenseBusy(false); }
  };

  const menu: SheetAction[] = [];
  if (state.kind === 'queued' || state.kind === 'downloading' || state.kind === 'paused') {
    const { status } = state;
    menu.push(
      state.kind === 'paused'
        ? { key: 'resume', label: 'Resume download', icon: 'download', onPress: () => void actions.resume(status) }
        : { key: 'pause', label: 'Pause download', icon: 'pause', onPress: () => void actions.pause(status) },
      {
        key: 'cancel',
        label: 'Cancel download',
        icon: 'close',
        destructive: true,
        onPress: () => void actions.cancel(status),
      },
    );
  } else if (state.kind === 'failed') {
    const { status } = state;
    menu.push(
      { key: 'retry', label: 'Try again', icon: 'refresh', onPress: () => void actions.retry(status) },
      { key: 'remove', label: 'Remove', icon: 'trash', destructive: true, onPress: () => void actions.removeFromQueue(status) },
    );
  } else if (state.kind === 'downloaded') {
    const { assetId } = state;
    if (title?.protected) menu.push(
      { key: 'license-status', label: licenseBusy ? 'Checking license…' : 'Check offline license', icon: 'info', onPress: () => void manageLicense(false) },
      { key: 'license-renew', label: 'Renew offline license', icon: 'refresh', onPress: () => void manageLicense(true) },
    );
    const rental = readMeta(state.asset?.metadata ?? state.status?.metadata).rentalEndsAt !== undefined;
    menu.push({ key: 'play', label: 'Play', icon: 'play', onPress: () => navigation.navigate('Player', { mode: 'offline', assetId }) });
    // A rental's download expires with the rental and cannot be kept longer.
    if (!rental) {
      menu.push(
        { key: 'keep7', label: 'Keep for 7 days', icon: 'timer', onPress: () => void actions.keepFor(assetId, 7) },
        { key: 'keep30', label: 'Keep for 30 days', icon: 'timer', onPress: () => void actions.keepFor(assetId, 30) },
        { key: 'keep', label: 'Keep until I delete it', icon: 'offline', onPress: () => void actions.keepFor(assetId, null) },
      );
    }
    menu.push(
      {
        key: 'delete',
        label: 'Delete download',
        icon: 'trash',
        destructive: true,
        onPress: () => void actions.deleteDownload(assetId, name),
      },
    );
  }

  return (
    <>
      {variant === 'full' ? (
        <Button
          variant="secondary"
          label={locked ? 'Download unavailable' : needsRental ? 'Rent to download' : fullLabel(state)}
          leading={locked || needsRental ? <Icon name="lock" size={22} /> : <DownloadRing state={state} size={26} />}
          loading={starting}
          onPress={onPress}
        />
      ) : (
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={fullLabel(state)}
          hitSlop={8}
          disabled={starting}
          onPress={onPress}
        >
          <DownloadRing state={state} />
        </Pressable>
      )}

      <ActionSheet
        visible={menuOpen}
        title={name}
        {...(subtitle !== undefined ? { subtitle } : {})}
        actions={menu}
        onClose={() => setMenuOpen(false)}
      />

      {title !== undefined ? (
        <DownloadOptionsSheet
          title={title}
          visible={optionsOpen}
          onClose={() => setOptionsOpen(false)}
          onConfirm={(choice, tracks) => {
            setOptionsOpen(false);
            void actions.start(title, choice, tracks);
          }}
        />
      ) : null}
    </>
  );
}
