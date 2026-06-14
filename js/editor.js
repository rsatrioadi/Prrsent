// editor.js — textarea handling and cursor<->line mapping.
window.App = window.App || {};

(function () {
  "use strict";

  var ta = null;

  function el() {
    if (!ta) ta = document.getElementById("editor");
    return ta;
  }

  function getValue() {
    return el().value;
  }

  function setValue(text) {
    el().value = text;
  }

  // Line index (0-based) of the current caret position.
  function getCursorLine() {
    var t = el();
    var pos = t.selectionStart || 0;
    var before = t.value.slice(0, pos);
    var nl = before.match(/\n/g);
    return nl ? nl.length : 0;
  }

  // Move the caret to the start of the given line index and focus.
  function setCursorToLine(line) {
    var t = el();
    var lines = t.value.split("\n");
    if (line < 0) line = 0;
    if (line >= lines.length) line = lines.length - 1;
    var offset = 0;
    for (var i = 0; i < line; i++) offset += lines[i].length + 1; // +1 for "\n"
    t.focus();
    t.setSelectionRange(offset, offset);
    scrollCaretIntoView(line, lines.length);
  }

  // Best-effort: scroll the textarea so the target line is roughly visible.
  function scrollCaretIntoView(line, total) {
    var t = el();
    var ratio = total > 1 ? line / (total - 1) : 0;
    var target = ratio * (t.scrollHeight - t.clientHeight);
    // Keep a little context above the caret.
    t.scrollTop = Math.max(0, target - t.clientHeight * 0.3);
  }

  // Insert text at the caret, replacing any selection. Optionally place the
  // caret at a relative offset within the inserted text.
  function insertAtCursor(text, caretOffset) {
    var t = el();
    var s = t.selectionStart || 0;
    var e = t.selectionEnd || 0;
    t.value = t.value.slice(0, s) + text + t.value.slice(e);
    var pos = caretOffset == null ? s + text.length : s + caretOffset;
    t.focus();
    t.setSelectionRange(pos, pos);
  }

  // Wrap the current selection (or a placeholder) with `before`/`after`, leaving
  // the inner text selected so the user can type over it.
  function wrapSelection(before, after, placeholder) {
    var t = el();
    var s = t.selectionStart || 0;
    var e = t.selectionEnd || 0;
    var sel = t.value.slice(s, e) || (placeholder || "");
    var replacement = before + sel + after;
    t.value = t.value.slice(0, s) + replacement + t.value.slice(e);
    var innerStart = s + before.length;
    t.focus();
    t.setSelectionRange(innerStart, innerStart + sel.length);
  }

  App.Editor = {
    el: el,
    getValue: getValue,
    setValue: setValue,
    getCursorLine: getCursorLine,
    setCursorToLine: setCursorToLine,
    insertAtCursor: insertAtCursor,
    wrapSelection: wrapSelection
  };
})();
