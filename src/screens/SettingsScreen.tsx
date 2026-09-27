import { useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Switch, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { isRegistered, type Config } from 'react-native-stream-downloader';

import { AmbientBackground } from '../components/Gradients';
import { Icon } from '../components/Icon';
import { useToast } from '../components/Toast';
import { isDrmConfigured } from '../config/drm';
import { useDownloader } from '../downloader/DownloaderProvider';
import type { VideoQualityPreference } from '../downloader/trackChoices';
import { useDownloadActions } from '../downloader/useDownloadActions';
import {
  PROGRESS_INTERVAL_MS,
  useSettings,
  type AppSettings,
  type AutoDelete,
  type ProgressMode,
} from '../settings/SettingsProvider';
import { colors, radius, spacing } from '../theme';
import { formatBytes } from '../utils/format';

export function SettingsScreen() {
  const insets = useSafeAreaInsets();
  const toast = useToast();
  const { engine, enable, disable, config, configure, statuses, assets } = useDownloader();
  const { settings, updateSettings } = useSettings();
  const actions = useDownloadActions();
  const [switching, setSwitching] = useState(false);
  const [applying, setApplying] = useState<keyof AppSettings | null>(null);

  const usedBytes = assets.reduce((sum, asset) => {
    const status = statuses.find(item => item.id === asset.id);
    return sum + (status?.totalBytes ?? status?.receivedBytes ?? 0);
  }, 0);

  const toggleDownloads = async (on: boolean) => {
    setSwitching(true);
    try {
      if (on) {
        if (await enable()) updateSettings({ downloadsEnabled: true });
      } else {
        // Stops all downloading for this app; turning it back on resumes the queue.
        await disable();
        updateSettings({ downloadsEnabled: false });
      }
    } catch (error) {
      toast.showError(error);
    } finally {
      setSwitching(false);
    }
  };

  /** Applies a runtime downloader setting first, then remembers it. */
  const applyConfig = async (key: 'maxParallelDownloads' | 'progressMode' | 'wifiOnly' | 'autoRetry', change: Partial<AppSettings>, next: Config) => {
    setApplying(key);
    try {
      await configure(next);
      updateSettings(change);
    } catch (error) {
      toast.showError(error);
    } finally {
      setApplying(null);
    }
  };

  const engineLabel =
    engine.phase === 'ready'
      ? 'On'
      : engine.phase === 'starting'
        ? 'Starting…'
        : engine.phase === 'off'
          ? 'Off — nothing downloads until you turn it on'
          : engine.error.message;

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}>
        <Text style={styles.title}>Settings</Text>

        <Group title="Downloads">
          <Row
            label="Downloads"
            detail={engineLabel}
            right={
              switching || engine.phase === 'starting' ? (
                <ActivityIndicator color={colors.text} />
              ) : (
                <Toggle value={engine.phase === 'ready'} onChange={on => void toggleDownloads(on)} />
              )
            }
          />
          <Row label="Wi-Fi only" detail="Wait for Wi-Fi and resume automatically" busy={applying === 'wifiOnly'}
            right={<Toggle value={config?.wifiOnly ?? settings.wifiOnly} onChange={value => void applyConfig('wifiOnly', { wifiOnly: value }, { wifiOnly: value })} />} />
          <Row label="Retry network failures" detail="Up to 3 retries with increasing delay" busy={applying === 'autoRetry'}
            right={<Toggle value={settings.autoRetry} onChange={value => void applyConfig('autoRetry', { autoRetry: value }, { retry: { maxRetries: value ? 3 : 0, initialDelayMS: 1000, maxDelayMS: 30000 } })} />} />
          <Row
            label="Ask before downloading"
            detail="Choose quality, audio and subtitles for each download"
            right={
              <Toggle value={settings.askBeforeDownload} onChange={value => updateSettings({ askBeforeDownload: value })} />
            }
          />
          <Row
            label="Video quality"
            detail={settings.videoQuality === 'high' ? 'Best picture, larger files' : 'Faster downloads, less storage'}
          >
            <Segmented<VideoQualityPreference>
              options={[
                { value: 'standard', label: 'Standard' },
                { value: 'high', label: 'High' },
              ]}
              value={settings.videoQuality}
              onChange={value => updateSettings({ videoQuality: value })}
            />
          </Row>
          <Row
            label="All audio & subtitles"
            detail="Keep every language with each download"
            right={
              <Toggle value={settings.includeAllTracks} onChange={value => updateSettings({ includeAllTracks: value })} />
            }
          />
          <Row
            label="Check storage first"
            detail="Make sure there is enough space before downloading"
            right={<Toggle value={settings.checkStorage} onChange={value => updateSettings({ checkStorage: value })} />}
          />
          <Row label="Auto-delete downloads" detail="Applies to new downloads">
            <Segmented<AutoDelete>
              options={[
                { value: 'never', label: 'Never' },
                { value: '7d', label: '7 days' },
                { value: '30d', label: '30 days' },
              ]}
              value={settings.autoDelete}
              onChange={value => updateSettings({ autoDelete: value })}
            />
          </Row>
        </Group>

        <Group title="Performance">
          <Row
            label="Simultaneous downloads"
            detail={config?.maxParallelDownloads !== undefined ? `${config.maxParallelDownloads} at a time` : undefined}
            busy={applying === 'maxParallelDownloads'}
          >
            <Segmented<number>
              options={[1, 2, 3, 5].map(value => ({ value, label: String(value) }))}
              value={settings.maxParallelDownloads}
              onChange={value =>
                void applyConfig('maxParallelDownloads', { maxParallelDownloads: value }, { maxParallelDownloads: value })
              }
            />
          </Row>
          <Row
            label="Progress updates"
            detail={config?.updateFrequencyMS !== undefined ? `Every ${config.updateFrequencyMS} ms` : undefined}
            busy={applying === 'progressMode'}
          >
            <Segmented<ProgressMode>
              options={[
                { value: 'smooth', label: 'Smooth' },
                { value: 'standard', label: 'Standard' },
                { value: 'saver', label: 'Battery saver' },
              ]}
              value={settings.progressMode}
              onChange={value =>
                void applyConfig('progressMode', { progressMode: value }, { updateFrequencyMS: PROGRESS_INTERVAL_MS[value] })
              }
            />
          </Row>
        </Group>

        <Group title="Storage">
          <Row
            label="Downloaded"
            detail={`${assets.length} ${assets.length === 1 ? 'title' : 'titles'}${usedBytes > 0 ? ` · ${formatBytes(usedBytes)}` : ''}`}
          />
          <Pressable
            accessibilityRole="button"
            disabled={assets.length === 0}
            onPress={() => void actions.deleteAll()}
            style={({ pressed }) => [styles.dangerRow, (pressed || assets.length === 0) && styles.dim]}
          >
            <Icon name="trash" size={20} color={colors.danger} />
            <Text style={styles.dangerLabel}>Delete all downloads</Text>
          </Pressable>
        </Group>

        <Group title="About">
          <Row label="Offline engine" detail={isRegistered() ? 'Running' : 'Stopped'} />
          <Row label="Protected titles" detail={isDrmConfigured() ? 'Configured' : 'Not set up on this build'} />
          <Row label="Version" detail="1.0.0" />
        </Group>
      </ScrollView>
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.group}>
      <Text style={styles.groupTitle}>{title}</Text>
      <View style={styles.groupBody}>{children}</View>
    </View>
  );
}

