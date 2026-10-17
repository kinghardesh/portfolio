import type { Env } from "./index";

// GET  /status  public, read by the dashboard
// PUT  /status  private, called by scripts/publish-status.mjs with the STATUS_TOKEN bearer
//
// The PUT body is rebuilt field by field against this whitelist, so even a buggy or
// compromised publisher can't get arbitrary data (or anything sensitive) onto the public page.

const KEY = "status";
const PROJECTS = ["trading-agent", "aegis-pm", "devproof"] as const;
const STATES = new Set(["up", "idle", "down"]);
const NUMERIC = ["tests", "trades_30d", "agents_live", "checks_24h", "commits_30d", "last_commit_days"];
const BREAKER = new Set(["armed", "tripped", "unknown"]);

const PUBLIC_HEADERS = {
  "content-type": "application/json",
  "access-control-allow-origin": "*",
  "cache-control": "public, max-age=60",
};

type ProjectStatus = Record<string, string | number>;

function sanitize(body: unknown): Record<string, ProjectStatus> | null {
  const projects = (body as { projects?: Record<string, Record<string, unknown>> })?.projects;
  if (!projects || typeof projects !== "object") return null;
  const out: Record<string, ProjectStatus> = {};
  for (const slug of PROJECTS) {
    const p = projects[slug];
    if (!p || typeof p !== "object") continue;
    const clean: ProjectStatus = {};
    if (typeof p.state === "string" && STATES.has(p.state)) clean.state = p.state;
    if (typeof p.label === "string") clean.label = p.label.slice(0, 32);
    if (typeof p.breaker === "string" && BREAKER.has(p.breaker)) clean.breaker = p.breaker;
    for (const k of NUMERIC) {
      const v = p[k];
      if (typeof v === "number" && Number.isFinite(v) && v >= 0 && v < 1e7) clean[k] = Math.round(v);
    }
    out[slug] = clean;
  }
  return out;
}

function timingSafeEqual(a: string, b: string) {
  const enc = new TextEncoder();
  const x = enc.encode(a);
  const y = enc.encode(b);
  if (x.length !== y.length) return false;
  return crypto.subtle.timingSafeEqual(x, y);
}

export async function handleStatus(request: Request, env: Env): Promise<Response> {
  if (request.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: { ...PUBLIC_HEADERS, "access-control-allow-methods": "GET" } });
  }

  if (request.method === "GET") {
    const stored = await env.STATUS.get(KEY);
    const body = stored ?? JSON.stringify({ mode: "live", updated: null, projects: {} });
    return new Response(body, { headers: PUBLIC_HEADERS });
  }

  if (request.method === "PUT") {
    const auth = request.headers.get("authorization") ?? "";
    if (!env.STATUS_TOKEN || !timingSafeEqual(auth, `Bearer ${env.STATUS_TOKEN}`)) {
      return new Response("Unauthorized", { status: 401 });
    }
    if (Number(request.headers.get("content-length") ?? 0) > 8192) return new Response("Too large", { status: 413 });

    const projects = sanitize(await request.json().catch(() => null));
    if (!projects) return new Response("Bad payload", { status: 400 });

    // The server clock, not the publisher's, decides freshness.
    const record = { mode: "live", updated: new Date().toISOString(), projects };
    await env.STATUS.put(KEY, JSON.stringify(record));
    return new Response(null, { status: 204 });
  }

  return new Response("Method not allowed", { status: 405 });
}
