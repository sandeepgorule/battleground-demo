const Anthropic = require('@anthropic-ai/sdk');
const { judgeFight } = require('../lib/judge');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MAX_FIGHTER_LENGTH = 80;
const RATE_LIMIT_MAX = 5;
const RATE_LIMIT_WINDOW_MS = 60 * 1000;

// ponytail: in-memory Map resets on cold start, fine for a demo; swap for a
// shared store (Upstash/Redis) if this ever needs to survive across instances.
const requestLog = new Map();

function isAllowed(ip) {
  const now = Date.now();
  const recent = (requestLog.get(ip) || []).filter((t) => now - t < RATE_LIMIT_WINDOW_MS);
  if (recent.length >= RATE_LIMIT_MAX) {
    requestLog.set(ip, recent);
    return false;
  }
  recent.push(now);
  requestLog.set(ip, recent);
  return true;
}

// Placeholder art until Stage 6 wires in real image generation. Used by both
// the real verdict path and fake mode, so the result view always has images.
function placeholderImage(letter, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="480" fill="#fff" text-anchor="middle" dominant-baseline="central">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

const PLACEHOLDER_A = placeholderImage('A', '#d64545');
const PLACEHOLDER_B = placeholderImage('B', '#3b6fd6');

// Fake mode (FAKE_FIGHT=1): returns a fixed result with no paid API calls, so
// the UI can be tested for free. The short delay keeps the loading view on
// screen long enough to see.
const FAKE_FIGHT_DELAY_MS = 1500;

async function getFakeFight() {
  await new Promise((resolve) => setTimeout(resolve, FAKE_FIGHT_DELAY_MS));
  return {
    verdict: { winner: 'A', explanation: 'Fake mode: Fighter A wins by default. No AI was harmed in this fight.' },
    imageA: PLACEHOLDER_A,
    imageB: PLACEHOLDER_B,
  };
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const ip = (request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (!isAllowed(ip)) {
    response.status(429).json({ error: 'rate_limited', message: "Whoa, slow down champ — catch your breath and try again in a bit." });
    return;
  }

  const { fighterA, fighterB } = request.body || {};
  if (
    typeof fighterA !== 'string' ||
    typeof fighterB !== 'string' ||
    !fighterA.trim() ||
    !fighterB.trim() ||
    fighterA.length > MAX_FIGHTER_LENGTH ||
    fighterB.length > MAX_FIGHTER_LENGTH
  ) {
    response.status(400).json({ error: 'invalid_input', message: 'Give both fighters a name (80 characters or less).' });
    return;
  }

  if (process.env.FAKE_FIGHT === '1') {
    response.status(200).json(await getFakeFight());
    return;
  }

  let verdict;
  try {
    verdict = await judgeFight(anthropic, fighterA, fighterB);
  } catch (error) {
    console.error('Verdict call failed:', error);
    response.status(502).json({ error: 'verdict_failed', message: "The judges couldn't reach a decision. Try again?" });
    return;
  }

  response.status(200).json({ verdict, imageA: PLACEHOLDER_A, imageB: PLACEHOLDER_B });
};
