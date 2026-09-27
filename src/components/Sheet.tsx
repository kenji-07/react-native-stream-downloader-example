import { useRef, type ReactNode } from 'react';
import { Modal, Platform, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { Glow } from './Gradients';
import { Icon, type IconName } from './Icon';

interface SheetProps {
  visible: boolean;
  onClose: () => void;
  /** iOS: called once the modal has fully disappeared. */
  onDismissed?: () => void;
  children: ReactNode;
}

/** Bottom sheet on top of a dimmed backdrop. */
export function Sheet({ visible, onClose, onDismissed, children }: SheetProps) {
  const insets = useSafeAreaInsets();
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={onClose}
      {...(onDismissed ? { onDismiss: onDismissed } : {})}
      statusBarTranslucent
    >
      <View style={styles.root}>
        <Pressable accessibilityLabel="Close" style={StyleSheet.absoluteFill} onPress={onClose} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.lg }]}>
          <Glow color={colors.accentGlow} x={0} y={0} radius={220} />
          <View style={styles.handle} />
          {children}
        </View>
      </View>
    </Modal>
  );
}

export interface SheetAction {
  key: string;
  label: string;
  icon: IconName;
  destructive?: boolean;
  onPress: () => void;
}

interface ActionSheetProps {
  visible: boolean;
  title?: string;
  subtitle?: string;
  actions: readonly SheetAction[];
  onClose: () => void;
}

export function ActionSheet({ visible, title, subtitle, actions, onClose }: ActionSheetProps) {
  // iOS cannot present an Alert while a Modal is still dismissing, so the
  // chosen action runs after the sheet is gone (immediately on Android).
  const pending = useRef<(() => void) | null>(null);
  const runPending = () => {
    const action = pending.current;
    pending.current = null;
    action?.();
  };
  const choose = (action: SheetAction) => {
    pending.current = action.onPress;
    onClose();
    if (Platform.OS !== 'ios') runPending();
  };

  return (
    <Sheet visible={visible} onClose={onClose} onDismissed={runPending}>
      {title !== undefined ? <Text style={styles.title}>{title}</Text> : null}
      {subtitle !== undefined ? <Text style={styles.subtitle}>{subtitle}</Text> : null}
      <View style={styles.actions}>
        {actions.map(action => {
          const tint = action.destructive ? colors.danger : colors.text;
          return (
            <Pressable
              key={action.key}
              accessibilityRole="button"
              onPress={() => choose(action)}
              style={({ pressed }) => [styles.action, pressed && styles.actionPressed]}
            >
              <Icon name={action.icon} size={22} color={tint} />
              <Text style={[styles.actionLabel, { color: tint }]}>{action.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: 'flex-end', backgroundColor: colors.overlay },
  sheet: {
    overflow: 'hidden',
    backgroundColor: colors.surface,
    borderTopLeftRadius: radius.xl,
    borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing.lg,
    paddingTop: spacing.sm,
    gap: spacing.md,
  },
  handle: {
    alignSelf: 'center',
    width: 40,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.25)',
    marginBottom: spacing.sm,
  },
  title: { fontSize: 18, fontWeight: '800', color: colors.text },
  subtitle: { fontSize: 13, color: colors.textSecondary, marginTop: -spacing.sm },
  actions: { gap: spacing.xs },
  action: { flexDirection: 'row', alignItems: 'center', gap: spacing.md, paddingVertical: spacing.md },
  actionPressed: { opacity: 0.6 },
  actionLabel: { fontSize: 16, fontWeight: '600' },
});
