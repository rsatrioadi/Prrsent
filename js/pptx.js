// pptx.js — export the deck to an editable .pptx via PptxGenJS.
//
// Unlike the PDF export (which prints the rendered HTML as-is), PowerPoint has
// no notion of arbitrary HTML/CSS, so each slide's rendered markdown is parsed
// into native PowerPoint objects: headings, paragraphs, bullet lists, code
// blocks and images. The result is a fully editable deck.
//
// Layout is a single top-to-bottom flow over the slide's content area. We
// estimate each block's height in the slide's logical 1280x720 px space, then
// apply one global scale factor so a dense slide shrinks to fit rather than
// overflowing the frame.
//
// Theme CSS (Prrsent's BASE_CSS + user overrides) is parsed at export time via
// getComputedStyle on hidden test elements, so exported slides reflect the same
// colours, fonts and backgrounds that appear in the live preview.
window.App = window.App || {};

(function () {
  "use strict";

  // Logical slide is 1280x720 px (see preview.js). A 16:9 PowerPoint slide is
  // 13.333 x 7.5 inches, so the px->inch factor is identical on both axes.
  var LOGICAL_W = 1280, LOGICAL_H = 720;
  var IN_W = 13.333, IN_H = 7.5;
  var PX = IN_W / LOGICAL_W;          // inches per logical px
  var PAD_X = 72, PAD_Y = 64;         // matches .slide padding in preview.js
  var CONTENT_W = LOGICAL_W - 2 * PAD_X;
  var AVAIL_H = LOGICAL_H - 2 * PAD_Y;

  // px font size by tag (preview.js: h1 60, h2 44, h3 34, body 28).
  var FONT_PX = { h1: 60, h2: 44, h3: 34, h4: 28, h5: 28, h6: 28, p: 28 };
  var LINE_H = 1.45;

  function pxToPt(px) { return px * 0.75; }       // 720px == 540pt
  function pxToIn(px) { return px * PX; }

  // ---- theme CSS parsing ----------------------------------------------------

  // Convert an rgb()/rgba() string to a 6-char uppercase hex string.
  // Returns null for transparent (alpha === 0) or unparsable values.
  function rgbToHex(rgb) {
    var m = String(rgb).match(
      /rgba?\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)(?:\s*,\s*([0-9.]+))?\s*\)/
    );
    if (!m) return null;
    if (m[4] !== undefined && parseFloat(m[4]) === 0) return null;
    return ((1 << 24) + (parseInt(m[1]) << 16) +
            (parseInt(m[2]) << 8) + parseInt(m[3]))
      .toString(16).slice(1).toUpperCase();
  }

  // Extract the effective background colour from an element, falling back to
  // the first colour stop of a CSS gradient when the element uses one.
  function extractBg(el) {
    var cs = getComputedStyle(el);
    var hex = rgbToHex(cs.backgroundColor);
    if (hex) return hex;
    // For gradient backgrounds, grab the first colour stop.
    var img = cs.backgroundImage;
    if (img && img !== "none") {
      var m = img.match(
        /rgba?\(\s*\d+\s*,\s*\d+\s*,\s*\d+(?:\s*,\s*[0-9.]+)?\s*\)/
      );
      if (m) return rgbToHex(m[0]);
    }
    return null;
  }

  // Read the first font-family value from computed style.
  function extractFont(el) {
    var ff = getComputedStyle(el).fontFamily || "";
    return ff.split(",")[0].replace(/['"]/g, "").trim() || null;
  }

  // Parse the active theme (BASE_CSS + user theme CSS) by briefly injecting
  // hidden test elements into the document and reading their computed styles.
  // Returns a flat object with 6-char hex colours (no '#') and font names.
  function parseThemeCSS() {
    var container = document.createElement("div");
    container.style.cssText =
      "position:absolute;left:-9999px;top:-9999px;" +
      "width:" + LOGICAL_W + "px;height:" + LOGICAL_H + "px;" +
      "overflow:hidden;visibility:hidden;pointer-events:none";

    var style = document.createElement("style");
    style.textContent = (App.Preview.BASE_CSS || "") +
                        (App.Preview.themeCSS || "");
    container.appendChild(style);

    var slide = document.createElement("div");
    slide.className = "slide";

    var h1   = document.createElement("h1");   h1.textContent   = "T";
    var h2   = document.createElement("h2");   h2.textContent   = "T";
    var h3   = document.createElement("h3");   h3.textContent   = "T";
    var p    = document.createElement("p");    p.textContent    = "T";
    var a    = document.createElement("a");    a.href = "#"; a.textContent = "T";
    var code = document.createElement("code"); code.textContent = "T";
    var pre  = document.createElement("pre");
    var preC = document.createElement("code"); preC.textContent = "T";
    pre.appendChild(preC);
    var bq   = document.createElement("blockquote");
    var bqP  = document.createElement("p"); bqP.textContent = "T";
    bq.appendChild(bqP);

    [h1, h2, h3, p, a, code, pre, bq].forEach(function (el) {
      slide.appendChild(el);
    });
    container.appendChild(slide);
    document.body.appendChild(container);

    var fg = function (el) { return rgbToHex(getComputedStyle(el).color); };

    var theme = {
      slideBg:      extractBg(slide) || "FFFFFF",
      textColor:    fg(p)            || "1A1A1A",
      fontFace:     extractFont(p)   || "Arial",
      h1Color:      fg(h1)           || fg(p) || "1A1A1A",
      h2Color:      fg(h2)           || fg(p) || "1A1A1A",
      h3Color:      fg(h3)           || fg(p) || "1A1A1A",
      h1FontFace:   extractFont(h1)  || extractFont(p) || "Arial",
      h2FontFace:   extractFont(h2)  || extractFont(p) || "Arial",
      h3FontFace:   extractFont(h3)  || extractFont(p) || "Arial",
      linkColor:    fg(a)            || "0E639C",
      codeColor:    fg(code)         || "333333",
      codeFontFace: extractFont(code) || "Consolas",
      preBg:        extractBg(pre)   || "F5F5F5",
      preCodeColor: fg(preC)         || "333333",
      quoteColor:   fg(bqP)          || "555555"
    };

    document.body.removeChild(container);
    return theme;
  }

  // ---- HTML -> blocks -------------------------------------------------------

  function copyOpts(o) {
    var c = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    return c;
  }

  // Extract inline formatting runs from an element for PptxGenJS rich text.
  // Returns [{ text, options:{ bold, italic, underline, fontFace, color } }].
  function inlineRuns(node, inherited, theme) {
    inherited = inherited || {};
    var runs = [];
    for (var i = 0; i < node.childNodes.length; i++) {
      var child = node.childNodes[i];
      if (child.nodeType === 3) { // text
        if (child.nodeValue) runs.push({ text: child.nodeValue, options: copyOpts(inherited) });
        continue;
      }
      if (child.nodeType !== 1) continue;
      var tag = child.tagName.toLowerCase();
      var opts = copyOpts(inherited);
      if (tag === "strong" || tag === "b") opts.bold = true;
      else if (tag === "em" || tag === "i") opts.italic = true;
      else if (tag === "u") opts.underline = true;
      else if (tag === "a") { opts.color = theme.linkColor; opts.underline = true; }
      else if (tag === "code") { opts.fontFace = theme.codeFontFace; opts.color = theme.codeColor; }
      else if (tag === "br") { runs.push({ text: "\n", options: copyOpts(inherited) }); continue; }
      runs.push.apply(runs, inlineRuns(child, opts, theme));
    }
    return runs;
  }

  function runsText(runs) {
    return runs.map(function (r) { return r.text; }).join("");
  }

  // Estimate wrapped line count for text of a given px font size in a width.
  function estimateLines(text, fontPx, widthPx) {
    var perLine = Math.max(1, Math.floor(widthPx / (fontPx * 0.5)));
    var total = 0;
    String(text).split("\n").forEach(function (seg) {
      total += Math.max(1, Math.ceil(seg.length / perLine));
    });
    return Math.max(1, total);
  }

  // Build a flat list of layout blocks from a slide's rendered HTML body.
  // Each block: { kind, ... , heightPx } where heightPx is the estimated
  // unscaled height (including bottom margin).
  function blocksFromHTML(html, theme) {
    var root = document.createElement("div");
    root.innerHTML = html;
    var blocks = [];

    function pushText(runs, fontPx, opts) {
      if (!runsText(runs).trim()) return;
      var lines = estimateLines(runsText(runs), fontPx, opts && opts.widthPx || CONTENT_W);
      var marginPx = opts && opts.marginPx != null ? opts.marginPx : fontPx * 0.6;
      blocks.push({
        kind: "text",
        runs: runs,
        fontPx: fontPx,
        align: opts && opts.align || "left",
        color: opts && opts.color,
        italic: opts && opts.italic,
        fontFace: opts && opts.fontFace,
        heightPx: lines * fontPx * LINE_H + marginPx
      });
    }

    // Recursively collect every <li> from a list tree (including arbitrarily
    // nested <ul>/<ol> children) into a flat array.  Each item carries its own
    // inline runs, indent level and list type so the caller can emit them all
    // inside a single PptxGenJS addText() call.
    function collectListItems(listEl, ordered, level) {
      var items = [];
      for (var i = 0; i < listEl.children.length; i++) {
        var li = listEl.children[i];
        if (li.tagName.toLowerCase() !== "li") continue;

        // Clone the <li> and strip nested lists so inlineRuns only sees
        // the item's own inline content.
        var inlineHost = li.cloneNode(true);
        Array.prototype.slice.call(inlineHost.children).forEach(function (c) {
          var t = c.tagName.toLowerCase();
          if (t === "ul" || t === "ol") inlineHost.removeChild(c);
        });

        var runs = inlineRuns(inlineHost, {}, theme);
        if (runsText(runs).trim()) {
          items.push({ runs: runs, indent: level, ordered: ordered });
        }

        // Recurse into nested lists from the ORIGINAL <li> (not the clone).
        Array.prototype.slice.call(li.children).forEach(function (c) {
          var t = c.tagName.toLowerCase();
          if (t === "ul" || t === "ol") {
            items = items.concat(
              collectListItems(c, t === "ol", level + 1)
            );
          }
        });
      }
      return items;
    }

    function pushImage(img) {
      var src = img.getAttribute("src") || "";
      if (!src) return;
      // Display width capped to content width; height filled in once loaded.
      blocks.push({
        kind: "image", src: src,
        natW: img.naturalWidth || 0, natH: img.naturalHeight || 0,
        heightPx: 0 // computed after natural size is known
      });
    }

    Array.prototype.slice.call(root.childNodes).forEach(function (node) {
      if (node.nodeType === 3) {
        if (node.nodeValue && node.nodeValue.trim()) {
          pushText([{ text: node.nodeValue, options: {} }], FONT_PX.p, {});
        }
        return;
      }
      if (node.nodeType !== 1) return;
      var tag = node.tagName.toLowerCase();

      if (FONT_PX[tag] && tag[0] === "h") {
        var hLevel = parseInt(tag[1], 10);
        var hColorKey = hLevel <= 3 ? "h" + hLevel + "Color" : null;
        var hFontKey  = hLevel <= 3 ? "h" + hLevel + "FontFace" : null;
        pushText(
          inlineRuns(node, { bold: true }, theme), FONT_PX[tag],
          {
            marginPx: FONT_PX[tag] * 0.4,
            color: hColorKey ? theme[hColorKey] : theme.textColor,
            fontFace: hFontKey ? theme[hFontKey] : theme.fontFace
          }
        );
      } else if (tag === "p") {
        // A paragraph may be just an image.
        var imgs = node.getElementsByTagName("img");
        if (imgs.length && !node.textContent.trim()) {
          for (var ii = 0; ii < imgs.length; ii++) pushImage(imgs[ii]);
        } else {
          pushText(inlineRuns(node, {}, theme), FONT_PX.p, {});
        }
      } else if (tag === "ul" || tag === "ol") {
        // Collect the entire list tree into a single block so it becomes one
        // text box in the exported PPTX.
        var items = collectListItems(node, tag === "ol", 0);
        if (items.length) {
          var totalItemH = 0;
          items.forEach(function (item) {
            var widthPx = CONTENT_W - item.indent * 28;
            var lines = estimateLines(runsText(item.runs), FONT_PX.p, widthPx);
            totalItemH += lines * FONT_PX.p * LINE_H + FONT_PX.p * 0.25;
          });
          blocks.push({
            kind: "list",
            items: items,
            fontPx: FONT_PX.p,
            heightPx: totalItemH + FONT_PX.p * 0.4
          });
        }
      } else if (tag === "blockquote") {
        pushText(inlineRuns(node, {}, theme), FONT_PX.p, {
          italic: true, color: theme.quoteColor
        });
      } else if (tag === "pre") {
        var codeText = node.textContent.replace(/\n+$/, "");
        var fontPx = 22;
        var codeLines = codeText.split("\n").length;
        blocks.push({
          kind: "code", text: codeText, fontPx: fontPx,
          heightPx: codeLines * fontPx * 1.35 + 24 + FONT_PX.p * 0.4
        });
      } else if (tag === "img") {
        pushImage(node);
      } else if (tag === "hr") {
        blocks.push({ kind: "hr", heightPx: 24 });
      } else {
        // Fallback: treat unknown block as plain text.
        var t = node.textContent;
        if (t && t.trim()) pushText(inlineRuns(node, {}, theme), FONT_PX.p, {});
      }
    });

    return blocks;
  }

  // ---- async image sizing ---------------------------------------------------

  function loadImageSize(src) {
    return new Promise(function (resolve) {
      var im = new Image();
      im.onload = function () { resolve({ w: im.naturalWidth, h: im.naturalHeight }); };
      im.onerror = function () { resolve({ w: 0, h: 0 }); };
      im.src = src;
    });
  }

  // Fill in display dimensions (px) for image blocks; cap to content box.
  function sizeImages(blocks) {
    var chain = Promise.resolve();
    blocks.forEach(function (b) {
      if (b.kind !== "image") return;
      chain = chain.then(function () {
        if (b.natW && b.natH) return { w: b.natW, h: b.natH };
        return loadImageSize(b.src);
      }).then(function (nat) {
        var w = nat.w || CONTENT_W, h = nat.h || CONTENT_W * 0.5;
        var dispW = Math.min(CONTENT_W, w);
        var dispH = dispW * (h / w);
        // Don't let a single image exceed the available height.
        if (dispH > AVAIL_H) { dispH = AVAIL_H; dispW = dispH * (w / h); }
        b.dispW = dispW; b.dispH = dispH;
        b.heightPx = dispH + 20;
      });
    });
    return chain;
  }

  // ---- emit one slide -------------------------------------------------------

  // The last HTML comment block inside a slide becomes its speaker notes.
  function extractNotes(markdown) {
    var re = /<!--([\s\S]*?)-->/g, m, last = null;
    while ((m = re.exec(markdown || "")) !== null) last = m[1];
    return last == null ? "" : last.trim();
  }

  function emitSlide(pptx, blocks, notes, theme) {
    var slide = pptx.addSlide();
    slide.background = { color: theme.slideBg };
    if (notes) slide.addNotes(notes);

    var totalH = blocks.reduce(function (s, b) { return s + b.heightPx; }, 0);
    var scale = totalH > AVAIL_H && totalH > 0 ? AVAIL_H / totalH : 1;

    var y = PAD_Y;
    blocks.forEach(function (b) {
      var h = b.heightPx * scale;

      if (b.kind === "text") {
        var textRuns = b.runs.map(function (r) {
          var o = copyOpts(r.options);
          o.fontSize = pxToPt(b.fontPx * scale);
          if (!o.color) o.color = b.color || theme.textColor;
          if (b.italic) o.italic = true;
          return { text: r.text, options: o };
        });
        slide.addText(textRuns, {
          x: pxToIn(PAD_X),
          y: pxToIn(y),
          w: pxToIn(CONTENT_W),
          h: pxToIn(h),
          align: b.align, valign: "top",
          fontFace: b.fontFace || theme.fontFace,
          color: b.color || theme.textColor,
          margin: 0, fit: "shrink"
        });

      } else if (b.kind === "list") {
        // Emit the entire list (including nested sub-lists) as one text box.
        // Each <li> becomes a paragraph; nesting is expressed via indentLevel.
        var listRuns = [];
        b.items.forEach(function (item, idx) {
          var isLast = idx === b.items.length - 1;
          item.runs.forEach(function (r, ri) {
            var o = copyOpts(r.options);
            o.fontSize = pxToPt(b.fontPx * scale);
            if (!o.color) o.color = theme.textColor;

            // First run of each item carries paragraph-level bullet & indent.
            if (ri === 0) {
              o.bullet = item.ordered ? { type: "number" } : true;
              o.indentLevel = item.indent;
            }
            // Last run of each item (except the very last) ends the paragraph
            // so the next item starts on its own line.
            if (ri === item.runs.length - 1 && !isLast) {
              o.breakLine = true;
            }
            listRuns.push({ text: r.text, options: o });
          });
        });
        slide.addText(listRuns, {
          x: pxToIn(PAD_X),
          y: pxToIn(y),
          w: pxToIn(CONTENT_W),
          h: pxToIn(h),
          align: "left", valign: "top",
          fontFace: theme.fontFace, color: theme.textColor,
          margin: 0, fit: "shrink"
        });

      } else if (b.kind === "code") {
        slide.addText(b.text, {
          x: pxToIn(PAD_X), y: pxToIn(y),
          w: pxToIn(CONTENT_W), h: pxToIn(h),
          fontFace: theme.codeFontFace,
          fontSize: pxToPt(b.fontPx * scale),
          color: theme.preCodeColor,
          fill: { color: theme.preBg },
          align: "left", valign: "top", margin: 8, fit: "shrink"
        });

      } else if (b.kind === "image") {
        var dW = pxToIn((b.dispW || CONTENT_W) * scale);
        var dH = pxToIn((b.dispH || 0) * scale);
        slide.addImage({
          data: b.src,
          x: pxToIn(PAD_X) + (pxToIn(CONTENT_W) - dW) / 2, // center
          y: pxToIn(y), w: dW, h: dH
        });

      } else if (b.kind === "hr") {
        slide.addShape(pptx.ShapeType.line, {
          x: pxToIn(PAD_X), y: pxToIn(y + h / 2),
          w: pxToIn(CONTENT_W), h: 0,
          line: { color: "DDDDDD", width: 1 }
        });
      }

      y += h;
    });
  }

  // ---- driver ---------------------------------------------------------------

  function deriveTitle(slides) {
    for (var i = 0; i < slides.length; i++) {
      var m = slides[i].markdown.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
      if (m) return m[1].replace(/[*_`#]/g, "").trim();
    }
    return "presentation";
  }

  // Render one slide's markdown to resolved (data-URL) HTML, scripts stripped.
  function slideBody(slide) {
    var html = App.Preview.renderMarkdown(slide ? slide.markdown : "");
    var resolved = App.Assets && App.Assets.resolveDataURLs
      ? App.Assets.resolveDataURLs(html)
      : Promise.resolve(App.Assets ? App.Assets.resolve(html) : html);
    return resolved.then(function (h) {
      return h.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
    });
  }

  function run() {
    if (typeof window.PptxGenJS !== "function") {
      alert("PPTX library failed to load.");
      return;
    }
    var parsed = App.Slides.parse(App.Editor.getValue());
    var slides = parsed.slides || [];
    if (!slides.length) return;

    var btn = document.getElementById("nav-pptx");
    var prevLabel = btn ? btn.textContent : null;
    if (btn) { btn.disabled = true; btn.textContent = "…PPTX"; }

    var title = deriveTitle(slides);
    var theme = parseThemeCSS();
    var pptx = new window.PptxGenJS();
    pptx.defineLayout({ name: "PRRSENT", width: IN_W, height: IN_H });
    pptx.layout = "PRRSENT";
    pptx.title = title;

    // Build each slide sequentially (asset inlining + image sizing are async).
    var chain = Promise.resolve();
    slides.forEach(function (slide) {
      chain = chain.then(function () {
        var notes = extractNotes(slide.markdown);
        return slideBody(slide).then(function (html) {
          var blocks = blocksFromHTML(html, theme);
          return sizeImages(blocks).then(function () {
            emitSlide(pptx, blocks, notes, theme);
          });
        });
      });
    });

    chain.then(function () {
      return pptx.writeFile({ fileName: title + ".pptx" });
    }).then(function () {
      if (btn) { btn.disabled = false; btn.textContent = prevLabel; }
    }).catch(function (err) {
      if (btn) { btn.disabled = false; btn.textContent = prevLabel; }
      alert("PPTX export failed: " + err);
    });
  }

  App.Pptx = { run: run };
})();
