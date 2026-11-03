"""Fanzeum AI manager: turns a labelled GitHub issue into tested, reviewed code using free models.
Flow: plan (pick files) -> build -> test/fix loop (max 3) -> 3-model review panel -> merge to main if green + majority PASS,
otherwise push a branch and report on the issue. Models come from the free pool (GitHub OIDC auth) plus Groq."""
import json, os, re, subprocess, sys, time, urllib.request

POOL = "https://pwyl-ai-pool.bruce-787.workers.dev/v1/chat/completions"
GROQ = "https://api.groq.com/openai/v1/chat/completions"
def pool_key():
    # GitHub OIDC tokens expire after a few minutes, so mint a fresh one for every call
    u, t = os.environ.get("ACTIONS_ID_TOKEN_REQUEST_URL"), os.environ.get("ACTIONS_ID_TOKEN_REQUEST_TOKEN")
    if u and t:
        try:
            r = urllib.request.Request(u + "&audience=pwyl-ai-pool", headers={"Authorization": "Bearer " + t})
            return json.load(urllib.request.urlopen(r, timeout=30))["value"]
        except Exception as e: print("oidc error", e, flush=True)
    return os.environ.get("POOL_KEY", "")
CODERS = ["nvidia/deepseek-ai/deepseek-v4.1-flash", "nvidia/mistralai/mistral-large-4-1t-a52b", "team/coder"]
GROQ_KEY = os.environ.get("GROQ_API_KEY", "")
GEMINI = "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions"
GEMINI_KEY = os.environ.get("GEMINI_TEAM_KEY", "")  # separate free key, never the live site's
TITLE = os.environ["ISSUE_TITLE"]; BODY = os.environ.get("ISSUE_BODY", ""); NUM = os.environ["ISSUE_NUMBER"]
TEST = os.environ.get("TEST_CMD") or "npx tsc --noEmit 2>&1 | head -80; npx vite build >/tmp/vb.log 2>&1 && echo 'build: 1 passed' || (tail -40 /tmp/vb.log; echo 'build: 1 failed')"
RULES = open("AGENTS.md").read() if os.path.exists("AGENTS.md") else ""
RULES += os.environ.get("HOUSE_RULES") or """
House rules: React 19 + TypeScript (strict) + Vite + Tailwind v4 PWA; Firebase Auth/Firestore/Storage via src/lib/firebase.ts and src/lib/firestoreRepo.ts; Gemini only server-side in src/server/ai (never in client code, never expose keys).
Every Firestore write must match firestore.rules exactly (hasAll/hasOnly field lists); update the rules when you add fields. Design: dark-first "After Hours", brass accent, Fraunces + Inter.
UK English and GBP in user-facing text. User-facing word is "Showcase", never "Cabinet". AI results are estimates, never authentication. No jargon like accession, curatorial, archival.
Never mention 'Hark'. No new paid services. Keep changes within the issue scope."""

def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True).stdout

def chat(model, msgs, url=POOL, key=None, max_tokens=32000):
    models = CODERS if model == "team/coder" else [model]
    for a in range(len(models) * 2):
        m = models[a % len(models)]
        body = json.dumps({"model": m, "messages": msgs, "temperature": 0.2, "max_tokens": max_tokens}).encode()
        h = {"Content-Type": "application/json", "Authorization": "Bearer " + (key or pool_key()), "User-Agent": "curl/8.5.0"}
        try:
            r = json.load(urllib.request.urlopen(urllib.request.Request(url, body, h), timeout=900))
            c = r["choices"][0]["message"]["content"]
            if c: print("model ok", m, len(c), flush=True); return c
        except Exception as e: print("model error", m, e, flush=True)
        time.sleep(20)
    if model == "team/coder" and GEMINI_KEY and url == POOL:  # free Gemini as last-resort coder
        return chat("gemini-flash-latest", msgs, url=GEMINI, key=GEMINI_KEY, max_tokens=max_tokens)
    return ""

def files_block(paths):
    out = ""
    for p in paths:
        if os.path.isfile(p) and os.path.getsize(p) < 60000: out += f"\n=== EXISTING FILE: {p} ===\n{open(p, errors='ignore').read()}\n"
    return out

