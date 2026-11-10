// ==UserScript==
// @name            keymap
// @description     allowlist-раскладка хоткеев ядра, конфиг - keymap.json
// @author          s3nn1k
// @homepageURL     https://github.com/s3nn1k/librewolf-config
// ==/UserScript==

// keep - остаются нативными; remap (id ключа -> новая комбинация) и custom
// (комбинация -> действие) вешаются через UC_API.Hotkeys в отдельный ucKeySet;
// всё остальное в mainKeyset гасится - fail-closed. Сторонние keyset'ы
// (расширения вроде Sidebery, devtools) не трогаем. Комбинации вида "C+S+n".

const ACTIONS = {
    "scroll-down": win => scrollHalfPage(win, true),
    "scroll-up": win => scrollHalfPage(win, false),
    "focus-urlbar": win => {
        if (win.gURLBar) { win.gURLBar.focus(); win.gURLBar.select(); }
    },
};

// windowUtils.sendKeyEvent из Gecko выпилен: скроллим страницу frame script'ом
// через messageManager - исполняется в процессе контента, честные полстраницы.
function scrollHalfPage(win, down) {
    const browser = win.gBrowser && win.gBrowser.selectedBrowser;
    if (!browser || !browser.messageManager) return;
    const sign = down ? "" : "-";
    browser.messageManager.loadFrameScript(
        "data:,content.scrollBy(0, " + sign + "content.innerHeight / 2);", false);
}

// "C+S+n" -> { modifiers: "accel shift", key: "n" } - формат UC_API.Hotkeys.
function comboToHotkey(combo) {
    const parts = combo.split("+");
    const key = parts.pop();
    const mod = { C: "accel", S: "shift", A: "alt", M: "meta" };
    return { modifiers: parts.map(p => mod[p]).join(" "), key };
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
        console.error("keymap: fx-autoconfig не загрузился");
        return;
    }
    const keyset = document.getElementById("mainKeyset");
    if (!keyset) return;

    // 1. Allowlist: гасим всё непокрытое в mainKeyset.
    const keepIds = new Set(conf.keep.ids || []);
    const keepCommands = new Set(conf.keep.commands || []);
    let disabled = 0;
    for (const k of keyset.querySelectorAll("key")) {
        const id = k.getAttribute("id") || "";
        const command = k.getAttribute("command") || "";
        if (keepIds.has(id) || keepCommands.has(command)) continue;
        k.setAttribute("disabled", "true");
        k.removeAttribute("reserved");
        disabled++;
    }

    // 2. Ремапы и кастомы - в ucKeySet. Команда исполняется явным doCommand()
    // на <command> из mainCommandSet: его switch в browser-sets.js делает работу.
    const bind = (name, combo, command) =>
        UC_API.Hotkeys
            .define({ id: "keymap-" + name, ...comboToHotkey(combo), command })
            .attachToWindow(window, { suppressOriginal: true });

    for (const [id, combo] of Object.entries(conf.remap || {})) {
        const orig = keyset.querySelector("key#" + id);
        const command = orig && orig.getAttribute("command");
        if (!command) { console.error("keymap: " + id + " без command"); continue; }
        bind(id, combo, win => {
            const el = win.document.getElementById(command);
            if (el) el.doCommand();
        });
    }
    for (const [combo, action] of Object.entries(conf.custom || {})) {
        if (!ACTIONS[action]) { console.error("keymap: действие " + action); continue; }
        bind(action, combo, win => ACTIONS[action](win));
    }

    console.info("keymap: отключено " + disabled);
})();
