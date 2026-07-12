(function (global) {
  "use strict";

  if (!global.Pop) global.Pop = {};

  var ALPHA = "ABCDEFGHIJKLMNOPQRSTUVWXYZ".split("");
  var SOUND_GAMES = ["sound-match", "first-sounds", "trace"];
  var GAME_NAMES = {
    "sound-match": "Sound Match",
    "first-sounds": "First Sounds",
    "spell": "Spell It",
    "rhyme": "Rhyme Time",
    "addtake": "Add & Take",
    "bonds": "Make Ten",
    "subitise": "Quick Count",
    "skip": "Skip Count",
    "shapes": "Shape Pop",
    "phonics-check": "Phonics Check",
    "speed": "Speed Words",
    "story": "Story Pop",
    "magic-e": "Magic e"
  };

  function prettify(id) {
    return String(id).split(/[-_]/).map(function (w) {
      return w ? w.charAt(0).toUpperCase() + w.slice(1) : w;
    }).join(" ");
  }

  function gameName(id) {
    return GAME_NAMES[id] || prettify(id);
  }

  /**
   * Render the core progress UI into the provided container.
   * This is used by both the offline PWA parent corner and the server-side Teacher Dashboard.
   */
  Pop.renderParentUI = function (progress, container) {
    container.innerHTML = ""; // Clear existing

    var gameIds = [];
    for (var g in progress) {
      if (progress.hasOwnProperty(g)) gameIds.push(g);
    }

    // --- 1) Summary Strip ---
    var summary = Pop.el("section", { "class": "summary", "aria-label": "Summary" });
    
    var correctStat = Pop.el("div", { "class": "stat" });
    var totalCorrect = Pop.progress.totalCorrect(progress);
    correctStat.appendChild(Pop.el("span", { "class": "num", text: totalCorrect }));
    correctStat.appendChild(Pop.el("span", { "class": "lbl", text: "Correct answers" }));
    
    var gamesStat = Pop.el("div", { "class": "stat" });
    gamesStat.appendChild(Pop.el("span", { "class": "num", text: gameIds.length }));
    gamesStat.appendChild(Pop.el("span", { "class": "lbl", text: "Games played" }));

    var earned = Pop.stickers.earned(progress);
    var stickersStat = Pop.el("div", { "class": "stat" });
    stickersStat.appendChild(Pop.el("span", { "class": "num", text: earned.length }));
    stickersStat.appendChild(Pop.el("span", { "class": "lbl", text: "Stickers earned" }));

    summary.appendChild(correctStat);
    summary.appendChild(gamesStat);
    summary.appendChild(stickersStat);
    container.appendChild(summary);

    // --- 2) Sticker Shelf ---
    var shelfPanel = Pop.el("section", { "class": "panel", style: "margin-top: clamp(16px, 3vh, 24px);" });
    shelfPanel.appendChild(Pop.el("h2", { text: "🏅 Sticker shelf" }));
    if (!earned.length) {
      shelfPanel.appendChild(Pop.el("p", { "class": "sub", text: "No stickers yet — every bit of practice fills the shelf." }));
    }
    
    var shelf = Pop.el("div", { "class": "shelf" });
    var allStickers = Pop.stickers.all();
    allStickers.forEach(function (emoji, i) {
      var got = i < earned.length;
      var slot = Pop.el("div", { "class": "slot" + (got ? "" : " locked") });
      slot.textContent = got ? earned[i] : emoji;
      if (!got) slot.setAttribute("aria-label", "Locked sticker");
      shelf.appendChild(slot);
    });
    shelfPanel.appendChild(shelf);
    shelfPanel.appendChild(Pop.el("p", { 
      "class": "shelf-caption", 
      text: "A sticker every " + Pop.stickers.per + " correct answers.",
      style: "font-size: 0.8rem; color: var(--ink-soft); margin-top: 10px;"
    }));
    container.appendChild(shelfPanel);

    // --- 3) Letter-sounds heat grid ---
    var heatPanel = Pop.el("section", { "class": "panel", style: "margin-top: clamp(16px, 3vh, 24px);" });
    heatPanel.appendChild(Pop.el("h2", { text: "🔤 Letter sounds A–Z" }));
    heatPanel.appendChild(Pop.el("p", { "class": "sub", text: "A quick look at which sounds are sticking, across the sound games." }));
    
    var heat = Pop.el("div", { "class": "heat" });
    ALPHA.forEach(function (L) {
      var seen = 0, right = 0;
      SOUND_GAMES.forEach(function (gid) {
        var game = progress[gid];
        if (game && game[L]) {
          seen += (game[L].seen || 0);
          right += (game[L].right || 0);
        }
      });
      var cls = "cold";
      if (seen >= 2 && (right / seen) >= 0.8) cls = "good";
      else if (seen >= 1) cls = "shaky";
      var cell = Pop.el("div", { "class": "cell " + cls });
      cell.textContent = L.toLowerCase();
      cell.setAttribute("title",
        cls === "cold" ? L + " — not tried yet"
          : L + " — " + right + "/" + seen + " correct");
      heat.appendChild(cell);
    });
    heatPanel.appendChild(heat);
    
    var legend = Pop.el("div", { "class": "legend" });
    legend.innerHTML = '<span><i class="dot good"></i> Sticking</span> <span><i class="dot shaky"></i> Still learning</span> <span><i class="dot cold"></i> Not tried yet</span>';
    heatPanel.appendChild(legend);
    container.appendChild(heatPanel);

    // --- 4) Per-game table ---
    var tablePanel = Pop.el("section", { "class": "panel", style: "margin-top: clamp(16px, 3vh, 24px);" });
    tablePanel.appendChild(Pop.el("h2", { text: "🎲 Each game" }));
    tablePanel.appendChild(Pop.el("p", { "class": "sub", text: "Attempts, correct answers and accuracy so far." }));

    var table = Pop.el("table", { "class": "games" });
    table.innerHTML = '<thead><tr><th>Game</th><th class="right">Tries</th><th class="right">Right</th><th class="right">Accuracy</th></tr></thead>';
    var tbody = Pop.el("tbody");

    var rowIds = [];
    for (var k in GAME_NAMES) {
      if (GAME_NAMES.hasOwnProperty(k)) rowIds.push(k);
    }
    gameIds.forEach(function (id) {
      if (rowIds.indexOf(id) === -1) rowIds.push(id);
    });
    rowIds.sort(function (a, b) {
      return gameName(a).localeCompare(gameName(b));
    });

    rowIds.forEach(function (id) {
      var game = progress[id] || {};
      var seen = 0, right = 0;
      for (var key in game) {
        if (game.hasOwnProperty(key)) {
          seen += (game[key].seen || 0);
          right += (game[key].right || 0);
        }
      }
      var acc = seen ? Math.round((right / seen) * 100) : null;
      var accCls = acc === null ? "" : (acc >= 80 ? " good" : (acc >= 50 ? " shaky" : ""));

      var tr = Pop.el("tr");
      tr.appendChild(Pop.el("td", { "class": "name", text: gameName(id) }));
      tr.appendChild(Pop.el("td", { "class": "right", text: String(seen) }));
      tr.appendChild(Pop.el("td", { "class": "right", text: String(right) }));

      var accTd = Pop.el("td", { "class": "right" });
      var pill = Pop.el("span", { "class": "acc-pill" + accCls, text: acc === null ? "–" : acc + "%" });
      accTd.appendChild(pill);
      tr.appendChild(accTd);

      tbody.appendChild(tr);
    });

    if (totalCorrect === 0 && gameIds.length === 0) {
      var banner = Pop.el("tr");
      var td = Pop.el("td", { "class": "empty", text: "No stars yet — pick a game and start playing!" });
      td.setAttribute("colspan", "4");
      banner.appendChild(td);
      tbody.insertBefore(banner, tbody.firstChild);
    }

    table.appendChild(tbody);
    tablePanel.appendChild(table);
    container.appendChild(tablePanel);
    
    // --- 5) Reassuring note ---
    var note = Pop.el("section", { "class": "note", style: "margin-top: clamp(16px, 3vh, 24px);" });
    note.innerHTML = "<b>How to use Pop Learning:</b> little and often works best — a few minutes a day beats a long session. Celebrate the effort rather than the score, and let her tap freely and explore; there's no way to get it wrong here. The numbers above are just for you — they're a gentle guide, not a report card.";
    container.appendChild(note);
  };
})(window);
