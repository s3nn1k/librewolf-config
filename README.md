# librewolf-config

Тема zenbox_dark, политики и хоткеи ядра LibreWolf. Всё декларативно:
palette.json + mappings/*.json + keymap.json, сборка (make build) - тупая
подстановка без логики. dotfiles-fedora клонирует репо в
~/projects/personal/librewolf-config и линкует user.js и chrome/ в профили;
хоткеи применяет keymap.uc.js через fx-autoconfig (allowlist mainKeyset).

## Структура

- palette.json - роли -> hex, единственный источник цветов;
- mappings/*.json - плоские карты "переменная -> роль" (chrome, about, devtools,
  devtools-extra);
- templates/*.tmpl - каркасы css с {{роль}} и {{БЛОК}};
- chrome/ - собранные css (коммитятся, пересборка по изменению);
- chrome/JS/keymap.json - allowlist хоткеев ядра (keep/remap/custom, остальное отключается);
- chrome/JS/keymap.uc.js + chrome/utils/ - скрипт раскладки и вендор fx-autoconfig;
- autoconfig/ - служебные файлы для /usr/share/librewolf (ставит make autoconfig);
- scripts/ - сборка и аудит темы, merge политик (пакетная база + оверлей + sidebery-стили), установка autoconfig.

## Команды

- make build - пересобрать css из палитры и маппингов;
- make policies - policies.merged.json (положить в
  /usr/share/librewolf/distribution/policies.json);
- make audit - покрытие цветовых переменных текущей версии LW;
- make autoconfig - установка fx-autoconfig (sudo-команды печатает сам) + чистка startupCache;
- смена акцента - правка palette.json + make build + рестарт LW.

## Хоткеи ядра

Нативные биндинги ядра - XUL keyset в browser.xhtml, префов на них нет.
Раскладка применяется скриптом keymap.uc.js через fx-autoconfig (вендор,
см. autoconfig/UPSTREAM): всё, что не в keep/remap/custom из keymap.json,
отключается; новые ключи будущих версий LW выключены по умолчанию.

Установка: make autoconfig (два файла в /usr/share/librewolf) + рестарт LW.
dnf update librewolf затирает файлы - после мажорных обновлений повторить.

Активная раскладка: ремапы C+P/C+N (назад/вперёд), C+S+N (вкладка), C+Q
(закрыть), C+S+R (перезагрузка), C+J (загрузки); кастом C+D/C+U (скролл
полстраницы), C+S (urlbar); натив - поиск, история, закладки, зум, правка,
C+Tab, C+S+P, Esc, select-all. Остальное (включая Backspace) выключено.
