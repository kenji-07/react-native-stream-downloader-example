import type { DRMConfig, DRMLicenseStatusOptions } from 'react-native-stream-downloader';
import { DRMType, type Drm } from 'react-native-video';

import { IS_IOS, type MediaType } from '../utils/media';
import { AXINOM_CMAF_CBCS_TOKEN, AXINOM_SINGLE_KEY_TOKEN } from './axinomTestTokens';

/**
 * DRM integration for the "DRM videos" row.
 *
 * Every DRM title has its own source per platform (Widevine on Android,
 * FairPlay on iOS), so different providers can be compared side by side.
 * All values below are PUBLIC TEST setups, for trying the app only; replace
 * them with your own provider's content, license server and tokens.
 *
 * Offline downloads need the license server to grant persistent licenses:
 * - Google Widevine test server: not guaranteed.
 * - EZDRM FairPlay demo: playback-only licenses, so downloads are expected to fail.
 * - Axinom test vectors: tokens set "allow_persistence": true.
 */
interface DrmSource {
  /** Shown on the title page. */
  provider: string;
  /** DRM-packaged stream: DASH/HLS + Widevine on Android, HLS + FairPlay on iOS. */
  url: string;
  /** Widevine / FairPlay license server. */
  licenseServer: string;
  /** FairPlay application certificate (iOS only). */
  certificateUrl?: string;
  /** Sent with every license request, e.g. a provider token. */
  headers?: Record<string, string>;
  /**
   * Optional iOS alternative to licenseServer: your own backend endpoint that
   * turns a Base64 SPC into a Base64 CKC (used through DRMConfig.getLicense).
   */
  customLicenseEndpoint?: string;
  /** Optional app backend: POST { expirationTokens } -> { expiresAt: Unix milliseconds | null }. */
  licenseExpirationEndpoint?: string;
}

const GOOGLE_WIDEVINE_TEST_LICENSE = 'https://proxy.uat.widevine.com/proxy?video_id=2015_tears&provider=widevine_test';

const AXINOM_WIDEVINE_LICENSE = 'https://drm-widevine-licensing.axprod.net/AcquireLicense';
const AXINOM_FAIRPLAY_LICENSE = 'https://drm-fairplay-licensing.axprod.net/AcquireLicense';
/** Axinom's FairPlay certificate, for evaluation and testing only. */
const AXINOM_FAIRPLAY_CERTIFICATE = 'https://tools.axinom.com/FPScert/fairplay.cer';

const DRM_SOURCES: Record<string, { android?: DrmSource; ios?: DrmSource }> = {
  'drm-premiere': {
    // Tears of Steel, Widevine CENC (DASH, H.264): the Media3/ExoPlayer demo stream.
    android: {
      provider: 'Google Widevine test',
      url: 'https://storage.googleapis.com/wvmedia/cenc/h264/tears/tears.mpd',
      licenseServer: GOOGLE_WIDEVINE_TEST_LICENSE,
    },
    // EZDRM's public FairPlay demo (HLS, MPEG-TS).
    ios: {
      provider: 'EZDRM FairPlay demo',
      url: 'https://fps.ezdrm.com/demo/video/ezdrm.m3u8',
      licenseServer: 'https://fps.ezdrm.com/api/licenses/09cc0377-6dd4-40cb-b09d-b582236e70fe',
      certificateUrl: 'https://fps.ezdrm.com/demo/video/eleisure.cer',
    },
  },
  'drm-encore': {
    // Axinom v10 test vector, H.264 single key: DASH (CENC) on Android, HLS (MPEG-TS) on iOS.
    android: {
      provider: 'Axinom Widevine test',
      url: 'https://media.axprod.net/TestVectors/Dash/protected_dash_1080p_h264_singlekey/manifest.mpd',
      licenseServer: AXINOM_WIDEVINE_LICENSE,
      headers: { 'X-AxDRM-Message': AXINOM_SINGLE_KEY_TOKEN },
    },
    ios: {
      provider: 'Axinom FairPlay test',
      url: 'https://media.axprod.net/TestVectors/Hls/protected_hls_1080p_h264_singlekey/manifest.m3u8',
      licenseServer: AXINOM_FAIRPLAY_LICENSE,
      certificateUrl: AXINOM_FAIRPLAY_CERTIFICATE,
      headers: { 'X-AxDRM-Message': AXINOM_SINGLE_KEY_TOKEN },
    },
  },
  'drm-finale': {
    // Axinom v10 test vector, one CMAF (cbcs) package for both platforms: DASH on Android, HLS on iOS.
    // cbcs needs Android 7.1 (API 25) or later.
    android: {
      provider: 'Axinom Widevine test (CMAF)',
      url: 'https://media.axprod.net/TestVectors/Cmaf/protected_1080p_h264_cbcs/manifest.mpd',
      licenseServer: AXINOM_WIDEVINE_LICENSE,
      headers: { 'X-AxDRM-Message': AXINOM_CMAF_CBCS_TOKEN },
    },
    ios: {
      provider: 'Axinom FairPlay test (CMAF)',
      url: 'https://media.axprod.net/TestVectors/Cmaf/protected_1080p_h264_cbcs/manifest.m3u8',
      licenseServer: AXINOM_FAIRPLAY_LICENSE,
      certificateUrl: AXINOM_FAIRPLAY_CERTIFICATE,
      headers: { 'X-AxDRM-Message': AXINOM_CMAF_CBCS_TOKEN },
    },
  },
};

