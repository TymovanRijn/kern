// App lock: 6-digit code (PBKDF2-hashed) + optional Face ID via a local passkey (WebAuthn).
// Lock settings live under their own key, so they never end up in a backup.
import { kv, store } from './store.js';
import { icon } from './icons.js';
import { sheet, toast } from './ui.js';
import { secure, rand, b64, unb64, hashPin, checkPin } from './crypto.js';

const KEY = 'lock';
const LEN = 6;
let cfg = { enabled: false };
let locked = false;
let hiddenAt = 0;
let resolveGate = null;
let bioBusy = false;

const save = () => kv.set(KEY, cfg);
export const lockState = () => ({ ...cfg, secure: secure() });

export async function bioAvailable() {
  try {
    return secure() && !!window.PublicKeyCredential &&
      (await PublicKeyCredential.isUserVerifyingPlatformAuthenticatorAvailable());
  } catch { return false; }
}

// ───────────────────────── PIN pad ─────────────────────────
function pinPad({ title, bio = null, onComplete }) {
  const el = document.createElement('div');
  el.className = 'pin';
  el.innerHTML = `
    <p class="pin-msg"></p>
    <div class="pin-dots">${'<i></i>'.repeat(LEN)}</div>
    <div class="keypad">
      ${[1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => `<button type="button" data-n="${n}">${n}</button>`).join('')}
      ${bio ? `<button type="button" class="k-icon" data-bio aria-label="Face ID">${icon('faceid')}</button>` : '<span></span>'}
      <button type="button" data-n="0">0</button>
      <button type="button" class="k-icon" data-del aria-label="Wissen">${icon('del')}</button>
    </div>`;
  let val = '';
  let busy = false;
  const dots = [...el.querySelectorAll('.pin-dots i')];
  const msg = el.querySelector('.pin-msg');
  const paint = () => dots.forEach((d, i) => d.classList.toggle('on', i < val.length));

  const api = {
    el,
    setMsg(t, err = false) { msg.textContent = t; msg.classList.toggle('err', err); },
    clear() { val = ''; paint(); },
    shake() {
      el.classList.remove('shake'); void el.offsetWidth; el.classList.add('shake');
      setTimeout(() => api.clear(), 380);
    },
    disable(on) { el.classList.toggle('disabled', on); },
  };

  el.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b || busy || el.classList.contains('disabled')) return;
    if (b.dataset.n != null && val.length < LEN) {
      val += b.dataset.n; paint();
      if (val.length === LEN) {
        busy = true;
        const v = val;
        setTimeout(async () => { try { await onComplete(v, api); } finally { busy = false; } }, 140);
      }
    } else if ('del' in b.dataset) { val = val.slice(0, -1); paint(); }
    else if ('bio' in b.dataset) bio?.();
  });

  api.setMsg(title);
  return api;
}

// ───────────────────────── Face ID (WebAuthn) ─────────────────────────
async function createPasskey() {
  const cred = await navigator.credentials.create({
    publicKey: {
      challenge: rand(32),
      rp: { name: 'Amifo', id: location.hostname },
      user: { id: rand(16), name: 'Amifo', displayName: 'Amifo-slot' },
      pubKeyCredParams: [{ type: 'public-key', alg: -7 }, { type: 'public-key', alg: -257 }],
      authenticatorSelection: { authenticatorAttachment: 'platform', userVerification: 'required', residentKey: 'discouraged' },
      attestation: 'none',
      timeout: 60000,
    },
  });
  return b64(cred.rawId);
}

async function verifyBio() {
  const a = await navigator.credentials.get({
    publicKey: {
      challenge: rand(32),
      rpId: location.hostname,
      allowCredentials: [{ type: 'public-key', id: unb64(cfg.credId), transports: ['internal'] }],
      userVerification: 'required',
      timeout: 60000,
    },
  });
  const flags = new Uint8Array(a.response.authenticatorData)[32];
  return (flags & 0x04) !== 0; // UV: user verified (Face ID / passcode)
}

