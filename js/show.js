// show.js — fullscreen slideshow / live presentation mode.
//
// Hides the editor, goes fullscreen, and shows one slide at a time (16:9
// letterboxed on black). Keyboard: ←/→/Space step, Home first, Esc/F exit.
window.App = window.App || {};

(function () {
  "use strict";

  var overlay, wrap, frame, counter;
  var active = false;
  var index = 0;

  function build() {
    overlay = document.getElementById("show");
    wrap = document.getElementById("show-frame-wrap");
    counter = document.getElementById("show-counter");
    if (overlay && !frame) {
      frame = document.createElement("iframe");
      frame.width = App.Preview.LOGICAL_W;
      frame.height = App.Preview.LOGICAL_H;
      frame.setAttribute(
        "sandbox",
        "allow-scripts allow-same-origin allow-popups allow-forms allow-modals"
      );
      wrap.appendChild(frame);
    }
  }

  function slides() {
    return (App.state.parsed && App.state.parsed.slides) || [];
  }

  function renderCurrent() {
    var list = slides();
    if (!list.length) return;
    if (index < 0) index = 0;
    if (index > list.length - 1) index = list.length - 1;
    frame.srcdoc = App.Preview.slideHTML(list[index]);
    if (counter) counter.textContent = (index + 1) + " / " + list.length;
    fit();
  }

  function fit() {
    if (!wrap) return;
    var scale = Math.min(
      window.innerWidth / App.Preview.LOGICAL_W,
      window.innerHeight / App.Preview.LOGICAL_H
    );
    if (!isFinite(scale) || scale <= 0) scale = 0.01;
    wrap.style.width = App.Preview.LOGICAL_W + "px";
    wrap.style.height = App.Preview.LOGICAL_H + "px";
    wrap.style.transformOrigin = "center center";
    wrap.style.transform = "scale(" + scale + ")";
  }

  function next() { index++; renderCurrent(); }
  function prev() { index--; renderCurrent(); }
  function home() { index = 0; renderCurrent(); }

  function onKey(e) {
    if (!active) return;
    switch (e.key) {
      case "ArrowRight":
      case "PageDown":
      case " ":
        e.preventDefault(); next(); break;
      case "ArrowLeft":
      case "PageUp":
        e.preventDefault(); prev(); break;
      case "Home":
        e.preventDefault(); home(); break;
      case "End":
        e.preventDefault(); index = slides().length - 1; renderCurrent(); break;
      case "Escape":
      case "f":
      case "F":
        exit(); break;
    }
  }

  function onFsChange() {
    // If the user left fullscreen (e.g. Esc), tear the overlay down too.
    if (active && !document.fullscreenElement) exit();
  }

  function enter() {
    build();
    if (!overlay || !slides().length) return;
    active = true;
    index = App.state.activeIndex || 0;
    overlay.classList.add("active");
    document.addEventListener("keydown", onKey, true);
    document.addEventListener("fullscreenchange", onFsChange);
    window.addEventListener("resize", fit);
    renderCurrent();
    if (overlay.requestFullscreen) {
      overlay.requestFullscreen().catch(function () {});
    }
  }

  function exit() {
    if (!active) return;
    active = false;
    overlay.classList.remove("active");
    document.removeEventListener("keydown", onKey, true);
    document.removeEventListener("fullscreenchange", onFsChange);
    window.removeEventListener("resize", fit);
    if (document.fullscreenElement && document.exitFullscreen) {
      document.exitFullscreen().catch(function () {});
    }
    // Reflect where we ended up back in the editor.
    if (App.goToSlide) App.goToSlide(index, true);
  }

  function init() {
    build();
    var nextBtn = document.getElementById("show-next");
    var prevBtn = document.getElementById("show-prev");
    var exitBtn = document.getElementById("show-exit");
    if (nextBtn) nextBtn.addEventListener("click", next);
    if (prevBtn) prevBtn.addEventListener("click", prev);
    if (exitBtn) exitBtn.addEventListener("click", exit);
  }

  App.Show = { init: init, enter: enter, exit: exit, isActive: function () { return active; } };
})();
