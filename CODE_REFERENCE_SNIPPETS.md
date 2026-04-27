# Code Reference: Implementation Snippets

**Purpose**: Quick reference for copy-paste code during implementation

---

## 1. API Integration

### Add to `/apps/nauthenticity/dashboard/src/lib/api.ts`

```typescript
/**
 * Generate export URL for downloading account posts as text
 * User follows the link to download the file
 */
export const getExportUrl = (username: string): string => {
  return `${API_URL}/accounts/${username}/export/txt`;
};
```

**Verification**: Endpoint works at: `GET /api/v1/accounts/{username}/export/txt`

---

## 2. ProfileActionsBar Component (New File)

### Create `/apps/nauthenticity/dashboard/src/components/ProfileActionsBar.tsx`

```typescript
import React from 'react';
import { Download, RefreshCw, Database, Loader2 } from 'lucide-react';

interface ProfileActionsBarProps {
  username: string;
  isIngesting: boolean;
  onExport: () => void;
  onUpdateSync: () => void;
  onScrape: (limit: number) => void;
}

export const ProfileActionsBar: React.FC<ProfileActionsBarProps> = ({
  username,
  isIngesting,
  onExport,
  onUpdateSync,
  onScrape,
}) => {
  const [scrapeLimit, setScrapeLimit] = React.useState<number>(50);

  const handleScrapeSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onScrape(scrapeLimit);
  };

  return (
    <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap' }}>
      {/* Export button */}
      <a
        href={`/api/v1/accounts/${username}/export/txt`}
        download
        onClick={(e) => {
          if (isIngesting) e.preventDefault();
        }}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          borderRadius: '4px',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          cursor: isIngesting ? 'not-allowed' : 'pointer',
          opacity: isIngesting ? 0.6 : 1,
          textDecoration: 'none',
          transition: 'all 0.2s',
        }}
        title="Download profile metadata as text file"
      >
        <Download size={16} /> Export to TXT
      </a>

      {/* Update Sync button */}
      <button
        onClick={onUpdateSync}
        disabled={isIngesting}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          padding: '0.5rem 1rem',
          fontSize: '0.875rem',
          borderRadius: '4px',
          background: 'var(--accent-primary)',
          color: 'white',
          border: 'none',
          cursor: isIngesting ? 'not-allowed' : 'pointer',
          opacity: isIngesting ? 0.6 : 1,
          transition: 'all 0.2s',
        }}
        title="Update Sync: Check for new posts (limit: 50)"
      >
        {isIngesting ? <Loader2 size={16} className="animate-spin" /> : <RefreshCw size={16} />}
        Update Sync
      </button>

      {/* Scrape form */}
      <form onSubmit={handleScrapeSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
        <input
          type="number"
          value={scrapeLimit}
          onChange={(e) => setScrapeLimit(Number(e.target.value))}
          min={1}
          max={10000}
          disabled={isIngesting}
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            color: 'var(--text-primary)',
            padding: '0.5rem',
            borderRadius: '4px',
            width: '80px',
            cursor: isIngesting ? 'not-allowed' : 'text',
            opacity: isIngesting ? 0.6 : 1,
          }}
          title="Posts to scrape (1-10000)"
        />
        <button
          type="submit"
          disabled={isIngesting}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '0.5rem',
            padding: '0.5rem 1rem',
            fontSize: '0.875rem',
            borderRadius: '4px',
            background: '#444',
            color: 'white',
            border: 'none',
            cursor: isIngesting ? 'not-allowed' : 'pointer',
            opacity: isIngesting ? 0.6 : 1,
            transition: 'all 0.2s',
          }}
          title="Scrape historical posts"
        >
          {isIngesting ? <Loader2 size={16} className="animate-spin" /> : <Database size={16} />}
          Scrape
        </button>
      </form>
    </div>
  );
};
```

---

## 3. BrandContentView Integration

### Add to `/apps/nauthenticity/dashboard/src/pages/BrandContentView.tsx`

#### Step 1: Update Imports (top of file)

```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import React from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getBrandOwnedProfiles,
  getAccount,
  getMediaUrl,
  ingestAccount,        // ADD THIS
  getProfileProgress,   // ADD THIS
} from '../lib/api';
import { Database, ArrowRight } from 'lucide-react';
import { PostGrid } from '../components/PostGrid';
import { ProfileActionsBar } from '../components/ProfileActionsBar'; // ADD THIS
```

#### Step 2: Add State in Component

```typescript
export const BrandContentView = () => {
  const { brandId } = useParams<{ brandId: string }>();
  const navigate = useNavigate();
  const [selectedUsername, setSelectedUsername] = React.useState<string | null>(null);
  const [sort, setSort] = React.useState<'recent' | 'oldest' | 'likes' | 'comments'>('recent');
  const [isIngesting, setIsIngesting] = React.useState(false); // ADD THIS
```

