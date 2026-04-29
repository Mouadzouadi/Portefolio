/**
 * Formulaire de contact : validation native + envoi via Formspree.
 * Créer un formulaire sur https://formspree.io et remplacer YOUR_FORM_ID.
 */
import { $ } from '../utils/dom.js';

const FORMSPREE_URL = 'https://formspree.io/f/xnjwabqj';

export function initContact() {
  const form = $('#contactForm');
  const feedback = $('#contactFeedback');
  const btn = form?.querySelector('[type="submit"]');
  if (!form || !feedback) return;

  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    if (!form.checkValidity()) {
      feedback.textContent = 'Merci de compléter les champs requis.';
      feedback.style.color = 'var(--rose)';
      return;
    }

    btn.disabled = true;
    btn.textContent = 'Envoi en cours…';
    feedback.textContent = '';

    try {
      const res = await fetch(FORMSPREE_URL, {
        method: 'POST',
        headers: { 'Accept': 'application/json' },
        body: new FormData(form),
      });
      const json = await res.json();

      if (res.ok) {
        feedback.style.color = 'var(--gold-2)';
        feedback.textContent = 'Merci ! Votre demande a bien été envoyée — je reviens vers vous sous 24 h.';
        form.reset();
      } else {
        throw new Error(json?.errors?.[0]?.message ?? 'Erreur inconnue');
      }
    } catch {
      feedback.style.color = 'var(--rose)';
      feedback.textContent = "Une erreur s'est produite. Contactez-moi directement par email.";
    } finally {
      btn.disabled = false;
      btn.textContent = 'Envoyer la demande';
    }
  });
}
