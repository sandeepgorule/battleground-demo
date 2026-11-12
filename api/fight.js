const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { judgeFight } = require('../lib/judge');
const { generateFighterImage, isModerationBlocked } = require('../lib/art');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

const MAX_FIGHTER_LENGTH = 50;
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

// Fake mode (FAKE_FIGHT=1): returns a fixed result with placeholder art and no
// paid API calls, so the UI can be tested for free. The short delay keeps the
// loading view on screen long enough to see.
const FAKE_FIGHT_DELAY_MS = 1500;

function placeholderImage(letter, color) {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024"><rect width="100%" height="100%" fill="${color}"/><text x="50%" y="50%" font-family="sans-serif" font-size="480" fill="#fff" text-anchor="middle" dominant-baseline="central">${letter}</text></svg>`;
  return `data:image/svg+xml;base64,${Buffer.from(svg).toString('base64')}`;
}

async function getFakeFight() {
  await new Promise((resolve) => setTimeout(resolve, FAKE_FIGHT_DELAY_MS));
  return {
    verdict: { winner: 'A', explanation: 'Fake mode: Fighter A wins by default. No AI was harmed in this fight.' },
    imageA: placeholderImage('A', '#d64545'),
    imageB: placeholderImage('B', '#3b6fd6'),
  };
}

module.exports = async (request, response) => {
  if (request.method !== 'POST') {
    response.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const ip = (request.headers['x-forwarded-for'] || 'unknown').split(',')[0].trim();
  if (!isAllowed(ip)) {
    response.status(429).json({ error: 'rate_limited', message: "Easy there, champ! The arena allows five fights a minute, and you've hit the bell. Catch your breath and step back in shortly." });
    return;
  }

  const { fighterA, fighterB } = request.body || {};
  if (typeof fighterA !== 'string' || typeof fighterB !== 'string' || !fighterA.trim() || !fighterB.trim()) {
    response.status(400).json({ error: 'missing_fighter', message: "Both corners need a fighter before the bell rings!" });
    return;
  }
  if (fighterA.length > MAX_FIGHTER_LENGTH || fighterB.length > MAX_FIGHTER_LENGTH) {
    response.status(400).json({ error: 'fighter_too_long', message: "That's the limit, champ! Fighter names max out at 50 characters so they fit on the fight poster." });
    return;
  }

  if (process.env.FAKE_FIGHT === '1') {
    response.status(200).json(await getFakeFight());
    return;
  }

  const [verdictResult, imageAResult, imageBResult] = await Promise.allSettled([
    judgeFight(anthropic, fighterA, fighterB),
    generateFighterImage(openai, fighterA),
    generateFighterImage(openai, fighterB),
  ]);

  if (verdictResult.status === 'rejected') {
    console.error('Verdict call failed:', verdictResult.reason);
    response.status(502).json({ error: 'verdict_failed', message: "The judges stormed out of the arena mid-match! No ruling this round. Hit Try Again to drag them back." });
    return;
  }

  const imageErrors = [imageAResult, imageBResult].filter((r) => r.status === 'rejected').map((r) => r.reason);
  if (imageErrors.some(isModerationBlocked)) {
    response.status(422).json({ error: 'moderation_blocked', message: "Red card! The ring officials won't let one of those fighters through the gates. Send in a different contender." });
    return;
  }
  if (imageErrors.length) {
    console.error('Image call failed:', imageErrors[0]);
    response.status(502).json({ error: 'image_failed', message: "Our ringside artist fainted before finishing the portraits! Run it back and we'll get them a fresh sketchpad." });
    return;
  }

  response.status(200).json({
    verdict: verdictResult.value,
    imageA: imageAResult.value,
    imageB: imageBResult.value,
  });
};
