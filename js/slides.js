// slides.js — parse markdown source into slides with line ranges.
//
// Slides are separated by a line that is exactly "---" (Marp convention).
// An optional leading frontmatter block ("---\n...\n---" at the very top) is
// captured separately and reserved for future global config.
window.App = window.App || {};

(function () {
  "use strict";

  function isSep(line) {
    return line.trim() === "---";
  }

  // Returns { slides, lineToSlide, frontmatter, lineCount }
  //   slides:      [{ markdown, startLine, endLine }]  (0-based, endLine inclusive)
  //   lineToSlide: array mapping each source line index -> slide index
  function parse(source) {
    source = source == null ? "" : String(source);
    var lines = source.split("\n");
    var slides = [];
    var frontmatter = null;
    var start = 0;

    // Leading frontmatter block.
    if (lines.length && isSep(lines[0])) {
      for (var k = 1; k < lines.length; k++) {
        if (isSep(lines[k])) {
          frontmatter = {
            text: lines.slice(1, k).join("\n"),
            startLine: 1,
            endLine: k - 1
          };
          start = k + 1;
          break;
        }
      }
    }

    var lineToSlide = new Array(lines.length);
    for (var z = 0; z < lines.length; z++) lineToSlide[z] = 0;

    var curStart = start;
    for (var i = start; i <= lines.length; i++) {
      var sep = i < lines.length && isSep(lines[i]);
      if (sep || i === lines.length) {
        var endLine = i - 1;
        slides.push({
          markdown: lines.slice(curStart, i).join("\n"),
          startLine: curStart,
          endLine: Math.max(curStart, endLine)
        });
        // The separator line itself belongs to the slide just ended.
        if (sep) lineToSlide[i] = slides.length - 1;
        curStart = i + 1;
      }
    }

    if (slides.length === 0) {
      slides.push({ markdown: "", startLine: start, endLine: start });
    }

    // Map each content line to its slide.
    for (var s = 0; s < slides.length; s++) {
      for (var L = slides[s].startLine; L <= slides[s].endLine; L++) {
        if (L >= 0 && L < lines.length) lineToSlide[L] = s;
      }
    }
    // Frontmatter lines map to the first slide.
    for (var f = 0; f < start && f < lines.length; f++) lineToSlide[f] = 0;

    return {
      slides: slides,
      lineToSlide: lineToSlide,
      frontmatter: frontmatter,
      lineCount: lines.length
    };
  }

  function slideAtLine(parsed, line) {
    if (!parsed || !parsed.lineToSlide.length) return 0;
    if (line < 0) line = 0;
    if (line >= parsed.lineToSlide.length) line = parsed.lineToSlide.length - 1;
    return parsed.lineToSlide[line];
  }

  function lineForSlide(parsed, index) {
    if (!parsed || !parsed.slides[index]) return 0;
    return parsed.slides[index].startLine;
  }

  App.Slides = {
    parse: parse,
    slideAtLine: slideAtLine,
    lineForSlide: lineForSlide
  };
})();