interface RowProps {
  label: string;
  detail?: string | undefined;
  right?: ReactNode;
  busy?: boolean;
  /** Content below the label, e.g. a segmented control. */
  children?: ReactNode;
}

function Row({ label, detail, right, busy = false, children }: RowProps) {
  return (
    <View style={styles.row}>
      <View style={styles.rowTop}>
        <View style={styles.rowText}>
          <Text style={styles.rowLabel}>{label}</Text>
          {detail !== undefined ? <Text style={styles.rowDetail}>{detail}</Text> : null}
        </View>
        {busy ? <ActivityIndicator color={colors.text} /> : right}
      </View>
      {children}
    </View>
  );
}

function Toggle({ value, onChange }: { value: boolean; onChange: (value: boolean) => void }) {
  return (
    <Switch
      value={value}
      onValueChange={onChange}
      trackColor={{ true: colors.accent, false: colors.surfacePressed }}
      thumbColor={colors.text}
    />
  );
}

interface SegmentedProps<T> {
  options: ReadonlyArray<{ value: T; label: string }>;
  value: T;
  onChange: (value: T) => void;
}

function Segmented<T extends string | number>({ options, value, onChange }: SegmentedProps<T>) {
  return (
    <View style={styles.segmented}>
      {options.map(option => {
        const selected = option.value === value;
        return (
          <Pressable
            key={String(option.value)}
            accessibilityRole="radio"
            accessibilityState={{ selected }}
            onPress={() => {
              if (!selected) onChange(option.value);
            }}
            style={[styles.segment, selected && styles.segmentSelected]}
          >
            <Text style={[styles.segmentLabel, selected && styles.segmentLabelSelected]} numberOfLines={1}>
              {option.label}
            </Text>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { paddingHorizontal: spacing.lg, paddingBottom: spacing.xxl, gap: spacing.xl },
  title: { fontSize: 28, fontWeight: '900', color: colors.text },
  group: { gap: spacing.sm },
  groupTitle: {
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
    color: colors.textMuted,
    paddingHorizontal: spacing.xs,
  },
  groupBody: {
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
    overflow: 'hidden',
  },
  row: {
    gap: spacing.md,
    padding: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: colors.border,
  },
  rowTop: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  rowText: { flex: 1, gap: 2 },
  rowLabel: { fontSize: 15, fontWeight: '600', color: colors.text },
  rowDetail: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  dangerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, padding: spacing.lg },
  dangerLabel: { fontSize: 15, fontWeight: '700', color: colors.danger },
  dim: { opacity: 0.5 },
  segmented: { flexDirection: 'row', padding: 3, borderRadius: radius.md, backgroundColor: colors.surfaceRaised },
  segment: { flex: 1, alignItems: 'center', paddingVertical: spacing.sm, borderRadius: radius.sm },
  segmentSelected: { backgroundColor: colors.text },
  segmentLabel: { fontSize: 13, fontWeight: '700', color: colors.textSecondary },
  segmentLabelSelected: { color: colors.onLight },
});
