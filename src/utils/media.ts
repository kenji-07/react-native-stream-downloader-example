import { Platform } from 'react-native';

export type MediaType = 'hls' | 'dash' | 'mp4';

export const IS_IOS = Platform.OS === 'ios';

export const MEDIA_TYPE_LABEL: Record<MediaType, string> = {
  hls: 'HLS',
  dash: 'DASH',
  mp4: 'MP4',
};

/** The downloader's documented format support: MPEG-DASH is Android only. */
export function isSupportedOnThisPlatform(type: MediaType): boolean {
  return type !== 'dash' || !IS_IOS;
}

export interface ResolvedSource {
  type: MediaType;
  url: string;
}
