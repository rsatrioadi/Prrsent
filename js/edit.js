// edit.js — per-tab undo/redo history and the Edit menu.
//
// Each editor tab ("editor" = Markdown, "theme" = theme CSS) keeps its own
// independent undo/redo stacks of { value, selStart, selEnd } snapshots. Typing
// bursts coalesce into one step; discrete programmatic edits (toolbar/asset
// inserts, theme presets) record their own step; document loads reset history.
window.App = window.App || {};

(function () {
  "use strict";

  var COALESCE_MS = 500;
  var MAX_STACK = 200;

  // name -> { ta, undo, redo, present, coalescing, timer, onRestore }
  var recs = {};

  function snapshot(ta) {
    return {
      value: ta.value,
      selStart: ta.selectionStart || 0,
      selEnd: ta.selectionEnd || 0
    };
  }

  function apply(ta, snap) {
    ta.value = snap.value;
    ta.focus();
    ta.setSelectionRange(snap.selStart, snap.selEnd);
  }

  function register(name, ta, onRestore) {
    if (!ta) return;
    var rec = {
      ta: ta,
      undo: [],
      redo: [],
      present: snapshot(ta),
      coalescing: false,
      timer: null,
      onRestore: onRestore
    };
    recs[name] = rec;

    ta.addEventListener("input", function () {
      if (!rec.coalescing) {
        rec.undo.push(rec.present);
        if (rec.undo.length > MAX_STACK) rec.undo.shift();
        rec.redo = [];
      }
      rec.present = snapshot(ta);
      rec.coalescing = true;
      clearTimeout(rec.timer);
      rec.timer = setTimeout(function () { rec.coalescing = false; }, COALESCE_MS);
    });
  }

  // Commit a discrete programmatic edit already applied to the textarea.
  function record(name) {
    var rec = recs[name];
    if (!rec) return;
    clearTimeout(rec.timer);
    rec.coalescing = false;
    rec.undo.push(rec.present);
    if (rec.undo.length > MAX_STACK) rec.undo.shift();
    rec.redo = [];
    rec.present = snapshot(rec.ta);
  }

  // Clear history and re-baseline to the current textarea contents.
  function reset(name) {
    var rec = recs[name];
    if (!rec) return;
    clearTimeout(rec.timer);
    rec.coalescing = false;
    rec.undo = [];
    rec.redo = [];
    rec.present = snapshot(rec.ta);
  }

  function undo(name) {
    var rec = recs[name];
    if (!rec || !rec.undo.length) return;
    clearTimeout(rec.timer);
    rec.coalescing = false;
    rec.redo.push(rec.present);
    rec.present = rec.undo.pop();
    apply(rec.ta, rec.present);
    if (rec.onRestore) rec.onRestore();
  }

  function redo(name) {
    var rec = recs[name];
    if (!rec || !rec.redo.length) return;
    clearTimeout(rec.timer);
    rec.coalescing = false;
    rec.undo.push(rec.present);
    rec.present = rec.redo.pop();
    apply(rec.ta, rec.present);
    if (rec.onRestore) rec.onRestore();
  }

  function canUndo(name) { var r = recs[name]; return !!(r && r.undo.length); }
  function canRedo(name) { var r = recs[name]; return !!(r && r.redo.length); }

  // Which tab's history is currently in play: prefer the focused textarea,
  // else fall back to the active tab. Returns null when no editor is active.
  function activeName() {
    var ae = document.activeElement;
    if (recs.editor && ae === recs.editor.ta) return "editor";
    if (recs.theme && ae === recs.theme.ta) return "theme";
    var tab = document.querySelector("#tab-bar .tab.active");
    var name = tab ? tab.dataset.tab : null;
    if (name === "editor" || name === "theme") return name;
    return null;
  }

  // ---- restore callbacks ----
  function onRestoreEditor() {
    if (App.refresh) App.refresh(true);
    if (App.scheduleSave) App.scheduleSave();
    if (App.Project) App.Project.markDirty();
  }

  function onRestoreTheme() {
    if (App.Theme && App.Theme.apply) App.Theme.apply();
    if (App.onThemeChange) App.onThemeChange();
  }

  // ---- menu / shortcuts ----
  function closeAllMenus() {
    var menus = document.querySelectorAll(".menu-dropdown");
    for (var i = 0; i < menus.length; i++) menus[i].classList.remove("open");
  }
  App.closeAllMenus = closeAllMenus;

  function syncMenuState() {
    var name = activeName();
    setDisabled("mi-undo", !canUndo(name));
    setDisabled("mi-redo", !canRedo(name));
    setDisabled("mi-selectall", name == null);
  }

  function setDisabled(id, val) {
    var b = document.getElementById(id);
    if (b) b.disabled = !!val;
  }

  function selectAll() {
    var name = activeName();
    if (!name) return;
    var rec = recs[name];
    if (rec) { rec.ta.focus(); rec.ta.select(); }
  }

  function wireMenu() {
    var btn = document.getElementById("menu-edit");
    var menu = document.getElementById("menu-edit-dropdown");
    if (btn && menu) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        var willOpen = !menu.classList.contains("open");
        closeAllMenus();
        if (willOpen) { syncMenuState(); menu.classList.add("open"); }
      });
      menu.addEventListener("click", function (e) { e.stopPropagation(); });
      document.addEventListener("click", closeAllMenus);
    }
    bind("mi-undo", function () { undo(activeName()); });
    bind("mi-redo", function () { redo(activeName()); });
    bind("mi-selectall", selectAll);
  }

  function bind(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { closeAllMenus(); fn(); });
  }

  function onKey(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    var k = (e.key || "").toLowerCase();
    if (k !== "z" && k !== "y") return;
    var name = activeName();
    if (!name) return;
    if (document.activeElement !== recs[name].ta) return;
    e.preventDefault();
    if (k === "y" || (k === "z" && e.shiftKey)) redo(name);
    else undo(name);
  }

  function init() {
    register("editor", document.getElementById("editor"), onRestoreEditor);
    register("theme", document.getElementById("theme-editor"), onRestoreTheme);
    wireMenu();
    document.addEventListener("keydown", onKey, true);
  }

  App.Edit = {
    init: init,
    record: record,
    reset: reset,
    undo: undo,
    redo: redo,
    canUndo: canUndo,
    canRedo: canRedo
  };
})();
