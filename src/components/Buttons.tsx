import type { ReactNode } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, View } from 'react-native';

import { colors, radius, spacing } from '../theme';
import { Icon, type IconName } from './Icon';

interface ButtonProps {
  label: string;
  onPress: () => void;
  icon?: IconName;
  /** Custom leading element, e.g. a DownloadRing. */
  leading?: ReactNode;
  variant?: 'primary' | 'secondary' | 'danger';
  disabled?: boolean;
  loading?: boolean;
}

const VARIANT = {
  primary: { background: colors.text, text: colors.onLight },
  secondary: { background: colors.surfaceRaised, text: colors.text },
  danger: { background: 'rgba(255,69,58,0.16)', text: colors.danger },
} as const;

/** Full-width title-page button (Play / Download). */
export function Button({ label, onPress, icon, leading, variant = 'primary', disabled = false, loading = false }: ButtonProps) {
  const palette = VARIANT[variant];
  const inactive = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled: inactive, busy: loading }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        { backgroundColor: palette.background },
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={palette.text} />
      ) : (
        leading ?? (icon ? <Icon name={icon} size={22} color={palette.text} /> : null)
      )}
      <Text style={[styles.label, { color: palette.text }]} numberOfLines={1} adjustsFontSizeToFit>
        {label}
      </Text>
    </Pressable>
  );
}

interface IconButtonProps {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  filled?: boolean;
  disabled?: boolean;
}

export function IconButton({ icon, onPress, label, size = 24, filled = false, disabled = false }: IconButtonProps) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      hitSlop={10}
      style={({ pressed }) => [
        styles.iconButton,
        filled && styles.iconFilled,
        { width: size + 16, height: size + 16, borderRadius: (size + 16) / 2 },
        (pressed || disabled) && styles.pressed,
      ]}
    >
      <Icon name={icon} size={size} />
    </Pressable>
  );
}

/** Selectable pill used in the download sheet. */
export function Choice({ label, selected, onPress }: { label: string; selected: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="radio"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={[styles.choice, selected && styles.choiceSelected]}
    >
      <Text style={[styles.choiceLabel, selected && styles.choiceLabelSelected]}>{label}</Text>
    </Pressable>
  );
}

export function ChoiceRow({ children }: { children: ReactNode }) {
  return <View style={styles.choiceRow}>{children}</View>;
}

const styles = StyleSheet.create({
  button: {
    minHeight: 48,
    borderRadius: radius.md,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.sm,
    paddingHorizontal: spacing.lg,
  },
  label: { flexShrink: 1, fontSize: 16, fontWeight: '700' },
  inactive: { opacity: 0.45 },
  pressed: { opacity: 0.7 },
  iconButton: { alignItems: 'center', justifyContent: 'center' },
  iconFilled: { backgroundColor: colors.overlay },
  choice: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.pill,
    borderWidth: 1,
    borderColor: colors.border,
    backgroundColor: colors.surfaceRaised,
  },
  choiceSelected: { backgroundColor: colors.text, borderColor: colors.text },
  choiceLabel: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
  choiceLabelSelected: { color: colors.onLight },
  choiceRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
});
