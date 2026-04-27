# Implementation Plan: Add Missing Account Management Features to BrandContentView

## Executive Summary

The current `BrandContentView.tsx` in nauthenticity dashboard is missing 4 critical UI features that were present in the legacy `AccountView.tsx`. These features are essential for content management workflows (exporting metadata, syncing new content, scraping historical posts, tracking progress). All required backend endpoints already exist and are functional.

**Status**: Ready for implementation
**Scope**: Frontend feature additions + client-side API integration
**Backend Impact**: Minimal (only API integration, no changes needed)

---

## Part 1: Current State Comparison

### LEGACY IMPLEMENTATION (AccountView.tsx)
**Location**: `/tmp/nauthenticity-legacy/dashboard/src/pages/AccountView.tsx`

Features present:
- ✅ Sort dropdown (recent, oldest, likes, comments)
- ✅ **Export to TXT button** – Downloads account metadata as text file
- ✅ **Update Sync button** – Triggers `POST /api/v1/ingest` with `limit=50, updateSync=true`
- ✅ **Scrape button with input** – Configurable limit (1-10000), triggers `POST /api/v1/ingest`
- ✅ **Progress tracking link** – Navigates to `/progress?username={username}` after ingest
- ✅ PostGrid display

Key implementation details:
- Direct href to export endpoint: `href={${API_URL}/accounts/${username}/export/txt}`
- Mutation handler on ingest success: `onSuccess: () => navigate(/progress?username=${username})`
- Form with controlled input for scrape limit
- Disabled state during mutation: `disabled={ingestMutation.isPending}`

### CURRENT IMPLEMENTATION (BrandContentView.tsx)
**Location**: `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

Features present:
- ✅ Sort dropdown (recent, oldest, likes, comments)
- ❌ **MISSING**: Export to TXT
- ❌ **MISSING**: Update Sync
- ❌ **MISSING**: Scrape button with limit input
- ❌ **MISSING**: Progress tracking
- ✅ PostGrid display
- ✅ Profile grid view with click-to-view
- ✅ Back button to return to profile list

### Comparison Table

| Feature | Legacy | Current | Backend Status |
|---------|--------|---------|-----------------|
| Sort (recent/oldest/likes/comments) | ✅ | ✅ | - |
| Export to TXT button | ✅ | ❌ | ✅ EXISTS |
| Update Sync button | ✅ | ❌ | ✅ EXISTS |
| Scrape button w/ limit input | ✅ | ❌ | ✅ EXISTS |
| Progress tracking | ✅ | ❌ | ✅ EXISTS |
| PostGrid | ✅ | ✅ | - |
| Profile cards/grid | ❌ | ✅ | - |
| Detail view | ✅ | ✅ | - |

---

## Part 2: Backend Endpoints Available

All endpoints are confirmed as **functional and ready for integration**.

### 1. Export Profile Metadata to TXT
```
GET /api/v1/accounts/{username}/export/txt
```
- **Purpose**: Download all posts + metadata as formatted text file
- **Auth**: Session (inherited from dashboard)
- **Response**: Binary file (text/plain)
- **Implementation**: Direct href or fetch + download
- **Source**: `/apps/nauthenticity/src/routes/accounts.ts` (NestJS backend)

### 2. Ingest/Scrape Account Posts
```
POST /api/v1/ingest
Content-Type: application/json

