# Nightly Job Pipeline Review – Root Causes & Minimal Fixes

## 1. Pipeline Summary

The nightly job is implemented in **`backend-api/scripts/jobs/process-user-profiles-job.ts`**. Flow:

| Step | What happens | Where |
|------|----------------|------|
| 1 | Get user IDs with unprocessed messages (or all users if `--reprocess-all`) | `getUsersWithUnprocessedMessages(client)` / `getAllUsers(client)` |
| 2 | For each user: skip if `active_chats_count >= 1` | Job script ~1118–1141 |
| 3 | **Profile summary** – Fetch unprocessed chats, call ai-service `/profile/generate`, save incremental summary, merge if existing consolidated summary, upsert to `user_ai_profiles` | `GenerateUserProfileFromChats.execute(userId)` → `AiServiceProfileClient.generateProfile()` |
| 4 | **Embedding** – If summary changed, call ai-service `/embeddings/generate` (dimension 1536), save to `user_ai_profiles.summary_embedding` | `UserAIProfileEmbeddingService.generateEmbeddingFromSummary(userId)` |
| 5 | **Bio** – If consolidated summary exists, call ai-service `/chat/generate` with bio prompt, truncate to 240 chars, update `users.bio` | `UserBioGenerationService.generateBioFromSummary(userId)` → `AiServiceChatClient.generateChat()` → `UserRepository.update(userId, { bio })` |
| 6 | Stats: processed / skipped / failed | Job script ~1210–1211 |

**Data flow:**  
`GetAllUserChats` returns **chats** (one per match with unprocessed messages). Each chat has **messages**. These are flattened into a single **conversations** array for ai-service. So **chatsCount** = number of chats; **conversationsCount** = total message count (e.g. 1 chat with 3 messages → chatsCount: 1, conversationsCount: 3).

---

## 2. Findings (A–F)

### (A) Pronoun / gender mismatch (“She” for male users)

**Symptoms:** Bio for a male user (e.g. userId `48aff6c2-d4df-41e5-a140-0ae303b20d68`, “Leo”) starts with “She seeks…” or “She’s…”.

**Likely causes (ranked):**

1. **No gender/pronoun signal in bio flow** – `UserBioGenerationService` never fetches the user or passes gender. The bio prompt says “Third person singular only” but does not specify pronoun (he/she/they). The model has no explicit signal and may default to “She” in a dating-app context.
2. Summary “Basic identity” may omit or underspecify gender – extraction rules say “only concrete data (age, city, languages, children, pets…)”; gender might be missing or the model may ignore it when writing the bio.

**Where to look:**

- **`backend-api/src/app/ai/profile/UserBioGenerationService.ts`** – `generateBioFromSummary()`: no call to `this.userRepository.findById(userId)`; prompt built only from `profile.summary`.
- **`backend-api/src/app/ai/ai-settings.ts`** – `AIConfig.prompt.bioGeneration`: no pronoun/gender instruction.

**Minimal fix:**

1. In `UserBioGenerationService.generateBioFromSummary()`, after validating the profile/summary, call `this.userRepository.findById(userId)` and read `user.gender`.
2. Map `gender` to a pronoun line, e.g.  
   - `male` → “Use third person: he/him.”  
   - `female` → “Use third person: she/her.”  
   - `non_binary` or null/other → “Use third person: they/them.”
3. Append that line (or a short “PRONOUN: …” line) to the prompt sent to `/chat/generate` so the model has an explicit instruction.

**How to verify:**

- Run bio generation for a known male test user (e.g. Leo) and assert the bio uses “he/him” (or at least not “she”).
- Optional: unit test that builds the prompt with `gender: 'male'` and checks the prompt string contains the pronoun instruction.

---

### (B) Inconsistent bio format (“Doc Love:” prefix sometimes present)

**Symptoms:** Sometimes bio starts with `"Doc Love:\n\n..."`, sometimes with `"She's..."` or `"She seeks..."`.

**Likely causes (ranked):**

1. **Prompt says “You are Doc Love”** – In `ai-settings.ts`, `bioGeneration` starts with “You are Doc Love. You write a short bio…”. The model sometimes interprets that as a speaker label and prefixes the reply with “Doc Love:”.
2. **No system prompt override** – `UserBioGenerationService` calls `generateChat()` with only `messages` (no `system`). So the model follows the in-prompt “You are Doc Love” and may echo that in the output.

**Where to look:**

- **`backend-api/src/app/ai/ai-settings.ts`** – `AIConfig.prompt.bioGeneration` (lines ~339–359): “You are Doc Love…”.
- **`backend-api/src/app/ai/profile/UserBioGenerationService.ts`** – after `aiServiceResponse.content.trim()`: no stripping of a “Doc Love:” prefix.

**Minimal fix:**

1. **Normalize output once** in `UserBioGenerationService` after `bio = aiServiceResponse.content.trim()`:
   - Strip a leading “Doc Love:” (and optional newlines) with a small regex or `replace(/^Doc\s+Love\s*:\s*\n*/i, '')`.
   - Then `bio = bio.trim()` again.
