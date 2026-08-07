/* ===========================================================
   Pop Learning — sharing helpers
   Builds a QR code (via the vendored qrcode.js generator) for
   the app URL, and shows it in a modal that can be scanned from
   a phone. Loads after pop.js; exposes Pop.showShareQR().
   Works fully offline — the QR generator ships with the app.
   =========================================================== */
(function (global) {
  "use strict";
  var Pop = /** @type {any} */ (global.Pop || (global.Pop = {}));

  function qrReady() {
    return typeof global.qrcode === "function";
  }

  // The canonical share target: the app's own origin + path, so the QR
  // always points back to the installed/playing location (works on
  // GitHub Pages and locally). Strip any page file to point at the root.
  function shareUrl() {
    var path = global.location.pathname.replace(/[^/]*$/, "");
    var u = global.location.origin + path;
    return u.charAt(u.length - 1) === "/" ? u : u + "/";
  }

  function showShareQR() {
    if (!Pop.$) return;

    var modalEl = Pop.el("div", { "class": "pop-modal-backdrop" });
    var modal = Pop.el("div", {
      "class": "pop-modal pop-share-modal",
      role: "dialog",
      "aria-label": "Share Pop Learning",
      "aria-modal": "true",
    });

    modal.appendChild(Pop.el("h2", { text: "📱 Share Pop Learning" }));
    modal.appendChild(Pop.el("p", {
      "class": "pop-modal-hint",
      text: "Scan this code with a phone to open the app — great for sending to other parents and teachers.",
    }));

    var url = shareUrl();
    var codeBox = Pop.el("div", { "class": "qr-box" });

    if (qrReady()) {
      try {
        var qr = global.qrcode(0, "M");
        qr.addData(url);
        qr.make();
        codeBox.innerHTML = qr.createSvgTag({ cellSize: 8, margin: 2, scalable: true });
      } catch (e) {
        codeBox.appendChild(Pop.el("p", { "class": "pop-modal-hint", text: "Couldn't build the QR code." }));
      }
    } else {
      codeBox.appendChild(
        Pop.el("p", {
          "class": "pop-modal-hint",
          text: "QR generator not loaded yet — try again in a moment.",
        }),
      );
    }

    modal.appendChild(codeBox);
    modal.appendChild(Pop.el("a", { "class": "pop-modal-link", href: url, text: url }));

    var buttonRow = Pop.el("div", { "class": "qr-actions" });

    var copyBtn = Pop.el("button", { "class": "pop-modal-done", text: "📋 Copy link" });
    copyBtn.addEventListener("click", function () {
      try {
        navigator.clipboard.writeText(url).then(function () {
          copyBtn.textContent = "✅ Copied!";
          setTimeout(function () {
            copyBtn.textContent = "📋 Copy link";
          }, 1600);
        });
      } catch (e) {}
    });

    var done = Pop.el("button", { "class": "pop-modal-done pop-modal-secondary", text: "Done" });
    done.addEventListener("click", close);

    buttonRow.appendChild(copyBtn);
    buttonRow.appendChild(done);
    modal.appendChild(buttonRow);

    function close() {
      var kb = function (e) {
        if (e.key === "Escape") close();
      };
      document.removeEventListener("keydown", kb);
      if (modalEl && modalEl.parentNode) modalEl.parentNode.removeChild(modalEl);
    }

    modalEl.appendChild(modal);
    modalEl.addEventListener("click", function (e) {
      if (e.target === modalEl) close();
    });
    document.addEventListener("keydown", function esc(e) {
      if (e.key === "Escape") close();
    });
    document.body.appendChild(modalEl);
  }

  Pop.showShareQR = showShareQR;
})(window);
