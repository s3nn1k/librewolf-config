#!/usr/bin/env python3
"""Отчёт покрытия: цветовые переменные из омни LW vs собранная тема."""
import pathlib
import re
import subprocess
import sys

OMNI = ["/usr/share/librewolf/omni.ja", "/usr/share/librewolf/browser/omni.ja"]
SOURCES = [
    "chrome/toolkit/skin/classic/global/design-system/tokens-shared.css",
    "chrome/toolkit/skin/classic/global/design-system/tokens-platform.css",
    "chrome/toolkit/skin/classic/global/design-system/tokens-brand.css",
    "chrome/browser/skin/classic/browser/browser-colors.css",
    "chrome/pdfjs/content/web/viewer.css",
    "chrome/devtools/skin/variables.css",
    "chrome/devtools/content/debugger/src/components/variables.css",
    "chrome/devtools/content/netmonitor/src/assets/styles/variables.css",
    "chrome/toolkit/skin/classic/global/aboutReader.css",
    "contentaccessible/viewsource.css",
]
NON_COLOR = re.compile(r"width|distance|offset|size|height|font|radius|shadow|opacity|gradient|scheme")
COLORISH = re.compile(r"color|background|fill|stroke|ink")

def registry():
    names = set()
    for jar in OMNI:
        listing = subprocess.run(["unzip", "-l", jar], capture_output=True, text=True).stdout
        present = {line.split()[-1] for line in listing.splitlines() if line.split()[-1:] and "/" in line}
        for src in SOURCES:
            if src not in present:
                continue
            text = subprocess.run(["unzip", "-p", jar, src], capture_output=True, text=True).stdout
            names |= set(re.findall(r"(--[a-z0-9-]+)[ ]*:", text))
    return names

def covered():
    got = set()
    for css in (pathlib.Path(__file__).parent / "chrome").glob("*.css"):
        got |= set(re.findall(r"(--[a-z0-9-]+)[ ]*:", css.read_text()))
    return got

def main():
    names = registry()
    colorish = [n for n in sorted(names) if COLORISH.search(n) and not NON_COLOR.search(n)]
    cov = covered()
    uncovered = [n for n in colorish if n not in cov]
    print(f"реестр цветовых: {len(colorish)} | покрыто: {len(colorish) - len(uncovered)}")
    for n in uncovered:
        print("  ", n)
    return 0

sys.exit(main())
