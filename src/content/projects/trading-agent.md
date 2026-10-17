---
title: Trading Agent
tagline: An LLM-assisted paper-trading system where the model can propose trades but never override the risk engine.
order: 1
badge: solo
stack: [Python, FastAPI, PostgreSQL, Redis, Docker, APScheduler, Gemini, Ollama, Alpaca API]
repo: https://github.com/kinghardesh/stockanalysier
demo: ""
metrics:
  - key: trades_30d
    label: Trades (30d)
  - key: breaker
    label: Circuit breaker
  - key: tests
    label: Tests
diagram:
  - { label: Ingestion, note: "quotes, news, SEC filings" }
  - { label: Sanitizer, note: strips prompt injection }
  - { label: LLM orchestrator, note: "Gemini → Ollama" }
  - { label: Risk engine, note: "pure Python, no LLM" }
  - { label: Execution, note: Alpaca bracket orders }
---

## The problem

LLMs are good at reading news and filings, and bad at respecting limits. I wanted to find out what it takes to let a model take part in trading decisions **without ever trusting it with risk**. The rule I built everything around: *risk limits live in code, not in prompts*.

It runs on Alpaca's paper-trading API only. The broker client refuses to start if paper mode is switched off.

## Architecture

Six layers, each one unable to skip the next:

1. **Ingestion** — live quotes over Alpaca's WebSocket, headlines from NewsAPI, 8-K and Form 4 filings from SEC EDGAR.
2. **Sanitization** — news text is scrubbed of imperative phrasing near tickers and known prompt-injection patterns before any model sees it.
3. **LLM orchestrator** — Gemini 2.5 Flash with a local Ollama fallback. Every response must validate against a strict Pydantic schema or it's rejected and logged.
4. **Risk engine** — plain Python: ticker whitelist, market hours, 20% per-ticker and 40% per-sector caps, re-entry cooldowns, and a 3% daily-loss circuit breaker.
5. **Approval router** — low-tier proposals execute automatically; high-conviction ones wait for a human in the dashboard.
6. **Execution** — bracket orders (entry + stop + take-profit), reconciled against the broker's order-update stream.

Capital is split into sleeves: a 50% trend sleeve (SMA 50/200 crosses on index ETFs), a 15% mean-reversion sleeve (RSI(2)), and a 30% LLM-driven discretionary sleeve (since retired — see below), with a cash buffer.

## The hard decision

**Measurement must never be gated by the kill switch.** The kill switch halts everything when the account drops 3% in a day. But the job that records the start-of-day baseline — the number the 3% is measured against — was also behind the kill switch. An active halt blocked the one job that could clear it: a deadlock. I split *protection* from *measurement*: halts stop trading, never bookkeeping.

The second: **I retired my own LLM sleeve.** An audit of the discretionary news-trading sleeve showed it went 0-for-15. The infrastructure around it was sound; the edge wasn't there. I shut it off and moved the news engine to shadow mode, where it records what it *would* do and never executes.

## What broke

- **Positions left naked overnight.** Nine positions lost their protective stops because day-only bracket legs expired at the close, after the stop guard's last check. Fix: good-till-cancelled brackets, plus guard runs at 16:10 and 9:15.
- **A guard that over-protected.** Re-armed stops and surviving bracket legs fired together in a sell-off and over-sold one position into an unintended short. The guard now detects over-coverage as well as under-coverage.
- **The model hallucinated prices.** Gemini proposed stops relative to prices it had made up. Fix: inject live prices into every prompt and clamp absurd stop distances in code.
- **The strategy itself.** In the current validation window the strategy is failing its own go/no-go gate — the stops fire exactly as designed, but the hit rate is far too low. The track record is kept in git, week by week, unedited.

## What I'd change

I'd build the shadow-mode scoreboard first, before any execution path. Every sleeve should prove itself in shadow mode before it touches even the paper account.
