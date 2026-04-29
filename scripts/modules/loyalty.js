/**
 * Carte de fidélité dans Apple/Google Wallet — démo locale.
 * Compteur de tampons, code-barres SVG aléatoire, horloge,
 * et console "envoyer une push" avec plusieurs templates.
 */
import { $, $$, formatHM } from '../utils/dom.js';

const TOTAL = 10;

// Templates de notifications push que le commerçant peut envoyer
const PUSH_TEMPLATES = {
  promo: {
    title: '🔥 Offre du midi',
    text:  'Burger + frites + boisson à 9,90 € jusqu\'à 14 h. Commandez dès maintenant.',
  },
  reminder: {
    title: '👋 On vous attend',
    text:  'Ça fait 2 semaines qu\'on ne vous a pas vu — votre menu préféré à −1 € aujourd\'hui.',
  },
  review: {
    title: '⭐ Votre avis compte',
    text:  'Merci pour votre commande ! 30 secondes pour nous laisser un avis Google ?',
  },
  news: {
    title: '🍔 Nouveau à la carte',
    text:  'Le Smash Truffe arrive ce week-end. Réservez votre menu dès maintenant.',
  },
  happy: {
    title: '🍺 Happy hour 17 h – 19 h',
    text:  '2 boissons achetées, la 3ᵉ offerte. Sur place et en click & collect.',
  },
  weekend: {
    title: '🌟 Menu du week-end',
    text:  'Édition limitée samedi & dimanche : Bacon BBQ + onion rings + milkshake à 12,90 €.',
  },
};

export function initLoyalty() {
  const stampsEl = $('#passStamps');
  if (!stampsEl) return;

  const els = {
    remaining: $('#passRemaining'),
    status:    $('#passStatus'),
    hint:      $('#loyaltyHint'),
    walletTime:$('#walletTime'),
    btnStamp:  $('#loyaltyStamp'),
    btnReset:  $('#loyaltyReset'),
    barcode:   $('.pass__barcode'),
    push:      $('#pushNotif'),
    pushTitle: $('#pushTitle'),
    pushText:  $('#pushText'),
  };
  let stamps = 7;
  let pushTimer;

  // Affiche une notification push pendant ~3,2 s
  function showPush(title, text) {
    if (!els.push) return;
    els.pushTitle.textContent = title;
    els.pushText.textContent  = text;
    els.push.classList.add('is-visible');
    clearTimeout(pushTimer);
    pushTimer = setTimeout(() => els.push.classList.remove('is-visible'), 3200);
  }

  // Heure du téléphone
  const updateTime = () => { els.walletTime.textContent = formatHM(); };
  updateTime();
  setInterval(updateTime, 30_000);

  // Code-barres SVG aléatoire (purement décoratif)
  if (els.barcode) {
    let bars = '';
    let x = 0;
    while (x < 200) {
      const w = 1 + Math.floor(Math.random() * 4);
      const h = 28 + Math.floor(Math.random() * 8);
      const y = (40 - h) / 2;
      if (Math.random() > 0.35) bars += `<rect x="${x}" y="${y}" width="${w}" height="${h}" fill="white"/>`;
      x += w + 1;
    }
    els.barcode.innerHTML = bars;
  }

  function render() {
    stampsEl.innerHTML = '';
    for (let i = 0; i < TOTAL; i++) {
      const s = document.createElement('span');
      s.className = 'stamp' + (i < stamps ? ' is-filled' : '');
      stampsEl.appendChild(s);
    }
    const left = Math.max(0, TOTAL - stamps);
    els.remaining.textContent = left === 0
      ? 'Récompense disponible'
      : `${left} visite${left > 1 ? 's' : ''} restante${left > 1 ? 's' : ''}`;
    els.status.textContent = `${stamps} / ${TOTAL}`;
  }

  els.btnStamp.addEventListener('click', () => {
    if (stamps >= TOTAL) {
      stamps = 0;
      els.hint.textContent = 'Récompense réclamée. La carte repart à zéro.';
      showPush('🎁 Récompense réclamée', 'Merci pour votre fidélité ! Votre carte repart à zéro.');
    } else {
      stamps++;
      const left = TOTAL - stamps;
      if (stamps === TOTAL) {
        els.hint.textContent = 'Palier atteint. Cliquez à nouveau pour réclamer la récompense.';
        showPush('🎉 Récompense débloquée !', 'Vos 10 visites sont validées. Présentez votre carte pour en profiter.');
      } else {
        els.hint.textContent = 'Visite enregistrée. Notification envoyée au client.';
        showPush(
          '✨ Visite enregistrée',
          left === 1
            ? 'Plus qu\'une visite avant votre récompense !'
            : `Plus que ${left} visites avant votre récompense.`
        );
      }
    }
    render();
  });

  els.btnReset.addEventListener('click', () => {
    stamps = 0;
    els.hint.textContent = 'Carte réinitialisée.';
    render();
  });

  // Console commerçant : envoi d'un template de push au client
  $$('.push-tpl').forEach((btn) => {
    btn.addEventListener('click', () => {
      const key = btn.dataset.push;
      const tpl = PUSH_TEMPLATES[key];
      if (!tpl) return;
      showPush(tpl.title, tpl.text);
      // Feedback visuel sur le bouton (vert pendant 1.2s)
      btn.classList.add('is-sent');
      setTimeout(() => btn.classList.remove('is-sent'), 1200);
    });
  });

  render();
}
