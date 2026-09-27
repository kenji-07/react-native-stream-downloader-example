import type {
  AudioTrack,
  AvailableTracksByType,
  DownloadOptions,
  TextTrack,
  TrackType,
  VideoTrack,
} from 'react-native-stream-downloader';

import { formatBitrate } from '../utils/format';

export type TracksRequest = NonNullable<DownloadOptions['tracks']>;

export type VideoQualityPreference = 'standard' | 'high';

/** What the viewer picked in the download sheet (or what Settings picked automatically). */
export interface TrackChoice {
  /** null: keep every quality (the `video` category is omitted). */
  videoId: string | null;
  /** 'all' omits the category, so the downloader keeps every language. */
  audio: 'all' | string;
  /** 'off' sends an empty list: no subtitles are downloaded. */
  text: 'all' | 'off' | string;
  /** MP4 sidecar subtitles to save with the download: all, none, or one language code. */
  sidecar: 'all' | 'off' | string;
}

/** The choice used for MP4 files: the whole file, every sidecar subtitle. */
export const WHOLE_FILE: TrackChoice = { videoId: null, audio: 'all', text: 'all', sidecar: 'all' };

export interface ChoiceLabels {
  quality: string;
  audio: string;
  subtitles: string;
}

function countByType(tracks: AvailableTracksByType): Record<TrackType, number> {
  return { video: tracks.video.length, audio: tracks.audio.length, text: tracks.text.length };
}

/** Whether the sheet has anything worth asking about. */
export function hasChoices(tracks: AvailableTracksByType): boolean {
  const counts = countByType(tracks);
  return counts.video > 1 || counts.audio > 1 || counts.text > 0;
}

/** Highest quality first. */
export function sortedVideo(tracks: AvailableTracksByType): VideoTrack[] {
  return [...tracks.video].sort((a, b) => b.bandwidth - a.bandwidth);
}

export function qualityName(track: VideoTrack): string {
  const height = track.resolution?.height;
  if (height !== undefined) {
    if (height >= 2160) return '4K';
    return `${height}p`;
  }
  return track.label ?? formatBitrate(track.bandwidth);
}

export function qualityBadge(track: VideoTrack): string {
  const height = track.resolution?.height ?? 0;
  if (height >= 2160) return 'Ultra HD';
  if (height >= 720) return 'HD';
  return 'SD';
}

export function languageName(track: AudioTrack | TextTrack): string {
  const base = track.name || track.language || track.id;
  return track.type === 'text' && track.forced ? `${base} (forced)` : base;
}

/**
 * HLS audio/subtitle renditions belong to groups referenced by each video
 * variant. Only offering the groups of the chosen variant keeps the request
 * valid (the downloader rejects mismatched groups).
 */
export function audioFor(tracks: AvailableTracksByType, video: VideoTrack | undefined): AudioTrack[] {
  const group = video?.audioGroupId;
  const matching = group === undefined ? [] : tracks.audio.filter(track => track.groupId === group);
  return matching.length > 0 ? matching : tracks.audio;
}

export function textFor(tracks: AvailableTracksByType, video: VideoTrack | undefined): TextTrack[] {
  const group = video?.subtitlesGroupId;
  const matching = group === undefined ? [] : tracks.text.filter(track => track.groupId === group);
  return matching.length > 0 ? matching : tracks.text;
}

/** Standard ≈ the best rendition up to 540p; High = the best available. */
export function defaultChoice(tracks: AvailableTracksByType, preference: VideoQualityPreference): TrackChoice {
  const videos = sortedVideo(tracks);
  const standard = videos.find(track => (track.resolution?.height ?? Number.MAX_SAFE_INTEGER) <= 540) ?? videos[videos.length - 1];
  const picked = preference === 'high' ? videos[0] : standard;
  return { videoId: videos.length > 1 && picked ? picked.id : null, audio: 'all', text: 'all', sidecar: 'all' };
}

/**
 * Converts the choice into DownloadOptions.tracks. With includeAllTracks on,
 * audio and subtitles are always complete, so only the video quality is sent.
 */
export function toTracksRequest(choice: TrackChoice, includeAllTracks: boolean): TracksRequest | undefined {
  const request: TracksRequest = {};
  if (choice.videoId !== null) request.video = [choice.videoId];
  if (!includeAllTracks) {
    if (choice.audio !== 'all') request.audio = [choice.audio];
    if (choice.text === 'off') request.text = [];
    else if (choice.text !== 'all') request.text = [choice.text];
  }
  return Object.keys(request).length > 0 ? request : undefined;
}

export function describeChoice(
  choice: TrackChoice | null,
  tracks: AvailableTracksByType | null,
  includeAllTracks: boolean,
): ChoiceLabels {
  const video = choice?.videoId ? tracks?.video.find(track => track.id === choice.videoId) : undefined;
  const audio = choice && choice.audio !== 'all' ? tracks?.audio.find(track => track.id === choice.audio) : undefined;
  const text =
    choice && choice.text !== 'all' && choice.text !== 'off' ? tracks?.text.find(track => track.id === choice.text) : undefined;
  let subtitles = 'All';
  if (!includeAllTracks && choice?.text === 'off') subtitles = 'Off';
  else if (!includeAllTracks && text) subtitles = languageName(text);
  return {
    quality: video ? qualityName(video) : 'Auto',
    audio: includeAllTracks || !audio ? 'All languages' : languageName(audio),
    subtitles,
  };
}
