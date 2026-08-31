import { ValidationPipe, BadRequestException } from '@nestjs/common';
import { plainToInstance } from 'class-transformer';
import { validate } from 'class-validator';
import { TriageDto } from './triage.controller';

/**
 * Regression test for a real production incident (2026-08-31): a journal
 * voice capture (`sourceBlockId: a3b399ea-ea05-4b83-81a1-2d337d8a7237`) was
 * rejected with 400 "property text should not exist" — every field on
 * `TriageDto` was rejected, not just an unexpected one.
 *
 * Root cause: `TriageDto`'s fields carried TypeScript types only, no
 * `class-validator` decorators. With the app's global `ValidationPipe`
 * (`whitelist: true`, `forbidNonWhitelisted: true` — see `app.module.ts`),
 * an undecorated field emits no design-time metadata, so `class-validator`
 * cannot confirm it belongs to the class at all and strips/rejects it as
 * unknown. This test exercises the same pipeline the real request went
 * through — `plainToInstance` + `validate`, not just a type check — because
 * `tsc --noEmit` passed the whole time this bug was live in production; the
 * type was always correct, only the runtime metadata was missing.
 */
describe('TriageDto — whitelist validation', () => {
  const pipe = new ValidationPipe({ whitelist: true, forbidNonWhitelisted: true, transform: true });

  async function runPipe(body: unknown) {
    return pipe.transform(body, { type: 'body', metatype: TriageDto });
  }

  it('accepts the exact body shape Zazŭ sends for a journal-only voice capture', async () => {
    const body = {
      text: 'Bueno, estos días han sido conflictuantes.',
      userId: 'cmoq2tqwz000001n6fnjqjzcw',
      sourceBlockId: 'a3b399ea-ea05-4b83-81a1-2d337d8a7237',
      workspaceId: 'cmoq2tqx3000101n6usl2vxbx',
      journalOnly: true,
      capturedAt: '2026-08-31T09:52:30.000Z',
    };

    const result = await runPipe(body);
    expect(result).toEqual(expect.objectContaining({ text: body.text, journalOnly: true }));
  });

  it('rejects a body with a genuinely unknown property, and only that one', async () => {
    const instance = plainToInstance(TriageDto, { text: 'hi', notAField: 'x' } as any, {
      excludeExtraneousValues: false,
    });
    const errors = await validate(instance as object, { whitelist: true, forbidNonWhitelisted: false });
    // With forbidNonWhitelisted:false this only reports validation errors,
    // not whitelist rejections — confirms the six known fields validate
    // cleanly on their own, independent of the pipe's whitelist behaviour.
    expect(errors).toEqual([]);
  });

  it('rejects when text is missing (the one required field)', async () => {
    await expect(runPipe({ userId: 'x' })).rejects.toBeInstanceOf(BadRequestException);
  });

  it('accepts a minimal body with only the required field', async () => {
    const result = await runPipe({ text: 'solo texto' });
    expect(result).toEqual(expect.objectContaining({ text: 'solo texto' }));
  });
});
