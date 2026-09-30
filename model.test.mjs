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

console.log(passed + " checks passed" + (process.exitCode ? ", some failed" : ""));
