"""videocreation · soundlib — synthesized music + sound effects + mixdown.

No samples, no network: every instrument and effect is generated with
numpy/scipy, so a soundtrack is a small Python script placed next to the
project (see assets/template/soundtrack.py).

    import sys; sys.path.insert(0, "<skill>/scripts")
    from soundlib import *
    s = Session(dur=60.0, voice="vo_fit.wav", voice_offset=0.1)   # same --offset you gave fit_vo.py
    s.m(boom(), 0.1, -4)                  # music bus: (signal, time s, gain dB)
    tension_bed(s, 3.8, 15.3)             # ready-made patterns take the session
    s.fx(W1, 7.4, -16)                    # sfx bus
    s.section_gain([(3.8, 15.3, 4.5)])    # lift quiet music sections (dB)
    s.mixdown("mix.wav")                  # ducking under voice, limiter, fade
    s.stems([(0, 3.5), (4, 10)])          # print voice/music/sfx RMS per range

Balance targets (what the author approved): music RMS 8-12 dB below the
voice, sfx about the same as music, final file normalised to -14 LUFS by
finalize.py. Always run s.stems(...) and fix any section where music is
louder than voice-8 dB or quieter than voice-14 dB.
"""
import os, wave
import numpy as np
from scipy.signal import butter, sosfilt

SR = 48000
_rng = np.random.default_rng(5)


# ---------------- basics ----------------
def lp(x, f, o=2): return sosfilt(butter(o, f, 'low', fs=SR, output='sos'), x)
def hp(x, f, o=2): return sosfilt(butter(o, f, 'high', fs=SR, output='sos'), x)
def bp(x, lo, hi, o=2): return sosfilt(butter(o, [lo, hi], 'band', fs=SR, output='sos'), x)
def db(d): return 10 ** (d / 20)
def mtof(m): return 440 * 2 ** ((m - 69) / 12)
def nz(n): return _rng.standard_normal(n)
def env_ad(n, a, d):
    e = np.arange(n) / SR
    return np.minimum(1, e / max(a, 1e-4)) * np.exp(-e / d)


def readwav(p):
    w = wave.open(p)
    x = np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float64) / 32768
    if w.getnchannels() == 2:
        x = x.reshape(-1, 2).mean(1)
    if w.getframerate() != SR:
        from scipy.signal import resample_poly
        x = resample_poly(x, SR, w.getframerate())
    return x


def add(buf, x, t, g=1.0):
    i = int(round(t * SR))
    if i < 0: x = x[-i:]; i = 0
    if i >= len(buf): return
    x = x[:len(buf) - i]; buf[i:i + len(x)] += x * g


# ---------------- instruments ----------------
def saw(f, n, det=(0,), harm=10):
    t = np.arange(n) / SR; s = np.zeros(n)
    for d in det:
        ff = f * 2 ** (d / 12)
        for h in range(1, harm + 1):
            if ff * h > SR / 2.2: break
            s += np.sin(2 * np.pi * ff * h * t + h * d) / h
    return s / len(det)


def glide_saw(f0, f1, dur, harm=8):
    """Saw whose pitch slides from f0 to f1 (slow-motion drones)."""
    n = int(dur * SR); t = np.arange(n) / SR
    ph = 2 * np.pi * np.cumsum(f0 + (f1 - f0) * t / dur) / SR
    return sum(np.sin(h * ph) / h for h in range(1, harm + 1))


def kick(g=1.0):
    n = int(.42 * SR); t = np.arange(n) / SR
    f = 46 + 110 * np.exp(-t * 30); ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 7.5) + 0.25 * lp(nz(n), 3000) * np.exp(-t * 120)
    return np.tanh(s * 1.6) * g
