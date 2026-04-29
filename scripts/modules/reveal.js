/**
 * Animation reveal-on-scroll : ajoute la classe `.is-in` aux éléments
 * dès qu'ils entrent dans le viewport. Filet de sécurité après 1,5 s
 * au cas où l'IntersectionObserver ne se déclencherait pas.
 */
import { $$ } from '../utils/dom.js';

const SELECTOR =
  '.section, .card, .quote, .mockup, .demo__intro, ' +
  '.hero__title, .hero__lede, .hero__ctas, .hero__columns, .hero__media';

export function initReveal() {
  const els = $$(SELECTOR);
  if (!els.length) return;

  els.forEach((el) => el.classList.add('reveal'));

  if (!('IntersectionObserver' in window)) {
    els.forEach((el) => el.classList.add('is-in'));
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      entries.forEach((e) => {
        if (e.isIntersecting) {
          e.target.classList.add('is-in');
          io.unobserve(e.target);
        }
      });
    },
    { threshold: 0.12 }
  );
  els.forEach((el) => io.observe(el));

  // Filet de sécurité — si l'IO ne fire pas (onglet en arrière-plan, etc.).
  setTimeout(() => els.forEach((el) => el.classList.add('is-in')), 1500);
}
