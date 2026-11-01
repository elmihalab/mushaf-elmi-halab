/* مصحف الشهباء — شعبة الشؤون العلمية في حلب
   كل نصوص القرآن ورسمها تُقرأ من ملفات data/ و fonts/ المأخوذة كما هي من مجمع الملك فهد عبر QUL. */
'use strict';
const VERSION = '0.2.0';
const RATIO = 1.5526;                       // page height / width
const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const AR = n => String(n).replace(/\d/g, d => '٠١٢٣٤٥٦٧٨٩'[d]);
const EN = s => String(s).replace(/[٠-٩]/g, d => '٠١٢٣٤٥٦٧٨٩'.indexOf(d)).replace(/[۰-۹]/g, d => '۰۱۲۳۴۵۶۷۸۹'.indexOf(d));
const store = {
  get(k, d) { try { const v = localStorage.getItem('shahba.' + k); return v == null ? d : JSON.parse(v); } catch (e) { return d; } },
  set(k, v) { try { localStorage.setItem('shahba.' + k, JSON.stringify(v)); } catch (e) {} }
};
let toastT;
function toast(msg, ms = 2200) { const t = $('#toast'); t.textContent = msg; t.classList.add('on'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('on'), ms); }

/* ---------- data ---------- */
const D = {};
const getJSON = u => fetch(u).then(r => { if (!r.ok) throw new Error(u); return r.json(); });
let wordsP = null;
const getWords = () => (wordsP ||= getJSON('data/words.json').then(w => (D.words = w)));

async function loadData() {
  [D.pages, D.surahs, D.packs, D.glyphs, D.ayat] = await Promise.all(
    ['pages', 'surahs', 'packs', 'glyphs', 'ayat'].map(n => getJSON(`data/${n}.json`)));
  D.N = D.glyphs.length; D.A = D.ayat.length / 4;
  D.wPage = new Uint16Array(D.N + 1);
  D.pages.forEach((L, i) => L.forEach(l => { if (l[0] === 0) for (let w = l[2]; w <= l[3]; w++) D.wPage[w] = i + 1; }));
  D.wAyah = new Uint16Array(D.N + 1); D.sFirst = [];
  for (let k = 0; k < D.A; k++) {
    const s = D.ayat[k * 4], a = D.ayat[k * 4 + 1];
    if (a === 1) D.sFirst[s] = k;
    for (let w = D.ayat[k * 4 + 2]; w <= D.ayat[k * 4 + 3]; w++) D.wAyah[w] = k;
  }
}
const ay = k => ({ k, s: D.ayat[k * 4], a: D.ayat[k * 4 + 1], f: D.ayat[k * 4 + 2], l: D.ayat[k * 4 + 3] });
const sName = s => D.surahs[s - 1].name;
const firstWord = p => { for (const l of D.pages[p - 1]) if (l[0] === 0) return l[2]; return 1; };
const surahOfPage = p => D.ayat[D.wAyah[firstWord(p)] * 4];
const findAyah = (s, a) => (s >= 1 && s <= 114 && a >= 1 && a <= D.surahs[s - 1].ayat) ? D.sFirst[s] + a - 1 : -1;

/* ---------- page fonts: 10 fonts per pack, each font's bytes untouched ---------- */
const fam = p => 'qcf' + p;
const packs = new Map(), fonts = new Map();
function getPack(k) {
  if (!packs.has(k)) {
    const pr = fetch('fonts/pages/' + D.packs.packs[k].file).then(r => { if (!r.ok) throw new Error('pack'); return r.arrayBuffer(); });
    packs.set(k, pr); pr.catch(() => packs.delete(k));
    if (packs.size > 4) packs.delete(packs.keys().next().value);
  }
  return packs.get(k);
}
function loadFont(p) {
  let pr = fonts.get(p);
  if (!pr) {
    pr = (async () => {
      const k = Math.floor((p - 1) / D.packs.per), e = D.packs.packs[k].pages[(p - 1) % D.packs.per];
      const buf = await getPack(k);
      const ff = new FontFace(fam(p), buf.slice(e[1], e[1] + e[2]));
      await ff.load(); document.fonts.add(ff);
    })();
    fonts.set(p, pr); pr.catch(() => fonts.delete(p));
  }
  return pr;
}