def clap(g=1.0):
    n = int(.25 * SR); x = bp(nz(n), 900, 4000); t = np.arange(n) / SR
    e = np.zeros(n)
    for o in (0, .011, .022): e += np.where(t >= o, np.exp(-(t - o) * 60), 0) * (1 if o < .02 else 1.6)
    e += np.where(t > .03, np.exp(-(t - .03) * 18), 0) * .5
    return x * e * g / 3
def hat(g=1.0, d=.035):
    n = int(.12 * SR); return hp(nz(n), 7500) * env_ad(n, .001, d) * g
def crash(g=1.0, d=1.2):
    n = int(2.5 * SR); return hp(nz(n), 4000) * env_ad(n, .002, d) * g
def boom(g=1.0, f0=70):
    """Cinematic low impact - every hook word, every big number."""
    n = int(2.4 * SR); t = np.arange(n) / SR
    f = f0 * np.exp(-t * 1.0) + 34; ph = 2 * np.pi * np.cumsum(f) / SR
    s = np.sin(ph) * np.exp(-t * 2.0) + lp(nz(n), 700) * np.exp(-t * 14) * .6
    return np.tanh(s * 1.4 * np.minimum(1, t / .003)) * g
def braam(root, dur=1.6, g=1.0):
    """Dark brass hit (MIDI root, e.g. 36=C2)."""
    n = int(dur * SR); t = np.arange(n) / SR
    s = saw(mtof(root), n, (-.1, 0, .1), 16) + .7 * saw(mtof(root + 7), n, (-.08, .08), 12) + .6 * saw(mtof(root - 12), n, (0,), 8)
    s = lp(s, 900, 2); s = np.tanh(s * 2.2)
    return s * np.minimum(1, t / .01) * np.exp(-t * 2.0) * g
def pluck(f, d=.5, bright=3):
    n = int(d * SR); t = np.arange(n) / SR
    s = sum(np.sin(2 * np.pi * f * h * t) * (0.55 ** (h - 1)) for h in range(1, bright + 1))
    return s * np.exp(-t * 8) * np.minimum(1, t / .003)
def pad(freqs, dur, cut=1200, a=.6, r=.8):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs: s += saw(f, n, (-.1, .1), 8)
    s = lp(s, cut, 2)
    e = np.minimum(1, t / a) * np.clip((dur - t) / r, 0, 1)
    return s * e / len(freqs)
def riser(dur, g=1.0, f0=300, f1=6000):
    """Noise + tone sweep that ends exactly at t+dur - place it to land on a reveal."""
    n = int(dur * SR); t = np.arange(n) / n
    x = nz(n)
    out = lp(x, f0 * 2) * (1 - t) ** 2 + bp(x, 800, 3000) * np.sin(np.pi * t) + hp(x, 3000) * t ** 2
    tone = np.sin(2 * np.pi * np.cumsum(200 * (8 ** t)) / SR) * .25
    return (out + tone) * (t ** 1.6) * g
def heartbeat(g=1.0):
    n = int(.5 * SR); t = np.arange(n) / SR
    def th(o, a):
        tt2 = np.clip(t - o, 0, None); f = 50 + 40 * np.exp(-tt2 * 25)
        return np.where(t >= o, np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-tt2 * 14) * a, 0)
    return (th(0, 1) + th(.16, .7)) * g
def b808(f, dur=.5, glide=0.0):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + glide * np.minimum(1, t / .08)) * (1 + .8 * np.exp(-t * 60))
    x = np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 3.2) * np.minimum(1, t / .002)
    return np.tanh(x * 2.2) / 1.3
def cowbell(f=540, d=.25):
    n = int(d * SR); t = np.arange(n) / SR
    x = np.sign(np.sin(2 * np.pi * f * t)) + np.sign(np.sin(2 * np.pi * f * 1.48 * t))
    return bp(x, 400, 3000) * np.exp(-t * 14) * .5