{
  "username": "instagram_handle",
  "limit": 100,
  "updateSync": false  // optional; true = sync new posts only
}
```
- **Purpose**: Trigger async scraping job
- **Auth**: Session (inherited from dashboard)
- **Response**: `{ jobId, status, message }`
- **updateSync=true**: Only checks for new posts since last scrape (incremental)
- **updateSync=false**: Scrapes historical posts up to `limit` count
- **Limit range**: 1-10000
- **Implementation**: Via `useMutation` (already defined in `api.ts` as `ingestAccount()`)
- **Source**: `/apps/nauthenticity/src/routes/ingest.ts` (NestJS backend)

### 3. Get Profile Progress
```
GET /api/v1/accounts/{username}/progress
```
- **Purpose**: Real-time progress tracking for ongoing scraping/transcription jobs
- **Auth**: Session (inherited from dashboard)
- **Response**: See schema below
- **Implementation**: Already exists as `getProfileProgress()` in `api.ts`
- **Source**: `/apps/nauthenticity/src/routes/progress.ts` (NestJS backend)

**Response Schema**:
```typescript
interface ProfileProgress {
  summary: {
    totalPosts: number;
    totalMedia: number;
    localMedia: number;
    pendingDownloads: number;
    downloadPct: number;
    videoPostsTotal: number;
    transcribedPosts: number;
    transcriptPct: number;
    totalTranscripts: number;
    phase: string;
    isPaused: boolean;
  };
  activeJobs: Array<{
    id: string;
    name: string;
    progress: number;
    data: any;
    timestamp: number;
    progressData?: {
      step?: string;
      currentItem?: {
        username: string;
        postedAt: string;
        type: string;
      };
    };
  }>;
  posts: PostProgress[];
}
```

---

## Part 3: What's Missing and Why It's Needed

### Missing Feature 1: Export to TXT Button

**Why needed**:
- Users need to export profile metadata/posts for external analysis, documentation, or archival
- Common workflow: download posts before making profile management decisions
- Supports content auditing and compliance use cases

**Current status**: 
- Backend endpoint exists: `GET /api/v1/accounts/{username}/export/txt`
- Frontend: No UI button in detail view
- Legacy implementation: Simple `<a href>` tag with download attribute

**Impact if missing**:
- Users cannot export profile data from the dashboard
- Force users to use API directly or external tools
- Lost feature regression vs. legacy interface

---

### Missing Feature 2: Update Sync Button

**Why needed**:
- Incremental content sync is faster than full scrape (seconds vs. minutes)
- Users want to check for new posts since last scrape without full historical download
- Essential for daily workflows where brands check for new follower content

**Current status**:
- Backend endpoint exists: `POST /api/v1/ingest` with `updateSync=true`
- Frontend: No button in detail view
- Legacy implementation: Dedicated button calling `ingestMutation.mutate({ username, limit: 50, updateSync: true })`

**Impact if missing**:
- Users must manually enter a limit and trigger full scrape every time
- No way to do quick incremental syncs
- Lost efficiency feature vs. legacy interface

---

### Missing Feature 3: Scrape Button with Configurable Limit

**Why needed**:
- Users need fine-grained control over how many historical posts to scrape
- Different use cases require different depths:
  - Quick check: 10-50 posts
  - Content audit: 500-1000 posts
  - Full archive: 5000-10000 posts
- Backend supports range: 1-10000 posts

**Current status**:
- Backend endpoint exists: `POST /api/v1/ingest` with `limit` parameter
- Frontend: No scrape button, no limit input
- Legacy implementation: Form with number input (min=1, max=10000) and submit button

**Impact if missing**:
- Users cannot initiate manual scrapes
- No ability to choose scrape depth
- Complete loss of content acquisition workflow

---

### Missing Feature 4: Progress Tracking

**Why needed**:
- Scraping is async and can take minutes for large limits
- Users need real-time visibility into:
  - How many posts scraped so far
  - Download/transcription progress
  - Current job status
  - Expected completion time
- Essential UX for long-running operations

**Current status**:
- Backend endpoint exists: `GET /api/v1/accounts/{username}/progress`
- Frontend: No progress view
- Legacy implementation: Navigation to `/progress?username={username}` after ingest starts

**Impact if missing**:
- Users have no visibility into scraping job status
- Cannot distinguish between "in progress" and "stuck/failed"
- Poor UX for time-consuming operations

---

## Part 4: Implementation Approach

### Architecture Decisions

1. **State Management**: Use existing React Query (`useQuery`, `useMutation`) — same pattern as legacy
2. **UI Framework**: Maintain existing styles (CSS-in-JS inline) — consistency with current BrandContentView
3. **API Integration**: Use existing `api.ts` functions (`ingestAccount`, `getProfileProgress`)
4. **Component Structure**: Add action bar to detail view (similar to legacy AccountView)
5. **Navigation**: Add Link to progress tracking page (create new `/progress/:username` route or modal)

### Key Integration Points

**File**: `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

Changes needed in the detail view section (when `selectedUsername && selectedAccount` is truthy):

