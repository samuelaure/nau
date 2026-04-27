# Feature Comparison Matrix: Legacy vs. Current Implementation

**Generated**: 2026-04-27

---

## UI Features Side-by-Side

### Profile Header Section
```
┌────────────────────────────────────────────────────────────────┐
│  LEGACY (AccountView.tsx)                                      │
├────────────────────────────────────────────────────────────────┤
│  Profile image (80px)  @username                               │
│                        Last scraped: 2026-04-27 14:30:00       │
│                        [Clean, informative]                    │
└────────────────────────────────────────────────────────────────┘

┌────────────────────────────────────────────────────────────────┐
│  CURRENT (BrandContentView.tsx)                                │
├────────────────────────────────────────────────────────────────┤
│  Profile image (80px)  @username                               │
│                        500 posts                               │
│                        [Missing last scraped date]             │
└────────────────────────────────────────────────────────────────┘
```

✏️ **Suggestion**: Add `lastScrapedAt` field to match legacy

---

### Action Controls Section

#### LEGACY (AccountView.tsx)
```
┌────────────────────────────────────────────────────────────────────────┐
│  Action Bar                                                            │
├────────────────────────────────────────────────────────────────────────┤
│  [Sort dropdown: Recent ▼] [Export to TXT] [Update Sync]             │
│                             ↓               ↓                          │
│                           Downloads      POST /ingest                 │
│                           text file      limit=50                     │
│                                          updateSync=true              │
│                                                                        │
│  [Scrape Limit: 50] [Scrape] → POST /ingest(limit) → navigate to    │
│                                                       /progress        │
├────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                         │
│  ✅ Sort by recent/oldest/likes/comments                              │
│  ✅ Export full profile as TXT                                         │
│  ✅ Quick sync (50 posts) for new content                              │
│  ✅ Custom scrape (1-10000 posts)                                      │
│  ✅ Progress tracking after scrape starts                              │
└────────────────────────────────────────────────────────────────────────┘
```

#### CURRENT (BrandContentView.tsx)
```
┌────────────────────────────────────────────────────────────────────────┐
│  Action Bar                                                            │
├────────────────────────────────────────────────────────────────────────┤
│  [Sort dropdown: Recent ▼]                                             │
│                                                                         │
│  [Nothing else]                                                        │
├────────────────────────────────────────────────────────────────────────┤
│  Capabilities:                                                         │
│  ✅ Sort by recent/oldest/likes/comments                               │
│  ❌ NO export                                                          │
│  ❌ NO update sync                                                     │
│  ❌ NO scrape controls                                                 │
│  ❌ NO progress tracking                                               │
└────────────────────────────────────────────────────────────────────────┘
```

---

## Component Architecture Comparison

### LEGACY (AccountView.tsx)
```typescript
                    AccountView
                        |
        ┌───────────────┼───────────────┐
        |               |               |
    [Header]        [ActionBar]    [PostGrid]
    - Image         - Sort         - Posts
    - Username      - Export       - Media
    - LastScraped   - Sync         - Captions
                    - Scrape
                    - Progress
                    
    All in one component (~180 lines)
```

### CURRENT (BrandContentView.tsx)
```typescript
                  BrandContentView
                        |
        ┌───────────────┼───────────────┐
        |               |
    [Grid View]    [Detail View]
    - Profiles        |
    - Cards        [Header]     [Sort]     [PostGrid]
    - Click      - Image       - Dropdown  - Posts
    - Shows      - Username   - (missing  - Media
      last       - PostCount    features) - Captions
      scraped
      date
      
    Two views, incomplete detail view
```

---

## API Integration Map

### Backend Endpoints (All Functional ✅)

```
────────────────────────────────────────────────────────────────────
Endpoint                          Method  Used In     Status
────────────────────────────────────────────────────────────────────
/api/v1/accounts/{username}       GET     Both       ✅ Works
/api/v1/accounts/{username}/
  export/txt                       GET     Legacy     ❌ Not in Current
                                          only       (but endpoint works)
                                          
/api/v1/ingest                    POST    Legacy     ❌ Not in Current
                                          only       (but endpoint works)
                                          
/api/v1/accounts/{username}/
  progress                         GET     Legacy     ❌ Not in Current
                                          only       (but endpoint works)
                                          
/api/v1/brands/{brandId}/
  owned-profiles                   GET     Current    ✅ Integrated
                                          
────────────────────────────────────────────────────────────────────
```

