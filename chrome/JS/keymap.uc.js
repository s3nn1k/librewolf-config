// ==UserScript==
// @name            keymap
// @description     nvim-раскладка ядра через официальный API fx-autoconfig
// @author          s3nn1k
// @homepageURL     https://github.com/s3nn1k/librewolf-config
// ==/UserScript==

// Конфиг в chrome/JS/keymap.json:
//   keep.ids / keep.commands - остаются нативными в mainKeyset;
//   remap (id -> комбинация) - команда исходного <key> вешается через
//     UC_API.Hotkeys на новую комбинацию (ключ в отдельном ucKeySet);
//   custom (комбинация -> действие) - команда-функция того же API;
//   всё непокрытое отключается в mainKeyset (fail-closed).
//
// Каноничный путь вместо ручной правки keyset: UC_API.Hotkeys.define +
// attachToWindow сами делают <key>/<command> после загрузки окна,
// suppressOriginal гасит исходную комбинацию.

const KEYMAP_ACTIONS = {
    "scroll-down": win => sendPageKey(win, true),
    "scroll-up": win => sendPageKey(win, false),
    "focus-urlbar": win => {
        if (win.gURLBar) {
            win.gURLBar.focus();
            win.gURLBar.select();
        }
    },
};

// Полстраницы через процессную границу дёшево не послать - шлём PgUp/PgDn
// в сфокусированный элемент (в полях прокручивается поле, натив не теряется).
function sendPageKey(win, down) {
    const utils = win.windowUtils;
    if (!utils) return;
    const code = down ? win.KeyEvent.DOM_VK_PAGE_DOWN : win.KeyEvent.DOM_VK_PAGE_UP;
    utils.sendKeyEvent("keydown", code, 0, 0);
    utils.sendKeyEvent("keyup", code, 0, 0);
}

// "C+S+n" -> { modifiers: "accel shift", key: "n" } - формат UC_API.Hotkeys
// (модификаторы через пробел, ctrl нормализуется в accel самим API).
function comboToHotkey(combo) {
    const parts = combo.split("+");
    const key = parts.pop();
    const map = { C: "accel", S: "shift", A: "alt", M: "meta" };
    return { modifiers: parts.map(p => map[p]).join(" "), key };
}

(async () => {
    let conf;
    try {
        conf = await (await fetch("chrome://userscripts/content/keymap.json")).json();
    } catch (e) {
        console.error("keymap: keymap.json не читается", e);
        return;
    }

    if (!window.UC_API || !window.UC_API.Hotkeys) {
        console.error("keymap: UC_API недоступен - fx-autoconfig не загрузился");
        return;
    }
    const keyset = document.getElementById("mainKeyset");
    if (!keyset) return;

    // Allowlist: гасим всё, кроме keep (ремапнутые - тоже: их команда
    // исполняется из ucKeySet, оригинальная комбинация должна умереть).
    const keepIds = new Set((conf.keep && conf.keep.ids) || []);
    const keepCommands = new Set((conf.keep && conf.keep.commands) || []);
    let disabled = 0;
    for (const key of keyset.querySelectorAll("key")) {
        const id = key.getAttribute("id") || "";
        const command = key.getAttribute("command") || "";
        if (keepIds.has(id) || keepCommands.has(command)) continue;
        key.setAttribute("disabled", "true");
        key.removeAttribute("reserved");
        disabled++;
    }

    const report = [];
    for (const [id, combo] of Object.entries(conf.remap || {})) {
        const orig = keyset.querySelector("key#" + id);
        const command = orig && orig.getAttribute("command");
        if (!command) {
            console.error("keymap: remap-ключ " + id + " без command, пропущен");
            continue;
        }
        const { modifiers, key } = comboToHotkey(combo);
        UC_API.Hotkeys
            .define({ id: "keymap-" + id, modifiers, key, command })
            .attachToWindow(window, { suppressOriginal: true });
        report.push(combo + "->" + command);
    }

    for (const [combo, action] of Object.entries(conf.custom || {})) {
        if (!(action in KEYMAP_ACTIONS)) {
            console.error("keymap: неизвестное действие " + action);
            continue;
        }
        const { modifiers, key } = comboToHotkey(combo);
        UC_API.Hotkeys
            .define({ id: "keymap-" + action, modifiers, key,
                command: win => KEYMAP_ACTIONS[action](win) })
            .attachToWindow(window, { suppressOriginal: true });
        report.push(combo + "->" + action);
    }

    console.info("keymap: отключено " + disabled + "; бинды: " + report.join(" "));
})();
