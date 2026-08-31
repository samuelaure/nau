import { NotFoundException } from '@nestjs/common';
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

  describe('createEntry', () => {
    let create: jest.Mock;

    beforeEach(() => {
      create = jest.fn().mockResolvedValue(entryRow({ properties: {
        text: 'Nueva entrada.',
        textOriginal: 'Nueva entrada.',
        date: '2026-08-31T10:00:00.000Z',
        source: 'app',
        originFormat: 'text',
      } }));
      forUser.mockResolvedValue({ block: { findMany, create } });
    });

    it('goes through the scoped client, so membership is asserted before writing', async () => {
      await service.createEntry('u-1', 'ws-1', { text: 'Nueva entrada.' });
      expect(forUser).toHaveBeenCalledWith('u-1', 'ws-1');
    });

    it('stamps text and textOriginal identically, and marks the origin as app/text', async () => {
      // The App has no audio and always sends clean text — unlike the Zazŭ
      // path, there is no builder call to derive originFormat from.
      await service.createEntry('u-1', 'ws-1', { text: 'Nueva entrada.' });
      expect(create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              text: 'Nueva entrada.',
              textOriginal: 'Nueva entrada.',
              source: 'app',
              originFormat: 'text',
            }),
          }),
        }),
      );
    });

    it('does not publish the fields Journal keeps private on the created entry', async () => {
      const view = await service.createEntry('u-1', 'ws-1', { text: 'Nueva entrada.' });
      expect(view).not.toHaveProperty('textOriginal');
      expect(view).not.toHaveProperty('sourceId');
    });
  });

  describe('updateEntry', () => {
    let findUnique: jest.Mock;
    let update: jest.Mock;

    beforeEach(() => {
      findUnique = jest.fn().mockResolvedValue(entryRow());
      update = jest.fn().mockImplementation(({ data }) =>
        Promise.resolve(entryRow({ properties: data.properties })),
      );
      forUser.mockResolvedValue({ block: { findMany, findUnique, update } });
    });

    it('edits text without touching textOriginal — the correction is reversible in meaning', async () => {
      await service.updateEntry('u-1', 'ws-1', 'e1', { text: 'Texto corregido.' });
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            properties: expect.objectContaining({
              text: 'Texto corregido.',
              textOriginal: 'Hoy fue un dia largo.', // unchanged from entryRow()
            }),
          }),
        }),
      );
    });

    it('stamps editedAt so downstream synthesis generation knows to prefer the correction', async () => {
      const view = await service.updateEntry('u-1', 'ws-1', 'e1', { text: 'Texto corregido.' });
      expect(view.editedAt).not.toBeNull();
    });

    it('throws NotFoundException when the entry does not exist in this workspace', async () => {
      findUnique.mockResolvedValue(null);
      await expect(
        service.updateEntry('u-1', 'ws-1', 'missing', { text: 'x' }),
      ).rejects.toThrow(NotFoundException);
      // The scoped client already confines the query to this workspace — a
      // null result here means "not found or not yours", never a second check.
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('deleteEntry', () => {
    let findUnique: jest.Mock;
    let update: jest.Mock;

    beforeEach(() => {
      findUnique = jest.fn().mockResolvedValue(entryRow());
      update = jest.fn().mockResolvedValue(entryRow());
      forUser.mockResolvedValue({ block: { findMany, findUnique, update } });
    });

    it('soft-deletes via deletedAt, the same convention as every other block', async () => {
      await service.deleteEntry('u-1', 'ws-1', 'e1');
      expect(update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'e1' },
          data: expect.objectContaining({ deletedAt: expect.any(Date) }),
        }),
      );
    });

    it('throws NotFoundException rather than silently no-op-ing on a missing entry', async () => {
      findUnique.mockResolvedValue(null);
      await expect(service.deleteEntry('u-1', 'ws-1', 'missing')).rejects.toThrow(
        NotFoundException,
      );
      expect(update).not.toHaveBeenCalled();
    });
  });

  describe('updateSynthesis', () => {
    let findUnique: jest.Mock;
    let update: jest.Mock;

    beforeEach(() => {
      findUnique = jest.fn().mockResolvedValue(synthesisRow());
      update = jest.fn().mockImplementation(({ data }) =>
        Promise.resolve(synthesisRow({ properties: data.properties })),
      );
      forUser.mockResolvedValue({ block: { findMany, findUnique, update } });
    });

    it('edits synthesis and reflection text without touching *Original fields', async () => {
      // synthesisRow() carries no *Original fields today (pre-tightening rows,
      // nau#79) — the point is that update() never introduces or clears them,
      // it only ever merges the two edited keys onto whatever properties exist.
      await service.updateSynthesis('u-1', 'ws-1', 's1', {
        synthesis: 'Versión corregida.',
        reflection: 'Reflexión corregida.',
      });
      const [[{ data }]] = update.mock.calls;
      expect(data.properties.synthesis).toBe('Versión corregida.');
      expect(data.properties.reflection).toBe('Reflexión corregida.');
      expect(data.properties).not.toHaveProperty('synthesisOriginal');
      expect(data.properties).not.toHaveProperty('reflectionOriginal');
    });

    it('never regenerates — no LLM call, no noData recomputation, on edit', async () => {
      // The absence of any call is the assertion: updateSynthesis takes the
      // caller's text as given (nau#36) rather than deriving it from anything.
      await service.updateSynthesis('u-1', 'ws-1', 's1', { synthesis: 'x' });
      expect(findMany).not.toHaveBeenCalled();
    });

    it('allows editing only one of synthesis/reflection, leaving the other untouched', async () => {
      await service.updateSynthesis('u-1', 'ws-1', 's1', { synthesis: 'Solo esto cambia.' });
      const [[{ data }]] = update.mock.calls;
      expect(data.properties.synthesis).toBe('Solo esto cambia.');
      expect(data.properties.reflection).toBe('Vale la pena parar.'); // unchanged
    });

    it('throws NotFoundException when the synthesis does not exist in this workspace', async () => {
      findUnique.mockResolvedValue(null);
      await expect(
        service.updateSynthesis('u-1', 'ws-1', 'missing', { synthesis: 'x' }),
      ).rejects.toThrow(NotFoundException);
      expect(update).not.toHaveBeenCalled();
    });
  });
});