/* ---------- state ---------- */
const S = Object.assign({ mode: 'page', page: 1, rs: 0, read: 1 }, store.get('state', {}));
let saveT;
function save() {
  clearTimeout(saveT);
  saveT = setTimeout(() => { store.set('state', S); history.replaceState(history.state, '', '#p=' + S.page); }, 300);
}
function setPage(p) {
  if (p !== S.page || !$('#stripPage').textContent) {
    S.page = p; save();
    $('#stripSurah').textContent = 'سورة ' + sName(surahOfPage(p));
    $('#stripPage').innerHTML = `<i class="side ${p % 2 ? 'r' : 'l'}"></i>صفحة ${AR(p)} · ${p % 2 ? 'اليمنى' : 'اليسرى'}`;
  }
  $('#btnMarkPage').classList.toggle('on', marks().some(m => m.p === S.page && m.k == null));
}

/* ---------- one mushaf page ---------- */
function wordSpans(a, b) { let h = ''; for (let i = a; i <= b; i++) h += `<span class="w" data-i="${i}">${D.glyphs[i - 1]}</span>`; return h; }
function sheetHTML(p) {
  let h = `<div class="shead"><span>سورة ${sName(surahOfPage(p))}</span><span>${AR(p)}</span></div><div class="frame"><div class="lines" style="font-family:${fam(p)}">`;
  for (const [t, c, a, b, s] of D.pages[p - 1]) {
    if (t === 1) h += `<div class="ln hd"><span class="hdr" role="img" aria-label="سورة ${sName(s)}">${D.surahs[s - 1].hdr}</span></div>`;
    else if (t === 2) h += `<div class="ln c" style="font-family:${fam(1)}">${D.glyphs.slice(0, 4).map(g => `<span>${g}</span>`).join('')}</div>`;
    else h += `<div class="ln${c ? ' c' : ''}">${wordSpans(a, b)}</div>`;
  }
  return h + '</div></div>';
}
function mountSheet(slot, p, w) {
  if (slot._p === p && slot._w === w) return;
  slot._p = p; slot._w = w;
  const sh = document.createElement('div');
  sh.className = 'sheet ' + (p % 2 ? 'side-r' : 'side-l') + (p <= 2 ? ' short' : ''); sh.style.setProperty('--w', w + 'px'); sh.dataset.p = p;
  sh.innerHTML = sheetHTML(p);
  slot.replaceChildren(sh);
  const need = [loadFont(p)]; if (D.pages[p - 1].some(l => l[0] === 2)) need.push(loadFont(1));
  Promise.all(need).then(() => requestAnimationFrame(() => { fitSheet(sh); sh.classList.add('ready'); markSelection(sh); }))
    .catch(() => { sh.classList.add('err'); slot._p = 0; });
}
function unmount(slot) { if (slot._p) { slot.replaceChildren(); slot._p = 0; } }
function fitSheet(sh) {               // shrink the whole page a little if any full line would overflow
  let r = 1;
  for (const ln of $$('.ln:not(.c):not(.hd)', sh)) {
    let sum = 0; for (const c of ln.children) sum += c.getBoundingClientRect().width;
    if (sum > ln.clientWidth) r = Math.min(r, ln.clientWidth / sum);
  }
  if (r < 1) sh.style.setProperty('--k', (r * 0.985).toFixed(4));
}

