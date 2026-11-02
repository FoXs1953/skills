#!/usr/bin/env python3
"""Show the speech segments and pauses of a voiceover file.

Use it right after downloading the ElevenLabs MP3s: it prints every phrase
(start-end, length) and the pause after it, so you can match segments to the
script sentences and decide which pauses to keep long (dramatic beats) in
fit_vo.py.

usage: python3 segment_vo.py el/gen1.mp3 [el/gen2.mp3 ...] [--thr -40] [--min-gap 0.18]
"""
import argparse, subprocess, sys
import numpy as np

SR = 48000


def load(path):
    raw = subprocess.check_output(["ffmpeg", "-v", "error", "-i", path, "-ac", "1", "-ar", str(SR), "-f", "f32le", "-"])
    return np.frombuffer(raw, dtype=np.float32).astype(np.float64)


def segments(x, thr=-40.0, min_gap=0.18, hop_s=0.01):
    """Return (segments, gaps) in frames of hop_s seconds."""
    hop = int(hop_s * SR)
    fr = np.array([np.sqrt(np.mean(x[i:i + hop] ** 2) + 1e-12) for i in range(0, len(x) - hop, hop)])
    voiced = 20 * np.log10(fr + 1e-9) > thr
    runs, i, n = [], 0, len(voiced)
    while i < n:
        if not voiced[i]:
            j = i
            while j < n and not voiced[j]:
                j += 1
            runs.append((i, j)); i = j
        else:
            i += 1
    lead = runs[0][1] if runs and runs[0][0] == 0 else 0
    tail = runs[-1][0] if runs and runs[-1][1] == n else n
    mg = int(round(min_gap / hop_s))
    gaps = [(a, b) for a, b in runs if a > lead and b < tail and (b - a) >= mg]
    segs, prev = [], lead
    for a, b in gaps:
        segs.append((prev, a)); prev = b
    segs.append((prev, tail))
    return segs, gaps, hop


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("files", nargs="+")
    ap.add_argument("--thr", type=float, default=-40.0, help="silence threshold, dBFS")
    ap.add_argument("--min-gap", type=float, default=0.18, help="shortest pause that splits phrases, s")
    a = ap.parse_args()
    for f in a.files:
        x = load(f)
        segs, gaps, hop = segments(x, a.thr, a.min_gap)
        print(f"== {f}: {len(x) / SR:.2f} s, {len(segs)} segments")
        for k, (s0, s1) in enumerate(segs):
            g = (gaps[k][1] - gaps[k][0]) * hop / SR if k < len(gaps) else 0
            print(f"  {k:3d}  {s0 * hop / SR:7.2f} - {s1 * hop / SR:7.2f}  ({(s1 - s0) * hop / SR:5.2f})  pause after {g:4.2f}")


if __name__ == "__main__":
    sys.exit(main())
