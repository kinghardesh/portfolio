// Answers for the chat while it runs without AI ("faq" mode).
// Each intent matches on keywords; the highest-scoring intent wins. Starter questions match exactly.
// Keep answers short and link to the case study for depth. Edit freely — this is the chat's whole brain.
import profile from "./profile.json";
import { links } from "./links";

const first = profile.name.split(" ")[0];

export interface Intent {
  id: string;
  /** Exact questions (starter chips) that map straight to this intent. */
  questions?: string[];
  /** Lower-case words or phrases; each hit adds to the score. Phrases count double. */
  keywords: string[];
  answer: string;
  /** General intents (greetings, "who are you") only win when no specific topic matched. */
  generic?: boolean;
  /** Up to three follow-up chips shown after the answer. */
  followups?: string[];
}

const Q = {
  hardest: profile.chatStarters[0],
  risk: profile.chatStarters[1],
  devproof: profile.chatStarters[2],
  hiring: profile.chatStarters[3],
  aegis: `What is Aegis PM?`,
  stack: `What's ${first}'s tech stack?`,
  contact: `How do I contact ${first}?`,
  ai: `How does ${first} use AI?`,
};

export const intents: Intent[] = [
  {
    id: "hardest",
    questions: [Q.hardest],
    keywords: ["hardest", "difficult", "challenge", "challenging", "problem", "proud", "toughest", "bug", "broke"],
    answer:
      `A good example is the kill-switch deadlock in the [Trading Agent](/projects/trading-agent/). ` +
      `The kill switch halts trading after a 3% daily loss — but the job that recorded the start-of-day baseline was *also* behind the kill switch, ` +
      `so an active halt blocked the one job that could clear it.\n\n` +
      `${first} split **protection** from **measurement**: halts stop trading, never bookkeeping. ` +
      `The case study lists the other things that broke and how each was fixed.`,
    followups: [Q.risk, Q.aegis, Q.stack],
  },
  {
    id: "risk",
    questions: [Q.risk],
    keywords: ["trading", "trade", "risk", "stock", "stop", "kill switch", "alpaca", "gemini", "market", "agent safe", "loss"],
    answer:
      `The rule is **risk limits live in code, not in prompts**. In the [Trading Agent](/projects/trading-agent/) the LLM can only *propose* trades:\n` +
      `- News is scrubbed of prompt-injection patterns before any model sees it\n` +
      `- Every model reply must pass a strict schema or it's rejected\n` +
      `- A pure-Python risk engine enforces ticker, sector and daily-loss limits\n` +
      `- High-conviction trades wait for a human to approve them\n\n` +
      `It runs on paper money only — the broker client refuses to start otherwise.`,
    followups: [Q.hardest, Q.ai, Q.devproof],
  },
  {
    id: "devproof",
    questions: [Q.devproof],
    keywords: ["devproof", "dev proof", "evidence", "github app", "leetcode", "resume parsing", "skills platform", "ishaan"],
    answer:
      `[DevProof](/projects/devproof/) turns a developer's real activity — GitHub repos, LeetCode, certifications — into **evidence-backed skills** instead of self-reported claims.\n\n` +
      `It's co-built with Ishaan Saxena. ${first} led the backend: the Node.js + Express + Prisma API, GitHub App integration, ` +
      `repository analysis, skill scoring, and the CI pipeline with 100 backend tests.`,
    followups: [Q.aegis, Q.stack, Q.hardest],
  },
  {
    id: "aegis",
    questions: [Q.aegis],
    keywords: ["aegis", "project management", "jira", "slack", "autogen", "prd", "multi-agent", "agents", "eval", "evaluation"],
    answer:
      `[Aegis PM](/projects/aegis-pm/) is a project-management platform where AI agents turn product specs into tasks and flag stalled work in Jira — ` +
      `but nothing reaches Slack until a human approves it.\n\n` +
      `A highlight: before changing the spec parser, ${first} froze a **60-run evaluation baseline** with hand-labelled answers. ` +
      `It showed the same spec produced the same task structure in only 6 of 20 cases — a problem no one would have spotted by eye.`,
    followups: [Q.ai, Q.devproof, Q.hiring],
  },
  {
    id: "ai",
    questions: [Q.ai],
    keywords: ["ai", "llm", "llms", "model", "openai", "claude", "prompt", "machine learning", "ml", "genai"],
    answer:
      `${first} puts LLMs inside real systems and spends most of the effort on the parts *around* the model:\n` +
      `- **Validation** — every reply checked against a schema ([Trading Agent](/projects/trading-agent/))\n` +
      `- **Human approval** before actions ([Aegis PM](/projects/aegis-pm/))\n` +
      `- **Evaluation** — measuring a model before changing it ([Aegis PM](/projects/aegis-pm/))\n` +
      `- **Honesty** — never letting the model invent evidence ([DevProof](/projects/devproof/))`,
    followups: [Q.risk, Q.aegis, Q.stack],
  },
  {
    id: "stack",
    questions: [Q.stack],
    keywords: ["stack", "tech", "technology", "technologies", "language", "languages", "python", "typescript", "node", "fastapi", "react", "skills", "tools", "framework", "database", "postgres", "docker"],
    answer:
      `Mostly backend:\n` +
      `- **Python** — FastAPI, SQLAlchemy, APScheduler, AutoGen\n` +
      `- **TypeScript / Node.js** — Express, Prisma\n` +
      `- **Data** — PostgreSQL, Redis\n` +
      `- **Infra** — Docker, GitHub Actions CI\n` +
      `- **AI** — Gemini, Groq, Ollama, OpenAI\n\n` +
      `The [skills section](/#skills) links each one to the project that proves it.`,
    followups: [Q.ai, Q.devproof, Q.hiring],
  },
  {
    id: "hiring",
    questions: [Q.hiring],
    keywords: ["hire", "hiring", "job", "role", "roles", "open to", "available", "availability", "work with", "freelance", "internship", "opportunity", "recruit", "salary", "remote"],
    answer:
      `Yes — ${first} is **${profile.availability.toLowerCase()}**.\n\n` +
      `The best next step is an email to [${profile.email}](mailto:${profile.email}), or grab the [resume](${profile.resume}).`,
    followups: [Q.contact, Q.stack, Q.hardest],
  },
  {
    id: "contact",
    questions: [Q.contact],
    keywords: ["contact", "email", "reach", "mail", "linkedin", "call", "talk", "message", "get in touch", "meeting", "schedule", "book"],
    answer:
      `Email is fastest: [${profile.email}](mailto:${profile.email}).\n\n` +
      `To talk live, [request a call](${links.booking}).` +
      (links.github ? ` You can also find ${first} on [GitHub](${links.github})` : "") +
      (links.linkedin ? ` and [LinkedIn](${links.linkedin})` : "") +
      (links.github ? "." : ""),
    followups: [Q.hiring, Q.stack],
  },
  {
    id: "education",
    keywords: ["education", "study", "studies", "studied", "studying", "student", "degree", "college", "university", "school", "srm", "dps", "graduate", "graduation"],
    answer:
      `${first} is doing a **B.Tech in Computer Science & Engineering** at **${profile.education[0].school}** (${profile.education[0].period}), ` +
      `after schooling at **${profile.education[1].school}** (${profile.education[1].period}).\n\n` +
      `The projects on this site were built alongside those studies — start with the [Trading Agent](/projects/trading-agent/).`,
    followups: [Q.hardest, Q.stack, Q.hiring],
  },
  {
    id: "resume",
    keywords: ["resume", "cv", "experience", "background"],
    answer: `You can download ${first}'s [resume here](${profile.resume}). For anything it doesn't cover, email [${profile.email}](mailto:${profile.email}).`,
    followups: [Q.hiring, Q.stack],
  },
  {
    id: "about",
    generic: true,
    keywords: ["who", "yourself", "introduce", "about you", "about him", `about ${first.toLowerCase()}`, "summary"],
    answer: `${profile.about[0]}\n\nThe three main projects are the [Trading Agent](/projects/trading-agent/), [DevProof](/projects/devproof/) and [Aegis PM](/projects/aegis-pm/).`,
    followups: [Q.hardest, Q.stack, Q.hiring],
  },
  {
    id: "greeting",
    generic: true,
    keywords: ["hi", "hello", "hey", "yo", "hola", "namaste", "good morning", "good evening"],
    answer: `Hi! Ask me anything about ${first}'s projects, skills or availability.`,
    followups: [Q.hardest, Q.stack, Q.hiring],
  },
  {
    id: "thanks",
    generic: true,
    keywords: ["thanks", "thank you", "thx", "cool", "great", "awesome", "nice"],
    answer: `Happy to help! If you'd like to talk to ${first} directly: [${profile.email}](mailto:${profile.email}).`,
    followups: [Q.hiring, Q.contact],
  },
];

