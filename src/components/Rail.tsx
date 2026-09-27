import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import type { CatalogTitle } from '../catalog/titles';
import { useTitleDownload } from '../hooks/useTitleDownload';
import { colors, radius, spacing } from '../theme';
import { DownloadRing } from './DownloadRing';
import { Icon } from './Icon';
import { TitleArtwork } from './TitleArtwork';

const POSTER_WIDTH = 116;
const POSTER_HEIGHT = 168;

interface RailProps {
  heading: string;
  titles: readonly CatalogTitle[];
  onOpen: (title: CatalogTitle) => void;
}

/** A horizontal row of posters. */
export function Rail({ heading, titles, onOpen }: RailProps) {
  if (titles.length === 0) return null;
  return (
    <View style={styles.rail}>
      <Text style={styles.heading}>{heading}</Text>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.row}>
        {titles.map(title => (
          <Poster key={title.id} title={title} onPress={() => onOpen(title)} />
        ))}
      </ScrollView>
    </View>
  );
}

function Poster({ title, onPress }: { title: CatalogTitle; onPress: () => void }) {
  const download = useTitleDownload(title.id);
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={title.name}
      onPress={onPress}
      style={({ pressed }) => pressed && styles.pressed}
    >
      <TitleArtwork title={title} width={POSTER_WIDTH} height={POSTER_HEIGHT} showName>
        {download.kind !== 'none' ? (
          <View style={styles.corner}>
            <DownloadRing state={download} size={24} />
          </View>
        ) : null}
        <View style={styles.tags}>
          {title.protected ? (
            <View style={styles.tag}>
              <Icon name="lock" size={12} color={colors.warning} />
              <Text style={[styles.tagText, { color: colors.warning }]}>DRM</Text>
            </View>
          ) : null}
          {title.rental ? (
            <View style={styles.tag}>
              <Icon name="timer" size={12} color={colors.text} />
              <Text style={styles.tagText}>RENT</Text>
            </View>
          ) : null}
          {title.subtitles?.length ? (
            <View style={styles.tag}>
              <Text style={styles.tagText}>CC</Text>
            </View>
          ) : null}
        </View>
      </TitleArtwork>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  rail: { gap: spacing.sm },
  heading: { fontSize: 18, fontWeight: '800', color: colors.text, paddingHorizontal: spacing.lg },
  row: { gap: spacing.sm, paddingHorizontal: spacing.lg },
  pressed: { opacity: 0.75 },
  corner: {
    position: 'absolute',
    top: spacing.xs,
    right: spacing.xs,
    borderRadius: 14,
    padding: 2,
    backgroundColor: colors.overlay,
  },
  tags: { position: 'absolute', top: spacing.xs, left: spacing.xs, flexDirection: 'row', gap: 4 },
  tag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: 5,
    paddingVertical: 2,
    borderRadius: radius.sm,
    backgroundColor: colors.overlay,
  },
  tagText: { fontSize: 10, fontWeight: '800', color: colors.text },
});
