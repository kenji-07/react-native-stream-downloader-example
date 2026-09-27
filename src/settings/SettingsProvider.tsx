import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from 'react';
import type { Config } from 'react-native-stream-downloader';

import type { VideoQualityPreference } from '../downloader/trackChoices';
import { readJson, writeJson } from '../storage';

export type ProgressMode = 'smooth' | 'standard' | 'saver';
export type AutoDelete = 'never' | '7d' | '30d';

export interface AppSettings {
  /** registerPlugin() at launch when true; disablePlugin() when turned off. */
  downloadsEnabled: boolean;
  /** Show the quality / language sheet before each download. */
  askBeforeDownload: boolean;
  videoQuality: VideoQualityPreference;
  /** DownloadOptions.includeAllTracks: keep every audio language and subtitle. */
  includeAllTracks: boolean;
  /** DownloadOptions.checkStorageBeforeDownload. */
  checkStorage: boolean;
  /** DownloadOptions.expiresAt, relative to the moment a download starts. */
  autoDelete: AutoDelete;
  /** Config.maxParallelDownloads. */
  maxParallelDownloads: number;
  /** Config.updateFrequencyMS. */
  progressMode: ProgressMode;
  wifiOnly: boolean;
  autoRetry: boolean;
}

const DEFAULT_SETTINGS: AppSettings = {
  downloadsEnabled: true,
  askBeforeDownload: true,
  videoQuality: 'standard',
  includeAllTracks: false,
  checkStorage: true,
  autoDelete: 'never',
  maxParallelDownloads: 2,
  progressMode: 'standard',
  wifiOnly: false,
  autoRetry: false,
};

export const PROGRESS_INTERVAL_MS: Record<ProgressMode, number> = { smooth: 250, standard: 1000, saver: 3000 };

const DAY = 24 * 60 * 60 * 1000;
export const AUTO_DELETE_MS: Record<AutoDelete, number | null> = { never: null, '7d': 7 * DAY, '30d': 30 * DAY };

/** The downloader's runtime Config derived from the viewer's settings. */
export function downloaderConfig(settings: AppSettings): Config {
  return {
    wifiOnly: settings.wifiOnly,
    retry: { maxRetries: settings.autoRetry ? 3 : 0, initialDelayMS: 1000, maxDelayMS: 30000 },
    maxParallelDownloads: settings.maxParallelDownloads,
    updateFrequencyMS: PROGRESS_INTERVAL_MS[settings.progressMode],
  };
}

const KEY = 'settings.v1';

function pick<T>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.find(option => option === value) ?? fallback;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}

/** Stored values are validated field by field; anything unknown falls back to the default. */
function loadSettings(): AppSettings {
  const value = readJson(KEY);
  if (!isRecord(value)) return DEFAULT_SETTINGS;
  const bool = (key: keyof AppSettings, fallback: boolean): boolean => {
    const raw = value[key];
    return typeof raw === 'boolean' ? raw : fallback;
  };
  return {
    wifiOnly: bool('wifiOnly', DEFAULT_SETTINGS.wifiOnly),
    autoRetry: bool('autoRetry', DEFAULT_SETTINGS.autoRetry),
    downloadsEnabled: bool('downloadsEnabled', DEFAULT_SETTINGS.downloadsEnabled),
    askBeforeDownload: bool('askBeforeDownload', DEFAULT_SETTINGS.askBeforeDownload),
    videoQuality: pick(value.videoQuality, ['standard', 'high'] as const, DEFAULT_SETTINGS.videoQuality),
    includeAllTracks: bool('includeAllTracks', DEFAULT_SETTINGS.includeAllTracks),
    checkStorage: bool('checkStorage', DEFAULT_SETTINGS.checkStorage),
    autoDelete: pick(value.autoDelete, ['never', '7d', '30d'] as const, DEFAULT_SETTINGS.autoDelete),
    maxParallelDownloads: pick(value.maxParallelDownloads, [1, 2, 3, 5], DEFAULT_SETTINGS.maxParallelDownloads),
    progressMode: pick(value.progressMode, ['smooth', 'standard', 'saver'] as const, DEFAULT_SETTINGS.progressMode),
  };
}

interface SettingsContextValue {
  settings: AppSettings;
  updateSettings: (change: Partial<AppSettings>) => void;
}

const SettingsContext = createContext<SettingsContextValue | null>(null);

export function SettingsProvider({ children }: { children: ReactNode }) {
  const [settings, setSettings] = useState<AppSettings>(loadSettings);

  useEffect(() => {
    writeJson(KEY, settings);
  }, [settings]);

  const updateSettings = useCallback((change: Partial<AppSettings>) => {
    setSettings(previous => ({ ...previous, ...change }));
  }, []);

  const value = useMemo(() => ({ settings, updateSettings }), [settings, updateSettings]);
  return <SettingsContext.Provider value={value}>{children}</SettingsContext.Provider>;
}

export function useSettings(): SettingsContextValue {
  const context = useContext(SettingsContext);
  if (context === null) throw new Error('useSettings must be used inside <SettingsProvider>.');
  return context;
}