2. Optionally soften the prompt to “Write a short bio…” without “You are Doc Love” for this task, so the model is less likely to add the prefix (defense in depth).

**How to verify:**

- Generate bios for several users; assert none start with “Doc Love:”.
- Unit test: `normalizeBio("Doc Love:\n\nShe seeks...")` → `"She seeks..."`.

---

### (C) Ugly truncation (cut-off sentences)

**Symptoms:** Truncation produces fragments like “preferred over”, “They value”, “valuing stability and”. Warning: “Generated bio exceeds 240 chars, truncating”.

**Likely causes (ranked):**

1. **Truncate-first logic** – In `UserBioGenerationService`, the code does `bio = bio.substring(0, 240)` and only then looks for `lastSpace`. So the string is already cut at 240, possibly mid-word. Then `if (lastSpace > 200)` it replaces with `bio.substring(0, lastSpace)`. If the last space in the first 240 chars is before index 200 (e.g. 180), the code still uses `substring(0, 240)` (because `lastSpace > 200` is false), leaving a mid-word cut.
2. **Prompt says “Maximum 250 characters”** – Backend then truncates to 240. The model may aim for 250 and often exceed 240, so truncation runs often and exposes the bad boundary logic.

**Where to look:**

- **`backend-api/src/app/ai/profile/UserBioGenerationService.ts`** – lines ~116–134: truncation block.

**Minimal fix:**

1. **Always break at a word boundary** for the first 240 characters:
   - Consider only the prefix up to 240 chars: `const max = bio.substring(0, 240)` (or 241 to include one more char if it’s a space).
   - Find `lastSpace = max.lastIndexOf(' ')`. If `lastSpace > 0`, set `bio = bio.substring(0, lastSpace)`; otherwise (no space) keep `bio = max` to avoid empty string.
2. Optionally align prompt with backend: in `ai-settings.ts` change “Maximum 250 characters” to “Maximum 240 characters” so the model targets 240 and truncation is rarer.

**How to verify:**

- Unit test: e.g. 250-char bio where position 240 is mid-word; assert result length ≤ 240 and ends on a word boundary (or on last space before 240).
- Manual: run job on a user that triggers “exceeds 240 chars, truncating” and check stored bio doesn’t end mid-word.

---

### (D) Supabase “Updated data returned” not showing `bio`

**Symptoms:** Log shows “Update query successful” and “Updated data returned:” with `min_age`, `max_age`, `has_children`, … but **not** `bio`.

**Likely causes (ranked):**

1. **Log object omits `bio`** – The `.select()` in the Supabase update **does** include `bio` (see `supabase-user-service.ts` line 325: `'id, birthDate, gender, looking_for, min_age, max_age, bio, city, ...'`). The **log** on lines 339–346 only prints a fixed set of fields: `min_age`, `max_age`, `has_children`, `wants_children`, `cares_about_partner_children`, `smoking`, `cares_about_partner_smoking`. So the DB returns `bio`; the log simply doesn’t include it.

**Where to look:**

- **`backend-api/src/app/services/supabase-user-service.ts`** – around lines 337–346: `console.log('[SupabaseUserService] Updated data returned:', { ... })`.

**Minimal fix:**

- Add `bio` to the logged object (e.g. `bio: data?.bio`), or log the full `data` (or a sanitized subset including `bio`) so that after a bio update you can confirm the returned row contains the new `bio`. No change to the update or select is required.

**How to verify:**

- Trigger a user profile update that sets only `bio` (e.g. nightly job bio step); check logs for “Updated data returned” and confirm `bio` is present and correct.

---

### (E) `chatsCount: 1` vs `conversationsCount: 3` mismatch

**Symptoms:** Log shows e.g. `chatsCount: 1` and `conversationsCount: 3`.

**Likely causes (ranked):**

1. **Different metrics** – This is **expected**.  
   - **chatsCount** is logged in `GenerateUserProfileFromChats` as `chats.length`: number of **chats** (matches) that have unprocessed messages.  
   - **conversationsCount** is logged in `AiServiceProfileClient` as `request.conversations.length`: total number of **messages** (conversation turns) sent to ai-service.  
   So one chat with three messages gives chatsCount 1 and conversationsCount 3.

**Where to look:**

- **`backend-api/src/domain/use-cases/chat/GenerateUserProfileFromChats.ts`** – line 87: `chatsCount: chats.length`.
- **`backend-api/src/app/ai/clients/AiServiceProfileClient.ts`** – line 70: `conversationsCount: request.conversations.length`.
- **`GenerateUserProfileFromChats.transformToAiServiceConversations()`** – flattens all `chat.messages` from all chats into one array.

**Minimal fix:**

- No code change required. To avoid confusion, add a one-line comment in the code or in the job doc: e.g. “chatsCount = number of chats (matches); conversationsCount = total messages (conversation turns) sent to ai-service.” Optionally log both in one line: `chatsCount: X, conversationsCount: Y (X chats, Y total messages)`.

