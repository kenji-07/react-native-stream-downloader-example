import { useCallback, useMemo, useState } from 'react';
import { Pressable, RefreshControl, ScrollView, StyleSheet, Text, useWindowDimensions, View } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { FEATURED_TITLE_ID, findTitle, SHELVES, TITLES, titlesOnShelf, type CatalogTitle } from '../catalog/titles';
import { DownloadControl } from '../components/DownloadControl';
import { AmbientBackground } from '../components/Gradients';
import { Icon } from '../components/Icon';
import { PlayButton } from '../components/PlayButton';
import { Rail } from '../components/Rail';
import { TitleArtwork } from '../components/TitleArtwork';
import { useDownloader } from '../downloader/DownloaderProvider';
import { titleIdOf } from '../downloader/downloadMeta';
import { useTitleDownload } from '../hooks/useTitleDownload';
import { colors, radius, spacing } from '../theme';
import type { RootNavigation } from '../types/navigation';

function isDefined<T>(value: T | undefined): value is T {
  return value !== undefined;
}

/** Rows by delivery type: MP4, HLS, DRM, MP4 + subtitles, rentals. */
const ROWS = SHELVES.map(shelf => ({ ...shelf, titles: titlesOnShelf(shelf.id) }));

export function HomeScreen() {
  const navigation = useNavigation<RootNavigation>();
  const insets = useSafeAreaInsets();
  const { assets, engine, refreshAll } = useDownloader();
  const [refreshing, setRefreshing] = useState(false);
  const featured = findTitle(FEATURED_TITLE_ID) ?? TITLES[0];

  const openTitle = useCallback((title: CatalogTitle) => navigation.navigate('Title', { titleId: title.id }), [navigation]);

  // Titles with a downloaded copy, for the "offline" pill.
  const offlineCount = useMemo(() => {
    const ids = new Set(assets.map(titleIdOf).filter(isDefined));
    return TITLES.filter(title => ids.has(title.id)).length;
  }, [assets]);

  const onRefresh = () => {
    if (engine.phase !== 'ready') return;
    setRefreshing(true);
    refreshAll()
      .catch(() => undefined)
      .finally(() => setRefreshing(false));
  };

  return (
    <View style={styles.root}>
      <AmbientBackground />
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + spacing.sm }]}
        refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.text} />}
      >
        <View style={styles.header}>
          <Text style={styles.logo}>NOVA</Text>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Downloads"
            onPress={() => navigation.navigate('Main', { tab: 'downloads' })}
            style={styles.offlinePill}
          >
            <Icon name="offline" size={16} color={offlineCount > 0 ? colors.success : colors.textMuted} />
            <Text style={styles.offlineText}>{offlineCount} offline</Text>
          </Pressable>
        </View>

        {featured ? <Hero title={featured} onOpen={() => openTitle(featured)} /> : null}

        {ROWS.map(row => (
          <Rail key={row.id} heading={row.title} titles={row.titles} onOpen={openTitle} />
        ))}
      </ScrollView>
    </View>
  );
}

function Hero({ title, onOpen }: { title: CatalogTitle; onOpen: () => void }) {
  const { width } = useWindowDimensions();
  const download = useTitleDownload(title.id);
  const heroWidth = width - spacing.lg * 2;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={title.name} onPress={onOpen} style={styles.hero}>
      <TitleArtwork title={title} width={heroWidth} height={heroWidth * 1.3} borderRadius={radius.xl}>
        <View style={styles.heroContent}>
          <Text style={styles.heroGenres}>{title.genres.join('  •  ')}</Text>
          <Text style={styles.heroName}>{title.name}</Text>
          <Text style={styles.heroTagline}>{title.tagline}</Text>
          <View style={styles.heroButtons}>
            <View style={styles.flex}>
              <PlayButton title={title} />
            </View>
            <View style={styles.flex}>
              <DownloadControl state={download} name={title.name} title={title} variant="full" />
            </View>
          </View>
        </View>
      </TitleArtwork>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  content: { gap: spacing.xl, paddingBottom: spacing.xxl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: spacing.lg,
  },
  logo: { fontSize: 26, fontWeight: '900', letterSpacing: 4, color: colors.text },
  offlinePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radius.pill,
    backgroundColor: colors.surfaceRaised,
  },
  offlineText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
  hero: { alignSelf: 'center' },
  heroContent: { position: 'absolute', left: spacing.lg, right: spacing.lg, bottom: spacing.lg, gap: spacing.sm },
  heroGenres: { fontSize: 13, fontWeight: '600', color: colors.textSecondary, textAlign: 'center' },
  heroName: { fontSize: 34, fontWeight: '900', color: colors.text, textAlign: 'center', letterSpacing: -0.5 },
  heroTagline: { fontSize: 14, color: colors.textSecondary, textAlign: 'center' },
  heroButtons: { flexDirection: 'row', gap: spacing.sm, marginTop: spacing.sm },
  flex: { flex: 1 },
});
