// project.js — single-document interface: File > New / Open / Save / Save As.
//
// Project files are JSON (.prrsent) bundling markdown, theme CSS, and assets
// inlined as data: URLs. Uses the File System Access API for true Save-to-the-
// same-file when available, falling back to download/upload otherwise.
window.App = window.App || {};

(function () {
  "use strict";

  var EXT = ".prrsent";
  var FORMAT = "prrsent";
  var hasFS = !!(window.showSaveFilePicker && window.showOpenFilePicker);

  // Current document state.
  var cur = { name: null, handle: null, dirty: false };

  // ---- title / dirty ----
  function label() {
    return (cur.dirty ? "● " : "") + (cur.name || "Untitled");
  }
  function updateTitle() {
    document.title = label() + " — Prrsent";
    var el = document.getElementById("doc-name");
    if (el) el.textContent = label();
  }
  function markDirty() { if (!cur.dirty) { cur.dirty = true; updateTitle(); } }
  function markClean() { cur.dirty = false; updateTitle(); }

  // ---- serialize / apply ----
  function serialize() {
    return App.Assets.exportSerializable().then(function (assets) {
      return JSON.stringify({
        format: FORMAT,
        version: 1,
        markdown: App.Editor.getValue(),
        theme: App.Theme.get(),
        assets: assets
      });
    });
  }

  function applyProject(obj) {
    if (!obj || obj.format !== FORMAT) {
      throw new Error("Not a Prrsent project file");
    }
    App.loadContent(obj.markdown || "", obj.theme != null ? obj.theme : undefined);
    return App.Assets.importSerializable(obj.assets || []);
  }

  function persistMeta() {
    if (!App.Storage || !App.Storage.available) return;
    App.Storage.kvSet("docName", cur.name);
    // FileSystemFileHandle is structured-cloneable; store it for reuse on reload.
    App.Storage.kvSet("docHandle", cur.handle).catch(function () {});
  }

  // ---- helpers ----
  function baseName(fn) { return String(fn).replace(/\.[^.]+$/, ""); }
  function confirmDiscard() {
    return !cur.dirty || window.confirm("Discard unsaved changes to “" + (cur.name || "Untitled") + "”?");
  }
  function reportError(e) {
    if (e && e.name === "AbortError") return; // user cancelled a picker
    console.error(e);
    alert("Operation failed: " + (e && e.message ? e.message : e));
  }

  function verifyPermission(handle) {
    if (!handle || !handle.queryPermission) return Promise.resolve(true);
    var opts = { mode: "readwrite" };
    return handle.queryPermission(opts).then(function (p) {
      if (p === "granted") return true;
      return handle.requestPermission(opts).then(function (p2) { return p2 === "granted"; });
    });
  }

  function writeHandle(handle, text) {
    return handle.createWritable().then(function (w) {
      return w.write(text).then(function () { return w.close(); });
    });
  }

  // ---- commands ----
  function newDoc() {
    if (!confirmDiscard()) return;
    cur.name = null;
    cur.handle = null;
    App.Assets.importSerializable([]).then(function () {
      App.loadContent("# Untitled\n\n", App.Theme.DEFAULT);
      markClean();
      persistMeta();
    });
  }

  function openDoc() {
    if (!confirmDiscard()) return;
    if (hasFS) {
      window.showOpenFilePicker({
        types: [{ description: "Prrsent project", accept: { "application/json": [EXT] } }]
      }).then(function (handles) {
        var h = handles[0];
        return h.getFile().then(function (f) { return f.text(); }).then(function (text) {
          return loadText(text, baseName(h.name), h);
        });
      }).catch(reportError);
    } else {
      var input = document.getElementById("project-open-input");
      if (input) input.click();
    }
  }

  function loadText(text, name, handle) {
    var obj;
    try { obj = JSON.parse(text); }
    catch (e) { alert("That file isn't a valid Prrsent project."); return Promise.resolve(); }
    return Promise.resolve(applyProject(obj)).then(function () {
      cur.name = name;
      cur.handle = handle || null;
      markClean();
      persistMeta();
    }).catch(reportError);
  }

  function save() {
    if (hasFS && cur.handle) {
      return verifyPermission(cur.handle).then(function (ok) {
        if (!ok) return saveAs();
        return serialize()
          .then(function (json) { return writeHandle(cur.handle, json); })
          .then(function () { markClean(); persistMeta(); })
          .catch(reportError);
      });
    }
    return saveAs();
  }

  function saveAs() {
    return serialize().then(function (json) {
      if (hasFS) {
        return window.showSaveFilePicker({
          suggestedName: (cur.name || "presentation") + EXT,
          types: [{ description: "Prrsent project", accept: { "application/json": [EXT] } }]
        }).then(function (h) {
          return writeHandle(h, json).then(function () {
            cur.handle = h;
            cur.name = baseName(h.name);
            markClean();
            persistMeta();
          });
        }).catch(reportError);
      }
      download((cur.name || "presentation") + EXT, json);
      markClean();
    });
  }

  function download(name, text) {
    var blob = new Blob([text], { type: "application/json" });
    var url = URL.createObjectURL(blob);
    var a = document.createElement("a");
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
  }

  // ---- menu / shortcuts ----
  function closeMenu() {
    var m = document.getElementById("menu-file-dropdown");
    if (m) m.classList.remove("open");
  }

  function wireMenu() {
    var btn = document.getElementById("menu-file");
    var menu = document.getElementById("menu-file-dropdown");
    if (btn && menu) {
      btn.addEventListener("click", function (e) {
        e.stopPropagation();
        menu.classList.toggle("open");
      });
      menu.addEventListener("click", function (e) { e.stopPropagation(); });
      document.addEventListener("click", closeMenu);
    }
    bind("mi-new", newDoc);
    bind("mi-open", openDoc);
    bind("mi-save", save);
    bind("mi-saveas", saveAs);
  }

  function bind(id, fn) {
    var b = document.getElementById(id);
    if (b) b.addEventListener("click", function () { closeMenu(); fn(); });
  }

  function onKey(e) {
    if (!(e.metaKey || e.ctrlKey)) return;
    var k = (e.key || "").toLowerCase();
    if (k === "s") { e.preventDefault(); if (e.shiftKey) saveAs(); else save(); }
    else if (k === "o") { e.preventDefault(); openDoc(); }
  }

  function restoreMeta() {
    if (!App.Storage || !App.Storage.available) return Promise.resolve();
    return Promise.all([
      App.Storage.kvGet("docName"),
      App.Storage.kvGet("docHandle")
    ]).then(function (r) {
      if (typeof r[0] === "string") cur.name = r[0];
      if (r[1]) cur.handle = r[1];
      updateTitle();
    }).catch(function () {});
  }

  function init() {
    wireMenu();

    var input = document.getElementById("project-open-input");
    if (input) {
      input.addEventListener("change", function () {
        var f = input.files[0];
        if (!f) return;
        f.text().then(function (t) { return loadText(t, baseName(f.name), null); });
        input.value = "";
      });
    }

    document.addEventListener("keydown", onKey, true);
    window.addEventListener("beforeunload", function (e) {
      if (cur.dirty) { e.preventDefault(); e.returnValue = ""; }
    });

    restoreMeta();
    updateTitle();
  }

  App.Project = {
    init: init,
    markDirty: markDirty,
    markClean: markClean,
    newDoc: newDoc,
    open: openDoc,
    save: save,
    saveAs: saveAs
  };
})();
