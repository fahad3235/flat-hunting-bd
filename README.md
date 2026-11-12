# Flat Hunting BD

Compare flats in Dhaka side by side, score them honestly, and keep your
visit notes in one place. A free, fully offline bilingual (Bangla/English)
web app - your data never leaves your device.

**Live demo:** https://fahad3235.github.io/flat-hunting-bd/
**Status:** MVP complete - see [Testing](#testing).

## The problem

Hunting for a flat in Dhaka means juggling half-remembered rents, deposits,
distances and "did that one have a lift?" across a dozen listings in chat
threads and notebooks. Flat Hunting BD puts every flat you are considering
in one list, ranks them with a transparent score you can check, works out
the real first-month move-in cost, and keeps a visit checklist per flat.

## Features

1. **Flat listings** - add, edit and delete flats: area, monthly rent,
   bedrooms, bathrooms, size (sq ft), floor, advance (months of rent),
   refundable deposit, distance to work/university, facilities (gas, water,
   lift, generator, parking), landlord name/phone and notes. Inline
   validation on every field.
2. **Transparent ranking** - every flat gets a score out of 100 from your
   own numbers (see [How the score works](#how-the-score-works)), ranked
   best-first with a "Best match" badge.
3. **Move-in cost** - first-month cost per flat: first rent + advance
   months + refundable deposit, shown on every card and in Compare.
4. **Visit checklist** - 8 checks per flat (daylight, water pressure, gas
   line, lift, generator, security, parking, quiet at night) with a
   completion percentage.
5. **Status pipeline + search** - To visit / Visited / Shortlisted /
   Rejected, filter by status, search by area or landlord.
6. **Data control** - everything in localStorage; JSON export (copy or
   download), strict JSON import, and typed-`DELETE` erase-all.
7. **Bilingual** - full English/Bangla UI with Bengali digits, persisted
   across reloads. Mobile-first layout (verified at 390px, no overflow).

## How the score works (out of 100)

| Part | Points | Rule |
| --- | --- | --- |
| Rent | 40 | Full points at or under your monthly budget, falling linearly to 0 at double your budget. |
| Size | 20 | Full points at 1,200 sq ft or more, proportional below that. |
| Bedrooms | 15 | 1 bed: 5, 2 beds: 10, 3 beds: 13, 4+ beds: 15. |
| Facilities | 15 | 3 points each for gas, water, lift, generator and parking. |
| Distance | 10 | Full points at 0 km, falling linearly to 0 at 10 km. |

The score only ranks the flats **you** entered, using **your** numbers. It is
not a valuation - always visit a flat before you decide.

## Stack

- Plain HTML + CSS + vanilla JavaScript (no build step, no dependencies,
  no network requests at all).
- Pure logic in `js/logic.js` (shared between the page and the Node tests).
- i18n in `js/i18n.js`, generated from `tools/gen_i18n.py`
  (`python3 tools/gen_i18n.py`) so every shipped file stays pure ASCII.

## Prerequisites

- Any modern browser (Chrome, Firefox, Safari, Edge).
- Node.js 18+ only if you want to run the tests.

## Run it

Open `index.html` in a browser, or serve the folder:

```sh
python3 -m http.server 8000
# then open http://localhost:8000/
```

No install step, no accounts, no server.

## Testing

```sh
node tests/logic.test.js   # 95 unit checks (validation, scoring, move-in cost,
                           # checklist math, formatting, export/import)
node tests/smoke.js        # 65 headless-Chrome checks (raw CDP, file://):
                           # add/edit/delete, validation, search/filter,
                           # ranking + budget change, detail + checklist,
                           # export/import round-trip, typed-DELETE erase,
                           # Bengali toggle + persistence, 390px layout,
                           # zero network requests, zero console errors
```

See `TEST_RESULTS.md` for the recorded results of the latest run.

## Deployment

Static site - any static host works. GitHub Pages: enable Pages on the
repo (Settings - Pages - Deploy from branch `main`, folder `/ (root)`).

## Limitations

- All amounts are whatever you type in - the app has no rent database and
  makes no claim about market rates.
- The score is a ranking aid, not a valuation and not legal or financial
  advice.
- Data lives in one browser's localStorage; use Export to back it up or
  move it to another device.
- The app does not contact landlords, list real flats, or check whether a
  flat is still available.

## Status

MVP complete and verified (run #311, 2026-11-12). Ships empty - no flats
are pre-loaded; add the ones you are actually considering.
