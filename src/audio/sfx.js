// Cartoon sound effects, all synthesised. Each takes the cue object
// ({ pitch, dur, note, ... }) and returns a mono Float32Array.
import { SR, secs, biquad, noiseGen, env } from './dsp.js';
import { glock, musicbox, pluck, marimba, cymbal, woodblock, clap, pad } from './instruments.js';
import { NOTE, mtof } from '../lib/util.js';

const TAU = Math.PI * 2;

function make(dur, fn) {
  const n = secs(dur);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = fn(i / SR, i);
  return out;
}

// Oscillator with a time-varying frequency (phase accumulated).
function osc(dur, freqAt, ampAt, shape = 'sine') {
  let p = 0;
  return make(dur, (t) => {
    p += freqAt(t) / SR;
    const ph = p % 1;
    const v = shape === 'saw' ? ph * 2 - 1 : shape === 'square' ? (ph < 0.5 ? 1 : -1) : shape === 'tri' ? 1 - 4 * Math.abs(ph - 0.5) : Math.sin(TAU * p);
    return v * ampAt(t);
  });
}

function filter(sig, type, fAt, q = 1) {
  const f = biquad(type);
  for (let i = 0; i < sig.length; i++) {
    if (i % 16 === 0) f.set(fAt(i / SR), q);
    sig[i] = f.run(sig[i]);
  }
  return sig;
}

function concat(...parts) {
  const n = parts.reduce((a, [, o, s]) => Math.max(a, secs(o) + s.length), 0);
  const out = new Float32Array(n);
  for (const [g, o, s] of parts) { const b = secs(o); for (let i = 0; i < s.length; i++) out[b + i] += s[i] * g; }
  return out;
}

function noise(dur, seed, ampAt) {
  const r = noiseGen(seed);
  return make(dur, (t) => r() * ampAt(t));
}

// Formant "voice": saw through two band-passes (vowel colour).
function voice(dur, freqAt, f1At, f2At, ampAt) {
  const src = osc(dur, freqAt, ampAt, 'saw');
  const a = filter(Float32Array.from(src), 'bandpass', f1At, 5);
  const b = filter(Float32Array.from(src), 'bandpass', f2At, 7);
  return a.map((v, i) => v * 1.6 + b[i] * 1.0);
}

const P = (c) => c.pitch ?? 1;

