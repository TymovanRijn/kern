import { store } from './store.js';
import { TYPES, STATUSES, summarize, history } from './score.js';
import { icon } from './icons.js';
import {
  esc, avatar, sparkline, ago, until, fmtDate, nextBirthday, ageOf, parseYMD, dayDiff,
  toast, firstName, MONTHS_LONG, confirmSheet,
} from './ui.js';
import { friendForm, interactionForm, entryForm, notesForm } from './forms.js';
import { sampleData } from './sample.js';
import { lockState, bioAvailable, enableLock, disableLock, changePin, enableBio, disableBio, setAfter, lockNow } from './lock.js';
import { exportBackup, importBackup } from './backup.js';

let bioOK = null;
bioAvailable().then((v) => { bioOK = v; });

const ui = { query: '', sort: 'score', expanded: {} };

function summaries() {
  const { friends, interactions, settings } = store.state;
  const byFriend = new Map(friends.map((f) => [f.id, []]));
  for (const i of interactions) byFriend.get(i.friendId)?.push(i);
  return friends.map((f) => summarize(f, byFriend.get(f.id), settings.halfLife));
}

const subtitle = (f) => [f.study || f.work, f.city].filter(Boolean).join(' · ');

// ───────────────────────── Home ─────────────────────────
export function home(root) {
  const all = summaries();
  if (!all.length) {
    root.innerHTML = `
      <div class="topbar"><a class="kern-link" href="../" aria-label="Terug naar Kern"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/></svg>Kern</a><span class="spacer"></span></div>
      <h1 class="large-title">Vrienden</h1>
      <div class="empty">
        <div class="glyph">${icon('heart')}</div>
        <h3>Jouw vriendenboek</h3>
        <p>Houd bij wat er speelt bij je vrienden en zie welke vriendschappen wat aandacht kunnen gebruiken.</p>
        <button class="btn" data-add>${icon('plus')} Eerste vriend toevoegen</button>
      </div>`;
    root.querySelector('[data-add]').onclick = () => friendForm(null, (id) => (location.hash = `#/f/${id}`));
    return;
  }

  const avg = Math.round(all.reduce((s, x) => s + x.score, 0) / all.length);
  const counts = STATUSES.map((s) => ({ ...s, n: all.filter((x) => x.status.key === s.key).length }));
  const nudges = all
    .filter((x) => x.count > 0 && x.score < 50 && x.score >= 6)
    .sort((a, b) => a.score - b.score)
    .slice(0, 10);
  const close = counts[0].n + counts[1].n;

  root.innerHTML = `
    <div class="topbar"><a class="kern-link" href="../" aria-label="Terug naar Kern"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/></svg>Kern</a><span class="spacer"></span>
      <button class="icon-btn filled" data-add aria-label="Vriend toevoegen">${icon('plus')}</button>
    </div>
    <h1 class="large-title">Vrienden<small>${all.length} ${all.length === 1 ? 'vriend' : 'vrienden'} · ${close} actief contact</small></h1>

    <div class="pulse">
      <div class="pulse-top">
        <div class="pulse-num">${avg}<span>gem. score</span></div>
        <div class="pulse-label">${pulseLine(counts)}</div>
      </div>
      <div class="bar">${counts.filter((c) => c.n).map((c) => `<i style="flex-grow:${c.n};background:${c.color}"></i>`).join('')}</div>
      <div class="legend">${counts.filter((c) => c.n).map((c) => `<span><i style="background:${c.color}"></i>${c.n} ${c.label.toLowerCase()}</span>`).join('')}</div>
    </div>

    ${nudges.length ? `
      <div class="section-head"><h2>Even bijpraten?</h2></div>
      <div class="nudges">${nudges.map((x) => `
        <a class="nudge" href="#/f/${x.friend.id}">
          ${avatar(x.friend, { size: 56, score: x.score, color: x.status.color })}
          <b>${esc(firstName(x.friend.name))}</b>
          <small>${ago(x.lastContact, true)}</small>
        </a>`).join('')}
      </div>` : ''}

    <div class="controls">
      <div class="search">${icon('search')}<input type="search" placeholder="Zoeken" value="${esc(ui.query)}" enterkeyhint="search"></div>
      <div class="segmented" data-sort>
        ${[['score', 'Score'], ['recent', 'Laatst gesproken'], ['name', 'A–Z']].map(([k, l]) => `<button data-k="${k}" class="${ui.sort === k ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <div id="friend-list"></div>`;

  const listEl = root.querySelector('#friend-list');
  const renderList = () => {
    const q = ui.query.toLowerCase();
    const rows = all
      .filter((x) => !q || [x.friend.name, x.friend.study, x.friend.work, x.friend.city].some((s) => s?.toLowerCase().includes(q)))
      .sort((a, b) =>
        ui.sort === 'name' ? a.friend.name.localeCompare(b.friend.name, 'nl')
          : ui.sort === 'recent' ? (b.lastContact || '').localeCompare(a.lastContact || '')
            : b.score - a.score || a.friend.name.localeCompare(b.friend.name, 'nl'));
    listEl.innerHTML = rows.length
      ? `<div class="list">${rows.map((x) => `
          <a class="row" href="#/f/${x.friend.id}">
            ${avatar(x.friend, { size: 48, score: x.score, color: x.status.color })}
            <div class="meta">
              <div class="name">${esc(x.friend.name)}</div>
              <div class="sub">${x.lastContact ? `Gesproken ${ago(x.lastContact)}` : 'Nog geen contact gelogd'}${subtitle(x.friend) ? ' · ' + esc(subtitle(x.friend)) : ''}</div>
            </div>
            <div class="score" style="color:${x.status.color}">${x.score}</div>
          </a>`).join('')}</div>`
      : `<div class="muted-block">Niemand gevonden voor “${esc(ui.query)}”</div>`;
  };
  renderList();

  root.querySelector('[data-add]').onclick = () => friendForm(null, (id) => (location.hash = `#/f/${id}`));
  root.querySelector('.search input').oninput = (e) => { ui.query = e.target.value; renderList(); };
  root.querySelectorAll('[data-sort] button').forEach((b) => (b.onclick = () => {
    ui.sort = b.dataset.k;
    root.querySelectorAll('[data-sort] button').forEach((x) => x.classList.toggle('on', x === b));
    renderList();
  }));
}

