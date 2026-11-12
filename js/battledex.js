const dexGrid = document.getElementById('dexGrid');
const dexEmpty = document.getElementById('dexEmpty');
const lastFightLink = document.getElementById('lastFightLink');
const clearDexButton = document.getElementById('clearDexButton');
const dexMeta = document.getElementById('dexMeta');
const dexCount = document.getElementById('dexCount');

const CLEAR_CONFIRM_MS = 3000;
let clearConfirmTimeoutId = null;

lastFightLink.hidden = !getLastFight();

function renderBattledex() {
  const dex = getBattledex().slice().reverse();

  if (dex.length === 0) {
    dexEmpty.hidden = false;
    dexGrid.hidden = true;
    clearDexButton.hidden = true;
    dexMeta.hidden = true;
    return;
  }

  dexEmpty.hidden = true;
  dexMeta.hidden = false;
  dexCount.textContent = `${dex.length} / ${BATTLEDEX_MAX_ENTRIES}`;
  clearDexButton.hidden = false;
  dexGrid.hidden = false;
  dexGrid.innerHTML = '';

  dex.forEach((entry, i) => {
    const card = document.createElement('div');
    card.className = 'dex-card';

    const num = document.createElement('span');
    num.className = 'dex-card__num';
    num.textContent = `#${String(i + 1).padStart(2, '0')}`;

    const img = document.createElement('img');
    img.className = 'dex-card__image';
    img.src = entry.imageDataUrl;
    img.alt = entry.label;

    const label = document.createElement('span');
    label.className = 'dex-card__label';
    label.textContent = entry.label;

    const remove = document.createElement('button');
    remove.className = 'dex-card__remove';
    remove.type = 'button';
    remove.textContent = '×';
    remove.setAttribute('aria-label', `Remove ${entry.label} from BattleDex`);
    remove.addEventListener('click', () => {
      deleteFromBattledex(entry.id);
      renderBattledex();
    });

    card.appendChild(num);
    card.appendChild(remove);
    card.appendChild(img);
    card.appendChild(label);
    dexGrid.appendChild(card);
  });
}

function resetClearButton() {
  clearTimeout(clearConfirmTimeoutId);
  clearConfirmTimeoutId = null;
  clearDexButton.classList.remove('is-confirming');
  clearDexButton.textContent = 'Clear All';
}

// Two-tap confirm instead of confirm(), which would block the page.
clearDexButton.addEventListener('click', () => {
  if (!clearConfirmTimeoutId) {
    clearDexButton.classList.add('is-confirming');
    clearDexButton.textContent = 'Tap again to clear';
    clearConfirmTimeoutId = setTimeout(resetClearButton, CLEAR_CONFIRM_MS);
    return;
  }
  resetClearButton();
  clearBattledex();
  renderBattledex();
});

renderBattledex();
