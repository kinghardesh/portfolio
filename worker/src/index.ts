import Anthropic from "@anthropic-ai/sdk";
import { SYSTEM_PROMPT } from "./prompt";
import { handleStatus } from "./status";

export interface Env {
  ANTHROPIC_API_KEY?: string;
  STATUS_TOKEN?: string;
  MODEL: string;
  ALLOWED_ORIGINS: string;
  CHAT_LIMITER?: RateLimit;
  STATUS: KVNamespace;
}

const MAX_MESSAGES = 10;
const MAX_CHARS = 1000;
// Models that accept server-side refusal fallbacks; others just return the refusal.
const FALLBACK_MODELS = new Set(["claude-opus-5-5", "claude-opus-5", "claude-sonnet-5-5", "claude-fable-5-1"]);

function corsHeaders(origin: string | null, env: Env): Record<string, string> {
  const allowed = env.ALLOWED_ORIGINS.split(",").map((o) => o.trim());
  if (!origin || !allowed.includes(origin)) return {};
  return {
    "Access-Control-Allow-Origin": origin,
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    "Access-Control-Allow-Headers": "content-type",
    Vary: "Origin",
  };
}

function json(body: unknown, status: number, headers: Record<string, string>) {
  return new Response(JSON.stringify(body), { status, headers: { ...headers, "content-type": "application/json" } });
}

// Accepts only a short, alternating user/assistant history that starts and ends with the user.
function parseMessages(body: unknown): Anthropic.MessageParam[] | null {
  const messages = (body as { messages?: unknown })?.messages;
  if (!Array.isArray(messages) || messages.length === 0 || messages.length > MAX_MESSAGES) return null;
  const out: Anthropic.MessageParam[] = [];
  for (const [i, m] of messages.entries()) {
    const expected = i % 2 === 0 ? "user" : "assistant";
    if (m?.role !== expected || typeof m.content !== "string") return null;
    const content = m.content.trim();
    if (!content || content.length > (expected === "user" ? MAX_CHARS : MAX_CHARS * 4)) return null;
    out.push({ role: expected, content });
  }
  return out.at(-1)!.role === "user" ? out : null;
}

// Streams a canned reply so the site works end to end before an API key is configured.
function mockStream(question: string): ReadableStream<Uint8Array> {
  const reply =
    `**Demo mode** — no API key is configured yet, so this is a canned reply.\n\n` +
    `You asked: "${question.slice(0, 120)}"\n\n` +
    `Once \`ANTHROPIC_API_KEY\` is set, answers will come from the resume and case studies, ` +
    `with links like [Trading Agent](/projects/trading-agent/).`;
  const encoder = new TextEncoder();
  const words = reply.split(/(?<= )/);
  return new ReadableStream({
    async pull(controller) {
      const word = words.shift();
      if (word === undefined) return controller.close();
      await new Promise((r) => setTimeout(r, 25));
      controller.enqueue(encoder.encode(word));
    },
  });
}

async function streamAnswer(
  env: Env,
  messages: Anthropic.MessageParam[],
  writer: WritableStreamDefaultWriter<Uint8Array>,
) {
  const encoder = new TextEncoder();
  const write = (s: string) => writer.write(encoder.encode(s));
  const client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY });
  const useFallbacks = FALLBACK_MODELS.has(env.MODEL);

  try {
    const stream = client.beta.messages.stream({
      model: env.MODEL,
      // Deliberately small: answers are meant to be short, and this caps cost per question.
      max_tokens: 2048,
      output_config: { effort: "low" },
      system: [{ type: "text", text: SYSTEM_PROMPT, cache_control: { type: "ephemeral" } }],
      messages,
      ...(useFallbacks ? { betas: ["server-side-fallback-2026-07-01"], fallbacks: "default" as const } : {}),
    });

    for await (const event of stream) {
      if (event.type === "content_block_delta" && event.delta.type === "text_delta") {
        await write(event.delta.text);
      }
    }

    const final = await stream.finalMessage();
    if (final.stop_reason === "refusal") {
      await write("\n\nSorry, I can't help with that one. Feel free to ask about projects, skills or experience.");
    } else if (final.stop_reason === "max_tokens") {
      await write("…");
    }
  } catch (err) {
    if (err instanceof Anthropic.RateLimitError) {
      console.error("anthropic rate limited", err.status);
      await write("The assistant is busy right now. Please try again in a minute.");
    } else if (err instanceof Anthropic.APIError) {
      console.error("anthropic api error", err.status, err.message);
      await write("Sorry, something went wrong on my end. Please try again, or use the contact links below.");
    } else {
      console.error("chat stream failed", err);
      await write("Sorry, something went wrong on my end. Please try again.");
    }
  } finally {
    await writer.close();
  }
}

export default {
  async fetch(request, env, ctx): Promise<Response> {
    const url = new URL(request.url);
    if (url.pathname === "/status" || url.pathname === "/api/status") return handleStatus(request, env);

    const origin = request.headers.get("Origin");
    const cors = corsHeaders(origin, env);

    if (url.pathname !== "/chat" && url.pathname !== "/api/chat") {
      return json({ error: "Not found" }, 404, cors);
    }
    if (request.method === "OPTIONS") return new Response(null, { status: 204, headers: cors });
    if (request.method !== "POST") return json({ error: "Method not allowed" }, 405, cors);
    if (origin && !cors["Access-Control-Allow-Origin"]) return json({ error: "Origin not allowed" }, 403, {});

    const ip = request.headers.get("CF-Connecting-IP") ?? "unknown";
    if (env.CHAT_LIMITER) {
      const { success } = await env.CHAT_LIMITER.limit({ key: ip });
      if (!success) return json({ error: "Too many questions — try again in a minute." }, 429, cors);
    }

    const messages = parseMessages(await request.json().catch(() => null));
    if (!messages) return json({ error: "Please keep questions under 1,000 characters." }, 400, cors);

    const headers = { ...cors, "content-type": "text/plain; charset=utf-8", "cache-control": "no-store" };

    if (!env.ANTHROPIC_API_KEY) {
      return new Response(mockStream(messages.at(-1)!.content as string), { headers });
    }

    const { readable, writable } = new TransformStream<Uint8Array, Uint8Array>();
    ctx.waitUntil(streamAnswer(env, messages, writable.getWriter()));
    return new Response(readable, { headers });
  },
} satisfies ExportedHandler<Env>;
