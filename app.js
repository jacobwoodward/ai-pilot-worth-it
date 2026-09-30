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

  // $64,907 or −$1,453, and a guess shown the way it was typed (3, $55, 60%).
  // Both live in model.js so the page and the sentences always agree.
  const money = Model.money;
  const guessText = Model.guessText;

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

  // ---------- Drawing the running total ----------

  const chartEl = document.getElementById("chart");
  const captionEl = document.getElementById("chart-caption");
  const SVG_NS = "http://www.w3.org/2000/svg";
  let lastChart = null; // remembered so the chart can be redrawn when the window is resized

  function svg(tag, attrs, parent) {
    const el = document.createElementNS(SVG_NS, tag);
    Object.keys(attrs).forEach(function (k) { el.setAttribute(k, attrs[k]); });
    if (parent) parent.appendChild(el);
    return el;
  }

  // $50k, −$20k, $1.2m — short labels for the side of the chart.
  function shortMoney(n) {
    const abs = Math.abs(n);
    let text;
    if (abs >= 1e6) text = "$" + upToTwoPlaces.format(abs / 1e6) + "m";
    else if (abs >= 1e3) text = "$" + upToTwoPlaces.format(abs / 1e3) + "k";
    else text = "$" + wholeNumber.format(abs);
    return n < 0 ? "−" + text : text;
  }

  // Round, even steps for the gridlines (1, 2, 2.5 or 5 times a power of ten).
  function niceStep(range, count) {
    const rough = range / count;
    const power = Math.pow(10, Math.floor(Math.log10(rough)));
    const steps = [1, 2, 2.5, 5, 10];
    for (let i = 0; i < steps.length; i++) {
      if (steps[i] * power >= rough) return steps[i] * power;
    }
    return 10 * power;
  }

  function drawChart(result, setup) {
    lastChart = result ? { result: result, setup: setup } : null;
    chartEl.replaceChildren();

    if (!result) {
      captionEl.textContent = "";
      return;
    }

    // Month 0 is launch day: only the setup cost has been spent.
    const points = [-setup].concat(result.running);
    const months = points.length - 1;

    const width = Math.max(280, chartEl.clientWidth);
    const height = width < 480 ? 220 : 280;
    const pad = { top: 28, right: 16, bottom: 30, left: 56 };
    const plotW = width - pad.left - pad.right;
    const plotH = height - pad.top - pad.bottom;

    // The vertical scale always includes $0 so the zero line is on the chart.
    let lo = Math.min(0, Math.min.apply(null, points));
    let hi = Math.max(0, Math.max.apply(null, points));
    if (hi - lo < 1) hi = lo + 1000;
    const step = niceStep(hi - lo, width < 480 ? 4 : 6);
    lo = Math.floor(lo / step) * step;
    hi = Math.ceil(hi / step) * step;

    const x = function (month) { return pad.left + (month / months) * plotW; };
    const y = function (value) { return pad.top + ((hi - value) / (hi - lo)) * plotH; };

    const root = svg("svg", {
      width: width, height: height, viewBox: "0 0 " + width + " " + height,
      role: "img",
      "aria-label": "Running total over 36 months, from " + money(points[0]) +
        " at launch to " + money(points[months]) + " after three years. " +
        (result.payback === null ? "It does not reach zero within three years."
                                 : "It reaches zero in month " + result.payback + ".")
    }, chartEl);

    // Gridlines and money labels.
    for (let v = lo; v <= hi + step / 2; v += step) {
      const isZero = Math.abs(v) < step / 1000;
      svg("line", { x1: pad.left, x2: width - pad.right, y1: y(v), y2: y(v), class: isZero ? "zero" : "grid" }, root);
      const label = svg("text", { x: pad.left - 8, y: y(v) + 4, "text-anchor": "end", class: "tick-label" }, root);
      label.textContent = isZero ? "$0" : shortMoney(v);
    }

    // Time labels along the bottom.
    [[0, "Launch"], [12, "Year 1"], [24, "Year 2"], [36, "Year 3"]].forEach(function (t) {
      const anchor = t[0] === 0 ? "start" : t[0] === months ? "end" : "middle";
      const label = svg("text", { x: x(t[0]), y: height - 8, "text-anchor": anchor, class: "tick-label" }, root);
      label.textContent = t[1];
    });

    // Shading between the line and $0: green above, red below.
    const zeroY = y(0);
    const line = points.map(function (v, m) { return (m ? "L" : "M") + x(m).toFixed(1) + " " + y(v).toFixed(1); }).join(" ");
    const area = line + " L" + x(months).toFixed(1) + " " + zeroY + " L" + x(0).toFixed(1) + " " + zeroY + " Z";
    const defs = svg("defs", {}, root);
    const clipUp = svg("clipPath", { id: "clip-up" }, defs);
    svg("rect", { x: 0, y: 0, width: width, height: zeroY }, clipUp);
    const clipDown = svg("clipPath", { id: "clip-down" }, defs);
    svg("rect", { x: 0, y: zeroY, width: width, height: height - zeroY }, clipDown);
    svg("path", { d: area, class: "area-up", "clip-path": "url(#clip-up)" }, root);
    svg("path", { d: area, class: "area-down", "clip-path": "url(#clip-down)" }, root);

    // Redraw the zero line on top of the shading, then the running total itself.
    svg("line", { x1: pad.left, x2: width - pad.right, y1: zeroY, y2: zeroY, class: "zero" }, root);
    svg("path", { d: line, class: "line" }, root);

    // The payback month, in gold.
    if (result.payback !== null) {
      const px = x(result.payback);
      svg("line", { x1: px, x2: px, y1: pad.top - 6, y2: pad.top + plotH, class: "payback-line" }, root);
      svg("circle", { cx: px, cy: y(points[result.payback]), r: 5.5, class: "payback-dot" }, root);

      const text = "Payback, month " + result.payback;
      const onRight = px < pad.left + plotW * 0.7;
      const label = svg("text", {
        x: onRight ? px + 8 : px - 8, y: pad.top - 12,
        "text-anchor": onRight ? "start" : "end", class: "payback-label"
      }, root);
      label.textContent = text;
    }

    // One line under the chart with the three-year figure.
    captionEl.replaceChildren();
    captionEl.append("After three years the running total is ");
    const strong = document.createElement("strong");
    strong.textContent = money(points[months]);
    captionEl.append(strong, ".");
  }

  if (typeof ResizeObserver === "function") {
    let lastWidth = 0;
    new ResizeObserver(function () {
      const w = chartEl.clientWidth;
      if (lastChart && Math.abs(w - lastWidth) > 1) drawChart(lastChart.result, lastChart.setup);
      lastWidth = w;
    }).observe(chartEl);
  }

  // ---------- Which number matters most ----------

  const tornadoEl = document.getElementById("tornado");
  const rankEmptyEl = document.getElementById("rank-empty");

  function el(tag, className, text) {
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  // Each bar runs from the worse year-one net to the better one, split at the best guess.
  function drawTornado(rows, bestNet) {
    tornadoEl.replaceChildren();
    rankEmptyEl.hidden = rows !== null;
    if (!rows) return;
    if (!rows.length) {
      tornadoEl.appendChild(el("p", "card-sub", "Give at least one guess a low and a high to see the ranking."));
      return;
    }

    // One shared scale for every bar, wide enough for every result and the best guess.
    let lo = bestNet;
    let hi = bestNet;
    rows.forEach(function (r) {
      lo = Math.min(lo, r.atLow.yearOne, r.atHigh.yearOne);
      hi = Math.max(hi, r.atLow.yearOne, r.atHigh.yearOne);
    });
    const crossesZero = lo < 0 && hi > 0; // only then is a $0 line worth drawing
    const spare = (hi - lo) * 0.03 || 1000;
    lo -= spare;
    hi += spare;
    const pct = function (v) { return ((v - lo) / (hi - lo)) * 100; };
    const bestPct = pct(bestNet);

    function track() {
      const t = el("div", "t-track");
      if (crossesZero) {
        const zero = el("div", "t-zero");
        zero.style.left = pct(0) + "%";
        t.appendChild(zero);
      }
      const line = el("div", "t-best");
      line.style.left = bestPct + "%";
      t.appendChild(line);
      return t;
    }

    // Header row: what each column means, and where the best guess sits.
    const head = el("div", "t-row t-head");
    head.setAttribute("aria-hidden", "true");
    head.append(el("div", "t-name", ""), el("div", "t-worse", "Lower"));
    const headTrack = el("div", "t-track");
    const bestLabel = el("div", "t-best-label", "Best guesses: " + money(bestNet));
    bestLabel.style.left = bestPct + "%";
    if (bestPct < 25) { bestLabel.style.transform = "translateX(-12px)"; }
    if (bestPct > 75) { bestLabel.style.transform = "translateX(calc(-100% + 12px))"; }
    headTrack.appendChild(bestLabel);
    head.append(headTrack, el("div", "t-better", "Higher"));
    tornadoEl.appendChild(head);

    const list = el("ol", "visually-hidden");

    rows.forEach(function (r) {
      // Whichever end gives the lower year-one net goes on the left.
      const lowIsWorse = r.atLow.yearOne <= r.atHigh.yearOne;
      const worse = lowIsWorse ? { value: r.low, result: r.atLow } : { value: r.high, result: r.atHigh };
      const better = lowIsWorse ? { value: r.high, result: r.atHigh } : { value: r.low, result: r.atLow };

      const row = el("div", "t-row");
      row.setAttribute("aria-hidden", "true");
      row.appendChild(el("div", "t-name", r.input.label));

      const w = el("div", "t-worse", money(worse.result.yearOne));
      w.appendChild(el("span", "t-at", "at " + guessText(r.input, worse.value)));
      row.appendChild(w);

      const t = track();
      const worseLeft = pct(worse.result.yearOne);
      const betterRight = pct(better.result.yearOne);
      if (worseLeft < bestPct) {
        const bar = el("div", "t-bar worse");
        bar.style.left = worseLeft + "%";
        bar.style.width = (Math.min(bestPct, betterRight) - worseLeft) + "%";
        t.insertBefore(bar, t.firstChild);
      }
      if (betterRight > bestPct) {
        const bar = el("div", "t-bar better");
        const start = Math.max(bestPct, worseLeft);
        bar.style.left = start + "%";
        bar.style.width = (betterRight - start) + "%";
        t.insertBefore(bar, t.firstChild);
      }
      row.appendChild(t);

      const b = el("div", "t-better", money(better.result.yearOne));
      b.appendChild(el("span", "t-at", "at " + guessText(r.input, better.value)));
      row.appendChild(b);

      tornadoEl.appendChild(row);

      // The same facts as a plain list, for screen readers.
      list.appendChild(el("li", "", r.input.label + ": year-one net from " + money(worse.result.yearOne) +
        " at " + guessText(r.input, worse.value) + " to " + money(better.result.yearOne) +
        " at " + guessText(r.input, better.value) + "."));
    });

    tornadoEl.appendChild(list);
  }

  // ---------- The number to check first, in one sentence ----------

  const verdictEl = document.getElementById("verdict");
  const firstEl = document.getElementById("check-first");
  const leastEl = document.getElementById("matters-least");

  function showVerdict(rows, best) {
    const first = rows ? Model.checkFirst(rows, best) : null;
    const least = rows ? Model.mattersLeast(rows, best) : null;

    verdictEl.hidden = !rows || !rows.length;
    firstEl.replaceChildren();
    if (first) {
      firstEl.append(first.before, el("strong", "", first.name), first.after);
    } else if (rows && rows.length) {
      firstEl.textContent = "None of the ranges move the year-one net, so no single guess stands out.";
    }
    leastEl.textContent = least || "";
    leastEl.hidden = !least;
  }

  // ---------- Recalculate on every keystroke ----------

  function update() {
    const read = readAll();
    showNotes(read.blocking, read.notes);

    if (read.blocking.length) {
      showFigures(null);
      drawChart(null);
      drawTornado(null);
      showVerdict(null);
      return;
    }

    const result = Model.run(read.best, read.ramp);
    showFigures(result);
    drawChart(result, read.best.setup);

    const rows = Model.rank(read.best, read.ranges, read.ramp);
    drawTornado(rows, result.yearOne);
    showVerdict(rows, { guesses: read.best, payback: result.payback, yearOne: result.yearOne });
  }

  fillWithExample();
  update();
})();
