import type { ReactNode } from 'react';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';

import { ErrorBoundary } from './src/components/ErrorBoundary';
import { ToastProvider } from './src/components/Toast';
import { DownloaderProvider } from './src/downloader/DownloaderProvider';
import { ExpiryGuard } from './src/downloader/ExpiryGuard';
import { RootNavigator } from './src/navigation/RootNavigator';
import { RentalsProvider } from './src/rentals/RentalsProvider';
import { downloaderConfig, SettingsProvider, useSettings } from './src/settings/SettingsProvider';

export default function App() {
  return (
    <SafeAreaProvider>
      <StatusBar style="light" />
      <ErrorBoundary>
        <SettingsProvider>
          <RentalsProvider>
            <ToastProvider>
              <DownloadEngine>
                <ExpiryGuard />
                <RootNavigator />
              </DownloadEngine>
            </ToastProvider>
          </RentalsProvider>
        </SettingsProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}

/** Starts the download engine with the viewer's saved settings. */
function DownloadEngine({ children }: { children: ReactNode }) {
  const { settings } = useSettings();
  return (
    <DownloaderProvider enabledAtLaunch={settings.downloadsEnabled} launchConfig={downloaderConfig(settings)}>
      {children}
    </DownloaderProvider>
  );
}
