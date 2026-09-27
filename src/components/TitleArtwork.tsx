import { useState, type ReactNode } from 'react';
import { Image, StyleSheet, Text, View } from 'react-native';

import type { Title } from '../catalog/titles';
import { colors, spacing } from '../theme';
import { ArtworkGradient, Scrim } from './Gradients';

interface TitleArtworkProps {
  title: Pick<Title, 'name' | 'palette' | 'image'>;
  width: number;
  height: number;
  borderRadius?: number;
  /** Print the title name on the artwork (poster style). */
  showName?: boolean;
  nameSize?: number;
  children?: ReactNode;
}

/** Radial-gradient artwork with the title's image on top when it loads. */
export function TitleArtwork({ title, width, height, borderRadius = 10, showName = false, nameSize = 15, children }: TitleArtworkProps) {
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = title.image !== undefined && !imageFailed;
  return (
    <View style={[styles.frame, { width, height, borderRadius }]}>
      <ArtworkGradient palette={title.palette} width={width} height={height}>
        {showImage ? (
          <Image
            source={{ uri: title.image }}
            style={StyleSheet.absoluteFill}
            resizeMode="cover"
            onError={() => setImageFailed(true)}
          />
        ) : null}
        {showName || children ? <Scrim /> : null}
        {showName ? (
          <Text style={[styles.name, { fontSize: nameSize }]} numberOfLines={2}>
            {title.name}
          </Text>
        ) : null}
        {children}
      </ArtworkGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  frame: { overflow: 'hidden', backgroundColor: colors.surface },
  name: {
    position: 'absolute',
    left: spacing.sm,
    right: spacing.sm,
    bottom: spacing.sm,
    fontWeight: '800',
    color: colors.text,
  },
});
