// Friendship score: every contact adds points that fade with a half-life.
// Score = 100 · (1 − e^(−points / K)), so it saturates near 100 and drifts to 0 on its own.

export const TYPES = {
  meet: { label: 'Gezien', verb: 'Afgesproken', icon: 'users', weight: 10 },
  call: { label: 'Gebeld', verb: 'Gebeld / video', icon: 'phone', weight: 6 },
  chat: { label: 'Gechat', verb: 'Gechat / berichtjes', icon: 'message', weight: 3 },
};

const K = 15;
const DAY = 864e5;

export function pointsAt(interactions, at, halfLife) {
  let pts = 0;
  for (const i of interactions) {
    const age = (at - Date.parse(i.date)) / DAY;
    if (age < 0) continue;
    pts += (TYPES[i.type]?.weight ?? 0) * Math.pow(0.5, age / halfLife);
  }
  return pts;
}

export function scoreAt(interactions, at = Date.now(), halfLife = 30) {
  return Math.round(100 * (1 - Math.exp(-pointsAt(interactions, at, halfLife) / K)));
}

export const STATUSES = [
  { min: 75, key: 'close', label: 'Hecht', color: 'var(--s-close)' },
  { min: 50, key: 'active', label: 'Actief', color: 'var(--s-active)' },
  { min: 25, key: 'cooling', label: 'Afkoelend', color: 'var(--s-cooling)' },
  { min: 6, key: 'distant', label: 'Op afstand', color: 'var(--s-distant)' },
  { min: 0, key: 'dormant', label: 'Slapend', color: 'var(--s-dormant)' },
];

export const statusOf = (score) => STATUSES.find((s) => score >= s.min);

/** Weekly score samples for the sparkline (oldest → newest). */
export function history(interactions, halfLife, weeks = 26) {
  const now = Date.now();
  const out = [];
  for (let w = weeks; w >= 0; w--) out.push(scoreAt(interactions, now - w * 7 * DAY, halfLife));
  return out;
}

/** Summary used by lists: score, status, last seen in person, last contact of any kind. */
export function summarize(friend, interactions, halfLife) {
  const score = scoreAt(interactions, Date.now(), halfLife);
  const sorted = interactions.slice().sort((a, b) => b.date.localeCompare(a.date));
  const past = sorted.filter((i) => Date.parse(i.date) <= Date.now());
  return {
    friend,
    score,
    status: statusOf(score),
    lastContact: past[0]?.date || null,
    lastSeen: past.find((i) => i.type === 'meet')?.date || null,
    count: interactions.length,
  };
}
