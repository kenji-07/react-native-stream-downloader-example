import { useEffect, useMemo, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import RadialGradient from 'react-native-radial-gradient';
import Video, {
  SelectedTrackType,
  type Drm,
  type OnBufferData,
  type OnLoadData,
  type OnProgressData,
  type OnVideoErrorData,
  type ReactVideoSource,
  type SelectedTrack,
  type VideoRef,
} from 'react-native-video';
import { getDownloadedAsset } from 'react-native-stream-downloader';

import { findTitle } from '../catalog/titles';
import { Button, IconButton } from '../components/Buttons';
import { Icon } from '../components/Icon';
import { ActionSheet, type SheetAction } from '../components/Sheet';
import { drmForStreaming } from '../config/drm';
import { expiryOf, readMeta, titleIdOf } from '../downloader/downloadMeta';
import { useMountedRef } from '../hooks/useMountedRef';
import { useRentals } from '../rentals/RentalsProvider';
import { colors, radius, spacing } from '../theme';
import type { PlayerParams, ScreenProps } from '../types/navigation';
import { formatClock } from '../utils/format';
import { formatError } from '../utils/formatError';
import { cueAt, parseSubtitles, type Cue } from '../utils/subtitles';

/** A sidecar subtitle: saved text (offline) or a URL to fetch (online). */
interface SidecarOption {
  language: string;
  label: string;
  text?: string;
  url?: string;
}

interface Playable {
  uri: string;
  name: string;
  offline: boolean;
  drm?: Drm;
  subtitles: SidecarOption[];
}

type PlaybackState =
  | { kind: 'loading' }
  | { kind: 'unavailable'; message: string }
  | { kind: 'ready'; playable: Playable };

/**
 * Offline: looks the asset up with getDownloadedAsset() and plays its
 * pathToFile. Nothing else is needed: no network, and no DRM props, because
 * the downloader stored the offline license with the asset. Sidecar
 * subtitles come from the download's metadata.
 * Online: streams the catalog URL (with source.drm for protected titles).
 */
function usePlayback(params: PlayerParams): PlaybackState {
  const mounted = useMountedRef();
  const { activeRental } = useRentals();
  const assetId = params.mode === 'offline' ? params.assetId : null;
  const titleId = params.mode === 'online' ? params.titleId : null;
  const rented = titleId !== null && activeRental(titleId) !== undefined;
  const [state, setState] = useState<PlaybackState>({ kind: 'loading' });

  useEffect(() => {
    if (assetId === null) return;
    getDownloadedAsset(assetId).then(
      asset => {
        if (!mounted.current) return;
        if (asset === null) {
          setState({ kind: 'unavailable', message: 'This download is no longer on your device.' });
          return;
        }
        const meta = readMeta(asset.metadata);
        const expiry = expiryOf(asset);
        if (expiry !== undefined && expiry <= Date.now()) {
          const message = meta.rentalEndsAt !== undefined ? 'This rental has ended.' : 'This download has expired.';
          setState({ kind: 'unavailable', message });
          return;
        }
        const name = asset.title || meta.title || findTitle(titleIdOf(asset))?.name || 'Download';
        setState({ kind: 'ready', playable: { uri: asset.pathToFile, name, offline: true, subtitles: meta.subtitles } });
      },
      (error: unknown) => {
        if (mounted.current) setState({ kind: 'unavailable', message: formatError(error).message });
      },
    );
  }, [assetId, mounted]);

  useEffect(() => {
    if (titleId === null) return;
    const title = findTitle(titleId);
    if (!title || title.source === null) {
      setState({ kind: 'unavailable', message: "This title isn't available to play." });
      return;
    }
    if (title.rental && !rented) {
      setState({ kind: 'unavailable', message: `Rent “${title.name}” to watch it.` });
      return;
    }
    const { url } = title.source;
    const subtitles = title.subtitles ?? [];
    if (!title.protected) {
      setState({ kind: 'ready', playable: { uri: url, name: title.name, offline: false, subtitles } });
      return;
    }
    // Protected titles stream with react-native-video's own source.drm.
    drmForStreaming(title.id).then(
      drm => {
        if (mounted.current) setState({ kind: 'ready', playable: { uri: url, name: title.name, offline: false, drm, subtitles } });
      },
      (error: unknown) => {
        if (mounted.current) setState({ kind: 'unavailable', message: formatError(error).message });
      },
    );
  }, [mounted, rented, titleId]);

  return state;
}

export function PlayerScreen({ navigation, route }: ScreenProps<'Player'>) {
  const insets = useSafeAreaInsets();
  const playback = usePlayback(route.params);
  const [attempt, setAttempt] = useState(0);
  const close = () => navigation.goBack();

  return (
    <View style={styles.root}>
      <StatusBar hidden />
      {playback.kind === 'ready' ? (
        // `key` gives each retry a fresh player instance.
        <PlayerView
          key={`${playback.playable.uri}#${attempt}`}
          playable={playback.playable}
          onClose={close}
          onRetry={() => setAttempt(n => n + 1)}
        />
      ) : (
        <View style={styles.centered}>
          {playback.kind === 'loading' ? (
            <ActivityIndicator size="large" color={colors.text} />
          ) : (
            <>
              <Icon name="warning" size={40} color={colors.warning} />
              <Text style={styles.message}>{playback.message}</Text>
              <Button variant="secondary" label="Back" onPress={close} />
            </>
          )}
        </View>
      )}
      {playback.kind !== 'ready' ? (
        <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
          <IconButton icon="back" label="Close player" filled onPress={close} />
        </View>
      ) : null}
    </View>
  );
}

function describeVideoError(event: OnVideoErrorData): string {
  const { error } = event;
  return error.localizedDescription ?? error.errorString ?? error.error ?? 'Playback failed.';
}

type SubtitleSelection = { kind: 'off' } | { kind: 'native'; index: number } | { kind: 'sidecar'; language: string };

const SUBTITLES_OFF: SelectedTrack = { type: SelectedTrackType.DISABLED };

interface PlayerViewProps {
  playable: Playable;
  onClose: () => void;
  onRetry: () => void;
}

/** react-native-video with a minimal custom control layer and subtitle picker. */
function PlayerView({ playable, onClose, onRetry }: PlayerViewProps) {
  const insets = useSafeAreaInsets();
  const { width, height } = useWindowDimensions();
  const mounted = useMountedRef();
  const videoRef = useRef<VideoRef>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(false);
  const [duration, setDuration] = useState(0);
  const [position, setPosition] = useState(0);
  const [buffering, setBuffering] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [controlsVisible, setControlsVisible] = useState(true);
  const [barWidth, setBarWidth] = useState(0);
  const [nativeTracks, setNativeTracks] = useState<OnLoadData['textTracks']>([]);
  const [subtitle, setSubtitle] = useState<SubtitleSelection>({ kind: 'off' });
  const [cues, setCues] = useState<Cue[]>([]);
  const [subtitleMenu, setSubtitleMenu] = useState(false);

  // A stable source object; a new object on each render would reload the player.
  const source = useMemo<ReactVideoSource>(
    () => ({ uri: playable.uri, ...(playable.drm ? { drm: playable.drm } : {}) }),
    [playable.drm, playable.uri],
  );

  // Controls fade away while playing.
  useEffect(() => {
    if (!controlsVisible || paused) return;
    const timer = setTimeout(() => setControlsVisible(false), 3500);
    return () => clearTimeout(timer);
  }, [controlsVisible, paused]);

  /**
   * Stream subtitles (HLS/DASH renditions) are rendered by the player via
   * selectedTextTrack. Sidecar MP4 subtitles are rendered here from parsed
   * cues, so they work offline straight from the saved metadata.
   */
  const chooseSidecar = async (option: SidecarOption) => {
    setSubtitle({ kind: 'sidecar', language: option.language });
    try {
      const text = option.text ?? (option.url ? await (await fetch(option.url)).text() : '');
      if (mounted.current) setCues(parseSubtitles(text));
    } catch {
      if (mounted.current) {
        setCues([]);
        setSubtitle({ kind: 'off' });
      }
    }
  };

  const subtitleActions: SheetAction[] = [
    {
      key: 'off',
      label: 'Off',
      icon: subtitle.kind === 'off' ? 'check' : 'close',
      onPress: () => setSubtitle({ kind: 'off' }),
    },
    ...nativeTracks.map(
      (track): SheetAction => ({
        key: `native-${track.index}`,
        label: track.title || track.language || `Subtitles ${track.index + 1}`,
        icon: subtitle.kind === 'native' && subtitle.index === track.index ? 'check' : 'subtitles',
        onPress: () => setSubtitle({ kind: 'native', index: track.index }),
      }),
    ),
    ...playable.subtitles.map(
      (option): SheetAction => ({
        key: `sidecar-${option.language}`,
        label: option.label,
        icon: subtitle.kind === 'sidecar' && subtitle.language === option.language ? 'check' : 'subtitles',
        onPress: () => void chooseSidecar(option),
      }),
    ),
  ];
  const hasSubtitles = subtitleActions.length > 1;
  const selectedTextTrack: SelectedTrack =
    subtitle.kind === 'native' ? { type: SelectedTrackType.INDEX, value: subtitle.index } : SUBTITLES_OFF;
  const cue = subtitle.kind === 'sidecar' ? cueAt(cues, position) : undefined;

  const seekTo = (seconds: number) => {
    const target = Math.max(0, duration > 0 ? Math.min(seconds, duration) : seconds);
    videoRef.current?.seek(target);
    setPosition(target);
  };
  const ratio = duration > 0 ? Math.min(1, position / duration) : 0;
  const vignette = Math.max(width, height);

  return (
    <View style={styles.root}>
      <Pressable style={StyleSheet.absoluteFill} onPress={() => setControlsVisible(visible => !visible)}>
        <Video
          ref={videoRef}
          source={source}
          style={StyleSheet.absoluteFill}
          resizeMode="contain"
          paused={paused}
          muted={muted}
          selectedTextTrack={selectedTextTrack}
          progressUpdateInterval={250}
          onLoad={(event: OnLoadData) => {
            setDuration(event.duration);
            setNativeTracks(event.textTracks);
            setError(null);
          }}
          onProgress={(event: OnProgressData) => setPosition(event.currentTime)}
          onBuffer={(event: OnBufferData) => setBuffering(event.isBuffering)}
          onReadyForDisplay={() => setBuffering(false)}
          onEnd={() => {
            setPaused(true);
            setControlsVisible(true);
          }}
          onError={(event: OnVideoErrorData) => {
            setBuffering(false);
            setError(describeVideoError(event));
          }}
        />
      </Pressable>

      {cue ? (
        <View pointerEvents="none" style={[styles.cueLayer, { bottom: insets.bottom + (controlsVisible ? 72 : 28) }]}>
          <Text style={styles.cue}>{cue.text}</Text>
        </View>
      ) : null}

      {buffering && error === null ? (
        <View pointerEvents="none" style={[StyleSheet.absoluteFill, styles.centered]}>
          <ActivityIndicator size="large" color={colors.text} />
        </View>
      ) : null}

      {controlsVisible && error === null ? (
        <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
          {/* Radial vignette: clear in the middle, dark at the edges, so controls stay readable. */}
          <RadialGradient
            pointerEvents="none"
            style={StyleSheet.absoluteFill}
            colors={['rgba(0,0,0,0.15)', 'rgba(0,0,0,0.75)']}
            stops={[0, 1]}
            center={[width / 2, height / 2]}
            radius={vignette * 0.75}
          />

          <View style={[styles.topBar, { top: insets.top + spacing.sm }]}>
            <IconButton icon="back" label="Close player" onPress={onClose} />
            <Text style={styles.name} numberOfLines={1}>
              {playable.name}
            </Text>
            {playable.offline ? (
              <View style={styles.offlineChip}>
                <Icon name="offline" size={14} color={colors.success} />
                <Text style={styles.offlineText}>Downloaded</Text>
              </View>
            ) : null}
            {hasSubtitles ? (
              <IconButton icon="subtitles" label="Subtitles" size={22} onPress={() => setSubtitleMenu(true)} />
            ) : null}
          </View>

          <View style={styles.center} pointerEvents="box-none">
            <IconButton icon="rewind" label="Back 10 seconds" size={34} onPress={() => seekTo(position - 10)} />
            <IconButton
              icon={paused ? 'play' : 'pause'}
              label={paused ? 'Play' : 'Pause'}
              size={56}
              filled
              onPress={() => setPaused(value => !value)}
            />
            <IconButton icon="forward" label="Forward 10 seconds" size={34} onPress={() => seekTo(position + 10)} />
          </View>

          <View style={[styles.bottomBar, { paddingBottom: insets.bottom + spacing.md }]}>
            <Text style={styles.time}>{formatClock(position)}</Text>
            <Pressable
              accessibilityRole="adjustable"
              accessibilityLabel="Seek"
              style={styles.seekArea}
              onLayout={event => setBarWidth(event.nativeEvent.layout.width)}
              onPress={event => {
                if (barWidth > 0) seekTo((event.nativeEvent.locationX / barWidth) * duration);
              }}
            >
              <View style={styles.seekTrack}>
                <View style={[styles.seekFill, { width: barWidth * ratio }]} />
              </View>
              <View style={[styles.seekThumb, { left: Math.max(0, barWidth * ratio - 7) }]} />
            </Pressable>
            <Text style={styles.time}>{duration > 0 ? formatClock(duration) : '--:--'}</Text>
            <IconButton
              icon={muted ? 'mute' : 'volume'}
              label={muted ? 'Unmute' : 'Mute'}
              size={22}
              onPress={() => setMuted(value => !value)}
            />
          </View>
        </View>
      ) : null}

      {error !== null ? (
        <View style={[StyleSheet.absoluteFill, styles.centered, styles.errorLayer]}>
          <Icon name="warning" size={40} color={colors.warning} />
          <Text style={styles.message}>{error}</Text>
          <View style={styles.errorButtons}>
            <Button variant="secondary" icon="refresh" label="Try again" onPress={onRetry} />
            <Button variant="secondary" label="Close" onPress={onClose} />
          </View>
        </View>
      ) : null}

      <ActionSheet
        visible={subtitleMenu}
        title="Subtitles"
        actions={subtitleActions}
        onClose={() => setSubtitleMenu(false)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.black },
  centered: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.lg, padding: spacing.xl },
  message: { fontSize: 16, lineHeight: 22, color: colors.text, textAlign: 'center' },
  topBar: {
    position: 'absolute',
    left: spacing.md,
    right: spacing.md,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  name: { flex: 1, fontSize: 16, fontWeight: '700', color: colors.text },
  offlineChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radius.pill,
    backgroundColor: colors.overlay,
  },
  offlineText: { fontSize: 12, fontWeight: '700', color: colors.success },
  center: {
    ...StyleSheet.absoluteFillObject,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xxl,
  },
  bottomBar: {
    position: 'absolute',
    left: spacing.lg,
    right: spacing.md,
    bottom: 0,
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  time: { fontSize: 12, fontWeight: '600', color: colors.text, fontVariant: ['tabular-nums'] },
  seekArea: { flex: 1, height: 32, justifyContent: 'center' },
  seekTrack: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.3)', overflow: 'hidden' },
  seekFill: { height: 4, backgroundColor: colors.accent },
  seekThumb: {
    position: 'absolute',
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: colors.text,
  },
  cueLayer: { position: 'absolute', left: spacing.xl, right: spacing.xl, alignItems: 'center' },
  cue: {
    fontSize: 17,
    lineHeight: 23,
    fontWeight: '600',
    color: colors.text,
    textAlign: 'center',
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  errorLayer: { backgroundColor: colors.overlay },
  errorButtons: { flexDirection: 'row', gap: spacing.sm },
});