export const SFX = {
  pop: (c) => concat(
    [1, 0, osc(0.08, (t) => (380 + 1600 * Math.min(1, t / 0.03)) * P(c), (t) => env.perc(t, 0.002, 0.025))],
    [0.3, 0, noise(0.01, 3, (t) => 1 - t / 0.01)],
  ),
  popNote: (c) => concat([0.7, 0, SFX.pop({ pitch: 1.2 })], [0.8, 0, glock(mtof(NOTE(c.note)), { dur: 0.9 })]),
  boop: (c) => osc(0.16, (t) => (620 - 320 * Math.min(1, t / 0.12)) * P(c), (t) => env.perc(t, 0.01, 0.05)),
  boing: (c) => {
    const f0 = 180 * P(c);
    return osc(0.75, (t) => f0 * (1 + 1.2 * Math.min(1, t / 0.06)) * (1 + 0.14 * Math.sin(TAU * 16 * t) * Math.exp(-t * 3)),
      (t) => env.perc(t, 0.005, 0.22) * 0.9, 'tri');
  },
  tweet: (c) => {
    const chirp = (f0, f1, d) => osc(d, (t) => (f0 + (f1 - f0) * (t / d)) * P(c) * (1 + 0.05 * Math.sin(TAU * 60 * t)), (t) => env.hump(t, d));
    return concat([0.7, 0, chirp(2600, 4200, 0.07)], [0.7, 0.1, chirp(2800, 4500, 0.06)], [0.6, 0.19, chirp(4400, 2600, 0.11)]);
  },
  cheep: (c) => osc(0.12, (t) => (4300 - 1600 * t / 0.12) * P(c), (t) => env.hump(t, 0.12) * 0.7),
  chirp: (c) => {
    // Cricket: bursts of a pulsed high tone.
    return osc(0.6, () => 4600 * P(c), (t) => (Math.sin(TAU * 32 * t) > 0 ? 1 : 0) * (t % 0.2 < 0.14 ? 1 : 0) * 0.35);
  },
  squeak: (c) => osc(0.22, (t) => (1800 + 900 * Math.sin(Math.PI * t / 0.22)) * P(c) * (1 + 0.04 * Math.sin(TAU * 30 * t)), (t) => env.hump(t, 0.22) * 0.6),
  hoot: (c) => {
    const h = (f, d) => concat(
      [1, 0, osc(d, (t) => f * P(c) * (1 - 0.06 * t / d), (t) => env.hump(t, d))],
      [0.25, 0, filter(noise(d, 7, (t) => env.hump(t, d)), 'lowpass', () => 900)],
    );
    return concat([0.8, 0, h(430, 0.28)], [0.7, 0.36, h(400, 0.42)]);
  },
  yip: (c) => voice(0.16, (t) => (700 + 500 * Math.sin(Math.PI * t / 0.16)) * P(c), () => 1400, () => 2600, (t) => env.hump(t, 0.16) * 0.5),
  meow: (c) => voice(0.62, (t) => (480 + 300 * Math.sin(Math.PI * Math.min(1, t / 0.5))) * P(c) * (1 + 0.02 * Math.sin(TAU * 7 * t)),
    (t) => 700 + 900 * Math.sin(Math.PI * Math.min(1, t / 0.55)), (t) => 1900 + 700 * Math.sin(Math.PI * Math.min(1, t / 0.55)),
    (t) => env.asr(t, 0.05, 0.62, 0.2) * 0.45),
  quack: (c) => {
    const q = (d) => voice(d, (t) => (260 - 80 * t / d) * P(c), () => 1100, () => 2500, (t) => env.asr(t, 0.01, d, 0.05) * 0.55);
    return concat([1, 0, q(0.16)], [0.85, 0.2, q(0.13)]);
  },
  heehaw: (c) => {
    const hee = (o) => [1, o, voice(0.24, (t) => (820 + 60 * t) * P(c), () => 900, () => 2900, (t) => env.asr(t, 0.02, 0.24, 0.05) * 0.4)];
    const haw = (o) => [1, o, voice(0.34, (t) => (330 - 60 * t) * P(c), () => 750, () => 1200, (t) => env.asr(t, 0.03, 0.34, 0.08) * 0.5)];
    return concat(hee(0), haw(0.25), hee(0.62), haw(0.87));
  },
  buzz: (c) => {
    const d = c.dur ?? 2;
    const s = osc(d, (t) => 185 * (1 + 0.04 * Math.sin(TAU * 5.5 * t)) * (1 + 0.1 * Math.sin(TAU * 0.4 * t)), (t) => env.asr(t, 0.3, d, 0.4) * (0.8 + 0.2 * Math.sin(TAU * 38 * t)), 'saw');
    return filter(s, 'bandpass', (t) => 900 + 300 * Math.sin(TAU * 0.3 * t), 1.2).map((v) => v * 1.6);
  },
  flutter: (c) => {
    const d = c.dur ?? 1;
    const s = noise(d, 21, (t) => env.asr(t, 0.1, d, 0.2) * (0.5 + 0.5 * Math.sin(TAU * 22 * t)) ** 3);
    return filter(filter(s, 'highpass', () => 700), 'lowpass', () => 4200).map((v) => v * 0.9);
  },
  whoosh: (c) => {
    const d = 0.7 / P(c);
    const s = noise(d, 31, (t) => env.hump(t, d));
    return filter(s, 'bandpass', (t) => 300 + 2600 * Math.sin(Math.PI * t / d) ** 2, 0.8).map((v) => v * 1.6);
  },
  puff: (c) => filter(noise(0.35, 41, (t) => env.perc(t, 0.03, 0.08)), 'lowpass', (t) => 1200 * P(c) * (1 - t)).map((v) => v * 1.2),
  scribble: (c) => {
    // Pen on paper: a stream of short strokes of band-passed scratch.
    const d = c.dur ?? 1;
    const r = noiseGen(55);
    const strokes = [];
    for (let s = 0; s < d; s += 0.06 + Math.abs(r()) * 0.12) strokes.push([s, 0.05 + Math.abs(r()) * 0.12, 0.5 + Math.abs(r()) * 0.5]);
    const amp = (t) => strokes.reduce((a, [o, l, g]) => a + (t >= o && t < o + l ? env.hump(t - o, l) * g : 0), 0);
    const s = noise(d, 57, amp);
    return filter(filter(s, 'bandpass', (t) => 2600 + 1400 * Math.sin(t * 17), 0.9), 'highpass', () => 1200).map((v) => v * 1.4);
  },
  pageTurn: () => filter(noise(0.6, 61, (t) => env.hump(t, 0.6) * (0.7 + 0.3 * Math.sin(TAU * 40 * t))), 'bandpass', (t) => 800 + 3000 * t, 0.7).map((v) => v * 1.3),
  shimmer: () => {
    const notes = ['C7', 'G6', 'E7', 'A6', 'D7', 'C7', 'G7', 'E7'];
    return concat(...notes.map((n, i) => [0.35, i * 0.07, glock(mtof(NOTE(n)), { dur: 1.2 })]));
  },
  tick: () => concat([0.6, 0, osc(0.02, () => 3200, (t) => 1 - t / 0.02)], [0.4, 0, noise(0.008, 71, (t) => 1 - t / 0.008)]),
  riser: (c) => {
    const d = c.dur ?? 1;
    const s = noise(d, 81, (t) => (t / d) ** 2);
    const sweep = filter(s, 'bandpass', (t) => 400 + 6000 * (t / d) ** 2, 1.5);
    const tone = osc(d, (t) => 200 + 1400 * (t / d) ** 2, (t) => (t / d) ** 2 * 0.25, 'tri');
    return sweep.map((v, i) => v * 1.4 + tone[i]);
  },
  boom: () => concat(
    [1, 0, osc(0.9, (t) => 40 + 70 * Math.exp(-t / 0.08), (t) => env.perc(t, 0.003, 0.3))],
    [0.5, 0, cymbal({ dur: 2 })],
  ),
  grow: (c) => {
    const f = mtof(NOTE(c.note));
    return concat(
      [0.5, 0, osc(0.22, (t) => f * 0.5 * (1 + Math.min(1, t / 0.2)), (t) => env.hump(t, 0.22), 'tri')],
      [0.8, 0.14, marimba(f, { dur: 0.8 })],
    );
  },
  zip: () => {
    const d = 0.45;
    return concat(
      [0.5, 0, osc(d, (t) => 600 + 2400 * Math.sin(Math.PI * t / d), (t) => env.hump(t, d) * (0.6 + 0.4 * Math.sin(TAU * 70 * t)), 'saw').map((v) => v * 0.4)],
      [0.5, 0, filter(noise(d, 91, (t) => env.hump(t, d)), 'bandpass', (t) => 1500 + 4000 * t / d, 2)],
    );
  },
  step: (c) => woodblock(700 * P(c), { amp: 0.9 }),
  hup: () => voice(0.14, (t) => 230 + 120 * t / 0.14, () => 700, () => 1200, (t) => env.asr(t, 0.01, 0.14, 0.05) * 0.6),
  gasp: () => filter(noise(0.35, 101, (t) => env.asr(t, 0.25, 0.35, 0.08)), 'bandpass', (t) => 900 + 1200 * t, 3).map((v) => v * 1.5),
  wave: () => {
    const d = 2.2;
    const crash = filter(noise(d, 111, (t) => env.perc(t, 0.25, 0.6)), 'lowpass', (t) => 400 + 5000 * Math.min(1, t / 0.3) * Math.exp(-t / 1.2), 0.7);
    const rumble = osc(d, (t) => 50 + 10 * Math.sin(t * 7), (t) => env.perc(t, 0.2, 0.7) * 0.5);
    return crash.map((v, i) => v * 1.8 + rumble[i]);
  },
  splash: () => concat(
    [1, 0, filter(noise(0.8, 121, (t) => env.perc(t, 0.01, 0.18)), 'highpass', () => 1500)],
    ...[0.1, 0.18, 0.3, 0.42].map((o, i) => [0.4, o, SFX.bloop({ pitch: 1 + i * 0.3 })]),
  ),
  bubbles: (c) => {
    const d = c.dur ?? 1.5;
    const r = noiseGen(131);
    const parts = [];
    for (let o = 0; o < d; o += 0.05 + Math.abs(r()) * 0.15) parts.push([0.3 + Math.abs(r()) * 0.3, o, SFX.bloop({ pitch: 1 + Math.abs(r()) * 1.5 })]);
    return concat(...parts);
  },
  bloop: (c) => osc(0.1, (t) => (220 + 700 * (t / 0.1) ** 2) * P(c), (t) => env.hump(t, 0.1) * 0.8),
  blub: (c) => osc(0.14, (t) => (140 + 260 * t / 0.14) * P(c), (t) => env.hump(t, 0.14)),
  swish: () => filter(noise(0.8, 141, (t) => env.hump(t, 0.8)), 'bandpass', (t) => 500 + 900 * Math.sin(Math.PI * t / 0.8), 1).map((v) => v * 1.2),
  harp: (c) => {
    const notes = ['C5', 'E5', 'G5', 'A5', 'C6', 'E6', 'G6', 'A6'];
    return concat(...notes.map((n, i) => [0.4, i * (c.dur ?? 1) / 10, pluck(mtof(NOTE(n)), { dur: 1.4, bright: 0.8, seed: i })]));
  },
  blush: () => concat(...['E6', 'G6', 'C7'].map((n, i) => [0.4, i * 0.05, glock(mtof(NOTE(n)), { dur: 0.8 })])),
  sadTrombone: () => {
    const notes = [['D4', 0, 0.32], ['C#4', 0.36, 0.32], ['C4', 0.72, 0.32], ['B3', 1.08, 0.9]];
    return concat(...notes.map(([n, o, d], k) => {
      const f = mtof(NOTE(n));
      const s = osc(d, (t) => f * (1 + (k === 3 ? 0.03 * Math.sin(TAU * 6 * t) : 0)), (t) => env.asr(t, 0.04, d, 0.08) * 0.5, 'saw');
      return [0.9, o, filter(s, 'lowpass', (t) => 500 + 1500 * Math.sin(Math.PI * Math.min(1, t / d)), 3)];
    }));
  },
  kiss: () => concat(
    [0.6, 0, noise(0.02, 151, (t) => 1 - t / 0.02)],
    [0.9, 0.02, osc(0.22, (t) => 900 - 500 * t / 0.22, (t) => env.hump(t, 0.22) * 0.7)],
  ),
  splashUp: () => concat(
    [0.8, 0, filter(noise(0.9, 161, (t) => env.perc(t, 0.05, 0.25)), 'bandpass', (t) => 800 + 3000 * t, 0.8)],
    [0.5, 0.05, SFX.bubbles({ dur: 0.6 })],
  ),
  seagulls: () => {
    const cry = (o, p) => [0.6, o, voice(0.34, (t) => (1500 - 600 * t / 0.34) * p, () => 1800, () => 3200, (t) => env.hump(t, 0.34) * 0.35)];
    return concat(cry(0, 1), cry(0.4, 0.92), cry(1.3, 1.08));
  },
  nightfall: (c) => {
    const d = c.dur ?? 1.3;
    const notes = ['A6', 'G6', 'E6', 'D6', 'C6', 'A5', 'G5', 'E5'];
    return concat(
      ...notes.map((n, i) => [0.3, i * d / notes.length, glock(mtof(NOTE(n)), { dur: 1.4 })]),
      [0.3, 0, filter(noise(d + 0.5, 171, (t) => env.hump(t, d + 0.5)), 'lowpass', () => 700)],
    );
  },
  twinkle: (c) => glock(mtof(NOTE(c.note)) * 2, { dur: 0.8, amp: 0.7 }),
  musicbox: (c) => musicbox(mtof(NOTE(c.note))),
  snore: () => {
    // Inhale: rumbly noise; exhale: a little whistle.
    const inhale = filter(noise(0.8, 181, (t) => env.asr(t, 0.5, 0.8, 0.2) * (0.6 + 0.4 * Math.sin(TAU * 28 * t))), 'lowpass', () => 500);
    const whistle = osc(0.6, (t) => 900 - 300 * t / 0.6, (t) => env.hump(t, 0.6) * 0.3);
    return concat([1.4, 0, inhale], [0.8, 0.85, whistle]);
  },
  shootingStar: () => concat(
    ...['C8', 'A7', 'G7', 'E7', 'D7', 'C7', 'A6'].map((n, i) => [0.3, i * 0.07, glock(mtof(NOTE(n)), { dur: 0.9 })]),
    [0.5, 0, SFX.whoosh({ pitch: 1.4 })],
  ),
  sunrise: () => concat(
    [0.7, 0, cymbal({ dur: 0.6, swell: true })],
    [0.5, 0.55, cymbal({ dur: 2 })],
    [0.5, 0.5, SFX.shimmer()],
  ),
  confetti: () => {
    const r = noiseGen(191);
    return concat(...Array.from({ length: 16 }, (_, i) => [0.25, Math.abs(r()) * 0.6, SFX.pop({ pitch: 1 + Math.abs(r()) * 1.2 })]), [0.6, 0, cymbal({ dur: 2.5 })]);
  },
  hooray: () => {
    // A tiny crowd of chipmunk "yaaay"s plus claps.
    const r = noiseGen(201);
    const voices = Array.from({ length: 6 }, (_, i) => {
      const f = 380 + Math.abs(r()) * 380;
      return [0.35, Math.abs(r()) * 0.08, voice(0.7, (t) => f * (1 + 0.25 * Math.min(1, t / 0.2)) * (1 + 0.02 * Math.sin(TAU * 6 * t + i)),
        (t) => 800 + 500 * Math.min(1, t / 0.3), () => 2200 + i * 80, (t) => env.asr(t, 0.05, 0.7, 0.25) * 0.35)];
    });
    const claps = Array.from({ length: 10 }, (_, i) => [0.4, i * 0.07 + Math.abs(r()) * 0.03, clap({ seed: i + 3 })]);
    return concat(...voices, ...claps);
  },
  drumroll: (c) => {
    const d = c.dur ?? 0.5;
    const hits = [];
    for (let o = 0; o < d; o += 0.035) hits.push([0.2 + 0.6 * (o / d), o, clap({ amp: 0.6, seed: Math.round(o * 1000) })]);
    return concat(...hits);
  },
  iris: (c) => {
    const d = c.dur ?? 1.2;
    return osc(d, (t) => 1800 * (1 - 0.75 * (t / d)) * (1 + 0.02 * Math.sin(TAU * 7 * t)), (t) => env.asr(t, 0.05, d, 0.15) * 0.35);
  },
  ding: () => concat(
    [0.6, 0, glock(mtof(NOTE('C6')), { dur: 2.5 })],
    [0.4, 0.02, glock(mtof(NOTE('E6')), { dur: 2.5 })],
    [0.4, 0.04, glock(mtof(NOTE('G6')), { dur: 2.5 })],
    [0.3, 0.06, glock(mtof(NOTE('C7')), { dur: 2.5 })],
  ),
  pluck: (c) => concat(
    [0.9, 0, pluck(mtof(NOTE(c.note)), { dur: 1.4, bright: 0.75, seed: NOTE(c.note) })],
    [0.35, 0, glock(mtof(NOTE(c.note)), { dur: 1.0 })],
  ),
  pad: (c) => pad(c.notes.map((n) => mtof(NOTE(n))), c.dur ?? 1),
};