/* ---------- page (flip) mode: one page on phones, right+left spread on wide screens ---------- */
const PM = { el: $('#vPage'), slots: [], holders: [], per: 0, idx: -1, built: false, neg: true };
function pmBuild() {
  PM.built = true;
  let raf = 0;
  PM.el.addEventListener('scroll', () => { if (!raf) raf = requestAnimationFrame(() => { raf = 0; pmSync(); }); }, { passive: true });
  let wheelT = 0;
  PM.el.addEventListener('wheel', e => {
    if (Math.abs(e.deltaY) < Math.abs(e.deltaX) || e.ctrlKey) return;
    e.preventDefault(); const now = Date.now(); if (now - wheelT < 350) return; wheelT = now;
    pmStep(e.deltaY > 0 ? 1 : -1);
  }, { passive: false });
}
function pmLayout() {                  // (re)build the slots when switching between single page and spread
  const per = PM.el.clientWidth >= 700 && PM.el.clientWidth > PM.el.clientHeight * 1.15 ? 2 : 1;
  if (per === PM.per) return;
  PM.per = per; PM.idx = -1; PM.slots = []; PM.holders = [];
  const f = document.createDocumentFragment();
  for (let i = 0; i * per < 604; i++) {
    const d = document.createElement('div'); d.className = 'slot' + (per === 2 ? ' spread' : '');
    for (let j = 0; j < per; j++) {
      const p = i * per + j + 1; if (p > 604) break;
      const h = document.createElement('div'); h.className = 'half'; h.dataset.p = p; d.append(h); PM.holders[p] = h;
    }
    PM.slots.push(d); f.append(d);
  }
  PM.el.replaceChildren(f);
  // RTL scroll convention (modern browsers count leftwards as negative); snapping is paused while testing
  PM.el.style.scrollSnapType = 'none'; PM.el.scrollLeft = -50; PM.neg = PM.el.scrollLeft < 0;
  if (!PM.neg) { PM.el.scrollLeft = 50; PM.neg = PM.el.scrollLeft <= 0; }
  PM.el.scrollLeft = 0; PM.el.style.scrollSnapType = '';
}
const pmW = () => Math.floor(Math.min((PM.el.clientWidth - (PM.per === 2 ? 24 : 16)) / PM.per, (PM.el.clientHeight - 16) / RATIO, 900));
function pmRender(i) {
  const w = pmW();
  for (let p = 1; p <= 604; p++) {
    const d = Math.abs(Math.floor((p - 1) / PM.per) - i), h = PM.holders[p];
    if (d <= 2 / PM.per + 0.5) mountSheet(h, p, w); else if (d > 4 / PM.per) unmount(h);
  }
}
function pmShow(i, p) {
  if (i !== PM.idx) { PM.idx = i; pmRender(i); }
  setPage(p);
}
function pmSync() {
  const i = Math.min(PM.slots.length - 1, Math.max(0, Math.round(Math.abs(PM.el.scrollLeft) / PM.el.clientWidth)));
  if (i !== PM.idx) pmShow(i, i * PM.per + 1);
}
function pmGo(p, smooth) {
  p = Math.min(604, Math.max(1, p));
  const i = Math.floor((p - 1) / PM.per), x = i * PM.el.clientWidth;
  PM.el.scrollTo({ left: PM.neg ? -x : x, behavior: smooth ? 'smooth' : 'instant' });
  if (!smooth) { PM.idx = -1; pmShow(i, p); }
}
const pmStep = n => pmGo((PM.idx + n) * PM.per + 1, true);

/* ---------- continuous scroll mode ---------- */
const SM = { el: $('#vScroll'), slots: [], built: false, w: 0, h: 0, io: null };
const GAP = 14, PAD = 10;
function smBuild() {
  const f = document.createDocumentFragment();
  for (let p = 1; p <= 604; p++) { const d = document.createElement('div'); d.className = 'slot'; d.dataset.p = p; SM.slots.push(d); f.append(d); }
  SM.el.append(f); SM.built = true;
  SM.io = new IntersectionObserver(es => {
    for (const e of es) { const sl = e.target; if (e.isIntersecting) mountSheet(sl, +sl.dataset.p, SM.w); else unmount(sl); }
  }, { root: SM.el, rootMargin: '150% 0px' });
  SM.slots.forEach(s => SM.io.observe(s));
  let raf = 0;
  SM.el.addEventListener('scroll', () => {
    if (!raf) raf = requestAnimationFrame(() => {
      raf = 0; const p = Math.floor((SM.el.scrollTop + SM.el.clientHeight * 0.4 - PAD) / (SM.h + GAP)) + 1;
      setPage(Math.min(604, Math.max(1, p)));
    });
  }, { passive: true });
}
function smSize() {
  SM.w = Math.floor(Math.min(SM.el.clientWidth - 16, 820)); SM.h = Math.round(SM.w * RATIO);
  for (const s of SM.slots) { s.style.width = SM.w + 'px'; s.style.height = SM.h + 'px'; if (s._p) { s._w = 0; mountSheet(s, +s.dataset.p, SM.w); } }
}
function smGo(p) { SM.el.scrollTop = PAD + (p - 1) * (SM.h + GAP); setPage(p); }