def write(out):
    n = 0
    for part in out.split("=== FILE: ")[1:]:
        p, _, c = part.partition(" ===\n"); p = p.strip(); c = c.split("=== END FILE ===")[0].strip("\n")
        c = re.sub(r"^```[a-z]*\n", "", c); c = re.sub(r"\n```\s*$", "", c)
        if p.startswith((".github/", "/")) or ".." in p: continue
        os.makedirs(os.path.dirname(p) or ".", exist_ok=True); open(p, "w").write(c + "\n"); n += 1; print("wrote", p, flush=True)
    return n

FMT = "\nOUTPUT FORMAT: only files, each as\n=== FILE: <path> ===\n<complete file content>\n=== END FILE ===\nNo commentary."
task = f"# Issue #{NUM}: {TITLE}\n\n{BODY}"
tree = sh("git ls-files | grep -v -E '\\.(mp3|mp4|wav|png|jpg|lock)$' | head -400")

# 1. plan: pick relevant files
plan = chat("team/thinker", [{"role": "user", "content": f"{task}\n\nRepository files:\n{tree}\n\nList up to 15 existing files an engineer must read to implement this, one path per line, nothing else."}], max_tokens=2000)
ctx_files = [l.strip(" -*`") for l in plan.splitlines() if os.path.isfile(l.strip(" -*`"))][:15]
print("context:", ctx_files, flush=True)

# 2. build
sys_msg = {"role": "system", "content": "You are a senior engineer on Fanzeum, a UK collectors app.\n" + RULES + FMT}
out = chat("team/coder", [sys_msg, {"role": "user", "content": files_block(ctx_files) + "\n\n" + task + "\n\nImplement it with tests. Output all files you create or change."}])
write(out)

# 3. test / fix loop
green = False; log = ""
for i in range(3):
    log = sh(TEST)
    if "error TS" not in log and not re.search(r"\d+ failed", log) and re.search(r"\d+ passed", log): green = True; break
    changed = [l[3:] for l in sh("git status --porcelain --untracked-files=all").splitlines()]
    out = chat("team/coder", [sys_msg, {"role": "user", "content": files_block(changed) + "\n\nTask:\n" + task + "\n\nTypecheck/test output:\n" + log[-12000:] + "\n\nFix every error. Output only changed files, complete."}])
    if not write(out): break
print("GREEN" if green else "NOT GREEN", flush=True)

# 4. review panel (three families)
sh("git add -A")
diff = sh("git diff --cached -- . ':!*.mp3' ':!*.mp4' ':!*.lock'")[:24000]
rp = ("You are a sceptical senior reviewer for Fanzeum (UK collectors PWA). Review this diff for bugs, security holes, Firestore writes that do not match firestore.rules, Gemini calls or keys in client code, "
      "claims that AI results authenticate items, broken layouts. Reply under 150 words: first line exactly PASS or FAIL, then up to 5 findings.\n\nTask:\n" + task + "\n\nDiff:\n" + diff)
panel = [("Thinker panel", "team/thinker", POOL, None), ("Writer panel", "team/writer", POOL, None)]
if GROQ_KEY: panel.append(("Groq gpt-oss-120b", "openai/gpt-oss-120b", GROQ, GROQ_KEY))
else: panel.append(("Fast panel", "team/fast", POOL, None))
if GEMINI_KEY: panel.append(("Gemini Flash", "gemini-flash-latest", GEMINI, GEMINI_KEY))
reviews = []; passes = 0
for name, m, u, k in panel:
    r = chat(m, [{"role": "user", "content": rp}], url=u, key=k, max_tokens=1500) if diff.strip() else "FAIL\nNo changes produced."
    verdict = "PASS" if r.strip().upper().lstrip("*# ").startswith("PASS") else "FAIL"
    passes += verdict == "PASS"; reviews.append(f"### {name}: {verdict}\n{r.strip()[:1500]}")
report = f"Tests: {'all passing' if green else 'NOT passing'}\nReview panel: {passes}/{len(panel)} PASS\n\n" + "\n\n".join(reviews)
if not green: report += "\n\n<details><summary>Test output</summary>\n\n```\n" + log[-3000:] + "\n```\n</details>"
open("/tmp/report.md", "w").write(report)
ok = green and passes * 2 > len(panel) and bool(diff.strip())
open(os.environ["GITHUB_OUTPUT"], "a").write(f"ok={'true' if ok else 'false'}\nchanged={'true' if diff.strip() else 'false'}\n")
print(report)
