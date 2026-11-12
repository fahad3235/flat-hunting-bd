// flat-hunting-bd -- pure logic (no DOM). Node-testable.
// All money is integer Taka. No external data, no fabricated prices:
// every amount comes from the user.
'use strict';

const APP = 'flat-hunting-bd';
const VERSION = 1;

const STATUSES = ['to-visit', 'visited', 'shortlisted', 'rejected'];
const CHECKLIST_ITEMS = [
  'daylight', 'water', 'gas', 'lift', 'generator', 'security', 'parking', 'quiet',
];
const FACILITIES = ['gas', 'water', 'lift', 'generator', 'parking'];

// Scoring weights (documented in README + UI): total 100.
const WEIGHTS = { rent: 40, size: 20, rooms: 15, facilities: 15, distance: 10 };
const SIZE_FULL = 1200; // sq ft earning full size points
const DIST_FULL = 10; // km at which distance points reach 0

function newId() {
  return 'f' + Date.now().toString(36) + Math.floor(Math.random() * 1296).toString(36);
}

function blankChecklist() {
  const c = {};
  CHECKLIST_ITEMS.forEach((k) => { c[k] = false; });
  return c;
}

function blankFlat() {
  return {
    id: newId(),
    area: '',
    rent: 0,
    bedrooms: 2,
    baths: 1,
    size: 0,
    floor: 0,
    gas: false,
    water: false,
    lift: false,
    generator: false,
    parking: false,
    advanceMonths: 1,
    depositTk: 0,
    distanceKm: 0,
    landlord: '',
    phone: '',
    notes: '',
    status: 'to-visit',
    checklist: blankChecklist(),
    createdAt: Date.now(),
  };
}

function emptyState() {
  return { lang: 'en', budget: 20000, flats: [] };
}

// ---- numbers ----
function parseAmount(raw) {
  if (raw === null || raw === undefined) return { ok: false, reason: 'required' };
  const s = String(raw).trim().replace(/,/g, '');
  if (s === '') return { ok: false, reason: 'required' };
  if (!/^\d+(\.\d+)?$/.test(s)) return { ok: false, reason: 'invalid' };
  const v = Number(s);
  if (!Number.isFinite(v)) return { ok: false, reason: 'invalid' };
  return { ok: true, value: v };
}

function parseIntField(raw, min, max) {
  const p = parseAmount(raw);
  if (!p.ok) return p;
  if (!Number.isInteger(p.value)) return { ok: false, reason: 'invalid' };
  if (p.value < min) return { ok: false, reason: 'min' };
  if (p.value > max) return { ok: false, reason: 'tooBig' };
  return { ok: true, value: p.value };
}

function parseDecimalField(raw, min, max) {
  const p = parseAmount(raw);
  if (!p.ok) return p;
  if (p.value < min) return { ok: false, reason: 'min' };
  if (p.value > max) return { ok: false, reason: 'tooBig' };
  return { ok: true, value: p.value };
}

// ---- validation ----
function validateFlat(f) {
  const errors = {};
  if (typeof f.area !== 'string' || f.area.trim() === '') errors.area = 'required';
  else if (f.area.trim().length > 60) errors.area = 'tooBig';
  const rent = parseIntField(f.rent, 1000, 500000);
  if (!rent.ok) errors.rent = rent.reason;
  const bd = parseIntField(f.bedrooms, 1, 8);
  if (!bd.ok) errors.bedrooms = bd.reason;
  const ba = parseIntField(f.baths, 1, 6);
  if (!ba.ok) errors.baths = ba.reason;
  const sz = parseIntField(f.size, 100, 10000);
  if (!sz.ok) errors.size = sz.reason;
  const fl = parseIntField(f.floor, 0, 30);
  if (!fl.ok) errors.floor = fl.reason;
  const adv = parseIntField(f.advanceMonths, 0, 6);
  if (!adv.ok) errors.advanceMonths = adv.reason;
  const dep = parseIntField(f.depositTk, 0, 1000000);
  if (!dep.ok) errors.depositTk = dep.reason;
  const dist = parseDecimalField(f.distanceKm, 0, 100);
  if (!dist.ok) errors.distanceKm = dist.reason;
  if (f.phone && String(f.phone).trim() !== '') {
    const ph = String(f.phone).trim();
    if (!/^[+0-9][0-9 \-]{5,14}$/.test(ph)) errors.phone = 'invalid';
  }
  if (f.landlord && String(f.landlord).length > 60) errors.landlord = 'tooBig';
  if (f.notes && String(f.notes).length > 300) errors.notes = 'tooBig';
  if (f.status && STATUSES.indexOf(f.status) === -1) errors.status = 'invalid';
  return { ok: Object.keys(errors).length === 0, errors };
}

function validateBudget(raw) {
  return parseIntField(raw, 5000, 500000);
}

// ---- scoring (all inputs user-entered; weights fixed + documented) ----
function rentPoints(rent, budget) {
  if (rent <= budget) return WEIGHTS.rent;
  const over = (rent - budget) / budget; // 0..1 at 2x budget
  return Math.max(0, WEIGHTS.rent * (1 - over));
}

function sizePoints(size) {
  return WEIGHTS.size * Math.min(1, size / SIZE_FULL);
}

