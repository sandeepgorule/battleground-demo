const BATTLEDEX_STORAGE_KEY = 'battledex';
const BATTLEDEX_MAX_ENTRIES = 20;
const BATTLEDEX_IMAGE_MAX_DIM = 400;
const BATTLEDEX_IMAGE_QUALITY = 0.85;

function resizeImageDataUrl(dataUrl, maxDim) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = maxDim;
      canvas.height = maxDim;
      canvas.getContext('2d').drawImage(img, 0, 0, maxDim, maxDim);
      // JPEG over PNG: much smaller, and the art has a solid background so no
      // transparency is lost. Not WebP — canvas WebP encoding isn't supported in
      // every browser (Safari silently falls back to PNG).
      resolve(canvas.toDataURL('image/jpeg', BATTLEDEX_IMAGE_QUALITY));
    };
    img.onerror = reject;
    img.src = dataUrl;
  });
}

function getBattledex() {
  try {
    const raw = localStorage.getItem(BATTLEDEX_STORAGE_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function saveToBattledex({ label, imageDataUrl }) {
  const resized = await resizeImageDataUrl(imageDataUrl, BATTLEDEX_IMAGE_MAX_DIM);
  const dex = getBattledex();
  dex.push({
    id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
    label,
    imageDataUrl: resized,
    savedAt: Date.now(),
  });
  while (dex.length > BATTLEDEX_MAX_ENTRIES) {
    dex.shift();
  }
  // ponytail: count cap doesn't bound bytes (base64 images vary in size), so
  // quota can still be exceeded — evict oldest until it fits or give up.
  while (dex.length > 0) {
    try {
      localStorage.setItem(BATTLEDEX_STORAGE_KEY, JSON.stringify(dex));
      return dex;
    } catch (err) {
      if (err.name !== 'QuotaExceededError' || dex.length === 1) throw err;
      dex.shift();
    }
  }
  throw new Error('Image too large to save.');
}

const LAST_FIGHT_STORAGE_KEY = 'battleground_lastFight';

function saveLastFight({ fighterA, fighterB, imageA, imageB, verdict }) {
  sessionStorage.setItem(
    LAST_FIGHT_STORAGE_KEY,
    JSON.stringify({ fighterA, fighterB, imageA, imageB, verdict, savedA: false, savedB: false })
  );
}

function getLastFight() {
  try {
    const raw = sessionStorage.getItem(LAST_FIGHT_STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function markLastFightSaved(side) {
  const fight = getLastFight();
  if (!fight) return;
  if (side === 'A') fight.savedA = true;
  else fight.savedB = true;
  sessionStorage.setItem(LAST_FIGHT_STORAGE_KEY, JSON.stringify(fight));
}
