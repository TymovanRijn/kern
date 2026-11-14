import { icon } from './icons.js';

// ── Strings
export const esc = (s = '') =>
  String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);

export const initials = (name = '') =>
  name.trim().split(/\s+/).filter(Boolean).slice(0, 2).map((w) => w[0]).join('').toUpperCase() || '?';

export const firstName = (name = '') => name.trim().split(/\s+/)[0] || name;

// ── Dates (all local time)
const DAY = 864e5;
const MONTHS = ['jan', 'feb', 'mrt', 'apr', 'mei', 'jun', 'jul', 'aug', 'sep', 'okt', 'nov', 'dec'];
export const MONTHS_LONG = ['januari', 'februari', 'maart', 'april', 'mei', 'juni', 'juli', 'augustus', 'september', 'oktober', 'november', 'december'];
const WEEKDAYS = ['zo', 'ma', 'di', 'wo', 'do', 'vr', 'za'];

export const pad = (n) => String(n).padStart(2, '0');
export const toYMD = (d = new Date()) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseYMD = (s) => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
const startOfDay = (d) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const dayDiff = (a, b = new Date()) => Math.round((startOfDay(b) - startOfDay(a)) / DAY);

/** "vandaag", "gisteren", "5 dagen geleden", "3 weken geleden" … */
export function ago(iso, short = false) {
  if (!iso) return short ? '—' : 'nog nooit';
  const d = dayDiff(new Date(iso));
  if (d < 0) return short ? 'gepland' : 'in de toekomst';
  if (d === 0) return 'vandaag';
  if (d === 1) return 'gisteren';
  if (d < 7) return short ? `${d} dgn` : `${d} dagen geleden`;
  if (d < 60) { const w = Math.round(d / 7); return short ? `${w} wk` : `${w} ${w === 1 ? 'week' : 'weken'} geleden`; }
  if (d < 365) { const m = Math.round(d / 30.4); return short ? `${m} mnd` : `${m} maanden geleden`; }
  const y = Math.floor(d / 365);
  return short ? `${y} jr` : `${y} jaar geleden`;
}

/** "in 3 dagen", "morgen", "vandaag" for future dates */
export function until(date) {
  const d = -dayDiff(date);
  if (d === 0) return 'vandaag';
  if (d === 1) return 'morgen';
  if (d < 0) return ago(date.toISOString());
  if (d < 14) return `over ${d} dagen`;
  if (d < 60) return `over ${Math.round(d / 7)} weken`;
  return `over ${Math.round(d / 30.4)} maanden`;
}

export function fmtDate(input, withWeekday = false) {
  const d = typeof input === 'string' ? (input.length === 10 ? parseYMD(input) : new Date(input)) : input;
  const sameYear = d.getFullYear() === new Date().getFullYear();
  return `${withWeekday ? WEEKDAYS[d.getDay()] + ' ' : ''}${d.getDate()} ${MONTHS[d.getMonth()]}${sameYear ? '' : ' ' + d.getFullYear()}`;
}

export function nextBirthday(ymd) {
  if (!ymd) return null;
  const b = parseYMD(ymd);
  const today = startOfDay(new Date());
  let next = new Date(today.getFullYear(), b.getMonth(), b.getDate());
  if (next < today) next = new Date(today.getFullYear() + 1, b.getMonth(), b.getDate());
  const turns = b.getFullYear() > 1900 ? next.getFullYear() - b.getFullYear() : null;
  return { date: next, turns, inDays: dayDiff(today, next) };
}

export function ageOf(ymd) {
  if (!ymd) return null;
  const b = parseYMD(ymd);
  const t = new Date();
  let a = t.getFullYear() - b.getFullYear();
  if (t.getMonth() < b.getMonth() || (t.getMonth() === b.getMonth() && t.getDate() < b.getDate())) a--;
  return a >= 0 && a < 130 ? a : null;
}

// ── Avatar with score ring
function hue(str) { let h = 0; for (const c of str) h = (h * 31 + c.charCodeAt(0)) % 360; return h; }