function roomsPoints(bedrooms) {
  if (bedrooms >= 4) return 15;
  if (bedrooms === 3) return 13;
  if (bedrooms === 2) return 10;
  return 5;
}

function facilitiesPoints(flat) {
  let n = 0;
  FACILITIES.forEach((k) => { if (flat[k]) n++; });
  return n * 3; // 3 pts each, max 15
}

function distancePoints(km) {
  return WEIGHTS.distance * Math.max(0, 1 - km / DIST_FULL);
}

function scoreFlat(flat, budget) {
  const parts = {
    rent: rentPoints(flat.rent, budget),
    size: sizePoints(flat.size),
    rooms: roomsPoints(flat.bedrooms),
    facilities: facilitiesPoints(flat),
    distance: distancePoints(flat.distanceKm),
  };
  const total = parts.rent + parts.size + parts.rooms + parts.facilities + parts.distance;
  return { parts, total: Math.round(total * 10) / 10 };
}

function rankFlats(flats, budget) {
  return flats
    .map((f) => ({ flat: f, score: scoreFlat(f, budget) }))
    .sort((a, b) => b.score.total - a.score.total || a.flat.createdAt - b.flat.createdAt);
}

// First-month move-in cost: first rent + advance months + refundable deposit.
function moveInCost(flat) {
  return flat.rent * (1 + flat.advanceMonths) + flat.depositTk;
}

function checklistPct(flat) {
  const c = flat.checklist || {};
  let done = 0;
  CHECKLIST_ITEMS.forEach((k) => { if (c[k]) done++; });
  return Math.round((done / CHECKLIST_ITEMS.length) * 100);
}

function checklistDone(flat) {
  const c = flat.checklist || {};
  let done = 0;
  CHECKLIST_ITEMS.forEach((k) => { if (c[k]) done++; });
  return done;
}

// ---- formatting ----
const BN_DIGITS = ['\u09e6', '\u09e7', '\u09e8', '\u09e9', '\u09ea', '\u09eb', '\u09ec', '\u09ed', '\u09ee', '\u09ef'];
function toBnDigits(s) {
  return String(s).replace(/[0-9]/g, (d) => BN_DIGITS[Number(d)]);
}

function fmtInt(n, lang) {
  const s = String(Math.round(n)).replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return lang === 'bn' ? toBnDigits(s) : s;
}

function fmtMoney(n, lang) {
  return '\u09f3' + fmtInt(n, lang);
}

function fmtKm(km, lang) {
  const s = (Math.round(km * 10) / 10).toString();
  return lang === 'bn' ? toBnDigits(s) + ' \u0995\u09bf\u09ae\u09bf' : s + ' km';
}

// ---- export / import ----
function exportPayload(state) {
  return JSON.stringify({ app: APP, version: VERSION, data: state });
}

function validateImport(text) {
  let obj;
  try {
    obj = JSON.parse(text);
  } catch (e) {
    return { ok: false, reason: 'badJson' };
  }
  if (!obj || typeof obj !== 'object') return { ok: false, reason: 'badShape' };
  if (obj.app !== APP) return { ok: false, reason: 'wrongApp' };
  if (obj.version !== VERSION) return { ok: false, reason: 'badVersion' };
  const d = obj.data;
  if (!d || typeof d !== 'object') return { ok: false, reason: 'badShape' };
  if (d.lang !== 'en' && d.lang !== 'bn') return { ok: false, reason: 'badShape' };
  if (!Number.isInteger(d.budget) || d.budget < 5000 || d.budget > 500000) {
    return { ok: false, reason: 'badShape' };
  }
  if (!Array.isArray(d.flats)) return { ok: false, reason: 'badShape' };
  const ids = new Set();
  for (const f of d.flats) {
    if (!f || typeof f !== 'object') return { ok: false, reason: 'badShape' };
    if (typeof f.id !== 'string' || f.id === '' || ids.has(f.id)) {
      return { ok: false, reason: 'badShape' };
    }
    ids.add(f.id);
    const v = validateFlat(f);
    if (!v.ok) return { ok: false, reason: 'badShape' };
    if (!f.checklist || typeof f.checklist !== 'object') return { ok: false, reason: 'badShape' };
    for (const k of CHECKLIST_ITEMS) {
      if (typeof f.checklist[k] !== 'boolean') return { ok: false, reason: 'badShape' };
    }
    if (!Number.isInteger(f.createdAt)) return { ok: false, reason: 'badShape' };
  }
  return { ok: true, data: d };
}

var FHB_API = {
  APP, VERSION, STATUSES, CHECKLIST_ITEMS, FACILITIES, WEIGHTS,
  SIZE_FULL, DIST_FULL, newId, blankChecklist, blankFlat, emptyState,
  parseAmount, parseIntField, parseDecimalField, validateFlat, validateBudget,
  rentPoints, sizePoints, roomsPoints, facilitiesPoints, distancePoints,
  scoreFlat, rankFlats, moveInCost, checklistPct, checklistDone,
  toBnDigits, fmtInt, fmtMoney, fmtKm, exportPayload, validateImport,
};
if (typeof module !== 'undefined') module.exports = FHB_API;
if (typeof window !== 'undefined') window.FHB_LOGIC = FHB_API;
