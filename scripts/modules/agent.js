/**
 * Démo vocale en direct (Retell Web SDK).
 *
 *   1. Le visiteur choisit un cas d'usage (restaurant, coiffeur, garage).
 *   2. « Démarrer l'appel » : POST { useCase } vers api/retell-web-call.php, qui crée l'appel
 *      chez Retell avec le rôle défini côté serveur et renvoie un access_token.
 *   3. retellClient.startCall({ accessToken }) ; la transcription arrive par l'événement `update`.
 *   4. Fin d'appel (`call_ended` ou « Raccrocher ») : nettoyage et message.
 */
import { $, $$ } from '../utils/dom.js';
import { ENDPOINT, RETELL_SDK_URL, USE_CASES } from '../demo-config.js?v=11';

const BAR_COUNT = 32;

/* ============================================================
   MODULE
   ============================================================ */

export function initAgent() {
  const agent = $('.agent');
  if (!agent) return;

  const els = {
    dot:        $('#agentDot'),
    status:     $('#agentStatus'),
    timer:      $('#agentTimer'),
    shop:       $('#agentShop'),
    caption:    $('#agentCaption'),
    transcript: $('#agentTranscript'),
    startBtn:   $('#agentStart'),
    stopBtn:    $('#agentStop'),
    waveBars:   $('#waveBars'),
    choices:    $('.agent__choices'),
  };

  // Clés des cas d'usage (l'ordre de demo-config.js fait foi).
  const useCaseKeys = Object.keys(USE_CASES);
  if (useCaseKeys.length === 0) {
    console.error('[agent] Aucun cas d\'usage défini dans demo-config.js (USE_CASES).');
    return;
  }

  // Génération des boutons à partir de la config (1 bouton par cas d'usage).
  els.choices.innerHTML = '';
  useCaseKeys.forEach((key, i) => {
    const btn = document.createElement('button');
    btn.className = 'chip' + (i === 0 ? ' is-active' : '');
    btn.setAttribute('role', 'tab');
    btn.dataset.usecase = key;
    btn.textContent = USE_CASES[key].label;
    els.choices.appendChild(btn);
  });
  const chips = $$('.agent__choices .chip');

  let currentUseCase = useCaseKeys[0];
  let running = false;
  let client = null;          // instance RetellWebClient
  let RetellWebClient = null; // classe SDK (chargée à la demande)
  let secInt = null;
  let waveTick = null;

  /* ---------- Waveform SVG ---------- */
  const bars = [];
  for (let i = 0; i < BAR_COUNT; i++) {
    const r = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
    r.setAttribute('x', (320 / BAR_COUNT) * i + 4);
    r.setAttribute('y', 55);
    r.setAttribute('width', 320 / BAR_COUNT - 4);
    r.setAttribute('height', 10);
    r.setAttribute('rx', 2);
    els.waveBars.appendChild(r);
    bars.push(r);
  }

  const animateWave = (intensity) => {
    bars.forEach((b, i) => {
      const base = intensity * (0.5 + Math.random() * 0.9);
      const h = Math.max(4, base * (40 + Math.sin(Date.now() / 200 + i) * 18));
      b.setAttribute('height', h);
      b.setAttribute('y', 60 - h / 2);
    });
  };
  const startWave = (intensity = 1) => {
    stopWave();
    waveTick = setInterval(() => animateWave(intensity), 90);
  };
  const stopWave = () => {
    if (waveTick) clearInterval(waveTick);
    waveTick = null;
    bars.forEach((b) => { b.setAttribute('height', 10); b.setAttribute('y', 55); });
  };

  /* ---------- UI helpers ---------- */
  function setStatus(label, state) {
    els.status.textContent = label;
    els.dot.className = 'dot';
    els.dot.classList.add(`dot--${state || 'idle'}`);
  }

  function toggleControls(active) {
    els.startBtn.disabled = active;
    els.stopBtn.disabled = !active;
    chips.forEach((c) => (c.disabled = active));
    agent.classList.toggle('is-active', active);
  }

  function resetTranscript() {
    els.transcript.innerHTML = `
      <div class="agent__placeholder">
        <p>La transcription apparaîtra ici, en direct.</p>
        <small>Choisissez un commerce, lancez l'appel et parlez comme un client.</small>
      </div>`;
    els.caption.textContent = "Appuyez sur le bouton pour démarrer l'appel.";
  }

  function appendSystemNote(text) {
    const note = document.createElement('div');
    note.className = 'agent__placeholder';
    const p = document.createElement('p');
    p.textContent = text;
    note.appendChild(p);
    els.transcript.appendChild(note);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  /**
   * Rend toute la transcription en bulles.
   * `transcript` = tableau de tours { role: 'agent'|'user', content: string }.
   * Rendu incrémental : on ne reconstruit que ce qui change (nouveau tour
   * ou texte du dernier tour qui s'allonge), pour éviter tout « saut ».
   */
  function renderTranscript(transcript) {
    const bubbles = els.transcript.querySelectorAll('.bubble');

    transcript.forEach((turn, i) => {
      const who = turn.role === 'agent' ? 'ai' : 'user';
      const roleLabel = who === 'ai' ? 'Agent IA' : 'Client';
      let bubble = bubbles[i];

      // Nouveau tour → on crée la bulle (avec animation d'apparition).
      if (!bubble) {
        bubble = document.createElement('div');
        bubble.className = `bubble bubble--${who}`;
        bubble.dataset.who = who;
        const role = document.createElement('span');
        role.className = 'bubble__role';
        role.textContent = roleLabel;
        const text = document.createElement('span');
        text.className = 'bubble__text';
        bubble.appendChild(role);
        bubble.appendChild(text);
        els.transcript.appendChild(bubble);
      } else if (bubble.dataset.who !== who) {
        // Le rôle de ce tour a changé → on resynchronise classe + label.
        bubble.className = `bubble bubble--${who}`;
        bubble.dataset.who = who;
        bubble.querySelector('.bubble__role').textContent = roleLabel;
      }

      // Mise à jour du texte uniquement s'il a changé (pas de ré-animation).
      const textEl = bubble.querySelector('.bubble__text');
      const content = turn.content || '';
      if (textEl.textContent !== content) textEl.textContent = content;
    });

    // Si la nouvelle transcription a moins de tours, retirer les bulles en trop.
    for (let i = transcript.length; i < bubbles.length; i++) {
      bubbles[i].remove();
    }

    autoScroll();
  }

  /** Défile vers le bas uniquement si l'utilisateur est déjà proche du bas. */
  function autoScroll() {
    const el = els.transcript;
    const nearBottom = el.scrollHeight - el.scrollTop - el.clientHeight < 80;
    if (nearBottom) el.scrollTop = el.scrollHeight;
  }

  function startTimer() {
    let s = 0;
    els.timer.textContent = '00:00';
    secInt = setInterval(() => {
      s++;
      const mm = String(Math.floor(s / 60)).padStart(2, '0');
      const ss = String(s % 60).padStart(2, '0');
      els.timer.textContent = `${mm}:${ss}`;
    }, 1000);
  }

  function clearTimers() {
    if (secInt) { clearInterval(secInt); secInt = null; }
    stopWave();
  }

  /* ---------- SDK + serveur ---------- */

  /** Charge le SDK Retell à la demande (évite de casser la page si le CDN échoue). */
  async function loadRetellSDK() {
    if (RetellWebClient) return RetellWebClient;
    const mod = await import(/* @vite-ignore */ RETELL_SDK_URL);
    RetellWebClient = mod.RetellWebClient;
    if (!RetellWebClient) throw new Error('SDK Retell introuvable (export RetellWebClient).');
    return RetellWebClient;
  }

  /** Demande au serveur du site un access_token Retell pour ce cas d'usage. */
  async function requestAccessToken(useCase) {
    const res = await fetch(ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ useCase }),
    });

    if (!res.ok) {
      // Messages lisibles pour un prospect (voir api/retell-web-call.php).
      const MESSAGES = {
        429: 'vous avez atteint la limite d’essais pour le moment. Écrivez-moi ou appelez-moi pour une démo complète.',
        503: 'la démo vocale est momentanément en pause. Écrivez-moi pour une démo en direct.',
        502: 'le service vocal ne répond pas. Réessayez dans un instant.',
      };
      throw new Error(MESSAGES[res.status] || `le service a répondu ${res.status}. Réessayez dans un instant.`);
    }

    const data = await res.json().catch(() => ({}));
    const accessToken = data.access_token || data.accessToken || data.token;
    if (!accessToken) {
      throw new Error('Impossible de récupérer la session. Réessayez dans un instant.');
    }
    return { accessToken, callId: data.call_id || data.callId, transport: data.transport || undefined, iceServers: data.ice_servers || undefined, url: data.url || undefined };
  }

  /** Branche les écouteurs d'événements du SDK Retell. */
  function wireEvents() {
    client.on('call_started', () => {
      setStatus('En communication', 'live');
      els.caption.textContent = "Parlez : l'agent vous écoute.";
      startTimer();
      // Les appels Retell récents (transport « gateway ») n'envoient plus la transcription au navigateur :
      // sans elle, la zone de gauche explique quoi faire au lieu de rester vide.
      setTimeout(() => {
        if (running && !els.transcript.querySelector('.bubble')) {
          appendSystemNote("L'appel est en cours : parlez normalement, l'agent vous répond à voix haute. Essayez « Bonjour, je voudrais commander un menu à emporter ».");
        }
      }, 2500);
    });

    client.on('agent_start_talking', () => {
      setStatus('Agent parle…', 'live');
      startWave(1.1);
    });

    client.on('agent_stop_talking', () => {
      setStatus('À vous…', 'live');
      stopWave();
    });

    // Transcription en direct (agent + utilisateur).
    client.on('update', (update) => {
      if (update && Array.isArray(update.transcript)) {
        renderTranscript(update.transcript);
      }
    });

    client.on('call_ended', () => endCall(true));

    client.on('error', (err) => {
      console.error('[agent] Retell error', err);
      endCall(false, "Une erreur est survenue pendant l'appel.");
    });
  }

  /* ---------- Cycle d'appel ---------- */

  async function startCall() {
    if (running) return;
    running = true;
    toggleControls(true);
    els.transcript.innerHTML = '';
    setStatus('Connexion…', 'call');
    els.caption.textContent = "Préparation de l'appel…";

    try {
      const SDK = await loadRetellSDK();
      const { accessToken, callId, transport, iceServers, url } = await requestAccessToken(currentUseCase);

      client = new SDK();
      wireEvents();

      // Compatibilité : startCall (API actuelle) ou startWebCall (ancienne).
      if (typeof client.startCall === 'function') {
        // SDK 3.x : RetellWebClient garde les mêmes événements (update, agent_start_talking) que la 2.x.
        // Le transport « gateway » exige aussi l'identifiant de l'appel.
        await client.startCall({ accessToken, callId, transport, iceServers, url });
      } else {
        await client.startWebCall({ accessToken });
      }
    } catch (err) {
      console.error('[agent]', err);
      setStatus('Erreur', 'idle');
      els.caption.textContent = `Impossible de démarrer l'appel : ${err.message}`;
      running = false;
      clearTimers();
      cleanupClient();
      toggleControls(false);
    }
  }

  function cleanupClient() {
    if (!client) return;
    try {
      if (typeof client.stopCall === 'function') client.stopCall();
      else if (typeof client.stopWebCall === 'function') client.stopWebCall();
    } catch (_) { /* ignore */ }
    try { client.removeAllListeners?.(); } catch (_) { /* ignore */ }
    client = null;
  }

  function endCall(natural, message) {
    if (!running && !client) return;
    running = false;
    clearTimers();
    cleanupClient();
    toggleControls(false);
    setStatus(natural ? 'Appel terminé' : 'Raccroché', 'idle');

    const note = message
      || (natural
        ? "Appel terminé — merci d'avoir testé l'agent."
        : "Vous avez raccroché.");
    els.caption.textContent = note;
    appendSystemNote(`— ${note} —`);
  }

  /* ---------- Sélecteur de cas d'usage ---------- */
  function selectUseCase(useCase) {
    currentUseCase = useCase;
    els.shop.textContent = (USE_CASES[useCase] || {}).shopName || '';
    resetTranscript();
  }

  chips.forEach((c) =>
    c.addEventListener('click', () => {
      if (running) return;
      chips.forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      selectUseCase(c.dataset.usecase);
    })
  );

  els.startBtn.addEventListener('click', startCall);
  els.stopBtn.addEventListener('click', () => endCall(false));

  // État initial : premier cas d'usage.
  selectUseCase(currentUseCase);
}
