# Is This AI Pilot Worth It?

A one-page business case for an AI pilot. You type seven guesses — how many people will use it, how many hours it saves them, what their time costs, and so on — and it tells you:

- **the payback month**: the first month the pilot has earned back what it cost,
- **the first-year net**: how far ahead (or behind) you are after twelve months,
- **the running total, month by month**, drawn as a chart,
- **which guess matters most**: each guess is moved to its low and its high while the others stay put, and the guesses are ranked by how much that moves the answer. One sentence then names the number to check before you trust the result.

Live at **https://jake.golisano.dev**. It runs entirely in your browser; nothing you type is sent anywhere.

**The numbers are illustrative.** They show how the calculator works, not what any real pilot will return. Replace them with yours before you take the answer to a meeting.

## What each file does

| File | What it is |
|---|---|
| `index.html` | The page itself: the title, the table of guesses, and the empty spaces the answer is drawn into. |
| `style.css` | How it looks: colours, spacing, and the layout for wide screens and phones. |
| `model.js` | The arithmetic. Every number on the page comes from here, and each step has a plain-English note above it. |
| `app.js` | Connects the page to the model: reads what you type, checks it, and draws the figures, the chart and the ranking. |
| `model.test.mjs` | Checks the arithmetic against numbers worked out by hand. Run it with `node model.test.mjs`. |
| `SPEC.md` | What the app is for, what "done" means, and what is deliberately left out. |

## How it got live

The code lives in this GitHub repository. Vercel, a hosting service, is connected to it: every time a change is saved to the `main` branch here, Vercel picks it up and publishes the new version within about a minute. The address `jake.golisano.dev` points at that Vercel project, so the link never changes while the page underneath it does. There is no server, database or API key involved — Vercel only hands your browser these few files.
