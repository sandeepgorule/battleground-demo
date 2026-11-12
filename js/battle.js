const MAX_FIGHTER_LENGTH = 50;

const LOADING_MESSAGES = [
  'Sharpening claws…',
  'Consulting the ancient scrolls…',
  'Taping up the gloves…',
  'Polishing the championship belt…',
  'Weighing in both fighters…',
  'Warming up the crowd…',
  'Waking the judges from their nap…',
  'Sweeping the arena floor…',
  'Mixing the war paint…',
  'Checking for loaded gloves…',
  'Sketching the contenders…',
  'Calculating the odds…',
  'Bribing the referee (just kidding)…',
  'Readying the gong…',
];

// Keep in sync with the `message` strings in api/fight.js (keyed by its error
// codes). network_failed and bad_response are client-only.
const ERROR_MESSAGES = {
  rate_limited: "Easy there, champ! The arena allows five fights a minute, and you've hit the bell. Catch your breath and step back in shortly.",
  missing_fighter: "Both corners need a fighter before the bell rings!",
  fighter_too_long: "That's the limit, champ! Fighter names max out at 50 characters so they fit on the fight poster.",
  verdict_failed: "The judges stormed out of the arena mid-match! No ruling this round. Hit Try Again to drag them back.",
  moderation_blocked: "Red card! The ring officials won't let one of those fighters through the gates. Send in a different contender.",
  image_failed: "Our ringside artist fainted before finishing the portraits! Run it back and we'll get them a fresh sketchpad.",
  network_failed: "We've lost the feed from the arena! Check your connection and try again.",
  bad_response: "The arena lights cut out mid-fight and the result got scrambled. Run it back!",
};

// The meter fills toward this over roughly a real fight's length (~60s), but
// never reaches it, since we can't know when the response will land.
const LOADING_PROGRESS_CAP = 0.95;
const LOADING_PROGRESS_TIME_MS = 25000;
const METER_SEGMENTS = 20;

const arena = document.querySelector('.arena');
const fighterAInput = document.getElementById('fighterA');
const fighterBInput = document.getElementById('fighterB');
const counterA = document.getElementById('counterA');
const counterB = document.getElementById('counterB');
const fightButton = document.getElementById('fightButton');
const formError = document.getElementById('formError');
const ring = document.querySelector('.ring');

const loadingView = document.getElementById('loadingView');
const loadingMessage = document.getElementById('loadingMessage');
const loadingNameA = document.getElementById('loadingNameA');
const loadingNameB = document.getElementById('loadingNameB');
const loadingMeter = document.getElementById('loadingMeter');

const resultView = document.getElementById('resultView');
const resultHeadline = document.getElementById('resultHeadline');
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
let progressIntervalId = null;
let lastFighters = { fighterA: '', fighterB: '' };

const meterSegments = Array.from({ length: METER_SEGMENTS }, () => {
  const segment = document.createElement('span');
  segment.className = 'meter__segment';
  loadingMeter.appendChild(segment);
  return segment;
});

// The background, headers and big A/B letters change per view, keyed off this.
function setView(view) {
  arena.dataset.view = view;
}

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
  setView('form');
  ring.hidden = false;
}

function setProgress(progress) {
  loadingView.style.setProperty('--progress', progress);
  const lit = Math.floor(progress * METER_SEGMENTS);
  meterSegments.forEach((segment, i) => {
    const third = i < METER_SEGMENTS / 3 ? 'a' : i < (2 * METER_SEGMENTS) / 3 ? 'gold' : 'b';
    segment.className = 'meter__segment';
    if (i < lit) segment.classList.add(`is-lit-${third}`);
    else if (i === lit) segment.classList.add('is-next');
  });
}

