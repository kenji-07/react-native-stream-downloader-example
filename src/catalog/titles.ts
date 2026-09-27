import { protectedSource } from '../config/drm';
import { isSupportedOnThisPlatform, type MediaType, type ResolvedSource } from '../utils/media';

/** Home rows, in display order. */
export type Shelf = 'mp4' | 'hls' | 'drm' | 'mp4-subtitles' | 'rent';

export const SHELVES: ReadonlyArray<{ id: Shelf; title: string }> = [
  { id: 'mp4', title: 'MP4 videos' },
  { id: 'hls', title: 'HLS videos' },
  { id: 'drm', title: 'DRM videos' },
  { id: 'mp4-subtitles', title: 'MP4 + subtitle videos' },
  { id: 'rent', title: 'Rent videos' },
];

/** A subtitle file published next to an MP4 (SRT or WebVTT). */
export interface SidecarSubtitle {
  language: string;
  label: string;
  url: string;
}

export interface Title {
  id: string;
  shelf: Shelf;
  name: string;
  tagline: string;
  synopsis: string;
  year?: number;
  maturity: string;
  runtime?: string;
  genres: string[];
  format: MediaType;
  /** null only for a DRM title whose protected stream is not configured yet. */
  url: string | null;
  /** Radial-gradient palette used for artwork (and as a fallback when the image fails). */
  palette: [string, string, string];
  image?: string;
  /** DRM-protected (see src/config/drm.ts). */
  protected?: boolean;
  /** Who protects this title on this platform, e.g. "Axinom FairPlay test". */
  drmProvider?: string;
  /** Sidecar subtitles, saved together with the MP4 so they also work offline. */
  subtitles?: SidecarSubtitle[];
  /** Rental window: watching and downloads end this many hours after renting. */
  rental?: { hours: number };
}

const BBB_IMAGE = 'https://peach.blender.org/wp-content/uploads/title_anouncement.jpg';
const TOS_SUBTITLES = 'https://download.blender.org/demo/movies/ToS/subtitles';

/**
 * Public clear test media (plus DRM placeholders). They are third-party
 * hosted and may change; replace them with your own catalogue in a real app.
 */
