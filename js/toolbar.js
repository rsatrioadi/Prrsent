// toolbar.js — insertion-template buttons above the editor.
window.App = window.App || {};

(function () {
  "use strict";

  var E = function () { return App.Editor; };

  // Each button: { label, title, run }. `run` mutates the editor; afterwards we
  // re-render so the preview reflects the change.
  var BUTTONS = [
    {
      label: "⎯ Slide",
      title: "Insert slide break",
      run: function () { E().insertAtCursor("\n\n---\n\n"); }
    },
    {
      label: "H1",
      title: "Heading 1",
      run: function () { E().wrapSelection("# ", "", "Heading"); }
    },
    {
      label: "H2",
      title: "Heading 2",
      run: function () { E().wrapSelection("## ", "", "Heading"); }
    },
    {
      label: "B",
      title: "Bold",
      run: function () { E().wrapSelection("**", "**", "bold"); }
    },
    {
      label: "I",
      title: "Italic",
      run: function () { E().wrapSelection("*", "*", "italic"); }
    },
    {
      label: "• List",
      title: "Bullet list item",
      run: function () { E().wrapSelection("- ", "", "item"); }
    },
    {
      label: "Link",
      title: "Link",
      run: function () { E().wrapSelection("[", "](https://)", "text"); }
    },
    {
      label: "Image",
      title: "Image (asset reference)",
      run: function () { E().wrapSelection("![", "](asset:NAME)", "alt"); }
    },
    {
      label: "Video",
      title: "Video element",
      run: function () {
        E().insertAtCursor(
          '<video src="asset:NAME" controls width="640"></video>'
        );
      }
    },
    {
      label: "Audio",
      title: "Audio element",
      run: function () {
        E().insertAtCursor('<audio src="asset:NAME" controls></audio>');
      }
    },
    {
      label: "Div",
      title: "HTML div block",
      run: function () {
        E().insertAtCursor(
          '<div style="">\n  \n</div>',
          /* caret inside the div body */ 17
        );
      }
    },
    {
      label: "Code",
      title: "Fenced code block",
      run: function () {
        E().insertAtCursor("```js\n\n```", /* caret on the empty line */ 6);
      }
    }
  ];

  function build() {
    var bar = document.getElementById("editor-toolbar");
    if (!bar) return;
    BUTTONS.forEach(function (def) {
      var btn = document.createElement("button");
      btn.type = "button";
      btn.className = "tb-btn";
      btn.textContent = def.label;
      btn.title = def.title;
      btn.addEventListener("click", function () {
        def.run();
        if (App.refresh) App.refresh(true);
      });
      bar.appendChild(btn);
    });
  }

  App.Toolbar = { build: build };
})();
