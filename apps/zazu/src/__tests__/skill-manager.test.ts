/**
 * SkillManager unit tests.
 *
 * SkillManager is the core dispatch mechanism of the Zazŭ bot. It:
 *   1. Registers skills sorted by priority (lower = higher priority)
 *   2. Dispatches a ZazuContext to the first matching skill
 *   3. Skips skills the user has not enabled (unless priority >= 1000 = core)
 *   4. Catches skill errors and falls through to the next skill
 *
 * All ZazuSkill instances are plain objects with vi.fn() methods — no real
 * Telegraf context or database is needed.
 */
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { SkillManager } from '../skill-manager'
import type { ZazuContext, ZazuSkill } from '@zazu/skills-core'

function makeSkill(overrides: Partial<ZazuSkill> & { id: string; priority: number }): ZazuSkill {
  return {
    name: overrides.id,
    canHandle: vi.fn().mockResolvedValue(false),
    handle: vi.fn().mockResolvedValue(undefined),
    ...overrides,
  }
}

function makeContext(features: string[] = []): ZazuContext {
  return {
    dbUser: {
      id: 'user-1',
      features: features.map((id) => ({ featureId: id })),
    },
  } as unknown as ZazuContext
}

describe('SkillManager', () => {
  let manager: SkillManager

  beforeEach(() => {
    manager = new SkillManager()
  })

  describe('register', () => {
    it('sorts registered skills by priority ascending', () => {
      const high = makeSkill({ id: 'high', priority: 10 })
      const low = makeSkill({ id: 'low', priority: 5 })
      const mid = makeSkill({ id: 'mid', priority: 7 })

      manager.register(high)
      manager.register(low)
      manager.register(mid)

      // Access internal skills array via type cast for assertion
      const skills = (manager as any).skills as ZazuSkill[]
      expect(skills.map((s) => s.name)).toEqual(['low', 'mid', 'high'])
    })
  })

  describe('dispatch', () => {
    it('returns false when dbUser is not set', async () => {
      const ctx = {} as ZazuContext
      const result = await manager.dispatch(ctx)
      expect(result).toBe(false)
    })

    it('returns false when no skills are registered', async () => {
      const result = await manager.dispatch(makeContext())
      expect(result).toBe(false)
    })

    it('invokes the first skill that can handle the context', async () => {
      const skill = makeSkill({ id: 'my-feature', priority: 1 })
      ;(skill.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      manager.register(skill)
      const result = await manager.dispatch(makeContext(['my-feature']))

      expect(skill.canHandle).toHaveBeenCalledTimes(1)
      expect(skill.handle).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    })

    it('skips a skill the user has not enabled (non-core)', async () => {
      const skill = makeSkill({ id: 'gated-feature', priority: 1 })
      ;(skill.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      manager.register(skill)
      // User has no features enabled
      const result = await manager.dispatch(makeContext([]))

      expect(skill.canHandle).not.toHaveBeenCalled()
      expect(result).toBe(false)
    })

    it('always runs core skills (priority >= 1000) regardless of user features', async () => {
      const coreSkill = makeSkill({ id: 'conversational-fallback', priority: 1000 })
      ;(coreSkill.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      manager.register(coreSkill)
      const result = await manager.dispatch(makeContext([]))

      expect(coreSkill.handle).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    })

    it('falls through to the next skill when the first one errors', async () => {
      const failing = makeSkill({ id: 'feat-a', priority: 1 })
      const fallback = makeSkill({ id: 'fallback', priority: 1000 })

      ;(failing.canHandle as ReturnType<typeof vi.fn>).mockRejectedValue(new Error('boom'))
      ;(fallback.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      manager.register(failing)
      manager.register(fallback)

      const result = await manager.dispatch(makeContext(['feat-a']))

      expect(fallback.handle).toHaveBeenCalledTimes(1)
      expect(result).toBe(true)
    })

    it('stops after the first matching skill (does not run subsequent skills)', async () => {
      const first = makeSkill({ id: 'feat-first', priority: 1 })
      const second = makeSkill({ id: 'feat-second', priority: 2 })

      ;(first.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)
      ;(second.canHandle as ReturnType<typeof vi.fn>).mockResolvedValue(true)

      manager.register(first)
      manager.register(second)

      await manager.dispatch(makeContext(['feat-first', 'feat-second']))

      expect(first.handle).toHaveBeenCalledTimes(1)
      expect(second.canHandle).not.toHaveBeenCalled()
    })
  })
})
