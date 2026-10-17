---
title: DevProof
tagline: Turns a developer's real engineering activity into evidence-backed skills, instead of self-reported claims.
order: 2
badge: co-built
stack: [TypeScript, Node.js, Express, Prisma, PostgreSQL, React, Groq, GitHub Apps, Docker]
repo: https://github.com/kinghardesh/DevProof
demo: ""
metrics:
  - key: commits_30d
    label: Commits (30d)
  - key: last_commit_days
    label: Last commit
    unit: days ago
  - key: tests
    label: Backend tests
diagram:
  - { label: GitHub App, note: "repos + webhooks" }
  - { label: Analysis engine, note: 6 scored categories }
  - { label: Evidence ladder, note: "claimed → learned → proven" }
  - { label: AI insights, note: "Groq, evidence only" }
  - { label: Dashboard, note: React 19 }
---

## The problem

A resume says what a developer *claims* they can do. DevProof asks what **evidence** shows they can do it. It pulls signals from GitHub repositories, LeetCode and GeeksforGeeks profiles, certifications, courses and resumes, and turns them into skills that each trace back to something real.

Built with **Ishaan Saxena**. I led the backend — API, data model, integrations, analysis, scoring, tests and CI; Ishaan led the frontend.

## Architecture

A Node.js + Express + TypeScript API over PostgreSQL (Prisma), a React 19 frontend, and Groq for AI insights.

- **Repository analysis** reads code through the GitHub API and scores six categories — documentation, testing, security, code quality, maintainability and dependency health — into metrics and severity-ranked findings.
- **Skills climb an evidence ladder.** A skill starts as *claimed*, becomes *learned* when a completed course names it, and is *proven* by repository evidence or a certification. Resumes never write skills directly: a resume often describes a team's stack, not the author's own work, so detected tools are reported for the user to confirm.
- **Career readiness** is computed on read from explicit, checkable requirements, so every point in a score traces to one sentence — and a stored score can't go stale.

## The hard decision

**Unavailable data must read as unavailable.** The whole product is about evidence, so it can't fabricate any. A missing score is `null`, not zero. An unanalyzed repo says *Analysis Pending*. If a user has no completed analyses, the AI is **never called** — otherwise it would happily invent plausible strengths. Its responses are forced to JSON and validated with Zod before they reach the UI.

It shaped integrations too. LinkedIn's self-serve API exposes only name, picture and email — no experience or skills — so instead of a half-working connector, the README says plainly why it isn't coming.

## What broke

- **OAuth App vs GitHub App.** Sign-in was first built as an OAuth App. I rebuilt it as a GitHub App so users pick exactly which repositories DevProof may read: authorizing and installing became separate steps, and repos are enumerated per installation.
- **Webhook verification failed open.** A missing or malformed signature was accepted instead of rejected. It now fails closed with a timing-safe HMAC comparison.
- **Unit tests touched the real database.** Fixed by stubbing Prisma in service tests and adding a separate integration suite that runs over real HTTP against its own throwaway database.

## What I'd change

Add CI from the first commit. The migration-drift check and the empty-database migration run caught real problems the moment they were added — they'd have caught them weeks earlier.
