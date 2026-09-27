import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  disablePlugin,
  getConfig,
  getDownloadedAssets,
  getDownloadsStatus,
  registerPlugin,
  setConfig,
  useEvent,
  type Config,
  type DownloadStatus,
  type DownloadedAsset,
} from 'react-native-stream-downloader';

import { useMountedRef } from '../hooks/useMountedRef';
import { formatError, type FriendlyError } from '../utils/formatError';
import { isUnfinished } from '../utils/statuses';
import { downloadLog } from './downloadLog';

export type EngineState =
  | { phase: 'starting' }
  | { phase: 'ready' }
  | { phase: 'off' }
  | { phase: 'failed'; error: FriendlyError };

interface DownloaderContextValue {
  engine: EngineState;
  /** registerPlugin(); resolves false (and sets `engine.failed`) instead of throwing. */
  enable: () => Promise<boolean>;
  /** disablePlugin(); stops downloading for this app instance. */
  disable: () => Promise<void>;

  /** The downloader's own view of its config, read back with getConfig(). */
  config: Config | null;
  configure: (config: Config) => Promise<void>;

  statuses: DownloadStatus[];
  assets: DownloadedAsset[];
  upsertStatus: (status: DownloadStatus) => void;
  refreshStatuses: () => Promise<void>;
  refreshAssets: () => Promise<void>;
  refreshAll: () => Promise<void>;
}

const DownloaderContext = createContext<DownloaderContextValue | null>(null);

/**
 * completed / failed / removed are final for a download ID. Updates arrive on
 * different channels (promise results, events, snapshots) and can be out of
 * order, so a stale unfinished status never replaces a final one.
 */
function newer(existing: DownloadStatus | undefined, incoming: DownloadStatus): DownloadStatus {
  return existing !== undefined && !isUnfinished(existing.status) && isUnfinished(incoming.status) ? existing : incoming;
}

function upsert(previous: DownloadStatus[], incoming: readonly DownloadStatus[]): DownloadStatus[] {
  const byId = new Map(previous.map(status => [status.id, status]));
  for (const status of incoming) byId.set(status.id, newer(byId.get(status.id), status));
  return [...byId.values()];
}

function applySnapshot(previous: DownloadStatus[], snapshot: readonly DownloadStatus[]): DownloadStatus[] {
  const byId = new Map(previous.map(status => [status.id, status]));
  return snapshot.map(status => newer(byId.get(status.id), status));
}

interface DownloaderProviderProps {
  children: ReactNode;
  /** From settings: whether to call registerPlugin() at launch. */
  enabledAtLaunch: boolean;
  /** From settings: applied with setConfig() at launch. */
  launchConfig: Config;
}

/**
 * App-wide download engine state. It registers the plugin at launch, applies
 * the viewer's download settings, and keeps useEvent() listeners mounted for
 * the whole app so progress and completion are never missed.
 */
export function DownloaderProvider({ children, enabledAtLaunch, launchConfig }: DownloaderProviderProps) {
  const mounted = useMountedRef();
  const [engine, setEngine] = useState<EngineState>({ phase: enabledAtLaunch ? 'starting' : 'off' });
  const [config, setConfigState] = useState<Config | null>(null);
  const [statuses, setStatuses] = useState<DownloadStatus[]>([]);
  const [assets, setAssets] = useState<DownloadedAsset[]>([]);
  // Launch values are read once; later changes go through enable/disable/configure.
  const launch = useRef({ enabledAtLaunch, launchConfig });

  // Snapshot requests can resolve out of order; only the newest is applied.
  const statusRequest = useRef(0);
  const assetRequest = useRef(0);

  const refreshStatuses = useCallback(async () => {
    const request = ++statusRequest.current;
    const snapshot = await getDownloadsStatus();
    if (mounted.current && request === statusRequest.current) {
      setStatuses(previous => applySnapshot(previous, snapshot));
    }
  }, [mounted]);

  const refreshAssets = useCallback(async () => {
    const request = ++assetRequest.current;
    const list = await getDownloadedAssets();
    if (mounted.current && request === assetRequest.current) setAssets(list);
  }, [mounted]);

  const refreshAll = useCallback(async () => {
    await Promise.all([refreshStatuses(), refreshAssets()]);
  }, [refreshAssets, refreshStatuses]);

  const upsertStatus = useCallback((status: DownloadStatus) => {
    setStatuses(previous => upsert(previous, [status]));
  }, []);

  const configure = useCallback(
    async (next: Config) => {
      // Native configuration is durable; the example also remembers the viewer's
      // preferences and applies them before enabling transfers.
      await setConfig(next);
      const applied = await getConfig();
      if (mounted.current) setConfigState(applied);
    },
    [mounted],
  );

  const enable = useCallback(async () => {
    setEngine({ phase: 'starting' });
    try {
      // Keyless: this package needs no API key. It must resolve before any
      // other downloader call except setConfig/getConfig.
      const ok = await registerPlugin();
      if (!mounted.current) return ok;
      if (!ok) {
        setEngine({ phase: 'failed', error: { message: 'The download engine could not start.' } });
        return false;
      }
      setEngine({ phase: 'ready' });
      refreshAll().catch(() => undefined);
      return true;
    } catch (error) {
      if (mounted.current) setEngine({ phase: 'failed', error: formatError(error) });
      return false;
    }
  }, [mounted, refreshAll]);

  const disable = useCallback(async () => {
    await disablePlugin();
    if (mounted.current) setEngine({ phase: 'off' });
  }, [mounted]);

  useEffect(() => {
    const { enabledAtLaunch: startEnabled, launchConfig: startConfig } = launch.current;
    const boot = async () => {
      try {
        await configure(startConfig);
        if (startEnabled) await enable();
      } catch (error) {
        if (mounted.current) setEngine({ phase: 'failed', error: formatError(error) });
      }
    };
    void boot();
  }, [configure, enable, mounted]);

  // Progress for every download, every updateFrequencyMS while any is unfinished.
  useEvent('onDownloadProgress', (incoming: DownloadStatus[]) => {
    downloadLog.progress(incoming);
    setStatuses(previous => upsert(previous, incoming));
  });

  // The only completion signal: downloadStream() resolves at queue admission.
  useEvent('onDownloadEnd', (status: DownloadStatus) => {
    downloadLog.end(status);
    upsertStatus(status);
    if (status.status === 'completed') refreshAssets().catch(() => undefined);
  });

  // Errors without a download attached (e.g. a DRM callback problem).
  useEvent('onError', (message: string) => {
    downloadLog.error(message);
  });

  const value = useMemo<DownloaderContextValue>(
    () => ({
      engine,
      enable,
      disable,
      config,
      configure,
      statuses,
      assets,
      upsertStatus,
      refreshStatuses,
      refreshAssets,
      refreshAll,
    }),
    [engine, enable, disable, config, configure, statuses, assets, upsertStatus, refreshStatuses, refreshAssets, refreshAll],
  );

  return <DownloaderContext.Provider value={value}>{children}</DownloaderContext.Provider>;
}

export function useDownloader(): DownloaderContextValue {
  const context = useContext(DownloaderContext);
  if (context === null) throw new Error('useDownloader must be used inside <DownloaderProvider>.');
  return context;
}
