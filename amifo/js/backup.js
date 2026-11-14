// Password-encrypted backups (AES-256-GCM, key from PBKDF2). Plain JSON backups can still be restored.
import { store } from './store.js';
import { sheet, toast, confirmSheet } from './ui.js';
import { secure, encryptText, decryptEnvelope, isEncrypted } from './crypto.js';

async function shareFile(text, name) {
  const file = new File([text], name, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file] }); } catch { /* cancelled */ }
  } else {
    const a = Object.assign(document.createElement('a'), { href: URL.createObjectURL(file), download: name });
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
}

export function exportBackup() {
  if (!secure()) { toast('Versleutelde backups werken alleen in de geïnstalleerde (https) versie'); return; }
  sheet({
    title: 'Backup maken',
    body: `<form autocomplete="on">
      <p class="prose" style="margin:0 0 16px">De backup wordt versleuteld met een wachtwoord. Zonder dat wachtwoord kan niemand hem openen, ook jij niet. Bewaar het dus goed, bijvoorbeeld in de Wachtwoorden-app.</p>
      <input type="text" name="username" value="Amifo-backup" autocomplete="username" hidden>
      <div class="form-group">
        <div class="field"><label>Wachtwoord</label><input type="password" name="pw" autocomplete="new-password" minlength="8" required placeholder="Minstens 8 tekens"></div>
        <div class="field"><label>Herhaal</label><input type="password" name="pw2" autocomplete="new-password" required></div>
      </div>
      <p class="prose err-line" style="margin:-4px 4px 14px;color:var(--danger);display:none"></p>
      <button class="btn block" type="submit">Versleutelen en delen</button>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const err = el.querySelector('.err-line');
      const fail = (t) => { err.textContent = t; err.style.display = ''; };
      setTimeout(() => form.pw.focus(), 350);
      form.onsubmit = async (e) => {
        e.preventDefault();
        if (form.pw.value.length < 8) return fail('Kies een wachtwoord van minstens 8 tekens.');
        if (form.pw.value !== form.pw2.value) return fail('De wachtwoorden zijn niet hetzelfde.');
        const btn = form.querySelector('button[type=submit]');
        btn.disabled = true; btn.textContent = 'Versleutelen…';
        const text = await encryptText(store.exportJSON(), form.pw.value);
        close();
        await shareFile(text, `amifo-backup-${new Date().toISOString().slice(0, 10)}.json`);
      };
    },
  });
}

function askPassword() {
  return new Promise((resolve) => {
    let done = false;
    const { el } = sheet({
      title: 'Wachtwoord van backup',
      body: `<form>
        <div class="form-group"><div class="field"><label>Wachtwoord</label><input type="password" name="pw" autocomplete="current-password" required></div></div>
        <p class="prose err-line" style="margin:-4px 4px 14px;color:var(--danger);display:none"></p>
        <button class="btn block" type="submit">Openen</button>
      </form>`,
      onMount(el, close) {
        const form = el.querySelector('form');
        setTimeout(() => form.pw.focus(), 350);
        form.onsubmit = (e) => {
          e.preventDefault();
          const btn = form.querySelector('button');
          btn.disabled = true; btn.textContent = 'Ontsleutelen…';
          resolve({
            password: form.pw.value,
            retry(msg) {
              btn.disabled = false; btn.textContent = 'Openen';
              const err = el.querySelector('.err-line'); err.textContent = msg; err.style.display = '';
              form.pw.select();
              return new Promise((r) => { form.onsubmit = (ev) => { ev.preventDefault(); btn.disabled = true; btn.textContent = 'Ontsleutelen…'; r(form.pw.value); }; });
            },
            close() { done = true; close(); },
          });
        };
      },
    });
    // Resolve null if the sheet gets dismissed before submitting.
    const obs = new MutationObserver(() => { if (!el.isConnected) { obs.disconnect(); if (!done) resolve(null); } });
    obs.observe(document.getElementById('sheets'), { childList: true });
  });
}

export async function importBackup(file) {
  let obj;
  try { obj = JSON.parse(await file.text()); } catch { toast('Dit is geen Amifo-backup'); return; }

  let json;
  if (isEncrypted(obj)) {
    if (!secure()) { toast('Versleutelde backups werken alleen in de geïnstalleerde (https) versie'); return; }
    const ask = await askPassword();
    if (!ask) return;
    let pw = ask.password;
    for (;;) {
      try { json = await decryptEnvelope(obj, pw); break; }
      catch { pw = await ask.retry('Onjuist wachtwoord. Probeer het opnieuw.'); }
    }
    ask.close();
  } else if (Array.isArray(obj?.friends)) {
    json = JSON.stringify(obj);
  } else { toast('Dit is geen Amifo-backup'); return; }

  const ok = await confirmSheet({ title: 'Backup terugzetten?', message: 'Alles wat nu in de app staat wordt vervangen door de backup.', confirm: 'Terugzetten' });
  if (!ok) return;
  try { store.importJSON(json); toast('Backup teruggezet'); }
  catch (err) { toast(err.message || 'Kon backup niet lezen'); }
}
