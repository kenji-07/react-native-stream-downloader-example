import { useCallback } from 'react';
import { ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { getDownloadStatus } from 'react-native-stream-downloader';

import { findTitle, SHELVES, titlesOnShelf, type CatalogTitle } from '../catalog/titles';
import { IconButton } from '../components/Buttons';
import { DownloadControl } from '../components/DownloadControl';
import { AmbientBackground, Glow } from '../components/Gradients';
import { Icon } from '../components/Icon';
import { PlayButton } from '../components/PlayButton';
import { Rail } from '../components/Rail';
import { TitleArtwork } from '../components/TitleArtwork';
import { useDownloader } from '../downloader/DownloaderProvider';
import { expiryLabel, expiryOf, readMeta } from '../downloader/downloadMeta';
import { useTitleDownload } from '../hooks/useTitleDownload';
import { useRentals } from '../rentals/RentalsProvider';
import { colors, radius, spacing } from '../theme';
import type { ScreenProps } from '../types/navigation';
import { expiresSoon, formatExpiry, formatRuntime } from '../utils/format';
import { MEDIA_TYPE_LABEL } from '../utils/media';

export function TitleScreen({ navigation, route }: ScreenProps<'Title'>) {
  const title = findTitle(route.params.titleId);
  const insets = useSafeAreaInsets();

  if (!title) {
    return (
      <View style={[styles.root, styles.missing, { paddingTop: insets.top }]}>
        <Text style={styles.synopsis}>This title is no longer available.</Text>
        <IconButton icon="back" label="Back" onPress={() => navigation.goBack()} />
      </View>
    );
  }
  return (
    <TitleDetails
      title={title}
      onBack={() => navigation.goBack()}
      onOpen={next => navigation.push('Title', { titleId: next.id })}
    />
  );
}

interface TitleDetailsProps {
  title: CatalogTitle;
  onBack: () => void;
  onOpen: (title: CatalogTitle) => void;
}

function TitleDetails({ title, onBack, onOpen }: TitleDetailsProps) {
  const insets = useSafeAreaInsets();
  const { width } = useWindowDimensions();
  const { upsertStatus } = useDownloader();
  const { now, activeRental } = useRentals();
  const download = useTitleDownload(title.id);
  const rental = title.rental ? activeRental(title.id) : undefined;

  // While a download is in flight, re-read its exact status whenever this
  // page gains focus: a one-off getDownloadStatus() snapshot.
  const trackedId =
    download.kind === 'queued' || download.kind === 'downloading' || download.kind === 'paused' ? download.status.id : null;
  useFocusEffect(
    useCallback(() => {
      if (trackedId === null) return;
      getDownloadStatus(trackedId).then(
        status => {
          if (status !== null) upsertStatus(status);
        },
        () => undefined,
      );
    }, [trackedId, upsertStatus]),
  );

  const meta = download.kind === 'downloaded' ? readMeta(download.asset?.metadata ?? download.status?.metadata) : null;
  const asset = download.kind === 'downloaded' ? download.asset : undefined;
  const facts = [
    title.year !== undefined ? String(title.year) : null,
    title.maturity,
    download.kind === 'downloaded' && download.asset ? formatRuntime(download.asset.duration) : title.runtime ?? null,
  ].filter((fact): fact is string => fact !== null);
  const shelf = SHELVES.find(item => item.id === title.shelf);
  const more = titlesOnShelf(title.shelf).filter(other => other.id !== title.id);
  const format = title.source ? MEDIA_TYPE_LABEL[title.source.type] : null;

  return (
    <View style={styles.root}>
      <AmbientBackground accent={colors.blueGlow} />
      <ScrollView contentContainerStyle={styles.scroll}>
        <TitleArtwork title={title} width={width} height={width * 0.75} borderRadius={0}>
          <Glow color={colors.accentGlow} x={width * 0.5} y={width * 0.75} radius={width * 0.6} />
        </TitleArtwork>

        <View style={styles.body}>
          <Text style={styles.name}>{title.name}</Text>
          <View style={styles.facts}>
            {facts.map(fact => (
              <Text key={fact} style={styles.fact}>
                {fact}
              </Text>
            ))}
            {format !== null ? <Text style={styles.tag}>{format}</Text> : null}
            {title.subtitles?.length ? <Text style={styles.tag}>CC</Text> : null}
            {title.protected ? (
              <View style={styles.protectedTag}>
                <Icon name="lock" size={12} color={colors.warning} />
                <Text style={styles.protectedText}>DRM</Text>
              </View>
            ) : null}
          </View>

          <View style={styles.buttons}>
            <PlayButton title={title} />
            <DownloadControl state={download} name={title.name} title={title} variant="full" />
          </View>

          {title.rental ? (
            <View style={styles.infoCard}>
              <Icon name="timer" size={20} color={rental ? colors.success : colors.textSecondary} />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>{rental ? 'Rented' : `Rental · ${title.rental.hours} hours`}</Text>
                <Text style={[styles.infoDetail, rental && expiresSoon(rental.endsAt, now) && styles.warning]}>
                  {rental
                    ? `${formatExpiry(rental.endsAt, now, 'rental')}. Downloads end with the rental.`
                    : 'Stream or download once rented. Demo rental — no payment is taken.'}
                </Text>
              </View>
            </View>
          ) : null}

          {title.protected && title.source === null ? (
            <View style={styles.infoCard}>
              <Icon name="lock" size={20} color={colors.warning} />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Protected title</Text>
                <Text style={styles.infoDetail}>Not available on this build yet.</Text>
              </View>
            </View>
          ) : null}

          {download.kind === 'downloaded' ? (
            <View style={styles.infoCard}>
              <Icon name="offline" size={20} color={colors.success} />
              <View style={styles.infoText}>
                <Text style={styles.infoTitle}>Available offline</Text>
                {asset ? (
                  <Text style={[styles.infoDetail, expiresSoon(expiryOf(asset), now) && styles.warning]}>
                    {expiryLabel(asset, now)}
                  </Text>
                ) : null}
                {meta?.labels ? (
                  <Text style={styles.infoDetail}>
                    {meta.labels.quality} · Audio: {meta.labels.audio} · Subtitles: {meta.labels.subtitles}
                  </Text>
                ) : null}
              </View>
            </View>
          ) : null}

          <Text style={styles.tagline}>{title.tagline}</Text>
          <Text style={styles.synopsis}>{title.synopsis}</Text>
          <Text style={styles.genres}>Genres: {title.genres.join(', ')}</Text>
          {title.subtitles?.length ? (
            <Text style={styles.genres}>Subtitles: {title.subtitles.map(file => file.label).join(', ')}</Text>
          ) : null}
          {title.drmProvider ? <Text style={styles.genres}>Protection: {title.drmProvider}</Text> : null}
        </View>

        <Rail heading={shelf ? `More ${shelf.title}` : 'More like this'} titles={more} onOpen={onOpen} />
      </ScrollView>

      <View style={[styles.back, { top: insets.top + spacing.sm }]}>
        <IconButton icon="back" label="Back" filled onPress={onBack} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  missing: { alignItems: 'center', justifyContent: 'center', gap: spacing.lg },
  scroll: { paddingBottom: spacing.xxl, gap: spacing.xl },
  body: { paddingHorizontal: spacing.lg, gap: spacing.md },
  name: { fontSize: 30, fontWeight: '900', color: colors.text, letterSpacing: -0.4, marginTop: -spacing.xl },
  facts: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing.md },
  fact: { fontSize: 14, color: colors.textSecondary, fontWeight: '600' },
  tag: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.textSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  protectedTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
    borderRadius: radius.sm,
    paddingHorizontal: 6,
    paddingVertical: 2,
    backgroundColor: 'rgba(255,176,32,0.14)',
  },
  protectedText: { fontSize: 11, fontWeight: '800', color: colors.warning },
  buttons: { gap: spacing.sm },
  infoCard: {
    flexDirection: 'row',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surface,
    borderWidth: 1,
    borderColor: colors.border,
  },
  infoText: { flex: 1, gap: 2 },
  infoTitle: { fontSize: 15, fontWeight: '700', color: colors.text },
  infoDetail: { fontSize: 13, lineHeight: 18, color: colors.textSecondary },
  warning: { color: colors.warning },
  tagline: { fontSize: 16, fontWeight: '700', color: colors.text },
  synopsis: { fontSize: 15, lineHeight: 22, color: colors.textSecondary },
  genres: { fontSize: 13, color: colors.textMuted },
  back: { position: 'absolute', left: spacing.md },
});