export function avatar(friend, { size = 48, score = null, color = 'var(--text-3)' } = {}) {
  const stroke = size >= 80 ? 4 : size >= 56 ? 3 : 2.5;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const pct = score == null ? 0 : Math.max(score, 2) / 100;
  const h = hue(friend.name || '?');
  const faceStyle = `--av-bg: light-dark(hsl(${h} 45% 90%), hsl(${h} 25% 22%)); --av-fg: light-dark(hsl(${h} 35% 28%), hsl(${h} 40% 82%)); font-size:${Math.round(size * 0.34)}px; inset:${stroke + 2}px`;
  const ring = score == null ? '' : `
    <svg class="ring" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}">
      <circle class="track" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"/>
      <circle class="prog" cx="${size / 2}" cy="${size / 2}" r="${r}" stroke-width="${stroke}"
        stroke="${color}" stroke-dasharray="${c}" stroke-dashoffset="${c * (1 - pct)}"/>
    </svg>`;
  return `<div class="avatar" style="width:${size}px;height:${size}px">
    ${ring}
    <div class="face" style="${faceStyle}">${friend.photo ? `<img src="${friend.photo}" alt="">` : esc(initials(friend.name))}</div>
  </div>`;
}

// ── Sparkline
export function sparkline(values, color) {
  const w = 300, h = 56, pad = 4;
  const max = 100;
  const step = (w - pad * 2) / (values.length - 1);
  const pts = values.map((v, i) => [pad + i * step, h - pad - (v / max) * (h - pad * 2)]);
  const line = pts.map((p, i) => `${i ? 'L' : 'M'}${p[0].toFixed(1)},${p[1].toFixed(1)}`).join('');
  const area = `${line}L${pts.at(-1)[0]},${h}L${pts[0][0]},${h}Z`;
  const id = 'g' + Math.random().toString(36).slice(2, 8);
  const last = pts.at(-1);
  return `<svg class="spark" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">
    <defs><linearGradient id="${id}" x1="0" x2="0" y1="0" y2="1">
      <stop offset="0" stop-color="${color}" stop-opacity=".28"/><stop offset="1" stop-color="${color}" stop-opacity="0"/>
    </linearGradient></defs>
    <path d="${area}" fill="url(#${id})"/>
    <path d="${line}" fill="none" stroke="${color}" stroke-width="2" stroke-linejoin="round" stroke-linecap="round" vector-effect="non-scaling-stroke"/>
    <circle cx="${last[0]}" cy="${last[1]}" r="3.5" fill="${color}"/>
  </svg>`;
}

// ── Toast
let toastTimer;
export function toast(message, action) {
  const el = document.getElementById('toast');
  el.innerHTML = `<span>${esc(message)}</span>${action ? `<button>${esc(action.label)}</button>` : ''}`;
  if (action) el.querySelector('button').onclick = () => { action.run(); hide(); };
  el.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(hide, action ? 4000 : 2200);
  function hide() { el.classList.remove('show'); }
}

