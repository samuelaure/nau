# Release Notifications & Changelog System

**Status:** Future / planning
**Surfaces:** app.9nau.com, nauthenticity dashboard, flownau, Zazŭ bot
**Trigger:** merge to `main` via GitHub Actions CI/CD

---

## 1. Changelog generation

**Tool: `git-cliff`**

Recommended over `conventional-changelog` (config-heavy, JS ecosystem coupling) and `release-please` (opinionated branching model that conflicts with the current push-to-main flow).

`git-cliff` reads conventional commits, produces a `CHANGELOG.md` per run, and is configured via a single `cliff.toml` at the repo root. It runs as a step in the existing GitHub Actions workflow.

### Configuration

`cliff.toml` at repo root:

```toml
[changelog]
header = "# Changelog\n\n"
body = """
## {{ version }} — {{ timestamp | date(format="%Y-%m-%d") }}
{% for group, commits in commits | group_by(attribute="group") %}
### {{ group }}
{% for commit in commits %}
- {{ commit.message }} ([`{{ commit.id | truncate(length=7, end="") }}`](https://github.com/org/nau/commit/{{ commit.id }}))
{% endfor %}
{% endfor %}
"""
trim = true

[git]
conventional_commits = true
commit_parsers = [
  { message = "^feat", group = "Features" },
  { message = "^fix", group = "Bug Fixes" },
  { message = "^perf", group = "Performance" },
  { message = "^refactor", group = "Refactoring" },
  { message = "^docs", group = "Docs" },
  { message = "^chore", skip = true },
]
```

### Output location

- `CHANGELOG.md` at repo root — full cumulative history, committed back to `main` by CI.
- Per-release body is passed directly to the GitHub Release (section 2).

### GitHub Actions step

Add to the existing deploy workflow (`.github/workflows/deploy.yml` or equivalent):

```yaml
- name: Generate changelog
  uses: orhun/git-cliff-action@v3
  with:
    config: cliff.toml
    args: --latest --strip header
  env:
    OUTPUT: CHANGELOG_LATEST.md
    GITHUB_REPO: ${{ github.repository }}
```

The `--latest` flag scopes to commits since the last tag. `CHANGELOG_LATEST.md` is a temp file used only for the release body — it is not committed.

---

## 2. GitHub Releases

Auto-create a GitHub Release on every merge to `main`.

### Semver tagging

Currently there are no semver tags. Adopt a `CalVer`-compatible scheme that does not require human coordination: `YYYY.MM.PATCH` where PATCH is the zero-based count of releases in that month, auto-incremented by CI.

Alternative: use `release-please` only for tag + release creation (without its branching model), pointing it at `main` in non-blocking mode.

Simplest path: in the deploy workflow, after `git-cliff` runs:

```yaml
- name: Get next version
  id: version
  run: |
    LAST=$(git tag --sort=-v:refname | grep -E '^[0-9]{4}\.' | head -1)
    # increment patch or start at 2026.05.0
    echo "tag=..." >> $GITHUB_OUTPUT

- name: Create GitHub Release
  uses: softprops/action-gh-release@v2
  with:
    tag_name: ${{ steps.version.outputs.tag }}
    name: ${{ steps.version.outputs.tag }}
    body_path: CHANGELOG_LATEST.md
    draft: false
    prerelease: false
  env:
    GITHUB_TOKEN: ${{ secrets.GITHUB_TOKEN }}
```

The release is published automatically — no human creates it.

---

## 3. In-app notification

### Data model — lives in `apps/api` (Postgres)

Two tables added via migration to the api database:

```
Release
  id            String   @id @default(cuid())
  version       String   @unique          -- "2026.05.0"
  title         String                    -- short human label
  body          String                    -- markdown changelog body
  publishedAt   DateTime @default(now())
  critical      Boolean  @default(false)  -- forces modal vs banner

ReleaseAck
  id            String   @id @default(cuid())
  userId        String
  releaseId     String
  ackedAt       DateTime @default(now())
  @@unique([userId, releaseId])
```

`Release` rows are inserted by CI via a signed service JWT POST to `api` at deploy time (new endpoint: `POST /internal/releases`). No human creates these.

### API surface

- `GET /releases/unread` — returns releases the authenticated user has not acked, newest first. Used by all three web surfaces on mount.
- `POST /releases/:id/ack` — marks a release as read for the current user.

### UI pattern — notification dot + side drawer

