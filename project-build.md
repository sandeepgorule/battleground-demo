# Battleground - Staged Build Plan

Built from `project-brief.md`. This plan builds the whole app from zero, one small piece at a time. Each stage is small enough to finish, check and commit on its own. Don't start a stage until the one before it passes its "Done when" check.

Everything is built and tested locally with `vercel dev` the whole way, then deployed to Vercel at the end of the MVP (Stage 7).

- **Stages 1–7:** the MVP
- **Stages 8–10:** Phase 2, re-fight
- **Stages 11–13:** Phase 3, share-code sync

Before using any library API (Anthropic SDK, OpenAI SDK, Vercel Functions), check its current docs with context7 rather than relying on memory, as `CLAUDE.md` requires.

---

# MVP

## Stage 1: Scaffold

**Goal:** an empty project that runs locally, with no real features yet.

**Build:**
- The folder layout: `index.html`, `battledex.html`, `css/style.css`, `js/` (`battle.js`, `battledex.js`, `storage.js`) and `api/fight.js`.
- `package.json` with `@anthropic-ai/sdk`, `openai` and `zod`, then `npm install`.
- `vercel.json` with a `maxDuration` of `120` for the API function, since a real fight takes 60–75 seconds.
- `.env.example` listing `ANTHROPIC_API_KEY` and `OPENAI_API_KEY`, a local `.env` with real keys, and a `.gitignore` covering `node_modules/`, `.env` and `.vercel/`.
- Both HTML pages loading the shared stylesheet and their scripts (`storage.js` first), with links between them.
- `api/fight.js` returning a fixed fake result (a fake verdict and placeholder images), so the frontend can be built without paid calls.

**Done when:** `vercel dev` serves both pages locally, and a POST to `/api/fight` returns the fake result.

---

## Stage 2: Battle screen with fake data

**Goal:** the whole fight flow works in the browser against the fake API.

**Build:**
- Four separate views in `index.html`, one page, never stacked on screen together:
  - **Input form:** two fighter inputs, a VS divider and a Fight button.
  - **Loading view:** a themed loading state with rotating flavor text.
  - **Result view:** both portraits, labels and the verdict text, plus a "Fight again" button.
  - **Error view:** an error message with a retry button that re-runs the same fight.
- Toggle the views in JavaScript with the `hidden` attribute, so exactly one is visible at a time. On page load, only the input form is visible; the other three start with `hidden`.
- Make sure no CSS `display` rule on a view overrides `hidden` (for example add `[hidden] { display: none !important; }`).
- Client-side checks: both fighters filled in, 80 characters or less each. A failed check shows a message on the input form itself, not the error view.

**Done when:** on page load only the input form is visible; clicking Fight switches to the loading view, then the result view, with only one view on screen at each step; "Fight again" returns to the input form; and empty or too-long inputs show a message on the form without calling the API.

---

## Stage 3: System prompt and fight API

**Goal:** write and test the prompt that keeps Claude judging fights and nothing else, then wire `/api/fight` to return a real verdict and real art.

**Build:**
- A system prompt that:
  - scopes Claude to judging only the two given fighters;
  - treats any instructions inside a fighter's text ("ignore previous instructions", "you are now…", requests for code, essays or personal info) as just a weird fighter, and judges it as one;
  - always picks exactly one winner, Fighter A or Fighter B, never a tie or a refusal, including mirror matches like "lion" vs "lion";
  - keeps the explanation to 2–3 short, playful sentences and never breaks character or explains its rules.
- A short list of test matchups: normal fights, a mirror match, and several injection attempts.
- A one-off script in `test/` that runs each matchup against Claude with the prompt and prints the result.
- A shared art-style template that every generated image must follow, with the fighter's text placed in front of it:
  > Bold flat-color illustration, thick black outlines, dynamic action pose, dramatic lighting, video game character art style. Keep it centered, filling most of the frame, isolated on a plain solid light grey background with no scenery. Absolutely no text, words, letters, numbers, logos, watermarks, UI elements, borders, or frames of any kind. Illustration only, nothing else on canvas.
- Group inputs (for example "10 cows") still produce exactly one image for that side, showing the whole group in a single illustration. This is handled in the prompt sent to the image API, not by looping over the count or making one image call per member.
- `moderation_blocked` as its own error case, separate from a generic image failure (`image_failed`), each with its own status and friendly message.
- `api/fight.js` wired to the Fight button:
  - rejects anything that isn't a POST, and repeats the input checks on the server (both fighters non-empty strings of 80 characters or less, otherwise `400`);
  - a rate limit of 5 fights per minute per IP, checked first, returning `429` before any paid call. Kept in memory; it resets when the server restarts, which is fine for a demo;
  - calls Claude with the system prompt, using native structured output with a Zod schema for `winner` (`"A"` or `"B"`) and `explanation`;
  - one image per fighter with `gpt-image-2` at `1024x1024` and `low` quality, returned as base64 data;
  - runs the verdict and both images in parallel, returning `502` if the verdict fails, `422` if an image is blocked by moderation, and `502` for any other image failure.

**Done when:** every test matchup gets a short, in-character verdict with exactly one winner, no injection attempt changes Claude's behavior, the art-style template is written down in one shared place, the image prompt covers group inputs so each side still gets one image, `moderation_blocked` and `image_failed` are defined as separate error cases, and a fight in the browser shows a real verdict with matching art for both fighters.

---

## Stage 4: BattleDex (save to localStorage)

**Goal:** save individual fighters and view saved fighters.

