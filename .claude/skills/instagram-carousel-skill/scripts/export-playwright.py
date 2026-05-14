"""Render HTML slide templates to 1080x1350 PNGs via headless Chromium.

Usage:
    python export-playwright.py <input_dir> <output_dir>

Input dir must contain slide-NN.html files. Each renders to slide-NN.png at 1080x1350.

Requires: playwright + chromium
    pip install playwright && playwright install chromium
"""

from __future__ import annotations

import sys
from pathlib import Path

try:
    from playwright.sync_api import sync_playwright
except ImportError:
    sys.stderr.write(
        "playwright not installed. Run: pip install playwright && playwright install chromium\n"
    )
    sys.exit(1)


SLIDE_WIDTH = 1080
SLIDE_HEIGHT = 1350


def render(input_dir: Path, output_dir: Path) -> int:
    slides = sorted(input_dir.glob("slide-*.html"))
    if not slides:
        sys.stderr.write(f"No slide-*.html files in {input_dir}\n")
        return 1

    output_dir.mkdir(parents=True, exist_ok=True)

    with sync_playwright() as p:
        browser = p.chromium.launch()
        context = browser.new_context(
            viewport={"width": SLIDE_WIDTH, "height": SLIDE_HEIGHT},
            device_scale_factor=2,
        )
        page = context.new_page()

        for slide in slides:
            out = output_dir / f"{slide.stem}.png"
            page.goto(slide.resolve().as_uri())
            page.wait_for_load_state("networkidle")
            page.screenshot(path=str(out), full_page=False, omit_background=False)
            print(f"rendered {slide.name} -> {out}")

        browser.close()

    return 0


def main() -> int:
    if len(sys.argv) != 3:
        sys.stderr.write("Usage: python export-playwright.py <input_dir> <output_dir>\n")
        return 2
    return render(Path(sys.argv[1]), Path(sys.argv[2]))


if __name__ == "__main__":
    sys.exit(main())
