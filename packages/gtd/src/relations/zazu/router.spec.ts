import { activeDestinations, isRoutable, type DestinationHandler, type TriagedSegment } from './router';

const handler = (destination: DestinationHandler['destination'], available: boolean): DestinationHandler => ({
  destination,
  available: () => available,
});

describe('activeDestinations', () => {
  it('is empty with no handlers registered', () => {
    expect(activeDestinations([])).toEqual([]);
  });

  it('lists only the handlers that report themselves available', () => {
    const handlers = [handler('actions', true), handler('journal', false), handler('references', true)];
    expect(activeDestinations(handlers)).toEqual(['actions', 'references']);
  });

  // The worked example from tmp/gtd-blueprint.md §3.4: deactivating one
  // relation removes it from what the triage can suggest, with no change
  // to this function or to any prompt.
  it('drops a destination the moment its handler reports unavailable', () => {
    const handlers = [handler('actions', true), handler('journal', true)];
    expect(activeDestinations(handlers)).toEqual(['actions', 'journal']);

    const journalDeactivated = [handler('actions', true), handler('journal', false)];
    expect(activeDestinations(journalDeactivated)).toEqual(['actions']);
  });
});

describe('isRoutable', () => {
  const handlers = [handler('actions', true), handler('journal', false)];

  it('is false when the triage suggested nothing', () => {
    const segment: TriagedSegment = { text: 'hoy fue un buen día', suggestedDestination: null };
    expect(isRoutable(segment, handlers)).toBe(false);
  });

  it('is true when the suggestion points at an active destination', () => {
    const segment: TriagedSegment = { text: 'llamar al dentista', suggestedDestination: 'actions' };
    expect(isRoutable(segment, handlers)).toBe(true);
  });

  // A relation deactivated after the suggestion was produced — the note
  // stays references.note rather than pretending to route.
  it('is false when the suggestion points at a destination that is no longer active', () => {
    const segment: TriagedSegment = { text: 'anotar esto', suggestedDestination: 'journal' };
    expect(isRoutable(segment, handlers)).toBe(false);
  });
});
