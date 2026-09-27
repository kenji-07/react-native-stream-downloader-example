import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { Icon, type IconName } from '../components/Icon';
import { useDownloader } from '../downloader/DownloaderProvider';
import { colors, spacing } from '../theme';
import type { ScreenProps, TabKey } from '../types/navigation';
import { isUnfinished } from '../utils/statuses';
import { DownloadsScreen } from './DownloadsScreen';
import { HomeScreen } from './HomeScreen';
import { SettingsScreen } from './SettingsScreen';

const TABS: ReadonlyArray<{ key: TabKey; label: string; icon: IconName }> = [
  { key: 'home', label: 'Home', icon: 'home' },
  { key: 'downloads', label: 'Downloads', icon: 'download' },
  { key: 'settings', label: 'Settings', icon: 'settings' },
];

/**
 * Bottom-tab shell. The active tab lives in the route params (no duplicated
 * state), and every tab stays mounted so scroll positions survive switching.
 */
export function MainScreen({ navigation, route }: ScreenProps<'Main'>) {
  const insets = useSafeAreaInsets();
  const { statuses } = useDownloader();
  const tab = route.params?.tab ?? 'home';
  const inProgress = statuses.filter(status => isUnfinished(status.status)).length;

  return (
    <View style={styles.root}>
      <View style={[styles.page, tab !== 'home' && styles.hidden]}>
        <HomeScreen />
      </View>
      <View style={[styles.page, tab !== 'downloads' && styles.hidden]}>
        <DownloadsScreen active={tab === 'downloads'} />
      </View>
      <View style={[styles.page, tab !== 'settings' && styles.hidden]}>
        <SettingsScreen />
      </View>

      <View style={[styles.tabBar, { paddingBottom: insets.bottom + spacing.xs }]}>
        {TABS.map(item => {
          const selected = item.key === tab;
          const tint = selected ? colors.text : colors.textMuted;
          return (
            <Pressable
              key={item.key}
              accessibilityRole="tab"
              accessibilityState={{ selected }}
              accessibilityLabel={item.label}
              onPress={() => navigation.setParams({ tab: item.key })}
              style={styles.tab}
            >
              <View>
                <Icon name={item.icon} size={24} color={tint} />
                {item.key === 'downloads' && inProgress > 0 ? (
                  <View style={styles.badge}>
                    <Text style={styles.badgeText}>{inProgress}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[styles.tabLabel, { color: tint }]}>{item.label}</Text>
            </Pressable>
          );
        })}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.background },
  page: { flex: 1 },
  hidden: { display: 'none' },
  tabBar: {
    flexDirection: 'row',
    paddingTop: spacing.sm,
    backgroundColor: 'rgba(7,7,12,0.96)',
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: colors.border,
  },
  tab: { flex: 1, alignItems: 'center', gap: 3 },
  tabLabel: { fontSize: 11, fontWeight: '600' },
  badge: {
    position: 'absolute',
    top: -4,
    right: -10,
    minWidth: 18,
    height: 18,
    borderRadius: 9,
    paddingHorizontal: 4,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: colors.accent,
  },
  badgeText: { fontSize: 11, fontWeight: '800', color: colors.text },
});