function pulseLine(counts) {
  const attention = counts.find((c) => c.key === 'cooling').n + counts.find((c) => c.key === 'distant').n;
  if (!attention) return 'Alles loopt goed';
  return `${attention} ${attention === 1 ? 'vriendschap koelt' : 'vriendschappen koelen'}<br>wat af`;
}

// ───────────────────────── Friend ─────────────────────────
export function friend(root, id) {
  const f = store.friend(id);
  if (!f) { location.replace('#/'); return; }
  const { halfLife } = store.state.settings;
  const ints = store.interactionsOf(id);
  const s = summarize(f, ints, halfLife);
  const hist = history(ints, halfLife);
  const trend = hist.at(-1) - hist[hist.length - 5]; // vs 4 weeks ago

  const news = store.entriesOf(id, 'news')
    .sort((a, b) => (b.date || b.createdAt).localeCompare(a.date || a.createdAt));
  const plans = store.entriesOf(id, 'plan').sort((a, b) =>
    (a.done - b.done) || ((a.date || '9999').localeCompare(b.date || '9999')));

  const bday = nextBirthday(f.birthday);
  const info = [
    f.study && ['cap', 'Studie', esc(f.study)],
    f.work && ['briefcase', 'Werk', esc(f.work)],
    f.city && ['pin', 'Woonplaats', esc(f.city)],
    bday && ['gift', 'Verjaardag', `${fmtDate(f.birthday)}${ageOf(f.birthday) != null ? ` · ${ageOf(f.birthday)} jaar` : ''} <span class="chip">${bday.inDays === 0 ? 'vandaag 🎉' : until(bday.date)}</span>`],
    f.met && ['heart', 'Leren kennen', esc(f.met)],
    f.phone && ['phone', 'Telefoon', `<a class="v" href="tel:${esc(f.phone.replace(/\s/g, ''))}">${esc(f.phone)}</a>`],
    f.instagram && ['link', 'Instagram', `<a class="v" href="https://instagram.com/${esc(f.instagram.replace(/^@/, ''))}" target="_blank" rel="noopener">@${esc(f.instagram.replace(/^@/, ''))}</a>`],
  ].filter(Boolean);

  const limit = (key, arr, n) => (ui.expanded[`${id}:${key}`] ? arr : arr.slice(0, n));
  const more = (key, arr, n) => arr.length > n && !ui.expanded[`${id}:${key}`]
    ? `<button class="show-more" data-more="${key}">Toon alle ${arr.length}</button>` : '';

  root.innerHTML = `
    <div class="topbar">
      <a class="back" href="#/">${icon('back')}Vrienden</a>
      <button class="icon-btn" data-edit aria-label="Bewerken">${icon('edit')}</button>
    </div>

    <div class="hero">
      ${avatar(f, { size: 108, score: s.score, color: s.status.color })}
      <h1>${esc(f.name)}</h1>
      ${subtitle(f) ? `<p>${esc(subtitle(f))}</p>` : ''}
    </div>

    <div class="card score-card">
      <div>
        <div class="score-big" style="color:${s.status.color}">${s.score}</div>
        <div class="score-status"><i style="background:${s.status.color}"></i>${s.status.label}</div>
      </div>
      <div>
        ${sparkline(hist, s.status.color)}
      </div>
      <div class="score-facts">
        <div class="fact"><small>Laatst gezien</small><b>${cap(ago(s.lastSeen))}</b></div>
        <div class="fact"><small>Laatst gesproken</small><b>${cap(ago(s.lastContact))}</b></div>
        <div class="fact"><small>Trend (4 weken)</small><b>${trend > 0 ? '↑ ' : trend < 0 ? '↓ ' : ''}${Math.abs(trend)} punten</b></div>
        <div class="fact"><small>Contactmomenten</small><b>${ints.length}</b></div>
      </div>
    </div>

    <div class="quicklog">
      ${Object.entries(TYPES).map(([k, t]) => `<button data-log="${k}">${icon(t.icon)}${t.label}</button>`).join('')}
    </div>
    <button class="quicklog-more" data-log-more>Met datum of notitie loggen</button>

    <div class="section-head"><h2>Nieuwtjes</h2><button data-add-entry="news">${icon('plus')}Toevoegen</button></div>
    <div class="card">
      ${news.length ? limit('news', news, 4).map((e) => `
        <div class="entry" data-entry="${e.id}">
          <div class="dot">${icon('zap')}</div>
          <div class="body"><div class="txt">${esc(e.text)}</div><div class="when">${e.date ? fmtDate(e.date) : fmtDate(e.createdAt)}</div></div>
        </div>`).join('') + more('news', news, 4)
      : `<div class="muted-block" data-add-entry="news">Nog geen nieuwtjes. Nieuwe baan, verhuisd, relatie? Zet het hier.</div>`}
    </div>

    <div class="section-head"><h2>Plannen</h2><button data-add-entry="plan">${icon('plus')}Toevoegen</button></div>
    <div class="card">
      ${plans.length ? limit('plan', plans, 5).map((e) => `
        <div class="entry ${e.done ? 'done' : ''}" data-entry="${e.id}">
          <button class="check" data-toggle="${e.id}" aria-label="Afvinken">${e.done ? icon('check') : ''}</button>
          <div class="body"><div class="txt">${esc(e.text)}</div>${e.date ? `<div class="when">${fmtDate(e.date, true)} · ${until(parseYMD(e.date))}</div>` : ''}</div>
        </div>`).join('') + more('plan', plans, 5)
      : `<div class="muted-block" data-add-entry="plan">Toekomstplannen van ${esc(firstName(f.name))}, of iets wat jullie samen willen doen.</div>`}
    </div>

    <div class="section-head"><h2>Over ${esc(firstName(f.name))}</h2><button data-edit>${icon('edit')}Wijzig</button></div>
    <div class="card" style="padding-top:6px;padding-bottom:6px">
      ${info.length ? info.map(([ic, k, val]) => `
        <div class="info-row">${icon(ic)}<div><div class="k">${k}</div><div class="v selectable">${val}</div></div></div>`).join('')
      : `<div class="muted-block" data-edit>Voeg studie, woonplaats, verjaardag en meer toe.</div>`}
    </div>

    <div class="section-head"><h2>Notities</h2></div>
    <div class="card notes-card ${f.notes ? 'selectable' : 'placeholder'}" data-notes>${f.notes ? esc(f.notes) : 'Tik om notities toe te voegen…'}</div>

    <div class="section-head"><h2>Geschiedenis</h2></div>
    <div class="card">
      ${ints.length ? limit('hist', ints, 5).map((i) => `
        <div class="entry" data-int="${i.id}">
          <div class="dot">${icon(TYPES[i.type].icon)}</div>
          <div class="body">
            <div class="txt">${TYPES[i.type].verb}</div>
            <div class="when">${fmtDate(i.date, true)} · ${ago(i.date)}</div>
            ${i.note ? `<div class="txt" style="margin-top:6px;color:var(--text-2)">${esc(i.note)}</div>` : ''}
          </div>
        </div>`).join('') + more('hist', ints, 5)
      : `<div class="muted-block">Nog geen contact gelogd. Gebruik de knoppen hierboven.</div>`}
    </div>`;

  // Events
  root.querySelectorAll('[data-edit]').forEach((b) => (b.onclick = () => friendForm(f)));
  root.querySelectorAll('[data-log]').forEach((b) => (b.onclick = () => {
    const type = b.dataset.log;
    const newId = store.saveInteraction({ friendId: id, type, date: new Date().toISOString(), note: '' });
    toast(`${TYPES[type].label} gelogd`, { label: 'Ongedaan maken', run: () => store.deleteInteraction(newId) });
  }));
  root.querySelector('[data-log-more]').onclick = () => interactionForm(id);
  root.querySelectorAll('[data-add-entry]').forEach((b) => (b.onclick = () => entryForm(id, b.dataset.addEntry)));
  root.querySelectorAll('[data-entry]').forEach((row) => (row.onclick = (e) => {
    if (e.target.closest('[data-toggle]')) return;
    const entry = store.state.entries.find((x) => x.id === row.dataset.entry);
    entryForm(id, entry.kind, entry);
  }));
  root.querySelectorAll('[data-toggle]').forEach((b) => (b.onclick = () => {
    const entry = store.state.entries.find((x) => x.id === b.dataset.toggle);
    store.saveEntry({ ...entry, done: !entry.done });
  }));
  root.querySelectorAll('[data-int]').forEach((row) => (row.onclick = () =>
    interactionForm(id, ints.find((i) => i.id === row.dataset.int))));
  root.querySelectorAll('[data-more]').forEach((b) => (b.onclick = () => {
    ui.expanded[`${id}:${b.dataset.more}`] = true;
    store.commit();
  }));
  root.querySelector('[data-notes]').onclick = (e) => {
    if (window.getSelection()?.toString()) return;
    notesForm(f);
  };
}

