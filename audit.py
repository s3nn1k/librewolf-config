#!/usr/bin/env python3
"""Отчёт покрытия: цветовые переменные LW vs собранная тема.

Учитывает наследование: переменная, определённая через var(--token, ...) из
числа покрытых, считается покрытой (pdf.js/devtools строятся поверх токенов).
"""
import pathlib
import re
import subprocess
import sys

JARS = ["/usr/share/librewolf/omni.ja", "/usr/share/librewolf/browser/omni.ja"]
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

def sources_by_jar():
    for jar in JARS:
        listing = subprocess.run(["unzip", "-l", jar], capture_output=True, text=True).stdout
        present = {line.split()[-1] for line in listing.splitlines() if line.split()[-1:] and "/" in line}
        for src in SOURCES:
            if src in present:
                yield jar, src

def registry():
    defs = {}
    for jar, src in sources_by_jar():
        text = subprocess.run(["unzip", "-p", jar, src], capture_output=True, text=True).stdout
        for m in re.finditer(r"(--[a-z0-9-]+)[ ]*:[ ]*([^;{}]+);", text):
            name, value = m.group(1), m.group(2)
            defs.setdefault(name, set()).add(frozenset(re.findall(r"(--[a-z0-9-]+)", value)))
    return defs

def covered():
    got = set()
    for css in (pathlib.Path(__file__).parent / "chrome").glob("*.css"):
        got |= set(re.findall(r"(--[a-z0-9-]+)[ ]*:", css.read_text()))
    return got

def main():
    defs = registry()
    cov = covered()
    colorish = [n for n in sorted(defs) if COLORISH.search(n) and not NON_COLOR.search(n)]

    resolved = set(n for n in colorish if n in cov)
    changed = True
    while changed:
        changed = False
        for name in colorish:
            if name in resolved:
                continue
            for refs in defs[name]:
                if refs <= resolved:
                    resolved.add(name)
                    changed = True
                    break

    uncovered = [n for n in colorish if n not in resolved]
    print(f"реестр цветовых: {len(colorish)} | покрыто: {len(resolved)} (напрямую {sum(1 for n in resolved if n in cov)}, через наследование {len(resolved) - sum(1 for n in resolved if n in cov)})")
    for n in uncovered:
        print("  ", n)
    return 0

sys.exit(main())
