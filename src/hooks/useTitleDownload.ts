import { useMemo } from 'react';

import { useDownloader } from '../downloader/DownloaderProvider';
import { downloadStateFor, type TitleDownloadState } from '../downloader/downloadMeta';

/** Live download state of one catalog title, derived from package statuses and assets. */
export function useTitleDownload(titleId: string): TitleDownloadState {
  const { statuses, assets } = useDownloader();
  return useMemo(() => downloadStateFor(titleId, statuses, assets), [titleId, statuses, assets]);
}