Banner modals are disruptive. Preferred pattern:

- A notification dot on the existing nav avatar/bell icon when `GET /releases/unread` returns any results.
- Clicking it opens a side drawer listing release notes in chronological order, rendered as markdown.
- Each release has an "Got it" button that calls `POST /releases/:id/ack`.
- The dot disappears when all releases are acked.
- `critical: true` releases render a dismissible modal on next page load instead of the dot.

### Where to implement

| Surface | File to add notification fetch | Notes |
|---|---|---|
| app.9nau.com | `apps/app/src/app/layout.tsx` | Add to existing root layout, after auth check |
| flownau | `apps/flownau/src/app/layout.tsx` | Same pattern |
| nauthenticity dashboard | Root layout component in the Vite SPA | Inject via existing auth context |

Each surface fetches from `api.9nau.com/releases/unread` using the existing session/cookie auth. The dot + drawer are a shared React component — add it to `packages/ui` so all three surfaces share one implementation.

---

## 4. Telegram notification via Zazŭ

After each successful deploy, post a release summary to a private Telegram channel.

### Mechanism

Add a step at the end of the GitHub Actions deploy workflow:

```yaml
- name: Notify Telegram
  run: |
    VERSION="${{ steps.version.outputs.tag }}"
    BODY=$(cat CHANGELOG_LATEST.md | head -40)
    MESSAGE="*naŭ ${VERSION} deployed*\n\n${BODY}"
    curl -s -X POST "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      -d chat_id="${TELEGRAM_RELEASE_CHANNEL_ID}" \
      -d parse_mode="Markdown" \
      -d text="${MESSAGE}"
  env:
    TELEGRAM_BOT_TOKEN: ${{ secrets.TELEGRAM_BOT_TOKEN }}
    TELEGRAM_RELEASE_CHANNEL_ID: ${{ secrets.TELEGRAM_RELEASE_CHANNEL_ID }}
```

This uses the existing bot token (`TELEGRAM_BOT_TOKEN` already in CI secrets for zazu-bot deploys). Add `TELEGRAM_RELEASE_CHANNEL_ID` as a new secret — the numeric ID of a private Telegram channel/group the bot is a member of.

The bot must be added to the channel as an admin with "Post messages" permission.

### Message format

```
*naŭ 2026.05.3 deployed* ✓

Features
- Brand knowledge base restructure
- CategoryMembership XOR constraint

Bug Fixes
- Restore audio_name in trial reel payload

Full notes: https://github.com/org/nau/releases/tag/2026.05.3
```

Truncate the body to ~40 lines to avoid Telegram message length limits (4096 chars). Link to the full GitHub Release for the rest.

---

## 5. Release history page

### Location: `apps/app/src/app/changelog/page.tsx`

A Next.js page at `app.9nau.com/changelog`. Auth-gated — requires a valid session. Fetches from `GET /releases` (paginated, no ack filtering — shows all releases).

Renders releases as a timeline: version badge, date, markdown body via a shared `<ReleaseNote>` component from `packages/ui`.

Mark this page as `no-cache` to always show the latest releases.

Optionally expose a public version at a static URL (e.g. `changelog.9nau.com`) built from `CHANGELOG.md` at deploy time — lower priority, useful for external-facing marketing later.

---

## 6. Action items in priority order

| Priority | Item | Owner area |
|---|---|---|
| 1 | Add `cliff.toml` to repo root and `git-cliff-action` step to CI workflow | DevOps / CI |
| 2 | Add `softprops/action-gh-release` step to CI workflow; implement CalVer tag logic | DevOps / CI |
| 3 | Add `Release` and `ReleaseAck` tables to `apps/api` Prisma schema + migration | api |
| 4 | Implement `POST /internal/releases` and `GET /releases/unread` + `POST /releases/:id/ack` in api | api |
| 5 | Add CI step to POST new release to api after deploy | DevOps / CI |
| 6 | Build notification dot + side drawer component in `packages/ui` | Frontend |
| 7 | Wire component into `apps/app/src/app/layout.tsx` and `apps/flownau/src/app/layout.tsx` | Frontend |
| 8 | Wire component into nauthenticity Vite SPA root layout | Frontend |
| 9 | Add `TELEGRAM_RELEASE_CHANNEL_ID` CI secret; add Telegram notify step to deploy workflow | DevOps / CI |
| 10 | Add `apps/app/src/app/changelog/page.tsx` release history page | Frontend |
