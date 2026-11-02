/** Pages dédiées (agent vocal, WhatsApp, site web, mentions) : menu mobile, année du pied de page, apparition au défilement. */
import { initNav } from './modules/nav.js';
import { initReveal } from './modules/reveal.js';

for (const [name, fn] of [['nav', initNav], ['reveal', initReveal]]) {
  try { fn(); } catch (err) { console.error(`[ZM] ${name} : ${err.message}`, err); }
}
