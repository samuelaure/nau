import { ActionItemSchema } from './schemas';

describe('ActionItemSchema', () => {
  it('defaults an item created with nothing but a parse call', () => {
    const parsed = ActionItemSchema.parse({});
    expect(parsed).toEqual({
      text: '',
      status: 'todo',
      priority: null,
      deadline: null,
      estimateMinutes: null,
    });
  });

  it('accepts the full shape the triage produces today', () => {
    const parsed = ActionItemSchema.parse({
      text: 'llamar al médico',
      status: 'todo',
      priority: 'high',
      deadline: '2026-09-01T00:00:00.000Z',
    });
    expect(parsed.priority).toBe('high');
  });

  it('rejects a status outside todo/done/cancelled', () => {
    expect(() => ActionItemSchema.parse({ status: 'inbox' })).toThrow();
  });

  // sortOrder is stamped by the substrate for every kind (nau#85) — it must
  // pass through without this schema having an opinion on it.
  it('passes through substrate-stamped fields like sortOrder', () => {
    const parsed = ActionItemSchema.parse({ sortOrder: 3 });
    expect((parsed as Record<string, unknown>).sortOrder).toBe(3);
  });
});