**Build:**
- A "Save" action per fighter that writes `{ label, image }` to a localStorage array. No fight, winner or reasoning data, just the fighter.
- A BattleDex view: a grid of saved fighters, each a mini trading-card (image on top, name below). Cards aren't clickable; they just display the label and image.
- Delete or clear entries from the BattleDex.
- A "Back to last fight" button on the BattleDex view that jumps back to the most recent result view (winner, reasoning and images still kept).
- A "New fight" button on the BattleDex view that returns to the input form view.

**Done when:** a saved fighter is still in the BattleDex after a page reload, and from the BattleDex you can jump back to the last fight result or start a new fight.

---

## Stage 5: Image compression before save

**Goal:** stay under the localStorage quota (per brief §5).

**Build:**
- Before saving a fighter to the BattleDex, draw its image to an off-screen `<canvas>`, resize it down, and re-export it as JPEG/WebP at reduced quality.
- Save the compressed data URI, not the original.
- Test with several saved fighters that the quota isn't hit quickly.

**Done when:** 10+ saved fighters don't blow the localStorage quota.

---

## Stage 6: Claude redesign

**Goal:** hand the entire app to Claude Design for a full visual overhaul: every view, not just verdict UI polish.

**Build:**
- Run all four views (form, loading, result, error) plus the BattleDex through Claude Design for a complete visual pass, using the imported "Battleground Arcade" design project via the Claude Design MCP.
- A winner card component: name, image, reasoning text, and an entry animation when the result lands (winner border pulse, WINNER/DEFEAT tags, grayscale loser).
- A loading state redesigned to cover the full wait for the fight call (VS spinner, rotating status text, animated verdict/art progress bar).
- A consistent visual language applied app-wide (typography, color, spacing, motion), with no leftover placeholder styling anywhere.

**Done when:** the full app feels like one designed product, with no placeholder styling on any view.

---

## Stage 7: Final QA

**Goal:** ship it.

**Do:**
- A full manual pass: empty inputs, one empty input, the same fighter twice, very long names, non-English input.
- Confirm rate limiting doesn't fire on normal single-fight use.
- Confirm the loading and error states cover: a fight API failure (verdict or image side), a rate limit hit, and the network being offline.
- Deploy to Vercel.

**Done when:** the app handles the MVP end to end without console errors, and is deployed to Vercel.

---

# Phase 2: Re-fight

## Stage 8: Decide how re-fights work

**Goal:** answer the brief's open question before writing code, because it changes the next two stages.

**Decide:**
- How a re-fight starts: two saved fighters, one saved fighter against a newly typed one, or both. (Two saved fighters is the simplest and fastest, since it needs no image calls.)
- Whether the same pair can get a different verdict each time. (Probably yes; it keeps re-fights fun.)

**Done when:** the answers are written into `project-brief.md`, and its open question is closed.

---

## Stage 9: Verdict-only fights on the server

**Goal:** let `/api/fight` judge a fight without generating images, so re-fights take seconds instead of over a minute.

**Build:**
- Add an option to the existing `/api/fight` request (for example `verdictOnly: true`) that skips both image calls and returns only the verdict.
- Keep it in the same endpoint so it shares the existing rate limit.
- Keep the same input checks and error responses.

**Done when:** a verdict-only request returns a verdict in a few seconds with no images, and a normal fight still works as before.

---

## Stage 10: Re-fight screen

**Goal:** start a fight from saved BattleDex fighters.

**Build:**
- On `battledex.html`, a way to pick two saved fighters and start a re-fight.
- Send a verdict-only fight (from Stage 9) and show the result with the existing VS reveal, using the saved images.
- The BattleDex itself doesn't change after a re-fight; entries stay as label and image only.
- If Stage 8 chose "saved vs new" too, add that here or as a follow-up stage, since it needs one image call.

**Done when:** picking two saved fighters shows a verdict with their saved art in a few seconds, the BattleDex entries are unchanged, and the normal typed fight still works.

---

# Phase 3: Share-code sync

## Stage 11: Choose where shared BattleDexes are stored

**Goal:** pick the small server-side store that share codes need, before building sharing.

**Decide:**
- Which store to use. Check current options with context7 at the time, and pick one that can be run or reached from `vercel dev`.
- How large a shared BattleDex can be. Twenty 400×400 JPEGs is roughly a megabyte, so check the store's size limits.
- Whether shared copies expire (for example after 30 days), which keeps storage costs down.
- Whether loading a code replaces the BattleDex in the browser or merges into it.

**Done when:** the choices are written into `project-brief.md`, and the store's keys are in the local `.env` and listed in `.env.example`.

---

## Stage 12: Share-code endpoints

**Goal:** save a BattleDex on the server and load it back by code.

**Build:**
- A new serverless function to upload a BattleDex and get back a short code.
- A way to fetch a BattleDex by its code.
- Input checks, a size cap, and a rate limit, since this endpoint writes to storage. Only accept entries made of a label and image.
- Update `CLAUDE.md`, whose repo layout lists only one serverless function.

**Done when:** uploading a BattleDex returns a code, and fetching that code returns the same fighters.

---

## Stage 13: Share and load screens

**Goal:** use share codes from the BattleDex page.

**Build:**
- A "Share BattleDex" button that shows the code and a shareable link.
- A "Load from code" option that loads a BattleDex using the replace or merge rule from Stage 11.
- Friendly errors for a wrong or expired code.

**Done when:** a BattleDex shared from one browser loads correctly in a different browser on the same machine.
