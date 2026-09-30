# Is This AI Pilot Worth It? — build spec

## Goal

A manager can see whether an AI pilot pays for itself, and which guess to check before trusting the answer.

## Done when

1. Seven inputs, each with a low, best and high guess, give a payback month and a first-year net.
2. The running total is drawn month by month.
3. The inputs are ranked by how much they move the answer.
4. One sentence names the number to check first, with what happens at its low guess.
5. Nothing is sent anywhere; it runs entirely in the browser.

## The seven guesses

| Input | Low | Best | High |
|---|---|---|---|
| People using it | 20 | 40 | 60 |
| Hours saved per person per week | 1 | 3 | 5 |
| Loaded hourly cost ($) | 40 | 55 | 70 |
| Adoption at its peak (%) | 30 | 60 | 80 |
| Share of saved time put to useful work (%) | 25 | 50 | 75 |
| Licence per person per month ($) | 20 | 30 | 60 |
| One-time setup and training ($) | 8,000 | 15,000 | 30,000 |

Plus one plain input: months to reach peak adoption = 3.

## The model

For each month m from 1 to 36:

- adoption in month m = peak adoption × min(1, m ÷ months to reach peak)
- value in month m = people × adoption × hours saved × 4.33 weeks × hourly cost × useful share − people × licence
- the running total starts at minus the setup cost and adds each month's value

Payback month is the first month the running total reaches zero or more (or "not within 3 years").
Year-one net is the running total at month 12.

With the best guesses, payback is month 4 and year-one net is $64,907.

## Not in this version

- Saving scenarios
- Sharing a link
- Printing a one-page case
- Any AI features

## Open questions

- Should "useful share" default to 50%?
