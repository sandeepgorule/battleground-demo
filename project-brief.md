# Battleground - Project Brief

## 1. What are we actually building? (Scope)
A web app where you type in two fighters and get an AI-generated verdict on who'd win, plus AI-generated character art for both.

**Purpose:** a portfolio / demo piece. Polish and a reliable demo matter more than scale.

## 2. What's the smallest, simplest version worth shipping (MVP)?
Two text inputs, a Fight button, a working verdict with art, a loading state while we wait on the API, and a basic BattleDex saved to localStorage. Type two fighters, get a real result, save it if you want.

What's built today:
- Fighter inputs (free text, up to 80 characters each) and a Fight button
- Themed loading state with rotating flavor text
- Pokémon-style VS reveal with the winning portrait highlighted
- AI verdict that always picks a winner (no ties), plus matching character art for both fighters
- "Add to BattleDex" under each portrait; BattleDex gallery page (up to 20 characters, oldest removed first)
- "Last Fight" recap that reopens your most recent result without re-running it

**Done means:** fights finish reliably when run locally with `vercel dev`, and saving to the BattleDex works without storage errors.

## 3. What are we building this with (tech stack)?
HTML, CSS, and vanilla JS for the frontend. Vercel for hosting and a serverless function, which exists to keep the API keys off the browser. Claude's API for the verdict. OpenAI's image API for the character art. localStorage for saving the BattleDex.

Everything is built and tested locally with `vercel dev`; deploying is not part of the current plan.

## 4. What's the long-term vision, beyond just the MVP?
**Phase 2: Re-fight.** Start a quick re-fight using fighters already saved in the BattleDex instead of typing two new ones every time. Saved fighters already have art, so a re-fight between two of them only needs the verdict call, which takes seconds instead of over a minute. Re-fights don't change the BattleDex.

**Phase 3: Share-code sync.** Load your BattleDex on another device with a share code or link, without building login. This needs a small server-side store for each shared BattleDex.

## 5. Details decided so far
- **Rate limiting**: 5 fights per minute per IP, checked before any paid API call. Kept in memory, so it resets when the server restarts.
- **Verdict format**: winner card with animation, plus written reasoning for the win.
- **Character art**: one image per side. Group inputs (e.g. "10 cows vs 10 lions") still get one image per side, not one per unit.
- **BattleDex entries**: one individual fighter each, holding only its label and image. No verdict, opponent or win/loss record is saved.
- **Image storage**: images downsized/compressed client-side (canvas resize to 400x400 + JPEG at 0.85 quality) before saving to localStorage, to stay under browser storage quota.

## 6. Constraints and risks
- **Cost:** every fight makes three paid calls (one verdict, two images). The rate limit slows down a single visitor but doesn't cap total spending.
- **Speed:** a fight takes about 60–75 seconds, almost all of it image generation. Image quality is set to `low` to keep this down.
- **Free-text input:** people will try prompt injection and inappropriate fighters. The verdict prompt treats embedded instructions as just a weird fighter, and flagged image requests show a friendly error.

## 7. What it deliberately won't do (for now)
- No accounts or login
- No ties: every fight has exactly one winner
- No win/loss records: the BattleDex saves fighters, not fight results
- No deployment for now: built and tested locally only
- Quantities like "10 lions" aren't counted exactly; they're passed through to the AI as written

## Open questions
- How does a re-fight start: two saved fighters, one saved fighter against a newly typed one, or both?
