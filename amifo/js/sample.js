// Demo data so the app can be explored before entering real friends.
import { uid } from './store.js';
import { toYMD } from './ui.js';

const DAY = 864e5;
const ago = (d) => new Date(Date.now() - d * DAY - Math.random() * 8 * 36e5).toISOString();
const ymdIn = (d) => toYMD(new Date(Date.now() + d * DAY));

export function sampleData() {
  const people = [
    { name: 'Sanne de Vries', study: 'Geneeskunde, UvA', city: 'Amsterdam', birthday: '2003-' + ymdIn(9).slice(5), met: 'Middelbare school', pattern: [2, 9, 16, 30, 44, 60], types: 'mcmcmc' },
    { name: 'Daan Bakker', work: 'Software engineer bij Adyen', city: 'Amsterdam', birthday: '2002-03-14', met: 'Hockey', pattern: [5, 12, 26, 40, 75], types: 'cmcmm' },
    { name: 'Lotte Jansen', study: 'Psychologie, UU', city: 'Utrecht', birthday: '2004-07-02', pattern: [24, 38, 70, 95], types: 'mccm' },
    { name: 'Milan Visser', study: 'Bedrijfskunde, EUR', city: 'Rotterdam', birthday: '2003-' + ymdIn(34).slice(5), met: 'Studievereniging', pattern: [1, 3, 8, 14, 21, 28, 35], types: 'ccmcmcm' },
    { name: 'Noor El Amrani', study: 'Rechten, Leiden', city: 'Leiden', birthday: '2003-11-28', pattern: [48, 90, 140], types: 'mcm' },
    { name: 'Thijs Mulder', work: 'Barista & fotograaf', city: 'Groningen', pattern: [120, 200], types: 'cm' },
    { name: 'Emma Smit', study: 'Architectuur, TU Delft', city: 'Delft', birthday: '2004-02-19', met: 'Via Sanne', pattern: [10, 19, 52], types: 'mcc' },
  ];
  const friends = [], interactions = [], entries = [];
  for (const p of people) {
    const id = uid();
    friends.push({ id, name: p.name, photo: '', study: p.study || '', work: p.work || '', city: p.city, birthday: p.birthday || '', met: p.met || '', phone: '', instagram: '', notes: '', createdAt: ago(200) });
    p.pattern.forEach((d, i) => {
      const t = { m: 'meet', c: i % 3 === 1 ? 'call' : 'chat' }[p.types[i]];
      interactions.push({ id: uid(), friendId: id, type: t, date: ago(d), note: '' });
    });
    if (p.name.startsWith('Sanne')) {
      entries.push({ id: uid(), friendId: id, kind: 'news', text: 'Begint in januari aan haar coschappen in het AMC', date: toYMD(new Date(Date.now() - 9 * DAY)), done: false, createdAt: ago(9) });
      entries.push({ id: uid(), friendId: id, kind: 'plan', text: 'Samen naar het concert in Paradiso', date: ymdIn(17), done: false, createdAt: ago(5) });
      entries.push({ id: uid(), friendId: id, kind: 'plan', text: 'Wil volgend jaar een half jaar naar Zuid-Amerika', date: '', done: false, createdAt: ago(30) });
    }
    if (p.name.startsWith('Milan')) {
      entries.push({ id: uid(), friendId: id, kind: 'news', text: 'Heeft een stage gevonden bij een start-up in Berlijn', date: toYMD(new Date(Date.now() - 3 * DAY)), done: false, createdAt: ago(3) });
      entries.push({ id: uid(), friendId: id, kind: 'plan', text: 'Vertrekt naar Berlijn voor stage', date: ymdIn(52), done: false, createdAt: ago(3) });
    }
    if (p.name.startsWith('Noor')) {
      entries.push({ id: uid(), friendId: id, kind: 'news', text: 'Is verhuisd naar een studio in Leiden-centrum', date: toYMD(new Date(Date.now() - 50 * DAY)), done: false, createdAt: ago(50) });
    }
  }
  return { friends, interactions, entries };
}
