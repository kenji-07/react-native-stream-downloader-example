import { StyleSheet, View } from 'react-native';
import { AnimatedCircularProgress } from 'react-native-circular-progress';

import type { TitleDownloadState } from '../downloader/downloadMeta';
import { colors } from '../theme';
import { Icon, type IconName } from './Icon';

interface DownloadRingProps {
  state: TitleDownloadState;
  size?: number;
}

const TRACK = 'rgba(255,255,255,0.18)';

/** Download state at a glance: arrow, waiting ring, live progress ring, paused, failed or done. */
export function DownloadRing({ state, size = 34 }: DownloadRingProps) {
  const iconSize = Math.round(size * 0.5);

  if (state.kind === 'none') return <Centered size={size} icon="download" iconSize={size * 0.7} />;
  if (state.kind === 'failed') return <Centered size={size} icon="warning" iconSize={size * 0.62} color={colors.danger} />;
  if (state.kind === 'downloaded') {
    return (
      <View style={[styles.done, { width: size, height: size, borderRadius: size / 2 }]}>
        <Icon name="check" size={iconSize} color={colors.text} />
      </View>
    );
  }

  const progress = Math.floor(state.status.progress * 100);
  const icon: IconName = state.kind === 'downloading' ? 'pause' : 'download';
  return (
    <View style={{ width: size, height: size }}>
      <AnimatedCircularProgress
        size={size}
        width={3}
        fill={state.kind === 'queued' ? 0 : progress}
        tintColor={state.kind === 'paused' ? colors.warning : colors.accent}
        backgroundColor={TRACK}
        rotation={0}
        lineCap="round"
        duration={400}
        {...(state.kind === 'queued' ? { dashedBackground: { width: 3, gap: 4 } } : {})}
      />
      <View style={[StyleSheet.absoluteFill, styles.center]}>
        <Icon name={icon} size={iconSize} color={state.kind === 'queued' ? colors.textMuted : colors.text} />
      </View>
    </View>
  );
}

function Centered({ size, icon, iconSize, color = colors.text }: { size: number; icon: IconName; iconSize: number; color?: string }) {
  return (
    <View style={[styles.center, { width: size, height: size }]}>
      <Icon name={icon} size={iconSize} color={color} />
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: 'center', justifyContent: 'center' },
  done: { alignItems: 'center', justifyContent: 'center', backgroundColor: colors.accent },
});
