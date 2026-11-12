// flat-hunting-bd -- UI wiring. Depends on js/logic.js + js/i18n.js (loaded before).
// Pure ASCII: Bengali and punctuation live as \uXXXX escapes.
'use strict';
/* global I18N */
(function () {
  // In the browser, logic.js attaches its API to window.FHB_LOGIC.
  var X = window.FHB_LOGIC;

  var STORE_KEY = 'flat-hunting-bd-v1';
  var state = X.emptyState();
  var editingId = null;
  var detailId = null;
  var filterStatus = 'all';
  var searchText = '';

  function $(id) { return document.getElementById(id); }
  function t(key) { return I18N[state.lang][key] || key; }
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function save() {
    try { localStorage.setItem(STORE_KEY, JSON.stringify(state)); } catch (e) { /* storage full/blocked */ }
  }

  function load() {
    try {
      var raw = localStorage.getItem(STORE_KEY);
      if (!raw) return;
      var parsed = JSON.parse(raw);
      // Stored state has no envelope; wrap it so validateImport accepts it.
      var res = X.validateImport(JSON.stringify({ app: X.APP, version: X.VERSION, data: parsed }));
      if (res.ok) state = res.data;
    } catch (e) { /* corrupt storage: start empty */ }
  }

  // ---- tabs ----
  function showTab(name) {
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.classList.toggle('active', b.getAttribute('data-tab') === name);
    });
    document.querySelectorAll('.tabpage').forEach(function (p) {
      p.hidden = p.id !== 'tab-' + name;
    });
  }

  // ---- i18n apply ----
  function applyLang() {
    document.documentElement.lang = state.lang === 'bn' ? 'bn' : 'en';
    document.querySelectorAll('[data-i18n]').forEach(function (el) {
      el.textContent = t(el.getAttribute('data-i18n'));
    });
    document.querySelectorAll('[data-i18n-ph]').forEach(function (el) {
      el.placeholder = t(el.getAttribute('data-i18n-ph'));
    });
    $('langBtn').textContent = state.lang === 'bn' ? 'English' : '\u09ac\u09be\u0982\u09b2\u09be';
    renderAll();
  }

  // ---- form ----
  var FIELDS = [
    ['area', 'areaInput', 'areaError'],
    ['rent', 'rentInput', 'rentError'],
    ['bedrooms', 'bedroomsInput', 'bedroomsError'],
    ['baths', 'bathsInput', 'bathsError'],
    ['size', 'sizeInput', 'sizeError'],
    ['floor', 'floorInput', 'floorError'],
    ['advanceMonths', 'advanceInput', 'advanceError'],
    ['depositTk', 'depositInput', 'depositError'],
    ['distanceKm', 'distanceInput', 'distanceError'],
    ['landlord', 'landlordInput', 'landlordError'],
    ['phone', 'phoneInput', 'phoneError'],
    ['notes', 'notesInput', 'notesError'],
  ];

  function readForm() {
    var f = editingId ? findFlat(editingId) : X.blankFlat();
    if (!f) f = X.blankFlat();
    f.area = $('areaInput').value.trim();
    f.rent = $('rentInput').value;
    f.bedrooms = $('bedroomsInput').value;
    f.baths = $('bathsInput').value;
    f.size = $('sizeInput').value;
    f.floor = $('floorInput').value;
    f.advanceMonths = $('advanceInput').value;
    f.depositTk = $('depositInput').value;
    f.distanceKm = $('distanceInput').value;
    f.gas = $('facGas').checked;
    f.water = $('facWater').checked;
    f.lift = $('facLift').checked;
    f.generator = $('facGenerator').checked;
    f.parking = $('facParking').checked;
    f.landlord = $('landlordInput').value.trim();
    f.phone = $('phoneInput').value.trim();
    f.notes = $('notesInput').value.trim();
    f.status = $('statusSelect').value;
    return f;
  }

  function fillForm(f) {
    $('areaInput').value = f.area;
    $('rentInput').value = f.rent;
    $('bedroomsInput').value = f.bedrooms;
    $('bathsInput').value = f.baths;
    $('sizeInput').value = f.size;
    $('floorInput').value = f.floor;
    $('advanceInput').value = f.advanceMonths;
    $('depositInput').value = f.depositTk;
    $('distanceInput').value = f.distanceKm;
    $('facGas').checked = !!f.gas;
    $('facWater').checked = !!f.water;
    $('facLift').checked = !!f.lift;
    $('facGenerator').checked = !!f.generator;
    $('facParking').checked = !!f.parking;
    $('landlordInput').value = f.landlord || '';
    $('phoneInput').value = f.phone || '';
    $('notesInput').value = f.notes || '';
    $('statusSelect').value = f.status;
  }

  function clearForm() {
    var f = X.blankFlat();
    fillForm(f);
    editingId = null;
    $('formTitle').textContent = t('addTitle');
    $('cancelEditBtn').hidden = true;
    FIELDS.forEach(function (fd) { $(fd[2]).hidden = true; });
    $('formMsg').hidden = true;
  }

  function showErrors(errors) {
    var map = {
      area: 'areaError', rent: 'rentError', bedrooms: 'bedroomsError',
      baths: 'bathsError', size: 'sizeError', floor: 'floorError',
      advanceMonths: 'advanceError', depositTk: 'depositError',
      distanceKm: 'distanceError', landlord: 'landlordError',
      phone: 'phoneError', notes: 'notesError', status: 'areaError',
    };
    Object.keys(map).forEach(function (k) { $(map[k]).hidden = true; });
    Object.keys(errors).forEach(function (k) {
      var el = $(map[k]);
      if (!el) return;
      var reason = errors[k];
      el.textContent = reason === 'required' ? t('err_required')
        : reason === 'min' ? t('err_min')
        : reason === 'tooBig' ? t('err_tooBig') : t('err_invalid');
      el.hidden = false;
    });
  }

  function findFlat(id) {
    for (var i = 0; i < state.flats.length; i++) {
      if (state.flats[i].id === id) return state.flats[i];
    }
    return null;
  }

  // ---- list ----
  function visibleFlats() {
    return state.flats.filter(function (f) {
      if (filterStatus !== 'all' && f.status !== filterStatus) return false;
      if (searchText) {
        var hay = (f.area + ' ' + (f.landlord || '')).toLowerCase();
        if (hay.indexOf(searchText.toLowerCase()) === -1) return false;
      }
      return true;
    });
  }

  function statusBadge(f) {
    return '<span class="badge st-' + f.status + '">' + esc(t('status_' + f.status)) + '</span>';
  }

  function renderList() {
    var list = visibleFlats();
    $('listEmpty').hidden = list.length !== 0;
    var ul = $('flatList');
    ul.innerHTML = '';
    list.forEach(function (f) {
      var sc = X.scoreFlat(f, state.budget);
      var li = document.createElement('li');
      li.className = 'flat-card';
      li.innerHTML =
        '<div class="flat-head"><strong>' + esc(f.area) + '</strong>' + statusBadge(f) + '</div>' +
        '<div class="flat-meta">' + esc(t('rentShort')) + ': ' + X.fmtMoney(f.rent, state.lang) +
        ' \u00b7 ' + esc(t('bedShort')) + ' ' + X.fmtInt(f.bedrooms, state.lang) +
        ' \u00b7 ' + esc(t('bathShort')) + ' ' + X.fmtInt(f.baths, state.lang) +
        ' \u00b7 ' + X.fmtInt(f.size, state.lang) + ' sq ft' +
        ' \u00b7 ' + esc(t('distShort')) + ' ' + X.fmtKm(f.distanceKm, state.lang) + '</div>' +
        '<div class="flat-foot"><span>' + esc(t('scoreLabel')) + ': <strong>' +
        X.fmtInt(Math.round(sc.total), state.lang) + '/100</strong></span>' +
        '<span>' + esc(t('moveInLabel')) + ': ' + X.fmtMoney(X.moveInCost(f), state.lang) + '</span>' +
        '<span>' + X.fmtInt(X.checklistDone(f), state.lang) + '/8 ' + esc(t('checklistDone')) + '</span></div>' +
        '<div class="flat-actions"><button type="button" class="btn small" data-view="' + f.id + '">' +
        esc(t('detailTitle')) + '</button>' +
        '<button type="button" class="btn small" data-edit="' + f.id + '">' + esc(t('editBtn')) + '</button>' +
        '<button type="button" class="btn small danger" data-del="' + f.id + '">' + esc(t('deleteBtn')) + '</button></div>';
      ul.appendChild(li);
    });
    ul.querySelectorAll('[data-view]').forEach(function (b) {
      b.addEventListener('click', function () { openDetail(b.getAttribute('data-view')); });
    });
    ul.querySelectorAll('[data-edit]').forEach(function (b) {
      b.addEventListener('click', function () { startEdit(b.getAttribute('data-edit')); });
    });
    ul.querySelectorAll('[data-del]').forEach(function (b) {
      b.addEventListener('click', function () {
        if (window.confirm(t('confirmDelete'))) {
          state.flats = state.flats.filter(function (f) { return f.id !== b.getAttribute('data-del'); });
          if (detailId === b.getAttribute('data-del')) detailId = null;
          save(); renderAll();
          $('formMsg').textContent = t('flatDeleted'); $('formMsg').hidden = false;
        }
      });
    });
  }

  function startEdit(id) {
    var f = findFlat(id);
    if (!f) return;
    editingId = id;
    fillForm(f);
    $('formTitle').textContent = t('editTitle');
    $('cancelEditBtn').hidden = false;
    $('formMsg').hidden = true;
    window.scrollTo(0, 0);
  }

  // ---- detail ----
  function openDetail(id) {
    detailId = id;
    renderDetail();
    $('flatDetail').hidden = false;
    $('flatListWrap').hidden = true;
    window.scrollTo(0, 0);
  }

  function closeDetail() {
    detailId = null;
    $('flatDetail').hidden = true;
    $('flatListWrap').hidden = false;
  }

  function renderDetail() {
    var f = findFlat(detailId);
    if (!f) { closeDetail(); return; }
    var sc = X.scoreFlat(f, state.budget);
    var facs = [];
    X.FACILITIES.forEach(function (k) { if (f[k]) facs.push(t('fac_' + k)); });
    $('detailBody').innerHTML =
      '<h3>' + esc(f.area) + ' ' + statusBadge(f) + '</h3>' +
      '<dl class="detail-grid">' +
      '<dt>' + esc(t('rentLabel')) + '</dt><dd>' + X.fmtMoney(f.rent, state.lang) + '</dd>' +
      '<dt>' + esc(t('bedroomsLabel')) + '</dt><dd>' + X.fmtInt(f.bedrooms, state.lang) + '</dd>' +
      '<dt>' + esc(t('bathsLabel')) + '</dt><dd>' + X.fmtInt(f.baths, state.lang) + '</dd>' +
      '<dt>' + esc(t('sizeLabel')) + '</dt><dd>' + X.fmtInt(f.size, state.lang) + ' sq ft</dd>' +
      '<dt>' + esc(t('floorLabel')) + '</dt><dd>' + X.fmtInt(f.floor, state.lang) + '</dd>' +
      '<dt>' + esc(t('advanceLabel')) + '</dt><dd>' + X.fmtInt(f.advanceMonths, state.lang) + '</dd>' +
      '<dt>' + esc(t('depositLabel')) + '</dt><dd>' + X.fmtMoney(f.depositTk, state.lang) + '</dd>' +
      '<dt>' + esc(t('moveInLabel')) + '</dt><dd><strong>' + X.fmtMoney(X.moveInCost(f), state.lang) + '</strong></dd>' +
      '<dt>' + esc(t('distanceLabel')) + '</dt><dd>' + X.fmtKm(f.distanceKm, state.lang) + '</dd>' +
      '<dt>' + esc(t('scoreLabel')) + '</dt><dd><strong>' + X.fmtInt(Math.round(sc.total), state.lang) +
      '/100</strong></dd>' +
      '<dt>' + esc(t('facilitiesLabel')) + '</dt><dd>' + (facs.length ? esc(facs.join(', ')) : '\u2014') + '</dd>' +
      '<dt>' + esc(t('landlordLabel')) + '</dt><dd>' + esc(f.landlord || '\u2014') + '</dd>' +
      '<dt>' + esc(t('phoneLabel')) + '</dt><dd>' + esc(f.phone || '\u2014') + '</dd>' +
      '<dt>' + esc(t('notesLabel')) + '</dt><dd>' + esc(f.notes || '\u2014') + '</dd>' +
      '</dl>';
    var box = $('checklistBox');
    box.innerHTML = '';
    X.CHECKLIST_ITEMS.forEach(function (k) {
      var lab = document.createElement('label');
      lab.className = 'chk';
      var cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = !!(f.checklist && f.checklist[k]);
      cb.setAttribute('data-chk', k);
      cb.addEventListener('change', function () {
        f.checklist[k] = cb.checked;
        save(); renderDetail(); renderList();
      });
      lab.appendChild(cb);
      lab.appendChild(document.createTextNode(' ' + t('chk_' + k)));
      box.appendChild(lab);
    });
    $('checklistPct').textContent = X.fmtInt(X.checklistPct(f), state.lang) + '% (' +
      X.fmtInt(X.checklistDone(f), state.lang) + '/8)';
  }

  // ---- compare ----
  function renderCompare() {
    $('budgetInput').value = state.budget;
    $('compareEmpty').hidden = state.flats.length !== 0;
    var tb = $('compareBody');
    tb.innerHTML = '';
    if (!state.flats.length) return;
    var ranked = X.rankFlats(state.flats, state.budget);
    ranked.forEach(function (row, i) {
      var f = row.flat;
      var tr = document.createElement('tr');
      var badge = i === 0 ? ' <span class="badge best">' + esc(t('bestBadge')) + '</span>' : '';
      tr.innerHTML =
        '<td>' + X.fmtInt(i + 1, state.lang) + '</td>' +
        '<td><strong>' + esc(f.area) + '</strong>' + badge + '<br><span class="muted">' +
        esc(t('rentShort')) + ' ' + X.fmtMoney(f.rent, state.lang) + ' \u00b7 ' +
        X.fmtInt(f.size, state.lang) + ' sq ft \u00b7 ' + esc(t('bedShort')) + ' ' +
        X.fmtInt(f.bedrooms, state.lang) + '</span></td>' +
        '<td><strong>' + X.fmtInt(Math.round(row.score.total), state.lang) + '</strong>/100<br>' +
        '<span class="muted">' + esc(t('how_rent')).split('\u2014')[0].trim() + ' ' +
        X.fmtInt(Math.round(row.score.parts.rent), state.lang) + ' \u00b7 ' +
        esc(t('how_size')).split('\u2014')[0].trim() + ' ' +
        X.fmtInt(Math.round(row.score.parts.size), state.lang) + ' \u00b7 ' +
        esc(t('how_rooms')).split('\u2014')[0].trim() + ' ' +
        X.fmtInt(Math.round(row.score.parts.rooms), state.lang) + ' \u00b7 ' +
        esc(t('how_fac')).split('\u2014')[0].trim() + ' ' +
        X.fmtInt(Math.round(row.score.parts.facilities), state.lang) + ' \u00b7 ' +
        esc(t('how_dist')).split('\u2014')[0].trim() + ' ' +
        X.fmtInt(Math.round(row.score.parts.distance), state.lang) + '</span></td>' +
        '<td>' + X.fmtMoney(X.moveInCost(f), state.lang) + '</td>';
      tb.appendChild(tr);
    });
  }

  // ---- data tab ----
  function refreshExport() {
    $('exportText').value = X.exportPayload(state);
  }

  function renderAll() {
    renderList();
    if (detailId) renderDetail();
    renderCompare();
    refreshExport();
  }

  // ---- wire up ----
  function init() {
    load();
    document.querySelectorAll('[data-tab]').forEach(function (b) {
      b.addEventListener('click', function () { showTab(b.getAttribute('data-tab')); });
    });
    $('langBtn').addEventListener('click', function () {
      state.lang = state.lang === 'en' ? 'bn' : 'en';
      save(); applyLang();
    });
    $('saveFlatBtn').addEventListener('click', function () {
      var f = readForm();
      var v = X.validateFlat(f);
      if (!v.ok) { showErrors(v.errors); return; }
      // coerce numeric strings to numbers before storing
      f.rent = Number(f.rent); f.bedrooms = Number(f.bedrooms); f.baths = Number(f.baths);
      f.size = Number(f.size); f.floor = Number(f.floor);
      f.advanceMonths = Number(f.advanceMonths); f.depositTk = Number(f.depositTk);
      f.distanceKm = Number(f.distanceKm);
      var isNew = !editingId;
      if (isNew) state.flats.push(f);
      else {
        var idx = state.flats.findIndex(function (x) { return x.id === editingId; });
        if (idx !== -1) state.flats[idx] = f;
      }
      save(); clearForm();
      $('formMsg').textContent = t(isNew ? 'flatSaved' : 'flatUpdated');
      $('formMsg').hidden = false;
      renderAll();
    });
    $('cancelEditBtn').addEventListener('click', clearForm);
    $('filterSelect').addEventListener('change', function () {
      filterStatus = $('filterSelect').value; renderList();
    });
    $('searchInput').addEventListener('input', function () {
      searchText = $('searchInput').value; renderList();
    });
    $('backBtn').addEventListener('click', closeDetail);
    $('detailEditBtn').addEventListener('click', function () {
      var id = detailId; closeDetail(); startEdit(id);
    });
    $('detailDeleteBtn').addEventListener('click', function () {
      if (window.confirm(t('confirmDelete'))) {
        state.flats = state.flats.filter(function (f) { return f.id !== detailId; });
        closeDetail(); save(); renderAll();
      }
    });
    $('saveBudgetBtn').addEventListener('click', function () {
      var v = X.validateBudget($('budgetInput').value);
      if (!v.ok) {
        $('budgetError').textContent = t('err_budget');
        $('budgetError').hidden = false;
        return;
      }
      $('budgetError').hidden = true;
      state.budget = v.value;
      save(); renderAll();
      $('budgetMsg').textContent = t('budgetSaved'); $('budgetMsg').hidden = false;
    });
    $('copyBtn').addEventListener('click', function () {
      refreshExport();
      var done = function () { $('copiedMsg').hidden = false; };
      if (navigator.clipboard && navigator.clipboard.writeText) {
        navigator.clipboard.writeText($('exportText').value).then(done, done);
      } else { $('exportText').select(); done(); }
    });
    $('downloadBtn').addEventListener('click', function () {
      refreshExport();
      var blob = new Blob([$('exportText').value], { type: 'application/json' });
      var a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'flat-hunting-bd.json';
      a.click();
    });
    $('importBtn').addEventListener('click', function () {
      var res = X.validateImport($('importText').value);
      if (!res.ok) {
        $('importFail').hidden = false; $('importOk').hidden = true; return;
      }
      state = res.data; editingId = null; detailId = null;
      save(); clearForm(); applyLang();
      $('importOk').hidden = false; $('importFail').hidden = true;
      closeDetail();
    });
    $('eraseBtn').addEventListener('click', function () {
      if ($('eraseInput').value !== 'DELETE') {
        $('eraseWrong').hidden = false; $('erasedMsg').hidden = true; return;
      }
      $('eraseWrong').hidden = true;
      var lang = state.lang;
      state = X.emptyState(); state.lang = lang;
      editingId = null; detailId = null;
      save(); clearForm(); applyLang(); closeDetail();
      $('erasedMsg').hidden = false;
    });
    // test hooks
    window.__fhb = {
      get state() { return state; },
      exportPayload: function () { return X.exportPayload(state); },
      importPayload: function (text) {
        var res = X.validateImport(text);
        if (!res.ok) return { ok: false, reason: res.reason };
        state = res.data; save(); renderAll(); return { ok: true };
      },
      eraseAll: function () {
        var lang = state.lang;
        state = X.emptyState(); state.lang = lang;
        save(); renderAll();
      },
      scoreFlat: X.scoreFlat,
      moveInCost: X.moveInCost,
    };
    applyLang();
    showTab('flats');
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