def choir(freqs, dur, a=.6, r=.8):
    n = int(dur * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for f in freqs:
        for d in (-.15, 0, .15):
            ff = f * 2 ** (d / 12)
            s += np.sin(2 * np.pi * ff * t + 5 * np.sin(2 * np.pi * 5.2 * t) * .002 * ff) * .6 + np.sin(2 * np.pi * 2 * ff * t) * .15
    s = lp(s, 2200); e = np.minimum(1, t / a) * np.clip((dur - t) / r, 0, 1)
    return s * e / (len(freqs) * 3)
def marimba(f, d=.5):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .25 * np.sin(2 * np.pi * 4 * f * t) * np.exp(-t * 30)) * np.exp(-t * 7) * np.minimum(1, t / .002)
def pizz(f, d=.3):
    n = int(d * SR); t = np.arange(n) / SR
    return lp(saw(f, n, (0,), 8), 1800) * np.exp(-t * 16) * np.minimum(1, t / .002)
def tom(f=110, g=1.0):
    n = int(.5 * SR); t = np.arange(n) / SR; fr = f * (1 + .6 * np.exp(-t * 20))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7) * g
def siren(dur=1.0, f1=960, f2=740, rate=3.0):
    n = int(dur * SR); t = np.arange(n) / SR; f = np.where((t * rate) % 1 < .5, f1, f2)
    ph = 2 * np.pi * np.cumsum(f) / SR
    x = np.sign(np.sin(ph)) * .5 + np.sin(ph) * .5
    return lp(x, 3000) * np.minimum(1, t / .05) * np.clip((dur - t) / .1, 0, 1)


# chord progressions: (bass MIDI, [chord MIDI])
Cm = [(36, [48, 51, 55]), (32, [44, 48, 51]), (29, [41, 44, 48]), (31, [43, 47, 50])]     # dark / villain
Dm = [(38, [50, 53, 57]), (34, [46, 50, 53]), (36, [48, 52, 55]), (33, [45, 49, 52])]     # thoughtful / sneaky
Dmaj = [(38, [50, 54, 57]), (35, [47, 50, 54]), (31, [43, 47, 50]), (33, [45, 49, 52])]   # release / triumph


# ---------------- sound effects ----------------
def mk_whoosh(dur, lo, hi):
    n = int(dur * SR); t = np.arange(n) / n
    x = nz(n); y = lp(x, lo) * (1 - t) + bp(x, lo, hi) * np.sin(np.pi * t) * 1.4 + hp(x, hi) * t
    e = np.sin(np.pi * t) ** 2
    return y * e / np.max(np.abs(y * e))
W1 = mk_whoosh(.32, 400, 3500)   # every scene transition (place 0.05 s before the cut)
W2 = mk_whoosh(.5, 250, 2500)    # big transitions, fly-bys
def pop(f=900, dur=.12):
    n = int(dur * SR); t = np.arange(n) / SR
    fr = f * (1 + .9 * np.exp(-t * 40)); return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 34) * np.minimum(1, t / .002)
def slide(f0, f1, dur):
    n = int(dur * SR); t = np.arange(n) / SR; fr = f0 * (f1 / f0) ** (t / dur)
    ph = 2 * np.pi * np.cumsum(fr) / SR
    return (np.sin(ph) + .25 * np.sin(2 * ph)) * np.sin(np.pi * np.minimum(1, t / dur)) ** .8
def bloop():
    """'Feeling sick' descending wobble."""
    n = int(.32 * SR); t = np.arange(n) / SR
    fr = 520 * np.exp(-t * 3) * (1 + .08 * np.sin(2 * np.pi * 18 * t))
    return np.sin(2 * np.pi * np.cumsum(fr) / SR) * np.exp(-t * 7) * np.minimum(1, t / .004)
def tick():
    n = int(.025 * SR); t = np.arange(n) / SR; return np.sin(2 * np.pi * 2600 * t) * np.exp(-t * 300)
