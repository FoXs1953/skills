#!/usr/bin/env python3
"""Tighten / shape the pauses of a voiceover and export phrase timings.

ElevenLabs leaves 0.3-0.55 s between phrases. This script rebuilds the track
segment by segment: every pause becomes min(original, --max-gap) except the
ones you list in --keep (dramatic beats), then applies an optional tempo
change. It writes:
  vo_fit.wav  - the voice to put under the video (48 kHz mono)
  cues.json   - start/end of every phrase in VIDEO time (offset included)
and prints the cue table you build all scene timings from.

Pacing guidance (from the author's feedback):
  * short 60 s explainer: --max-gap 0.22, beats 0.35-0.5, tempo up to 1.1
  * calm story / part 2: --max-gap 0.6, beats 0.8-1.05, tempo 1.0 (never rush)

usage:
  python3 fit_vo.py el/gen1.mp3 --keep '{"0":0.4,"5":0.95}' --max-gap 0.22 --tempo 1.0 --offset 0.3 --out-dir .
Keys of --keep are the pause indexes printed by segment_vo.py ("pause after" segment k).
"""
import argparse, json, os, subprocess, sys, wave
import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from segment_vo import load, segments, SR  # noqa: E402


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("src")
    ap.add_argument("--keep", default="{}", help='JSON {pause_index: seconds}')
    ap.add_argument("--max-gap", type=float, default=0.22)
    ap.add_argument("--tempo", type=float, default=1.0, help="atempo factor, keep 1.0-1.1")
    ap.add_argument("--offset", type=float, default=0.1, help="where the voice starts in the video, s")
    ap.add_argument("--thr", type=float, default=-40.0)
    ap.add_argument("--out-dir", default=".")
    a = ap.parse_args()

    keep = {int(k): float(v) for k, v in json.loads(a.keep).items()}
    x = load(a.src)
    segs, gaps, hop = segments(x, a.thr)
    pad = int(0.012 * SR)
    out, starts, ends, t = [], [], [], 0.0
    for k, (s0, s1) in enumerate(segs):
        i0 = max(0, s0 * hop - pad); i1 = min(len(x), s1 * hop + pad)
        seg = x[i0:i1].copy()
        f = int(0.006 * SR)
        seg[:f] *= np.linspace(0, 1, f); seg[-f:] *= np.linspace(1, 0, f)
        starts.append(t); out.append(seg); t += len(seg) / SR; ends.append(t)
        if k < len(gaps):
            d = (gaps[k][1] - gaps[k][0]) * hop / SR
            g = keep.get(k, min(d, a.max_gap))
            out.append(np.zeros(int(g * SR))); t += g
    y = np.concatenate(out)
    os.makedirs(a.out_dir, exist_ok=True)
    tight = os.path.join(a.out_dir, "vo_tight.wav")
    with wave.open(tight, "wb") as w:
        w.setnchannels(1); w.setsampwidth(2); w.setframerate(SR)
        w.writeframes((np.clip(y, -1, 1) * 32767).astype(np.int16).tobytes())
    fin = os.path.join(a.out_dir, "vo_fit.wav")
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", tight, "-af", f"atempo={a.tempo}", "-ar", str(SR), fin])
    starts = [s / a.tempo + a.offset for s in starts]
    ends = [e / a.tempo + a.offset for e in ends]
    total = len(y) / SR / a.tempo
    json.dump({"offset": a.offset, "tempo": a.tempo, "voice_len": total,
               "starts": starts, "ends": ends}, open(os.path.join(a.out_dir, "cues.json"), "w"), indent=1)
    print(f"voice {total:.2f} s (+offset {a.offset}) -> video ends ~{total + a.offset + 1.2:.1f} s")
    for k, (s, e) in enumerate(zip(starts, ends)):
        print(f"  {k:3d}  {s:7.2f} - {e:7.2f}")


if __name__ == "__main__":
    sys.exit(main())
