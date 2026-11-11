// Shared art-style template for every generated fighter image, so all
// characters look like they belong to the same game.

const IMAGE_MODEL = 'gpt-image-2';

const ART_STYLE =
  'Bold flat-color illustration, thick black outlines, dynamic action pose, dramatic lighting, video game character art style. Keep it centered, filling most of the frame, isolated on a plain solid light grey background with no scenery. Absolutely no text, words, letters, numbers, logos, watermarks, UI elements, borders, or frames of any kind. Illustration only, nothing else on canvas.';

// Group inputs ("10 cows") get one image of the whole group, handled here in
// the prompt rather than by making one image call per member.
const GROUP_RULE =
  'If the fighter is a group or a number of things, draw the whole group together in this single illustration.';

function buildImagePrompt(fighter) {
  return `Fighter: ${fighter}\n${GROUP_RULE}\n${ART_STYLE}`;
}

async function generateFighterImage(openai, fighter) {
  const result = await openai.images.generate({
    model: IMAGE_MODEL,
    prompt: buildImagePrompt(fighter),
    size: '1024x1024',
    quality: 'low',
  });
  return `data:image/png;base64,${result.data[0].b64_json}`;
}

function isModerationBlocked(error) {
  return error?.code === 'moderation_blocked';
}

module.exports = { IMAGE_MODEL, ART_STYLE, buildImagePrompt, generateFighterImage, isModerationBlocked };