**How to verify:**

- For one user with one match and N unprocessed messages, confirm logs show chatsCount 1 and conversationsCount N.

---

### (F) ai-service baseUrl `127.0.0.1:8010` in production

**Symptoms:** Logs show calls to ai-service with `baseUrl: "http://127.0.0.1:8010"` during a job that should run in production.

**Likely causes (ranked):**

1. **Env not set in production** – `AIConfig.aiService.baseUrl` is set from `process.env.AI_SERVICE_BASE_URL || process.env.AI_SERVICE_URL || 'http://127.0.0.1:8010'` (`backend-api/src/app/ai/ai-settings.ts` lines 83–86). If neither env var is set in the production environment, the fallback is used.
2. **Job runs in same process as API** – If the job runs inside the backend process (e.g. scheduler in `src/app/jobs/scheduler.ts`), it uses the same `AIConfig` and thus the same baseUrl. So production backend must have `AI_SERVICE_BASE_URL` or `AI_SERVICE_URL` set to the real ai-service URL.

**Where to look:**

- **`backend-api/src/app/ai/ai-settings.ts`** – lines 81–86: `aiService.baseUrl`.
- Production env (e.g. Railway, Vercel, `.env.production`, or platform env config): ensure `AI_SERVICE_BASE_URL` or `AI_SERVICE_URL` is set.

**Minimal fix:**

1. **Production:** Set `AI_SERVICE_BASE_URL` (or `AI_SERVICE_URL`) to the deployed ai-service URL (e.g. `https://ai-service.example.com` or the internal URL used by the backend). Do not rely on the default in production.
2. **Safety:** Optionally log a warning at startup if baseUrl is still `127.0.0.1` and `NODE_ENV === 'production'` (or a custom `JOB_ENV=production`), so misconfiguration is visible.

**How to verify:**

- In production, inspect env and logs: baseUrl in ai-service client logs should be the production ai-service host, not `127.0.0.1:8010`.

---

## 3. Suggested Logging Improvements (max 8 bullets)

- **Bio generation:** Log `userId`, `gender` (if fetched for pronoun), and a short `bioPreview` (e.g. first 60 chars) after successful generation and after truncation (when applied), so pronoun and format can be checked without DB access.
- **Truncation:** When truncating, log `originalLength`, `afterTruncationLength`, and `lastWord` (e.g. last 20 chars of final bio) to verify word-boundary behavior.
- **Supabase user update:** Include `bio` in the “Updated data returned” log (or log full returned row) in `supabase-user-service.ts` so bio updates are visible.
- **Pipeline phase:** At the start of each user in the job, log a single line with `userId`, phase (e.g. `profile|embedding|bio`) and outcome (e.g. `ok|skip|fail`) so you can trace which step failed or was skipped.
- **ai-service baseUrl:** At job start (or first ai-service call), log `baseUrl` once; in production, log a warning if baseUrl is `127.0.0.1` or `localhost`.
- **chatsCount / conversationsCount:** Log both in one line with a short explanation (e.g. “chatsCount=1, conversationsCount=3 (1 chat, 3 messages)”) to avoid confusion.
- **Doc Love prefix:** If you add stripping of “Doc Love:” in bio, log when it was stripped (e.g. “Stripped leading 'Doc Love:' from bio”) at debug level for a few runs to confirm it’s working.
- **Pronoun instruction:** When you add gender-based pronoun to the bio prompt, log at debug level that pronoun was set (e.g. `pronounInstruction: 'he/him'`) so you can confirm the right instruction is sent.

---

## 4. Quick Sanity Checklist After Patch (max 10 bullets)

- [ ] **Env:** Production has `AI_SERVICE_BASE_URL` or `AI_SERVICE_URL` set; job logs show that baseUrl (no `127.0.0.1` in prod).
- [ ] **Bio pronoun:** Run bio generation for one male and one female test user; bios use “he/him” and “she/her” (or intended pronouns).
- [ ] **Bio format:** No stored bio starts with “Doc Love:” (run a few generations or query recent `users.bio`).
- [ ] **Truncation:** Trigger bio truncation (e.g. user with long summary); stored bio length ≤ 240 and does not end mid-word.
- [ ] **Supabase log:** After a bio-only update, “Updated data returned” log includes `bio` and matches the written value.
- [ ] **Pipeline:** For one user with unprocessed messages, job logs show profile → embedding → bio in order and “Successfully updated user bio” (or expected skip reasons).
- [ ] **chatsCount vs conversationsCount:** Logs clearly show chatsCount = number of chats, conversationsCount = total messages; no change in behavior.
- [ ] **Stats:** Job end stats (processed/skipped/failed) match the number of users processed/skipped/failed in the logs.
- [ ] **No regression:** Doc Love chat (in-app) still works; profile summary and merge still work when new messages exist.
- [ ] **Optional:** Run `process-user-profiles-job.ts` for one test user (with unprocessed messages) and confirm no errors and bio/embedding updated as expected.
