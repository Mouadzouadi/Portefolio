/**
 * Démo agent vocal : déroule un scénario téléphonique scénarisé,
 * avec waveform animée, statut, timer et bulles de transcription.
 */
import { $, $$ } from '../utils/dom.js';

const BAR_COUNT = 32;

export function initAgent(scenarios) {
  const agent = $('.agent');
  if (!agent || !scenarios) return;

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
    chips:      $$('.agent__choices .chip'),
  };

  let currentShop = 'burger';
  let running = false;
  let timeouts = [];
  let secInt = null;
  let waveTick = null;

  // Construction de la waveform SVG
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

  function setStatus(label, state) {
    els.status.textContent = label;
    els.dot.className = 'dot';
    els.dot.classList.add(`dot--${state || 'idle'}`);
  }

  function resetTranscript() {
    els.transcript.innerHTML = `
      <div class="agent__placeholder">
        <p>La transcription apparaîtra ici, en direct.</p>
        <small>Démo scénarisée — la production utilise une vraie API vocale (Vapi / Retell / OpenAI Realtime).</small>
      </div>`;
    els.caption.textContent = 'Appuyez sur le bouton pour démarrer la simulation.';
  }

  function appendBubble(line) {
    const div = document.createElement('div');
    div.className = `bubble bubble--${line.who}`;
    div.innerHTML = `<span class="bubble__role">${line.who === 'ai' ? 'Agent IA' : 'Client'}</span>${line.text}`;
    els.transcript.appendChild(div);
    els.transcript.scrollTop = els.transcript.scrollHeight;
  }

  function appendTyping(who) {
    const div = document.createElement('div');
    div.className = `bubble bubble--${who} bubble--typing`;
    div.innerHTML = `<span></span><span></span><span></span>`;
    els.transcript.appendChild(div);
    els.transcript.scrollTop = els.transcript.scrollHeight;
    return div;
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

  function clearAll() {
    timeouts.forEach((t) => clearTimeout(t));
    timeouts = [];
    if (secInt) { clearInterval(secInt); secInt = null; }
    stopWave();
  }

  function runScenario() {
    const lines = scenarios[currentShop].lines;
    let i = 0;

    const next = () => {
      if (!running || i >= lines.length) {
        if (running) endCall(true);
        return;
      }
      const line = lines[i];
      const isAi = line.who === 'ai';

      setStatus(isAi ? 'Agent parle…' : 'Client parle…', 'live');
      els.caption.textContent = isAi ? "L'agent répond" : 'Le client formule sa demande';
      startWave(isAi ? 1.1 : 0.7);

      const typing = appendTyping(line.who);
      const dur = Math.min(3800, 700 + line.text.length * 28);

      timeouts.push(setTimeout(() => {
        typing.remove();
        appendBubble(line);
        i++;
        stopWave();
        timeouts.push(setTimeout(next, 450));
      }, dur));
    };

    timeouts.push(setTimeout(next, 300));
  }

  function startCall() {
    if (running) return;
    running = true;
    els.transcript.innerHTML = '';
    agent.classList.add('is-active');
    els.startBtn.disabled = true;
    els.stopBtn.disabled = false;
    els.chips.forEach((c) => (c.disabled = true));

    setStatus('Connexion…', 'call');
    els.caption.textContent = `Appel en cours vers ${scenarios[currentShop].shopName}…`;

    timeouts.push(setTimeout(() => {
      setStatus('En communication', 'live');
      startTimer();
      runScenario();
    }, 1100));
  }

  function endCall(natural = false) {
    running = false;
    clearAll();
    agent.classList.remove('is-active');
    els.startBtn.disabled = false;
    els.stopBtn.disabled = true;
    els.chips.forEach((c) => (c.disabled = false));
    setStatus(natural ? 'Appel terminé' : 'Raccroché', 'idle');
    els.caption.textContent = natural
      ? 'Conversation terminée. La commande est transmise au commerce.'
      : 'Vous avez interrompu la simulation.';
  }

  els.chips.forEach((c) =>
    c.addEventListener('click', () => {
      if (running) return;
      els.chips.forEach((x) => x.classList.remove('is-active'));
      c.classList.add('is-active');
      currentShop = c.dataset.shop;
      els.shop.textContent = scenarios[currentShop].shopName;
      resetTranscript();
    })
  );
  els.startBtn.addEventListener('click', startCall);
  els.stopBtn.addEventListener('click', () => endCall(false));
}