#### Step 3: Add useQuery for Progress (after selectedAccount useQuery)

```typescript
  // Poll progress when ingesting
  const { data: progress, isLoading: loadingProgress } = useQuery({
    queryKey: ['profile-progress', selectedUsername],
    queryFn: () => getProfileProgress(selectedUsername!),
    enabled: !!selectedUsername && isIngesting,
    refetchInterval: isIngesting ? 2000 : false,
  });
```

#### Step 4: Add useMutation for Ingest (after progress useQuery)

```typescript
  // Ingest mutation (scrape/sync)
  const ingestMutation = useMutation({
    mutationFn: ingestAccount,
    onMutate: () => setIsIngesting(true),
    onSuccess: () => {
      navigate(`/progress/${selectedUsername}`, { 
        state: { username: selectedUsername } 
      });
    },
    onError: (error: Error) => {
      console.error('Ingest failed:', error);
      alert(`Ingest failed: ${error.message}`);
      setIsIngesting(false);
    },
    onSettled: () => setIsIngesting(false),
  });
```

#### Step 5: Replace Action Bar in Detail View

**Find** (lines 74-91):
```typescript
        <div style={{ marginBottom: '1.5rem', display: 'flex', gap: '1rem', flexWrap: 'wrap' }}>
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
        </div>
```

**Replace with**:
```typescript
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
            isIngesting={isIngesting}
            onExport={() => {}} // Export is automatic via link
            onUpdateSync={() => {
              ingestMutation.mutate({
                username: selectedAccount.username,
                limit: 50,
                updateSync: true,
              });
            }}
            onScrape={(limit) => {
              ingestMutation.mutate({
                username: selectedAccount.username,
                limit,
              });
            }}
          />
        </div>
```

---

## 4. ProgressView Page (New File)

### Create `/apps/nauthenticity/dashboard/src/pages/ProgressView.tsx`

