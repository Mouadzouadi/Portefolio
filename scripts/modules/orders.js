/**
 * Démo Préparation des commandes : kanban filtrable, items cochables,
 * statuts new → prep → done, et "live feel" qui injecte de nouvelles
 * commandes simulées toutes les 38–55 s tant que la section est visible.
 */
import { $, $$ } from '../utils/dom.js';

const NEXT_LABEL  = { new: 'Lancer la préparation', prep: 'Marquer prête', done: 'Terminée' };
const NEXT_STATUS = { new: 'prep', prep: 'done', done: 'done' };

const FAKE_INCOMING = [
  { items: [{ n: 'Plat du jour',     q: 1 }, { n: 'Accompagnement', q: 1 }] },
  { items: [{ n: 'Sandwich',         q: 1 }, { n: 'Boisson',        q: 1 }] },
  { items: [{ n: 'Menu midi',        q: 2 }, { n: 'Boisson',        q: 2 }] },
  { items: [{ n: 'Plat principal',   q: 1 }, { n: 'Accompagnement', q: 1 }] },
  { items: [{ n: 'Menu enfant',      q: 1 }, { n: 'Boisson',        q: 1 }] },
];

export function initOrders(orders) {
  const grid = $('#ordersGrid');
  if (!grid) return;

  const els = {
    filters: $$('.orders__filters .pill'),
    clock:   $('#ordersClock'),
    cAll:    $('#cAll'),
    cNew:    $('#cNew'),
    cPrep:   $('#cPrep'),
    cDone:   $('#cDone'),
  };
  const state = { orders, filter: 'all', nextNum: 1047 };

  function tickClock() {
    els.clock.textContent = new Date().toLocaleTimeString('fr-FR', {
      hour: '2-digit', minute: '2-digit',
    });
  }
  tickClock();
  setInterval(tickClock, 30_000);

  function render() {
    els.cAll.textContent  = state.orders.length;
    els.cNew.textContent  = state.orders.filter((o) => o.status === 'new').length;
    els.cPrep.textContent = state.orders.filter((o) => o.status === 'prep').length;
    els.cDone.textContent = state.orders.filter((o) => o.status === 'done').length;

    const list = state.orders
      .filter((o) => state.filter === 'all' || o.status === state.filter)
      .sort((a, b) => a.time.localeCompare(b.time));

    grid.innerHTML = list.map((o) => `
      <article class="order" data-status="${o.status}" data-id="${o.id}">
        <div class="order__top">
          <span class="order__id">${o.id}</span>
          <span class="order__time">Retrait ${o.time}</span>
        </div>
        <div class="order__client">${o.client}</div>
        <ul class="order__items">
          ${o.items.map((it, i) => `
            <li data-i="${i}" class="${it.done ? 'is-checked' : ''}">
              ${it.n}<span class="order__qty">×${it.q}</span>
            </li>`).join('')}
        </ul>
        <button class="order__action" data-status="${o.status}" ${o.status === 'done' ? 'disabled' : ''}>${NEXT_LABEL[o.status]}</button>
      </article>
    `).join('') || `<p style="padding:24px;color:#888;">Aucune commande dans cette vue.</p>`;
  }

  // Coches d'items + boutons action
  grid.addEventListener('click', (e) => {
    const card = e.target.closest('.order');
    if (!card) return;
    const order = state.orders.find((o) => o.id === card.dataset.id);
    if (!order) return;

    const li = e.target.closest('.order__items li');
    if (li) {
      const i = +li.dataset.i;
      order.items[i].done = !order.items[i].done;
      render();
      return;
    }
    const action = e.target.closest('.order__action');
    if (action && order.status !== 'done') {
      order.status = NEXT_STATUS[order.status];
      if (order.status === 'done') order.items.forEach((it) => (it.done = true));
      render();
    }
  });

  els.filters.forEach((f) =>
    f.addEventListener('click', () => {
      els.filters.forEach((x) => x.classList.remove('is-active'));
      f.classList.add('is-active');
      state.filter = f.dataset.filter;
      render();
    })
  );

  // Live feel : nouvelle commande toutes les 38–55 s, mais uniquement
  // quand la section est visible (économie de cycles).
  function pushFakeOrder() {
    const tpl = FAKE_INCOMING[Math.floor(Math.random() * FAKE_INCOMING.length)];
    const now = new Date(Date.now() + 15 * 60_000);
    const time = `${String(now.getHours()).padStart(2, '0')}:${String(Math.floor(now.getMinutes() / 5) * 5).padStart(2, '0')}`;
    const num = state.nextNum++;
    state.orders.unshift({
      id:     `C-${num}`,
      client: `Client n°${num - 1000}`,
      time,
      status: 'new',
      items:  tpl.items.map((it) => ({ ...it, done: false })),
    });
    if (state.orders.length > 10) state.orders.pop();
    render();
  }

  let liveTimer = null;
  const section = $('#metier');
  if (section && 'IntersectionObserver' in window) {
    new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting && !liveTimer) {
            liveTimer = setInterval(pushFakeOrder, 38_000 + Math.random() * 17_000);
          } else if (!entry.isIntersecting && liveTimer) {
            clearInterval(liveTimer);
            liveTimer = null;
          }
        });
      },
      { threshold: 0.15 }
    ).observe(section);
  }

  render();
}