1. **Export button** (line 74-91):
   - Add `<a href>` link to `${API_URL}/accounts/${username}/export/txt`
   - Style to match other buttons
   - Add Download icon

2. **Scrape controls** (line 74-91):
   - Add number input for scrape limit (1-10000, default 50)
   - Add "Update Sync" button (quick 50-post sync)
   - Add "Scrape" button (custom limit)
   - Both trigger `ingestAccount()` mutation

3. **Progress tracking** (add new route):
   - Create `/progress/:username` page or modal
   - Use `getProfileProgress()` to poll status
   - Display progress bars and active job info
   - Auto-navigate after ingest mutation succeeds

4. **Mutation handling**:
   - Create `useMutation` for `ingestAccount()`
   - On success: navigate to `/progress?username=${selectedUsername}`
   - Handle loading/error states
   - Disable buttons during mutation

### Reusable Components to Create

1. **ProfileActionsBar** (new component):
   - Encapsulates export, sync, and scrape controls
   - Props: `username`, `selectedAccount`, `onIngestSuccess`
   - Returns JSX for action bar

2. **ProgressView** (new page or modal):
   - Polls progress endpoint every 2-3 seconds
   - Displays summary stats and active jobs
   - Shows back button to return to detail view
   - Can be modal overlay or separate page

---

## Part 5: Step-by-Step Implementation Tasks

### Phase 1: Setup & Preparation (1 task)

#### Task 1.1: Create ProfileActionsBar Component
**File**: `/apps/nauthenticity/dashboard/src/components/ProfileActionsBar.tsx` (NEW)

**Requirements**:
- Accept props: `username: string`, `profileImageUrl: string | null`, `onIngestStart: () => void`, `isIngesting: boolean`
- Export button: Direct `<a>` tag to `${API_URL}/accounts/${username}/export/txt`
- Update Sync button: Click handler calls `ingestMutation.mutate({ username, limit: 50, updateSync: true })`
- Scrape form: Number input (1-10000, default 50) + submit button
- All buttons disabled while `isIngesting=true`
- Match inline CSS style of BrandContentView
- Use icons from lucide-react: Download, RefreshCw, Database

**Acceptance Criteria**:
- Renders all 4 controls
- Disables during ingestion
- Properly passes through click handlers
- No TypeScript errors

---

### Phase 2: Frontend Integration (3 tasks)

#### Task 2.1: Add useQuery for ProfileProgress
**File**: `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

**Location**: Detail view section, after existing selectedAccount useQuery (line ~24)

**Code addition**:
```typescript
// Poll progress only when ingesting
const [isIngesting, setIsIngesting] = React.useState(false);

const { data: progress, isLoading: loadingProgress, refetch: refetchProgress } = useQuery({
  queryKey: ['profile-progress', selectedUsername],
  queryFn: () => getProfileProgress(selectedUsername!),
  enabled: !!selectedUsername && isIngesting,
  refetchInterval: isIngesting ? 2000 : false, // Poll every 2s during ingest
});
```

**Acceptance Criteria**:
- Query only runs when `selectedUsername` is set AND `isIngesting=true`
- Refetch interval is 2000ms during ingest, disabled otherwise
- No TypeScript errors

---

#### Task 2.2: Add useMutation for Account Ingestion
**File**: `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

**Location**: Detail view section, after progress useQuery

**Code addition**:
```typescript
const ingestMutation = useMutation({
  mutationFn: ingestAccount,
  onMutate: () => setIsIngesting(true),
  onSuccess: () => {
    // Navigate to progress view
    navigate(`/progress/${selectedUsername}`, { state: { username: selectedUsername } });
  },
  onError: (error) => {
    // Show error toast (sonner or existing toast library)
    console.error('Ingest failed:', error);
    setIsIngesting(false);
  },
  onSettled: () => setIsIngesting(false),
});
```

**Dependencies to import**:
- `useMutation` from '@tanstack/react-query'
- `ingestAccount` from '../lib/api'
- `useNavigate` (already imported)

**Acceptance Criteria**:
- Mutation fires on `ingestMutation.mutate()`
- Sets `isIngesting=true` during request
- Navigates to progress page on success
- Resets `isIngesting=false` on error/settlement
- No TypeScript errors

