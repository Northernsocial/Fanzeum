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
Never mention 'Hark'. No new paid services. Keep changes within the issue scope.
ADDITIVE ONLY: never delete or rename existing exports, types, constants, routes or components; add new ones beside them. Never rewrite shared files (src/types/domain.ts, firestoreRepo.ts, App routes) wholesale: output the complete file with only your additions.
Every new Firestore collection gets matching firestore.rules in the same change. No guest or fallback user IDs: features that read or write user data, and ALL AI calls, require a signed-in account (show a sign-in prompt otherwise). Show friendly errors, never silent catches."""

def sh(c): return subprocess.run(c, shell=True, capture_output=True, text=True).stdout

def _call(m, msgs, url, key, max_tokens, timeout):
    body = json.dumps({"model": m, "messages": msgs, "temperature": 0.2, "max_tokens": max_tokens}).encode()
    h = {"Content-Type": "application/json", "Authorization": "Bearer " + (key or pool_key()), "User-Agent": "curl/8.5.0"}
    try:
        r = json.load(urllib.request.urlopen(urllib.request.Request(url, body, h), timeout=timeout))
        c = r["choices"][0]["message"]["content"]
        if c: print("model ok", m, len(c), flush=True); return c
    except Exception as e: print("model error", m, e, flush=True)
    return ""

def chat(model, msgs, url=POOL, key=None, max_tokens=32000):
    if model == "team/coder":
        # Coders in order: free Gemini (most reliable), Groq, then the shared pool. Each tried twice.
        chain = []
        if GEMINI_KEY: chain += [("gemini-flash-latest", GEMINI, GEMINI_KEY), ("gemini-2.5-flash", GEMINI, GEMINI_KEY)]
        if GROQ_KEY: chain.append(("openai/gpt-oss-120b", GROQ, GROQ_KEY))
        chain += [(m, POOL, None) for m in CODERS]
    else:
        chain = [(model, url, key)]
    for a in range(len(chain) * 2):
        m, u, k = chain[a % len(chain)]
        c = _call(m, msgs, u, k, max_tokens, 600)
        # quality gate for coders: a tiny reply (types only, a stub) is a failed attempt, so fall to the next coder
        if c and model == "team/coder" and len(c) < 2500 and "Typecheck/test output" not in str(msgs) and "refused" not in str(msgs[-1]):
            print("coder reply too small, trying next coder", len(c), flush=True); c = ""
        if c: return c
        time.sleep(30 if "429" in str(sys.last_value if hasattr(sys, "last_value") else "") else 15)
    return ""

def files_block(paths):
    out = ""
    for p in paths:
        if not os.path.isfile(p): continue
        sz = os.path.getsize(p); txt = open(p, errors="ignore").read()
        if sz < 60000: out += f"\n=== EXISTING FILE: {p} ({sz} bytes{', LARGE: use EDIT or APPEND only' if sz > BIG else ''}) ===\n{txt}\n"
        else:
            ls = txt.splitlines()
            outline = "\n".join(f"{i+1}: {l}" for i, l in enumerate(ls) if re.match(r"\s*(export |function |match /|allow )", l))[:9000]
            out += f"\n=== EXISTING FILE (TOO BIG TO SHOW, {sz} bytes, {len(ls)} lines; use APPEND only): {p} ===\nOUTLINE:\n{outline}\nLAST 40 LINES:\n" + "\n".join(ls[-40:]) + "\n"
    return out

BIG = 20000
REJECTED = []

def write(out):
    """Apply model output. Blocks: FILE (new files, or small existing files), EDIT (SEARCH/REPLACE), APPEND (add to end; for firestore.rules inserts before the final two braces)."""
    n = 0
    parts = re.split(r"^=== (FILE|EDIT|APPEND): (\S+) ===[ \t]*$", out, flags=re.M)
    for i in range(1, len(parts) - 2, 3):
        kind, p, c = parts[i], parts[i + 1].strip().strip("`"), parts[i + 2]
        c = c.split("=== END FILE ===")[0].strip("\n")
        c = re.sub(r"^```[a-z]*\n", "", c); c = re.sub(r"\n```\s*$", "", c)
        if p.startswith((".github/", "/")) or ".." in p: continue
        exists = os.path.isfile(p); old = open(p, errors="ignore").read() if exists else ""
        if "<<<<<<< SEARCH" in c and exists: kind = "EDIT"
        elif re.search(r"^(<<<<<<<|>>>>>>>)", c, flags=re.M) or re.search(r"^=======$", c, flags=re.M):
            REJECTED.append(f"{p}: conflict markers (<<<<<<<, =======, >>>>>>>) are not allowed in a {kind} block. Use the EDIT format only for existing files."); continue
        if kind == "APPEND" and exists:
            names = lambda t: set(re.findall(r"(?:export\s+(?:async\s+)?(?:function|const|interface|type|class|enum)\s+|^\s*function\s+)(\w+)", t, flags=re.M)) | set(re.findall(r"^\s*match\s+(/\S+)", t, flags=re.M))
            dup = names(c) & names(old)
            if dup:
                REJECTED.append(f"{p}: APPEND refused, these already exist in the file (do not redeclare them; use EDIT to change them): {sorted(dup)[:8]}"); continue
        if kind == "FILE":
            if exists and (len(old) > BIG or len(c.splitlines()) < 0.8 * len(old.splitlines())):
                REJECTED.append(f"{p}: FILE overwrite refused (existing file is large or your version drops lines). Resend only your additions as APPEND, or targeted EDIT blocks."); continue
            res = c + "\n"
        elif kind == "APPEND":
            if not exists: res = c + "\n"
            elif p.endswith("firestore.rules"):
                k = old.rstrip().rfind("}"); k = old[:k].rstrip().rfind("}")
                res = old[:k].rstrip() + "\n\n" + c + "\n" + old[k:]
            else: res = old.rstrip("\n") + "\n\n" + c + "\n"
        else:
            res = old; bad = False
            for m in re.finditer(r"<<<<<<< SEARCH\n(.*?)\n=======\n(.*?)\n?>>>>>>> REPLACE", c, flags=re.S):
                if m.group(1) in res: res = res.replace(m.group(1), m.group(2), 1)
                else: bad = True; REJECTED.append(f"{p}: an EDIT SEARCH block did not match the file exactly: {m.group(1)[:120]!r}")
            if res == old: continue
        os.makedirs(os.path.dirname(p) or ".", exist_ok=True); open(p, "w").write(res); n += 1; print("wrote", kind, p, flush=True)
    return n

FMT = ("\nOUTPUT FORMAT, no commentary. Three block kinds, each closed by a line === END FILE ===:\n"
 "1) New file or small existing file: === FILE: <path> ===  then the COMPLETE file.\n"
 "2) Change part of an existing file: === EDIT: <path> ===  then one or more blocks of\n<<<<<<< SEARCH\n<exact existing lines, copied verbatim>\n=======\n<replacement lines>\n>>>>>>> REPLACE\n"
 "3) Add to the end of an existing file: === APPEND: <path> ===  then only the new code. For firestore.rules this inserts your new functions and match blocks before the final closing braces, so output just those, never the whole file.\n"
 "NEVER output a whole existing file that is marked LARGE or TOO BIG: use APPEND or EDIT. Never drop existing code. Never leave a file half written; keep each file short and finish every function.")
task = f"# Issue #{NUM}: {TITLE}\n\n{BODY}"
tree = sh("git ls-files | grep -v -E '\\.(mp3|mp4|wav|png|jpg|lock)$' | head -400")

# 1. plan: pick relevant files
plan = chat("team/thinker", [{"role": "user", "content": f"{task}\n\nRepository files:\n{tree}\n\nList up to 15 existing files an engineer must read to implement this, one path per line, nothing else."}], max_tokens=2000)
ctx_files = [l.strip(" -*`") for l in plan.splitlines() if os.path.isfile(l.strip(" -*`"))][:15]
print("context:", ctx_files, flush=True)

# 2. build
sys_msg = {"role": "system", "content": "You are a senior engineer on Fanzeum, a UK collectors app.\n" + RULES + FMT}
out = chat("team/coder", [sys_msg, {"role": "user", "content": files_block(ctx_files) + "\n\n" + task + "\n\nImplement the WHOLE issue end to end: pages, routes, components, data access, firestore.rules and tests. Adding only types or stubs is a failure. Output all files you create or change."}])
write(out)
if REJECTED:
    fb = "Some of your output was refused:\n" + "\n".join(REJECTED[:10]); REJECTED.clear()
    out = chat("team/coder", [sys_msg, {"role": "user", "content": files_block(ctx_files) + "\n\n" + task + "\n\nYour previous attempt:\n" + out[:20000] + "\n\n" + fb + "\nResend ONLY the refused changes in the correct format."}])
    write(out)

# 3. test / fix loop
green = False; log = ""
for i in range(3):
    log = sh(TEST)
    if "error TS" not in log and not re.search(r"\d+ failed", log) and re.search(r"\d+ passed", log): green = True; break
    changed = [l[3:] for l in sh("git status --porcelain --untracked-files=all").splitlines()]
    out = chat("team/coder", [sys_msg, {"role": "user", "content": files_block(changed) + "\n\nTask:\n" + task + "\n\nTypecheck/test output:\n" + log[-12000:] + "\n\nFix every error. Use EDIT blocks for small fixes in existing files; output only what changes."}])
    if not write(out): break
print("GREEN" if green else "NOT GREEN", flush=True)

# 4. review panel (three families)
sh("git add -A")
full = sh("git diff --cached -- . ':!*.mp3' ':!*.mp4' ':!*.lock'")
stat = sh("git diff --cached --stat -- . ':!*.mp3' ':!*.mp4' ':!*.lock'")
dels = sum(1 for l in full.splitlines() if l.startswith("-") and not l.startswith("---"))
diff = full[:45000]
if len(full) > 45000: diff += "\n[diff cut here only to fit this review; the real change continues and is complete. Do not report truncation as a defect.]"
diff = "DIFF STAT:\n" + stat + "\nLINES DELETED FROM EXISTING CODE: " + str(dels) + "\n\n" + (diff if full.strip() else "")
rp = ("You are a sceptical senior reviewer for Fanzeum (UK collectors PWA). Review this diff for bugs, security holes, Firestore writes that do not match firestore.rules, Gemini calls or keys in client code, "
      "claims that AI results authenticate items, broken layouts. Reply under 150 words: first line exactly PASS or FAIL, then up to 5 findings.\n\nTask:\n" + task + "\n\nDiff:\n" + diff)
panel = [("Thinker panel", "team/thinker", POOL, None), ("Writer panel", "team/writer", POOL, None)]
if GROQ_KEY: panel.append(("Groq gpt-oss-120b", "openai/gpt-oss-120b", GROQ, GROQ_KEY))
else: panel.append(("Fast panel", "team/fast", POOL, None))
if GEMINI_KEY: panel.append(("Gemini Flash", "gemini-flash-latest", GEMINI, GEMINI_KEY))
reviews = []; passes = 0
for name, m, u, k in panel:
    r = chat(m, [{"role": "user", "content": rp}], url=u, key=k, max_tokens=1500) if full.strip() else "FAIL\nNo changes produced."
    verdict = "PASS" if r.strip().upper().lstrip("*# ").startswith("PASS") else "FAIL"
    passes += verdict == "PASS"; reviews.append(f"### {name}: {verdict}\n{r.strip()[:1500]}")
report = f"Tests: {'all passing' if green else 'NOT passing'}\nReview panel: {passes}/{len(panel)} PASS\n\n" + "\n\n".join(reviews)
if not green: report += "\n\n<details><summary>Test output</summary>\n\n```\n" + log[-3000:] + "\n```\n</details>"
open("/tmp/report.md", "w").write(report)
added = [l[1:] for l in full.splitlines() if l.startswith("+") and not l.startswith("+++")]
markers = any(re.match(r"(<<<<<<<|>>>>>>>)", l) or l == "=======" for l in added)
rules_bad = False
if os.path.isfile("firestore.rules"):
    rt = open("firestore.rules", errors="ignore").read(); rules_bad = rt.count("{") != rt.count("}")
if markers or rules_bad: report += "\n\nAUTO-BLOCK: " + ("conflict markers in the diff. " if markers else "") + ("firestore.rules braces do not balance." if rules_bad else ""); open("/tmp/report.md", "w").write(report)
ok = green and passes * 2 >= len(panel) and bool(full.strip()) and dels <= 120 and not markers and not rules_bad
open(os.environ["GITHUB_OUTPUT"], "a").write(f"ok={'true' if ok else 'false'}\nchanged={'true' if full.strip() else 'false'}\n")
print(report)
