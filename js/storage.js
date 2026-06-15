// storage.js — IndexedDB persistence.
//
// Two stores:
//   kv     — out-of-line key/value (project markdown, theme CSS) [used in M7]
//   assets — records { name, type, size, blob, addedAt } keyed by name
window.App = window.App || {};

(function () {
  "use strict";

  var DB_NAME = "prrsent";
  var DB_VERSION = 1;
  var dbPromise = null;

  function open() {
    if (dbPromise) return dbPromise;
    dbPromise = new Promise(function (resolve, reject) {
      if (!window.indexedDB) {
        reject(new Error("IndexedDB unavailable"));
        return;
      }
      var req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = function () {
        var db = req.result;
        if (!db.objectStoreNames.contains("kv")) db.createObjectStore("kv");
        if (!db.objectStoreNames.contains("assets")) {
          db.createObjectStore("assets", { keyPath: "name" });
        }
      };
      req.onsuccess = function () { resolve(req.result); };
      req.onerror = function () { reject(req.error); };
    });
    return dbPromise;
  }

  function tx(store, mode) {
    return open().then(function (db) {
      return db.transaction(store, mode).objectStore(store);
    });
  }

  function wrap(request) {
    return new Promise(function (resolve, reject) {
      request.onsuccess = function () { resolve(request.result); };
      request.onerror = function () { reject(request.error); };
    });
  }

  // ---- key/value ----
  function kvGet(key) {
    return tx("kv", "readonly").then(function (s) { return wrap(s.get(key)); });
  }
  function kvSet(key, value) {
    return tx("kv", "readwrite").then(function (s) { return wrap(s.put(value, key)); });
  }

  // ---- assets ----
  function assetPut(record) {
    return tx("assets", "readwrite").then(function (s) { return wrap(s.put(record)); });
  }
  function assetGetAll() {
    return tx("assets", "readonly").then(function (s) { return wrap(s.getAll()); });
  }
  function assetDelete(name) {
    return tx("assets", "readwrite").then(function (s) { return wrap(s.delete(name)); });
  }
  function assetClear() {
    return tx("assets", "readwrite").then(function (s) { return wrap(s.clear()); });
  }

  App.Storage = {
    open: open,
    kvGet: kvGet,
    kvSet: kvSet,
    assetPut: assetPut,
    assetGetAll: assetGetAll,
    assetDelete: assetDelete,
    assetClear: assetClear,
    available: !!window.indexedDB
  };
})();
