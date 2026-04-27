# Future Refactoring Plans

## 1. Unified Content Pipeline Entity (Priority: Medium)

**Status**: Design Phase (2026-04-27)
**Trigger**: Discovered on 2026-04-27 when deleting an Idea cascaded and broke associated Compositions

### Current Problem

The content pipeline is fragmented across multiple entities:
- `ContentIdea` → represents the ideation stage
- `Composition` → represents draft/rendered content
- Separate `status` fields on each entity

**Issues:**
- **Cascade deletes**: Deleting an Idea removes it everywhere, even if a Composition was already created from it
- **Data duplication**: Fields like `ideaText`, `format`, `language` exist on both entities
- **Implicit relationships**: The link between Idea and Composition is implicit (via `idea` foreign key), not explicit in the state machine
- **UI complexity**: Three separate tabs (Ideas, Pool, Compositions) filter the same logical pipeline by status, but require three different queries
- **Consistency**: Same content is discoverable at different "addresses" and can be orphaned

### Proposed Solution

Introduce a single `ContentPipeline` (or `ContentItem`) entity that evolves through stages:

```
ContentPipeline {
  id: string
  brandId: string
  
  -- Core content (immutable after stage transitions)
  ideaText: string
  format: ContentFormat ('reel' | 'carousel' | 'head_talk' | etc)
  language: string
  
  -- Metadata from ideation (added in IDEA stage)
  framework?: string        // Ideation strategy
  principles?: string       // Engagement best practices
  inspoSource?: string      // Where the idea came from (InspoBase, manual, etc)
  
  -- Creative direction (added in DRAFT stage)
  creative?: CreativeDirection  // Scene sequence, slots, caption, hashtags
  template?: { id, name, ... }  // Which template was used
  payload?: unknown            // Dynamic template data
  
  -- Rendering (added in RENDERING → RENDERED stage)
  videoUrl?: string         // CDN URL to rendered video
  userUploadedMediaUrl?: string  // For head_talk manual uploads
  
  -- Publishing (added in later stages)
  publishedUrl?: string
  publishedPlatforms?: string[]  // ['instagram', 'tiktok', ...]
  externalIds?: Record<string, string>  // { instagram: '123456', tiktok: '789' }
  
  -- State machine
  status: 'IDEA' | 'DRAFT' | 'APPROVED' | 'RENDERING' | 'RENDERED' 
         | 'SCHEDULED' | 'PUBLISHING' | 'PUBLISHED' | 'FAILED' | 'ARCHIVED'
  
  failureReason?: string    // If status = FAILED
  
  -- Audit trail
  createdAt: DateTime
  updatedAt: DateTime
  archivedAt?: DateTime
  usageCount: Int           // How many times rendered/published
  lastUsedAt?: DateTime
}
```

### Benefits

1. **Single source of truth**: One entity represents the entire lifecycle
2. **Safe deletion**: Archive → filter out, don't cascade delete
3. **Implicit state machine**: `status` field enforces valid transitions
4. **Reduced duplication**: `ideaText`, `format`, `language` stored once
5. **Simpler filtering**: UI tabs filter same table by status instead of querying different entities
6. **Audit trail**: Track complete journey from idea → published
7. **Reusability**: Same idea can generate multiple drafts/renders without duplication
8. **Recovery**: Archived content is restorable, never truly deleted

### UI Changes

```
Ideas Tab:
  Filter: status IN ['IDEA']
  Actions: Edit ideaText, Delete (archive), Draft (status → DRAFT), Approve (status → APPROVED)

Pool Tab (Drafts):
  Filter: status IN ['DRAFT', 'APPROVED']
  Actions: Open editor, Approve, Compose (status → RENDERING), Delete (archive)

Compositions Tab:
  Filter: status IN ['RENDERING', 'RENDERED', 'SCHEDULED', 'PUBLISHING', 'PUBLISHED', 'FAILED']
  Actions: View video, Publish, Mark published, Archive
  
Archived (future):
  Filter: status IN ['ARCHIVED']
  Actions: Restore (status → previous)
```

### Implementation Path

**Phase 1: Schema**
- Create new `ContentPipeline` schema
- Backfill existing Ideas + Compositions into it
- Keep old tables for 2-3 releases during migration

**Phase 2: API**
- Write new endpoints that use `ContentPipeline`
- Old endpoints delegate to new schema with backward compat wrapper
- Update `compose`, `render`, `publish` operations to use unified entity

**Phase 3: UI**
- Replace three separate components with unified `ContentPipelineList`
- Update actions (approve, compose, publish) to use new API
- Test all status transitions end-to-end

**Phase 4: Data Cleanup**
- Archive old Ideas/Compositions tables after stable release
- Export data for compliance audit trail

### Migration Considerations

- **Cascade rename**: `ContentIdea.ideaText` → `ContentPipeline.ideaText` (no semantic change)
- **New fields**: Status becomes explicit state machine (easier to enforce)
- **Relationships**: Drop `Composition.idea` FK, use `ContentPipeline.id` directly
- **Queries**: Simplify from `query ideas(); query compositions()` → `query contentPipeline(statusFilter)`
- **Rollback**: Keep old tables read-only during transition period

### Risk Mitigation

- Use feature flags to gate ContentPipeline queries during rollout
- Dual-write to both old + new schema during transition
- Comprehensive test suite for status transitions
- Monitoring on cascade delete incidents

---

## 2. Template System Improvements (Priority: Medium-Low)

**Status**: Scoped (2026-04-27)

### Ideas for future enhancement
- Template versioning (track edits, rollback capability)
- Template sharing between brands/workspaces
- Template usage analytics (which templates drive engagement)
- A/B testing framework (track two template variants side-by-side)

---

## 3. Asset Curation Optimization (Priority: Low)

**Status**: Ideas (2026-04-27)

Current asset selection is basic (duration filter + random offset). Future improvements:
- ML-based similarity scoring (choose visually diverse assets across scenes)
- Asset performance tracking (which assets get clicked/liked most)
- Smart rotation strategy (cycle through asset library to avoid visual repetition)
- Audio muting already done; future: background music overlay, sound design

