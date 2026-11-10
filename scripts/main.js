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
import { loadJSON } from './utils/dom.js';
import { initNav }     from './modules/nav.js';
import { initReveal }  from './modules/reveal.js';
import { initAgent }   from './modules/agent.js?v=12';
import { initShop }    from './modules/shop.js?v=12';
import { initContact } from './modules/contact.js';

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
