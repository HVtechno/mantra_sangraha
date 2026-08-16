import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  frameEnergy, silenceRuns, boundariesFromSilence, evenSplit, currentLineIndex,
} from '../lib/align.js';

// Build a synthetic mono signal: N "spoken" lines separated by silent gaps.
function synth({ sampleRate = 8000, lineDur = 1.0, gapDur = 0.3, lines = 4, lead = 0.2, tail = 0.2 }) {
  const total = lead + tail + lines * lineDur + (lines - 1) * gapDur;
  const samples = new Float32Array(Math.round(total * sampleRate));
  let t = lead;
  const cuts = [];
  for (let i = 0; i < lines; i++) {
    const start = Math.round(t * sampleRate);
    const end = Math.round((t + lineDur) * sampleRate);
    for (let s = start; s < end; s++) samples[s] = 0.6 * Math.sin((2 * Math.PI * 220 * s) / sampleRate);
    t += lineDur;
    if (i < lines - 1) { cuts.push(t + gapDur / 2); t += gapDur; }
  }
  return { samples, sampleRate, duration: total, expectedCuts: cuts };
}

test('silence segmentation finds the right line boundaries', () => {
  const { samples, sampleRate, duration, expectedCuts } = synth({ lines: 4 });
  const { energy, frameDur } = frameEnergy(samples, sampleRate);
  const runs = silenceRuns(energy, frameDur);
  const res = boundariesFromSilence(runs, duration, 4);

  assert.equal(res.ok, true, 'should succeed with clear gaps');
  assert.equal(res.method, 'silence');
  assert.equal(res.segments.length, 4, 'four lines -> four segments');

  // internal cuts should land near the gap centres (within 120ms)
  for (let i = 0; i < expectedCuts.length; i++) {
    const cut = res.segments[i].end;
    assert.ok(Math.abs(cut - expectedCuts[i]) < 0.12,
      `cut ${i} ~ ${expectedCuts[i].toFixed(2)}s, got ${cut.toFixed(2)}s`);
  }
  // segments are contiguous and cover the content
  for (let i = 1; i < res.segments.length; i++) {
    assert.equal(res.segments[i].start, res.segments[i - 1].end);
  }
});

test('falls back to even split when there are no clear gaps', () => {
  const { samples, sampleRate, duration } = synth({ lines: 1, lineDur: 4, gapDur: 0 });
  const { energy, frameDur } = frameEnergy(samples, sampleRate);
  const runs = silenceRuns(energy, frameDur);
  const res = boundariesFromSilence(runs, duration, 5); // ask for more lines than gaps
  assert.equal(res.ok, false);
  assert.equal(res.method, 'even-fallback');
  assert.equal(res.segments.length, 5);
});

test('evenSplit + currentLineIndex behave', () => {
  const segs = evenSplit(10, 5);
  assert.equal(segs.length, 5);
  assert.equal(segs[0].start, 0);
  assert.equal(segs[4].end, 10);
  assert.equal(currentLineIndex(segs, -1), -1);
  assert.equal(currentLineIndex(segs, 0), 0);
  assert.equal(currentLineIndex(segs, 4.5), 2);
  assert.equal(currentLineIndex(segs, 9.9), 4);
});
