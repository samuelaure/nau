import { applyNoteEdit, buildNewNote, clearSuggestion, InvalidNoteError } from './note';

describe('buildNewNote', () => {
  it('accepts a plain one-liner with no title and no attachments', () => {
    const note = buildNewNote({ content: 'llamar al dentista' });
    expect(note.title).toBeNull();
    expect(note.content).toBe('llamar al dentista');
    expect(note.attachments).toEqual([]);
  });

  it('trims and stores a title when one is supplied', () => {
    const note = buildNewNote({ title: '  Ideas de vacaciones  ', content: 'Portugal en primavera' });
    expect(note.title).toBe('Ideas de vacaciones');
  });

  it('accepts a note with only attachments and no content — an Instagram capture with just an image', () => {
    const note = buildNewNote({
      attachments: [{ kind: 'image', url: 'https://r2.example/a.jpg', metadata: null }],
    });
    expect(note.content).toBe('');
    expect(note.attachments).toHaveLength(1);
  });

  it('refuses a note with neither content nor attachments', () => {
    expect(() => buildNewNote({ content: '   ' })).toThrow(InvalidNoteError);
  });

  it('refuses a note with only a title and nothing else', () => {
    expect(() => buildNewNote({ title: 'Solo un título' })).toThrow(InvalidNoteError);
  });

  it('carries suggestedType through when the triage supplies one', () => {
    const note = buildNewNote({ content: 'recuérdame llamar al dentista', suggestedType: 'actions.item' });
    expect(note.suggestedType).toBe('actions.item');
  });
});

describe('applyNoteEdit', () => {
  const original = buildNewNote({ title: 'Título original', content: 'contenido original' });

  it('changes only the fields supplied', () => {
    const edited = applyNoteEdit({ current: original, content: 'contenido editado' });
    expect(edited.title).toBe('Título original');
    expect(edited.content).toBe('contenido editado');
  });

  it('refuses to edit a note down to nothing', () => {
    expect(() => applyNoteEdit({ current: original, content: '   ' })).toThrow(InvalidNoteError);
  });

  it('allows clearing the title while keeping content', () => {
    const edited = applyNoteEdit({ current: original, title: null });
    expect(edited.title).toBeNull();
    expect(edited.content).toBe('contenido original');
  });

  it('does not touch suggestedType — only clearSuggestion does', () => {
    const withSuggestion = buildNewNote({ content: 'x', suggestedType: 'journal.entry' });
    const edited = applyNoteEdit({ current: withSuggestion, content: 'x editado' });
    expect(edited.suggestedType).toBe('journal.entry');
  });
});

describe('clearSuggestion', () => {
  it('clears suggestedType once a note has been ordered', () => {
    const withSuggestion = buildNewNote({ content: 'x', suggestedType: 'actions.item' });
    const ordered = clearSuggestion(withSuggestion);
    expect(ordered.suggestedType).toBeNull();
    // Nothing else changes.
    expect(ordered.content).toBe('x');
  });
});