/* ---------- free reading mode ---------- */
const RM = { el: $('#rBody'), io: null, s: 0 };
const defRS = () => Math.round(Math.min(36, Math.max(24, innerWidth * 0.072)));
function rmApply() {
  RM.el.style.setProperty('--rs', S.rs + 'px');
  $('#zVal').textContent = AR(Math.round(S.rs / defRS() * 100)) + '٪';
}
function rmRender(s, k) {
  RM.s = s; S.read = s; save();
  $('#rTitle').textContent = 'سورة ' + sName(s);
  const sur = D.surahs[s - 1];
  let h = `<div class="rsurah"><div class="hd"><span class="hdr" role="img" aria-label="سورة ${sur.name}">${sur.hdr}</span></div>`;
  if (s !== 1 && s !== 9) h += `<div class="rbsm chunk" data-p="1" style="font-family:${fam(1)}">${D.glyphs.slice(0, 4).map(g => `<span class="w0">${g}</span>`).join(' ')}</div>`;
  h += '<div class="rtext">';
  const k0 = D.sFirst[s], k1 = k0 + sur.ayat - 1;
  let cp = 0, open = false;
  for (let i = D.ayat[k0 * 4 + 2]; i <= D.ayat[k1 * 4 + 3]; i++) {
    const p = D.wPage[i];
    if (p !== cp) { if (open) h += '</span> '; h += `<span class="chunk" data-p="${p}" style="font-family:${fam(p)}">`; cp = p; open = true; }
    h += `<span class="w" data-i="${i}">${D.glyphs[i - 1]}</span> `;
  }
  h += '</span></div>';
  h += `<div class="rmore">${s < 114 ? `<button class="btn" style="padding:10px 18px" data-next="${s + 1}">سورة ${sName(s + 1)}</button>` : ''}</div></div>`;
  RM.el.innerHTML = h;
  RM.io?.disconnect();
  RM.io = new IntersectionObserver(es => {
    for (const e of es) if (e.isIntersecting) { const c = e.target; RM.io.unobserve(c); loadFont(+c.dataset.p).then(() => c.classList.add('ready')).catch(() => RM.io.observe(c)); }
  }, { root: RM.el, rootMargin: '120% 0px' });
  $$('.chunk', RM.el).forEach(c => RM.io.observe(c));
  if (k != null && k !== k0) {
    const a = ay(k), w = RM.el.querySelector(`.w[data-i="${a.f}"]`);
    loadFont(D.wPage[a.f]).finally(() => requestAnimationFrame(() => { RM.el.scrollTop = w.offsetTop - 60; flashAyah(k); }));
  } else RM.el.scrollTop = 0;
  setPage(D.wPage[D.ayat[k0 * 4 + 2]]);
}
function rmTopWord() {
  const r = RM.el.getBoundingClientRect();
  for (let y = r.top + 24; y < r.top + 200; y += 20) {
    const el = document.elementFromPoint(r.left + r.width / 2, y)?.closest?.('.w');
    if (el) return el;
  }
  return null;
}
function rmZoom(f) {
  const a = rmTopWord(), before = a?.getBoundingClientRect().top;
  S.rs = Math.round(Math.min(90, Math.max(16, S.rs * f))); rmApply(); save();
  if (a) RM.el.scrollTop += a.getBoundingClientRect().top - before;
}
(function pinch() {
  let d0 = 0, rs0 = 0, raf = 0;
  const dist = t => Math.hypot(t[0].clientX - t[1].clientX, t[0].clientY - t[1].clientY);
  RM.el.addEventListener('touchstart', e => { if (e.touches.length === 2) { d0 = dist(e.touches); rs0 = S.rs; } }, { passive: true });
  RM.el.addEventListener('touchmove', e => {
    if (e.touches.length !== 2 || !d0) return; e.preventDefault();
    const f = dist(e.touches) / d0;
    if (!raf) raf = requestAnimationFrame(() => { raf = 0; rmZoom((rs0 * f) / S.rs); });
  }, { passive: false });
  RM.el.addEventListener('touchend', () => { if (d0) { d0 = 0; } });
  RM.el.addEventListener('wheel', e => { if (e.ctrlKey) { e.preventDefault(); rmZoom(e.deltaY < 0 ? 1.08 : 1 / 1.08); } }, { passive: false });
  let raf2 = 0;
  RM.el.addEventListener('scroll', () => { if (!raf2) raf2 = requestAnimationFrame(() => { raf2 = 0; const w = rmTopWord(); if (w) setPage(D.wPage[+w.dataset.i]); }); }, { passive: true });
})();

