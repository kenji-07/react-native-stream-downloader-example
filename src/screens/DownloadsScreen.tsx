import { useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import type { DownloadedAsset, DownloadStatus } from 'react-native-stream-downloader';

import { findTitle, type Title } from '../catalog/titles';
import { Button, IconButton } from '../components/Buttons';
import { DownloadControl } from '../components/DownloadControl';
import { AmbientBackground, Glow } from '../components/Gradients';
import { Icon } from '../components/Icon';
import { ActionSheet, type SheetAction } from '../components/Sheet';
import { TitleArtwork } from '../components/TitleArtwork';
import { useToast } from '../components/Toast';
import { useDownloader } from '../downloader/DownloaderProvider';
import { expiryLabel, expiryOf, readMeta, titleIdOf, type TitleDownloadState } from '../downloader/downloadMeta';
import { useDownloadActions } from '../downloader/useDownloadActions';
import { useRentals } from '../rentals/RentalsProvider';
import { useSettings } from '../settings/SettingsProvider';
import { colors, radius, spacing } from '../theme';
import type { RootNavigation } from '../types/navigation';
import { expiresSoon, formatBytes, formatRuntime, progressLine } from '../utils/format';
import { isUnfinished } from '../utils/statuses';

const THUMB_WIDTH = 124;
const THUMB_HEIGHT = 70;

/** Artwork for rows: the catalog title when known, else a neutral palette. */
type DownloadItem = Pick<DownloadStatus, 'url' | 'metadata'>;

function artworkFor(item: DownloadItem): Pick<Title, 'name' | 'palette' | 'image'> {
  const title = findTitle(titleIdOf(item));
  if (title) return title;
  return { name: readMeta(item.metadata).title ?? 'Download', palette: ['#475569', '#1E293B', '#07070C'] };
}

function nameOf(item: DownloadItem): string {
  return readMeta(item.metadata).title ?? findTitle(titleIdOf(item))?.name ?? 'Download';
}

function stateOfStatus(status: DownloadStatus): TitleDownloadState {
  if (status.status === 'pending') return { kind: 'queued', status };
  if (status.status === 'downloading' || status.status === 'paused') return { kind: status.status, status };
  return { kind: 'failed', status };
}

export function DownloadsScreen({ active }: { active: boolean }) {
  const navigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { engine, enable, statuses, assets, refreshAll } = useDownloader();
  const { updateSettings } = useSettings();
  const actions = useDownloadActions();
  const [menuOpen, setMenuOpen] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const assetIds = useMemo(() => new Set(assets.map(asset => asset.id)), [assets]);
  // In progress: unfinished and failed attempts. Removed ones are gone for good.
  const inProgress = statuses.filter(
    status => !assetIds.has(status.id) && (isUnfinished(status.status) || status.status === 'failed'),
  );
  const byteCounts = new Map(statuses.map(status => [status.id, status.totalBytes ?? status.receivedBytes]));
  const usedBytes = assets.reduce((sum, asset) => sum + (byteCounts.get(asset.id) ?? 0), 0);
  const hasUnfinished = statuses.some(status => isUnfinished(status.status));

  // Fresh snapshot (getDownloadsStatus + getDownloadedAssets) whenever the tab is opened.
  useEffect(() => {
    if (active && engine.phase === 'ready') refreshAll().catch(() => undefined);
  }, [active, engine.phase, refreshAll]);

  const onRefresh = () => {
    setRefreshing(true);
    refreshAll()
      .catch(error => toast.showError(error))
      .finally(() => setRefreshing(false));
  };

  const turnOn = async () => {
    if (await enable()) updateSettings({ downloadsEnabled: true });
  };

  const menu: SheetAction[] = [];
  if (hasUnfinished) {
    menu.push({
      key: 'cancelAll',
      label: 'Cancel all downloads',
      icon: 'close',
      destructive: true,
      onPress: () => void actions.cancelAll(),
    });
  }
  if (inProgress.length > 0) {
    menu.push({
      key: 'clear',
      label: 'Clear waiting, paused & failed',
      icon: 'refresh',
      onPress: () => void actions.clearQueue(),
    });
  }
  if (assets.length > 0) {
    menu.push({
      key: 'deleteAll',
      label: 'Delete all downloads',
      icon: 'trash',
      destructive: true,
      onPress: () => void actions.deleteAll(),
    });
  }

  const empty = inProgress.length === 0 && assets.length === 0;

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        <View style={styles.header}>
          <Text style={styles.title}>Downloads</Text>
          {menu.length > 0 ? <IconButton icon="more" label="Download options" onPress={() => setMenuOpen(true)} /> : null}
        </View>

        {engine.phase === 'off' ? (
          <Banner
            icon="pause"
            title="Downloads are turned off"
            message="Turn them on to download and watch offline."
            action={<Button label="Turn on" onPress={() => void turnOn()} />}
          />
        ) : null}
        {engine.phase === 'failed' ? (
          <Banner
            icon="warning"
            title="Downloads aren't working"
            message={engine.error.message}
            action={<Button variant="secondary" icon="refresh" label="Try again" onPress={() => void enable()} />}
          />
        ) : null}

        {assets.length > 0 ? (
          <View style={styles.storage}>
            <Icon name="offline" size={18} color={colors.success} />
            <Text style={styles.storageText}>
              {assets.length} {assets.length === 1 ? 'title' : 'titles'}
              {usedBytes > 0 ? ` · ${formatBytes(usedBytes)} on this device` : ''}
            </Text>
          </View>
        ) : null}

        {empty && engine.phase === 'ready' ? (
          <EmptyDownloads onBrowse={() => navigation.navigate('Main', { tab: 'home' })} />
        ) : null}

        {inProgress.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>In progress</Text>
            {inProgress.map(status => (
              <ProgressRow key={status.id} status={status} />
            ))}
          </View>
        ) : null}

        {assets.length > 0 ? (
          <View style={styles.section}>
            <Text style={styles.sectionTitle}>Downloaded</Text>
            {assets.map(asset => (
              <AssetRow
                key={asset.id}
                asset={asset}
                status={statuses.find(status => status.id === asset.id)}
                onPlay={() => navigation.navigate('Player', { mode: 'offline', assetId: asset.id })}
              />
            ))}
          </View>
        ) : null}
      </ScrollView>

      <ActionSheet visible={menuOpen} title="Downloads" actions={menu} onClose={() => setMenuOpen(false)} />
    </View>
  );
}

