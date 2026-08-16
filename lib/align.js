// lib/align.js
// Line-level audio alignment that runs entirely in the browser (offline, no
// server). It decodes the recitation, measures loudness over time, and uses the
// pauses between lines as boundaries — reciters almost always pause between
// lines. When the pauses aren't clear enough, it falls back to an even split so
// the highlight never breaks.
//
// The math (everything except decodeToSamples) is pure and unit-tested.

// --- pure signal helpers ---------------------------------------------------

// RMS energy per frame. `samples` is a Float32Array of mono PCM in [-1,1].
export function frameEnergy(samples, sampleRate, frameMs = 20) {
  const frameLen = Math.max(1, Math.round((sampleRate * frameMs) / 1000));
  const n = Math.floor(samples.length / frameLen);
  const energy = new Float32Array(n);
  for (let f = 0; f < n; f++) {
    let sum = 0;
    const base = f * frameLen;
    for (let i = 0; i < frameLen; i++) {
      const s = samples[base + i];
      sum += s * s;
    }
    energy[f] = Math.sqrt(sum / frameLen);
  }
  return { energy, frameDur: frameLen / sampleRate };
}

function percentile(arr, p) {
  if (!arr.length) return 0;
  const sorted = Array.from(arr).sort((a, b) => a - b);
  const idx = Math.min(sorted.length - 1, Math.max(0, Math.round((p / 100) * (sorted.length - 1))));
  return sorted[idx];
}

// Find runs of consecutive silent frames. Returns [{startF,endF,startT,endT,dur,centerT}].
export function silenceRuns(energy, frameDur, opts = {}) {
  const p95 = percentile(energy, 95);
  const thr = opts.threshold != null ? opts.threshold : Math.max(1e-4, p95 * (opts.thresholdRatio || 0.18));
  const minSilence = opts.minSilence != null ? opts.minSilence : 0.16; // seconds
  const runs = [];
  let start = -1;
  for (let i = 0; i < energy.length; i++) {
    const silent = energy[i] < thr;
    if (silent && start === -1) start = i;
    if ((!silent || i === energy.length - 1) && start !== -1) {
      const endF = silent ? i + 1 : i;
      const dur = (endF - start) * frameDur;
      if (dur >= minSilence) {
        const startT = start * frameDur;
        const endT = endF * frameDur;
        runs.push({ startF: start, endF, startT, endT, dur, centerT: (startT + endT) / 2 });
      }
      start = -1;
    }
  }
  return runs;
}

// Turn silence runs into `nLines` [start,end] segments.
// Returns { ok, segments, method }.
export function boundariesFromSilence(runs, duration, nLines, opts = {}) {
  if (nLines <= 1) return { ok: true, segments: [{ start: 0, end: duration }], method: 'single' };

  const edgeGuard = opts.edgeGuard != null ? opts.edgeGuard : 0.25; // ignore silence within this of the ends
  const contentStart = runs.length && runs[0].startT < edgeGuard ? runs[0].endT : 0;
  const last = runs[runs.length - 1];
  const contentEnd = last && duration - last.endT < edgeGuard ? last.startT : duration;

  // internal silence runs (between contentStart and contentEnd)
  const internal = runs.filter((r) => r.centerT > contentStart + 1e-3 && r.centerT < contentEnd - 1e-3);
  if (internal.length < nLines - 1) {
    return { ok: false, segments: evenSplit(duration, nLines), method: 'even-fallback', found: internal.length };
  }

  // pick the (nLines-1) longest pauses, then order them in time
  const chosen = internal
    .slice()
    .sort((a, b) => b.dur - a.dur)
    .slice(0, nLines - 1)
    .sort((a, b) => a.centerT - b.centerT);

  const cuts = chosen.map((r) => r.centerT);
  const segments = [];
  let prev = contentStart;
  for (const c of cuts) {
    segments.push({ start: prev, end: c });
    prev = c;
  }
  segments.push({ start: prev, end: contentEnd });
  return { ok: true, segments, method: 'silence' };
}

export function evenSplit(duration, nLines) {
  const seg = duration / Math.max(1, nLines);
  const out = [];
  for (let i = 0; i < nLines; i++) out.push({ start: i * seg, end: (i + 1) * seg });
  if (out.length) out[out.length - 1].end = duration;
  return out;
}

// Which line index is active at time t (seconds). -1 before the first line.
export function currentLineIndex(segments, t) {
  if (!segments || !segments.length) return -1;
  if (t < segments[0].start) return -1;
  for (let i = segments.length - 1; i >= 0; i--) {
    if (t >= segments[i].start) return i;
  }
  return 0;
}

// --- browser glue ----------------------------------------------------------

// Decode an audio source (Blob/File or same-origin/CORS URL) to mono samples.
export async function decodeToSamples(source) {
  const AC = typeof window !== 'undefined' && (window.AudioContext || window.webkitAudioContext);
  if (!AC) throw new Error('Web Audio not available in this browser.');
  let arrayBuf;
  if (source instanceof Blob) {
    arrayBuf = await source.arrayBuffer();
  } else {
    const res = await fetch(source, { mode: 'cors' });
    if (!res.ok) throw new Error(`Could not load audio (${res.status}).`);
    arrayBuf = await res.arrayBuffer();
  }
  const ctx = new AC();
  try {
    const buf = await ctx.decodeAudioData(arrayBuf);
    // downmix to mono
    const len = buf.length;
    const mono = new Float32Array(len);
    for (let ch = 0; ch < buf.numberOfChannels; ch++) {
      const data = buf.getChannelData(ch);
      for (let i = 0; i < len; i++) mono[i] += data[i];
    }
    if (buf.numberOfChannels > 1) for (let i = 0; i < len; i++) mono[i] /= buf.numberOfChannels;
    return { samples: mono, sampleRate: buf.sampleRate, duration: buf.duration };
  } finally {
    if (ctx.close) ctx.close();
  }
}

// High-level: align `nLines` to an audio source. Returns { segments, method, duration }.
export async function alignLines(source, nLines) {
  const { samples, sampleRate, duration } = await decodeToSamples(source);
  const { energy, frameDur } = frameEnergy(samples, sampleRate);
  const runs = silenceRuns(energy, frameDur);
  const res = boundariesFromSilence(runs, duration, nLines);
  return { segments: res.segments, method: res.method, duration, ok: res.ok };
}