/* ---------- modes & navigation ---------- */
const views = { page: $('#vPage'), scroll: $('#vScroll'), read: $('#vRead') };
function setMode(m, opt = {}) {
  const from = S.mode; S.mode = m; save();
  for (const [k, v] of Object.entries(views)) v.hidden = k !== m;
  $$('#modes [data-mode]').forEach(b => b.classList.toggle('on', b.dataset.mode === m));
  const p = opt.page || S.page;
  if (m === 'page') { if (!PM.built) pmBuild(); pmLayout(); for (const h of PM.holders) if (h) h._w = 0; pmGo(p); }
  else if (m === 'scroll') { if (!SM.built) smBuild(); smSize(); smGo(p); }
  else {
    if (!S.rs) S.rs = defRS(); rmApply();
    const k = opt.k ?? (from === 'read' && !opt.page ? null : D.wAyah[firstWord(p)]);
    if (k == null) rmRender(S.read); else rmRender(D.ayat[k * 4], k);
  }
  if (opt.k != null && m !== 'read') pendingFlash = opt.k;
}
function goPage(p) { p = Math.min(604, Math.max(1, p)); if (S.mode === 'read') setMode('read', { page: p }); else if (S.mode === 'scroll') smGo(p); else pmGo(p); }
function goAyah(k) {
  const p = D.wPage[ay(k).f];
  if (S.mode === 'read') rmRender(D.ayat[k * 4], k);
  else { pendingFlash = k; goPage(p); setTimeout(() => flashAyah(k), 350); }
}
let pendingFlash = null;
function flashAyah(k) {
  const a = ay(k); let hit = false;
  for (let i = a.f; i <= a.l; i++) $$(`.w[data-i="${i}"]`).forEach(w => { w.classList.remove('flash'); void w.offsetWidth; w.classList.add('flash'); hit = true; });
  if (hit) pendingFlash = null;
}
function markSelection(sh) { if (pendingFlash != null) flashAyah(pendingFlash); if (SEL != null) highlight(SEL, sh); }

/* ---------- ayah selection & actions ---------- */
let SEL = null;
function highlight(k, root = document) { const a = ay(k); for (let i = a.f; i <= a.l; i++) $$(`.w[data-i="${i}"]`, root).forEach(w => w.classList.add('hl')); }
function clearSel() { $$('.w.hl').forEach(w => w.classList.remove('hl')); SEL = null; $('#aBar').hidden = true; }
function selectAyah(k) {
  clearSel(); SEL = k; highlight(k);
  const a = ay(k); $('#aTitle').textContent = `سورة ${sName(a.s)} — الآية ${AR(a.a)}`;
  $('#aMark').classList.toggle('on', marks().some(m => m.k === k));
  $('#aBar').hidden = false; getWords();
}
async function ayahText(k) { await getWords(); const a = ay(k); return D.words.slice(a.f - 1, a.l - 1).join(' '); }
async function copyText(t) {
  try { await navigator.clipboard.writeText(t); }
  catch (e) { const ta = document.createElement('textarea'); ta.value = t; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.append(ta); ta.select(); document.execCommand('copy'); ta.remove(); }
}
document.addEventListener('click', e => {
  const w = e.target.closest('.w'); if (w && !e.target.closest('.panel')) { selectAyah(D.wAyah[+w.dataset.i]); return; }
  const nx = e.target.closest('[data-next]'); if (nx) { rmRender(+nx.dataset.next); return; }
  if (SEL != null && e.target.closest('main')) clearSel();
});
$('#aClose').onclick = clearSel;
$('#aCopyU').onclick = async () => { const a = ay(SEL); await copyText(`﴿${await ayahText(SEL)}﴾ [${sName(a.s)}: ${AR(a.a)}]`); toast('نُسخت الآية بالرسم العثماني'); };
$('#aShare').onclick = async () => {
  const a = ay(SEL), t = `﴿${await ayahText(SEL)}﴾ [${sName(a.s)}: ${AR(a.a)}]`;
  if (navigator.share) { try { await navigator.share({ text: t }); } catch (e) {} } else { await copyText(t); toast('نُسخت الآية للمشاركة'); }
};
$('#aMark').onclick = () => { toggleMark({ k: SEL, p: D.wPage[ay(SEL).f] }); $('#aMark').classList.toggle('on', marks().some(m => m.k === SEL)); };
// selecting words with the finger/mouse and copying gives the real Uthmani text, not the font codes
document.addEventListener('copy', e => {
  const sel = getSelection(); if (!sel.rangeCount || !D.words) return;
  const r = sel.getRangeAt(0), host = r.commonAncestorContainer.nodeType === 1 ? r.commonAncestorContainer : r.commonAncestorContainer.parentElement;
  const scope = host.closest('.sheet, .rtext, .rtxt') || host;
  const ws = $$('.w', scope).filter(w => r.intersectsNode(w)); if (!ws.length) return;
  const ids = ws.map(w => +w.dataset.i), k0 = D.wAyah[ids[0]], k1 = D.wAyah[ids[ids.length - 1]];
  let t = ids.map(i => D.words[i - 1]).join(' ');
  const a0 = ay(k0), a1 = ay(k1);
  if (a0.s === a1.s) t = `﴿${t}﴾ [${sName(a0.s)}: ${AR(a0.a)}${a1.a !== a0.a ? '–' + AR(a1.a) : ''}]`;
  e.clipboardData.setData('text/plain', t); e.preventDefault(); toast('نُسخ النص بالرسم العثماني');
});

