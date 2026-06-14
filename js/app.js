// app.js — wires modules together: tab switching, render loop, nav bar, autosave.
window.App = window.App || {};

(function () {
  "use strict";

  var SAMPLE = [
    "# Prrsent",
    "",
    "A Marp-inspired deck editor.",
    "",
    "Move your cursor between slides — the preview follows.",
    "",
    "---",
    "",
    "## Markdown + HTML",
    "",
    "- Write plain **Markdown**",
    "- Or drop in raw HTML",
    "- Each slide renders in its own sandboxed iframe",
    "",
    "---",
    "",
    "## Interactive slides",
    "",
    "<button onclick=\"this.textContent = 'Clicked ' + (++this._n || (this._n=1)) + '×'\">",
    "  Click me",
    "</button>"
  ].join("\n");

  var state = {
    parsed: null,
    activeIndex: 0
  };

  // Re-parse the editor and render. `followCursor` decides whether the active
  // slide is derived from the caret position.
  function refresh(followCursor) {
    state.parsed = App.Slides.parse(App.Editor.getValue());
    if (followCursor) {
      var line = App.Editor.getCursorLine();
      state.activeIndex = App.Slides.slideAtLine(state.parsed, line);
    }
    clampActive();
    renderActive();
    updateCounter();
  }

  function clampActive() {
    var n = state.parsed ? state.parsed.slides.length : 0;
    if (state.activeIndex < 0) state.activeIndex = 0;
    if (state.activeIndex > n - 1) state.activeIndex = Math.max(0, n - 1);
  }

  function renderActive() {
    var slide = state.parsed.slides[state.activeIndex];
    App.Preview.render(slide);
  }

  function updateCounter() {
    var n = state.parsed ? state.parsed.slides.length : 0;
    var el = document.getElementById("nav-counter");
    if (el) el.textContent = n ? (state.activeIndex + 1) + " / " + n : "– / –";
    syncNavButtons();
  }

  function syncNavButtons() {
    var n = state.parsed ? state.parsed.slides.length : 0;
    var i = state.activeIndex;
    setDisabled("nav-prev", i <= 0);
    setDisabled("nav-home", i <= 0);
    setDisabled("nav-next", i >= n - 1);
  }

  function setDisabled(id, val) {
    var b = document.getElementById(id);
    if (b) b.disabled = !!val;
  }

  // Set the active slide and move the editor caret to its first line.
  function goToSlide(index, moveCursor) {
    if (!state.parsed) return;
    state.activeIndex = index;
    clampActive();
    if (moveCursor) {
      var line = App.Slides.lineForSlide(state.parsed, state.activeIndex);
      App.Editor.setCursorToLine(line);
    }
    renderActive();
    updateCounter();
  }

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

  function initEditor() {
    var ta = App.Editor.el();
    if (!ta.value) ta.value = SAMPLE;
    ta.setSelectionRange(0, 0); // start on the first slide

    // Only follow the caret once the user genuinely interacts — this ignores
    // synthetic selection/focus events fired by browser form restoration.
    var engaged = false;
    ["keydown", "pointerdown"].forEach(function (ev) {
      ta.addEventListener(ev, function () { engaged = true; });
    });

    // Content changes: re-parse and follow the caret.
    ta.addEventListener("input", function () {
      engaged = true;
      refresh(true);
    });

    // Caret moves without content change: just update the active slide.
    ["keyup", "click", "select"].forEach(function (ev) {
      ta.addEventListener(ev, function () {
        if (!engaged) return;
        var line = App.Editor.getCursorLine();
        var idx = App.Slides.slideAtLine(state.parsed, line);
        if (idx !== state.activeIndex) {
          state.activeIndex = idx;
          renderActive();
          updateCounter();
        }
      });
    });
  }

  function initNav() {
    var map = {
      "nav-home": function () { goToSlide(0, true); },
      "nav-prev": function () { goToSlide(state.activeIndex - 1, true); },
      "nav-next": function () { goToSlide(state.activeIndex + 1, true); }
    };
    Object.keys(map).forEach(function (id) {
      var b = document.getElementById(id);
      if (b) b.addEventListener("click", map[id]);
    });
  }

  function init() {
    initTabs();
    if (App.Toolbar && App.Toolbar.build) App.Toolbar.build();
    if (App.Assets && App.Assets.init) App.Assets.init();
    initEditor();
    initNav();
    state.activeIndex = 0; // always open on the first slide
    refresh(false);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", init);
  } else {
    init();
  }

  App.refresh = refresh;
  App.goToSlide = goToSlide;
  App.state = state;
})();