export const fallback = {
  answer:
    `I'm a simple assistant for now, so I don't have an answer for that one. ` +
    `Try one of the questions below, or ask ${first} directly at [${profile.email}](mailto:${profile.email}).`,
  followups: [Q.hardest, Q.stack, Q.hiring],
};

/** Picks the best intent for a free-text question, or null when nothing matches. */
export function match(question: string): Intent | null {
  const q = question.trim();
  const exact = intents.find((i) => i.questions?.includes(q));
  if (exact) return exact;

  const text = ` ${q.toLowerCase().replace(/[^a-z0-9\s-]/g, " ").replace(/\s+/g, " ")} `;
  const words = text.trim().split(" ");
  // Single words also match longer forms ("trade" → "trades", "trading") when 4+ letters long.
  const hasWord = (k: string) => words.some((w) => w === k || (k.length >= 4 && w.startsWith(k)));

  const score = (intent: Intent) =>
    intent.keywords.reduce(
      (n, k) => n + (k.includes(" ") ? (text.includes(` ${k} `) ? 2 : 0) : hasWord(k) ? 1 : 0),
      0,
    );
  const pick = (pool: Intent[]) => {
    let best: Intent | null = null;
    let bestScore = 0;
    for (const intent of pool) {
      const s = score(intent);
      if (s > bestScore) [best, bestScore] = [intent, s];
    }
    return best;
  };
  return pick(intents.filter((i) => !i.generic)) ?? pick(intents.filter((i) => i.generic));
}
