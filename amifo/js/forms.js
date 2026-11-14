import { store } from './store.js';
import { TYPES } from './score.js';
import { icon } from './icons.js';
import { esc, sheet, toast, resizeImage, initials, toYMD, confirmSheet, firstName } from './ui.js';

const v = (el, name) => el.querySelector(`[name="${name}"]`).value.trim();

// ── Friend (add / edit)
export function friendForm(friend = null, onSaved) {
  const f = friend || {};
  let photo = f.photo || '';
  const field = (name, label, ph = '', type = 'text', extra = '') =>
    `<div class="field"><label for="ff-${name}">${label}</label><input id="ff-${name}" name="${name}" type="${type}" value="${esc(f[name] || '')}" placeholder="${ph}" ${extra}></div>`;

  sheet({
    title: friend ? 'Bewerken' : 'Nieuwe vriend',
    body: `<form autocomplete="off">
      <div class="photo-pick">
        <div class="ph">${photo ? `<img src="${photo}" alt="">` : f.name ? `<span>${esc(initials(f.name))}</span>` : icon('camera')}</div>
        <div class="actions">
          <label>Foto kiezen<input type="file" accept="image/*" name="photoFile"></label>
          <button type="button" data-rm-photo style="color:var(--text-2);${photo ? '' : 'display:none'}">Verwijderen</button>
        </div>
      </div>
      <div class="form-group">
        ${field('name', 'Naam', 'Voor- en achternaam', 'text', 'required autocapitalize="words"')}
        ${field('birthday', 'Verjaardag', '', 'date')}
        ${field('city', 'Woonplaats', 'Utrecht', 'text', 'autocapitalize="words"')}
      </div>
      <div class="form-group">
        ${field('study', 'Studie', 'Bijv. Geneeskunde, UvA')}
        ${field('work', 'Werk', 'Baan of bijbaan')}
        ${field('met', 'Leren kennen', 'Via wie / waar?')}
      </div>
      <div class="form-group">
        ${field('phone', 'Telefoon', '06…', 'tel')}
        ${field('instagram', 'Instagram', '@gebruikersnaam', 'text', 'autocapitalize="none"')}
      </div>
      <div class="form-actions">
        <button class="btn block" type="submit">${friend ? 'Opslaan' : 'Toevoegen'}</button>
        ${friend ? `<button class="btn danger block" type="button" data-delete>${icon('trash')} Verwijder ${esc(firstName(f.name))}</button>` : ''}
      </div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      const ph = el.querySelector('.ph');
      const rm = el.querySelector('[data-rm-photo]');
      const setPhoto = (src) => {
        photo = src;
        const n = v(form, 'name');
        ph.innerHTML = src ? `<img src="${src}" alt="">` : n ? `<span>${esc(initials(n))}</span>` : icon('camera');
        rm.style.display = src ? '' : 'none';
      };
      form.photoFile.onchange = async (e) => {
        const file = e.target.files[0];
        if (file) setPhoto(await resizeImage(file));
      };
      rm.onclick = () => setPhoto('');
      form.name.oninput = () => { if (!photo) setPhoto(''); };
      if (!friend) setTimeout(() => form.name.focus(), 350);

      form.onsubmit = (e) => {
        e.preventDefault();
        const name = v(form, 'name');
        if (!name) { form.name.focus(); return; }
        const data = { name, photo };
        for (const k of ['birthday', 'city', 'study', 'work', 'met', 'phone', 'instagram']) data[k] = v(form, k);
        if (friend) data.id = friend.id;
        const id = store.saveFriend(data);
        close();
        toast(friend ? 'Opgeslagen' : `${firstName(name)} toegevoegd`);
        onSaved?.(id);
      };

      el.querySelector('[data-delete]')?.addEventListener('click', async () => {
        const ok = await confirmSheet({
          title: `${firstName(f.name)} verwijderen?`,
          message: 'Alle contactmomenten, nieuwtjes en plannen van deze vriend worden ook verwijderd.',
        });
        if (!ok) return;
        store.deleteFriend(friend.id);
        close();
        location.hash = '#/';
        toast('Verwijderd');
      });
    },
  });
}

// ── Interaction (log with date + note, or edit existing)
export function interactionForm(friendId, interaction = null, presetType = 'meet') {
  const it = interaction || { type: presetType, date: new Date().toISOString(), note: '' };
  let type = it.type;
  sheet({
    title: interaction ? 'Contactmoment' : 'Contact loggen',
    body: `<form>
      <div class="type-pick">
        ${Object.entries(TYPES).map(([k, t]) => `<button type="button" data-type="${k}" class="${k === type ? 'on' : ''}">${icon(t.icon)}${t.label}</button>`).join('')}
      </div>
      <div class="form-group">
        <div class="field"><label>Datum</label><input type="date" name="date" value="${toYMD(new Date(it.date))}" max="${toYMD()}" required></div>
        <div class="field col"><textarea name="note" placeholder="Waar hadden jullie het over? (optioneel)">${esc(it.note || '')}</textarea></div>
      </div>
      <div class="form-actions">
        <button class="btn block" type="submit">Opslaan</button>
        ${interaction ? `<button class="btn danger block" type="button" data-delete>${icon('trash')} Verwijderen</button>` : ''}
      </div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      el.querySelectorAll('[data-type]').forEach((b) => (b.onclick = () => {
        type = b.dataset.type;
        el.querySelectorAll('[data-type]').forEach((x) => x.classList.toggle('on', x === b));
      }));
      form.onsubmit = (e) => {
        e.preventDefault();
        const ymd = form.date.value || toYMD();
        // Keep the original time if the day didn't change; otherwise use noon (or now if today).
        let date;
        if (toYMD(new Date(it.date)) === ymd) date = it.date;
        else if (ymd === toYMD()) date = new Date().toISOString();
        else date = new Date(`${ymd}T12:00:00`).toISOString();
        store.saveInteraction({ ...(interaction || {}), friendId, type, date, note: v(form, 'note') });
        close();
        toast(interaction ? 'Bijgewerkt' : `${TYPES[type].label} gelogd`);
      };
      el.querySelector('[data-delete]')?.addEventListener('click', () => {
        const copy = { ...interaction };
        store.deleteInteraction(interaction.id);
        close();
        toast('Verwijderd', { label: 'Ongedaan maken', run: () => store.saveInteraction(copy) });
      });
    },
  });
}

