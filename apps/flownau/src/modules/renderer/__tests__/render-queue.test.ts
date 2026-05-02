import { describe, it, expect, vi, beforeEach } from 'vitest'

const { mockAdd, mockGetJobs } = vi.hoisted(() => ({
  mockAdd: vi.fn(),
  mockGetJobs: vi.fn(),
}))

vi.mock('bullmq', () => {
  function MockQueue() {
    return { add: mockAdd, getJobs: mockGetJobs }
  }
  return { Queue: MockQueue, ConnectionOptions: {} }
})

vi.mock('@/modules/shared/logger', () => ({
  logger: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
  logError: vi.fn(),
}))

vi.mock('@/modules/shared/prisma', () => ({
  prisma: {
    post: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
  },
}))

import { addRenderJob, getRenderJobStatus } from '../render-queue'

describe('addRenderJob()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('calls queue.add with correct job name, postId data, and timestamped jobId', async () => {
    mockAdd.mockResolvedValue({ id: 'render-post-abc-123-1000' })

    await addRenderJob('post-abc-123')

    expect(mockAdd).toHaveBeenCalledWith(
      'render',
      { postId: 'post-abc-123' },
      expect.objectContaining({ jobId: expect.stringMatching(/^render-post-abc-123-\d+$/) }),
    )
  })

  it('uses default priority of 10 when no priority is provided', async () => {
    mockAdd.mockResolvedValue({ id: 'render-post-1-111' })

    await addRenderJob('post-1')

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ priority: 10 }),
    )
  })

  it('uses the provided custom priority when specified', async () => {
    mockAdd.mockResolvedValue({ id: 'render-post-2-222' })

    await addRenderJob('post-2', 1)

    expect(mockAdd).toHaveBeenCalledWith(
      expect.any(String),
      expect.any(Object),
      expect.objectContaining({ priority: 1 }),
    )
  })

  it('returns the job id when queue.add resolves', async () => {
    mockAdd.mockResolvedValue({ id: 'render-post-xyz-999' })

    const result = await addRenderJob('post-xyz')

    expect(result).toBe('render-post-xyz-999')
  })

  it('falls back to postId when job.id is undefined', async () => {
    mockAdd.mockResolvedValue({ id: undefined })

    const result = await addRenderJob('fallback-post')

    expect(result).toBe('fallback-post')
  })
})

describe('getRenderJobStatus()', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns { state: "unknown", progress: 0 } when no matching job is found', async () => {
    mockGetJobs.mockResolvedValue([])

    const result = await getRenderJobStatus('nonexistent-post')

    expect(result).toEqual({ state: 'unknown', progress: 0 })
  })

  it('returns correct state and numeric progress for an existing job', async () => {
    mockGetJobs.mockResolvedValue([
      {
        id: 'render-active-post-1000',
        timestamp: 1000,
        getState: vi.fn().mockResolvedValue('active'),
        progress: 45,
        failedReason: undefined,
      },
    ])

    const result = await getRenderJobStatus('active-post')

    expect(result.state).toBe('active')
    expect(result.progress).toBe(45)
    expect(result.failedReason).toBeUndefined()
  })

  it('returns progress 0 when job.progress is not a number', async () => {
    mockGetJobs.mockResolvedValue([
      {
        id: 'render-waiting-post-2000',
        timestamp: 2000,
        getState: vi.fn().mockResolvedValue('waiting'),
        progress: { percent: 30 },
        failedReason: undefined,
      },
    ])

    const result = await getRenderJobStatus('waiting-post')

    expect(result.progress).toBe(0)
  })

  it('returns failedReason when job has a failure message', async () => {
    mockGetJobs.mockResolvedValue([
      {
        id: 'render-failed-post-3000',
        timestamp: 3000,
        getState: vi.fn().mockResolvedValue('failed'),
        progress: 0,
        failedReason: 'Remotion render crashed: out of memory',
      },
    ])

    const result = await getRenderJobStatus('failed-post')

    expect(result.state).toBe('failed')
    expect(result.failedReason).toBe('Remotion render crashed: out of memory')
  })

  it('picks the most recent job when multiple matches exist', async () => {
    mockGetJobs.mockResolvedValue([
      {
        id: 'render-multi-post-100',
        timestamp: 100,
        getState: vi.fn().mockResolvedValue('completed'),
        progress: 100,
      },
      {
        id: 'render-multi-post-999',
        timestamp: 999,
        getState: vi.fn().mockResolvedValue('active'),
        progress: 50,
      },
    ])

    const result = await getRenderJobStatus('multi-post')

    expect(result.state).toBe('active')
  })

  it('calls getJobs with the expected status array', async () => {
    mockGetJobs.mockResolvedValue([])

    await getRenderJobStatus('any-post')

    expect(mockGetJobs).toHaveBeenCalledWith(
      ['active', 'waiting', 'delayed', 'failed', 'completed'],
      0,
      200,
    )
  })
})
