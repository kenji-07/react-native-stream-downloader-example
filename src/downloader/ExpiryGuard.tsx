import { useEffect, useRef } from 'react';
import { deleteDownloadedAsset } from 'react-native-stream-downloader';

import { useToast } from '../components/Toast';
import { useRentals } from '../rentals/RentalsProvider';
import { useDownloader } from './DownloaderProvider';
import { expiryOf, readMeta } from './downloadMeta';

/**
 * Removes downloads whose time is up: an expired auto-delete (expiresAt) or
 * an ended rental. The downloader itself only enforces expiresAt on Android
 * at startup, so the app applies the same rule on both platforms while it
 * runs. Checked whenever the library changes and every 30 s.
 */
export function ExpiryGuard() {
  const { engine, assets, refreshAll } = useDownloader();
  const { now } = useRentals();
  const toast = useToast();
  const removing = useRef(new Set<string>());

  useEffect(() => {
    if (engine.phase !== 'ready') return;
    const expired = assets.filter(asset => {
      const expiry = expiryOf(asset);
      return expiry !== undefined && expiry <= now && !removing.current.has(asset.id);
    });
    if (expired.length === 0) return;

    // Marked until the library is re-read, so overlapping checks skip them.
    for (const asset of expired) removing.current.add(asset.id);
    const removeAll = async () => {
      for (const asset of expired) {
        try {
          await deleteDownloadedAsset(asset.id);
          const rental = readMeta(asset.metadata).rentalEndsAt !== undefined;
          toast.show({ message: `“${asset.title || 'A download'}” ${rental ? 'rental ended' : 'expired'} and was removed` });
        } catch {
          // Most likely still playing (E_ASSET_IN_USE); tried again on the next check.
        }
      }
      await refreshAll().catch(() => undefined);
      for (const asset of expired) removing.current.delete(asset.id);
    };
    void removeAll();
  }, [assets, engine.phase, now, refreshAll, toast]);

  return null;
}
