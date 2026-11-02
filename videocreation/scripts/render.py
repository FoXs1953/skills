#!/usr/bin/env python3
"""Render the animation page to an MP4 (video only), in parallel chunks.

Every frame is produced by calling render(t) in headless Chromium and taking a
JPEG screenshot over CDP, piped straight into ffmpeg (H.264 CRF 16, yuv420p).
Chunks are encoded with identical settings so they concat without re-encoding.

  python3 render.py project/index.html --dur 60 --fps 60 --jobs 2 --out project/video.mp4
  python3 render.py project/index.html --from 4.0 --to 7.0 --out seg.mp4   # re-render a range
  python3 render.py project/index.html --dur 45 --size 1080x1920 --out v.mp4  # vertical 9:16

Speed: ~0.15-0.2 s per frame per job -> a 60 s video takes ~4-6 min with 2 jobs,
a 2 min video ~11 min. Run it in the background and check the log.
Heavy CSS filter: blur() on big elements makes frames 5x slower - avoid it.
"""
import argparse, asyncio, base64, os, subprocess, sys, time

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")


async def worker(html, fps, f0, f1, out, W=1920, H=1080):
    from playwright.async_api import async_playwright
    ff = subprocess.Popen(["ffmpeg", "-y", "-v", "error", "-f", "image2pipe", "-framerate", str(fps), "-c:v", "mjpeg", "-i", "-",
                           "-c:v", "libx264", "-preset", "medium", "-crf", "16", "-pix_fmt", "yuv420p", "-r", str(fps), out],
                          stdin=subprocess.PIPE)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu", "--font-render-hinting=none"])
        pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        await pg.goto("file://" + os.path.abspath(html))
        await pg.wait_for_function("window.__ready===true", timeout=20000)
        cdp = await pg.context.new_cdp_session(pg)
        t0 = time.time()
        for f in range(f0, f1):
            await pg.evaluate(f"render({f / fps:.6f})")
            shot = await cdp.send("Page.captureScreenshot", {"format": "jpeg", "quality": 94, "optimizeForSpeed": True})
            ff.stdin.write(base64.b64decode(shot["data"]))
            if (f - f0) % 300 == 0:
                print(f"[{f0}-{f1}] frame {f} {time.time() - t0:.0f}s", flush=True)
        if errs:
            print("JS ERRORS:", *errs[:5], sep="\n  ", flush=True)
        await b.close()
    ff.stdin.close(); ff.wait()
    print(f"done {out} {time.time() - t0:.0f}s", flush=True)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("--dur", type=float, help="total duration, s (renders 0..dur)")
    ap.add_argument("--from", dest="t_from", type=float, default=None)
    ap.add_argument("--to", dest="t_to", type=float, default=None)
    ap.add_argument("--fps", type=int, default=60)
    ap.add_argument("--jobs", type=int, default=2)
    ap.add_argument("--out", required=True)
    ap.add_argument("--size", default="1920x1080", help="WxH, same as build_page --size")
    ap.add_argument("--worker", nargs=2, type=int, help=argparse.SUPPRESS)
    a = ap.parse_args()

    W, H = (int(v) for v in a.size.lower().split("x"))
    if a.worker:
        asyncio.run(worker(a.html, a.fps, a.worker[0], a.worker[1], a.out, W, H)); return

    t0 = a.t_from if a.t_from is not None else 0.0
    t1 = a.t_to if a.t_to is not None else a.dur
    if t1 is None:
        sys.exit("give --dur or --from/--to")
    F0, F1 = int(round(t0 * a.fps)), int(round(t1 * a.fps))
    jobs = max(1, a.jobs)
    edges = [F0 + (F1 - F0) * k // jobs for k in range(jobs + 1)]
    outdir = os.path.dirname(os.path.abspath(a.out))
    parts, procs = [], []
    for k in range(jobs):
        part = os.path.join(outdir, f"_part{k}.mp4"); parts.append(part)
        log = open(os.path.join(outdir, f"_render{k}.log"), "w")
        procs.append(subprocess.Popen([sys.executable, __file__, a.html, "--fps", str(a.fps), "--out", part, "--size", a.size,
                                       "--worker", str(edges[k]), str(edges[k + 1])], stdout=log, stderr=subprocess.STDOUT))
    rc = [p.wait() for p in procs]
    if any(rc):
        sys.exit(f"worker failed: {rc} (see _render*.log)")
    lst = os.path.join(outdir, "_parts.txt")
    open(lst, "w").write("".join(f"file '{p}'\n" for p in parts))
    subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-f", "concat", "-safe", "0", "-i", lst, "-c", "copy", a.out])
    for p in parts:
        os.remove(p)
    print("video:", a.out)


if __name__ == "__main__":
    main()
