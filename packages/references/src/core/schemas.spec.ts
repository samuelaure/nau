import { NoteSchema, AttachmentSchema } from './schemas';

/**
 * The shape a plain captured thought takes — no attachments, the common
 * case for anything typed or spoken.
 */
const plainNote = {
  title: null,
  content: 'llamar al dentista',
  attachments: [],
  suggestedType: null,
};

/**
 * The shape one of the 968 `CAPTURE_POST` rows takes once migrated, per the
 * field mapping in `tmp/references-gap.md` §3 — an Instagram capture is a
 * note with an image attachment and no `suggestedType` (migrated captures
 * carry no review plan and no pending triage suggestion).
 */
const migratedCapture = {
  title: null,
  content: 'Una caption capturada de Instagram.',
  attachments: [
    {
      kind: 'image',
      url: 'https://r2.example/captures/abc123.jpg',
      metadata: {
        sourceUrl: 'https://instagram.com/p/abc123',
        username: 'someaccount',
        caption: 'Una caption capturada de Instagram.',
      },
    },
  ],
  suggestedType: null,
};

describe('NoteSchema', () => {
  it('accepts a plain captured thought with no attachments', () => {
    expect(NoteSchema.safeParse(plainNote).success).toBe(true);
  });

  it('accepts the shape a migrated Instagram capture takes', () => {
    expect(NoteSchema.safeParse(migratedCapture).success).toBe(true);
  });

  it('defaults title to null, content to empty and attachments to empty when omitted', () => {
    const parsed = NoteSchema.parse({});
    expect(parsed.title).toBeNull();
    expect(parsed.content).toBe('');
    expect(parsed.attachments).toEqual([]);
  });

  it('tolerates sortOrder, which the substrate stamps and References does not own', () => {
    // nau#85, same discipline @nau/journal already applies.
    const parsed = NoteSchema.parse({ ...plainNote, sortOrder: 7 });
    expect(parsed).toHaveProperty('sortOrder', 7);
  });

  it('rejects a non-string content, which the old properties cast would have stored', () => {
    expect(NoteSchema.safeParse({ ...plainNote, content: 42 }).success).toBe(false);
  });
});

describe('AttachmentSchema', () => {
  it('accepts an image attachment with metadata', () => {
    const result = AttachmentSchema.safeParse(migratedCapture.attachments[0]);
    expect(result.success).toBe(true);
  });

  it('accepts a link attachment with no metadata', () => {
    const result = AttachmentSchema.safeParse({
      kind: 'link',
      url: 'https://example.com/article',
      metadata: null,
    });
    expect(result.success).toBe(true);
  });

  it('defaults metadata to null when omitted', () => {
    const parsed = AttachmentSchema.parse({ kind: 'file', url: 'https://r2.example/doc.pdf' });
    expect(parsed.metadata).toBeNull();
  });

  it('rejects a kind outside the four that exist', () => {
    expect(
      AttachmentSchema.safeParse({ kind: 'audio', url: 'https://r2.example/x.mp3', metadata: null })
        .success,
    ).toBe(false);
  });
});
