#!/usr/bin/env python3
"""Mux video + soundtrack into the deliverable MP4 and make a check sheet.

  python3 finalize.py --video project/video.mp4 --audio project/mix.wav --dur 60 \
      --out "project/Что если — суперскорость.mp4" --sheet project/check.png

Audio is loudness-normalised to -14 LUFS / -1.2 dBTP (YouTube/Reels level),
AAC 256 kbps 48 kHz, faststart. The check sheet samples a frame every
--every seconds (default ~2.3 s, 4 columns) - look at it before delivering.
"""
import argparse, os, shutil, subprocess, sys, tempfile


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--video", required=True)
    ap.add_argument("--audio", required=True)
    ap.add_argument("--dur", type=float, required=True)
    ap.add_argument("--out", required=True)
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--every", type=float, default=None)
    ap.add_argument("--extra", type=float, nargs="*", default=[], help="additional times to sample (transitions)")
    a = ap.parse_args()
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-i", a.video, "-i", a.audio, "-map", "0:v", "-map", "1:a",
                           "-c:v", "copy", "-af", "loudnorm=I=-14:TP=-1.2:LRA=11", "-c:a", "aac", "-b:a", "256k", "-ar", "48000",
                           "-movflags", "+faststart", "-t", str(a.dur), a.out])
    print(subprocess.check_output(["ffprobe", "-v", "error", "-show_entries", "format=duration,size:stream=codec_name,width,height,r_frame_rate",
                                   "-of", "compact", a.out]).decode())
    if a.sheet:
        every = a.every or max(2.0, a.dur / 26)
        times, t = [], 0.4
        while t < a.dur - 0.1:
            times.append(round(t, 2)); t += every
        times = sorted(set(times + [round(x, 2) for x in a.extra] + [round(a.dur - 0.2, 2)]))
        tmp = tempfile.mkdtemp()
        for t in times:
            subprocess.check_call(["ffmpeg", "-v", "error", "-ss", str(t), "-i", a.out, "-frames:v", "1", os.path.join(tmp, f"c_{t:07.2f}.png")])
        wh = subprocess.check_output(["ffprobe", "-v", "error", "-select_streams", "v", "-show_entries", "stream=width,height", "-of", "csv=p=0", a.out]).decode().strip().split(",")
        vw, vh = int(wh[0]), int(wh[1])
        cols = 4 if vw >= vh else 6; rows = (len(times) + cols - 1) // cols
        tw = 480 if vw >= vh else 240
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-pattern_type", "glob", "-i", os.path.join(tmp, "c_*.png"),
                               "-vf", f"scale={tw}:{tw * vh // vw},tile={cols}x{rows}:padding=4", "-frames:v", "1", a.sheet])
        shutil.rmtree(tmp)
        print("sheet:", a.sheet, f"({len(times)} frames)")


if __name__ == "__main__":
    sys.exit(main())
