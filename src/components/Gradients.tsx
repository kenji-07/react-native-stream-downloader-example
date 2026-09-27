import type { ReactNode } from 'react';
import { StyleSheet, useWindowDimensions, View, type StyleProp, type ViewStyle } from 'react-native';
import RadialGradient from 'react-native-radial-gradient';
import Svg, { Defs, LinearGradient, Rect, Stop } from 'react-native-svg';

import { colors } from '../theme';

/** A soft colored light: `color` fading to the same hue at zero alpha. */
export function fade(rgba: string): string {
  return rgba.replace(/[\d.]+\)$/, '0)');
}

interface GlowProps {
  color: string;
  /** Glow center, in dp, relative to the parent. */
  x: number;
  y: number;
  radius: number;
}

/** One radial light, absolutely positioned. center/radius are dp for react-native-radial-gradient. */
export function Glow({ color, x, y, radius: size }: GlowProps) {
  return (
    <RadialGradient
      pointerEvents="none"
      style={[styles.glow, { left: x - size, top: y - size, width: size * 2, height: size * 2 }]}
      colors={[color, fade(color)]}
      stops={[0, 1]}
      center={[size, size]}
      radius={size}
    />
  );
}

/** The app's ambient background: two radial lights over near-black. */
export function AmbientBackground({ accent = colors.accentGlow }: { accent?: string }) {
  const { width } = useWindowDimensions();
  return (
    <View pointerEvents="none" style={StyleSheet.absoluteFill}>
      <Glow color={accent} x={width * 0.1} y={-40} radius={width * 0.9} />
      <Glow color={colors.magentaGlow} x={width * 1.05} y={width * 0.35} radius={width * 0.6} />
    </View>
  );
}

interface ArtworkProps {
  palette: readonly [string, string, string];
  width: number;
  height: number;
  style?: StyleProp<ViewStyle>;
  children?: ReactNode;
}

/**
 * Title artwork painted with react-native-radial-gradient: a light source in
 * the upper third fading through the title's palette. Images are layered on
 * top by the caller and this remains as the fallback.
 */
export function ArtworkGradient({ palette, width, height, style, children }: ArtworkProps) {
  return (
    <RadialGradient
      style={[{ width, height, overflow: 'hidden' }, style]}
      colors={[...palette]}
      stops={[0, 0.55, 1]}
      center={[width * 0.3, height * 0.28]}
      radius={Math.max(width, height) * 1.05}
    >
      {children}
    </RadialGradient>
  );
}

/** Bottom-up darkening so text stays readable on top of artwork. */
export function Scrim({ from = 0.35, strength = 0.92, id = 'scrim' }: { from?: number; strength?: number; id?: string }) {
  return (
    <Svg pointerEvents="none" style={StyleSheet.absoluteFill} width="100%" height="100%">
      <Defs>
        <LinearGradient id={id} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={colors.background} stopOpacity={0} />
          <Stop offset={String(from)} stopColor={colors.background} stopOpacity={0} />
          <Stop offset="1" stopColor={colors.background} stopOpacity={strength} />
        </LinearGradient>
      </Defs>
      <Rect x="0" y="0" width="100%" height="100%" fill={`url(#${id})`} />
    </Svg>
  );
}

const styles = StyleSheet.create({
  glow: { position: 'absolute' },
});
