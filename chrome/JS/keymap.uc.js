// ==UserScript==
// @name            keymap
// @description     nvim-раскладка ядра: allowlist + keydown-listener поверх keyset
// @author          s3nn1k
// @homepageURL     https://github.com/s3nn1k/librewolf-config
// ==/UserScript==

// Механика без решений, конфиг в chrome/JS/keymap.json:
//   keep.ids / keep.commands - остаются нативными (keyset не трогаем);
//   remap (id -> комбинация) - команда берётся у исходного <key> и вешается
//     на собственный keydown-listener, сам <key> отключается;
//   custom (комбинация -> действие) - обработчик listener'а;
//   всё непокрытое отключается (fail-closed).
//
// Почему listener, а не правка keyset: Gecko строит таблицу связок keyset'а
// один раз при загрузке окна, правки атрибутов и клон узла не перерегистрируют
// комбинации. Listener на capture ловит всё, keyset остаётся только для keep.

const KEYMAP_ACTIONS = {
    "scroll-down": () => sendPageKey(true),
    "scroll-up": () => sendPageKey(false),
    "focus-urlbar": () => {
        if (window.gURLBar) {
            gURLBar.focus();
            gURLBar.select();
        }
    },
};

// Полстраницы через процессную границу дёшево не послать - шлём PgUp/PgDn
// в сфокусированный элемент (в полях прокручивается поле, натив не теряется).
function sendPageKey(down) {
    const utils = window.windowUtils;
    if (!utils) return;
    const code = down ? KeyEvent.DOM_VK_PAGE_DOWN : KeyEvent.DOM_VK_PAGE_UP;
    utils.sendKeyEvent("keydown", code, 0, 0);
    utils.sendKeyEvent("keyup", code, 0, 0);
}

// Нормализуем в форму "C+S+n": модификаторы в порядке C,S,A,M, буква в нижнем.
function comboFromEvent(e) {
    let mods = "";
    if (e.ctrlKey) mods += "C+";
    if (e.shiftKey) mods += "S+";
    if (e.altKey) mods += "A+";
    if (e.metaKey) mods += "M+";
    const k = e.key.length === 1 ? e.key.toLowerCase() : e.key;
    return mods + k;
}

function isChromeEditable(target) {
    return !!(target && target.closest &&
        target.closest("input, textarea, [contenteditable='true']"));
}

(async () => {
    let conf;
    try {
        conf = await (await fetch("chrome://userscripts/content/keymap.json")).json();
    } catch (e) {
        console.error("keymap: keymap.json не читается", e);
        return;
    }

    const keyset = document.getElementById("mainKeyset");
    if (!keyset) return;

    const keepIds = new Set((conf.keep && conf.keep.ids) || []);
    const keepCommands = new Set((conf.keep && conf.keep.commands) || []);
    const remap = (conf.remap) || {};
    const binds = {};
    const report = [];
    const disabled = [];

    // Гасим всё, кроме keep: ремапнутые <key> тоже отключаем - их команды
    // исполняет listener, оригинальная комбинация должна умереть.
    for (const key of keyset.querySelectorAll("key")) {
        const id = key.getAttribute("id") || "";
        const command = key.getAttribute("command") || "";
        if (keepIds.has(id) || keepCommands.has(command)) continue;
        if (id && id in remap) {
            binds[remap[id]] = () => {
                const cmd = document.getElementById(command);
                if (cmd) cmd.doCommand();
                else console.error("keymap: нет команды " + command);
            };
            report.push(remap[id] + "->" + (command || id));
        }
        key.setAttribute("disabled", "true");
        key.removeAttribute("reserved");
        disabled.push(id || command || "анонимный");
    }

    for (const [combo, action] of Object.entries(conf.custom || {})) {
        if (!(action in KEYMAP_ACTIONS)) {
            console.error("keymap: неизвестное действие " + action);
            continue;
        }
        binds[combo] = KEYMAP_ACTIONS[action];
        report.push(combo + "->" + action);
    }

    window.addEventListener("keydown", e => {
        if (!e.isTrusted) return;
        // В полях chrome (urlbar и пр.) перехват отменяется - там работает натив
        // (C+U = удалить до начала строки и т.п.), как в insert-mode nvim.
        if (isChromeEditable(e.target)) return;
        const fn = binds[comboFromEvent(e)];
        if (fn) {
            e.preventDefault();
            e.stopImmediatePropagation();
            fn();
        }
    }, true);

    console.info("keymap: отключено " + disabled.length + "; бинды: " + report.join(" "));
})();