def ting(f=2400, d=.6):
    n = int(d * SR); t = np.arange(n) / SR
    return (np.sin(2 * np.pi * f * t) + .5 * np.sin(2 * np.pi * f * 2.76 * t) + .3 * np.sin(2 * np.pi * f * 5.4 * t)) * np.exp(-t * 6) * np.minimum(1, t / .001)
def chime(base=1568):
    n = int(1.0 * SR); t = np.arange(n) / SR; s = np.zeros(n)
    for j, f in enumerate([base, base * 1.26, base * 1.5, base * 2]):
        d = j * .05; m = t > d; s[m] += np.sin(2 * np.pi * f * (t[m] - d)) * np.exp(-(t[m] - d) * 5)
    return s / 3
def thump(g=1.0):
    """Short punch under every word that slams onto the screen."""
    n = int(.25 * SR); t = np.arange(n) / SR; f = 60 + 90 * np.exp(-t * 30)
    return (np.sin(2 * np.pi * np.cumsum(f) / SR) * np.exp(-t * 16) + .3 * lp(nz(n), 2500) * np.exp(-t * 60)) * g
def shaker():
    n = int(.07 * SR); return hp(nz(n), 3000) * np.exp(-np.arange(n) / SR * 50)
def crunch():
    n = int(.22 * SR); t = np.arange(n) / SR
    return bp(nz(n), 1500, 6000) * (_rng.random(n) > .7) * np.exp(-t * 14)
def hiss(dur):
    n = int(dur * SR); t = np.arange(n) / SR
    return hp(nz(n), 5000) * np.sin(np.pi * t / dur) ** 2
def beep(f=1400, d=.12):
    n = int(d * SR); t = np.arange(n) / SR
    return np.sign(np.sin(2 * np.pi * f * t)) * .4 * np.minimum(1, t / .003) * np.clip((d - t) / .01, 0, 1)
def burst(d, lo, hi, dec):
    """Filtered noise burst: glass shards (2500-8000), chalk taps, steps."""
    n = int(d * SR); return bp(nz(n), lo, hi) * np.exp(-np.arange(n) / SR * dec)
def crackle(dur):
    """Fire crackle."""
    n = int(dur * SR); x = hp(nz(n), 1500) * (_rng.random(n) > .985) * 6
    return x * np.clip((dur - np.arange(n) / SR) / .8, 0, 1)
def lightning():
    n = int(.35 * SR); return hp(nz(n), 2000) * np.exp(-np.arange(n) / SR * 9)
def rumble(dur=2.2):
    n = int(dur * SR); return lp(nz(n), 300) * np.exp(-np.arange(n) / SR * 1.6) * 3