const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);

// ───────────────────────── Agenda ─────────────────────────
export function agenda(root) {
  const { friends, entries } = store.state;
  const byId = new Map(friends.map((f) => [f.id, f]));
  const items = [];

  for (const f of friends) {
    const b = nextBirthday(f.birthday);
    if (b && b.inDays <= 120) {
      items.push({ date: b.date, friend: f, kind: 'bday', title: `${firstName(f.name)} jarig`, sub: b.turns ? `Wordt ${b.turns}` : 'Verjaardag' });
    }
  }
  for (const e of entries) {
    if (e.kind !== 'plan' || e.done || !e.date) continue;
    const d = parseYMD(e.date);
    if (dayDiff(d) > 0) continue; // past
    const f = byId.get(e.friendId);
    if (f) items.push({ date: d, friend: f, kind: 'plan', title: e.text, sub: f.name });
  }
  items.sort((a, b) => a.date - b.date);

  const undated = entries.filter((e) => e.kind === 'plan' && !e.done && !e.date && byId.has(e.friendId));

  let html = `<div class="topbar"><a class="kern-link" href="../" aria-label="Terug naar Kern"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/></svg>Kern</a></div><h1 class="large-title">Agenda<small>Verjaardagen en plannen</small></h1>`;
  if (!items.length && !undated.length) {
    html += `<div class="empty"><div class="glyph">${icon('calendar')}</div><h3>Niks gepland</h3>
      <p>Voeg verjaardagen en plannen met een datum toe bij je vrienden, dan verschijnen ze hier.</p></div>`;
  }

  let month = null;
  let open = false;
  for (const it of items) {
    const key = `${it.date.getFullYear()}-${it.date.getMonth()}`;
    if (key !== month) {
      if (open) html += '</div>';
      const sameYear = it.date.getFullYear() === new Date().getFullYear();
      html += `<div class="month-label">${MONTHS_LONG[it.date.getMonth()]}${sameYear ? '' : ' ' + it.date.getFullYear()}</div><div class="list">`;
      month = key; open = true;
    }
    html += `
      <a class="agenda-day" href="#/f/${it.friend.id}">
        <div class="datebox"><b>${it.date.getDate()}</b><small>${until(it.date)}</small></div>
        ${avatar(it.friend, { size: 40 })}
        <div class="meta"><div class="t">${it.kind === 'bday' ? '🎂 ' : ''}${esc(it.title)}</div><div class="s">${esc(it.sub)}</div></div>
      </a>`;
  }
  if (open) html += '</div>';

  if (undated.length) {
    html += `<div class="section-head"><h2>Ooit</h2></div><div class="list">${undated.map((e) => {
      const f = byId.get(e.friendId);
      return `<a class="agenda-day" href="#/f/${f.id}">${avatar(f, { size: 40 })}
        <div class="meta"><div class="t">${esc(e.text)}</div><div class="s">${esc(f.name)}</div></div></a>`;
    }).join('')}</div>`;
  }
  root.innerHTML = html;
}

