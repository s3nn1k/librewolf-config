// ==UserScript==
// @name            keymap
// @description     nvim-раскладка ядра: allowlist mainKeyset по keymap.json
// @author          s3nn1k
// @homepageURL     https://github.com/s3nn1k/librewolf-config
// ==/UserScript==

// Механика без решений: конфиг в chrome/JS/keymap.json.
//   keep.ids / keep.commands - остаются нативными;
//   remap (id -> комбинация) - переписываются key/modifiers;
//   custom (комбинация -> действие) - создаются новые <key> с обработчиком;
//   всё, что не покрыто keep/remap, отключается (fail-closed: новые ключи
//   будущих версий LW выключены по умолчанию).

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

// Полстраницы через процессную границу не послать дёшево - шлём PgUp/PgDn
// в сфокусированный элемент (в полях ввода прокручивается поле, не теряется).
function sendPageKey(down) {
    const utils = window.windowUtils;
    if (!utils) return;
    const code = down ? KeyEvent.DOM_VK_PAGE_DOWN : KeyEvent.DOM_VK_PAGE_UP;
    utils.sendKeyEvent("keydown", code, 0, 0);
    utils.sendKeyEvent("keyup", code, 0, 0);
}

// "C+S+N" -> modifiers="accel,shift", key="n".
// Обязательно снимаем конфликтные атрибуты: keycode перебивает key
// (goBackKb живёт на VK_LEFT), а data-l10n-id заставляет Fluent вернуть
// исходную букву после DOMContentLoaded и откатить ремап.
function applyCombo(el, combo) {
    const parts = combo.split("+");
    const letter = parts.pop().toLowerCase();
    const modMap = { C: "accel", S: "shift", A: "alt", M: "meta" };
    const mods = parts.map(p => modMap[p]).filter(Boolean).join(",");
    el.removeAttribute("keycode");
    el.removeAttribute("data-l10n-id");
    el.removeAttribute("internal");
    el.setAttribute("key", letter);
    if (mods) el.setAttribute("modifiers", mods);
    else el.removeAttribute("modifiers");
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
    const disabled = [];
    const remapped = [];

    for (const key of keyset.querySelectorAll("key")) {
        const id = key.getAttribute("id") || "";
        const command = key.getAttribute("command") || "";
        if (id && id in remap) {
            applyCombo(key, remap[id]);
            remapped.push(id);
            continue;
        }
        if (keepIds.has(id) || keepCommands.has(command)) continue;
        key.setAttribute("disabled", "true");
        key.removeAttribute("reserved");
        disabled.push(id || command || "анонимный");
    }

    window.__keymapActions = KEYMAP_ACTIONS;
    for (const [combo, action] of Object.entries(conf.custom || {})) {
        if (!(action in KEYMAP_ACTIONS)) {
            console.error("keymap: неизвестное действие " + action);
            continue;
        }
        const el = document.createXULElement("key");
        el.setAttribute("id", "keymap-" + action);
        applyCombo(el, combo);
        el.setAttribute("oncommand", "__keymapActions['" + action + "']()");
        keyset.appendChild(el);
    }

    // Firefox строит таблицу хоткеев keyset'а один раз при загрузке окна:
    // правки атрибутов вживую не подхватываются (отключение - исключение,
    // оно проверяется при диспетчеризации). Замена узла на клон заставляет
    // зарегистрировать все связки заново - канонический трюк ремап-скриптов.
    const rebuilt = keyset.cloneNode(true);
    keyset.parentNode.replaceChild(rebuilt, keyset);

    const report = [];
    for (const id of remapped) {
        const k = rebuilt.querySelector("key#" + id);
        if (k) report.push(id + "=" + (k.getAttribute("modifiers") || "") + "+" +
            (k.getAttribute("key") || "?"));
    }
    console.info("keymap: отключено " + disabled.length + ", кастомных " +
        Object.keys(conf.custom || {}).length + "; ремапы: " + report.join(" "));
})();