// ───────────────────────── Lock screen ─────────────────────────
function lockoutLeft() { return Math.max(0, Math.ceil(((cfg.lockedUntil || 0) - Date.now()) / 1000)); }

export function lockNow() {
  if (locked || !cfg.enabled || !secure()) return;
  locked = true;
  document.activeElement?.blur?.();
  document.body.classList.add('locked');

  const overlay = document.createElement('div');
  overlay.className = 'lock';
  overlay.innerHTML = `
    <div class="lock-inner">
      <img class="lock-icon" src="icons/icon-180.png" alt="">
      <div class="lock-pad"></div>
      <div class="lock-foot"><button type="button" class="lock-link" data-forgot>Code vergeten?</button></div>
    </div>`;
  document.body.append(overlay);

  let timer;
  const tryBio = async () => {
    if (bioBusy) return;
    bioBusy = true;
    try { if (await verifyBio()) unlock(); } catch { /* cancelled or not allowed without a tap */ }
    finally { bioBusy = false; }
  };

  const pad = pinPad({
    title: 'Voer je code in',
    bio: cfg.credId ? tryBio : null,
    async onComplete(pin, p) {
      if (lockoutLeft()) { p.clear(); return; }
      if (await checkPin(pin, cfg)) { cfg.fails = 0; cfg.lockedUntil = 0; await save(); unlock(); return; }
      cfg.fails = (cfg.fails || 0) + 1;
      if (cfg.fails >= 5) cfg.lockedUntil = Date.now() + Math.min(3600, 30 * 2 ** (cfg.fails - 5)) * 1000;
      await save();
      p.shake();
      showLockout();
      if (!lockoutLeft()) p.setMsg(`Onjuiste code · nog ${5 - cfg.fails} ${5 - cfg.fails === 1 ? 'poging' : 'pogingen'}`, true);
    },
  });
  overlay.querySelector('.lock-pad').append(pad.el);

  function showLockout() {
    clearInterval(timer);
    const tick = () => {
      const s = lockoutLeft();
      pad.disable(!!s);
      if (s) pad.setMsg(`Te veel pogingen. Probeer over ${s >= 60 ? Math.ceil(s / 60) + ' min' : s + ' s'} opnieuw`, true);
      else { clearInterval(timer); pad.setMsg('Voer je code in'); }
    };
    tick();
    if (lockoutLeft()) timer = setInterval(tick, 1000);
  }
  showLockout();

  // Forgot code: the only way out is starting over (data can't be recovered without the code).
  const foot = overlay.querySelector('.lock-foot');
  const footDefault = foot.innerHTML;
  foot.addEventListener('click', async (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if ('forgot' in b.dataset) {
      foot.innerHTML = `
        <p class="lock-note">${cfg.credId ? 'Probeer eerst Face ID. ' : ''}Zonder je code kun je alleen opnieuw beginnen: alle gegevens op dit apparaat worden gewist.</p>
        <button type="button" class="lock-link danger" data-wipe>Alles wissen</button>
        <button type="button" class="lock-link" data-cancel>Annuleren</button>`;
    } else if ('cancel' in b.dataset) {
      foot.innerHTML = footDefault;
    } else if ('wipe' in b.dataset) {
      if (!b.dataset.sure) { b.dataset.sure = '1'; b.textContent = 'Zeker weten? Tik nogmaals'; return; }
      cfg = { enabled: false };
      await save();
      store.reset();
      unlock();
      toast('Alles gewist');
    }
  });

  overlay._cleanup = () => clearInterval(timer);
  if (cfg.credId) setTimeout(tryBio, 350);
}

function unlock() {
  const overlay = document.querySelector('.lock');
  locked = false;
  document.body.classList.remove('locked', 'covered');
  if (overlay) {
    overlay._cleanup?.();
    overlay.classList.add('out');
    setTimeout(() => overlay.remove(), 320);
  }
  resolveGate?.();
  resolveGate = null;
}

