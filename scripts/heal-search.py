#!/usr/bin/env python3
"""Лечение мёртвого поиска в профилях LibreWolf.

Симптом: urlbar без движков в дропдауне, на стартовой мёртвая строка при
живой теме. Причина: определения движков (search-config-v2) materializeются
в IndexedDB профиля storage/permanent/chrome/idb/3870112724rsegmnoittet-es.*;
если RemoteSettings не дотащил коллекции (LW блокирует часть фидов, дампы
из сборки вырезаны), база остаётся огрызком - движки не разрешаются.

Лечение: копируем RS-базу и индекс движков из здорового профиля (RS-sqlite
максимального размера) в больные (RS-sqlite меньше MIN_HEALTHY) и чистим их
startupCache, чтобы newtab пересобрался. Запускать при закрытом LibreWolf.
"""
import pathlib
import shutil
import subprocess
import sys

HOME = pathlib.Path.home()
ROOT = HOME / ".config/librewolf/librewolf"
CACHE_ROOT = HOME / ".cache/librewolf"
IDB = pathlib.Path("storage/permanent/chrome/idb")
STEM = "3870112724rsegmnoittet-es"
RS_PARTS = (".sqlite", ".sqlite-wal", ".files")
# Полная база с search-config-v2 ~18 МБ; огрызки наблюдались 3 МБ и меньше.
MIN_HEALTHY = 5 * 1024 * 1024


def profiles():
    for path in sorted(ROOT.iterdir()):
        if (path / "times.json").is_file():
            yield path


def rs_size(profile):
    db = profile / IDB / (STEM + ".sqlite")
    return db.stat().st_size if db.is_file() else 0


def copy_part(source, target):
    if target.is_dir():
        shutil.rmtree(target)
    elif target.exists():
        target.unlink()
    if source.is_dir():
        shutil.copytree(source, target)
    elif source.is_file():
        shutil.copy(source, target)


def main():
    if subprocess.run(["pgrep", "-x", "librewolf"], capture_output=True).stdout:
        return "librewolf запущен - закрой все окна и повтори"

    sized = sorted(((rs_size(p), p) for p in profiles()), reverse=True)
    if not sized:
        return f"профили не найдены в {ROOT}"
    donor_size, donor = sized[0]
    if donor_size < MIN_HEALTHY:
        return "здорового профиля-донора нет (RS-sqlite везде меньше 5 МБ)"

    healed = []
    for size, profile in sized[1:]:
        if size >= MIN_HEALTHY:
            continue
        src = donor / IDB
        dst = profile / IDB
        dst.mkdir(parents=True, exist_ok=True)
        for suffix in RS_PARTS:
            copy_part(src / (STEM + suffix), dst / (STEM + suffix))
        donor_index = donor / "search.json.mozlz4"
        if donor_index.is_file():
            shutil.copy(donor_index, profile / "search.json.mozlz4")
        cache = CACHE_ROOT / profile.name / "startupCache"
        if cache.is_dir():
            shutil.rmtree(cache)
        healed.append(profile.name)

    if not healed:
        print("все профили здоровы")
        return 0
    print("донор:", donor.name, f"({donor_size // 1024} КБ)")
    for name in healed:
        print("вылечен:", name)
    print("перезапусти LibreWolf; старые базы не сохранялись")
    return 0


if __name__ == "__main__":
    sys.exit(main())