```typescript
import React, { useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { getProfileProgress } from '../lib/api';
import { ChevronLeft, Download, BarChart3, Clock } from 'lucide-react';

export const ProgressView = () => {
  const { username } = useParams<{ username: string }>();
  const navigate = useNavigate();

  if (!username) {
    return <div>Username not found in URL</div>;
  }

  const { data: progress, isLoading, isError } = useQuery({
    queryKey: ['profile-progress', username],
    queryFn: () => getProfileProgress(username),
    refetchInterval: 2000, // Poll every 2 seconds
  });

  if (isLoading) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center' }}>
        <p>Loading progress...</p>
      </div>
    );
  }

  if (isError || !progress) {
    return (
      <div style={{ padding: '2rem', textAlign: 'center', color: 'red' }}>
        <p>Failed to load progress</p>
        <button onClick={() => navigate(-1)} style={{ marginTop: '1rem' }}>
          Go Back
        </button>
      </div>
    );
  }

  const summary = progress.summary;
  const downloadPct = Math.round(summary.downloadPct);
  const transcriptPct = Math.round(summary.transcriptPct);
  const isComplete = summary.phase === 'complete' || summary.phase === 'finished';

  return (
    <div className="fade-in" style={{ padding: '2rem' }}>
      {/* Back button */}
      <button
        onClick={() => navigate(-1)}
        style={{
          background: 'none',
          border: 'none',
          color: '#58a6ff',
          cursor: 'pointer',
          marginBottom: '2rem',
          display: 'flex',
          alignItems: 'center',
          gap: '4px',
          padding: 0,
          fontWeight: 500,
          fontSize: '0.95rem',
        }}
      >
        <ChevronLeft size={18} /> Back
      </button>

      <h1 style={{ marginBottom: '0.5rem', fontSize: '2rem' }}>Progress: @{username}</h1>
      <p style={{ color: 'var(--text-secondary)', marginBottom: '2rem' }}>
        Phase: <strong>{summary.phase}</strong>
        {summary.isPaused && ' (Paused)'}
      </p>

      {/* Summary Stats */}
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))',
          gap: '1rem',
          marginBottom: '2rem',
        }}
      >
        {/* Total Posts */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Total Posts
          </p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '1.5rem', fontWeight: 'bold' }}>
            {summary.totalPosts}
          </p>
        </div>

        {/* Download Progress */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Downloads
          </p>
          <div style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                height: '20px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#28a745',
                  height: '100%',
                  width: `${downloadPct}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {summary.localMedia} / {summary.totalMedia} ({downloadPct}%)
            </p>
          </div>
        </div>

        {/* Transcription Progress */}
        <div
          style={{
            background: 'var(--card-bg)',
            border: '1px solid var(--border)',
            borderRadius: '8px',
            padding: '1rem',
          }}
        >
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '0.85rem' }}>
            Transcriptions
          </p>
          <div style={{ marginTop: '0.5rem' }}>
            <div
              style={{
                background: 'rgba(255,255,255,0.1)',
                borderRadius: '4px',
                height: '20px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  background: '#0969da',
                  height: '100%',
                  width: `${transcriptPct}%`,
                  transition: 'width 0.3s',
                }}
              />
            </div>
            <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem', fontWeight: 'bold' }}>
              {summary.transcribedPosts} / {summary.videoPostsTotal} ({transcriptPct}%)
            </p>
          </div>
        </div>
      </div>

      {/* Active Jobs */}
      {progress.activeJobs.length > 0 && (
        <div style={{ marginBottom: '2rem' }}>
          <h3 style={{ marginBottom: '1rem' }}>Active Jobs</h3>
          {progress.activeJobs.map((job) => (
            <div
              key={job.id}
              style={{
                background: 'var(--card-bg)',
                border: '1px solid var(--border)',
                borderRadius: '8px',
                padding: '1rem',
                marginBottom: '0.5rem',
              }}
            >
              <p style={{ margin: 0, fontWeight: 'bold' }}>
                {job.name} - {Math.round(job.progress)}%
              </p>
              {job.progressData?.step && (
                <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Step: {job.progressData.step}
                </p>
              )}
              {job.progressData?.currentItem && (
                <p style={{ margin: '0.25rem 0 0 0', fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                  Current: {job.progressData.currentItem.type} from{' '}
                  {new Date(job.progressData.currentItem.postedAt).toLocaleDateString()}
                </p>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Completion Message */}
      {isComplete && (
        <div
          style={{
            background: 'rgba(40, 167, 69, 0.1)',
            border: '1px solid #28a745',
            borderRadius: '8px',
            padding: '1rem',
            color: '#28a745',
          }}
        >
          <p style={{ margin: 0, fontWeight: 'bold' }}>✓ Ingestion Complete!</p>
          <p style={{ margin: '0.5rem 0 0 0', fontSize: '0.9rem' }}>
            All posts, media, and transcriptions are ready for review.
          </p>
        </div>
      )}
    </div>
  );
};
```

---

## 5. Router Configuration

### Add to `/apps/nauthenticity/dashboard/src/main.tsx` (or your router file)

```typescript
import { ProgressView } from './pages/ProgressView'; // Add import

const router = createBrowserRouter([
  {
    path: '/',
    element: <Layout />,
    children: [
      // ... existing routes
      {
        path: '/progress/:username',
        element: <ProgressView />,
      },
      // ... more routes
    ],
  },
]);
```

---

## 6. CSS Helper (Optional)

### Add to your CSS file for spinner animation

```css
@keyframes spin {
  from {
    transform: rotate(0deg);
  }
  to {
    transform: rotate(360deg);
  }
}

.animate-spin {
  animation: spin 1s linear infinite;
}
```

Or use Tailwind if available: `className="animate-spin"`

---

## Testing Checklist

```typescript
// Test 1: Export button works
const exportUrl = `${API_URL}/accounts/${username}/export/txt`;
// Open in browser: should download file

// Test 2: Update Sync triggers correctly
ingestMutation.mutate({ username: 'test_user', limit: 50, updateSync: true });
// Check: Should POST to /ingest, navigate to /progress/test_user

// Test 3: Scrape with custom limit
ingestMutation.mutate({ username: 'test_user', limit: 2000 });
// Check: Should POST to /ingest with limit=2000

// Test 4: Progress page loads and polls
navigate(`/progress/test_user`);
// Check: Should poll /accounts/test_user/progress every 2 seconds

// Test 5: Progress updates in real-time
// Monitor network tab: Should see GET /progress requests every 2 seconds
// Check: Progress bars animate smoothly
```

---

## Common Gotchas

### Export doesn't work?
- Check: Browser allows downloads from this domain
- Check: CORS headers on backend (should be fine)
- Check: URL is properly constructed: `${API_URL}/accounts/${username}/export/txt`

### Mutation isn't firing?
- Check: `ingestAccount` is imported from `api.ts`
- Check: Payload matches expected shape: `{ username, limit, updateSync? }`
- Check: No errors in browser console

### Progress page doesn't update?
- Check: `refetchInterval: 2000` is set
- Check: Query is enabled: `enabled: !!username`
- Check: Network tab shows requests every 2 seconds

### UI is misaligned?
- Check: All style objects match existing inline CSS pattern
- Check: `alignItems: 'center'` on flexbox containers
- Check: Responsive classes work on mobile (test with devtools)

---

End of Code Reference
