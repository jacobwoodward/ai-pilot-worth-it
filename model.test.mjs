// Checks the arithmetic in model.js against numbers worked out by hand.
// Run it with:  node model.test.mjs
// No installs needed. It prints one line per check and fails loudly if any is wrong.

import assert from "node:assert/strict";
import Model from "./model.js";

let passed = 0;
function check(name, fn) {
  try {
    fn();
    passed++;
    console.log("  ok  " + name);
  } catch (err) {
    console.error("  FAIL " + name + "\n       " + err.message);
    process.exitCode = 1;
  }
}

const RAMP = Model.DEFAULT_RAMP_MONTHS;
const best = Model.bestGuesses();

console.log("Best guesses");
check("payback is month 4", () => {
  assert.equal(Model.run(best, RAMP).payback, 4);
});
check("year-one net is $64,907", () => {
  assert.equal(Math.round(Model.run(best, RAMP).yearOne), 64907);
});
check("the running total has 36 months", () => {
  assert.equal(Model.run(best, RAMP).running.length, 36);
});
check("zero adoption never pays back", () => {
  assert.equal(Model.run({ ...best, adoption: 0 }, RAMP).payback, null);
});

console.log("One guess at a time at its low, then its high (payback month, year-one net)");
const expected = {
  hours:    { low: [11, 2036],  high: [3, 127779] },
  adoption: { low: [7, 17754],  high: [3, 96343] },
  useful:   { low: [7, 17754],  high: [3, 112061] },
  rate:     { low: [5, 39187],  high: [3, 90628] },
  licence:  { low: [4, 69707],  high: [4, 50507] },
  setup:    { low: [3, 71907],  high: [6, 49907] }
};
const rows = Model.rank(best, Model.exampleRanges(), RAMP);
const byKey = Object.fromEntries(rows.map((r) => [r.input.key, r]));
for (const [key, sides] of Object.entries(expected)) {
  for (const side of ["low", "high"]) {
    const [month, net] = sides[side];
    check(`${key} at its ${side}: month ${month}, $${net.toLocaleString("en-US")}`, () => {
      const result = side === "low" ? byKey[key].atLow : byKey[key].atHigh;
      assert.equal(result.payback, month);
      assert.equal(Math.round(result.yearOne), net);
    });
  }
}
check("hours saved moves the answer most", () => {
  assert.equal(rows[0].input.key, "hours");
});
check("licence price moves it least", () => {
  assert.equal(rows[rows.length - 1].input.key, "licence");
});
check("rows are in order of swing, biggest first", () => {
  for (let i = 1; i < rows.length; i++) assert.ok(rows[i - 1].swing >= rows[i].swing);
});
check("a guess with no range is left out of the ranking", () => {
  const ranges = Model.exampleRanges();
  delete ranges.hours;
  assert.equal(Model.rank(best, ranges, RAMP).some((r) => r.input.key === "hours"), false);
});

console.log(passed + " checks passed" + (process.exitCode ? ", some failed" : ""));
