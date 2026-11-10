#!/usr/bin/env python3
"""Сборка темы: palette.json + mappings/*.json + templates/ -> chrome/*.css.

Значение маппинга - имя роли ("bg"), роль с альфой ("red@0.15") или
light-dark(роль, роль). Никакой логики кроме подстановки.
"""
import json
import pathlib
import re
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
PALETTE = json.loads((ROOT / "palette.json").read_text())


def resolve(value):
    if isinstance(value, dict):
        return value["literal"]
    m = re.fullmatch(r"light-dark[(]([^,]+), ([^)]+)[)]", value)
    if m:
        return "light-dark(" + resolve(m.group(1)) + ", " + resolve(m.group(2)) + ")"
    if "@" in value:
        role, alpha = value.rsplit("@", 1)
        hx = PALETTE[role]
        r, g, b = int(hx[1:3], 16), int(hx[3:5], 16), int(hx[5:7], 16)
        return f"rgba({r}, {g}, {b}, {alpha})"
    return PALETTE[value]


def vars_block(mapping_path):
    mapping = json.loads((ROOT / mapping_path).read_text())
    lines = []
    for name in sorted(mapping):
        lines.append(f"  {name}: {resolve(mapping[name])} !important;")
    return chr(10).join(lines) + chr(10)


def fill(template_path, blocks):
    text = (ROOT / template_path).read_text()
    for name in re.findall(r"{{([A-Z_]+)}}", text):
        if name not in blocks:
            print(f"build: нет блока {name}", file=sys.stderr)
            return 1
        text = text.replace("{{" + name + "}}", blocks[name].rstrip())
    for role in re.findall(r"{{([a-z_0-9@.]+)}}", text):
        text = text.replace("{{" + role + "}}", resolve(role))
    name = pathlib.Path(template_path).name
    name = name.replace(".css.tmpl", ".css").replace("sidebery.css", "sidebery-sidebar.css")
    out = ROOT / "chrome" / name
    out.parent.mkdir(exist_ok=True)
    out.write_text(text)
    print("built:", out.relative_to(ROOT))
    return 0


def main():
    status = 0
    status |= fill("templates/userChrome.css.tmpl", {
        "CHROME_THEME_BLOCK": vars_block("mappings/chrome.json"),
        "DEVTOOLS_VARS": vars_block("mappings/devtools.json"),
        "DEVTOOLS_EXTRA_VARS": vars_block("mappings/devtools-extra.json"),
    })
    status |= fill("templates/sidebery.css.tmpl", {})
    status |= fill("templates/userContent.css.tmpl", {
        "CHROME_THEME_VARS": vars_block("mappings/chrome.json"),
        "DEVTOOLS_VARS": vars_block("mappings/devtools.json"),
        "DEVTOOLS_EXTRA_VARS": vars_block("mappings/devtools-extra.json"),
        "ABOUT_TOKENS_BLOCK": vars_block("mappings/about.json"),
    })
    return status


sys.exit(main())
