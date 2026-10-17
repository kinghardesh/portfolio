// Collects read-only stats from the three local systems and pushes them to the chat worker,
// which serves them to the public dashboard. Nothing on this machine is exposed to the internet.
//
//   node --env-file=.env.status scripts/publish-status.mjs            push once
//   node --env-file=.env.status scripts/publish-status.mjs --watch    push every 5 minutes
//   node scripts/publish-status.mjs --dry-run                         print the payload, push nothing
//
// PRIVACY: only the fields built in collect*() below leave this machine. Health endpoints
// return more (e.g. the trading account's buying power) — never spread a response object
// into the payload; copy individual whitelisted fields only.
import { execFile } from "node:child_process";
import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { promisify } from "node:util";

const run = promisify(execFile);

const CONFIG = {
  trading: {
    api: process.env.TRADING_API ?? "http://localhost:8001",
    db: process.env.TRADING_DB_CONTAINER ?? "trading_agent-postgres-1",
    repo: process.env.TRADING_REPO ?? "C:/Users/hp/trading_agent",
  },
  aegis: {
    api: process.env.AEGIS_API ?? "http://localhost:8000",
    db: process.env.AEGIS_DB_CONTAINER ?? "aegis_postgres",
    repo: process.env.AEGIS_REPO ?? "C:/Users/hp/OneDrive/python/aegis-pm",
  },
  devproof: {
    repo: process.env.DEVPROOF_REPO ?? "C:/Users/hp/OneDrive/python/DevProof",
  },
};
const INTERVAL_MS = 5 * 60 * 1000;

async function getJson(url) {
  const res = await fetch(url, { signal: AbortSignal.timeout(8000) });
  if (!res.ok) throw new Error(`${url} → ${res.status}`);
  return res.json();
}

// Runs a read-only query inside a Postgres container using its own credentials.
async function psql(container, sql) {
  const { stdout } = await run(
    "docker",
    ["exec", "-e", `Q=${sql}`, container, "sh", "-c", 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -tAc "$Q"'],
    { timeout: 15000 },
  );
  return stdout.trim().split("|");
}

async function git(repo, args) {
  const { stdout } = await run("git", ["-C", repo, ...args], { timeout: 15000 });
  return stdout.trim();
}

// Counts test cases by scanning test files, so the number tracks the repo without running anything.
function countTests(dir, pattern, fileFilter) {
  let n = 0;
  const walk = (d) => {
    for (const name of readdirSync(d)) {
      if (name === "node_modules" || name.startsWith(".") || name === "__pycache__") continue;
      const p = join(d, name);
      if (statSync(p).isDirectory()) walk(p);
      else if (fileFilter(name)) n += (readFileSync(p, "utf8").match(pattern) ?? []).length;
    }
  };
  walk(dir);
  return n;
}
const pyTests = (repo) => countTests(join(repo, "tests"), /^\s*(?:async\s+)?def test_/gm, (f) => f.endsWith(".py"));

async function collectTrading() {
  const { api, db, repo } = CONFIG.trading;
  const out = { state: "down", label: "offline", tests: pyTests(repo) };
  try {
    const health = await getJson(`${api}/health`);
    if (health.status !== "ok") return out;
    const deep = await getJson(`${api}/health/deep`);
    const [trades30d] = await psql(db, "select count(*) from trades where opened_at > now() - interval '30 days'");
    out.state = "up";
    out.label = "paper trading";
    out.trades_30d = Number(trades30d);
    out.breaker = deep.kill_switch_active === true ? "tripped" : deep.kill_switch_active === false ? "armed" : "unknown";
  } catch (e) {
    console.warn("trading:", e.message);
  }
  return out;
}

async function collectAegis() {
  const { api, db, repo } = CONFIG.aegis;
  const out = { state: "down", label: "offline", tests: pyTests(repo) };
  try {
    const health = await getJson(`${api}/health`);
    if (health.status !== "ok") return out;
    const [live, checks] = await psql(
      db,
      "select count(distinct agent_name) filter (where recorded_at > now() - interval '15 minutes' and outcome = 'success'), " +
        "count(*) filter (where recorded_at > now() - interval '24 hours') from agent_heartbeats",
    );
    out.agents_live = Number(live);
    out.checks_24h = Number(checks);
    out.state = out.agents_live > 0 ? "up" : "idle";
    out.label = out.agents_live > 0 ? `${out.agents_live} agents live` : "agents idle";
  } catch (e) {
    console.warn("aegis:", e.message);
  }
  return out;
}

async function collectDevproof() {
  const { repo } = CONFIG.devproof;
  const out = {
    state: "idle",
    label: "idle",
    tests: countTests(join(repo, "Backend", "test"), /\b(?:test|it)\(['"`]/g, (f) => /\.test\.[jt]s$/.test(f)),
  };
  try {
    const commits = await git(repo, ["rev-list", "--count", "--since=30.days", "HEAD"]);
    const lastTs = Number(await git(repo, ["log", "-1", "--format=%ct"]));
    out.commits_30d = Number(commits);
    out.last_commit_days = Math.floor((Date.now() / 1000 - lastTs) / 86400);
    if (out.last_commit_days <= 14) {
      out.state = "up";
      out.label = "in development";
    }
  } catch (e) {
    console.warn("devproof:", e.message);
  }
  return out;
}

async function collect() {
  const [trading, aegis, devproof] = await Promise.all([collectTrading(), collectAegis(), collectDevproof()]);
  return { projects: { "trading-agent": trading, "aegis-pm": aegis, devproof } };
}

async function push(payload) {
  const url = process.env.STATUS_PUSH_URL;
  const token = process.env.STATUS_TOKEN;
  if (!url || !token) throw new Error("Set STATUS_PUSH_URL and STATUS_TOKEN (see .env.status.example)");
  const res = await fetch(url, {
    method: "PUT",
    headers: { authorization: `Bearer ${token}`, "content-type": "application/json" },
    body: JSON.stringify(payload),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`push failed: ${res.status} ${await res.text()}`);
}

async function once() {
  const payload = await collect();
  if (process.argv.includes("--dry-run")) {
    console.log(JSON.stringify(payload, null, 2));
    return;
  }
  await push(payload);
  const summary = Object.entries(payload.projects).map(([k, v]) => `${k}=${v.state}`).join(" ");
  console.log(`${new Date().toISOString()} pushed ${summary}`);
}

if (process.argv.includes("--watch")) {
  for (;;) {
    await once().catch((e) => console.error(new Date().toISOString(), e.message));
    await new Promise((r) => setTimeout(r, INTERVAL_MS));
  }
} else {
  await once().catch((e) => {
    console.error(e.message);
    process.exit(1);
  });
}