// ── Bottom sheet
export function sheet({ title, body, onMount }) {
  const host = document.getElementById('sheets');
  const scrim = document.createElement('div');
  scrim.className = 'scrim';
  const el = document.createElement('section');
  el.className = 'sheet';
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'true');
  el.innerHTML = `
    <div class="grab"><i></i></div>
    <header class="sheet-head"><h3>${esc(title)}</h3><button class="icon-btn" data-close aria-label="Sluiten">${icon('x')}</button></header>
    <div class="sheet-body">${body}</div>`;
  host.append(scrim, el);
  document.body.style.overflow = 'hidden';

  requestAnimationFrame(() => requestAnimationFrame(() => { scrim.classList.add('open'); el.classList.add('open'); }));

  let closed = false, cleanup = () => {};
  const close = () => {
    if (closed) return;
    closed = true;
    scrim.classList.remove('open');
    el.classList.remove('open');
    el.style.transform = '';
    setTimeout(() => {
      cleanup(); scrim.remove(); el.remove();
      if (!host.children.length) document.body.style.overflow = '';
    }, 380);
  };

  scrim.onclick = close;
  el.querySelector('[data-close]').onclick = close;

  // Naar beneden vegen sluit het scherm; de pagina erachter beweegt nooit mee.
  // Scrollen binnen het scherm blijft werken; de kop en het greepje slepen altijd.
  const scroller = el.querySelector('.sheet-body');
  let y0 = 0, lastY = 0, lastT = 0, v = 0, drag = false, dragY0 = 0;
  const top = () => host.lastElementChild === el;
  const onStart = (e) => { if (closed || !top()) return; y0 = lastY = e.touches[0].clientY; lastT = e.timeStamp; v = 0; drag = false; };
  const onMove = (e) => {
    if (closed || !top()) return;
    const y = e.touches[0].clientY, d = y - lastY, dt = e.timeStamp - lastT;
    lastY = y; lastT = e.timeStamp; if (dt > 0) v = d / dt;
    if (!el.contains(e.target)) { e.preventDefault(); if (y - y0 > 40) close(); return; }
    if (drag) {
      e.preventDefault();
      const off = Math.max(0, y - dragY0);
      el.style.transform = `translateY(${off}px)`;
      scrim.style.opacity = String(Math.max(0, 1 - off / el.offsetHeight));
      return;
    }
    const inHead = !!e.target.closest('.grab, .sheet-head');
    const atTop = inHead || scroller.scrollTop <= 0;
    const atBottom = scroller.scrollTop + scroller.clientHeight >= scroller.scrollHeight - 1;
    if (d > 0 && atTop) { drag = true; dragY0 = y - d; el.classList.add('dragging'); scrim.style.transition = 'none'; e.preventDefault(); return; }
    if (d > 0) return;
    if (d < 0 && !atBottom && !inHead) return;
    e.preventDefault();
  };
  const onEnd = () => {
    if (!drag) return;
    drag = false;
    const off = parseFloat((el.style.transform.match(/-?[\d.]+/) || [0])[0]) || 0;
    el.classList.remove('dragging'); scrim.style.transition = ''; scrim.style.opacity = '';
    if (off > 110 || v > .6) close(); else el.style.transform = '';
  };
  document.addEventListener('touchstart', onStart, { passive: true });
  document.addEventListener('touchmove', onMove, { passive: false });
  document.addEventListener('touchend', onEnd);
  document.addEventListener('touchcancel', onEnd);
  cleanup = () => {
    document.removeEventListener('touchstart', onStart);
    document.removeEventListener('touchmove', onMove);
    document.removeEventListener('touchend', onEnd);
    document.removeEventListener('touchcancel', onEnd);
  };

  onMount?.(el, close);
  return { el, close };
}

/** Promise-based confirm using a sheet. */
export function confirmSheet({ title, message, confirm = 'Verwijderen' }) {
  return new Promise((resolve) => {
    let answered = false;
    const { el, close } = sheet({
      title,
      body: `<p class="prose" style="margin:0 0 20px">${esc(message)}</p>
        <div class="form-actions">
          <button class="btn block" style="background:var(--danger);color:#fff" data-yes>${esc(confirm)}</button>
          <button class="btn ghost block" data-no>Annuleren</button>
        </div>`,
    });
    el.querySelector('[data-yes]').onclick = () => { answered = true; resolve(true); close(); };
    el.querySelector('[data-no]').onclick = () => { answered = true; resolve(false); close(); };
    setTimeout(() => {
      const obs = new MutationObserver(() => { if (!el.isConnected) { obs.disconnect(); if (!answered) resolve(false); } });
      obs.observe(document.getElementById('sheets'), { childList: true });
    });
  });
}

// ── Images: center-crop & compress so photos stay small
export function resizeImage(file, size = 360) {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      const s = Math.min(img.width, img.height);
      const canvas = document.createElement('canvas');
      canvas.width = canvas.height = size;
      canvas.getContext('2d').drawImage(img, (img.width - s) / 2, (img.height - s) / 2, s, s, 0, 0, size, size);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/jpeg', 0.82));
    };
    img.onerror = reject;
    img.src = url;
  });
}