# ---------------- session / mixdown ----------------
class Session:
    def __init__(self, dur, voice=None, voice_offset=0.0, voice_gain_db=-2.5):
        """voice: path to vo_fit.wav. fit_vo.py already shifted cues by --offset,
        so place the voice at that same offset here (voice_offset=<offset>)."""
        self.dur = dur; self.N = int(SR * dur); self.t = np.arange(self.N) / SR
        self.voice = np.zeros(self.N); self.mus = np.zeros(self.N); self.sfx = np.zeros(self.N)
        self.sec = np.ones(self.N)
        if voice:
            v = readwav(voice)
            v = hp(v, 80); v = v + 0.22 * bp(v, 2500, 7000)                      # presence
            env = np.abs(lp(np.abs(v), 12)); v = v * np.minimum(1, (0.25 / (env + 1e-6)) ** 0.35)  # gentle compression
            v = v / (np.max(np.abs(v)) + 1e-9) * db(voice_gain_db)
            add(self.voice, v, voice_offset)
        self.venv = np.clip(lp(np.abs(self.voice), 6) * 6, 0, 1)

    def m(self, x, t, gdb=0.0): add(self.mus, x, t, db(gdb))
    def fx(self, x, t, gdb=0.0): add(self.sfx, x, t, db(gdb))

    def section_gain(self, ranges, default_db=0.0):
        """[(t0, t1, dB), ...] - lift or cut whole music sections smoothly."""
        sec = np.full(self.N, db(default_db))
        for a0, a1, g in ranges:
            sec[(self.t >= a0) & (self.t < a1)] = db(g)
        self.sec = lp(sec, 3)

    def mixdown(self, out, music_db=-14.0, sfx_db=-2.0, duck=.6, fade=.6):
        mus = self.mus * self.sec * (1 - duck * self.venv)
        mus = np.tanh(mus * 1.2) / 1.2
        sfx = np.tanh(self.sfx)
        self._m, self._s = mus * db(music_db), sfx * db(sfx_db)
        mix = self.voice + self._m + self._s
        mix = mix / (np.max(np.abs(mix)) + 1e-9) * .97
        mix = np.tanh(mix * 1.15) / np.tanh(1.15) * .95
        mix *= np.clip((self.dur - self.t) / fade, 0, 1)
        o = (np.clip(np.stack([mix, mix], 1), -1, 1) * 32767).astype(np.int16)
        with wave.open(out, "wb") as w:
            w.setnchannels(2); w.setsampwidth(2); w.setframerate(SR); w.writeframes(o.tobytes())
        print("wrote", out)

    def stems(self, ranges):
        def rms(x, a, b):
            s = x[int(a * SR):int(b * SR)]; return 20 * np.log10(np.sqrt(np.mean(s ** 2)) + 1e-9)
        print("   range        voice   music   sfx   (target: music 8-12 dB under voice)")
        for a, b in ranges:
            v, m, s = rms(self.voice, a, b), rms(self._m, a, b), rms(self._s, a, b)
            flag = "  <-- music too loud" if m > v - 7 else ("  <-- music too quiet" if m < v - 14 else "")
            print(f"  {a:6.1f}-{b:6.1f}  {v:6.1f}  {m:6.1f}  {s:6.1f}{flag}")


# ---------------- ready-made patterns ----------------
def hook_hits(s, times, root=38, gdb=-4):
    """Boom + braam on every slammed hook word."""
    for i, t0 in enumerate(times):
        s.m(boom(), t0, gdb - i); s.m(braam(root if i < 2 else root - 2, 1.4), t0, gdb - 10 - i)


def tension_bed(s, t0, t1, bpm=100, kick_from=None):
    """Low drone + clock ticking + minor plucks (story setup)."""
    n = int((t1 - t0) * SR); td = np.arange(n) / SR
    dr = saw(mtof(38), n, (-.08, .08), 10) + .6 * saw(mtof(45), n, (-.06, .06), 8)
    s.m(lp(dr, 600) * np.minimum(1, td / 1.0) * np.clip((t1 - t0 - td) / .2, 0, 1), t0, -22)
    st = 60 / bpm / 2; k = 0; t = t0 + .1; arp = [62, 65, 69, 65, 62, 65, 70, 65]
    while t < t1 - .1:
        s.m(pluck(mtof(arp[k % 8]), .4), t, -24)
        if k % 2 == 0: s.m(hat(1, .02), t, -24)
        if kick_from is not None and t > kick_from and k % 4 == 0: s.m(kick(.7), t, -16)
        t += st; k += 1


def heartbeat_run(s, t0, t1, bpm0=72, bpm1=180, gdb=-9):
    """Accelerating heartbeat - the 'it is getting worse' build."""
    t = t0
    while t < t1:
        bpm = bpm0 + (bpm1 - bpm0) * ((t - t0) / (t1 - t0)) ** 1.4
        s.m(heartbeat(), t, gdb); t += 60 / bpm


