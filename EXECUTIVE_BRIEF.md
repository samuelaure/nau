# Executive Brief: BrandContentView Feature Gaps

**TL;DR**: BrandContentView is missing 4 critical features from the legacy dashboard. All backend endpoints exist and work. Frontend implementation needed: ~8 hours, low risk.

---

## What's Missing (4 Features)

| # | Feature | Purpose | User Impact |
|---|---------|---------|------------|
| 1 | **Export to TXT** | Download posts as text file | Users cannot export profile data |
| 2 | **Update Sync** | Quick 50-post incremental sync | No daily check for new posts |
| 3 | **Scrape + Limit** | Configurable historical scrape (1-10k posts) | Cannot control scraping depth |
| 4 | **Progress Tracking** | Real-time job status for long-running scrapes | No visibility into 5-10 min operations |

---

## Status Check

✅ **Backend**: All 3 endpoints exist and work  
❌ **Frontend**: BrandContentView has none of these controls  
❌ **UX Impact**: Critical workflows broken  

---

## The Problem

When nauthenticity migrated to the monorepo, the legacy AccountView's action controls were never ported to BrandContentView. Users who browse brand profiles via BrandContentView cannot:
- Export data for analysis
- Check for new posts quickly
- Manually trigger deep scrapes
- Track job progress

**Result**: Users either:
1. Switch back to legacy dashboard (if still available)
2. Use API directly (poor UX)
3. Manually manage data externally (error-prone)

---

## Why This Matters

### Broken Workflows
1. **Daily routine**: "Check new posts" → No update sync button → BROKEN
2. **External analysis**: "Export profile data" → No export button → BROKEN
3. **Content research**: "Scrape 2000 posts" → No scrape form → BROKEN
4. **Long operations**: "Monitor 10-min scrape" → No progress page → BROKEN

### User Frustration
- Incomplete feature vs. legacy interface = regression
- Makes monorepo migration feel unfinished
- Increases support tickets for "how do I do X"

---

## Solution: 8-Hour Implementation

### What to Build (2 new components)
1. **ProfileActionsBar** (1.5h) — Reusable button panel with export, sync, scrape
2. **ProgressView** (1.5h) — Real-time progress dashboard

### What to Wire (2 files, 2h)
1. **BrandContentView.tsx** — Add hooks, import components, wire handlers
2. **Router** — Add `/progress/:username` route

### What to Polish (2h)
- Styling, error handling, testing, responsive layout

### No Backend Changes Needed
All 3 endpoints are proven and working:
```
GET  /api/v1/accounts/:username/export/txt
POST /api/v1/ingest { username, limit, updateSync? }
GET  /api/v1/accounts/:username/progress
```

---

## Risk Level: **LOW**

✅ Backend proven (used by legacy dashboard)  
✅ Frontend pattern proven (React Query already in BrandContentView)  
✅ Isolated changes (new components + hooks)  
✅ No breaking changes  
✅ Backward compatible  

---

## Success Criteria

- [x] Feature parity with legacy AccountView
- [x] Export, Sync, Scrape, Progress all work
- [x] Mobile responsive
- [x] Zero TypeScript errors
- [x] Manual testing passes

---

## Timeline

| Phase | Duration |
|-------|----------|
| Components | 2 hours |
| Integration | 2 hours |
| Polish | 2 hours |
| Testing | 2 hours |
| **Total** | **8 hours** |

---

## Recommendation

**🟢 Proceed with implementation — P0 priority**

This is foundational functionality that blocks core user workflows. The effort is modest (8 hours) and risk is low. Once complete, users have full feature parity with legacy interface.

---

## Next Steps

1. Review full `IMPLEMENTATION_PLAN.md` for detailed spec
2. Assign engineer for 1-week sprint
3. Create PR with 5 tasks (see plan Part 5)
4. Test on staging environment
5. Deploy to production
6. Monitor progress feature load

---

**Detailed plan**: See `IMPLEMENTATION_PLAN.md` (10 parts, ~300 lines)  
**Audit report**: See `AUDIT_SUMMARY.md` (findings & impact analysis)

---

End of Brief
