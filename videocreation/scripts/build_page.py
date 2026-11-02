#!/usr/bin/env python3
"""Assemble the render page index.html for a video project.

A project folder holds only what is unique to this video:
  scenes.html  - the scene <div>s (and an optional extra <svg><defs> block)
  main.js      - build(), per-scene renderers, render(t)
  hud.html     - optional overlays (speedometer, series badge) placed inside #cam
  extra.css    - optional styles
This script wraps them with the shared assets (base.css, defs.svg, lib.js)
so every video gets the same look and the same animation helpers.

usage: python3 build_page.py <project_dir> [--title "Название"] [--size 1920x1080 | 1080x1920]
"""
import argparse, os, sys

HERE = os.path.dirname(os.path.abspath(__file__))
ASSETS = os.path.join(os.path.dirname(HERE), "assets")


def rd(p, default=""):
    return open(p, encoding="utf-8").read() if os.path.exists(p) else default


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("project")
    ap.add_argument("--title", default="video")
    ap.add_argument("--size", default="1920x1080", help="WxH: 1920x1080 (16:9, default) or 1080x1920 (9:16 Reels/Shorts)")
    a = ap.parse_args()
    P = a.project
    W, Hh = (int(v) for v in a.size.lower().split("x"))
    for need in ("scenes.html", "main.js"):
        if not os.path.exists(os.path.join(P, need)):
            sys.exit(f"missing {need} in {P}")
    html = f"""<!doctype html>
<html lang="ru"><head><meta charset="utf-8"><title>{a.title}</title>
<style>{rd(os.path.join(ASSETS, 'base.css'))}
:root{{--W:{W}px;--H:{Hh}px}}
{rd(os.path.join(P, 'extra.css'))}</style></head>
<body>
{rd(os.path.join(ASSETS, 'defs.svg'))}
<div id="stage"><div id="cam">
{rd(os.path.join(P, 'scenes.html'))}
{rd(os.path.join(P, 'hud.html'))}
</div>
<div class="abs" id="flash" style="left:0;top:0;width:{W}px;height:{Hh}px;background:#fff;opacity:0"></div>
</div>
<script>window.VW={W};window.VH={Hh};</script>
<script>
{rd(os.path.join(ASSETS, 'lib.js'))}
{rd(os.path.join(P, 'main.js'))}
</script>
</body></html>"""
    out = os.path.join(P, "index.html")
    open(out, "w", encoding="utf-8").write(html)
    print("wrote", out, f"{W}x{Hh}", len(html), "bytes")


if __name__ == "__main__":
    main()
