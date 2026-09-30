/*
  model.js — the whole business case, in one small file.

  Everything the page shows comes from the arithmetic in this file.
  Nothing here talks to the internet: it takes your guesses, does the sums
  in your browser, and hands back the answer.

  How to read it: each function has a plain-English note above it saying
  what it does. You do not need to follow the code line by line to check
  the logic; the notes are the logic.
*/
(function (root) {
  "use strict";

  // A month has about 4.33 weeks in it (52 weeks ÷ 12 months).
  const WEEKS_PER_MONTH = 4.33;

  // We follow the pilot for three years, month by month.
  const MONTHS = 36;

  // The seven guesses. Each one has a low, a best and a high value.
  // The best values are what the page starts with.
  //   kind   — how to show the number: "count", "money" or "percent"
  //   phrase — how the number is named in a sentence
  const INPUTS = [
    { key: "people",   label: "People using it",                        kind: "count",   low: 20,   best: 40,    high: 60,    phrase: "the number of people using it" },
    { key: "hours",    label: "Hours saved per person per week",        kind: "count",   low: 1,    best: 3,     high: 5,     phrase: "hours saved per person per week" },
    { key: "rate",     label: "Loaded hourly cost",                     kind: "money",   low: 40,   best: 55,    high: 70,    phrase: "the loaded hourly cost" },
    { key: "adoption", label: "Adoption at its peak",                   kind: "percent", low: 30,   best: 60,    high: 80,    phrase: "peak adoption" },
    { key: "useful",   label: "Share of saved time put to useful work", kind: "percent", low: 25,   best: 50,    high: 75,    phrase: "the share of saved time put to useful work" },
    { key: "licence",  label: "Licence per person per month",           kind: "money",   low: 20,   best: 30,    high: 60,    phrase: "licence price" },
    { key: "setup",    label: "One-time setup and training",            kind: "money",   low: 8000, best: 15000, high: 30000, phrase: "the setup and training cost" }
  ];

  // The one plain input: how many months it takes for use to reach its peak.
  const DEFAULT_RAMP_MONTHS = 3;

  // The best guess for every input, as one set: { people: 40, hours: 3, ... }
  function bestGuesses() {
    const guesses = {};
    INPUTS.forEach(function (input) { guesses[input.key] = input.best; });
    return guesses;
  }

  /*
    run(guesses, rampMonths)

    Works out the business case for one set of guesses.

    Month by month, for three years:
      1. Adoption climbs in a straight line from zero to its peak, reaching
         the peak after `rampMonths` months, then stays there.
      2. The value that month is the hours saved, turned into money, minus
         the licences:
           people × adoption × hours saved a week × 4.33 weeks
                  × hourly cost × share put to useful work
           − people × licence per month
      3. The running total starts in the red by the setup cost and adds
         each month's value.

    It hands back:
      running  — the running total at the end of each month (36 numbers)
      payback  — the first month the running total reaches zero or more,
                 or null if that does not happen within three years
      yearOne  — the running total at the end of month 12
  */
  function run(guesses, rampMonths) {
    const g = guesses;
    const peak = g.adoption / 100;   // typed as a percent, used as a share
    const useful = g.useful / 100;   // same

    let total = -g.setup;
    let payback = null;
    const running = [];

    for (let month = 1; month <= MONTHS; month++) {
      const rampShare = rampMonths > 0 ? Math.min(1, month / rampMonths) : 1;
      const adoption = peak * rampShare;

      const valueOfTimeSaved =
        g.people * adoption * g.hours * WEEKS_PER_MONTH * g.rate * useful;
      const licences = g.people * g.licence;

      total += valueOfTimeSaved - licences;
      running.push(total);

      if (payback === null && total >= 0) payback = month;
    }

    return { running: running, payback: payback, yearOne: running[11] };
  }

  /*
    rank(best, ranges, rampMonths)

    Answers "which guess matters most?"

    For each guess that has a low and a high, it runs the business case
    twice: once with that guess at its low and once at its high, leaving
    every other guess at its best. The "swing" is how far apart the two
    year-one nets land. The bigger the swing, the more the answer depends
    on getting that guess right.

      best    — the best guesses, e.g. { people: 40, hours: 3, ... }
      ranges  — the low and high for each guess, e.g. { hours: { low: 1, high: 5 }, ... }
                (a guess left out of ranges is left out of the ranking)

    It hands back one row per guess, biggest swing first. Each row has:
      input     — which guess (from INPUTS above)
      low, high — the two values tried
      atLow     — the result with the guess at its low  ({ payback, yearOne })
      atHigh    — the result with the guess at its high
      swing     — the gap between the two year-one nets, always positive
  */
  function rank(best, ranges, rampMonths) {
    const rows = [];

    INPUTS.forEach(function (input) {
      const range = ranges[input.key];
      if (!range) return;

      const atLow = run(Object.assign({}, best, { [input.key]: range.low }), rampMonths);
      const atHigh = run(Object.assign({}, best, { [input.key]: range.high }), rampMonths);

      rows.push({
        input: input,
        low: range.low,
        high: range.high,
        atLow: { payback: atLow.payback, yearOne: atLow.yearOne },
        atHigh: { payback: atHigh.payback, yearOne: atHigh.yearOne },
        swing: Math.abs(atHigh.yearOne - atLow.yearOne)
      });
    });

    // Biggest swing first. Ties keep the order of the table.
    rows.sort(function (a, b) { return b.swing - a.swing; });
    return rows;
  }

  // The low and high for every guess, as set out in INPUTS.
  function exampleRanges() {
    const ranges = {};
    INPUTS.forEach(function (input) { ranges[input.key] = { low: input.low, high: input.high }; });
    return ranges;
  }

  /*
    Sentences

    These turn the ranking into plain words. Every number in them comes
    from the sums above; nothing is typed in by hand.
  */

  const wholeNumber = new Intl.NumberFormat("en-US", { maximumFractionDigits: 0 });
  const upToTwoPlaces = new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 });

  // $64,907, or −$1,453 with a real minus sign.
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

  function monthText(payback) {
    return payback === null ? "beyond three years" : "month " + payback;
  }

  function capitalise(text) {
    return text.charAt(0).toUpperCase() + text.slice(1);
  }

  /*
    checkFirst(rows, best)

    The sentence about the guess at the top of the ranking. It says what
    happens if that guess turns out at its worse end (for most guesses,
    the low one; for the costs, the high one).

    Hands back three pieces so the page can put the name in bold:
      { before: "The number to check first is ",
        name:   "hours saved per person per week",
        after:  ". At 1 instead of 3, payback moves from month 4 to month 11." }
    or null if no guess moves the answer at all.
  */
  function checkFirst(rows, best) {
    if (!rows.length || rows[0].swing < 0.5) return null;

    const top = rows[0];
    const lowIsWorse = top.atLow.yearOne <= top.atHigh.yearOne;
    const worseValue = lowIsWorse ? top.low : top.high;
    const worse = lowIsWorse ? top.atLow : top.atHigh;
    const at = "At " + guessText(top.input, worseValue) +
               " instead of " + guessText(top.input, best.guesses[top.input.key]) + ", ";

    // Usually the worse end lowers the net; if the best guess sits outside its range it can raise it.
    const netChange = (worse.yearOne < best.yearOne ? "falls" : "rises") +
      " from " + money(best.yearOne) + " to " + money(worse.yearOne);

    let after;
    if (best.payback !== null && worse.payback === null) {
      after = at + "the pilot no longer pays for itself within three years.";
    } else if (best.payback !== null && worse.payback !== best.payback) {
      after = at + "payback moves from month " + best.payback + " to month " + worse.payback + ".";
    } else if (best.payback !== null) {
      after = at + "payback stays in month " + best.payback +
              " but the year-one net " + netChange + ".";
    } else {
      after = at + "the year-one net " + netChange + ".";
    }

    return { before: "The number to check first is ", name: top.input.phrase, after: ". " + after };
  }

  /*
    mattersLeast(rows, best)

    The sentence about the guess at the bottom of the ranking, e.g.
      "Licence price barely matters: anywhere from $20 to $60, payback stays in month 4."
    Returns null when there are fewer than two guesses to compare.
  */
  function mattersLeast(rows, best) {
    if (rows.length < 2) return null;

    const last = rows[rows.length - 1];
    const name = capitalise(last.input.phrase);
    const span = "anywhere from " + guessText(last.input, last.low) + " to " + guessText(last.input, last.high) + ", ";
    const months = [last.atLow.payback, best.payback, last.atHigh.payback];
    const allSame = months.every(function (m) { return m === months[0]; });

    if (allSame && months[0] !== null) {
      return name + " barely matters: " + span + "payback stays in month " + months[0] + ".";
    }
    if (allSame) {
      return name + " matters least: " + span + "the pilot still does not pay for itself within three years.";
    }

    // Payback does move a little: say between which months.
    const known = months.filter(function (m) { return m !== null; });
    const earliest = Math.min.apply(null, known);
    const latest = months.indexOf(null) >= 0 ? null : Math.max.apply(null, known);
    return name + " matters least: " + span + "payback moves only between month " + earliest +
           " and " + monthText(latest) + ".";
  }

  const Model = {
    WEEKS_PER_MONTH: WEEKS_PER_MONTH,
    MONTHS: MONTHS,
    INPUTS: INPUTS,
    DEFAULT_RAMP_MONTHS: DEFAULT_RAMP_MONTHS,
    bestGuesses: bestGuesses,
    exampleRanges: exampleRanges,
    run: run,
    rank: rank,
    checkFirst: checkFirst,
    mattersLeast: mattersLeast,
    money: money,
    guessText: guessText
  };

  // Works both in the browser (as window.Model) and in the test script.
  if (typeof module === "object" && module.exports) module.exports = Model;
  else root.Model = Model;
})(typeof globalThis !== "undefined" ? globalThis : this);
