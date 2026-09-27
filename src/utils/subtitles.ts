export interface Cue {
  start: number;
  end: number;
  text: string;
}

// hh:mm:ss,mmm (SRT) or [hh:]mm:ss.mmm (WebVTT). Some SRT files use "->" instead of "-->".
const TIME = String.raw`((?:\d{1,2}:)?\d{1,2}:\d{2}[.,]\d{1,3})`;
const TIMING = new RegExp(`${TIME}\\s*-+>\\s*${TIME}`);

function seconds(stamp: string): number {
  const [clock = '0', fraction = '0'] = stamp.split(/[.,]/);
  const parts = clock.split(':').map(Number);
  const [h, m, s] = parts.length === 3 ? parts : [0, ...parts];
  return (h ?? 0) * 3600 + (m ?? 0) * 60 + (s ?? 0) + Number(fraction.padEnd(3, '0')) / 1000;
}

/** Parses SRT or WebVTT into cues, dropping styling tags such as <i> or {\an8}. */
export function parseSubtitles(source: string): Cue[] {
  const cues: Cue[] = [];
  const blocks = source.replace(/^﻿/, '').replace(/\r\n?/g, '\n').split(/\n{2,}/);
  for (const block of blocks) {
    const lines = block.split('\n');
    const timingIndex = lines.findIndex(line => TIMING.test(line));
    if (timingIndex === -1) continue;
    const match = TIMING.exec(lines[timingIndex] ?? '');
    if (!match?.[1] || !match[2]) continue;
    const text = lines
      .slice(timingIndex + 1)
      .join('\n')
      .replace(/<[^>]+>/g, '')
      .replace(/\{\\[^}]*\}/g, '')
      .trim();
    if (text !== '') cues.push({ start: seconds(match[1]), end: seconds(match[2]), text });
  }
  return cues.sort((a, b) => a.start - b.start);
}

/** The cue showing at `time` (seconds), if any. */
export function cueAt(cues: readonly Cue[], time: number): Cue | undefined {
  let low = 0;
  let high = cues.length - 1;
  while (low <= high) {
    const mid = (low + high) >> 1;
    const cue = cues[mid];
    if (!cue) break;
    if (time < cue.start) high = mid - 1;
    else if (time >= cue.end) low = mid + 1;
    else return cue;
  }
  return undefined;
}
