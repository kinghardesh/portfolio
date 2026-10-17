# Portfolio v1

Astro static site + a Cloudflare Worker that powers the "Ask anything" chat with Claude.

```
src/data/profile.json        ← your name, pitch, links, experience, skills, chat starter questions
src/content/projects/*.md    ← one case study per project (frontmatter drives the dashboard tile + diagram)
knowledge/faq.md             ← extra facts only the chat knows (work preferences, FAQs)
public/status.json           ← dashboard numbers (sample data for now)
public/resume.pdf            ← placeholder — replace with your real resume
worker/                      ← the chat backend (holds the API key, rate limits, streams answers)
```

## Run locally

```bash
npm install
npm run dev                          # site on http://localhost:4321
```

In a second terminal:

```bash
cd worker
npm install
cp .dev.vars.example .dev.vars       # add ANTHROPIC_API_KEY, or leave empty for demo mode
npm run dev                          # chat on http://localhost:8787
```

With no API key the chat runs in **demo mode** and streams a canned reply, so you can work on the UI for free.

## Filling in your content

1. Edit `src/data/profile.json`. Search the repo for `PLACEHOLDER` to find everything left.
2. Write the case studies in `src/content/projects/`. Add a project by adding a `.md` file with the same frontmatter shape.
3. Add 20–30 s demo clips under `public/demos/` and set `demo: /demos/name.mp4` in the frontmatter.
4. Replace `public/resume.pdf`. Delete `public/og.png` and run `npm run assets` to regenerate the link-preview image with your name.
5. Fill `knowledge/faq.md`. **Anything in profile.json, the case studies or faq.md is sent to the chat model, and a determined visitor can get it out.** Keep private details out of all three.

The chat's knowledge base is rebuilt from these files automatically every time you run or deploy the worker.

## Live dashboard

The systems run in Docker on this PC, so the public site can't reach them. Instead a **push**:

```
publish-status.mjs (this PC, every 5 min) ──PUT + token──▶ worker /status (KV) ◀──GET── dashboard
```

- `scripts/publish-status.mjs` reads health endpoints, runs read-only `SELECT`s inside the Postgres containers, and counts tests and commits in each repo.
- The worker rebuilds every push field by field against a whitelist (`worker/src/status.ts`), so nothing outside it, such as balances or keys, can reach the public page, even by mistake.
- The worker stamps the time itself. If no push arrives for 20 minutes the dashboard shows **Offline · last seen …** instead of stale green lights.
- Without `PUBLIC_STATUS_URL` the site falls back to the hand-updated snapshot in `public/status.json`.

Each project's frontmatter `metrics[].key` maps to a field in the payload. To add a metric, add it to the collector, to `NUMERIC` in `worker/src/status.ts`, and to the frontmatter.

**Local:** copy `.env.status.example` to `.env.status` and put the same `STATUS_TOKEN` in `worker/.dev.vars`. Then:

```bash
npm run status:dry      # print what would be pushed
npm run status          # push once
npm run status:watch    # push every 5 minutes
```

**Production:** after deploying the worker (below), set `STATUS_PUSH_URL` in `.env.status` to `https://<worker>/status`. A Windows scheduled task, **Portfolio status push**, runs `scripts/publish-status-hidden.vbs` every 5 minutes and at log-on, with no console window. The last run's output is in `logs/status-last.log`. Remove it with `Unregister-ScheduledTask -TaskName "Portfolio status push"` (PowerShell).

## Deploy

**Chat worker**

```bash
cd worker
npx wrangler kv namespace create STATUS     # paste the printed id into wrangler.jsonc
npx wrangler secret put ANTHROPIC_API_KEY
npx wrangler secret put STATUS_TOKEN        # same value as in ../.env.status
npm run deploy
```

Before deploying, set `ALLOWED_ORIGINS` in `worker/wrangler.jsonc` to your real domain, and set a monthly spend limit in the Anthropic console.

**Site** (Cloudflare Pages or any static host): build command `npm run build`, output `dist/`. Set these env vars:

| Variable | Value |
|---|---|
| `PUBLIC_CHAT_URL` | Your worker URL + `/chat`, e.g. `https://portfolio-chat.you.workers.dev/chat` |
| `PUBLIC_STATUS_URL` | Your worker URL + `/status` for the live dashboard |
| `PUBLIC_CF_ANALYTICS_TOKEN` | Optional — Cloudflare Web Analytics token (cookie-free) |

Also set `siteUrl` in `profile.json` so canonical URLs and link previews are correct.

## Chat model and cost

The worker defaults to `claude-opus-5-5` at low effort, with prompt caching on the knowledge base and server-side refusal fallbacks. For a much cheaper, faster assistant, set `MODEL` in `worker/wrangler.jsonc` to `claude-haiku-5-5`. Guardrails: per-IP limit of 10 questions/minute, 1,000-character questions, 10-message history, short answers, origin allow-list.

## Note on long paths (Windows)

If `npm run build` fails with `spawn ... esbuild.exe ENOENT`, the project path is too long for Windows (260-character limit). Move the project to a shorter path such as `C:\code\portfolio`.