/** Call once at startup. Resolves when the app may show its content. */
export async function gate() {
  try { cfg = (await kv.get(KEY)) || { enabled: false }; } catch { cfg = { enabled: false }; }

  document.addEventListener('visibilitychange', () => {
    if (!cfg.enabled) return;
    if (document.hidden) {
      hiddenAt = Date.now();
      document.body.classList.add('covered'); // keeps content out of the app switcher snapshot
    } else {
      if (!locked && Date.now() - hiddenAt >= (cfg.after ?? 60) * 1000) lockNow();
      document.body.classList.remove('covered');
    }
  });

  if (cfg.enabled && secure()) {
    lockNow();
    return new Promise((r) => (resolveGate = r));
  }
}

// ───────────────────────── Settings flows ─────────────────────────
function pinSheet(title) {
  const { el, close } = sheet({ title, body: '<div class="sheet-pin"></div>' });
  return { host: el.querySelector('.sheet-pin'), close };
}

async function choosePin(host) {
  return new Promise((resolve) => {
    let first = null;
    const pad = pinPad({
      title: 'Kies een code van 6 cijfers',
      async onComplete(pin, p) {
        if (!first) { first = pin; p.clear(); p.setMsg('Herhaal je code'); return; }
        if (pin !== first) { first = null; p.shake(); p.setMsg('Codes kwamen niet overeen. Kies opnieuw', true); return; }
        resolve(pin);
      },
    });
    host.replaceChildren(pad.el);
  });
}

async function askCurrent(host) {
  return new Promise((resolve) => {
    const pad = pinPad({
      title: 'Voer je huidige code in',
      async onComplete(pin, p) {
        if (await checkPin(pin, cfg)) resolve(true);
        else { p.shake(); p.setMsg('Onjuiste code', true); }
      },
    });
    host.replaceChildren(pad.el);
  });
}

export async function enableLock() {
  const { host, close } = pinSheet('Codeslot');
  const pin = await choosePin(host);
  cfg = { enabled: true, ...(await hashPin(pin)), after: 60, credId: null, fails: 0, lockedUntil: 0 };
  await save();
  store.notify();

  if (await bioAvailable()) {
    host.innerHTML = `
      <div class="bio-offer">
        <div class="bio-glyph">${icon('faceid')}</div>
        <h3>Ook Face ID gebruiken?</h3>
        <p class="prose">Dan ontgrendel je Amifo met je gezicht. Je code blijft werken als reserve.</p>
        <div class="form-actions">
          <button class="btn block" data-yes>Face ID aanzetten</button>
          <button class="btn ghost block" data-no>Niet nu</button>
        </div>
      </div>`;
    host.querySelector('[data-no]').onclick = () => { close(); toast('Codeslot staat aan'); };
    host.querySelector('[data-yes]').onclick = async () => { const ok = await enableBio(); close(); if (ok) toast('Codeslot en Face ID staan aan'); };
  } else {
    close();
    toast('Codeslot staat aan');
  }
}

export async function enableBio() {
  try {
    cfg.credId = await createPasskey();
    await save();
    store.notify();
    return true;
  } catch (e) {
    toast(e?.name === 'NotAllowedError' ? 'Face ID geannuleerd' : 'Face ID kon niet worden ingesteld');
    return false;
  }
}

export async function disableBio() {
  cfg.credId = null;
  await save();
  store.notify();
  toast('Face ID uit. Je kunt de sleutel “Amifo” eventueel ook verwijderen in de Wachtwoorden-app');
}

export async function changePin() {
  const { host, close } = pinSheet('Code wijzigen');
  await askCurrent(host);
  const pin = await choosePin(host);
  Object.assign(cfg, await hashPin(pin));
  await save();
  close();
  toast('Code gewijzigd');
}

export async function disableLock() {
  const { host, close } = pinSheet('Codeslot uitzetten');
  await askCurrent(host);
  cfg = { enabled: false };
  await save();
  close();
  store.notify();
  toast('Codeslot staat uit');
}

export async function setAfter(seconds) {
  cfg.after = seconds;
  await save();
  store.notify();
}