### Frontend API Client (lib/api.ts)

```typescript
// LEGACY requires these functions:
✅ getAccount(username)              // Already defined
✅ ingestAccount(payload)            // Already defined (line 154)
✅ getProfileProgress(username)      // Already defined (line 217)
❌ getExportUrl(username)            // MISSING - Need to add

// CURRENT uses these:
✅ getBrandOwnedProfiles(brandId)    // Already defined
✅ getAccount(username)              // Already defined
✅ getMediaUrl(url)                  // Already defined
❌ ingestAccount()                   // UNUSED - Need to wire up
❌ getProfileProgress()              // UNUSED - Need to wire up
❌ getExportUrl()                    // MISSING - Need to add
```

---

## User Workflow Comparison

### Workflow 1: "Check for New Posts"

#### LEGACY
```
User: "I want to check for new posts"
  → Click "Update Sync" button
  → Mutation triggers: POST /ingest(limit=50, updateSync=true)
  → Redirect to progress page
  → Watch real-time download/transcription %
  → Return to AccountView, see new posts
Success: ✅ Complete in 1-2 minutes
```

#### CURRENT
```
User: "I want to check for new posts"
  → No "Update Sync" button available
  → No API to call for incremental sync
  → User is stuck 🔴
  → User either:
     a) Switch to legacy dashboard
     b) Use curl to call API manually
     c) Give up
Success: ❌ Workflow blocked
```

---

### Workflow 2: "Export Posts for Analysis"

#### LEGACY
```
User: "I need to export @username's posts as TXT"
  → Click "Export to TXT" button
  → Browser downloads `@username_export.txt`
  → Opens file in text editor
  → Imports into analysis tool
Success: ✅ Complete in 30 seconds
```

#### CURRENT
```
User: "I need to export @username's posts as TXT"
  → No export button exists
  → User cannot download data from UI
  → User either:
     a) Request developer access to curl API
     b) Manually copy-paste posts from grid
     c) Give up
Success: ❌ Workflow blocked
```

---

### Workflow 3: "Research 2000 Historical Posts"

#### LEGACY
```
User: "I need to analyze @username's last 2000 posts"
  → Change scrape limit from 50 to 2000
  → Click "Scrape" button
  → Redirect to progress page
  → See "Downloading (45%)" indicator
  → Wait 10-15 minutes
  → Return to view, all posts available for analysis
Success: ✅ Complete in 15 minutes
```

#### CURRENT
```
User: "I need to analyze @username's last 2000 posts"
  → No scrape button exists
  → No limit input available
  → User cannot initiate scrape from UI
  → User either:
     a) Contact admin to run scrape manually
     b) Use API curl (if they have knowledge)
     c) Give up
Success: ❌ Workflow blocked
```

---

### Workflow 4: "Monitor Long-Running Scrape"

#### LEGACY
```
User: "Is the 5000-post scrape still running?"
  → Navigate to /progress?username=@handle
  → See:
     • 2400/5000 posts downloaded (48%)
     • 1200/2400 posts transcribed (50%)
     • Current job: "Transcribe post_12345.mp4"
     • Active: Download, Transcribe queues
  → Know exactly where it is
  → Can see ETA
Success: ✅ Full visibility
```

#### CURRENT
```
User: "Is the 5000-post scrape still running?"
  → No progress page exists
  → User has no visibility
  → User either:
     a) Check server logs (if admin)
     b) Guess and hope it's working
     c) Refresh page repeatedly hoping new posts appear
     d) Give up
Success: ❌ No visibility
```

---

## Code Reuse Analysis

### Fully Reusable Components
```
Component                  Location                  % Reusable
──────────────────────────────────────────────────────────────
Sort Dropdown             AccountView (lines 72-87)     0%
                          (logic works, refactor safe)
                          
Export Button             AccountView (lines 89-108)   100%
                          (copy-paste, no state)
                          
Update Sync Button        AccountView (lines 109-130)  100%
                          (use same mutation)
                          
Scrape Form               AccountView (lines 131-174)  100%
                          (use same mutation)
                          
Progress Page             /pages/Progress              0%
                          (doesn't exist - new build)
──────────────────────────────────────────────────────────────
```

