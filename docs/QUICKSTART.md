# OpsTwin — Simple Start Guide

**You don't need to understand everything.** Follow these 6 steps once.

---

## The idea (one loop)

```
YOU write idea  →  GROQ plans  →  YOU approve  →  AGENT codes  →  OPSTWIN watches  →  AI improves  →  repeat
```

---

## Step 1 — Start OpsTwin

```bash
cd opstwin
npm run dev
```

Open **http://localhost:3000**

---

## Step 2 — Create a task (your MVP prompt)

1. Click the **+** button (bottom left)
2. Fill in:
   - **Title:** e.g. `Todo app with auth`
   - **Prompt:** describe what you want in plain English
3. Click **Start Task**
4. On the success screen, click **Copy** next to the task ID

The same ID also appears on every task card, in the task detail header, and in the URL as `?task=<uuid>`. You need it once for the CLI watcher in Step 5.

---

## Step 3 — Generate & approve the plan

1. Click your task
2. Stay on **MVP Plan** tab
3. Click **Generate MVP Plan** (uses Groq if key is set)
4. Read the steps and docs
5. Click **Approve Plan**

---

## Step 4 — Send work to your coding agent

**Easy way (copy-paste):**
- Click **Copy prompt** on Step 1
- Paste into Cursor, Claude, ChatGPT, etc.

**Auto way (agent reads a file):**
1. Click **Propose Next Prompt** → **Approve & Copy** → **Dispatch to Agent**
2. In your **code project** (not OpsTwin folder):

```powershell
node opstwin-cli.js dispatch <proposal-id>
```

3. Open Cursor in that project — it reads `.ops/dispatch/pending-prompt.md`

---

## Step 5 — Let OpsTwin see the results

**Option A — Manual (simplest for first test):**
- After agent runs, go to **Upload** page in OpsTwin
- Upload the `last_run.json` file from `.ops/runs/`

**Option B — Automatic (recommended):**

In your code project:

```powershell
# In your code project (not the OpsTwin folder):
node opstwin-init.js
$env:OPSTWIN_URL="http://localhost:3000"
$env:OPSTWIN_TASK_ID="paste-your-task-id-here"   # Copy from dashboard (Step 2)
node opstwin-cli.js watch

# Or pass the ID directly:
node opstwin-cli.js watch paste-your-task-id-here
```

Leave that running. Every time the agent finishes, OpsTwin updates automatically (with stack context). Set `OPSTWIN_AUTO_PROPOSE=true` on the server to auto-create draft proposals.

**One-click dispatch:**

```powershell
node opstwin-cli.js next --yes
```

**Capture prompts from a file:**

Append prompts to `.ops/prompts/inbound.md`, then:

```powershell
node opstwin-cli.js prompt-watch
```

**Sync everything at once:**

```powershell
node opstwin-cli.js sync
```

**Terminal capture (optional):**

```powershell
node opstwin-cli.js run npm test
```

---

## Step 6 — Review & improve

1. Open your task → **Audit** tab
2. See: files changed, tests, terminal, screenshots
3. Go back to **MVP Plan** tab
4. Click **Analyze Run** or **Propose Next Prompt** (LLM badge when Groq/OpenAI key set)
5. Click **Send to Agent** (approve + dispatch) or run `node opstwin-cli.js next --yes`

---

## What each "room" means

| OpsTwin area | What it is |
|---|---|
| **Tasks** | Your MVP ideas |
| **MVP Plan** | Groq breaks your idea into steps + documents |
| **Audit** | What the agent actually did (files, terminal, UI) |
| **Memory** | What OpsTwin learned from past runs |

---

## First test (5 minutes)

1. `npm run dev` → open localhost:3000
2. Create task: *"Add a hello world page to my Next.js app"*
3. Generate plan → Approve
4. Copy Step 1 prompt → paste into Cursor in your real project
5. Check **Audit** tab (upload JSON or use CLI watch)

That's it. Everything else is the same loop.
