/**
 * Démo e-commerce restaurant : menu filtrable par catégorie, panier
 * réactif (Map<id, {item, qty}>), animation d'ajout, toast et
 * checkout factice qui vide le panier.
 */
import { $, $$, formatEUR, escapeHTML } from '../utils/dom.js';

export function initShop(menu) {
  const menuEl = $('#shopMenu');
  if (!menuEl || !menu?.length) return;

  const els = {
    cartBody:  $('#shopCartBody'),
    cartCount: $('#shopCartCount'),
    cartTotal: $('#shopCartTotal'),
    cartCta:   $('#shopCheckout'),
    toast:     $('#shopToast'),
    cats:      $$('.shop__cat'),
  };

  const cart = new Map(); // id → { item, qty }
  let currentCat = 'all';
  let toastTimer = null;

  function renderMenu() {
    const list = currentCat === 'all' ? menu : menu.filter((m) => m.cat === currentCat);
    menuEl.innerHTML = list.map((m) => {
      const tag = m.tag
        ? `<span class="shop-item__tag ${m.tag === 'Végétarien' ? 'shop-item__tag--veg' : ''}">${escapeHTML(m.tag)}</span>`
        : '';
      return `
        <article class="shop-item" role="listitem" data-id="${escapeHTML(m.id)}">
          <div class="shop-item__img" style="background-image:url('${escapeHTML(m.img)}')">${tag}</div>
          <div class="shop-item__body">
            <div class="shop-item__name">${escapeHTML(m.name)}</div>
            <p class="shop-item__desc">${escapeHTML(m.desc)}</p>
            <div class="shop-item__foot">
              <span class="shop-item__price">${formatEUR(m.price)}</span>
              <button class="shop-item__add" aria-label="Ajouter ${escapeHTML(m.name)} au panier" data-add="${escapeHTML(m.id)}">+</button>
            </div>
          </div>
        </article>`;
    }).join('') ||
      `<p style="padding:24px;color:#888;grid-column:1/-1;text-align:center;">Aucun plat dans cette catégorie.</p>`;
  }

  function renderCart() {
    const lines = [...cart.values()];
    const totalQty   = lines.reduce((s, l) => s + l.qty, 0);
    const totalPrice = lines.reduce((s, l) => s + l.qty * l.item.price, 0);

    els.cartCount.textContent = totalQty;
    els.cartTotal.textContent = formatEUR(totalPrice);
    els.cartCta.disabled = totalQty === 0;

    if (lines.length === 0) {
      els.cartBody.innerHTML = `<p class="shop__cart-empty">Votre panier est vide. Ajoutez un plat ci-dessus.</p>`;
      return;
    }
    els.cartBody.innerHTML = lines.map(({ item, qty }) => `
      <div class="cart-line" data-id="${escapeHTML(item.id)}">
        <div class="cart-line__img" style="background-image:url('${escapeHTML(item.img)}')"></div>
        <div class="cart-line__name">
          ${escapeHTML(item.name)}
          <small>${formatEUR(item.price)} l'unité</small>
        </div>
        <div class="cart-line__qty">
          <button data-qty="-1" aria-label="Retirer un">−</button>
          <span>${qty}</span>
          <button data-qty="+1" aria-label="Ajouter un">+</button>
        </div>
      </div>
    `).join('');
  }

  function showToast(msg) {
    els.toast.textContent = msg;
    els.toast.classList.add('is-visible');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => els.toast.classList.remove('is-visible'), 2200);
  }

  function addItem(id) {
    const item = menu.find((m) => m.id === id);
    if (!item) return;
    const existing = cart.get(id);
    if (existing) existing.qty++;
    else cart.set(id, { item, qty: 1 });
    renderCart();
    const card = menuEl.querySelector(`[data-id="${id}"]`);
    if (card) {
      card.classList.add('is-just-added');
      setTimeout(() => card.classList.remove('is-just-added'), 500);
    }
    showToast(`${item.name} ajouté au panier`);
  }

  function changeQty(id, delta) {
    const line = cart.get(id);
    if (!line) return;
    line.qty += delta;
    if (line.qty <= 0) cart.delete(id);
    renderCart();
  }

  els.cats.forEach((c) =>
    c.addEventListener('click', () => {
      els.cats.forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      currentCat = c.dataset.cat;
      renderMenu();
    })
  );

  menuEl.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-add]');
    if (btn) addItem(btn.dataset.add);
  });

  els.cartBody.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-qty]');
    const line = btn?.closest('.cart-line');
    if (line) changeQty(line.dataset.id, btn.dataset.qty === '+1' ? 1 : -1);
  });

  els.cartCta.addEventListener('click', () => {
    const totalQty = [...cart.values()].reduce((s, l) => s + l.qty, 0);
    if (totalQty === 0) return;
    showToast(`Commande envoyée · ${totalQty} article${totalQty > 1 ? 's' : ''} · ${els.cartTotal.textContent}`);
    cart.clear();
    renderCart();
  });

  renderMenu();
  renderCart();
}
