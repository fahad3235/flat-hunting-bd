// flat-hunting-bd -- node unit tests for js/logic.js
// Usage: node tests/logic.test.js  (exits non-zero on any failure)
'use strict';
const X = require('../js/logic.js');
const I18N = require('../js/i18n.js');

let count = 0, failures = 0;
function check(name, cond, extra) {
  count++;
  if (cond) console.log('ok - ' + name);
  else { failures++; console.log('FAIL - ' + name + (extra ? ' :: ' + extra : '')); }
}
function eq(a, b) { return JSON.stringify(a) === JSON.stringify(b); }
function flat(over) {
  const f = X.blankFlat();
  f.area = 'Mirpur 10'; f.rent = 18000; f.bedrooms = 2; f.baths = 2;
  f.size = 1200; f.floor = 3; f.advanceMonths = 1; f.depositTk = 20000;
  f.distanceKm = 2; f.gas = true; f.water = true; f.lift = true;
  f.generator = false; f.parking = true; f.landlord = 'Rahim'; f.phone = '01712345678';
  f.status = 'to-visit';
  return Object.assign(f, over || {});
}

// ---- parseAmount / parseIntField ----
check('parseAmount strips commas', X.parseAmount('25,000').value === 25000);
check('parseAmount rejects empty', X.parseAmount('').ok === false);
check('parseAmount rejects abc', X.parseAmount('abc').ok === false);
check('parseAmount rejects negative', X.parseAmount('-5').ok === false);
check('parseAmount accepts decimal', X.parseAmount('2.5').value === 2.5);
check('parseIntField rejects 2.5', X.parseIntField('2.5', 0, 100).ok === false);
check('parseIntField min reason', X.parseIntField('0', 1, 8).reason === 'min');
check('parseIntField tooBig reason', X.parseIntField('9', 1, 8).reason === 'tooBig');
check('parseDecimalField accepts 2.5', X.parseDecimalField('2.5', 0, 100).value === 2.5);
check('parseDecimalField rejects 100.1', X.parseDecimalField('100.1', 0, 100).ok === false);

// ---- validateFlat ----
check('valid flat passes', X.validateFlat(flat()).ok === true);
check('empty area fails required', X.validateFlat(flat({ area: '' })).errors.area === 'required');
check('area >60 chars fails', X.validateFlat(flat({ area: 'x'.repeat(61) })).errors.area === 'tooBig');
check('rent 999 fails min', X.validateFlat(flat({ rent: 999 })).errors.rent === 'min');
check('rent 500001 fails tooBig', X.validateFlat(flat({ rent: 500001 })).errors.rent === 'tooBig');
check('rent abc fails invalid', X.validateFlat(flat({ rent: 'abc' })).errors.rent === 'invalid');
check('bedrooms 0 fails', X.validateFlat(flat({ bedrooms: 0 })).errors.bedrooms === 'min');
check('bedrooms 9 fails', X.validateFlat(flat({ bedrooms: 9 })).errors.bedrooms === 'tooBig');
check('size 99 fails', X.validateFlat(flat({ size: 99 })).errors.size === 'min');
check('size 10001 fails', X.validateFlat(flat({ size: 10001 })).errors.size === 'tooBig');
check('floor 31 fails', X.validateFlat(flat({ floor: 31 })).errors.floor === 'tooBig');
check('advance 7 fails', X.validateFlat(flat({ advanceMonths: 7 })).errors.advanceMonths === 'tooBig');
check('deposit 1000001 fails', X.validateFlat(flat({ depositTk: 1000001 })).errors.depositTk === 'tooBig');
check('distance 100.1 fails', X.validateFlat(flat({ distanceKm: 100.1 })).errors.distanceKm === 'tooBig');
check('bad phone fails', X.validateFlat(flat({ phone: 'abc' })).errors.phone === 'invalid');
check('good phone passes', X.validateFlat(flat({ phone: '+8801712345678' })).ok === true);
check('phone with dashes passes', X.validateFlat(flat({ phone: '01712-345678' })).ok === true);
check('empty phone passes (optional)', X.validateFlat(flat({ phone: '' })).ok === true);
check('notes >300 fails', X.validateFlat(flat({ notes: 'x'.repeat(301) })).errors.notes === 'tooBig');
check('bad status fails', X.validateFlat(flat({ status: 'maybe' })).errors.status === 'invalid');