function ProgressRow({ status }: { status: DownloadStatus }) {
  const name = nameOf(status);
  const state = stateOfStatus(status);
  const detail =
    status.status === 'pending'
      ? status.waitingForNetwork || status.nextRetryAt ? progressLine(status) : 'Waiting to download'
      : status.status === 'paused'
        ? `Paused · ${progressLine(status)}`
        : status.status === 'failed'
          ? status.error ?? 'Download failed'
          : progressLine(status);
  return (
    <View style={styles.row}>
      <TitleArtwork title={artworkFor(status)} width={THUMB_WIDTH} height={THUMB_HEIGHT} />
      <View style={styles.rowText}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={[styles.rowDetail, status.status === 'failed' && styles.danger]} numberOfLines={2}>
          {detail}
        </Text>
      </View>
      <DownloadControl state={state} name={name} variant="ring" {...titleProp(status)} />
    </View>
  );
}

interface AssetRowProps {
  asset: DownloadedAsset;
  status: DownloadStatus | undefined;
  onPlay: () => void;
}

function AssetRow({ asset, status, onPlay }: AssetRowProps) {
  const { now } = useRentals();
  const name = asset.title || nameOf(asset);
  const meta = readMeta(asset.metadata);
  const size = status?.totalBytes ?? status?.receivedBytes;
  const details = [
    formatRuntime(asset.duration),
    size !== undefined ? formatBytes(size) : null,
    meta.labels?.quality ?? null,
  ].filter((part): part is string => part !== null);
  const state: TitleDownloadState = { kind: 'downloaded', assetId: asset.id, asset, ...(status ? { status } : {}) };
  return (
    <View style={styles.row}>
      <Pressable accessibilityRole="button" accessibilityLabel={`Play ${name}`} onPress={onPlay}>
        <TitleArtwork title={artworkFor(asset)} width={THUMB_WIDTH} height={THUMB_HEIGHT}>
          <View style={[StyleSheet.absoluteFill, styles.playOverlay]}>
            <View style={styles.playCircle}>
              <Icon name="play" size={20} />
            </View>
          </View>
        </TitleArtwork>
      </Pressable>
      <Pressable style={styles.rowText} onPress={onPlay}>
        <Text style={styles.rowTitle} numberOfLines={1}>
          {name}
        </Text>
        <Text style={styles.rowDetail}>{details.join(' · ')}</Text>
        <Text style={[styles.rowDetail, expiresSoon(expiryOf(asset), now) && styles.warning]}>
          {expiryLabel(asset, now)}
        </Text>
      </Pressable>
      <DownloadControl state={state} name={name} variant="ring" {...titleProp(asset)} />
    </View>
  );
}

function titleProp(item: DownloadItem) {
  const title = findTitle(titleIdOf(item));
  return title ? { title } : {};
}

interface BannerProps {
  icon: 'pause' | 'warning';
  title: string;
  message: string;
  action: ReactNode;
}

function Banner({ icon, title, message, action }: BannerProps) {
  return (
    <View style={styles.banner}>
      <Icon name={icon} color={icon === 'warning' ? colors.danger : colors.warning} />
      <Text style={styles.bannerTitle}>{title}</Text>
      <Text style={styles.bannerMessage}>{message}</Text>
      {action}
    </View>
  );
}

function EmptyDownloads({ onBrowse }: { onBrowse: () => void }) {
  return (
    <View style={styles.empty}>
      <View style={styles.emptyArt}>
        <Glow color={colors.accentGlow} x={80} y={80} radius={80} />
        <Icon name="download" size={56} />
      </View>
      <Text style={styles.emptyTitle}>No downloads yet</Text>
      <Text style={styles.emptyMessage}>
        Movies and shows you download appear here, ready to watch without an internet connection.
      </Text>
      <Button label="Find something to download" onPress={onBrowse} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  storage: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surface,
  },
  storageText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  section: { gap: spacing.md },
  sectionTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 3 },
  rowTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  rowDetail: { fontSize: 12, lineHeight: 16, color: colors.textSecondary },
  danger: { color: colors.danger },
  warning: { color: colors.warning },
  playOverlay: { alignItems: 'center', justifyContent: 'center' },
  playCircle: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.overlay,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.6)',
  },
  banner: {
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.xl,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  bannerTitle: { fontSize: 17, fontWeight: '800', color: colors.text },
  bannerMessage: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.sm },
  empty: { alignItems: 'center', gap: spacing.md, paddingTop: spacing.xxl },
  emptyArt: { width: 160, height: 160, alignItems: 'center', justifyContent: 'center' },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text },
  emptyMessage: { fontSize: 14, lineHeight: 20, color: colors.textSecondary, textAlign: 'center', marginBottom: spacing.md },
});
