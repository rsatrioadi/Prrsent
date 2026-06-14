// app.js — wires modules together: tab switching, nav bar, autosave.
window.App = window.App || {};

(function () {
  "use strict";

  function initTabs() {
    var tabs = document.querySelectorAll("#tab-bar .tab");
    var panels = document.querySelectorAll(".tab-panel");

    tabs.forEach(function (tab) {
      tab.addEventListener("click", function () {
        var name = tab.dataset.tab;
        tabs.forEach(function (t) { t.classList.toggle("active", t === tab); });
        panels.forEach(function (p) {
          p.classList.toggle("active", p.dataset.panel === name);
        });
      });
    });
  }

  function init() {
    initTabs();
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  App.init = init;
})();
