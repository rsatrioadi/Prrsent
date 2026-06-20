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
  var TEXT_COLOR = "1A1A1A";
  var CODE_COLOR = "333333";
  var QUOTE_COLOR = "555555";

  function pxToPt(px) { return px * 0.75; }       // 720px == 540pt
  function pxToIn(px) { return px * PX; }

  // ---- HTML -> blocks ------------------------------------------------------

  // Extract inline formatting runs from an element for PptxGenJS rich text.
  // Returns [{ text, options:{ bold, italic, underline, fontFace, color } }].
  function inlineRuns(node, inherited) {
    inherited = inherited || {};
    var runs = [];
    node.childNodes.forEach ? null : null; // childNodes is a NodeList
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
      else if (tag === "a") { opts.color = "0E639C"; opts.underline = true; }
      else if (tag === "code") { opts.fontFace = "Consolas"; opts.color = CODE_COLOR; }
      else if (tag === "br") { runs.push({ text: "\n", options: copyOpts(inherited) }); continue; }
      runs.push.apply(runs, inlineRuns(child, opts));
    }
    return runs;
  }

  function copyOpts(o) {
    var c = {};
    for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) c[k] = o[k];
    return c;
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
  function blocksFromHTML(html) {
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
        bullet: opts && opts.bullet || false,
        indent: opts && opts.indent || 0,
        align: opts && opts.align || "left",
        color: opts && opts.color,
        italic: opts && opts.italic,
        heightPx: lines * fontPx * LINE_H + marginPx
      });
    }

    function walkList(listEl, ordered, level) {
      var idx = 0;
      for (var i = 0; i < listEl.children.length; i++) {
        var li = listEl.children[i];
        if (li.tagName.toLowerCase() !== "li") continue;
        idx++;
        // Inline content of the <li> (excluding nested lists).
        var inlineHost = li.cloneNode(true);
        var nestedLists = [];
        Array.prototype.slice.call(inlineHost.children).forEach(function (c) {
          var t = c.tagName.toLowerCase();
          if (t === "ul" || t === "ol") { nestedLists.push(c); inlineHost.removeChild(c); }
        });
        var runs = inlineRuns(inlineHost, {});
        if (ordered) runs = [{ text: idx + ". ", options: {} }].concat(runs);
        pushText(runs, FONT_PX.p, {
          bullet: !ordered, indent: level,
          widthPx: CONTENT_W - level * 28, marginPx: FONT_PX.p * 0.25
        });
        // Recurse into the nested lists captured from the ORIGINAL li.
        var realNested = [];
        Array.prototype.slice.call(li.children).forEach(function (c) {
          var t = c.tagName.toLowerCase();
          if (t === "ul" || t === "ol") realNested.push(c);
        });
        realNested.forEach(function (nl) {
          walkList(nl, nl.tagName.toLowerCase() === "ol", level + 1);
        });
      }
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
        pushText(inlineRuns(node, { bold: true }), FONT_PX[tag], { marginPx: FONT_PX[tag] * 0.4 });
      } else if (tag === "p") {
        // A paragraph may be just an image.
        var imgs = node.getElementsByTagName("img");
        if (imgs.length && !node.textContent.trim()) {
          for (var ii = 0; ii < imgs.length; ii++) pushImage(imgs[ii]);
        } else {
          pushText(inlineRuns(node, {}), FONT_PX.p, {});
        }
      } else if (tag === "ul" || tag === "ol") {
        walkList(node, tag === "ol", 0);
      } else if (tag === "blockquote") {
        pushText(inlineRuns(node, {}), FONT_PX.p, { italic: true, color: QUOTE_COLOR });
      } else if (tag === "pre") {
        var codeText = node.textContent.replace(/\n+$/, "");
        var fontPx = 22;
        var lines = codeText.split("\n").length;
        blocks.push({
          kind: "code", text: codeText, fontPx: fontPx,
          heightPx: lines * fontPx * 1.35 + 24 + FONT_PX.p * 0.4
        });
      } else if (tag === "img") {
        pushImage(node);
      } else if (tag === "hr") {
        blocks.push({ kind: "hr", heightPx: 24 });
      } else {
        // Fallback: treat unknown block as plain text.
        var t = node.textContent;
        if (t && t.trim()) pushText(inlineRuns(node, {}), FONT_PX.p, {});
      }
    });

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

    return blocks;
  }

  // ---- async image sizing --------------------------------------------------

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

  // ---- emit one slide ------------------------------------------------------

  // The last HTML comment block inside a slide becomes its speaker notes.
  function extractNotes(markdown) {
    var re = /<!--([\s\S]*?)-->/g, m, last = null;
    while ((m = re.exec(markdown || "")) !== null) last = m[1];
    return last == null ? "" : last.trim();
  }

  function emitSlide(pptx, blocks, notes) {
    var slide = pptx.addSlide();
    slide.background = { color: "FFFFFF" };
    if (notes) slide.addNotes(notes);

    var totalH = blocks.reduce(function (s, b) { return s + b.heightPx; }, 0);
    var scale = totalH > AVAIL_H && totalH > 0 ? AVAIL_H / totalH : 1;

    var y = PAD_Y;
    blocks.forEach(function (b) {
      var h = b.heightPx * scale;
      if (b.kind === "text") {
        var runs = b.runs.map(function (r) {
          var o = copyOpts(r.options);
          o.fontSize = pxToPt(b.fontPx * scale);
          if (!o.color) o.color = b.color || TEXT_COLOR;
          if (b.italic) o.italic = true;
          return { text: r.text, options: o };
        });
        slide.addText(runs, {
          x: pxToIn(PAD_X + (b.indent ? b.indent * 28 : 0)),
          y: pxToIn(y),
          w: pxToIn(CONTENT_W - (b.indent ? b.indent * 28 : 0)),
          h: pxToIn(h),
          align: b.align, valign: "top",
          bullet: b.bullet ? { indent: 14 } : false,
          fontFace: "Arial", color: b.color || TEXT_COLOR,
          margin: 0, fit: "shrink"
        });
      } else if (b.kind === "code") {
        slide.addText(b.text, {
          x: pxToIn(PAD_X), y: pxToIn(y),
          w: pxToIn(CONTENT_W), h: pxToIn(h),
          fontFace: "Consolas", fontSize: pxToPt(b.fontPx * scale),
          color: CODE_COLOR, fill: { color: "F5F5F5" },
          align: "left", valign: "top", margin: 8, fit: "shrink"
        });
      } else if (b.kind === "image") {
        var dW = pxToIn((b.dispW || CONTENT_W) * scale);
        var dH = pxToIn((b.dispH || 0) * scale);
        slide.addImage({
          data: b.src,
          x: pxToIn(PAD_X) + (pxToIn(CONTENT_W) - dW) / 2, // center horizontally
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

  // ---- driver --------------------------------------------------------------

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
          var blocks = blocksFromHTML(html);
          return sizeImages(blocks).then(function () {
            emitSlide(pptx, blocks, notes);
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
