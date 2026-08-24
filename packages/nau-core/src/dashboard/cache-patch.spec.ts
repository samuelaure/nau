import { Block } from '@nau/types'
import {
  insertOptimistic,
  replaceOptimistic,
  removeBlock,
  applyBlockEdit,
} from './cache-patch'

const block = (id: string, properties: Record<string, unknown> = {}): Block =>
  ({
    id,
    uuid: id,
    type: 'action',
    properties,
    parentId: null,
    createdAt: '2026-08-24T10:00:00.000Z',
    updatedAt: '2026-08-24T10:00:00.000Z',
  }) as unknown as Block

describe('insertOptimistic', () => {
  it('adds the row without waiting for the server', () => {
    const out = insertOptimistic([block('a')], block('temp-1'))
    expect(out.map((b) => b.id)).toEqual(['a', 'temp-1'])
  })

  it('does not mutate the cached array', () => {
    const original = [block('a')]
    insertOptimistic(original, block('temp-1'))
    expect(original).toHaveLength(1)
  })
})

describe('replaceOptimistic', () => {
  it('swaps the placeholder for the real row, keeping its position', () => {
    const blocks = [block('a'), block('temp-1'), block('c')]
    const out = replaceOptimistic(blocks, 'temp-1', block('real-1'))
    expect(out.map((b) => b.id)).toEqual(['a', 'real-1', 'c'])
  })

  it('leaves the list alone when the placeholder is already gone', () => {
    const blocks = [block('a')]
    expect(replaceOptimistic(blocks, 'temp-1', block('real-1'))).toEqual(blocks)
  })
})

describe('removeBlock', () => {
  it('drops the row immediately, which is what a delete keystroke needs', () => {
    expect(removeBlock([block('a'), block('b')], 'a').map((b) => b.id)).toEqual(['b'])
  })
})

describe('applyBlockEdit', () => {
  it('merges properties instead of replacing them', () => {
    // The regression this guards: a voice entry patched with only `summary`
    // must keep `raw`, `date` and `source`, or the entry loses its origin.
    const entry = block('e1', {
      raw: 'la transcripción original',
      summary: 'la versión limpia',
      date: '2026-08-24T12:25:34.000Z',
      source: 'zazu_voicenote',
    })

    const [out] = applyBlockEdit([entry], 'e1', {
      properties: { summary: 'corregido a mano', editedAt: '2026-08-24T13:00:00.000Z' },
    })

    expect(out.properties).toMatchObject({
      raw: 'la transcripción original',
      summary: 'corregido a mano',
      date: '2026-08-24T12:25:34.000Z',
      source: 'zazu_voicenote',
      editedAt: '2026-08-24T13:00:00.000Z',
    })
  })

  it('treats a null parentId as "move to root", not as "unspecified"', () => {
    const child = { ...block('c1'), parentId: 'p1' } as Block
    const [out] = applyBlockEdit([child], 'c1', { parentId: null })
    expect(out.parentId).toBeNull()
  })

  it('leaves parentId alone when the patch does not mention it', () => {
    const child = { ...block('c1'), parentId: 'p1' } as Block
    const [out] = applyBlockEdit([child], 'c1', { properties: { text: 'x' } })
    expect(out.parentId).toBe('p1')
  })

  it('touches only the block being edited', () => {
    const blocks = [block('a', { text: 'uno' }), block('b', { text: 'dos' })]
    const out = applyBlockEdit(blocks, 'a', { properties: { text: 'cambiado' } })
    expect(out[1]).toBe(blocks[1])
  })
})