def groove(s, t0, t1, bpm, prog, inst='marimba', kickg=-14, hatg=-26, clapg=None, instg=-22, oct_=24):
    """Light groove: marimba (playful, major) or pizz (sneaky, minor)."""
    B = 60 / bpm; t = t0; k = 0
    while t < t1 - 1e-6:
        root, ch = prog[int(k // 4) % len(prog)]
        if k % 2 == 0 and kickg is not None: s.m(kick(.8), t, kickg)
        if clapg is not None and k % 4 == 2: s.m(clap(.7), t, clapg)
        if hatg is not None: s.m(hat(.6), t + B / 2, hatg)
        for j in range(2):
            f = mtof(ch[(k * 2 + j) % 3] + oct_)
            s.m(marimba(f, .45) if inst == 'marimba' else pizz(f, .28), t + j * B / 2, instg)
        t += B; k += 1


def drive(s, t0, t1, bpm=120, prog=Dmaj, stop=None):
    """Upbeat four-on-the-floor groove (release / 'все выжили' / finale). stop=(a,b) = break."""
    B = 60 / bpm; t = t0; beat = 0
    while t < t1 - 1e-6:
        root, ch = prog[int(beat // 4) % len(prog)]
        brk = stop is not None and stop[0] <= t < stop[1]
        if not brk:
            s.m(kick(), t, -8)
            if beat % 2 == 1: s.m(clap(), t, -14)
            s.m(hat(), t + B / 2, -21); s.m(hat(.6), t, -27)
            for j, o in enumerate((0, .5)):
                n = int(.22 * SR); tb = np.arange(n) / SR
                s.m(lp(saw(mtof(root - 24 + (12 if j else 0)), n, (0,), 12), 500) * np.exp(-tb * 7) * np.minimum(1, tb / .004), t + o * B, -13)
            n = int(.18 * SR); tc = np.arange(n) / SR
            stab = sum(saw(mtof(m + 12), n, (-.12, .12), 9) for m in ch) / 3
            s.m(lp(stab, 2600) * np.exp(-tc * 12) * np.minimum(1, tc / .003), t + B / 2, -21)
        for j in range(4):
            m = ch[(beat * 4 + j) % 3] + 24 + (12 if (beat * 4 + j) % 8 == 7 else 0)
            s.m(pluck(mtof(m), .25), t + j * B / 4, -29 if not brk else -24)
        t += B; beat += 1


def villain_beat(s, t0, t1, bpm=140, prog=Cm, intens=1.0):
    """Dark trap beat: half-time kick/clap, 808 bass, cowbell melody."""
    B = 60 / bpm; t = t0; k = 0
    while t < t1 - 1e-6:
        bar = int(k // 8); root, ch = prog[bar % 4]; pos = k % 8
        if pos in (0, 5): s.m(kick(), t, -7)
        if pos == 4: s.m(clap(), t, -12); s.m(crash(.3, .15), t, -30)
        s.m(hat(.9), t, -22); s.m(hat(.5), t + B / 2, -22)
        if pos in (0, 3, 5): s.m(b808(mtof(root), .55 if pos else .8, glide=(-.03 if pos == 5 else 0)), t, -9 + 2 * (intens - 1))
        if pos in (0, 2, 3, 6): s.m(cowbell(mtof(ch[(pos + bar) % 3] + 24), .22), t, -24)
        t += B; k += 1


def impact(s, t, root=36, crash_db=-11, boom_db=-2):
    """Reveal hit: boom + crash + braam (numbers on full screen, BOOM, capture)."""
    s.m(boom(f0=80), t, boom_db); s.m(crash(1, 1.5), t, crash_db); s.m(braam(root, 1.6), t, -9)


def final_chord(s, t, prog_chord=(62, 66, 69, 74), gdb=-16):
    for m in prog_chord:
        s.m(pluck(mtof(m + 12), 1.6, 3), t + (m - prog_chord[0]) * .01, gdb - 1)
    s.m(pad([mtof(m) for m in prog_chord], 1.1, 2500, .01, .8), t, gdb)
    s.m(boom(f0=60), t, -8); s.m(crash(1, 1.2), t, -14)
