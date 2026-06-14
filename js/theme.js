// theme.js — editable theme CSS applied to every slide iframe.
window.App = window.App || {};

(function () {
  "use strict";

  var DEFAULT_THEME = [
    "/* Theme CSS — applied to every slide. */",
    "/* The editor ships sensible base styles; override them here. */",
    "",
    ".slide {",
    "  /* background: #ffffff; */",
    "  /* color: #1a1a1a; */",
    "}",
    "",
    "h1 { /* color: #0e639c; */ }"
  ].join("\n");

  var PRESETS = {
    Default: DEFAULT_THEME,
    Dark: [
      ".slide { background: #16161e; color: #e6e6e6; }",
      "h1, h2, h3 { color: #ffffff; }",
      "a { color: #7db5ff; }",
      "code { background: #2a2a38; color: #e6e6e6; }",
      "pre { background: #1e1e2a; }",
      "blockquote { border-color: #444; color: #aaa; }"
    ].join("\n"),
    Sunrise: [
      ".slide {",
      "  background: linear-gradient(135deg, #ff9a44, #ff5e8a);",
      "  color: #ffffff;",
      "}",
      "h1, h2, h3 { color: #ffffff; }",
      "a { color: #fff3c4; }",
      "code { background: rgba(255,255,255,0.2); color: #fff; }",
      "pre { background: rgba(0,0,0,0.25); }"
    ].join("\n"),
    Mono: [
      ".slide {",
      "  background: #f7f5f2; color: #1a1a1a;",
      "  font-family: 'SF Mono', Menlo, Consolas, monospace;",
      "}",
      "h1, h2, h3 { font-weight: 700; letter-spacing: -0.5px; }",
      "h1 { border-bottom: 4px solid #1a1a1a; padding-bottom: 12px; }"
    ].join("\n")
  };

  var ta = null;

  function el() {
    if (!ta) ta = document.getElementById("theme-editor");
    return ta;
  }

  function get() {
    return el() ? el().value : "";
  }

  // Apply current CSS to the preview and re-render the active slide.
  function apply() {
    App.Preview.themeCSS = get();
    if (App.refresh) App.refresh(false);
  }

  function set(css) {
    if (el()) el().value = css;
    apply();
  }

  function init() {
    var t = el();
    if (!t) return;
    if (!t.value) t.value = DEFAULT_THEME;

    t.addEventListener("input", function () {
      apply();
      if (App.onThemeChange) App.onThemeChange();
    });

    var select = document.getElementById("theme-preset");
    if (select) {
      Object.keys(PRESETS).forEach(function (name) {
        var opt = document.createElement("option");
        opt.value = name;
        opt.textContent = name;
        select.appendChild(opt);
      });
      select.addEventListener("change", function () {
        set(PRESETS[select.value] || "");
        if (App.onThemeChange) App.onThemeChange();
      });
    }

    apply();
  }

  App.Theme = {
    init: init,
    get: get,
    set: set,
    apply: apply,
    DEFAULT: DEFAULT_THEME,
    PRESETS: PRESETS
  };
})();