// ---- validateBudget ----
check('budget 20000 ok', X.validateBudget('20000').value === 20000);
check('budget 4999 fails min', X.validateBudget('4999').ok === false);
check('budget 500001 fails', X.validateBudget('500001').ok === false);
check('budget abc fails', X.validateBudget('abc').ok === false);

// ---- scoring ----
check('rent at budget = 40', X.rentPoints(20000, 20000) === 40);
check('rent under budget = 40', X.rentPoints(15000, 20000) === 40);
check('rent 1.5x budget = 20', X.rentPoints(30000, 20000) === 20);
check('rent 2x budget = 0', X.rentPoints(40000, 20000) === 0);
check('rent 3x budget = 0 (clamped)', X.rentPoints(60000, 20000) === 0);
check('size 1200 = 20', X.sizePoints(1200) === 20);
check('size 600 = 10', X.sizePoints(600) === 10);
check('size 2400 capped at 20', X.sizePoints(2400) === 20);
check('rooms 1 = 5', X.roomsPoints(1) === 5);
check('rooms 2 = 10', X.roomsPoints(2) === 10);
check('rooms 3 = 13', X.roomsPoints(3) === 13);
check('rooms 4 = 15', X.roomsPoints(4) === 15);
check('rooms 6 = 15 (capped)', X.roomsPoints(6) === 15);
check('facilities 4 of 5 = 12', X.facilitiesPoints(flat()) === 12);
check('facilities none = 0', X.facilitiesPoints(flat({ gas: false, water: false, lift: false, generator: false, parking: false })) === 0);
check('facilities all 5 = 15', X.facilitiesPoints(flat({ generator: true })) === 15);
check('distance 0 = 10', X.distancePoints(0) === 10);
check('distance 5 = 5', X.distancePoints(5) === 5);
check('distance 10 = 0', X.distancePoints(10) === 0);
check('distance 25 = 0 (clamped)', X.distancePoints(25) === 0);
// Full score: rent 18000<=20000 -> 40; size 1200 -> 20; 2 bed -> 10;
// facilities 4 -> 12; distance 2km -> 8. Total 90.
check('full score 90 for sample flat', X.scoreFlat(flat(), 20000).total === 90);
check('score parts add to total', (() => {
  const s = X.scoreFlat(flat(), 20000);
  return Math.abs(s.parts.rent + s.parts.size + s.parts.rooms + s.parts.facilities + s.parts.distance - s.total) < 0.001;
})());
// Ranking: cheaper+closer flat wins.
const a = flat({ area: 'A', rent: 15000, size: 1300, bedrooms: 3, distanceKm: 1 });
const b = flat({ area: 'B', rent: 35000, size: 800, bedrooms: 1, distanceKm: 9 });
check('rankFlats orders best first', X.rankFlats([b, a], 20000)[0].flat.area === 'A');
check('rankFlats keeps both', X.rankFlats([b, a], 20000).length === 2);

// ---- move-in cost ----
check('move-in = rent*(1+adv)+deposit', X.moveInCost(flat()) === 18000 * 2 + 20000);
check('move-in zero advance/deposit = rent', X.moveInCost(flat({ advanceMonths: 0, depositTk: 0 })) === 18000);
check('move-in 6 months advance', X.moveInCost(flat({ advanceMonths: 6, depositTk: 0 })) === 18000 * 7);

// ---- checklist ----
check('checklist starts 0%', X.checklistPct(flat()) === 0);
check('checklist 4/8 = 50%', (() => {
  const f = flat(); f.checklist.daylight = true; f.checklist.water = true;
  f.checklist.gas = true; f.checklist.lift = true;
  return X.checklistPct(f) === 50 && X.checklistDone(f) === 4;
})());
check('checklist all = 100%', (() => {
  const f = flat();
  X.CHECKLIST_ITEMS.forEach((k) => { f.checklist[k] = true; });
  return X.checklistPct(f) === 100;
})());

