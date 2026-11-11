/**
 * ZM Solutions — point d'entrée principal.
 *
 * Charge les données JSON puis initialise chaque module de façon
 * indépendante. Si un module échoue, les autres continuent.
 *
 * Architecture :
 *   /data        — JSON source (menu de la démo boutique)
 *   /scripts
 *     /utils     — helpers DOM, fetch, format
 *     /modules   — un fichier par feature (nav, agent, stock, …)
 *     main.js    — ce fichier (orchestration)
 */
import { loadJSON } from './utils/dom.js?v=3db957c402';
import { initNav }     from './modules/nav.js?v=bf555d1cbe';
import { initReveal }  from './modules/reveal.js?v=f8d5afbf75';
import { initAgent }   from './modules/agent.js?v=33ea8764bc';
import { initShop }    from './modules/shop.js?v=c6b08792cb';
import { initContact } from './modules/contact.js?v=bbbaf37cc1';

/** Lance un module en isolant ses erreurs (un crash n'arrête pas les autres). */
function safeInit(name, fn) {
  try { fn(); }
  catch (err) { console.error(`[ZM] ${name} : ${err.message}`, err); }
}

async function main() {
  // Chrome statique : nav, animations, formulaire, agent vocal.
  safeInit('nav', initNav);
  safeInit('reveal', initReveal);
  safeInit('contact', initContact);
  safeInit('agent', initAgent);

  // Démo boutique : son menu est chargé à part (un échec ne touche que la démo).
  const menu = await loadJSON('data/menu.json').catch((e) => { console.error(e); return []; });
  safeInit('shop', () => initShop(menu));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
