const MAX_FIGHTER_LENGTH = 80;

const LOADING_MESSAGES = [
  'Sharpening claws…',
  'Consulting the ancient scrolls…',
  'Warming up the arena…',
  'Rendering in 4K fury…',
  'Weighing the odds…',
  'Summoning the judges…',
  'Powering up…',
  'Almost there…',
];

const ERROR_MESSAGES = {
  rate_limited: "Whoa, slow down champ — catch your breath and try again in a bit.",
  invalid_input: 'Give both fighters a name (80 characters or less).',
  verdict_failed: "The judges couldn't reach a decision. Try again?",
  moderation_blocked: 'One of those fighters got flagged by the content police. Try a different description.',
  image_failed: "The artist's pencil broke. Try again?",
  network_failed: "Couldn't reach the arena. Check your connection and try again.",
  bad_response: "The arena timed out mid-fight. Try again?",
};

const fighterAInput = document.getElementById('fighterA');
const fighterBInput = document.getElementById('fighterB');
const fightButton = document.getElementById('fightButton');
const formError = document.getElementById('formError');
const ring = document.querySelector('.ring');

const loadingView = document.getElementById('loadingView');
const loadingMessage = document.getElementById('loadingMessage');

const resultView = document.getElementById('resultView');
const portraitA = document.getElementById('portraitA');
const portraitB = document.getElementById('portraitB');
const portraitImageA = document.getElementById('portraitImageA');
const portraitImageB = document.getElementById('portraitImageB');
const portraitLabelA = document.getElementById('portraitLabelA');
const portraitLabelB = document.getElementById('portraitLabelB');
const verdictText = document.getElementById('verdictText');
const fightAgainButton = document.getElementById('fightAgainButton');

const errorView = document.getElementById('errorView');
const errorMessage = document.getElementById('errorMessage');
const retryButton = document.getElementById('retryButton');

let loadingIntervalId = null;
let lastFighters = { fighterA: '', fighterB: '' };

function hideAll() {
  ring.hidden = true;
  formError.hidden = true;
  loadingView.hidden = true;
  resultView.hidden = true;
  resultView.classList.remove('is-revealed');
  errorView.hidden = true;
}

function showForm() {
  hideAll();
  ring.hidden = false;
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function startLoading() {
  hideAll();
  loadingView.hidden = false;
  let index = 0;
  loadingMessage.textContent = LOADING_MESSAGES[0];
  loadingIntervalId = setInterval(() => {
    index = (index + 1) % LOADING_MESSAGES.length;
    loadingMessage.textContent = LOADING_MESSAGES[index];
  }, 2200);
}

function stopLoading() {
  if (loadingIntervalId) {
    clearInterval(loadingIntervalId);
    loadingIntervalId = null;
  }
}

function showError(errorCode, fallbackMessage) {
  hideAll();
  errorMessage.textContent = fallbackMessage || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.network_failed;
  errorView.hidden = false;
}

function showResult(data, { persist = true, savedA = false, savedB = false } = {}) {
  hideAll();
  resultView.hidden = false;

  portraitImageA.src = data.imageA;
  portraitImageA.alt = lastFighters.fighterA;
  portraitLabelA.textContent = lastFighters.fighterA;

  portraitImageB.src = data.imageB;
  portraitImageB.alt = lastFighters.fighterB;
  portraitLabelB.textContent = lastFighters.fighterB;

  portraitA.classList.toggle('is-winner', data.verdict.winner === 'A');
  portraitB.classList.toggle('is-winner', data.verdict.winner === 'B');

  verdictText.textContent = data.verdict.explanation;

  setSaveButtonState('A', savedA);
  setSaveButtonState('B', savedB);

  if (persist) {
    saveLastFight({
      fighterA: lastFighters.fighterA,
      fighterB: lastFighters.fighterB,
      imageA: data.imageA,
      imageB: data.imageB,
      verdict: data.verdict,
    });
  }

  // Trigger the reveal transition on the next frame so the initial
  // (hidden) state actually paints first.
  requestAnimationFrame(() => {
    requestAnimationFrame(() => {
      resultView.classList.add('is-revealed');
    });
  });
}

function setSaveButtonState(side, saved) {
  const button = document.querySelector(`.portrait-card__save[data-save="${side}"]`);
  button.disabled = saved;
  button.textContent = saved ? 'Saved!' : 'Add to BattleDex';
}

function validateFighter(value) {
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed.length > MAX_FIGHTER_LENGTH) return false;
  return true;
}

async function runFight(fighterA, fighterB) {
  lastFighters = { fighterA, fighterB };
  startLoading();

  let response;
  try {
    response = await fetch('/api/fight', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fighterA, fighterB }),
    });
  } catch {
    stopLoading();
    showError('network_failed');
    return;
  }

  let data;
  try {
    data = await response.json();
  } catch {
    stopLoading();
    showError('bad_response');
    return;
  }

  stopLoading();

  if (!response.ok) {
    showError(data.error, data.message);
    return;
  }

  showResult(data);
}

fightButton.addEventListener('click', () => {
  const fighterA = fighterAInput.value.trim();
  const fighterB = fighterBInput.value.trim();

  if (!validateFighter(fighterA) || !validateFighter(fighterB)) {
    showFormError(ERROR_MESSAGES.invalid_input);
    return;
  }

  formError.hidden = true;
  runFight(fighterA, fighterB);
});

retryButton.addEventListener('click', () => {
  runFight(lastFighters.fighterA, lastFighters.fighterB);
});

fightAgainButton.addEventListener('click', () => {
  showForm();
});

document.querySelectorAll('.portrait-card__save').forEach((button) => {
  button.addEventListener('click', async () => {
    const side = button.dataset.save;
    const label = side === 'A' ? lastFighters.fighterA : lastFighters.fighterB;
    const imageDataUrl = side === 'A' ? portraitImageA.src : portraitImageB.src;

    try {
      await saveToBattledex({ label, imageDataUrl });
      markLastFightSaved(side);
      button.disabled = true;
      button.textContent = 'Saved!';
    } catch {
      button.textContent = 'Add failed (storage full)';
    }
  });
});

if (new URLSearchParams(location.search).get('recap') === '1') {
  const lastFight = getLastFight();
  if (lastFight) {
    lastFighters = { fighterA: lastFight.fighterA, fighterB: lastFight.fighterB };
    showResult(
      { imageA: lastFight.imageA, imageB: lastFight.imageB, verdict: lastFight.verdict },
      { persist: false, savedA: lastFight.savedA, savedB: lastFight.savedB }
    );
  }
}