/* ---------- bookmarks ---------- */
const marks = () => store.get('marks', []);
function toggleMark(m) {
  let L = marks(); const i = L.findIndex(x => (m.k != null ? x.k === m.k : x.k == null && x.p === m.p));
  if (i >= 0) { L.splice(i, 1); toast('أُزيلت العلامة'); } else { L.unshift({ ...m, t: Date.now() }); toast('حُفظت العلامة'); }
  store.set('marks', L.slice(0, 200)); setPage(S.page); renderMarks();
}
function renderMarks() {
  const L = marks(), ul = $('#mList');
  ul.innerHTML = L.length ? L.map((m, i) => {
    const label = m.k != null ? `سورة ${sName(ay(m.k).s)} — الآية ${AR(ay(m.k).a)}` : `صفحة ${AR(m.p)} — سورة ${sName(surahOfPage(m.p))}`;
    return `<li><button data-mi="${i}">${label}</button><button class="ib sm" data-md="${i}" aria-label="حذف"><svg><use href="#i-x"/></svg></button></li>`;
  }).join('') : '<p class="note">لا علامات بعد. اضغط على أي آية ثم «علامة»، أو على زر العلامة أعلى الشاشة لحفظ الصفحة.</p>';
}
$('#mList').onclick = e => {
  const g = e.target.closest('[data-mi]'), d = e.target.closest('[data-md]');
  if (d) { const L = marks(); L.splice(+d.dataset.md, 1); store.set('marks', L); renderMarks(); setPage(S.page); return; }
  if (g) { const m = marks()[+g.dataset.mi]; closePanels(); if (m.k != null) goAyah(m.k); else goPage(m.p); }
};
$('#btnMarkPage').onclick = () => toggleMark({ p: S.page });

/* ---------- panels ---------- */
function openPanel(id) {
  closePanels(true); $('#' + id).hidden = false; $('#scrim').hidden = false;
  history.pushState({ panel: id }, '');
}
function closePanels(silent) {
  const open = $$('.panel').some(p => !p.hidden);
  $$('.panel').forEach(p => (p.hidden = true)); $('#scrim').hidden = true;
  if (open && !silent && history.state?.panel) history.back();
}
addEventListener('popstate', () => { $$('.panel').forEach(p => (p.hidden = true)); $('#scrim').hidden = true; });
$$('.panel .close').forEach(b => (b.onclick = () => closePanels()));
$('#scrim').onclick = () => closePanels();
$$('.tabs button').forEach(b => (b.onclick = () => {
  $$('.tabs button').forEach(x => x.classList.toggle('on', x === b));
  $$('.tab').forEach(t => (t.hidden = t.id !== b.dataset.tab));
  if (b.dataset.tab === 'tMarks') renderMarks();
}));

/* index */
const normName = s => s.replace(/[أإآٱ]/g, 'ا').replace(/ة/g, 'ه').replace(/ى/g, 'ي').replace(/[ً-ْٰ]/g, '');
function renderIndex() {
  $('#sList').innerHTML = D.surahs.map(s => `<li data-n="${s.n}" data-k="${normName(s.name)}"><button data-s="${s.n}"><span class="num"><span>${AR(s.n)}</span></span><span class="sname">${s.name}</span><span class="smeta">آياتها ${AR(s.ayat)} · ص ${AR(s.page)}</span></button></li>`).join('');
}
$('#sList').onclick = e => { const b = e.target.closest('[data-s]'); if (!b) return; const s = +b.dataset.s; closePanels(); if (S.mode === 'read') rmRender(s); else goPage(D.surahs[s - 1].page); };
$('#sFilter').oninput = e => {
  const q = normName(e.target.value.trim()), n = EN(q);
  $$('#sList li').forEach(li => (li.hidden = !!q && !(li.dataset.k.includes(q) || li.dataset.n === n)));
};
$('#pGo').onclick = () => { const p = +EN($('#pNum').value); if (p >= 1 && p <= 604) { closePanels(); goPage(p); } else toast('اكتب رقم صفحة من ١ إلى ٦٠٤'); };
$('#pNum').onkeydown = e => { if (e.key === 'Enter') $('#pGo').click(); };
$('#modes').onclick = e => {
  const b = e.target.closest('button'); if (!b) return;
  if (b.dataset.act === 'index') {
    const c = $('#contRow'); c.hidden = false;
    c.innerHTML = `<button data-cont="1"><span>أنت الآن في صفحة ${AR(S.page)} — سورة ${sName(surahOfPage(S.page))}</span><span>›</span></button>`;
    openPanel('pIndex'); return;
  }
  if (b.dataset.mode && b.dataset.mode !== S.mode) setMode(b.dataset.mode);
};
$('#contRow').onclick = () => closePanels();
$('#rTitle').onclick = () => $('#modes [data-act="index"]').click();
$('#rPrev').onclick = () => RM.s > 1 && rmRender(RM.s - 1);
$('#rNext').onclick = () => RM.s < 114 && rmRender(RM.s + 1);
$('#zIn').onclick = () => rmZoom(1.12);
$('#zOut').onclick = () => rmZoom(1 / 1.12);

