/*
  app.js — connects the page to the model.

  It builds the table of guesses, reads what you type, checks it, asks
  model.js for the answer, and draws the result. All the arithmetic lives
  in model.js; this file only reads and shows.
*/
(function () {
  "use strict";

  const Model = window.Model;
  const SIDES = ["low", "best", "high"];

  // ---------- Showing numbers ----------

  const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const upToTwoPlaces = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  // $64,907 or −$1,453 (with a real minus sign).
  function money(n) {
    const rounded = Math.round(n);
    const text = "$" + wholeNumber.format(Math.abs(rounded));
    return rounded < 0 ? "−" + text : text;
  }

  // A guess, shown the way it was typed: 3, $55, 60%, $15,000.
  function guessText(input, value) {
    if (input.kind === "money") return "$" + upToTwoPlaces.format(value);
    if (input.kind === "percent") return upToTwoPlaces.format(value) + "%";
    return upToTwoPlaces.format(value);
  }

  function paybackText(month) {
    return month === null ? "Not within 3 years" : "Month " + month;
  }

  // ---------- Building the table of guesses ----------

  const rowsEl = document.getElementById("guess-rows");
  const rampEl = document.getElementById("ramp");
  const noteEl = document.getElementById("input-note");
  const fields = {}; // fields.hours.low is the box for the low guess of hours saved

  function unitFor(input) {
    if (input.kind === "money") return " ($)";
    if (input.kind === "percent") return " (%)";
    return "";
  }

  Model.INPUTS.forEach(function (input) {
    const tr = document.createElement("tr");

    const labelCell = document.createElement("td");
    labelCell.className = "row-label";
    labelCell.id = "label-" + input.key;
    labelCell.textContent = input.label;
    const unit = unitFor(input);
    if (unit) {
      const u = document.createElement("span");
      u.className = "unit";
      u.textContent = unit;
      labelCell.appendChild(u);
    }
    tr.appendChild(labelCell);

    fields[input.key] = {};
    SIDES.forEach(function (side) {
      const cell = document.createElement("td");
      const box = document.createElement("input");
      box.type = "number";
      box.inputMode = "decimal";
      box.min = "0";
      box.step = "any";
      box.className = side;
      box.setAttribute("aria-label", input.label + ", " + side + " guess");
      box.addEventListener("input", update);
      cell.appendChild(box);
      tr.appendChild(cell);
      fields[input.key][side] = box;
    });

    rowsEl.appendChild(tr);
  });

  rampEl.addEventListener("input", update);

  function fillWithExample() {
    Model.INPUTS.forEach(function (input) {
      SIDES.forEach(function (side) { fields[input.key][side].value = input[side]; });
    });
    rampEl.value = Model.DEFAULT_RAMP_MONTHS;
  }

  document.getElementById("reset").addEventListener("click", function () {
    fillWithExample();
    update();
  });

  // ---------- Reading and checking what was typed ----------

  // Reads one box. Returns a number, or a short reason it can't be used.
  function readBox(box, input) {
    const raw = box.value.trim();
    if (raw === "") return { problem: "is empty" };
    const n = Number(raw);
    if (!Number.isFinite(n)) return { problem: "isn't a number" };
    if (n < 0) return { problem: "can't be negative" };
    if (input && input.kind === "percent" && n > 100) return { problem: "can't be more than 100%" };
    return { value: n };
  }

  /*
    Reads every box and sorts the problems into two kinds:
      blocking — a best guess (or the ramp) can't be used, so there is no answer
      notes    — the answer still works, but something looks off
  */
  function readAll() {
    const best = {};
    const ranges = {};
    const blocking = [];
    const notes = [];

    Model.INPUTS.forEach(function (input) {
      const read = {};
      SIDES.forEach(function (side) {
        const box = fields[input.key][side];
        read[side] = readBox(box, input);
        box.setAttribute("aria-invalid", read[side].problem ? "true" : "false");
      });

      if (read.best.problem) {
        blocking.push(input.label + ": the best guess " + read.best.problem + ".");
      } else {
        best[input.key] = read.best.value;
      }

      const sideProblem = read.low.problem ? ["low", read.low.problem]
                        : read.high.problem ? ["high", read.high.problem] : null;
      if (sideProblem) {
        notes.push(input.label + ": the " + sideProblem[0] + " guess " + sideProblem[1] + ", so it is left out of the ranking.");
      } else if (read.low.value > read.high.value) {
        fields[input.key].low.setAttribute("aria-invalid", "true");
        fields[input.key].high.setAttribute("aria-invalid", "true");
        notes.push(input.label + ": the low guess is above the high guess, so it is left out of the ranking.");
      } else {
        ranges[input.key] = { low: read.low.value, high: read.high.value };
        if (!read.best.problem && (read.best.value < read.low.value || read.best.value > read.high.value)) {
          notes.push(input.label + ": the best guess sits outside the low-to-high range.");
        }
      }
    });

    const ramp = readBox(rampEl, null);
    rampEl.setAttribute("aria-invalid", ramp.problem ? "true" : "false");
    if (ramp.problem) blocking.push("Months to reach peak adoption " + ramp.problem + ".");

    return { best: best, ranges: ranges, ramp: ramp.value, blocking: blocking, notes: notes };
  }

  function showNotes(blocking, notes) {
    noteEl.replaceChildren();
    blocking.forEach(function (text) {
      const p = document.createElement("p");
      p.className = "blocking";
      p.textContent = text;
      noteEl.appendChild(p);
    });
    notes.forEach(function (text) {
      const p = document.createElement("p");
      p.textContent = text;
      noteEl.appendChild(p);
    });
    noteEl.hidden = blocking.length + notes.length === 0;
  }

  // ---------- Showing the answer ----------

  const paybackEl = document.getElementById("payback");
  const yearOneEl = document.getElementById("year-one");

  function showFigures(result) {
    paybackEl.className = "figure-value";
    yearOneEl.className = "figure-value";

    if (!result) {
      paybackEl.textContent = "—";
      yearOneEl.textContent = "—";
      paybackEl.classList.add("is-empty");
      yearOneEl.classList.add("is-empty");
      return;
    }

    paybackEl.textContent = paybackText(result.payback);
    if (result.payback === null) paybackEl.classList.add("is-long", "is-negative");

    yearOneEl.textContent = money(result.yearOne);
    yearOneEl.classList.add(Math.round(result.yearOne) < 0 ? "is-negative" : "is-positive");
  }

  // ---------- Recalculate on every keystroke ----------

  function update() {
    const read = readAll();
    showNotes(read.blocking, read.notes);

    if (read.blocking.length) {
      showFigures(null);
      return;
    }

    const result = Model.run(read.best, read.ramp);
    showFigures(result);
  }

  fillWithExample();
  update();
})();
