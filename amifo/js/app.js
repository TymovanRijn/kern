import { store } from './store.js';
import { hydrateIcons } from './icons.js';
import * as views from './views.js';
import { gate } from './lock.js';

const root = document.getElementById('app');
let current = null; // { name, param }

function parse() {
  const [, name = '', param] = location.hash.replace(/^#/, '').split('/');
  if (name === 'f' && param) return { name: 'friend', param };
  if (name === 'agenda') return { name: 'agenda' };
  if (name === 'settings') return { name: 'settings' };
  return { name: 'home' };
}

function render({ animate = true } = {}) {
  const next = parse();
  const prev = current;
  const sameView = prev && prev.name === next.name && prev.param === next.param;

  const scroll = sameView ? window.scrollY : 0;
  const view = document.createElement('div');
  view.className = 'view';
  if (animate && !sameView) {
    if (next.name === 'friend' && prev?.name !== 'friend') view.classList.add('push');
    else if (prev?.name === 'friend' && next.name === 'home') view.classList.add('pop');
  } else if (sameView) {
    view.style.animation = 'none';
  }

  views[next.name](view, next.param);
  root.replaceChildren(view);
  window.scrollTo(0, scroll);
  current = next;

  const tab = next.name === 'friend' || next.name === 'home' ? 'friends' : next.name;
  document.querySelectorAll('.tabbar a').forEach((a) => a.classList.toggle('on', a.dataset.tab === tab));
}

// Edge-swipe back on detail pages (standalone web apps have no browser back gesture).
let sx = null, sy = 0;
addEventListener('touchstart', (e) => {
  const t = e.touches[0];
  sx = current?.name === 'friend' && t.clientX < 28 && !document.querySelector('.sheet') ? t.clientX : null;
  sy = t.clientY;
}, { passive: true });
addEventListener('touchend', (e) => {
  if (sx == null) return;
  const t = e.changedTouches[0];
  if (t.clientX - sx > 70 && Math.abs(t.clientY - sy) < 60) location.hash = '#/';
  sx = null;
}, { passive: true });

(async () => {
  await store.init();
  hydrateIcons();
  await gate();
  store.subscribe(() => render({ animate: false }));
  addEventListener('hashchange', () => render());
  render();

  if ('serviceWorker' in navigator && location.protocol === 'https:') {
    navigator.serviceWorker.register('../sw.js', { scope: '../' }).catch(() => {});
  }
})();
