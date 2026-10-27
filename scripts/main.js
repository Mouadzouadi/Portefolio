/**
 * ZM Solutions — point d'entrée principal.
 *
 * Charge les données JSON puis initialise chaque module de façon
 * indépendante. Si un module échoue, les autres continuent.
 *
 * Architecture :
 *   /data        — JSON sources (stock, orders, menu)
 *   /scripts
 *     /utils     — helpers DOM, fetch, format
 *     /modules   — un fichier par feature (nav, agent, stock, …)
 *     main.js    — ce fichier (orchestration)
 */
import { loadJSON } from './utils/dom.js';
import { initNav }     from './modules/nav.js';
import { initReveal }  from './modules/reveal.js';
import { initAgent }   from './modules/agent.js';
import { initStock }   from './modules/stock.js';
import { initOrders }  from './modules/orders.js';
import { initLoyalty } from './modules/loyalty.js';
import { initShop }    from './modules/shop.js';
import { initContact } from './modules/contact.js';

/** Lance un module en isolant ses erreurs (un crash n'arrête pas les autres). */
function safeInit(name, fn) {
  try { fn(); }
  catch (err) { console.error(`[ZM] ${name} : ${err.message}`, err); }
}

async function main() {
  // Chrome statique : nav, animations, formulaire, agent vocal, fidélité.
  safeInit('nav', initNav);
  safeInit('reveal', initReveal);
  safeInit('contact', initContact);
  safeInit('loyalty', initLoyalty);
  safeInit('agent', initAgent);

  // Chargement parallèle des données — chaque échec est local.
  const [stock, orders, menu] = await Promise.all([
    loadJSON('data/stock.json').catch((e) => { console.error(e); return []; }),
    loadJSON('data/orders.json').catch((e) => { console.error(e); return []; }),
    loadJSON('data/menu.json').catch((e) => { console.error(e); return []; }),
  ]);

  safeInit('stock',  () => initStock(stock));
  safeInit('orders', () => initOrders(orders));
  safeInit('shop',   () => initShop(menu));
}

if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', main);
} else {
  main();
}
