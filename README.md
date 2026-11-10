# librewolf-config

Тема и настройки LibreWolf, палитра zenbox_dark. Отдельное репо темы браузера:
dotfiles-fedora клонирует его в ~/projects/personal/librewolf-config и линкует
в профили (user.js, chrome/).

## Структура

- palette.json - роли -> hex, единственный источник цветов;
- mappings/*.json - плоские карты "переменная -> роль" (chrome, about, devtools,
  devtools-extra);
- templates/*.tmpl - каркасы css с {{роль}} и {{БЛОК}};
- chrome/ - собранные css (коммитятся, пересборка по изменению);
- merge-policies.py - сборка политик: пакетная база + оверлей + sidebery-стили.

## Команды

- make build - пересобрать css из палитры и маппингов;
- make policies - policies.merged.json (положить в
  /usr/share/librewolf/distribution/policies.json);
- make audit - покрытие цветовых переменных текущей версии LW;
- смена акцента - правка palette.json + make build + рестарт LW.
