#!/usr/bin/env python3
"""Render single frames of the page and an optional contact sheet.

Use before the full render to check layout, overlaps and timing:
  python3 snap.py project/index.html --out project/snaps 0.5 3.2 7.8 ... --sheet project/sheet.png --cols 3
Prints any JavaScript errors (a missing element id is the usual suspect).
"""
import argparse, asyncio, os, subprocess, sys

os.environ.setdefault("PLAYWRIGHT_BROWSERS_PATH", "/opt/pw-browsers")
from playwright.async_api import async_playwright  # noqa: E402


async def run(html, times, outdir, W=1920, H=1080):
    os.makedirs(outdir, exist_ok=True)
    async with async_playwright() as p:
        b = await p.chromium.launch(args=["--disable-gpu", "--font-render-hinting=none"])
        pg = await b.new_page(viewport={"width": W, "height": H}, device_scale_factor=1)
        errs = []
        pg.on("pageerror", lambda e: errs.append(str(e)))
        pg.on("console", lambda m: errs.append("console: " + m.text) if m.type == "error" else None)
        await pg.goto("file://" + os.path.abspath(html))
        await pg.wait_for_function("window.__ready===true", timeout=20000)
        files = []
        for t in times:
            await pg.evaluate(f"render({t})")
            f = os.path.join(outdir, f"f_{t:07.2f}.png")
            await pg.screenshot(path=f); files.append(f)
        await b.close()
    if errs:
        print("JS ERRORS:", *errs, sep="\n  ")
    return files


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("html")
    ap.add_argument("times", nargs="+", type=float)
    ap.add_argument("--out", default="snaps")
    ap.add_argument("--sheet", default=None)
    ap.add_argument("--cols", type=int, default=3)
    ap.add_argument("--size", default="1920x1080", help="WxH, same as build_page --size")
    a = ap.parse_args()
    W, H = (int(v) for v in a.size.lower().split("x"))
    files = asyncio.run(run(a.html, a.times, a.out, W, H))
    if a.sheet:
        rows = (len(files) + a.cols - 1) // a.cols
        w = (640 if a.cols <= 3 else 480) if W >= H else 300
        subprocess.check_call(["ffmpeg", "-y", "-v", "error", "-pattern_type", "glob", "-i", os.path.join(a.out, "f_*.png"),
                               "-vf", f"scale={w}:{w * H // W},tile={a.cols}x{rows}:padding=4", "-frames:v", "1", a.sheet])
        print("sheet:", a.sheet)


if __name__ == "__main__":
    sys.exit(main())
