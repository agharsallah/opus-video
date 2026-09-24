// Tiny DSP toolkit: buses with panning, filters, noise, envelopes, reverb.
export const SR = 48000;

export const secs = (n) => Math.round(n * SR);

// Deterministic white noise.
export function noiseGen(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => {
    s ^= s << 13; s ^= s >>> 17; s ^= s << 5;
    return ((s >>> 0) / 4294967296) * 2 - 1;
  };
}

// RBJ biquad; `set` can be called per sample for sweeps (cheap enough here).
export function biquad(type = 'lowpass') {
  let b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  const f = {
    set(freq, q = 0.707, gainDb = 0) {
      freq = Math.min(Math.max(freq, 10), SR * 0.45);
      const w = (2 * Math.PI * freq) / SR, cs = Math.cos(w), sn = Math.sin(w);
      const alpha = sn / (2 * q);
      const A = 10 ** (gainDb / 40);
      let n0, n1, n2, d0, d1, d2;
      switch (type) {
        case 'highpass': n0 = (1 + cs) / 2; n1 = -(1 + cs); n2 = (1 + cs) / 2; d0 = 1 + alpha; d1 = -2 * cs; d2 = 1 - alpha; break;
        case 'bandpass': n0 = alpha; n1 = 0; n2 = -alpha; d0 = 1 + alpha; d1 = -2 * cs; d2 = 1 - alpha; break;
        case 'peak': n0 = 1 + alpha * A; n1 = -2 * cs; n2 = 1 - alpha * A; d0 = 1 + alpha / A; d1 = -2 * cs; d2 = 1 - alpha / A; break;
        default: n0 = (1 - cs) / 2; n1 = 1 - cs; n2 = (1 - cs) / 2; d0 = 1 + alpha; d1 = -2 * cs; d2 = 1 - alpha;
      }
      b0 = n0 / d0; b1 = n1 / d0; b2 = n2 / d0; a1 = d1 / d0; a2 = d2 / d0;
      return f;
    },
    run(x) {
      const y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
      x2 = x1; x1 = x; y2 = y1; y1 = y;
      return y;
    },
  };
  return f;
}

export const env = {
  // Attack then exponential decay.
  perc: (t, a, d) => (t < 0 ? 0 : t < a ? t / a : Math.exp(-(t - a) / d)),
  // Linear attack/sustain/release over a total duration.
  asr: (t, a, dur, r) => (t < 0 || t > dur ? 0 : Math.min(1, t / a, (dur - t) / r)),
  hump: (t, dur) => (t < 0 || t > dur ? 0 : Math.sin((Math.PI * t) / dur) ** 2),
};

// A stereo bus. Signals are mono Float32Arrays placed at a time with gain,
// equal-power pan, optional pan sweep (panTo) or pan LFO (panLfo, in Hz).
export class Bus {
  constructor(seconds) {
    this.n = secs(seconds);
    this.L = new Float32Array(this.n);
    this.R = new Float32Array(this.n);
  }

  add(sig, t, { gain = 1, pan = 0, panTo = null, panLfo = 0 } = {}) {
    const o = secs(t);
    const len = sig.length;
    for (let i = 0; i < len; i++) {
      const j = o + i;
      if (j < 0 || j >= this.n) continue;
      let p = pan;
      if (panTo != null) p = pan + (panTo - pan) * (i / len);
      if (panLfo) p = Math.sin((2 * Math.PI * panLfo * i) / SR) * 0.8;
      const a = ((Math.max(-1, Math.min(1, p)) + 1) * Math.PI) / 4;
      const v = sig[i] * gain;
      this.L[j] += v * Math.cos(a);
      this.R[j] += v * Math.sin(a);
    }
  }

  addStereo(other, gain = 1) {
    for (let i = 0; i < this.n; i++) { this.L[i] += other.L[i] * gain; this.R[i] += other.R[i] * gain; }
  }
}

// Freeverb-style reverb (8 combs + 4 allpasses per channel).
export function reverb(bus, { room = 0.84, damp = 0.3, wet = 1 } = {}) {
  const combT = [1116, 1188, 1277, 1356, 1422, 1491, 1557, 1617].map((v) => Math.round(v * SR / 44100));
  const apT = [556, 441, 341, 225].map((v) => Math.round(v * SR / 44100));
  const out = new Bus(bus.n / SR);
  for (const [src, dst, spread] of [[bus.L, out.L, 0], [bus.R, out.R, 23]]) {
    const combs = combT.map((n) => ({ buf: new Float32Array(n + spread), i: 0, store: 0 }));
    const aps = apT.map((n) => ({ buf: new Float32Array(n + spread), i: 0 }));
    for (let s = 0; s < src.length; s++) {
      const x = src[s] * 0.015;
      let y = 0;
      for (const c of combs) {
        const o = c.buf[c.i];
        c.store = o * (1 - damp) + c.store * damp;
        c.buf[c.i] = x + c.store * room;
        if (++c.i >= c.buf.length) c.i = 0;
        y += o;
      }
      for (const a of aps) {
        const b = a.buf[a.i];
        a.buf[a.i] = y + b * 0.5;
        y = b - y;
        if (++a.i >= a.buf.length) a.i = 0;
      }
      dst[s] = y * wet;
    }
  }
  return out;
}

// Ping-pong echo, returns a new bus.
export function echo(bus, { time = 0.375, feedback = 0.35, tone = 3500 } = {}) {
  const out = new Bus(bus.n / SR);
  const d = secs(time);
  const lpL = biquad().set(tone), lpR = biquad().set(tone);
  // Wet only: the left tap hears the input, the right tap hears the left.
  for (let i = d; i < bus.n; i++) {
    out.L[i] = lpL.run((bus.L[i - d] + bus.R[i - d]) * 0.5 + out.R[i - d] * feedback);
    out.R[i] = lpR.run(out.L[i - d] * feedback + (bus.L[i - d] + bus.R[i - d]) * 0.15);
  }
  return out;
}
