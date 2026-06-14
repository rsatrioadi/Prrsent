// preview.js — render the active slide into a sandboxed, 16:9-scaled iframe.
//
// The iframe has a fixed logical resolution (1280x720); the wrapper is scaled
// with a CSS transform to fit the available stage while preserving 16:9.
window.App = window.App || {};

(function () {
  "use strict";

  var LOGICAL_W = 1280;
  var LOGICAL_H = 720;
  var STAGE_PAD = 32; // breathing room around the slide

  // Default in-slide styling. The theme tab (M6) appends/overrides this.
  var BASE_CSS = [
    "*{box-sizing:border-box}",
    "html,body{margin:0;padding:0;height:100%;width:100%}",
    "body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;",
    "background:#fff;color:#1a1a1a}",
    ".slide{width:" + LOGICAL_W + "px;height:" + LOGICAL_H + "px;padding:64px 72px;",
    "overflow:hidden;display:flex;flex-direction:column;justify-content:flex-start;",
    "align-items:flex-start;",
    /* Base font size on the slide so ALL descendants (pre, button, code, etc.)
       inherit a consistent starting point instead of the browser's 16px default. */
    "font-size:28px;line-height:1.45}",
    ".slide>:first-child{margin-top:0}",
    "h1{font-size:60px;line-height:1.1;margin:0 0 24px}",
    "h2{font-size:44px;line-height:1.15;margin:0 0 20px}",
    "h3{font-size:34px;margin:0 0 16px}",
    "p,li{font-size:1em}",   // now relative — inherits 28px from .slide
    "ul,ol{margin:0 0 16px;padding-left:1.2em}",
    /* Browsers don't let button/input/select/textarea inherit font by default. */
    "button,input,select,textarea{font-family:inherit;font-size:inherit;line-height:inherit}",
    "code{font-family:'SF Mono',Menlo,Consolas,monospace;font-size:0.85em;",
    "background:#f0f0f0;padding:2px 6px;border-radius:4px}",
    "pre{background:#f5f5f5;padding:20px;border-radius:8px;overflow:auto;",
    /* pre normally resets to a small monospace via UA stylesheet; force inherit */
    "font-size:inherit}",
    "pre code{background:none;padding:0;font-size:0.85em}",
    "img,video{max-width:100%;max-height:100%}",
    "a{color:#0e639c}",
    "blockquote{border-left:4px solid #ddd;margin:0 0 16px;padding-left:20px;color:#555}"
  ].join("");

  var frame = null;

  function ensureFrame() {
    if (frame) return frame;
    var wrap = document.getElementById("slide-frame-wrap");
    frame = document.createElement("iframe");
    frame.width = LOGICAL_W;
    frame.height = LOGICAL_H;
    frame.setAttribute(
      "sandbox",
      "allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
    );
    wrap.appendChild(frame);
    return frame;
  }

  function buildDoc(bodyHTML) {
    var css = BASE_CSS + (App.Preview.themeCSS || "");
    return (
      "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<style>" + css + "</style></head><body>" +
      "<div class='slide'>" + bodyHTML + "</div></body></html>"
    );
  }

  function renderMarkdown(md) {
    if (window.marked && typeof marked.parse === "function") {
      return marked.parse(md || "");
    }
    // Fallback if marked failed to load.
    return "<pre>" + (md || "").replace(/[&<>]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;" }[c];
    }) + "</pre>";
  }

  // Full HTML document for a slide (markdown -> html -> asset resolve -> doc).
  // Shared by the live preview and the slideshow.
  function slideHTML(slide) {
    var html = renderMarkdown(slide ? slide.markdown : "");
    if (App.Assets && App.Assets.resolve) html = App.Assets.resolve(html);
    return buildDoc(html);
  }

  // Render a slide object ({ markdown }) into the preview iframe.
  function render(slide) {
    ensureFrame();
    frame.srcdoc = slideHTML(slide);
    fit();
  }

  // Scale the wrapper to fit the stage while keeping the 16:9 box.
  function fit() {
    var stage = document.getElementById("preview-stage");
    var wrap = document.getElementById("slide-frame-wrap");
    if (!stage || !wrap) return;
    var sw = stage.clientWidth - STAGE_PAD;
    var sh = stage.clientHeight - STAGE_PAD;
    var scale = Math.min(sw / LOGICAL_W, sh / LOGICAL_H);
    if (!isFinite(scale) || scale <= 0) scale = 0.01;
    wrap.style.width = LOGICAL_W + "px";
    wrap.style.height = LOGICAL_H + "px";
    wrap.style.transformOrigin = "center center";
    wrap.style.transform = "scale(" + scale + ")";
  }

  App.Preview = {
    themeCSS: "",
    render: render,
    slideHTML: slideHTML,
    fit: fit,
    LOGICAL_W: LOGICAL_W,
    LOGICAL_H: LOGICAL_H
  };

  window.addEventListener("resize", fit);
})();
