// Local-first persistence: one state object in IndexedDB, on this device only.
const DB_NAME = 'amifo';
const STORE = 'kv';
const KEY = 'state';

const empty = () => ({
  version: 1,
  friends: [],       // { id, name, photo, birthday, city, study, work, phone, instagram, met, notes, createdAt }
  interactions: [],  // { id, friendId, type: 'meet'|'call'|'chat', date (ISO), note }
  entries: [],       // { id, friendId, kind: 'news'|'plan', text, date ('YYYY-MM-DD'|''), done, createdAt }
  settings: { halfLife: 30 },
});

let db;
function open() {
  if (db) return Promise.resolve(db);
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(DB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(STORE);
    req.onsuccess = () => resolve((db = req.result));
    req.onerror = () => reject(req.error);
  });
}

async function read(key = KEY) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const r = d.transaction(STORE).objectStore(STORE).get(key);
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
  });
}

async function write(value, key = KEY) {
  const d = await open();
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.objectStore(STORE).put(value, key);
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
}

/** Raw key-value access for data that must stay out of backups (e.g. lock settings). */
export const kv = { get: (key) => read(key), set: (key, value) => write(value, key) };

export const uid = () =>
  (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2));

function normalize(s) {
  const base = empty();
  return {
    ...base,
    ...s,
    settings: { ...base.settings, ...(s?.settings || {}) },
    friends: Array.isArray(s?.friends) ? s.friends : [],
    interactions: Array.isArray(s?.interactions) ? s.interactions : [],
    entries: Array.isArray(s?.entries) ? s.entries : [],
  };
}

const listeners = new Set();

export const store = {
  state: empty(),

  async init() {
    try {
      this.state = normalize(await read());
    } catch (e) {
      console.error('Kon data niet laden', e);
    }
    // Ask Safari to keep this data around permanently.
    navigator.storage?.persist?.().catch(() => {});
  },

  subscribe(fn) { listeners.add(fn); return () => listeners.delete(fn); },

  notify() { listeners.forEach((fn) => fn()); },

  commit() {
    write(this.state).catch((e) => console.error('Opslaan mislukt', e));
    listeners.forEach((fn) => fn());
  },

  // ── Friends
  friend(id) { return this.state.friends.find((f) => f.id === id); },
  saveFriend(data) {
    const existing = data.id && this.friend(data.id);
    if (existing) Object.assign(existing, data);
    else this.state.friends.push({ ...data, id: uid(), createdAt: new Date().toISOString() });
    this.commit();
    return existing ? existing.id : this.state.friends.at(-1).id;
  },
  deleteFriend(id) {
    const s = this.state;
    s.friends = s.friends.filter((f) => f.id !== id);
    s.interactions = s.interactions.filter((i) => i.friendId !== id);
    s.entries = s.entries.filter((e) => e.friendId !== id);
    this.commit();
  },

  // ── Interactions
  interactionsOf(friendId) {
    return this.state.interactions
      .filter((i) => i.friendId === friendId)
      .sort((a, b) => b.date.localeCompare(a.date));
  },
  saveInteraction(data) {
    const existing = data.id && this.state.interactions.find((i) => i.id === data.id);
    if (existing) Object.assign(existing, data);
    else this.state.interactions.push({ ...data, id: uid() });
    this.commit();
    return existing ? existing.id : this.state.interactions.at(-1).id;
  },
  deleteInteraction(id) {
    this.state.interactions = this.state.interactions.filter((i) => i.id !== id);
    this.commit();
  },

  // ── Entries (news & plans)
  entriesOf(friendId, kind) {
    return this.state.entries.filter((e) => e.friendId === friendId && e.kind === kind);
  },
  saveEntry(data) {
    const existing = data.id && this.state.entries.find((e) => e.id === data.id);
    if (existing) Object.assign(existing, data);
    else this.state.entries.push({ done: false, ...data, id: uid(), createdAt: new Date().toISOString() });
    this.commit();
  },
  deleteEntry(id) {
    this.state.entries = this.state.entries.filter((e) => e.id !== id);
    this.commit();
  },

  // ── Backup
  exportJSON() { return JSON.stringify({ app: 'amifo', exportedAt: new Date().toISOString(), ...this.state }, null, 2); },
  importJSON(text) {
    const data = JSON.parse(text);
    if (!data || !Array.isArray(data.friends)) throw new Error('Geen geldig Amifo-bestand');
    const { app, exportedAt, ...rest } = data;
    this.state = normalize(rest);
    this.commit();
  },
  reset() { this.state = empty(); this.commit(); },
};
