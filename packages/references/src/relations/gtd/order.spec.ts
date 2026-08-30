import { buildNewNote } from '../../core/note';
import { orderIntoReferences } from './order';

describe('orderIntoReferences', () => {
  it('clears suggestedType, the only thing ordering into References changes', () => {
    const withSuggestion = buildNewNote({
      content: 'algo capturado, aún sin clasificar',
      suggestedType: 'references.note',
    });

    const ordered = orderIntoReferences({ blockId: 'blk-1' }, withSuggestion);

    expect(ordered.suggestedType).toBeNull();
  });

  it('leaves content, title and attachments untouched', () => {
    const note = buildNewNote({
      title: 'Ideas de vacaciones',
      content: 'Portugal en primavera',
      suggestedType: 'references.note',
    });

    const ordered = orderIntoReferences({ blockId: 'blk-1' }, note);

    expect(ordered.title).toBe('Ideas de vacaciones');
    expect(ordered.content).toBe('Portugal en primavera');
  });

  it('is a no-op on suggestedType when the note already had none', () => {
    const note = buildNewNote({ content: 'ya sin sugerencia pendiente' });
    const ordered = orderIntoReferences({ blockId: 'blk-1' }, note);
    expect(ordered.suggestedType).toBeNull();
  });
});