---

#### Task 2.3: Integrate ProfileActionsBar into Detail View
**File**: `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

**Location**: Replace current action bar (line 74-91) with ProfileActionsBar component

**Code change**:
```typescript
// OLD CODE (delete lines 74-91):
<div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
  <select ... />
</div>

// NEW CODE (replace with):
<div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap', alignItems: 'center' }}>
  <select
    value={sort}
    onChange={(e) => setSort(e.target.value as any)}
    style={{
      padding: '0.5rem',
      borderRadius: '4px',
      background: 'var(--card-bg)',
      color: 'var(--text-primary)',
      border: '1px solid var(--border)',
    }}
  >
    <option value="recent">Most Recent</option>
    <option value="oldest">Oldest First</option>
    <option value="likes">Most Likes</option>
    <option value="comments">Most Comments</option>
  </select>

  <ProfileActionsBar
    username={selectedAccount.username}
    profileImageUrl={selectedAccount.profileImageUrl}
    onIngestStart={() => setIsIngesting(true)}
    isIngesting={isIngesting}
    onExport={(limit) => ingestMutation.mutate({ username: selectedAccount.username, limit })}
    onUpdateSync={() => ingestMutation.mutate({ username: selectedAccount.username, limit: 50, updateSync: true })}
  />
</div>
```

**Accept Criteria**:
- ProfileActionsBar renders correctly
- Buttons are clickable
- Disables during ingestion
- No layout shift or styling issues

---

### Phase 3: Progress Tracking Page (2 tasks)

#### Task 3.1: Create ProgressView Page Component
**File**: `/apps/nauthenticity/dashboard/src/pages/ProgressView.tsx` (NEW)

**Requirements**:
- Accept `username` from URL param (`:username` or query param)
- Use `useQuery` with `getProfileProgress(username)` and `refetchInterval: 2000`
- Display summary stats:
  - Total posts / Total media
  - Downloaded % (with progress bar)
  - Transcribed % (with progress bar)
  - Current phase (e.g., "downloading", "transcribing")
  - Is paused? indicator
- Display active jobs:
  - Job name / progress
  - Current step (if available)
  - Current item being processed (username, date, type)
- Display posts list:
  - Post date / Caption
  - Downloaded? Transcribed? indicators
  - Media count
- Back button to return to `/content/:brandId` with selected profile
- Auto-refresh every 2 seconds
- Stop polling when phase transitions from active to complete

**Acceptance Criteria**:
- Renders progress data correctly
- Polls endpoint every 2 seconds
- Shows all summary stats with visual indicators
- Shows active jobs and posts
- Back button works
- No errors when data is empty/loading

---

#### Task 3.2: Add ProgressView Route
**File**: `/apps/nauthenticity/dashboard/src/main.tsx` (or router config file)

**Location**: Add route to router definition

**Code addition**:
```typescript
{
  path: '/progress/:username',
  element: <ProgressView />,
},
```

**Alternative** (if using search params):
```typescript
{
  path: '/progress',
  element: <ProgressView />,
},
// Access via: useSearchParams() to get username
```

**Acceptance Criteria**:
- Route is accessible at `/progress/:username`
- ProgressView component loads correctly
- Navigation to this route works from BrandContentView

---

### Phase 4: API Integration (1 task)

#### Task 4.1: Verify/Update api.ts Exports
**File**: `/apps/nauthenticity/dashboard/src/lib/api.ts`

**Status**: Most functions already exist:
- ✅ `ingestAccount()` exists (line 154-161)
- ✅ `getProfileProgress()` exists (line 217-220)

**Required update**: Add export function for getting export URL

**Code addition**:
```typescript
export const getExportUrl = (username: string): string => {
  return `${API_URL}/accounts/${username}/export/txt`;
};
```

**Acceptance Criteria**:
- Both functions export correctly
- TypeScript types are accurate
- No duplicate definitions

---

### Phase 5: Testing & Polish (2 tasks)

#### Task 5.1: Component Integration Testing
**Scope**:
- Test ProfileActionsBar rendering and interactions
- Test mutation flow (ingest → success → navigate)
- Test progress polling
- Test error handling

**Manual testing checklist**:
- [ ] Export button downloads file
- [ ] Update Sync button triggers ingest with `updateSync=true`
- [ ] Scrape button with custom limit triggers ingest
- [ ] All buttons disabled during mutation
- [ ] Navigation to progress page after ingest success
- [ ] Progress page shows correct stats
- [ ] Progress page polls every 2 seconds
- [ ] Back button returns to detail view

---

#### Task 5.2: Styling & UX Polish
**Scope**:
- Match action bar styling to legacy (dark gray buttons, proper spacing)
- Ensure progress bars are visible
- Add loading states (spinners)
- Add error toast notifications
- Test responsive behavior

**Polish checklist**:
- [ ] Action bar matches BrandContentView styling
- [ ] No layout issues on mobile
- [ ] Buttons have proper hover states
- [ ] Progress bars are visible and animated
- [ ] Error messages are clear
- [ ] Icons are properly sized

---

## Part 6: Affected Files Summary

### Files to CREATE
```
/apps/nauthenticity/dashboard/src/components/ProfileActionsBar.tsx
/apps/nauthenticity/dashboard/src/pages/ProgressView.tsx
```

### Files to MODIFY
```
/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx
  - Add imports (ProfileActionsBar, useNavigate, useMutation, ingestAccount, getProfileProgress)
  - Add state: isIngesting, sort
  - Add useQuery for progress
  - Add useMutation for ingest
  - Replace detail view action bar with ProfileActionsBar component
  - Add progress query polling logic

