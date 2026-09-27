import { useCallback, useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { getAvailableTracks, type AvailableTracksByType } from 'react-native-stream-downloader';

import type { CatalogTitle } from '../catalog/titles';
import {
  audioFor,
  defaultChoice,
  languageName,
  qualityBadge,
  qualityName,
  sortedVideo,
  textFor,
  WHOLE_FILE,
  type TrackChoice,
} from '../downloader/trackChoices';
import { useMountedRef } from '../hooks/useMountedRef';
import { useTask } from '../hooks/useTask';
import { useSettings } from '../settings/SettingsProvider';
import { colors, radius, spacing } from '../theme';
import { formatBitrate } from '../utils/format';
import { Button, Choice, ChoiceRow } from './Buttons';
import { Icon } from './Icon';
import { Sheet } from './Sheet';

interface DownloadOptionsSheetProps {
  title: CatalogTitle;
  visible: boolean;
  onClose: () => void;
  /** `tracks` is null for MP4 files, which are downloaded whole. */
  onConfirm: (choice: TrackChoice, tracks: AvailableTracksByType | null) => void;
}

interface Loaded {
  url: string;
  tracks: AvailableTracksByType;
}

/**
 * What to keep offline for one download.
 * - HLS/DASH: quality, audio and subtitles straight from getAvailableTracks(),
 *   which reads the manifest without downloading any media.
 * - MP4 + subtitles: the file is downloaded whole; the viewer picks which
 *   sidecar subtitle languages to save with it.
 */
export function DownloadOptionsSheet({ title, visible, onClose, onConfirm }: DownloadOptionsSheetProps) {
  const { settings } = useSettings();
  const mounted = useMountedRef();
  const task = useTask();
  const { run } = task;
  const [loaded, setLoaded] = useState<Loaded | null>(null);
  const [choice, setChoice] = useState<TrackChoice | null>(null);
  const [sidecar, setSidecar] = useState<TrackChoice['sidecar']>('all');
  const isFile = title.source?.type === 'mp4';
  const url = !isFile && title.source ? title.source.url : null;
  const tracks = loaded !== null && loaded.url === url ? loaded.tracks : null;

  const { videoQuality } = settings;
  const load = useCallback(
    async (target: string) => {
      const result = await run('tracks', () => getAvailableTracks(target));
      if (!result.ok || !mounted.current) return;
      setLoaded({ url: target, tracks: result.value });
      setChoice(defaultChoice(result.value, videoQuality));
    },
    [mounted, run, videoQuality],
  );

  // Track IDs belong to one manifest snapshot, so they are loaded per URL when the sheet opens.
  const needsTracks = visible && url !== null && tracks === null;
  useEffect(() => {
    if (needsTracks && url !== null) void load(url);
  }, [load, needsTracks, url]);

  const videos = tracks ? sortedVideo(tracks) : [];
  const selectedVideo = choice?.videoId ? videos.find(track => track.id === choice.videoId) : undefined;
  const audio = tracks ? audioFor(tracks, selectedVideo) : [];
  const text = tracks ? textFor(tracks, selectedVideo) : [];

  const pickVideo = (videoId: string) => {
    if (!choice || !tracks) return;
    const video = videos.find(track => track.id === videoId);
    const nextAudio = audioFor(tracks, video);
    const nextText = textFor(tracks, video);
    // Language picks from another variant's group are not valid for this quality.
    setChoice({
      ...choice,
      videoId,
      audio: choice.audio !== 'all' && nextAudio.some(track => track.id === choice.audio) ? choice.audio : 'all',
      text:
        choice.text === 'all' || choice.text === 'off' || nextText.some(track => track.id === choice.text) ? choice.text : 'all',
    });
  };

  return (
    <Sheet visible={visible} onClose={onClose}>
      <Text style={styles.title}>Download “{title.name}”</Text>
      <Text style={styles.subtitle}>Choose what to keep on this device.</Text>

      {isFile ? (
        <>
          <View style={styles.section}>
            <Text style={styles.heading}>Subtitles to keep offline</Text>
            <ChoiceRow>
              <Choice label="All" selected={sidecar === 'all'} onPress={() => setSidecar('all')} />
              <Choice label="None" selected={sidecar === 'off'} onPress={() => setSidecar('off')} />
              {(title.subtitles ?? []).map(file => (
                <Choice
                  key={file.language}
                  label={file.label}
                  selected={sidecar === file.language}
                  onPress={() => setSidecar(file.language)}
                />
              ))}
            </ChoiceRow>
          </View>
          <Button icon="download" label="Download" onPress={() => onConfirm({ ...WHOLE_FILE, sidecar }, null)} />
        </>
      ) : null}

      {!isFile && task.running !== null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.text} />
          <Text style={styles.muted}>Checking available qualities…</Text>
        </View>
      ) : null}

      {!isFile && task.error && tracks === null ? (
        <View style={styles.center}>
          <Icon name="warning" color={colors.danger} />
          <Text style={styles.muted}>{task.error.message}</Text>
          <Button variant="secondary" icon="refresh" label="Try again" onPress={() => url !== null && void load(url)} />
        </View>
      ) : null}

      {tracks !== null && choice !== null ? (
        <>
          <ScrollView style={styles.scroll} contentContainerStyle={styles.sections}>
            {videos.length > 1 ? (
              <View style={styles.section}>
                <Text style={styles.heading}>Video quality</Text>
                {videos.map(track => {
                  const selected = track.id === choice.videoId;
                  return (
                    <Pressable
                      key={track.id}
                      accessibilityRole="radio"
                      accessibilityState={{ selected }}
                      onPress={() => pickVideo(track.id)}
                      style={[styles.quality, selected && styles.qualitySelected]}
                    >
                      <View style={[styles.radio, selected && styles.radioOn]} />
                      <Text style={styles.qualityName}>{qualityName(track)}</Text>
                      <Text style={styles.badge}>{qualityBadge(track)}</Text>
                      <Text style={styles.bitrate}>{formatBitrate(track.bandwidth)}</Text>
                    </Pressable>
                  );
                })}
              </View>
            ) : null}

            {settings.includeAllTracks ? (
              <View style={styles.includeAll}>
                <Icon name="subtitles" size={20} color={colors.textSecondary} />
                <Text style={styles.muted}>All audio languages and subtitles are included (Settings).</Text>
              </View>
            ) : (
              <>
                {audio.length > 1 ? (
                  <View style={styles.section}>
                    <Text style={styles.heading}>Audio</Text>
                    <ChoiceRow>
                      <Choice
                        label="All languages"
                        selected={choice.audio === 'all'}
                        onPress={() => setChoice({ ...choice, audio: 'all' })}
                      />
                      {audio.map(track => (
                        <Choice
                          key={track.id}
                          label={languageName(track)}
                          selected={choice.audio === track.id}
                          onPress={() => setChoice({ ...choice, audio: track.id })}
                        />
                      ))}
                    </ChoiceRow>
                  </View>
                ) : null}
                {text.length > 0 ? (
                  <View style={styles.section}>
                    <Text style={styles.heading}>Subtitles</Text>
                    <ChoiceRow>
                      <Choice label="All" selected={choice.text === 'all'} onPress={() => setChoice({ ...choice, text: 'all' })} />
                      <Choice label="Off" selected={choice.text === 'off'} onPress={() => setChoice({ ...choice, text: 'off' })} />
                      {text.map(track => (
                        <Choice
                          key={track.id}
                          label={languageName(track)}
                          selected={choice.text === track.id}
                          onPress={() => setChoice({ ...choice, text: track.id })}
                        />
                      ))}
                    </ChoiceRow>
                  </View>
                ) : null}
              </>
            )}
          </ScrollView>
          <Button icon="download" label="Download" onPress={() => onConfirm(choice, tracks)} />
        </>
      ) : null}
    </Sheet>
  );
}

const styles = StyleSheet.create({
  title: { fontSize: 20, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 14, color: colors.textSecondary, marginTop: -spacing.sm },
  center: { alignItems: 'center', gap: spacing.md, paddingVertical: spacing.xl },
  muted: { flexShrink: 1, fontSize: 13, lineHeight: 18, color: colors.textSecondary, textAlign: 'center' },
  scroll: { maxHeight: 420 },
  sections: { gap: spacing.xl, paddingBottom: spacing.md },
  section: { gap: spacing.sm },
  heading: { fontSize: 13, fontWeight: '800', letterSpacing: 0.6, textTransform: 'uppercase', color: colors.textMuted },
  quality: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    backgroundColor: colors.surfaceRaised,
  },
  qualitySelected: { backgroundColor: colors.accentSoft },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2, borderColor: colors.textMuted },
  radioOn: { borderColor: colors.accent, backgroundColor: colors.accent },
  qualityName: { fontSize: 16, fontWeight: '700', color: colors.text },
  badge: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 5,
    paddingVertical: 1,
  },
  bitrate: { marginLeft: 'auto', fontSize: 13, color: colors.textMuted },
  includeAll: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
});