/* search: letters only, so the reader can type in ordinary (imlaei) spelling */
let SX = null;
const MARKS = /[ؐ-ًؚ-ٰٟۖ-ۭـ٠-٩۰-۹0-9\s]/g;
const norm = t => t.replace(MARKS, '').replace(/[اأإآٱء]/g, '').replace(/[ىئ]/g, 'ي').replace(/ؤ/g, 'و').replace(/ة/g, 'ه');
async function searchIndex() {
  if (SX) return SX; await getWords();
  SX = new Array(D.A); for (let k = 0; k < D.A; k++) { const a = ay(k); SX[k] = norm(D.words.slice(a.f - 1, a.l - 1).join('')); }
  return SX;
}
let qT, qIO;
$('#qIn').oninput = () => { clearTimeout(qT); qT = setTimeout(runSearch, 220); };
async function runSearch() {
  const raw = $('#qIn').value.trim(), info = $('#qInfo'), ol = $('#qList');
  const m = EN(raw).match(/^(\d{1,3})\s*[:：\/\-]\s*(\d{1,3})$/);
  if (m) { const k = findAyah(+m[1], +m[2]); if (k >= 0) { info.textContent = 'انتقال مباشر:'; return showResults([k]); } }
  const q = norm(raw);
  if (q.length < 2) { ol.innerHTML = ''; info.textContent = 'اكتب كلمتين أو أكثر. ويمكنك كتابة رقم السورة والآية هكذا: ٢:٢٥٥'; return; }
  info.textContent = 'جارٍ البحث…';
  const X = await searchIndex(), res = [];
  for (let k = 0; k < D.A; k++) if (X[k].includes(q)) res.push(k);
  info.textContent = res.length ? `${AR(res.length)} موضعًا${res.length > 60 ? ' — تظهر أول ٦٠ نتيجة' : ''}` : 'لم أجد نتيجة. جرّب كلمة أقصر.';
  showResults(res.slice(0, 60));
}
function showResults(ks) {
  const ol = $('#qList');
  ol.innerHTML = ks.map(k => {
    const a = ay(k);
    let t = ''; for (let i = a.f; i <= a.l; i++) t += `<span style="font-family:${fam(D.wPage[i])}">${D.glyphs[i - 1]}</span> `;
    return `<li><button data-k="${k}"><span class="rref">سورة ${sName(a.s)} — الآية ${AR(a.a)} · صفحة ${AR(D.wPage[a.f])}</span><span class="rtxt" data-ps="${[...new Set(Array.from({ length: a.l - a.f + 1 }, (_, j) => D.wPage[a.f + j]))].join(',')}">${t}</span></button></li>`;
  }).join('');
  qIO?.disconnect();
  qIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return; qIO.unobserve(e.target);
    const el = e.target; el.style.opacity = '0';
    Promise.all(el.dataset.ps.split(',').map(p => loadFont(+p))).then(() => (el.style.opacity = '1'));
  }), { root: $('#pSearch .pbody'), rootMargin: '200px 0px' });
  $$('.rtxt', ol).forEach(x => qIO.observe(x));
}
$('#qList').onclick = e => { const b = e.target.closest('[data-k]'); if (!b) return; closePanels(); goAyah(+b.dataset.k); };
$('#btnSearch').onclick = () => { openPanel('pSearch'); setTimeout(() => $('#qIn').focus(), 50); searchIndex(); };

