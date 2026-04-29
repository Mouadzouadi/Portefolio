/**
 * Helpers DOM / utilitaires partagés.
 * Tout passe par ces fonctions pour garder un style homogène.
 */

/** Sélecteur court (renvoie un seul élément). */
export const $ = (sel, root = document) => root.querySelector(sel);

/** Sélecteur multiple (renvoie un tableau, pratique pour .map / .forEach). */
export const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

/** Charge un fichier JSON depuis le dossier /data. */
export async function loadJSON(path) {
  const res = await fetch(path, { cache: 'no-cache' });
  if (!res.ok) throw new Error(`Impossible de charger ${path} (${res.status})`);
  return res.json();
}

/** Format prix euros en français. */
export const formatEUR = (n) =>
  n.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) + ' €';

/** Format heure HH:MM. */
export const formatHM = (date = new Date()) =>
  `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;

/**
 * Échappe une chaîne pour usage dans du HTML (évite les injections XSS
 * quand on injecte des données utilisateur avec innerHTML).
 */
export function escapeHTML(str) {
  return String(str).replace(/[&<>"']/g, (c) => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;',
  }[c]));
}