// ───────────────────────── Settings ─────────────────────────
export function settings(root) {
  const { halfLife } = store.state.settings;
  const standalone = navigator.standalone || matchMedia('(display-mode: standalone)').matches;
  const hasData = store.state.friends.length > 0;

  root.innerHTML = `
    <div class="topbar"><a class="kern-link" href="../" aria-label="Terug naar Kern"><svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor"><rect x="3" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="3" width="7.5" height="7.5" rx="2.2"/><rect x="3" y="13.5" width="7.5" height="7.5" rx="2.2"/><rect x="13.5" y="13.5" width="7.5" height="7.5" rx="2.2"/></svg>Kern</a></div>
    <h1 class="large-title">Instellingen</h1>

    ${standalone ? '' : `
    <div class="card" style="display:flex;gap:14px;align-items:flex-start;margin-bottom:8px">
      ${icon('download')}
      <div class="prose" style="padding:0"><b>Zet Amifo op je beginscherm</b><br>Tik in Safari op het deel-icoon en kies <b>Zet op beginscherm</b>. Dan opent Amifo als app, schermvullend en offline.</div>
    </div>`}

    <div class="section-head"><h2>Score</h2></div>
    <div class="list">
      <div class="setting stack">
        <div class="meta"><div class="t">Hoe snel zakt de score?</div><div class="s">Na deze tijd telt een contactmoment nog maar half mee.</div></div>
        <div class="segmented" data-half>
          ${[[14, '2 wk'], [30, '1 mnd'], [60, '2 mnd'], [90, '3 mnd']].map(([d, l]) => `<button data-d="${d}" class="${halfLife === d ? 'on' : ''}">${l}</button>`).join('')}
        </div>
      </div>
    </div>
    <p class="prose">
      Elk contact geeft punten: <b>afspreken 10</b>, <b>bellen of videobellen 6</b>, <b>chatten 3</b>.
      Die punten zakken vanzelf weg, dus zonder contact daalt de score langzaam naar 0.
      Eén keer afspreken ≈ 50. Elke maand afspreken houdt je rond de 75, wekelijks contact richting de 100.
    </p>


    <div class="section-head"><h2>Beveiliging</h2></div>
    ${securitySection()}

    <div class="section-head"><h2>Gegevens</h2></div>
    <div class="list">
      <button class="setting" data-export>${icon('upload')}<div class="meta"><div class="t">Backup maken</div><div class="s">Versleuteld met een wachtwoord, bijv. naar iCloud Drive</div></div></button>
      <label class="setting">${icon('download')}<div class="meta"><div class="t">Backup terugzetten</div><div class="s">Vervangt alles wat nu in de app staat</div></div><input type="file" accept="application/json,.json" data-import hidden></label>
      ${hasData ? '' : `<button class="setting" data-sample>${icon('users')}<div class="meta"><div class="t">Voorbeeldvrienden laden</div><div class="s">Om de app even uit te proberen</div></div></button>`}
      <button class="setting danger" data-reset>${icon('trash')}<div class="meta"><div class="t">Alles wissen</div></div></button>
    </div>
    <p class="prose">Alles staat alleen op deze iPhone. Er is geen account en er gaat niets naar een server. Maak af en toe een backup.</p>

    <div class="foot">Amifo · ${store.state.friends.length} vrienden · ${store.state.interactions.length} contactmomenten</div>`;

  root.querySelectorAll('[data-half] button').forEach((b) => (b.onclick = () => {
    store.state.settings.halfLife = Number(b.dataset.d);
    store.commit();
  }));

  root.querySelector('[data-export]').onclick = exportBackup;
  root.querySelector('[data-import]').onchange = async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (file) await importBackup(file);
  };

  const on = (sel, fn) => root.querySelector(sel)?.addEventListener('click', fn);
  on('[data-lock-on]', enableLock);
  on('[data-lock-off]', disableLock);
  on('[data-lock-pin]', changePin);
  on('[data-lock-now]', lockNow);
  on('[data-bio]', async () => {
    if (lockState().credId) disableBio();
    else if (await enableBio()) toast('Face ID staat aan');
  });
  root.querySelectorAll('[data-after] button').forEach((b) => (b.onclick = () => setAfter(Number(b.dataset.s))));

  root.querySelector('[data-sample]')?.addEventListener('click', () => {
    Object.assign(store.state, sampleData());
    store.commit();
    location.hash = '#/';
  });

  root.querySelector('[data-reset]').onclick = async () => {
    const ok = await confirmSheet({ title: 'Alles wissen?', message: 'Alle vrienden, contactmomenten, nieuwtjes en plannen worden definitief verwijderd. Dit kan niet ongedaan worden.', confirm: 'Alles wissen' });
    if (ok) { store.reset(); toast('Alles gewist'); }
  };
}