// ── Entry: news or plan
export function entryForm(friendId, kind, entry = null) {
  const e0 = entry || { kind, text: '', date: kind === 'news' ? toYMD() : '' };
  const isPlan = kind === 'plan';
  sheet({
    title: entry ? (isPlan ? 'Plan' : 'Nieuwtje') : isPlan ? 'Nieuw plan' : 'Nieuwtje',
    body: `<form>
      <div class="form-group">
        <div class="field col"><textarea name="text" required placeholder="${isPlan ? 'Bijv. gaat in februari op exchange naar Lissabon, of: samen naar Lowlands' : 'Bijv. heeft een nieuwe baan bij …, is verhuisd, heeft een relatie'}">${esc(e0.text)}</textarea></div>
        <div class="field"><label>${isPlan ? 'Wanneer' : 'Datum'}</label><input type="date" name="date" value="${e0.date || ''}"></div>
      </div>
      ${isPlan ? '<p class="prose" style="margin:-6px 4px 16px">Plannen met een datum verschijnen in je agenda.</p>' : ''}
      <div class="form-actions">
        <button class="btn block" type="submit">Opslaan</button>
        ${entry ? `<button class="btn danger block" type="button" data-delete>${icon('trash')} Verwijderen</button>` : ''}
      </div>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      if (!entry) setTimeout(() => form.text.focus(), 350);
      form.onsubmit = (ev) => {
        ev.preventDefault();
        const text = v(form, 'text');
        if (!text) return;
        store.saveEntry({ ...(entry || {}), friendId, kind, text, date: form.date.value });
        close();
        toast('Opgeslagen');
      };
      el.querySelector('[data-delete]')?.addEventListener('click', () => {
        const copy = { ...entry };
        store.deleteEntry(entry.id);
        close();
        toast('Verwijderd', { label: 'Ongedaan maken', run: () => { store.state.entries.push(copy); store.commit(); } });
      });
    },
  });
}

// ── Free-form notes
export function notesForm(friend) {
  sheet({
    title: 'Notities',
    body: `<form>
      <div class="form-group"><div class="field col"><textarea name="notes" style="min-height:220px" placeholder="Alles wat je wil onthouden: cadeau-ideeën, allergieën, namen van partner of huisdier, gevoelige onderwerpen…">${esc(friend.notes || '')}</textarea></div></div>
      <button class="btn block" type="submit">Opslaan</button>
    </form>`,
    onMount(el, close) {
      const form = el.querySelector('form');
      setTimeout(() => form.notes.focus(), 350);
      form.onsubmit = (e) => {
        e.preventDefault();
        store.saveFriend({ id: friend.id, notes: form.notes.value.trim() });
        close();
      };
    },
  });
}
