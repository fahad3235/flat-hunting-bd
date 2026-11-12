# TEST RESULTS - flat-hunting-bd (run #311, 2026-11-12 10:00 slot)

## Unit tests - `node tests/logic.test.js`
**95 checks, 0 failed** (2026-11-12 ~10:20 +06).

Covered: parseAmount/parseIntField/parseDecimalField (comma stripping,
empty/abc/negative rejection, 2.5 decimal handling), validateFlat (valid,
empty area, area >60, rent 999/500001/abc, bedrooms 0/9, size 99/10001,
floor 31, advance 7, deposit 1000001, distance 100.1, bad/good phone,
notes >300, bad status), validateBudget (20000 ok, 4999/500001/abc fail),
scoring (rent 40 at/under budget, 20 at 1.5x, 0 at 2x/3x; size 20 at
1200, 10 at 600, capped at 2400; rooms 5/10/13/15; facilities 0/12/15;
distance 10/5/0; full sample score exactly 90; ranking best-first),
move-in cost (18000 x (1+1) + 20000 = 56000; zero-advance case; 6-month
advance case), checklist math (0%, 4/8 = 50%, 8/8 = 100%), formatting
(commas, Bengali digits, taka sign, km in both languages), export/import
round-trip + wrong-app / bad-version / missing-data / bad-lang /
bad-budget / duplicate-id / invalid-flat / missing-checklist-key
rejection, i18n EN/BN key parity (113 keys), state helpers, weights sum
to 100.

Repairs during testing (1, test-side only): the "export carries app +
version" assertion expected a space after the colon; JSON.stringify
emits none. No app-logic bugs found.

## Smoke tests - `node tests/smoke.js` (headless_shell-1187, raw CDP, file://)
**65 checks, 0 failed** (2026-11-12 ~10:21 +06).

Covered: defaults (3 tabs, budget 20000, empty list, compare empty, 5
how-it-works items, 0 flats); validation (empty area + rent 999 blocked,
bad phone blocked, still 1 flat); add flat A (Mirpur 10, 18000, 2/2,
1200 sq ft, adv 1, dep 20000, 2 km, 4 facilities) - score 90/100,
move-in Tk 56,000; add flat B (Uttara, 35000, 1 bed, 800 sq ft, 9 km,
no facilities) after fixing phone; search "Uttara" - 1 card; filter
rejected - 0, all - 2; compare ranks Mirpur 1 (90) with Best-match
badge; budget 15000 - Mirpur 82; budget 100 rejected, back to 20000
clears error; detail view (move-in shown, 8 checklist boxes), tick 2
- 25%; edit rent 18000 - 16000 - move-in Tk 52,000; export/import
round-trip via `window.__fhb` hooks + wrong-app rejection + bad UI
import error + good UI import; typed-DELETE erase (wrong word rejected,
data kept; DELETE erases); BN toggle (title, money digits - 52,000 shown
in Bengali digits, tab label), persistence across reload, back to EN;
footer disclaimer; 390px no horizontal overflow on all 3 tabs; zero
non-file network requests; no console/page errors.

Repairs during testing (0 app bugs): none. One build-time fix before
testing: `js/app.js` was truncated to 0 bytes by a failed in-place
ASCII-conversion write; rewritten from scratch with \uXXXX escapes and
re-verified (all shipped files pure ASCII, all JS syntax-checked).
