---
title: Aegis PM
tagline: A project-management platform where AI agents turn specs into tasks and watch for stalled work, with humans approving every action.
order: 3
badge: solo
stack: [Python, FastAPI, AutoGen, PostgreSQL, Redis, Next.js, Docker, Jira API, Slack API]
repo: https://github.com/kinghardesh/AEGIS-PM
demo: ""
metrics:
  - key: agents_live
    label: Live agents
  - key: checks_24h
    label: Agent checks (24h)
  - key: tests
    label: Tests
diagram:
  - { label: Spec Interpreter, note: "PRD → tasks" }
  - { label: Monitor, note: polls Jira for stale work }
  - { label: HITL approval, note: human in the loop }
  - { label: Communicator, note: Slack alerts }
  - { label: Dashboard, note: Next.js }
---

## The problem

Project managers spend hours turning specs into tickets and chasing work that has quietly stalled. Aegis PM hands both jobs to AI agents — but nothing reaches a person's Slack without a human approving it first.

## Architecture

Agents built with Microsoft AutoGen, behind a FastAPI backend, PostgreSQL with Alembic migrations, and a Next.js dashboard.

- **Spec Interpreter** reads a product requirements document and breaks it into tasks with dependencies and AI-rated weightage.
- **Monitor** polls Jira and flags tasks with no movement, with a cooldown so the same task isn't re-flagged every cycle.
- **HITL Supervisor** — every alert enters an audited state machine (*pending → approved → notified*, or *dismissed*) driven from the dashboard.
- **Communicator** sends approved alerts to Slack.
- **Assignment** routes tasks to teams rather than individuals, shows an assignment-risk indicator, and ranks delivery on a performance scoreboard.

The platform has role-based access, Google and GitHub sign-in, Redis-backed rate limiting, a CSP and an explicit CORS allow-list, and runs in non-root containers.

## The hard decision

**Measure the LLM before changing it.** Before touching the spec parser, I froze a baseline: 20 PRDs across six difficulty tiers — clean, ambiguous, contradictory, incomplete, large, and edge cases like empty input, unicode and prompt injection — each with a hand-reviewed gold label, run 3 times each and scored against a locked rubric.

The numbers were humbling. The same PRD produced the same task *count* in 15 of 20 cases, but the same *dependency structure* in only 6 of 20 — one clean spec gave three different valid topologies across three runs. Without the baseline, any prompt change would have looked like an improvement.

## What broke

- **The eval silently lost data.** A later run overwrote the results directory. The runner now writes every run into a new timestamped batch and never overwrites, and a manifest pins the canonical batch to a git tag.
- **Rate-limit quota blocked runs mid-study.** Five runs came back empty when the API's daily quota ran out. Rather than score them as failures, they were marked, re-run after the reset, and recorded as a separate recovery batch.
- **Pre-launch review.** A security pass found unguarded alert endpoints and injection sinks. Auth is now enforced by default on every alert route, with audit actors recorded on each state change.

## What I'd change

I'd start with people-only assignment. Early versions also assigned work to AI agents, which made the balancer and the UI more complex than anyone needed. I removed it.
