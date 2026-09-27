import { Component, type ReactNode } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { colors, spacing } from '../theme';
import { formatError } from '../utils/formatError';
import { Button } from './Buttons';
import { Icon } from './Icon';

interface ErrorBoundaryState {
  error: unknown;
  hasError: boolean;
}

/**
 * Last-resort screen. The most likely cause is a build without the
 * downloader's native module (E_LINKING): useEvent() connects to it on mount.
 */
export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  override state: ErrorBoundaryState = { error: null, hasError: false };

  static getDerivedStateFromError(error: unknown): ErrorBoundaryState {
    return { error, hasError: true };
  }

  private readonly retry = () => this.setState({ error: null, hasError: false });

  override render() {
    if (!this.state.hasError) return this.props.children;
    const error = formatError(this.state.error);
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.content}>
          <Icon name="warning" size={44} color={colors.warning} />
          <Text style={styles.title}>Something went wrong</Text>
          <Text style={styles.message}>{error.message}</Text>
          {error.code !== undefined ? <Text style={styles.code}>Error code: {error.code}</Text> : null}
          <Button label="Try again" icon="refresh" onPress={this.retry} />
        </View>
      </SafeAreaView>
    );
  }
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: colors.background },
  content: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing.md, padding: spacing.xl },
  title: { fontSize: 22, fontWeight: '800', color: colors.text },
  message: { fontSize: 15, lineHeight: 21, color: colors.textSecondary, textAlign: 'center' },
  code: { fontSize: 12, color: colors.textMuted, marginBottom: spacing.md },
});