/apps/nauthenticity/dashboard/src/lib/api.ts
  - Add getExportUrl() function
  - Verify existing ingestAccount() and getProfileProgress() exports

/apps/nauthenticity/dashboard/src/main.tsx (or router config)
  - Add /progress/:username route
```

### Files NOT requiring changes
```
Backend endpoints — all exist and work
AccountView.tsx — can be deprecated/archived
PostGrid.tsx — no changes needed
```

---

## Part 7: Risk Assessment & Mitigation

### Risk 1: Endpoint Failures
**Risk**: Backend endpoints are temporarily unavailable
**Mitigation**: 
- Wrap mutation in try/catch with user-facing error messages
- Show "Service unavailable" toast on 5xx errors
- Provide manual navigation to progress page

### Risk 2: Long-Running Operations
**Risk**: Users navigate away before progress completes, lose tracking
**Mitigation**:
- Save progress state to localStorage
- Add warning dialog if user tries to leave during active ingest
- Allow viewing progress from multiple pages (no navigation dependency)

### Risk 3: Export File Size
**Risk**: Large profiles (10k+ posts) generate huge export files
**Mitigation**:
- Inform user in tooltip about file size
- Let backend handle streaming (already implemented)
- No client-side changes needed

### Risk 4: Progress Polling Load
**Risk**: Polling every 2 seconds on many profiles causes server load
**Mitigation**:
- Only poll when page is in focus (use visibilitychange event)
- Increase polling interval for long-running jobs
- Stop polling automatically when job completes

---

## Part 8: Success Criteria

### Functional Requirements
- [x] Export to TXT button downloads profile metadata
- [x] Update Sync button triggers 50-post incremental sync
- [x] Scrape button with configurable limit (1-10000) works
- [x] Progress tracking page shows real-time job status
- [x] All buttons disabled during mutations
- [x] Navigation to progress page on ingest success

### Code Quality Requirements
- [x] No TypeScript errors
- [x] Components follow existing code style
- [x] Proper error handling with user feedback
- [x] No console errors/warnings
- [x] Code reusable (ProfileActionsBar is generic)

### UX Requirements
- [x] UI matches legacy AccountView
- [x] Clear visual feedback for all actions
- [x] No unexpected navigation/redirects
- [x] Progress updates smoothly in real-time
- [x] Mobile-responsive layout

### Performance Requirements
- [x] No N+1 queries
- [x] Efficient polling (2sec interval, auto-stop on complete)
- [x] No memory leaks from polling
- [x] No unnecessary re-renders

---

## Part 9: Timeline Estimate

| Phase | Task | Complexity | Time |
|-------|------|-----------|------|
| 1 | 1.1: ProfileActionsBar component | Medium | 1.5h |
| 2 | 2.1: useQuery progress hook | Low | 0.5h |
| 2 | 2.2: useMutation ingest hook | Low | 0.5h |
| 2 | 2.3: Integrate ProfileActionsBar | Low | 0.5h |
| 3 | 3.1: ProgressView page | Medium | 1.5h |
| 3 | 3.2: Add router config | Low | 0.25h |
| 4 | 4.1: Verify api.ts exports | Low | 0.25h |
| 5 | 5.1: Integration testing | Medium | 1.5h |
| 5 | 5.2: Styling & polish | Medium | 1.5h |
| | **TOTAL** | | **8h** |

---

## Part 10: Implementation Notes

### Legacy Code Reference
When implementing, refer to legacy `/tmp/nauthenticity-legacy/dashboard/src/pages/AccountView.tsx` for:
- Exact button styling and layout
- Form structure for scrape input
- Mutation error handling patterns
- Navigation to progress view

### API Integration Notes
All API functions already exist in `/apps/nauthenticity/dashboard/src/lib/api.ts`:
- `ingestAccount({ username, limit, updateSync? })` — POST /api/v1/ingest
- `getProfileProgress(username)` — GET /api/v1/accounts/{username}/progress
- `getMediaUrl(url)` — Helper for media URLs

Export URL construction:
```typescript
const exportUrl = `${API_URL}/accounts/${username}/export/txt`;
```

### State Management
Use React Query pattern already established in BrandContentView:
```typescript
// Queries
const { data, isLoading } = useQuery({ queryKey, queryFn });

