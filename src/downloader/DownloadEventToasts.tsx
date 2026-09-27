import { useEvent, type DownloadStatus } from 'react-native-stream-downloader';

import { useToast } from '../components/Toast';
import { navigationRef } from '../navigation/navigationRef';
import { readMeta } from './downloadMeta';

/**
 * Turns downloader events into in-app notifications, wherever the viewer is.
 * A second set of useEvent() listeners next to DownloaderProvider's; each
 * listener is removed when its component unmounts.
 */
export function DownloadEventToasts() {
  const toast = useToast();

  useEvent('onDownloadEnd', (status: DownloadStatus) => {
    const name = readMeta(status.metadata).title ?? 'Your download';
    if (status.status === 'completed') {
      toast.show({
        message: `“${name}” is ready to watch offline`,
        tone: 'success',
        action: {
          label: 'Watch',
          onPress: () => {
            if (navigationRef.isReady()) navigationRef.navigate('Player', { mode: 'offline', assetId: status.id });
          },
        },
      });
    } else if (status.status === 'failed') {
      toast.show({
        message: `“${name}” couldn't be downloaded${status.error ? `: ${status.error}` : ''}`,
        tone: 'error',
        action: {
          label: 'View',
          onPress: () => {
            if (navigationRef.isReady()) navigationRef.navigate('Main', { tab: 'downloads' });
          },
        },
      });
    }
    // 'removed' is always the result of the viewer's own cancel/remove, so it stays silent.
  });

  // Errors without a download attached (e.g. a DRM callback problem).
  useEvent('onError', (message: string) => {
    toast.show({ message, tone: 'error' });
  });

  return null;
}
