import { ZoneHistory, isValidZone, safeZone } from './zone';

const at = (iso: string) => new Date(iso);

describe('safeZone', () => {
  it('accepts a real IANA zone', () => {
    expect(safeZone('Europe/Madrid')).toBe('Europe/Madrid');
  });

  it('falls back to UTC for null or empty', () => {
    expect(safeZone(null)).toBe('UTC');
    expect(safeZone(undefined)).toBe('UTC');
    expect(safeZone('')).toBe('UTC');
  });

  // One malformed zone in a per-workspace batch must not stop every workspace
  // queued behind it.
  it('falls back to UTC rather than throwing on a malformed zone', () => {
    expect(safeZone('Not/AZone')).toBe('UTC');
  });
});

describe('isValidZone', () => {
  it('distinguishes real zones from invented ones', () => {
    expect(isValidZone('America/Mexico_City')).toBe(true);
    expect(isValidZone('Mars/Olympus')).toBe(false);
  });
});

describe('ZoneHistory', () => {
  // Madrid until the move, Mexico City after it.
  const history = new ZoneHistory([
    { timezone: 'Europe/Madrid', effectiveAt: at('2026-01-01T00:00:00Z') },
    { timezone: 'America/Mexico_City', effectiveAt: at('2026-09-01T00:00:00Z') },
  ]);

  it('reads a past period in the zone it was lived in', () => {
    expect(history.at(at('2026-08-15T00:00:00Z'))).toBe('Europe/Madrid');
  });

  it('reads a later period in the new zone', () => {
    expect(history.at(at('2026-10-15T00:00:00Z'))).toBe('America/Mexico_City');
  });

  it('switches exactly at the effective instant', () => {
    expect(history.at(at('2026-08-31T23:59:59Z'))).toBe('Europe/Madrid');
    expect(history.at(at('2026-09-01T00:00:00Z'))).toBe('America/Mexico_City');
  });

  it('falls back to UTC before any recorded zone', () => {
    expect(history.at(at('2025-06-01T00:00:00Z'))).toBe('UTC');
  });

  it('does not require the changes to be given in order', () => {
    const unordered = new ZoneHistory([
      { timezone: 'America/Mexico_City', effectiveAt: at('2026-09-01T00:00:00Z') },
      { timezone: 'Europe/Madrid', effectiveAt: at('2026-01-01T00:00:00Z') },
    ]);
    expect(unordered.at(at('2026-08-15T00:00:00Z'))).toBe('Europe/Madrid');
  });

  it('validates the zones it stores', () => {
    const broken = new ZoneHistory([
      { timezone: 'Not/AZone', effectiveAt: at('2026-01-01T00:00:00Z') },
    ]);
    expect(broken.at(at('2026-06-01T00:00:00Z'))).toBe('UTC');
  });

  describe('fixed', () => {
    it('answers the same zone for any instant', () => {
      const fixed = ZoneHistory.fixed('Europe/Madrid');
      expect(fixed.at(at('2020-01-01T00:00:00Z'))).toBe('Europe/Madrid');
      expect(fixed.at(at('2030-01-01T00:00:00Z'))).toBe('Europe/Madrid');
    });
  });

  it('reports the zone in force now', () => {
    expect(history.current(at('2026-10-01T00:00:00Z'))).toBe('America/Mexico_City');
  });
});
