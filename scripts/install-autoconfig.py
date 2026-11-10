#!/usr/bin/env python3
"""Установка fx-autoconfig в LibreWolf.

Копирует autoconfig/config.js -> /usr/share/librewolf/config.js и
autoconfig/defaults/pref/config-prefs.js -> /usr/share/librewolf/defaults/pref/.

От root сам не эскалируется: без прав печатает готовые sudo-команды
(канон сессии - sudo-шаги выполняет пользователь). Заодно чистит startupCache
профилей: без этого загрузчик скриптов не подхватывается после установки.

dnf update librewolf затирает файлы в /usr/share/librewolf - после мажорных
обновлений перезапустить (make autoconfig) и снова очистить кэш.
"""
import os
import pathlib
import shutil
import sys

ROOT = pathlib.Path(__file__).resolve().parent.parent
APP_DIR = pathlib.Path("/usr/share/librewolf")
FILES = [
    (ROOT / "autoconfig" / "config.js", APP_DIR / "config.js", 0o644),
    (ROOT / "autoconfig" / "defaults" / "pref" / "config-prefs.js",
     APP_DIR / "defaults" / "pref" / "config-prefs.js", 0o644),
]


def install():
    for src, dst, mode in FILES:
        dst.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy(src, dst)
        os.chmod(dst, mode)
        print("installed:", dst)


def print_instructions():
    print("нет прав на " + str(APP_DIR) + " - выполни:")
    for src, dst, mode in FILES:
        print(f"  sudo install -m {mode:o} {src} {dst}")


def clear_startup_cache():
    cleared = 0
    for cache_root in (pathlib.Path.home() / ".cache" / "librewolf").glob("*/startupCache"):
        shutil.rmtree(cache_root, ignore_errors=True)
        cleared += 1
    print(f"startupCache очищен: {cleared} профилей")


def main():
    # --files: только установка (под sudo из bootstrap); --cache: только чистка
    # startupCache; без флагов - интерактивный запуск из make autoconfig.
    mode = sys.argv[1] if len(sys.argv) > 1 else ""
    if mode == "--files":
        if os.geteuid() != 0:
            print("--files требует root (запускай через sudo)", file=sys.stderr)
            return 1
        install()
        return 0
    if mode == "--cache":
        clear_startup_cache()
        return 0
    if os.geteuid() == 0:
        install()
    else:
        print_instructions()
    clear_startup_cache()
    return 0


if __name__ == "__main__":
    sys.exit(main())