### Partially Reusable Patterns
```
Pattern                   Source                 Adaptation Needed
────────────────────────────────────────────────────────────────
useQuery hooks           BrandContentView        ✅ Copy-paste
useMutation pattern      BrandContentView        ✅ Copy-paste
Style object             BrandContentView        ✅ Match + extend
Icon library             Both use lucide-react   ✅ Add new icons
Progress polling         Progress.tsx            🔄 Modify for modal
Navigation handler       Both use useNavigate    ✅ Copy-paste
────────────────────────────────────────────────────────────────
```

---

## Technical Debt Scorecard

| Aspect | Legacy | Current | Gap | Risk |
|--------|--------|---------|-----|------|
| **Feature Completeness** | 100% | 25% | 75% | HIGH |
| **User Workflows** | 100% | 25% | 75% | HIGH |
| **API Integration** | 100% | 33% | 67% | HIGH |
| **Code Organization** | Good | Good | None | LOW |
| **Component Reusability** | N/A | Good | None | LOW |
| **Performance** | Good | Good | None | LOW |

---

## Migration Lessons

### What Worked Well (in current implementation)
- ✅ Profile grid interface (multi-brand view is better)
- ✅ React Query setup (correct pattern)
- ✅ Route structure and navigation
- ✅ Styling approach (inline CSS works)
- ✅ Component decomposition
- ✅ PostGrid reuse

### What Didn't Migrate (and why)
- ❌ Export functionality (low priority initially?)
- ❌ Sync/Scrape controls (assumed would add later?)
- ❌ Progress tracking (complex component, deprioritized?)

### Recommendations for Future Migrations
1. Feature parity checklist before launch
2. Side-by-side testing with legacy interface
3. User acceptance testing before cutover
4. Gradual feature rollout (if possible)
5. Keep legacy available during transition period

---

## Summary Table: Feature Status

```
Feature                Implementation   Line #      Complexity   Time
────────────────────────────────────────────────────────────────────
Sort Dropdown          ✅ Current       74-90      Trivial      0min
Export Button          ❌ Missing       -          Trivial      15m
Update Sync Button     ❌ Missing       -          Low          30m
Scrape Form            ❌ Missing       -          Low          30m
Scrape Mutation        ❌ Missing       -          Low          30m
Progress Page          ❌ Missing       -          Medium       1.5h
Progress Query         ❌ Missing       -          Low          30m
Back Button            ✅ Current       37-53      Trivial      0min
Profile Grid           ✅ Current       111-181    Good         0min
Detail View            ✅ Current       34-95      Good         0min
────────────────────────────────────────────────────────────────────
TOTAL MISSING FEATURES                            ~4 hours
TOTAL COMPLETE FEATURES                           ~0 hours
```

---

## Appendix: Line-by-Line File Comparison

### AccountView.tsx (Legacy)
```typescript
Line    Component               Status    Notes
────────────────────────────────────────────────────────────────
1-8     Imports                 ✅        Need to add ingest, progress
10-26   Component & params      ✅        Similar structure in current
28-68   Header + image          ✅        Current has this
71-88   Sort dropdown           ✅        Current has this
89-108  Export button           ❌        MISSING from current
109-130 Update Sync button      ❌        MISSING from current
131-174 Scrape form + button    ❌        MISSING from current
176-179 PostGrid + return       ✅        Current has this
```

### BrandContentView.tsx (Current)
```typescript
Line    Component               Status    Notes
────────────────────────────────────────────────────────────────
1-6     Imports                 ⚠️        Missing ingest, progress
8-12    Component & state       ✅        Good pattern
14-29   useQuery for profiles   ✅        Good
34-95   Detail view             ⚠️        Missing action controls
37-53   Back button             ✅        Nice addition
55-72   Header + image          ✅        Good
74-91   Sort only               ❌        Should have action controls here
93      PostGrid               ✅        Good
98-199  Grid view              ✅        Good (different from legacy)
```

---

End of Feature Comparison Matrix
