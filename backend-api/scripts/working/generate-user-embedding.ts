import "dotenv/config";
import { createClient } from "@supabase/supabase-js";

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const AI_SERVICE_URL = process.env.AI_SERVICE_URL ?? "http://127.0.0.1:8010";

if (!SUPABASE_URL) throw new Error("Missing SUPABASE_URL");
if (!SUPABASE_SERVICE_ROLE_KEY) throw new Error("Missing SUPABASE_SERVICE_ROLE_KEY");

const client = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);

type Args = {
  userId?: string;
  backfill?: boolean;
  limit: number;
  sleepMs: number;
};

function parseArgs(argv: string[]): Args {
  const args: Args = { limit: 50, sleepMs: 200, backfill: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === "--user" || a === "--userId") {
      const val = argv[++i];
      if (val) args.userId = val;
    } else if (a === "--backfill") args.backfill = true;
    else if (a === "--limit") args.limit = parseInt(argv[++i] ?? "50", 10);
    else if (a === "--sleepMs") args.sleepMs = parseInt(argv[++i] ?? "200", 10);
  }
  return args;
}

async function sleep(ms: number) {
  return new Promise((r) => setTimeout(r, ms));
}

async function generateEmbedding(text: string): Promise<number[]> {
  const res = await fetch(`${AI_SERVICE_URL}/embeddings/generate`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ text }),
  });

  if (!res.ok) {
    const t = await res.text().catch(() => "");
    throw new Error(`ai-service embeddings error ${res.status}: ${t}`);
  }

  const data = (await res.json()) as { embedding?: number[] };
  if (!data.embedding || !Array.isArray(data.embedding)) {
    throw new Error("ai-service response missing embedding[]");
  }
  return data.embedding;
}

async function updateUserEmbedding(userId: string, embedding: number[]) {
  const { error } = await client
    .from("user_ai_profiles")
    .update({ summary_embedding: embedding })
    .eq("user_id", userId);

  if (error) throw new Error(error.message);
}

async function runSingle(userId: string) {
  const { data, error } = await client
    .from("user_ai_profiles")
    .select("user_id, summary")
    .eq("user_id", userId)
    .single();

  if (error) throw new Error(error.message);
  if (!data?.summary) throw new Error("User has no summary");

  const embedding = await generateEmbedding(data.summary);
  console.log(`✓ embedding dims = ${embedding.length}`);

  await updateUserEmbedding(userId, embedding);
  console.log("✓ updated summary_embedding");
}

async function runBackfill(limit: number, sleepMs: number) {
  const { data, error } = await client
    .from("user_ai_profiles")
    .select("user_id, summary")
    .not("summary", "is", null)
    .is("summary_embedding", null)
    .limit(limit);

  if (error) throw new Error(error.message);
  const rows = data ?? [];

  console.log(`Found ${rows.length} users to backfill (limit=${limit})`);

  for (let i = 0; i < rows.length; i++) {
    const r = rows[i];
    if (!r) continue;
    const userId = r.user_id as string;
    const summary = r.summary as string;

    try {
      const embedding = await generateEmbedding(summary);
      if (embedding.length !== 1536) {
        throw new Error(`Expected 1536 dims, got ${embedding.length}`);
      }
      await updateUserEmbedding(userId, embedding);
      console.log(`✓ ${i + 1}/${rows.length} updated ${userId}`);
    } catch (e: any) {
      console.error(`✗ ${i + 1}/${rows.length} ${userId}: ${e?.message ?? e}`);
    }

    if (sleepMs > 0) await sleep(sleepMs);
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  if (args.userId) {
    await runSingle(args.userId);
    return;
  }

  if (args.backfill) {
    await runBackfill(args.limit, args.sleepMs);
    return;
  }

  throw new Error("Usage: --user <uuid> OR --backfill [--limit N] [--sleepMs N]");
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
