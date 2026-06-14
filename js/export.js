// export.js — export the deck to PDF via the browser's native print-to-PDF.
//
// One slide per page at the logical 16:9 size. Interactivity is ignored:
// <script> blocks are stripped, and assets are inlined as data: URLs so the
// print document is fully self-contained.
window.App = window.App || {};

(function () {
  "use strict";

  var PRINT_CSS = [
    "@page{size:" + 1280 + "px " + 720 + "px;margin:0}",
    "html,body{height:auto;margin:0;padding:0;background:#fff}",
    ".slide{box-shadow:none;page-break-after:always;break-after:page}",
    ".slide:last-child{page-break-after:auto;break-after:auto}"
  ].join("");

  function escapeHTML(s) {
    return String(s).replace(/[&<>"]/g, function (c) {
      return { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c];
    });
  }

  // Remove <script>…</script> so exported slides are fully static.
  function stripScripts(html) {
    return html.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "");
  }

  function deriveTitle(slides) {
    for (var i = 0; i < slides.length; i++) {
      var m = slides[i].markdown.match(/^\s*#{1,6}\s+(.+?)\s*$/m);
      if (m) return m[1].replace(/[*_`#]/g, "").trim();
    }
    return "presentation";
  }

  function buildPrintDoc(slideBodies, title) {
    var css = App.Preview.BASE_CSS + (App.Preview.themeCSS || "") + PRINT_CSS;
    var body = slideBodies
      .map(function (h) { return '<div class="slide">' + h + "</div>"; })
      .join("");
    return (
      "<!DOCTYPE html><html><head><meta charset='utf-8'>" +
      "<title>" + escapeHTML(title) + "</title>" +
      "<style>" + css + "</style></head><body>" +
      body +
      "<scr" + "ipt>window.onload=function(){setTimeout(function(){" +
      "window.focus();window.print();},80);};</scr" + "ipt>" +
      "</body></html>"
    );
  }

  // Render one slide to static, self-contained HTML.
  function slideBody(slide) {
    var html = App.Preview.renderMarkdown(slide ? slide.markdown : "");
    var resolved = App.Assets && App.Assets.resolveDataURLs
      ? App.Assets.resolveDataURLs(html)
      : Promise.resolve(App.Assets ? App.Assets.resolve(html) : html);
    return resolved.then(stripScripts);
  }

  function run() {
    // Parse the current editor content fresh so export reflects unsaved edits.
    var parsed = App.Slides.parse(App.Editor.getValue());
    var slides = parsed.slides || [];
    if (!slides.length) return;

    // Open the print window synchronously (inside the click gesture) so it is
    // not blocked; fill it once async asset inlining completes.
    var w = window.open("", "_blank");
    if (!w) {
      alert("Please allow pop-ups to export the PDF.");
      return;
    }
    w.document.write(
      "<!DOCTYPE html><meta charset='utf-8'>" +
      "<body style='font:14px -apple-system,sans-serif;padding:24px;color:#444'>" +
      "Generating PDF…</body>"
    );

    var title = deriveTitle(slides);
    var chain = Promise.resolve([]);
    slides.forEach(function (slide) {
      chain = chain.then(function (acc) {
        return slideBody(slide).then(function (body) {
          acc.push(body);
          return acc;
        });
      });
    });

    chain.then(function (bodies) {
      var doc = buildPrintDoc(bodies, title);
      w.document.open();
      w.document.write(doc);
      w.document.close();
    }).catch(function (err) {
      try { w.close(); } catch (e) {}
      alert("PDF export failed: " + err);
    });
  }

  App.Export = { run: run };
})();