function showFormError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function shuffled(items) {
  const copy = items.slice();
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

function startLoading() {
  hideAll();
  setView('loading');
  loadingView.hidden = false;
  loadingNameA.textContent = lastFighters.fighterA;
  loadingNameB.textContent = lastFighters.fighterB;

  const startedAt = Date.now();
  setProgress(0);
  progressIntervalId = setInterval(() => {
    const elapsed = Date.now() - startedAt;
    setProgress(LOADING_PROGRESS_CAP * (1 - Math.exp(-elapsed / LOADING_PROGRESS_TIME_MS)));
  }, 500);

  // Fresh order every fight so repeat players don't see the same sequence.
  const messages = shuffled(LOADING_MESSAGES);
  let index = 0;
  loadingMessage.textContent = messages[0];
  loadingIntervalId = setInterval(() => {
    index = (index + 1) % messages.length;
    loadingMessage.textContent = messages[index];
  }, 2200);
}

function stopLoading() {
  if (loadingIntervalId) {
    clearInterval(loadingIntervalId);
    loadingIntervalId = null;
  }
  if (progressIntervalId) {
    clearInterval(progressIntervalId);
    progressIntervalId = null;
  }
}

function showError(errorCode, fallbackMessage) {
  hideAll();
  setView('error');
  errorMessage.textContent = fallbackMessage || ERROR_MESSAGES[errorCode] || ERROR_MESSAGES.network_failed;
  errorView.hidden = false;
}

function showResult(data, { persist = true, savedA = false, savedB = false } = {}) {
  hideAll();
  setView('result');
  resultView.hidden = false;

  portraitImageA.src = data.imageA;
  portraitImageA.alt = lastFighters.fighterA;
  portraitLabelA.textContent = lastFighters.fighterA;

  portraitImageB.src = data.imageB;
  portraitImageB.alt = lastFighters.fighterB;
  portraitLabelB.textContent = lastFighters.fighterB;

  const winnerIsA = data.verdict.winner === 'A';
  portraitA.classList.toggle('is-winner', winnerIsA);
  portraitA.classList.toggle('is-loser', !winnerIsA);
  portraitB.classList.toggle('is-winner', !winnerIsA);
  portraitB.classList.toggle('is-loser', winnerIsA);
  resultHeadline.textContent = `${winnerIsA ? lastFighters.fighterA : lastFighters.fighterB} wins!`;

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

// Returns an ERROR_MESSAGES key, or null if both fighters are fine.
function validateFighters(fighterA, fighterB) {
  if (!fighterA || !fighterB) return 'missing_fighter';
  if (fighterA.length > MAX_FIGHTER_LENGTH || fighterB.length > MAX_FIGHTER_LENGTH) return 'fighter_too_long';
  return null;
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

  const errorCode = validateFighters(fighterA, fighterB);
  if (errorCode) {
    showFormError(ERROR_MESSAGES[errorCode]);
    return;
  }

  formError.hidden = true;
  runFight(fighterA, fighterB);
});

// Enter in either input starts the fight, like pressing the button.
[fighterAInput, fighterBInput].forEach((input) => {
  input.addEventListener('keydown', (event) => {
    if (event.key === 'Enter') fightButton.click();
  });
});

function updateCounter(input, counter) {
  counter.textContent = `${input.value.length} / ${MAX_FIGHTER_LENGTH}`;
  counter.classList.toggle('is-maxed', input.value.length >= MAX_FIGHTER_LENGTH);
}

// maxlength stops typing (and truncates pastes) at the limit, so tell the
// player as soon as they hit it rather than silently eating characters.
[[fighterAInput, counterA], [fighterBInput, counterB]].forEach(([input, counter]) => {
  updateCounter(input, counter);
  input.addEventListener('input', () => {
    updateCounter(input, counter);
    const atLimit = [fighterAInput, fighterBInput].some((i) => i.value.length >= MAX_FIGHTER_LENGTH);
    if (atLimit) {
      showFormError(ERROR_MESSAGES.fighter_too_long);
    } else if (formError.textContent === ERROR_MESSAGES.fighter_too_long) {
      formError.hidden = true;
    }
  });
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
      const entry = await saveToBattledex({ label, imageDataUrl });
      markLastFightSaved(side, entry.id);
      button.disabled = true;
      button.textContent = 'Saved!';
    } catch {
      button.textContent = 'BattleDex is stuffed!';
    }
  });
});

if (new URLSearchParams(location.search).get('recap') === '1') {
  const lastFight = getLastFight();
  if (lastFight) {
    lastFighters = { fighterA: lastFight.fighterA, fighterB: lastFight.fighterB };
    showResult(
      { imageA: lastFight.imageA, imageB: lastFight.imageB, verdict: lastFight.verdict },
      {
        persist: false,
        savedA: isInBattledex(lastFight.savedIdA),
        savedB: isInBattledex(lastFight.savedIdB),
      }
    );
  }
}
