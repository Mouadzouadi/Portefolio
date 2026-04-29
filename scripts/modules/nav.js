/**
 * Navigation : burger mobile + fermeture au clic + année du footer.
 */
import { $, $$ } from '../utils/dom.js';

export function initNav() {
  // Année automatique en pied de page
  const yearEl = $('#year');
  if (yearEl) yearEl.textContent = new Date().getFullYear();

  const nav = $('#nav');
  if (!nav) return;
  const burger = $('.nav__burger', nav);
  if (burger) {
    burger.addEventListener('click', () => {
      const open = nav.classList.toggle('is-open');
      burger.setAttribute('aria-expanded', String(open));
    });
  }
  $$('.nav__links a', nav).forEach((a) =>
    a.addEventListener('click', () => nav.classList.remove('is-open'))
  );
}
