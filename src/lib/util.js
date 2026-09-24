// Small shared helpers: tempo grid, easing, deterministic randomness.

export const BPM = 120;
export const BEAT = 60 / BPM; // 0.5 s
export const BAR = BEAT * 4; // 2 s
export const b = (n) => n * BEAT; // beats -> seconds

export const clamp = (v, lo = 0, hi = 1) => (v < lo ? lo : v > hi ? hi : v);
export const lerp = (a, c, t) => a + (c - a) * t;
export const invLerp = (a, c, v) => clamp((v - a) / (c - a));
export const smooth = (t) => { t = clamp(t); return t * t * (3 - 2 * t); };

export const ease = {
  inQuad: (t) => clamp(t) ** 2,
  outQuad: (t) => 1 - (1 - clamp(t)) ** 2,
  outCubic: (t) => 1 - (1 - clamp(t)) ** 3,
  inCubic: (t) => clamp(t) ** 3,
  inOutCubic: (t) => { t = clamp(t); return t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2; },
  inOutSine: (t) => -(Math.cos(Math.PI * clamp(t)) - 1) / 2,
  outBack: (t, s = 1.9) => { t = clamp(t) - 1; return t * t * ((s + 1) * t + s) + 1; },
  inBack: (t, s = 1.7) => { t = clamp(t); return t * t * ((s + 1) * t - s); },
  outElastic: (t) => {
    t = clamp(t);
    if (t === 0 || t === 1) return t;
    return 2 ** (-10 * t) * Math.sin((t * 10 - 0.75) * ((2 * Math.PI) / 3)) + 1;
  },
};

// A damped spring "boing": 0 at t=0 settling to 1.
export function spring(t, freq = 3.2, damp = 5.5) {
  if (t <= 0) return 0;
  return 1 - Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t);
}

// Squash & stretch after an impact at t=0: returns [sx, sy].
export function squash(t, amount = 0.22, freq = 4, damp = 7) {
  if (t < 0) return [1, 1];
  const k = amount * Math.exp(-damp * t) * Math.cos(2 * Math.PI * freq * t);
  return [1 + k, 1 - k];
}

// Deterministic hash noise.
export function hash(...n) {
  let h = 2166136261;
  for (const v of n) {
    h ^= Math.floor(v * 1000003) | 0;
    h = Math.imul(h, 16777619);
    h ^= h >>> 13;
  }
  return ((h >>> 0) % 100000) / 100000;
}

export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) % 1e9) / 1e9;
  };
}

// Smooth 1D value noise in [-1, 1].
export function noise1(x, seed = 0) {
  const i = Math.floor(x), f = x - i;
  const a = hash(i, seed) * 2 - 1, c = hash(i + 1, seed) * 2 - 1;
  return lerp(a, c, f * f * (3 - 2 * f));
}

// Point on a cubic bezier.
export function bezier(p0, p1, p2, p3, t) {
  const u = 1 - t;
  return [
    u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
    u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1],
  ];
}

// Pentatonic / diatonic helpers shared by the music and the visuals.
export const NOTE = (name) => {
  const m = /^([A-G])(#|b)?(-?\d)$/.exec(name);
  const base = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 }[m[1]];
  const acc = m[2] === '#' ? 1 : m[2] === 'b' ? -1 : 0;
  return 12 * (Number(m[3]) + 1) + base + acc; // MIDI number
};
export const mtof = (m) => 440 * 2 ** ((m - 69) / 12);
