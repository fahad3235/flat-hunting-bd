// flat-hunting-bd -- headless-Chrome smoke test via raw CDP (no puppeteer).
// Usage: node tests/smoke.js
// Exits non-zero on any failed assertion; fails on page console errors.
const { spawn } = require('child_process');
const http = require('http');
const path = require('path');

const PORT = 9361;
const BASE = 'file://' + path.resolve(__dirname, '..', 'index.html');
let failures = 0;
let count = 0;
const pageErrors = [];
function check(name, cond, extra) {
  count++;
  console.log((cond ? 'ok - ' : 'FAIL - ') + name + (cond ? '' : ' :: ' + (extra || '')));
  if (!cond) failures++;
}
const wait = (ms) => new Promise((r) => setTimeout(r, ms));

(async () => {
  const CHROME_BIN = process.env.CHROME_BIN ||
    require('os').homedir() + '/.cache/ms-playwright/chromium_headless_shell-1187/chrome-linux/headless_shell';
  const chrome = spawn(CHROME_BIN, [
    '--headless=new', '--no-sandbox', '--disable-gpu',
    '--remote-debugging-port=' + PORT, '--user-data-dir=/tmp/fhb-smoke-' + process.pid,
    'about:blank',
  ], { stdio: 'ignore' });
  let targets = [];
  for (let i = 0; i < 50 && targets.length === 0; i++) {
    await wait(200);
    try {
      targets = JSON.parse(await new Promise((res, rej) => {
        http.get('http://127.0.0.1:' + PORT + '/json/list', (r) => {
          let d = ''; r.on('data', (c) => (d += c)); r.on('end', () => res(d));
        }).on('error', rej);
      }));
    } catch (e) { /* retry */ }
  }
  if (!targets.length) { console.log('FAIL - chrome did not start'); process.exit(2); }
  const wsUrl = targets[0].webSocketDebuggerUrl;
  const ws = new WebSocket(wsUrl);
  await new Promise((res) => { ws.onopen = res; });
  let seq = 0; const pending = new Map();
  ws.onmessage = (m) => {
    const msg = JSON.parse(m.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') {
      pageErrors.push('exception: ' + JSON.stringify(msg.params.exceptionDetails).slice(0, 300));
    }
    if (msg.method === 'Runtime.consoleAPICalled' && msg.params.type === 'error') {
      pageErrors.push('console.error: ' + JSON.stringify(msg.params.args).slice(0, 300));
    }
  };
  function send(method, params) {
    return new Promise((res) => {
      const id = ++seq;
      pending.set(id, res);
      ws.send(JSON.stringify({ id, method, params: params || {} }));
    });
  }
  await send('Page.enable'); await send('Runtime.enable');
  await send('Emulation.setDeviceMetricsOverride', { width: 1440, height: 900, deviceScaleFactor: 1, mobile: false });
  const nav = async (url) => { await send('Page.navigate', { url }); await wait(1200); };
  const ev = async (expr) => {
    const r = await send('Runtime.evaluate', { expression: expr, returnByValue: true, awaitPromise: true });
    if (r.result && r.result.exceptionDetails) return { error: JSON.stringify(r.result.exceptionDetails).slice(0, 300) };
    return r.result ? r.result.result.value : undefined;
  };
  const clickTab = async (name) => ev(`document.querySelector('[data-tab="${name}"]').click()`);
  const setVal = async (id, v) => ev(
    `var el=document.getElementById('${id}'); el.value=${JSON.stringify(v)}; el.dispatchEvent(new Event('input',{bubbles:true}))`);
  const setCheck = async (id, on) => ev(
    `var el=document.getElementById('${id}'); el.checked=${on}; el.dispatchEvent(new Event('change',{bubbles:true}))`);
  const BN_TITLE = '\u09ab\u09cd\u09b2\u09cd\u09af\u09be\u099f \u0996\u09cb\u0981\u099c\u09be \u09ac\u09bf\u09a1\u09bf';

  // ---- Load: defaults ----
  await nav(BASE);
  check('page title mentions Flat Hunting', (await ev('document.title'))?.includes('Flat Hunting'));
  check('3 tabs present', (await ev(`document.querySelectorAll('[data-tab]').length`)) === 3);
  check('default budget is 20000', (await ev(`document.getElementById('budgetInput').value`)) === '20000');
  check('empty list message shown', (await ev(`document.getElementById('listEmpty').hidden`)) === false);
  check('0 flat cards', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 0);
  check('compare empty message shown', (await ev(`document.getElementById('compareEmpty').hidden`)) === false);
  check('5 how-it-works items', (await ev(`document.querySelectorAll('.how li').length`)) === 5);
  check('starts with 0 flats', (await ev(`window.__fhb.state.flats.length`)) === 0);

  // ---- Validation: empty area + bad rent ----
  await setVal('rentInput', '999');
  await ev(`document.getElementById('saveFlatBtn').click()`);
  check('empty area shows error', (await ev(`document.getElementById('areaError').hidden`)) === false);
  check('rent 999 shows error', (await ev(`document.getElementById('rentError').hidden`)) === false);
  check('no flat added on invalid save', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 0);

  // ---- Add flat A: Mirpur 10, 18000, 2/2, 1200 sqft, floor 3, adv 1, dep 20000, 2 km, gas+water+lift+parking ----
  // Expected score (budget 20000): rent 40 + size 20 + rooms 10 + facilities 12 + distance 8 = 90.
  // Expected move-in: 18000*(1+1)+20000 = 56000.
  await setVal('areaInput', 'Mirpur 10');
  await setVal('rentInput', '18000');
  await setVal('bedroomsInput', '2');
  await setVal('bathsInput', '2');
  await setVal('sizeInput', '1200');
  await setVal('floorInput', '3');
  await setVal('advanceInput', '1');
  await setVal('depositInput', '20000');
  await setVal('distanceInput', '2');
  await setCheck('facGas', true);
  await setCheck('facWater', true);
  await setCheck('facLift', true);
  await setCheck('facParking', true);
  await setVal('landlordInput', 'Rahim');
  await setVal('phoneInput', '01712345678');
  await ev(`document.getElementById('saveFlatBtn').click()`);
  check('flat A saved message', (await ev(`document.getElementById('formMsg').hidden`)) === false);
  check('1 flat card after save', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 1);
  check('card shows Mirpur 10', (await ev(`document.getElementById('flatList').textContent`)).includes('Mirpur 10'));
  check('card score 90/100', (await ev(`document.getElementById('flatList').textContent`)).includes('90/100'));
  check('card move-in 56,000', (await ev(`document.getElementById('flatList').textContent`)).includes('56,000'));

  // ---- Bad phone rejected on edit path: add flat B with bad phone first ----
  await setVal('areaInput', 'Uttara');
  await setVal('rentInput', '35000');
  await setVal('bedroomsInput', '1');
  await setVal('bathsInput', '1');
  await setVal('sizeInput', '800');
  await setVal('floorInput', '5');
  await setVal('advanceInput', '2');
  await setVal('depositInput', '0');
  await setVal('distanceInput', '9');
  await setCheck('facGas', false);
  await setCheck('facWater', false);
  await setCheck('facLift', false);
  await setCheck('facParking', false);
  await setVal('landlordInput', 'Karim');
  await setVal('phoneInput', 'abc');
  await ev(`document.getElementById('saveFlatBtn').click()`);
  check('bad phone shows error', (await ev(`document.getElementById('phoneError').hidden`)) === false);
  check('still 1 flat after bad phone', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 1);
  await setVal('phoneInput', '01812345678');
  await ev(`document.getElementById('saveFlatBtn').click()`);
  check('flat B saved after fixing phone', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 2);

  // ---- Search + filter ----
  await setVal('searchInput', 'Uttara');
  check('search Uttara shows 1 card', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 1);
  await setVal('searchInput', '');
  await ev(`var s=document.getElementById('filterSelect'); s.value='rejected'; s.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('filter rejected shows 0 cards', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 0);
  await ev(`var s=document.getElementById('filterSelect'); s.value='all'; s.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('filter all shows 2 cards', (await ev(`document.querySelectorAll('#flatList .flat-card').length`)) === 2);

  // ---- Compare: Mirpur ranks 1 (90), Uttara ranks 2 (29) ----
  await clickTab('compare');
  check('compare empty hidden', (await ev(`document.getElementById('compareEmpty').hidden`)) === true);
  check('compare has 2 rows', (await ev(`document.querySelectorAll('#compareBody tr').length`)) === 2);
  const cmp = await ev(`document.getElementById('compareBody').textContent`);
  check('rank 1 is Mirpur', cmp.indexOf('Mirpur 10') < cmp.indexOf('Uttara'));
  check('best badge present', cmp.includes('Best match'));
  check('compare shows 90 for Mirpur', cmp.includes('90'));
  check('compare shows move-in 56,000', cmp.includes('56,000'));

  // ---- Budget change: 15000 -> Mirpur rent points 32, total 82 ----
  await clickTab('flats');
  await clickTab('compare');
  await setVal('budgetInput', '15000');
  await ev(`document.getElementById('saveBudgetBtn').click()`);
  check('budget saved message', (await ev(`document.getElementById('budgetMsg').hidden`)) === false);
  const cmp2 = await ev(`document.getElementById('compareBody').textContent`);
  check('Mirpur score drops to 82 at budget 15000', cmp2.includes('82'), cmp2.slice(0, 200));
  // Budget validation: 100 rejected
  await setVal('budgetInput', '100');
  await ev(`document.getElementById('saveBudgetBtn').click()`);
  check('budget 100 shows error', (await ev(`document.getElementById('budgetError').hidden`)) === false);
  await setVal('budgetInput', '20000');
  await ev(`document.getElementById('saveBudgetBtn').click()`);
  check('budget back to 20000 clears error', (await ev(`document.getElementById('budgetError').hidden`)) === true);

  // ---- Detail + checklist: open Mirpur, tick 2 of 8 -> 25% ----
  await clickTab('flats');
  await ev(`document.querySelector('[data-view]').click()`);
  check('detail view opens', (await ev(`document.getElementById('flatDetail').hidden`)) === false);
  check('detail shows move-in 56,000', (await ev(`document.getElementById('detailBody').textContent`)).includes('56,000'));
  check('detail shows 8 checklist boxes', (await ev(`document.querySelectorAll('#checklistBox input[type=checkbox]').length`)) === 8);
  await ev(`var c=document.querySelector('[data-chk="daylight"]'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}))`);
  await ev(`var c=document.querySelector('[data-chk="water"]'); c.checked=true; c.dispatchEvent(new Event('change',{bubbles:true}))`);
  check('checklist 2/8 = 25%', (await ev(`document.getElementById('checklistPct').textContent`)).includes('25%'));
  await ev(`document.getElementById('backBtn').click()`);
  check('back to list hides detail', (await ev(`document.getElementById('flatDetail').hidden`)) === true);

  // ---- Edit: change Mirpur rent 18000 -> 16000, score stays 90 (still under budget) ----
  await ev(`document.querySelector('[data-edit]').click()`);
  check('edit mode shows cancel', (await ev(`document.getElementById('cancelEditBtn').hidden`)) === false);
  await setVal('rentInput', '16000');
  await ev(`document.getElementById('saveFlatBtn').click()`);
  check('edit saved message', (await ev(`document.getElementById('formMsg').textContent`)).includes('updated'));
  check('card now shows move-in 52,000', (await ev(`document.getElementById('flatList').textContent`)).includes('52,000'));

  // ---- Export / erase / import round-trip via test hooks ----
  const payload = await ev(`window.__fhb.exportPayload()`);
  check('export payload is flat-hunting-bd v1', payload.includes('"app":"flat-hunting-bd"') && payload.includes('"version":1'), payload.slice(0, 120));
  check('export carries Mirpur', payload.includes('Mirpur 10'));
  check('export carries checklist state', payload.includes('"daylight":true'));
  await ev(`window.__fhb.eraseAll()`);
  check('eraseAll empties flats', (await ev(`window.__fhb.exportPayload()`)).includes('"flats":[]'));
  const imp = await ev(`JSON.stringify(window.__fhb.importPayload(${JSON.stringify(payload)}))`);
  check('import valid payload ok', imp.includes('"ok":true'), imp);
  check('import restores Mirpur', (await ev(`window.__fhb.exportPayload()`)).includes('Mirpur 10'));
  const badImp = await ev(`JSON.stringify(window.__fhb.importPayload('{"app":"tip-calculator-bd","version":1,"data":{"lang":"en","budget":20000,"flats":[]}}'))`);
  check('import wrong app rejected', badImp.includes('"ok":false'));
  check('invalid import leaves data intact', (await ev(`window.__fhb.exportPayload()`)).includes('Mirpur 10'));

  // ---- Bad import via UI textarea; good import succeeds ----
  await clickTab('data');
  await ev(`document.getElementById('importText').value='{not json'; document.getElementById('importBtn').click()`);
  check('bad UI import shows error', (await ev(`document.getElementById('importFail').hidden`)) === false);
  await ev(`document.getElementById('importText').value=${JSON.stringify(payload)}; document.getElementById('importBtn').click()`);
  check('good UI import succeeds', (await ev(`document.getElementById('importOk').hidden`)) === false);

  // ---- Language toggle: Bengali title + digits, persists after reload ----
  await clickTab('flats');
  await ev(`document.getElementById('langBtn').click()`);
  check('BN toggle: title in Bengali', (await ev(`document.getElementById('title').textContent`)) === BN_TITLE);
  check('BN toggle: money in Bengali digits', (await ev(`document.getElementById('flatList').textContent`)).includes('\u09f3\u09eb\u09e8,\u09e6\u09e6\u09e6'));
  check('BN toggle: tab label in Bengali', (await ev(`document.querySelector('[data-tab="compare"]').textContent`)).includes('\u09a4\u09c1\u09b2\u09a8\u09be'));
  await nav(BASE);
  check('BN toggle persists after reload', (await ev(`window.__fhb.state.lang`)) === 'bn');
  await ev(`document.getElementById('langBtn').click()`);
  check('back to EN', (await ev(`window.__fhb.state.lang`)) === 'en');

  // ---- Typed-DELETE erase via UI; wrong word rejected ----
  await clickTab('data');
  await ev(`document.getElementById('eraseInput').value='delete'; document.getElementById('eraseBtn').click();`);
  check('wrong erase word rejected', (await ev(`document.getElementById('eraseWrong').hidden`)) === false);
  check('wrong erase keeps data', (await ev(`window.__fhb.exportPayload()`)).includes('Mirpur 10'));
  await ev(`document.getElementById('eraseInput').value='DELETE'; document.getElementById('eraseBtn').click();`);
  check('DELETE erases data', (await ev(`window.__fhb.exportPayload()`)).includes('"flats":[]'));
  check('erase success message shows', (await ev(`document.getElementById('erasedMsg').hidden`)) === false);

  // ---- Footer disclaimer ----
  check('footer mentions not a broker', (await ev(`document.getElementById('footerText').textContent`)).includes('not a broker'));

  // ---- Mobile 390px: no horizontal overflow on any tab ----
  await send('Emulation.setDeviceMetricsOverride', { width: 390, height: 844, deviceScaleFactor: 2, mobile: true });
  await nav(BASE);
  for (const tab of ['flats', 'compare', 'data']) {
    await clickTab(tab);
    await wait(300);
    const overflow = await ev(`document.documentElement.scrollWidth - document.documentElement.clientWidth`);
    check('390px no overflow on ' + tab + ' tab', overflow <= 0, 'overflow=' + overflow);
  }

  // ---- Zero network requests: app is fully offline (only file:// loads) ----
  const reqs = await ev(`performance.getEntriesByType('resource').map(r => r.name).filter(n => !n.startsWith('file://')).length`);
  check('zero non-file network requests', reqs === 0, 'non-file=' + reqs);

  check('no console/page errors', pageErrors.length === 0, pageErrors.slice(0, 3).join(' | '));

  chrome.kill();
  console.log('\n' + count + ' checks, ' + failures + ' failed');
  process.exit(failures ? 1 : 0);
})().catch((e) => { console.log('FAIL - harness error: ' + e.message); try { chrome.kill(); } catch (_) {} process.exit(2); });
