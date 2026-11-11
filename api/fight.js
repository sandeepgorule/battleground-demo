const Anthropic = require('@anthropic-ai/sdk');
const OpenAI = require('openai');
const { judgeFight } = require('../lib/judge');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

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

const ART_STYLE_TEMPLATE = (fighter) =>
  `${fighter}. Bold flat-color illustration, thick black outlines, dynamic action pose, dramatic lighting, video-game character art style. Single subject, centered, filling most of the frame, isolated on a plain solid light-gray background with no scenery. Absolutely no text, words, letters, numbers, logos, watermarks, UI elements, borders, or frames of any kind — illustration only, nothing else on the canvas.`;

async function getImage(fighter) {
  const result = await openai.images.generate({
    model: 'gpt-image-2',
    prompt: ART_STYLE_TEMPLATE(fighter),
    size: '1024x1024',
    quality: 'low',
  });
  return `data:image/png;base64,${result.data[0].b64_json}`;
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

  const [verdictResult, imageAResult, imageBResult] = await Promise.allSettled([
    judgeFight(anthropic, fighterA, fighterB),
    getImage(fighterA),
    getImage(fighterB),
  ]);

  if (verdictResult.status === 'rejected') {
    response.status(502).json({ error: 'verdict_failed', message: "The judges couldn't reach a decision. Try again?" });
    return;
  }

  const failedImage = [imageAResult, imageBResult].find((r) => r.status === 'rejected');
  if (failedImage) {
    const isModerated = failedImage.reason?.code === 'moderation_blocked';
    if (isModerated) {
      response.status(422).json({ error: 'moderation_blocked', message: "One of those fighters got flagged by the content police. Try a different description." });
    } else {
      response.status(502).json({ error: 'image_failed', message: "The artist's pencil broke. Try again?" });
    }
    return;
  }

  response.status(200).json({
    verdict: verdictResult.value,
    imageA: imageAResult.value,
    imageB: imageBResult.value,
  });
};