/* theme */
function isDark() { const t = document.documentElement.dataset.theme; return t ? t === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches; }
function paintPaper() {
  const v = document.documentElement.dataset.paper || 'cream';
  $$('#paperOpts button').forEach(x => x.classList.toggle('on', x.dataset.paper === v));
}
$('#paperOpts').onclick = e => {
  const b = e.target.closest('[data-paper]'); if (!b) return;
  if (b.dataset.paper === 'cream') delete document.documentElement.dataset.paper; else document.documentElement.dataset.paper = b.dataset.paper;
  try { localStorage.setItem('shahba.paper', b.dataset.paper); } catch (e) {}
  paintPaper(); if (isDark()) toast('لون الصفحة يظهر في الوضع النهاري');
};
function paintTheme() {
  $('#btnTheme use').setAttribute('href', isDark() ? '#i-sun' : '#i-moon');
  $('meta[name="theme-color"]').content = isDark() ? '#002623' : '#054239';
}
$('#btnTheme').onclick = () => {
  const t = isDark() ? 'light' : 'dark'; document.documentElement.dataset.theme = t;
  try { localStorage.setItem('shahba.theme', t); } catch (e) {} paintTheme();
};

/* menu: offline, install, about */
$('#btnMenu').onclick = async () => { openPanel('pMenu'); offlineInfo(); };
$('#mAbout').onclick = () => { $('#aboutBox').hidden = !$('#aboutBox').hidden; };
const PCACHE = 'shahba-pages-v1';
async function offlineInfo() {
  if (!('caches' in window)) return;
  const c = await caches.open(PCACHE), keys = (await c.keys()).filter(r => r.url.endsWith('.bin')), n = D.packs.packs.length;
  $('#offInfo').textContent = keys.length >= n ? 'المصحف كله محفوظ في جهازك ويعمل دون إنترنت' : `محفوظ في جهازك ${AR(keys.length)} من ${AR(n)} جزءًا من الخطوط (المصحف كله نحو ١٠٠ ميغا)`;
}
$('#mOffline').onclick = async () => {
  if (!('caches' in window)) return toast('هذا المتصفح لا يدعم الحفظ دون إنترنت');
  const c = await caches.open(PCACHE), L = D.packs.packs, bar = $('#offProg'), i = bar.firstElementChild; bar.hidden = false;
  let done = 0, fail = 0;
  for (const p of L) {
    const u = new URL('fonts/pages/' + p.file, location.href).href;
    try { if (!(await c.match(u))) await c.add(u); } catch (e) { fail++; }
    done++; i.style.width = (done / L.length * 100) + '%';
  }
  await Promise.all(['data/words.json'].map(u => c.add(u).catch(() => {})));
  toast(fail ? 'انقطع التنزيل في بعض الأجزاء، اضغط مرة أخرى لإكماله' : 'تم: المصحف كله صار في جهازك', 3500); offlineInfo();
};
let installEv = null;
addEventListener('beforeinstallprompt', e => { e.preventDefault(); installEv = e; });
$('#mInstall').onclick = async () => {
  if (installEv) { installEv.prompt(); installEv = null; return; }
  const ios = /iphone|ipad|ipod/i.test(navigator.userAgent);
  toast(ios ? 'في سفاري: اضغط زر المشاركة ⬆ ثم «إضافة إلى الشاشة الرئيسية»' : 'من قائمة المتصفح ⋮ اختر «تثبيت التطبيق» أو «إضافة إلى الشاشة الرئيسية»', 6000);
};

/* keyboard */
addEventListener('keydown', e => {
  if (e.target.closest('input, textarea')) return;
  if (e.key === 'Escape') { closePanels(); clearSel(); }
  if (S.mode === 'page') { if (e.key === 'ArrowLeft') pmStep(1); if (e.key === 'ArrowRight') pmStep(-1); }
});
let rzT, lastW = innerWidth, lastH = innerHeight;
addEventListener('resize', () => {
  clearTimeout(rzT);
  rzT = setTimeout(() => {
    if (innerWidth === lastW && Math.abs(innerHeight - lastH) < 120) return;   // ignore the mobile address bar
    lastW = innerWidth; lastH = innerHeight;
    if (S.mode !== 'read') setMode(S.mode, { page: S.page });
  }, 180);
});

/* ---------- start ---------- */
(async function boot() {
  $('#ver').textContent = AR(VERSION.replace(/\.0$/, '')).replace(/\./g, '٫');
  paintTheme(); paintPaper();
  try { await loadData(); }
  catch (e) { $('#stripSurah').textContent = 'تعذّر تحميل المصحف، تحقق من الاتصال ثم أعد فتح الصفحة'; return; }
  renderIndex();
  const h = location.hash.match(/p=(\d+)/); if (h) S.page = Math.min(604, Math.max(1, +h[1]));
  setPage(S.page);
  setMode(S.mode, { page: S.page });
  setTimeout(getWords, 1500);
  if ('serviceWorker' in navigator && location.protocol !== 'file:') navigator.serviceWorker.register('sw.js').catch(() => {});
})();
