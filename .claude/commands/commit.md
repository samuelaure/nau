# /commit — Commit Protocol

You are the **Commit Actor**. Produce clean, atomic, conventional commits. Code is communication; commits are history.

---

## Pre-Commit Checklist (Non-Negotiable)

Before staging anything:

```bash
# TypeScript — must pass with zero errors
pnpm --filter <changed-service> build

# Lint (if configured)
pnpm --filter <changed-service> lint
```

If any check fails → **fix it first**. Never commit broken TypeScript.

---

## Commit Message Format

```
<type>(<scope>): <subject>

<body — optional, explains WHY not WHAT>
```

**Types:**
- `feat` — new feature
- `fix` — bug fix
- `docs` — documentation only
- `refactor` — neither fix nor feature
- `chore` — build, tooling, config
- `perf` — performance improvement
- `test` — adding or correcting tests

**Rules:**
- Imperative mood: "add feature" not "added feature"
- Lowercase subject, no trailing period
- Scope = service or module: `(flownau)`, `(nauthenticity)`, `(api)`, `(docs)`, `(workers)`
- Body explains the WHY when non-obvious (hidden constraint, workaround, incident-driven)

**Examples:**
```
fix(nauthenticity): add startup recovery for stuck scraping runs

Deploys kill in-flight BullMQ jobs. WorkersService now re-enqueues
interrupted runs on every boot, recovering downloading → optimizing
and optimizing → visualizing transitions automatically.
```
```
feat(flownau): add brand creation inline form to sidebar dropdown
```
```
docs: add production deployment protocol to DEPLOYMENT.md
```

---

## Atomicity Rules

- One commit = one logical change
- Never combine a bug fix and a refactor in the same commit
- Never combine changes to two different services unless they are a single coordinated contract change
- Use `git add <specific-files>` — never `git add -A` blindly

---

## Git Workflow

```bash
# 1. Check what changed
git diff --stat
git status --short

# 2. Stage specific files
git add apps/nauthenticity/src/...
git add docs/...

# 3. Verify what you're about to commit
git diff --cached

# 4. Commit using heredoc to avoid shell escaping issues
git commit -m "$(cat <<'EOF'
type(scope): subject

Optional body explaining why.
EOF
)"

# 5. Verify
git log --oneline -3
```

---

## What NOT to Commit

- `.env`, `.env.local`, `.env.production` — ever
- `.claude/` personal settings (keep `.claude/commands/` which is project-level)
- Temporary debug `console.log` statements
- `node_modules/`
- Build output (`.next/`, `dist/`)
