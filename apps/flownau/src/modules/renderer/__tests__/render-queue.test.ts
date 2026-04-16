import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock BullMQ Queue before importing the module under test
const mockAdd = vi.fn()
const mockGetJob = vi.fn()

vi.mock('bullmq', () => ({
  Queue: vi.fn().mockImplementation(() => ({
    add: mockAdd,
    getJob: mockGetJob,
  })),
}))

// Mock Redis connection (no live Redis in unit tests)
vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

import { addRenderJob, getRenderJobStatus } from '../render-queue'

// ─── Tests ────────────────────────────────────────────────────────

describe('addRenderJob()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls queue.add with correct job name, data, and jobId', async () => {
    const fakeJobId = 'render:comp-abc-123'
    mockAdd.mockResolvedValue({ id: fakeJobId })

    await addRenderJob('comp-abc-123')

    expect(mockAdd).toHaveBeenCalledWith(
      'render',
      { compositionId: 'comp-abc-123' },
      expect.objectContaining({ jobId: 'render:comp-abc-123' }),
    )
  })

  it('uses default priority of 10 when no priority is provided', async () => {
    mockAdd.mockResolvedValue({ id: 'render:comp-1' })

    await addRenderJob('comp-1')

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ priority: 10 }),
    )
  })

  it('uses the provided custom priority when specified', async () => {
    mockAdd.mockResolvedValue({ id: 'render:comp-2' })

    await addRenderJob('comp-2', 1)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ priority: 1 }),
    )
  })

  it('returns the job id when queue.add resolves', async () => {
    mockAdd.mockResolvedValue({ id: 'render:comp-xyz' })

    const result = await addRenderJob('comp-xyz')

    expect(result).toBe('render:comp-xyz')
  })

  it('falls back to compositionId when job.id is undefined', async () => {
    mockAdd.mockResolvedValue({ id: undefined })

    const result = await addRenderJob('fallback-comp')

    expect(result).toBe('fallback-comp')
  })
})

describe('getRenderJobStatus()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { state: "unknown", progress: 0 } when job is not found', async () => {
    mockGetJob.mockResolvedValue(null)

    const result = await getRenderJobStatus('nonexistent-comp')

    expect(result).toEqual({ state: 'unknown', progress: 0 })
  })

  it('returns correct state and numeric progress for an existing job', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('active'),
      progress: 45,
      failedReason: undefined,
    })

    const result = await getRenderJobStatus('active-comp')

    expect(result.state).toBe('active')
    expect(result.progress).toBe(45)
    expect(result.failedReason).toBeUndefined()
  })

  it('returns progress 0 when job.progress is not a number', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('waiting'),
      progress: { percent: 30 }, // Object instead of number
      failedReason: undefined,
    })

    const result = await getRenderJobStatus('waiting-comp')

    expect(result.progress).toBe(0)
  })

  it('returns failedReason when job has a failure message', async () => {
    mockGetJob.mockResolvedValue({
      getState: vi.fn().mockResolvedValue('failed'),
      progress: 0,
      failedReason: 'Remotion render crashed: out of memory',
    })

    const result = await getRenderJobStatus('failed-comp')

    expect(result.state).toBe('failed')
    expect(result.failedReason).toBe('Remotion render crashed: out of memory')
  })

  it('uses jobId format render:${compositionId} for lookup', async () => {
    mockGetJob.mockResolvedValue(null)

    await getRenderJobStatus('comp-lookup-test')

    expect(mockGetJob).toHaveBeenCalledWith('render:comp-lookup-test')
  })
})