const ALL_TITLES: readonly Title[] = [
  // MP4 videos: progressive files, downloaded whole.
  {
    id: 'jellyfish',
    shelf: 'mp4',
    name: 'Jellyfish',
    tagline: 'Ten quiet seconds in blue water.',
    synopsis: 'A short 720p MP4 clip — the quickest way to see a download finish.',
    maturity: 'All',
    runtime: '10 sec',
    genres: ['Nature'],
    format: 'mp4',
    url: 'https://test-videos.co.uk/vids/jellyfish/mp4/h264/720/Jellyfish_720_10s_2MB.mp4',
    palette: ['#38BDF8', '#0C2D48', '#07070C'],
  },
  {
    id: 'flower',
    shelf: 'mp4',
    name: 'Flower',
    tagline: 'A tiny nature short.',
    synopsis: 'A short MP4 clip released under CC0.',
    maturity: 'All',
    genres: ['Nature', 'Shorts'],
    format: 'mp4',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/flower.mp4',
    palette: ['#F472B6', '#3F0D24', '#07070C'],
  },
  {
    id: 'bunny-clip',
    shelf: 'mp4',
    name: 'Big Buck Bunny · Clip',
    tagline: 'Ten seconds of the forest.',
    synopsis: 'A 10-second 720p MP4 excerpt of the Blender short film.',
    year: 2008,
    maturity: '7+',
    runtime: '10 sec',
    genres: ['Animation'],
    format: 'mp4',
    url: 'https://test-videos.co.uk/vids/bigbuckbunny/mp4/h264/720/Big_Buck_Bunny_720_10s_2MB.mp4',
    palette: ['#A3E635', '#1F3A0B', '#07070C'],
    image: BBB_IMAGE,
  },

  // HLS videos: adaptive streams with selectable qualities, languages and subtitles.
  {
    id: 'big-buck-bunny',
    shelf: 'hls',
    name: 'Big Buck Bunny',
    tagline: 'A gentle giant. Three bullies. One very bad day.',
    synopsis:
      'A giant rabbit with a heart bigger than himself decides to teach three forest rodents a lesson they will not forget.',
    year: 2008,
    maturity: '7+',
    runtime: '10 min',
    genres: ['Animation', 'Comedy'],
    format: 'hls',
    url: 'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',
    palette: ['#7ED957', '#1D3B16', '#07070C'],
    image: BBB_IMAGE,
  },
  {
    id: 'angel-one',
    shelf: 'hls',
    name: 'Angel One',
    tagline: 'Many voices, one story.',
    synopsis: 'A short with alternate audio languages and subtitles — pick yours before you download.',
    maturity: '7+',
    genres: ['Drama', 'International'],
    format: 'hls',
    url: 'https://storage.googleapis.com/shaka-demo-assets/angel-one-hls/hls.m3u8',
    palette: ['#F59E0B', '#3A2106', '#07070C'],
  },
  {
    id: 'bipbop-showcase',
    shelf: 'hls',
    name: 'Bipbop Showcase',
    tagline: 'Every rendition, every language.',
    synopsis: 'A reference stream packed with video qualities, alternate audio and subtitles.',
    maturity: 'All',
    genres: ['Tech'],
    format: 'hls',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/img_bipbop_adv_example_fmp4/master.m3u8',
    palette: ['#EC4899', '#3B0A24', '#07070C'],
  },
  {
    id: 'bipbop-classic',
    shelf: 'hls',
    name: 'Bipbop Classic',
    tagline: 'The original test pattern.',
    synopsis: 'A classic 16:9 reference stream with several qualities and subtitles.',
    maturity: 'All',
    genres: ['Tech'],
    format: 'hls',
    url: 'https://devstreaming-cdn.apple.com/videos/streaming/examples/bipbop_16x9/bipbop_16x9_variant.m3u8',
    palette: ['#6366F1', '#1B1B4B', '#07070C'],
  },

  // DRM videos: Widevine on Android, FairPlay on iOS; each title uses its own source (src/config/drm.ts).
  {
    id: 'drm-premiere',
    shelf: 'drm',
    name: 'Premiere',
    tagline: 'Protected with DRM.',
    synopsis: 'Downloading acquires a persistent license from the license server, so it keeps playing offline.',
    maturity: '16+',
    genres: ['Premium'],
    ...protectedSource('drm-premiere'),
    palette: ['#FACC15', '#3A2E05', '#07070C'],
    protected: true,
  },
  {
    id: 'drm-encore',
    shelf: 'drm',
    name: 'Encore',
    tagline: 'Protected with DRM.',
    synopsis: 'A protected 1080p stream with alternate audio tracks and subtitles.',
    maturity: '16+',
    genres: ['Premium'],
    ...protectedSource('drm-encore'),
    palette: ['#F97316', '#3A1605', '#07070C'],
    protected: true,
  },
  {
    id: 'drm-finale',
    shelf: 'drm',
    name: 'Finale',
    tagline: 'One protected package, every device.',
    synopsis: 'A single CMAF (cbcs) package protected for both Widevine and FairPlay.',
    maturity: '16+',
    genres: ['Premium'],
    ...protectedSource('drm-finale'),
    palette: ['#A855F7', '#2A0E45', '#07070C'],
    protected: true,
  },

  // MP4 + subtitle videos: the subtitle files are saved with the download.
  {
    id: 'tears-of-steel',
    shelf: 'mp4-subtitles',
    name: 'Tears of Steel',
    tagline: 'The last stand in a fractured Amsterdam.',
    synopsis:
      'Warriors and scientists gather at the Oude Kerk in a desperate attempt to save the world from destructive robots. 720p MP4 with subtitles in nine languages (large download).',
    year: 2012,
    maturity: '13+',
    runtime: '12 min',
    genres: ['Sci-Fi', 'Action'],
    format: 'mp4',
    url: 'https://download.blender.org/demo/movies/ToS/tears_of_steel_720p.mov',
    palette: ['#2F6BFF', '#0E1A3A', '#07070C'],
    image: 'https://mango.blender.org/wp-content/uploads/2013/05/01_thom_celia_bridge.jpg',
    subtitles: [
      { language: 'en', label: 'English', url: `${TOS_SUBTITLES}/TOS-en.srt` },
      { language: 'de', label: 'Deutsch', url: `${TOS_SUBTITLES}/TOS-de.srt` },
      { language: 'es', label: 'Español', url: `${TOS_SUBTITLES}/TOS-es.srt` },
      { language: 'fr', label: 'Français', url: `${TOS_SUBTITLES}/TOS-fr-orig.srt` },
      { language: 'it', label: 'Italiano', url: `${TOS_SUBTITLES}/TOS-it.srt` },
      { language: 'nl', label: 'Nederlands', url: `${TOS_SUBTITLES}/TOS-nl.srt` },
      { language: 'pt-BR', label: 'Português (Brasil)', url: `${TOS_SUBTITLES}/TOS-PT-BR.srt` },
      { language: 'ru', label: 'Русский', url: `${TOS_SUBTITLES}/TOS-ru.srt` },
      { language: 'ja', label: '日本語', url: `${TOS_SUBTITLES}/TOS-JP.srt` },
    ],
  },
  {
    id: 'friday',
    shelf: 'mp4-subtitles',
    name: 'Friday',
    tagline: 'A few seconds of fast talk.',
    synopsis: 'A short black-and-white MP4 clip with English WebVTT subtitles.',
    maturity: 'All',
    runtime: '6 sec',
    genres: ['Classic', 'Shorts'],
    format: 'mp4',
    url: 'https://interactive-examples.mdn.mozilla.net/media/cc0-videos/friday.mp4',
    palette: ['#D4D4D8', '#27272A', '#07070C'],
    subtitles: [
      { language: 'en', label: 'English', url: 'https://interactive-examples.mdn.mozilla.net/media/examples/friday.vtt' },
    ],
  },

  // Rent videos: rent first; streaming and the download end with the rental.
  {
    id: 'dark-truths',
    shelf: 'rent',
    name: 'Dark Truths',
    tagline: 'Rent for 48 hours.',
    synopsis: 'An HLS rental. Once rented you can stream it or download it; both end when the rental does.',
    maturity: '13+',
    genres: ['Animation', 'New release'],
    format: 'hls',
    url: 'https://storage.googleapis.com/shaka-demo-assets/bbb-dark-truths-hls/hls.m3u8',
    palette: ['#EF4444', '#3B0909', '#07070C'],
    rental: { hours: 48 },
  },
  {
    id: 'sintel',
    shelf: 'rent',
    name: 'Sintel',
    tagline: 'A lonely girl searches for her dragon.',
    synopsis: 'An MP4 rental of the Sintel trailer. The downloaded copy expires with the 24-hour rental.',
    year: 2010,
    maturity: '13+',
    runtime: '1 min',
    genres: ['Fantasy', 'Animation'],
    format: 'mp4',
    url: 'https://download.blender.org/durian/trailer/sintel_trailer-720p.mp4',
    palette: ['#14B8A6', '#062E2A', '#07070C'],
    image: 'https://durian.blender.org/wp-content/uploads/2010/06/05.8b_comp_000272.jpg',
    rental: { hours: 24 },
  },
];

export interface CatalogTitle extends Title {
  /** The stream used on this device; null only for a DRM title that is not configured yet. */
  source: ResolvedSource | null;
}

/** Titles available on this device, with their stream resolved. */
export const TITLES: readonly CatalogTitle[] = ALL_TITLES.filter(title => isSupportedOnThisPlatform(title.format)).map(
  title => ({ ...title, source: title.url === null ? null : { type: title.format, url: title.url } }),
);

export function findTitle(id: string | undefined): CatalogTitle | undefined {
  return id === undefined ? undefined : TITLES.find(title => title.id === id);
}

export function titlesOnShelf(shelf: Shelf): CatalogTitle[] {
  return TITLES.filter(title => title.shelf === shelf);
}

export const FEATURED_TITLE_ID = 'tears-of-steel';