function sourceFor(titleId: string): DrmSource | undefined {
  const entry = DRM_SOURCES[titleId];
  return IS_IOS ? entry?.ios : entry?.android;
}

function isComplete(source: DrmSource | undefined): source is DrmSource {
  if (!source || source.url === '') return false;
  const hasLicense = source.licenseServer !== '' || (IS_IOS && (source.customLicenseEndpoint ?? '') !== '');
  // FairPlay always needs the application certificate.
  return hasLicense && (!IS_IOS || (source.certificateUrl ?? '') !== '');
}

/** The protected stream for a catalog title on this platform; url is null until it is set up. */
export function protectedSource(titleId: string): { format: MediaType; url: string | null; drmProvider?: string } {
  const source = sourceFor(titleId);
  if (!isComplete(source)) return { format: 'hls', url: null };
  const format: MediaType = source.url.toLowerCase().split('?')[0]?.endsWith('.mpd') ? 'dash' : 'hls';
  return { format, url: source.url, drmProvider: source.provider };
}

export function isDrmConfigured(): boolean {
  return Object.keys(DRM_SOURCES).some(titleId => isComplete(sourceFor(titleId)));
}

/**
 * License request headers. With a real provider, fetch a short-lived,
 * user/asset-scoped token from your backend here, right before each download
 * or playback; never hard-code it.
 */
async function licenseHeaders(source: DrmSource): Promise<Record<string, string>> {
  return { ...(source.headers ?? {}) };
}

/**
 * FairPlay getLicense adapter. The downloader passes the SPC already
 * Base64-encoded and expects a canonical Base64 CKC string back. The wire
 * format to your endpoint is yours to define; adapt this to your provider.
 */
function createGetLicense(endpoint: string, headers: Record<string, string>): NonNullable<DRMConfig['getLicense']> {
  return async (spcString, contentId, licenseUrl, loadedLicenseUrl) => {
    const response = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...headers },
      body: JSON.stringify({ spc: spcString, contentId, licenseUrl, loadedLicenseUrl }),
    });
    if (!response.ok) throw new Error(`License request failed (HTTP ${response.status})`);
    return (await response.text()).trim();
  };
}

function requireSource(titleId: string): DrmSource {
  const source = sourceFor(titleId);
  if (!isComplete(source)) throw new Error('This protected title is not set up on this device.');
  return source;
}

/** DownloadOptions.drm for a protected download. The downloader persists the offline license. */
export async function drmForDownload(titleId: string): Promise<DRMConfig> {
  const source = requireSource(titleId);
  const headers = await licenseHeaders(source);
  const hasHeaders = Object.keys(headers).length > 0;
  const certificate = IS_IOS && source.certificateUrl ? { certificateUrl: source.certificateUrl } : {};
  if (IS_IOS && source.customLicenseEndpoint) {
    return { ...certificate, getLicense: createGetLicense(source.customLicenseEndpoint, headers) };
  }
  return { licenseServer: source.licenseServer, ...certificate, ...(hasHeaders ? { headers } : {}) };
}

/**
 * react-native-video's own `source.drm`, used only for ONLINE playback of a
 * protected title. Offline playback needs no DRM props: pathToFile already
 * refers to media whose license the downloader stored.
 */
export async function drmForStreaming(titleId: string): Promise<Drm> {
  const source = requireSource(titleId);
  const headers = await licenseHeaders(source);
  const hasHeaders = Object.keys(headers).length > 0;
  const certificate = IS_IOS && source.certificateUrl ? { certificateUrl: source.certificateUrl } : {};
  if (IS_IOS && source.customLicenseEndpoint) {
    return {
      type: DRMType.FAIRPLAY,
      ...certificate,
      getLicense: createGetLicense(source.customLicenseEndpoint, headers),
    };
  }
  return {
    type: IS_IOS ? DRMType.FAIRPLAY : DRMType.WIDEVINE,
    licenseServer: source.licenseServer,
    ...certificate,
    ...(hasHeaders ? { headers } : {}),
  };
}

/** Wire this only to a backend that understands your FairPlay provider's expiration SPCs. */
export function drmLicenseStatusOptions(titleId: string): DRMLicenseStatusOptions {
  const source = requireSource(titleId);
  if (!IS_IOS || !source.licenseExpirationEndpoint) return {};
  const endpoint = source.licenseExpirationEndpoint;
  return { getExpirationDate: async expirationTokens => {
    const headers = await licenseHeaders(source);
    const response = await fetch(endpoint, { method: 'POST', headers: { 'Content-Type': 'application/json', ...headers }, body: JSON.stringify({ expirationTokens }) });
    if (!response.ok) throw new Error('The license expiration check failed.');
    const result: unknown = await response.json();
    if (result === null || typeof result !== 'object' || !('expiresAt' in result) || (result.expiresAt !== null && (typeof result.expiresAt !== 'number' || !Number.isSafeInteger(result.expiresAt) || result.expiresAt < 0))) throw new Error('The expiration endpoint returned an invalid date.');
    return result.expiresAt as number | null;
  } };
}
