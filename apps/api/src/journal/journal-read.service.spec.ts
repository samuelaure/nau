import { JournalReadService } from './journal-read.service';
import type { ScopedPrismaService } from '../core/tenancy/scoped-prisma.service';

const entryRow = (over: Record<string, unknown> = {}) => ({
  id: 'e1',
  properties: {
    text: 'Hoy fue un día largo.',
    textOriginal: 'Hoy fue un dia largo.',
    date: '2026-08-20T18:30:00.000Z',
    source: 'zazu',
    originFormat: 'voice',
    sourceId: 'voicenote-123',
    sortOrder: 4,
  },
  createdAt: new Date('2026-08-20T18:31:00.000Z'),
  updatedAt: new Date('2026-08-20T18:31:00.000Z'),
  ...over,
});

const synthesisRow = (over: Record<string, unknown> = {}) => ({
  id: 's1',
  properties: {
    synthesis: 'Una semana de mucho trabajo.',
    reflection: 'Vale la pena parar.',
    from: '2026-08-17T00:00:00.000Z',
    to: '2026-08-24T00:00:00.000Z',
  },
  createdAt: new Date('2026-08-24T00:00:00.000Z'),
  updatedAt: new Date('2026-08-24T00:00:00.000Z'),
  ...over,
});

describe('JournalReadService', () => {
  let findMany: jest.Mock;
  let forUser: jest.Mock;
  let service: JournalReadService;

  beforeEach(() => {
    findMany = jest.fn().mockResolvedValue([entryRow()]);
    forUser = jest.fn().mockResolvedValue({ block: { findMany } });
    service = new JournalReadService({ forUser } as unknown as ScopedPrismaService);
  });

  it('goes through the scoped client, so membership is asserted before reading', async () => {
    // The read never queries Prisma directly. That is what makes isolation a
    // property of the architecture rather than of this method remembering.
    await service.listEntries('u-1', 'ws-1');
    expect(forUser).toHaveBeenCalledWith('u-1', 'ws-1');
  });

  it('asks only for its own kind, never for a shared block query', async () => {
    await service.listEntries('u-1', 'ws-1');
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ type: 'journal_entry', deletedAt: null }),
      }),
    );
  });

  it('does not publish the fields Journal keeps private', async () => {
    // textOriginal and sourceId are private (nau#79). Publishing the whole
    // properties object is how a private field becomes public by accident.
    const [view] = await service.listEntries('u-1', 'ws-1');
    expect(view).not.toHaveProperty('textOriginal');
    expect(view).not.toHaveProperty('sourceId');
    expect(view.text).toBe('Hoy fue un día largo.');
  });

  describe('range filtering is half-open', () => {
    it('includes an entry exactly at `from`', async () => {
      const result = await service.listEntries('u-1', 'ws-1', {
        from: new Date('2026-08-20T18:30:00.000Z'),
      });
      expect(result).toHaveLength(1);
    });

    it('excludes an entry exactly at `to`', async () => {
      // [from, to) — an instant at the boundary belongs to the next period.
      const result = await service.listEntries('u-1', 'ws-1', {
        to: new Date('2026-08-20T18:30:00.000Z'),
      });
      expect(result).toHaveLength(0);
    });

    it('returns everything when no range is given', async () => {
      expect(await service.listEntries('u-1', 'ws-1')).toHaveLength(1);
    });
  });

  describe('syntheses', () => {
    beforeEach(() => findMany.mockResolvedValue([synthesisRow()]));

    it('normalises the empty-string convention to null on the way out', async () => {
      // Rows written before the tightening carry '' where they mean "nothing to
      // say" (nau#79). A consumer should not have to know which convention a
      // row was written under.
      findMany.mockResolvedValue([
        synthesisRow({
          properties: {
            synthesis: '',
            reflection: '',
            from: '2026-08-17T00:00:00.000Z',
            to: '2026-08-24T00:00:00.000Z',
            noData: true,
          },
        }),
      ]);

      const [view] = await service.listSyntheses('u-1', 'ws-1');
      expect(view.synthesis).toBeNull();
      expect(view.reflection).toBeNull();
      expect(view.noData).toBe(true);
    });

    it('reports noData false when a period had something to say', async () => {
      const [view] = await service.listSyntheses('u-1', 'ws-1');
      expect(view.noData).toBe(false);
      expect(view.synthesis).toBe('Una semana de mucho trabajo.');
    });

    it('queries the synthesis kind, not the entry kind', async () => {
      await service.listSyntheses('u-1', 'ws-1');
      expect(findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ type: 'journal_synthesis' }),
        }),
      );
    });
  });
});