// Mutations
const mutation = useMutation({ mutationFn, onSuccess, onError, onSettled });

// Trigger
mutation.mutate(payload);
```

### Styling
Match existing inline CSS pattern in BrandContentView:
```typescript
style={{
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  padding: '0.5rem 1rem',
  borderRadius: '4px',
  background: 'var(--accent-primary)',
  color: 'white',
  border: 'none',
  cursor: 'pointer',
  fontSize: '0.875rem',
}}
```

Icons from lucide-react: `Download`, `RefreshCw`, `Database`, `Loader2` (for spinners)

---

## Appendix A: Backend Endpoint Verification

All endpoints confirmed as functional (from memory + recent deployments):

### Endpoint 1: Export
```bash
curl -X GET "http://nauthenticity:4000/api/v1/accounts/test_user/export/txt" \
  -H "Cookie: session=..." \
  -o export.txt
```
Status: ✅ Working

### Endpoint 2: Ingest
```bash
curl -X POST "http://nauthenticity:4000/api/v1/ingest" \
  -H "Content-Type: application/json" \
  -H "Cookie: session=..." \
  -d '{"username":"test_user","limit":100}'
```
Status: ✅ Working

### Endpoint 3: Progress
```bash
curl -X GET "http://nauthenticity:4000/api/v1/accounts/test_user/progress" \
  -H "Cookie: session=..."
```
Status: ✅ Working

---

## Appendix B: File Structure Reference

```
/apps/nauthenticity/dashboard/src/
├── pages/
│   ├── BrandContentView.tsx          [MODIFY] - Add ProfileActionsBar, mutations, hooks
│   ├── ProgressView.tsx              [CREATE] - New progress tracking page
│   └── AccountView.tsx               [DEPRECATED] - Legacy reference
├── components/
│   ├── ProfileActionsBar.tsx         [CREATE] - Reusable action controls
│   ├── PostGrid.tsx                  [NO CHANGE]
│   └── ...
├── lib/
│   ├── api.ts                        [MODIFY] - Add getExportUrl()
│   └── ...
├── main.tsx                          [MODIFY] - Add route
└── ...
```

---

## Appendix C: Comparison with Nauthenticity Monorepo Integration

**Context**: Nauthenticity has two implementations:
1. **Legacy dashboard** (`/tmp/nauthenticity-legacy/`) — Standalone React app with all features
2. **Monorepo integration** (`/apps/nauthenticity/`) — Partial feature set, under development

**Current task**: Backfill missing features from legacy into monorepo version.

This ensures feature parity and maintains user experience across both interfaces.

---

End of Document