function securitySection() {
  const L = lockState();
  if (!L.secure) {
    return `<div class="list"><div class="setting disabled">${icon('lock')}<div class="meta"><div class="t">Codeslot en Face ID</div>
      <div class="s">Beschikbaar zodra je Amifo via de vaste (https) link gebruikt.</div></div></div></div>`;
  }
  if (!L.enabled) {
    return `<div class="list"><button class="setting" data-lock-on>${icon('lock')}<div class="meta"><div class="t">Codeslot aanzetten</div>
      <div class="s">Ontgrendel met Face ID of een code van 6 cijfers</div></div>${icon('chevron', 'chev')}</button></div>`;
  }
  const after = L.after ?? 60;
  return `<div class="list">
    <button class="setting" data-bio ${bioOK === false && !L.credId ? 'disabled' : ''}>${icon('faceid')}<div class="meta"><div class="t">Face ID</div>
      <div class="s">${L.credId ? 'Ontgrendelen met je gezicht' : bioOK === false ? 'Niet beschikbaar op dit apparaat' : 'Tik om aan te zetten'}</div></div>
      <span class="val">${L.credId ? 'Aan' : 'Uit'}</span></button>
    <div class="setting stack">
      <div class="meta"><div class="t">Automatisch vergrendelen</div><div class="s">Na deze tijd in de achtergrond vraagt Amifo opnieuw om Face ID of je code.</div></div>
      <div class="segmented" data-after>
        ${[[0, 'Direct'], [60, '1 min'], [300, '5 min'], [900, '15 min']].map(([v, l]) => `<button data-s="${v}" class="${after === v ? 'on' : ''}">${l}</button>`).join('')}
      </div>
    </div>
    <button class="setting" data-lock-now>${icon('lock')}<div class="meta"><div class="t">Nu vergrendelen</div></div></button>
    <button class="setting" data-lock-pin>${icon('edit')}<div class="meta"><div class="t">Code wijzigen</div></div></button>
    <button class="setting danger" data-lock-off>${icon('x')}<div class="meta"><div class="t">Codeslot uitzetten</div></div></button>
  </div>`;
}
