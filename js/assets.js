// assets.js — upload/list/embed assets; resolve `asset:NAME` references.
window.App = window.App || {};

(function () {
  "use strict";

  // name -> { record, url }
  var items = {};

  function kind(type) {
    if (/^image\//.test(type)) return "image";
    if (/^video\//.test(type)) return "video";
    if (/^audio\//.test(type)) return "audio";
    return "file";
  }

  function uniqueName(name) {
    if (!items[name]) return name;
    var dot = name.lastIndexOf(".");
    var base = dot > 0 ? name.slice(0, dot) : name;
    var ext = dot > 0 ? name.slice(dot) : "";
    var i = 2;
    while (items[base + "-" + i + ext]) i++;
    return base + "-" + i + ext;
  }

  function addRecord(record) {
    var url = URL.createObjectURL(record.blob);
    items[record.name] = { record: record, url: url };
  }

  function load() {
    if (!App.Storage.available) { render(); return Promise.resolve(); }
    return App.Storage.assetGetAll().then(function (records) {
      (records || []).forEach(addRecord);
      render();
    }).catch(function () { render(); });
  }

  function addFiles(fileList) {
    var files = Array.prototype.slice.call(fileList || []);
    var chain = Promise.resolve();
    files.forEach(function (file) {
      var name = uniqueName(file.name);
      var record = {
        name: name,
        type: file.type || "application/octet-stream",
        size: file.size,
        blob: file,
        addedAt: Date.now()
      };
      addRecord(record);
      chain = chain.then(function () {
        return App.Storage.available ? App.Storage.assetPut(record) : null;
      });
    });
    return chain.then(function () {
      render();
      if (App.refresh) App.refresh(false);
    });
  }

  function remove(name) {
    var it = items[name];
    if (it && it.url) URL.revokeObjectURL(it.url);
    delete items[name];
    var p = App.Storage.available ? App.Storage.assetDelete(name) : Promise.resolve();
    return p.then(function () {
      render();
      if (App.refresh) App.refresh(false);
    });
  }

  function snippetFor(name, type) {
    switch (kind(type)) {
      case "image": return "![](asset:" + name + ")";
      case "video": return '<video src="asset:' + name + '" controls width="640"></video>';
      case "audio": return '<audio src="asset:' + name + '" controls></audio>';
      default: return '<a href="asset:' + name + '">' + name + "</a>";
    }
  }

  function insert(name, type) {
    if (!App.Editor) return;
    App.Editor.insertAtCursor(snippetFor(name, type));
    if (App.refresh) App.refresh(true);
  }

  // Replace asset:NAME references with their blob: URLs.
  function resolve(html) {
    if (!html) return html;
    return html.replace(/asset:([^\s"')>]+)/g, function (whole, name) {
      var decoded;
      try { decoded = decodeURIComponent(name); } catch (e) { decoded = name; }
      var it = items[decoded] || items[name];
      return it ? it.url : whole;
    });
  }

  // ---- UI ----
  function render() {
    var list = document.getElementById("asset-list");
    if (!list) return;
    var names = Object.keys(items).sort();
    if (!names.length) {
      list.innerHTML = '<p class="placeholder">No assets yet. Upload images, audio, or video above.</p>';
      return;
    }
    list.innerHTML = "";
    names.forEach(function (name) {
      var it = items[name];
      var k = kind(it.record.type);

      var card = document.createElement("div");
      card.className = "asset-card";

      var thumb = document.createElement("div");
      thumb.className = "asset-thumb";
      if (k === "image") {
        var img = document.createElement("img");
        img.src = it.url;
        thumb.appendChild(img);
      } else {
        thumb.textContent = k === "video" ? "🎬" : k === "audio" ? "🎵" : "📄";
        thumb.classList.add("asset-thumb-icon");
      }

      var meta = document.createElement("div");
      meta.className = "asset-meta";
      var nm = document.createElement("div");
      nm.className = "asset-name";
      nm.textContent = name;
      nm.title = name;
      var sz = document.createElement("div");
      sz.className = "asset-size";
      sz.textContent = humanSize(it.record.size);
      meta.appendChild(nm);
      meta.appendChild(sz);

      var actions = document.createElement("div");
      actions.className = "asset-actions";
      var insertBtn = document.createElement("button");
      insertBtn.className = "tb-btn";
      insertBtn.textContent = "Insert";
      insertBtn.addEventListener("click", function () { insert(name, it.record.type); });
      var delBtn = document.createElement("button");
      delBtn.className = "tb-btn asset-del";
      delBtn.textContent = "Delete";
      delBtn.addEventListener("click", function () { remove(name); });
      actions.appendChild(insertBtn);
      actions.appendChild(delBtn);

      card.appendChild(thumb);
      card.appendChild(meta);
      card.appendChild(actions);
      list.appendChild(card);
    });
  }

  function humanSize(bytes) {
    if (bytes == null) return "";
    if (bytes < 1024) return bytes + " B";
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + " KB";
    return (bytes / (1024 * 1024)).toFixed(1) + " MB";
  }

  function init() {
    var input = document.getElementById("asset-upload");
    if (input) {
      input.addEventListener("change", function () {
        addFiles(input.files).then(function () { input.value = ""; });
      });
    }
    var drop = document.getElementById("asset-list");
    if (drop) {
      ["dragover"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.add("dragover"); });
      });
      ["dragleave", "drop"].forEach(function (ev) {
        drop.addEventListener(ev, function (e) { e.preventDefault(); drop.classList.remove("dragover"); });
      });
      drop.addEventListener("drop", function (e) {
        if (e.dataTransfer && e.dataTransfer.files) addFiles(e.dataTransfer.files);
      });
    }
    load();
  }

  App.Assets = {
    init: init,
    resolve: resolve,
    addFiles: addFiles,
    remove: remove
  };
})();
