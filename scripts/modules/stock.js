/**
 * Démo Stock : table interactive + recherche + réappro,
 * et modale d'ajout d'un produit. Toute mutation des données
 * passe par `state.items` puis re-render.
 */
import { $, $$ } from '../utils/dom.js';

function statusOf(item) {
  if (item.stock <= item.threshold * 0.5) return 'bad';
  if (item.stock <= item.threshold)       return 'warn';
  return 'ok';
}

export function initStock(items) {
  const tbody = $('#stockTable tbody');
  if (!tbody) return;

  const els = {
    search:  $('#stockSearch'),
    date:    $('#stockDate'),
    total:   $('#stockTotal'),
    alert:   $('#stockAlert'),
    low:     $('#stockLow'),
  };
  const state = { items };

  els.date.textContent = new Date().toLocaleDateString('fr-FR', {
    weekday: 'long', day: 'numeric', month: 'long',
  });

  function updateKpis() {
    els.total.textContent = state.items.length;
    els.alert.textContent = state.items.filter((i) => statusOf(i) === 'bad').length;
    els.low.textContent   = state.items.filter((i) => statusOf(i) !== 'ok').length;
  }

  function render(filter = '') {
    const f = filter.trim().toLowerCase();
    const list = state.items
      .map((item, idx) => ({ item, idx }))
      .filter(({ item }) =>
        item.name.toLowerCase().includes(f) || item.cat.toLowerCase().includes(f)
      );

    tbody.innerHTML = list.map(({ item: i, idx }) => {
      const st = statusOf(i);
      const pct = Math.min(100, Math.round((i.stock / i.max) * 100));
      const fillCls = st === 'bad' ? 'is-bad' : st === 'warn' ? 'is-warn' : '';
      const tag =
        st === 'bad'  ? '<span class="tag tag--bad">Rupture proche</span>'
      : st === 'warn' ? '<span class="tag tag--warn">À recommander</span>'
      :                 '<span class="tag tag--ok">OK</span>';
      return `
        <tr data-idx="${idx}">
          <td><strong>${i.name}</strong></td>
          <td>${i.cat}</td>
          <td>
            <div class="bar">
              <div class="bar__track"><div class="bar__fill ${fillCls}" style="width:${pct}%"></div></div>
              <span class="bar__num">${i.stock}</span>
            </div>
          </td>
          <td><span class="bar__num">${i.threshold}</span></td>
          <td>${tag}</td>
          <td><button class="row-cta" data-act="restock" type="button">+ Réapprovisionner</button></td>
        </tr>`;
    }).join('') ||
      `<tr><td colspan="6" style="padding:24px;text-align:center;color:#888;">Aucun produit ne correspond.</td></tr>`;

    updateKpis();
  }

  // Réapprovisionnement (clic sur "+ Réapprovisionner")
  tbody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-act="restock"]');
    if (!btn) return;
    const tr = btn.closest('tr');
    const idx = Number(tr?.dataset.idx);
    if (Number.isNaN(idx) || !state.items[idx]) return;
    state.items[idx].stock = state.items[idx].max;
    // KPIs immédiatement, puis re-render visuel de la ligne
    updateKpis();
    btn.textContent = '✓ Réapprovisionné';
    btn.disabled = true;
    setTimeout(() => render(els.search.value || ''), 350);
  });

  els.search.addEventListener('input', (e) => render(e.target.value));

  // Modale d'ajout — pousse dans state.items puis re-render + KPIs
  initProductModal(state, () => {
    render(els.search.value || '');
    updateKpis();
  });

  render();
  return { render, updateKpis, state };
}

function initProductModal(state, onAdded) {
  const modal = $('#productModal');
  if (!modal) return;

  const form     = $('#productForm', modal);
  const datalist = $('#catList', modal);
  const openBtn  = $('.stock__search .btn--mini');

  function refreshDatalist() {
    const cats = [...new Set(state.items.map((i) => i.cat))].sort();
    datalist.innerHTML = cats.map((c) => `<option value="${c}"></option>`).join('');
  }

  const open = () => {
    refreshDatalist();
    modal.classList.add('is-open');
    modal.setAttribute('aria-hidden', 'false');
    setTimeout(() => $('#p-name', form).focus(), 80);
  };
  const close = () => {
    modal.classList.remove('is-open');
    modal.setAttribute('aria-hidden', 'true');
    form.reset();
    $('#p-stock', form).value     = 0;
    $('#p-threshold', form).value = 10;
    $('#p-max', form).value       = 100;
  };

  openBtn?.addEventListener('click', (e) => { e.preventDefault(); open(); });
  $$('[data-close]', modal).forEach((el) => el.addEventListener('click', close));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && modal.classList.contains('is-open')) close();
  });

  form.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!form.checkValidity()) { form.reportValidity(); return; }
    const data = Object.fromEntries(new FormData(form));
    const stock     = Math.max(0, Number(data.stock));
    const threshold = Math.max(0, Number(data.threshold));
    const max       = Math.max(1, Number(data.max));
    if (stock > max) {
      alert('Le stock actuel ne peut pas dépasser le stock max.');
      return;
    }
    state.items.push({
      name: data.name.trim(),
      cat:  data.cat.trim() || 'Divers',
      stock, threshold, max,
    });
    close();
    onAdded?.();
  });
}
