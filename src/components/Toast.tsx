import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { Animated, Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { colors, radius, spacing } from '../theme';
import { formatError } from '../utils/formatError';
import { Icon, type IconName } from './Icon';

export interface ToastOptions {
  message: string;
  tone?: 'info' | 'success' | 'error';
  /** Small error code shown under the message. */
  code?: string;
  action?: { label: string; onPress: () => void };
}

interface ToastContextValue {
  show: (options: ToastOptions) => void;
  showError: (error: unknown) => void;
}

const ToastContext = createContext<ToastContextValue | null>(null);

const TONE_ICON: Record<NonNullable<ToastOptions['tone']>, { icon: IconName; color: string }> = {
  info: { icon: 'info', color: colors.accent },
  success: { icon: 'offline', color: colors.success },
  error: { icon: 'warning', color: colors.danger },
};

const VISIBLE_MS = 4000;

/** One toast at a time; a newer message replaces the current one. */
export function ToastProvider({ children }: { children: ReactNode }) {
  const insets = useSafeAreaInsets();
  const [toast, setToast] = useState<(ToastOptions & { id: number }) | null>(null);
  const nextId = useRef(1);
  const opacity = useRef(new Animated.Value(0)).current;

  const show = useCallback((options: ToastOptions) => {
    setToast({ ...options, id: nextId.current++ });
  }, []);

  const showError = useCallback(
    (error: unknown) => {
      const friendly = formatError(error);
      show({ message: friendly.message, tone: 'error', ...(friendly.code !== undefined ? { code: friendly.code } : {}) });
    },
    [show],
  );

  const toastId = toast?.id;
  useEffect(() => {
    if (toastId === undefined) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) setToast(current => (current?.id === toastId ? null : current));
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [opacity, toastId]);

  const value = useMemo(() => ({ show, showError }), [show, showError]);
  const tone = TONE_ICON[toast?.tone ?? 'info'];

  return (
    <ToastContext.Provider value={value}>
      {children}
      {toast !== null ? (
        <Animated.View
          pointerEvents="box-none"
          style={[
            styles.host,
            {
              bottom: insets.bottom + 84,
              opacity,
              transform: [{ translateY: opacity.interpolate({ inputRange: [0, 1], outputRange: [16, 0] }) }],
            },
          ]}
        >
          <View style={styles.toast} accessibilityRole="alert">
            <Icon name={tone.icon} size={20} color={tone.color} />
            <View style={styles.text}>
              <Text style={styles.message}>{toast.message}</Text>
              {toast.code !== undefined ? <Text style={styles.code}>Error code: {toast.code}</Text> : null}
            </View>
            {toast.action ? (
              <Pressable
                accessibilityRole="button"
                hitSlop={8}
                onPress={() => {
                  toast.action?.onPress();
                  setToast(null);
                }}
              >
                <Text style={styles.action}>{toast.action.label}</Text>
              </Pressable>
            ) : null}
          </View>
        </Animated.View>
      ) : null}
    </ToastContext.Provider>
  );
}

export function useToast(): ToastContextValue {
  const context = useContext(ToastContext);
  if (context === null) throw new Error('useToast must be used inside <ToastProvider>.');
  return context;
}

const styles = StyleSheet.create({
  host: { position: 'absolute', left: spacing.lg, right: spacing.lg },
  toast: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    padding: spacing.md,
    borderRadius: radius.lg,
    backgroundColor: colors.surfaceRaised,
    borderWidth: 1,
    borderColor: colors.border,
  },
  text: { flex: 1, gap: 2 },
  message: { fontSize: 14, lineHeight: 19, color: colors.text, fontWeight: '600' },
  code: { fontSize: 11, color: colors.textMuted },
  action: { fontSize: 14, fontWeight: '800', color: colors.accent },
});
