import { JournalEntrySchema, JournalSynthesisSchema } from './schemas';

/**
 * The shapes production actually holds, from the census in tmp/api-census.md.
 *
 * Written from the measured data rather than from the type definition on
 * purpose: a schema that only validates what the code intends to write is
 * untested against the rows that already exist, and those are the ones that
 * fail on their next save.
 */
const liveEntry = {
  text: 'Hoy fue un día largo.',
  textOriginal: 'Hoy fue un dia largo.',
  date: '2026-08-20T18:30:00.000Z',
  source: 'zazu',
  originFormat: 'voice',
  sourceId: 'voicenote-123',
  sortOrder: 4,
};

/** The 9 of 106 rows without sourceId — the app's web-text capture path. */
const liveEntryWithoutSource = {
  text: 'Escrito desde la web.',
  textOriginal: 'Escrito desde la web.',
  date: '2026-08-21T09:00:00.000Z',
  source: 'app',
  originFormat: 'text',
  sortOrder: 5,
};

const liveSynthesis = {
  synthesis: 'Una semana de mucho trabajo.',
  synthesisOriginal: 'Una semana de mucho trabajo.',
  reflection: 'Vale la pena parar.',
  reflectionOriginal: 'Vale la pena parar.',
  from: '2026-08-17T00:00:00.000Z',
  to: '2026-08-24T00:00:00.000Z',
  synthesisSource: {
    kind: 'entries',
    ids: [{ id: 'b1', from: '2026-08-17T00:00:00.000Z', to: '2026-08-18T00:00:00.000Z' }],
    count: 1,
  },
  prompts: { synthesisPrompt: 'p1', reflectionPrompt: 'p2' },
};

describe('JournalEntrySchema', () => {
  it('accepts a row in the shape production holds', () => {
    expect(JournalEntrySchema.safeParse(liveEntry).success).toBe(true);
  });

  it('accepts the rows that carry no sourceId', () => {
    expect(JournalEntrySchema.safeParse(liveEntryWithoutSource).success).toBe(true);
  });

  it('tolerates sortOrder, which the substrate stamps and Journal does not own', () => {
    // nau#85. Rejecting it would make a substrate-managed key fail its owner's
    // validation, which is why both schemas pass through unknown keys.
    const parsed = JournalEntrySchema.parse(liveEntry);
    expect(parsed).toHaveProperty('sortOrder', 4);
  });

  it.each(['text', 'textOriginal', 'date', 'source', 'originFormat'])(
    'requires %s, which every live row carries',
    (field) => {
      const missing = { ...liveEntry } as Record<string, unknown>;
      delete missing[field];
      expect(JournalEntrySchema.safeParse(missing).success).toBe(false);
    },
  );

  it('rejects a source outside the three that exist', () => {
    expect(
      JournalEntrySchema.safeParse({ ...liveEntry, source: 'telegram' }).success,
    ).toBe(false);
  });

  it('rejects a non-string text, which the old cast would have stored', () => {
    expect(JournalEntrySchema.safeParse({ ...liveEntry, text: 42 }).success).toBe(false);
  });
});

describe('JournalSynthesisSchema', () => {
  it('accepts a synthesis in the shape production holds', () => {
    expect(JournalSynthesisSchema.safeParse(liveSynthesis).success).toBe(true);
  });

  it('accepts an empty-text synthesis when it declares noData', () => {
    // The shape existing rows use today: noData with empty strings. Tolerated
    // until the migration normalises them to null (nau#79).
    const result = JournalSynthesisSchema.safeParse({
      ...liveSynthesis,
      synthesis: '',
      synthesisOriginal: '',
      reflection: '',
      reflectionOriginal: '',
      noData: true,
    });
    expect(result.success).toBe(true);
  });

  it('accepts null text when it declares noData — the shape being moved toward', () => {
    const result = JournalSynthesisSchema.safeParse({
      ...liveSynthesis,
      synthesis: null,
      synthesisOriginal: null,
      reflection: null,
      reflectionOriginal: null,
      noData: true,
    });
    expect(result.success).toBe(true);
  });

  it('refuses a synthesis with no text that does not say why', () => {
    // Without this, an empty account and a failed generation are the same row.
    const result = JournalSynthesisSchema.safeParse({ ...liveSynthesis, synthesis: '' });
    expect(result.success).toBe(false);
  });

  it('requires the period it covers', () => {
    const missing = { ...liveSynthesis } as Record<string, unknown>;
    delete missing.from;
    expect(JournalSynthesisSchema.safeParse(missing).success).toBe(false);
  });

  it('requires the provenance of what it read', () => {
    const missing = { ...liveSynthesis } as Record<string, unknown>;
    delete missing.synthesisSource;
    expect(JournalSynthesisSchema.safeParse(missing).success).toBe(false);
  });
});