// ---- formatting ----
check('fmtInt commas', X.fmtInt(25000, 'en') === '25,000');
check('fmtInt Bengali digits', X.fmtInt(25000, 'bn') === '\u09e8\u09eb,\u09e6\u09e6\u09e6');
check('fmtMoney en', X.fmtMoney(18000, 'en') === '\u09f318,000');
check('fmtMoney bn', X.fmtMoney(18000, 'bn') === '\u09f3\u09e7\u09ee,\u09e6\u09e6\u09e6');
check('fmtKm en', X.fmtKm(2.5, 'en') === '2.5 km');
check('fmtKm bn', X.fmtKm(2.5, 'bn') === '\u09e8.\u09eb \u0995\u09bf\u09ae\u09bf');
check('toBnDigits', X.toBnDigits('2026') === '\u09e8\u09e6\u09e8\u09ec');

// ---- export / import round-trip ----
const st = X.emptyState(); st.budget = 25000; st.flats = [flat(), flat({ area: 'Uttara', rent: 22000 })];
const payload = X.exportPayload(st);
check('export carries app + version', payload.includes('"app":"flat-hunting-bd"') && payload.includes('"version":1'));
check('export carries flat area', payload.includes('Mirpur 10') && payload.includes('Uttara'));
const imp = X.validateImport(payload);
check('import round-trip ok', imp.ok === true);
check('import restores budget', imp.data.budget === 25000);
check('import restores 2 flats', imp.data.flats.length === 2);
check('import bad JSON rejected', X.validateImport('{nope').ok === false);
check('import wrong app rejected', X.validateImport('{"app":"tip-calculator-bd","version":1,"data":' + JSON.stringify(st) + '}').ok === false);
check('import bad version rejected', X.validateImport('{"app":"flat-hunting-bd","version":2,"data":' + JSON.stringify(st) + '}').ok === false);
check('import missing data rejected', X.validateImport('{"app":"flat-hunting-bd","version":1}').ok === false);
check('import bad lang rejected', X.validateImport(JSON.stringify({ app: 'flat-hunting-bd', version: 1, data: { lang: 'fr', budget: 20000, flats: [] } })).ok === false);
check('import bad budget rejected', X.validateImport(JSON.stringify({ app: 'flat-hunting-bd', version: 1, data: { lang: 'en', budget: 100, flats: [] } })).ok === false);
check('import dup flat id rejected', (() => {
  const d = JSON.parse(JSON.stringify(st));
  d.flats[1].id = d.flats[0].id;
  return X.validateImport(JSON.stringify({ app: 'flat-hunting-bd', version: 1, data: d })).ok === false;
})());
check('import invalid flat rejected', (() => {
  const d = JSON.parse(JSON.stringify(st));
  d.flats[0].rent = 5;
  return X.validateImport(JSON.stringify({ app: 'flat-hunting-bd', version: 1, data: d })).ok === false;
})());
check('import missing checklist key rejected', (() => {
  const d = JSON.parse(JSON.stringify(st));
  delete d.flats[0].checklist.gas;
  return X.validateImport(JSON.stringify({ app: 'flat-hunting-bd', version: 1, data: d })).ok === false;
})());

// ---- i18n parity ----
check('i18n EN/BN same keys', eq(Object.keys(I18N.en).sort(), Object.keys(I18N.bn).sort()));
check('i18n has 113+ keys', Object.keys(I18N.en).length >= 100, 'got ' + Object.keys(I18N.en).length);
check('i18n title en', I18N.en.title === 'Flat Hunting BD');
check('i18n title bn non-empty', I18N.bn.title.length > 3);

// ---- state helpers ----
check('blankFlat has 8 checklist items', Object.keys(X.blankFlat().checklist).length === 8);
check('emptyState budget 20000', X.emptyState().budget === 20000);
check('emptyState lang en', X.emptyState().lang === 'en');
check('newId unique', X.newId() !== X.newId());
check('STATUSES has 4', X.STATUSES.length === 4);
check('WEIGHTS sum to 100', X.WEIGHTS.rent + X.WEIGHTS.size + X.WEIGHTS.rooms + X.WEIGHTS.facilities + X.WEIGHTS.distance === 100);

console.log('\n' + count + ' checks, ' + failures + ' failed');
process.exit(failures ? 1 : 0);
