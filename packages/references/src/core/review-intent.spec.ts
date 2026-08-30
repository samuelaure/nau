import { hasPendingReviews, type ReviewIntent } from './review-intent';

function intent(over: Partial<ReviewIntent>): ReviewIntent {
  return { noteId: 'note-1', actionItemId: 'action-1', elevated: false, ...over };
}

describe('hasPendingReviews', () => {
  it('is false with no intents at all', () => {
    expect(hasPendingReviews([], () => true)).toBe(false);
  });

  it('is true when a non-elevated intent is overdue', () => {
    const intents = [intent({ actionItemId: 'a' })];
    expect(hasPendingReviews(intents, (id) => id === 'a')).toBe(true);
  });

  it('is false when the only overdue intent is elevated — it has its own visible item already', () => {
    const intents = [intent({ actionItemId: 'a', elevated: true })];
    expect(hasPendingReviews(intents, (id) => id === 'a')).toBe(false);
  });

  it('is true when a mix of elevated and non-elevated intents exist and the non-elevated one is overdue', () => {
    const intents = [
      intent({ noteId: 'n1', actionItemId: 'a', elevated: true }),
      intent({ noteId: 'n2', actionItemId: 'b', elevated: false }),
    ];
    expect(hasPendingReviews(intents, (id) => id === 'a' || id === 'b')).toBe(true);
  });

  it('is false when nothing overdue is non-elevated, even if an elevated one is overdue', () => {
    const intents = [
      intent({ noteId: 'n1', actionItemId: 'a', elevated: true }),
      intent({ noteId: 'n2', actionItemId: 'b', elevated: false }),
    ];
    // Only 'a' (elevated) is overdue; 'b' (non-elevated) is not.
    expect(hasPendingReviews(intents, (id) => id === 'a')).toBe(false);
  });
});
