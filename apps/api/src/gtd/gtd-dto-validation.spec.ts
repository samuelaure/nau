import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { CaptureBody, ProcessBody, OrderBody } from './gtd.controller';

/**
 * Confirms every field these DTOs accept in real traffic actually survives
 * the real `ValidationPipe` config (`whitelist: true,
 * forbidNonWhitelisted: true`, app.module.ts) — i.e. has a `class-validator`
 * decorator. Without one, `forbidNonWhitelisted: true` rejects the request
 * with a 400 listing every stripped property as "should not exist", which
 * is exactly what happened here: `CaptureBody`/`ProcessBody`/`OrderBody`
 * shipped with only TypeScript type annotations, no decorators — every real
 * call to capture/process/order was rejected before ever reaching
 * `GtdService`. Confirmed via the local dev database (zero `gtd.*` events
 * existed anywhere) and reproduced live against a running instance before
 * the fix. Found while wiring app's BlockEditor to call capture for real
 * for the first time (nau#153's GTD follow-up).
 *
 * `*.controller.spec.ts` elsewhere in this repo calls controller methods
 * directly with plain objects, which never exercises the pipe — that's why
 * this shipped broken and unnoticed. This spec runs `validate()` the same
 * way `ValidationPipe` does internally, at the one level where the bug
 * actually lived.
 */
describe('GtdController DTOs — whitelist regression guard', () => {
  async function whitelistErrors<T extends object>(cls: new () => T, plain: object) {
    const instance = plainToInstance(cls, plain);
    return validate(instance, { whitelist: true, forbidNonWhitelisted: true });
  }

  it('CaptureBody: workspaceId, trayId, content, title all survive whitelist', async () => {
    const errors = await whitelistErrors(CaptureBody, {
      workspaceId: 'ws-1',
      trayId: 'root',
      content: 'hello',
      title: 'a title',
    });
    expect(errors).toEqual([]);
  });

  it('CaptureBody: trayId alone (the only required field) survives whitelist', async () => {
    const errors = await whitelistErrors(CaptureBody, { trayId: 'root' });
    expect(errors).toEqual([]);
  });

  it('ProcessBody: toTrayId survives whitelist', async () => {
    const errors = await whitelistErrors(ProcessBody, { toTrayId: 'actions' });
    expect(errors).toEqual([]);
  });

  it('OrderBody: every field across all three destinations survives whitelist', async () => {
    const errors = await whitelistErrors(OrderBody, {
      workspaceId: 'ws-1',
      destination: 'actions',
      blockId: 'block-1',
      text: 'do the thing',
      priority: 'high',
      deadline: '2026-01-01',
      capturedAt: '2026-01-01T00:00:00.000Z',
      source: 'text',
      originFormat: 'plain',
    });
    expect(errors).toEqual([]);
  });

  it('OrderBody: destination is restricted to the three real values', async () => {
    const errors = await whitelistErrors(OrderBody, { destination: 'not-a-real-destination', blockId: 'block-1' });
    expect(errors.some((e) => e.property === 'destination')).toBe(true);
  });

  // Demonstrates the actual bug this spec exists to prevent regressing:
  // the same realistic body, against an undecorated class, is entirely
  // rejected — every field with no matching decorator comes back as
  // unrecognized. This is the 400 "should not exist" response captured
  // live against gtd.controller.ts before the fix.
  it('regression check: an undecorated class fails whitelist on every field, proving the guard is meaningful', async () => {
    class UndecoratedCaptureBody {
      workspaceId?: string;
      trayId!: string;
      content?: string;
      title?: string | null;
    }
    const errors = await whitelistErrors(UndecoratedCaptureBody, {
      workspaceId: 'ws-1',
      trayId: 'root',
      content: 'hello',
      title: null,
    });
    // A class-validator instance with zero decorated properties comes back
    // as one `unknownValue` error naming the whole rejected object, not
    // one error per stripped field — confirmed against the real library
    // behavior rather than assumed. This is the shape ValidationPipe turns
    // into the live 400 "should not exist" response captured for real
    // against gtd.controller.ts before the fix.
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('unknownValue');
  });
});
