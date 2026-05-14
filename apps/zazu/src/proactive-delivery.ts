import express from 'express';
import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { ZazuContext } from '@zazu/skills-core';
import prisma, { Role } from '@zazu/db';
import { logger } from './lib/logger';
import { requireServiceAuth, buildServiceHeaders } from './lib/service-auth';

const ADMIN_TELEGRAM_ID = process.env['ADMIN_TELEGRAM_ID'];

export class ProactiveDeliverySystem {
  private bot: Telegraf<ZazuContext>;
  private app: express.Application;

  constructor(bot: Telegraf<ZazuContext>) {
    this.bot = bot;
    this.app = express();
    this.app.use(express.json());
    this.setupRoutes();
  }

  private setupRoutes() {
    this.app.get('/health', (_req, res) => res.json({ ok: true }));

    // ── Notify (platform → user) ──────────────────────────────────────────────

    this.app.post('/api/internal/notify', requireServiceAuth, async (req, res) => {
      const payload = req.body;
      try {
        const { nauUserId } = payload;
        if (!nauUserId) return res.status(400).json({ error: 'Missing nauUserId' });

        const user = await prisma.user.findFirst({ where: { nauUserId } });
        if (!user) {
          logger.warn({ nauUserId }, '[ProactiveGateway] No Zazu user linked to nauUserId — notification dropped');
          return res.status(404).json({ error: 'No Zazu user linked to this nauUserId' });
        }

        const windowOpen = await this.isWindowOpen(user.id);

        const item = await prisma.notificationQueue.create({
          data: {
            userId: user.id,
            brandName: payload.brandName,
            payloadJson: payload,
            status: windowOpen ? 'READY' : 'PENDING',
          },
          include: { user: true },
        });

        if (windowOpen) {
          setImmediate(() => this.flushQueue());
        }

        return res.status(200).json({ success: true, queued: !windowOpen });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Link naŭ account ──────────────────────────────────────────────────────

    this.app.patch('/api/internal/users/:telegramId', requireServiceAuth, async (req, res) => {
      const { telegramId } = req.params;
      const { nauUserId } = req.body as { nauUserId?: string };
      if (!nauUserId) return res.status(400).json({ error: 'Missing nauUserId' });
      try {
        await prisma.user.updateMany({ where: { telegramId: BigInt(String(telegramId)) }, data: { nauUserId } });
        this.bot.telegram.sendMessage(
          String(telegramId),
          '✅ ¡Cuenta vinculada! Tu cuenta naŭ Platform está conectada. Ya puedes recibir notificaciones y enviar ideas de voz.',
        ).catch(() => { /* non-critical */ });
        return res.status(200).json({ ok: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: direct message ─────────────────────────────────────────────────

    this.app.post('/api/internal/admin/message', requireServiceAuth, async (req, res) => {
      const { telegramId, message } = req.body as { telegramId?: string; message?: string };
      if (!telegramId || !message) return res.status(400).json({ error: 'Missing fields' });
      try {
        await this.bot.telegram.sendMessage(telegramId, message);

        const user = await prisma.user.findFirst({
          where: { telegramId: BigInt(telegramId) },
          select: { id: true },
        });
        if (user) {
          await prisma.message.create({
            data: { userId: user.id, role: Role.ADMIN, content: message },
          });
        }

        return res.status(200).json({ ok: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: broadcast ──────────────────────────────────────────────────────

    this.app.post('/api/internal/admin/broadcast', requireServiceAuth, async (req, res) => {
      const { message } = req.body as { message?: string };
      if (!message) return res.status(400).json({ error: 'Missing message' });
      try {
        const users = await prisma.user.findMany({ select: { telegramId: true } });
        let sent = 0;
        for (const user of users) {
          try {
            await this.bot.telegram.sendMessage(user.telegramId.toString(), message);
            sent++;
          } catch {
            // User may have blocked the bot — skip silently
          }
        }
        await prisma.broadcast.create({ data: { message, sentCount: sent } });
        return res.status(200).json({ ok: true, sent });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: list users ─────────────────────────────────────────────────────

    this.app.get('/api/internal/admin/users', requireServiceAuth, async (_req, res) => {
      try {
        const users = await prisma.user.findMany({
          select: {
            id: true,
            telegramId: true,
            firstName: true,
            lastName: true,
            username: true,
            displayName: true,
            nauUserId: true,
            forwardNotificationsToAdmin: true,
            createdAt: true,
            deliveryWindow: true,
            messages: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
            notifications: { select: { createdAt: true }, orderBy: { createdAt: 'desc' }, take: 1 },
          },
          orderBy: { createdAt: 'desc' },
        });

        const result = users.map(u => {
          const lastMsg = u.messages[0]?.createdAt ?? null;
          const lastNotif = u.notifications[0]?.createdAt ?? null;
          const lastActivity = lastMsg && lastNotif
            ? (lastMsg > lastNotif ? lastMsg : lastNotif)
            : (lastMsg ?? lastNotif ?? u.createdAt);
          return {
            id: u.id,
            telegramId: u.telegramId.toString(),
            firstName: u.firstName,
            lastName: u.lastName,
            username: u.username,
            displayName: u.displayName,
            nauUserId: u.nauUserId,
            forwardNotificationsToAdmin: u.forwardNotificationsToAdmin,
            createdAt: u.createdAt,
            deliveryWindow: u.deliveryWindow,
            lastActivity,
          };
        });

        result.sort((a, b) => new Date(b.lastActivity).getTime() - new Date(a.lastActivity).getTime());

        return res.status(200).json(result);
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: per-user chat timeline ─────────────────────────────────────────

    this.app.get('/api/internal/admin/users/:userId/chat', requireServiceAuth, async (req, res) => {
      const userId = String(req.params['userId']);
      const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 100);
      const before = req.query['before'] ? new Date(String(req.query['before'])) : new Date();

      try {
        const [messages, notifications, broadcasts] = await Promise.all([
          prisma.message.findMany({
            where: { userId: userId, createdAt: { lt: before } },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
          prisma.notificationQueue.findMany({
            where: { userId: userId, createdAt: { lt: before } },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
          prisma.broadcast.findMany({
            where: { createdAt: { lt: before } },
            orderBy: { createdAt: 'desc' },
            take: limit,
          }),
        ]);

        type ChatItem =
          | { kind: 'message'; id: string; role: string; content: string; createdAt: Date }
          | { kind: 'notification'; id: string; brandName: string | null; payloadType: string; payloadJson: any; status: string; sentAt: Date | null; createdAt: Date }
          | { kind: 'broadcast'; id: string; message: string; sentCount: number; createdAt: Date };

        const items: ChatItem[] = [
          ...messages.map(m => ({ kind: 'message' as const, id: m.id, role: m.role, content: m.content, createdAt: m.createdAt })),
          ...notifications.map(n => ({
            kind: 'notification' as const,
            id: n.id,
            brandName: n.brandName,
            payloadType: (n.payloadJson as any)?.type ?? 'unknown',
            payloadJson: n.payloadJson,
            status: n.status,
            sentAt: n.sentAt,
            createdAt: n.createdAt,
          })),
          ...broadcasts.map(b => ({ kind: 'broadcast' as const, id: b.id, message: b.message, sentCount: b.sentCount, createdAt: b.createdAt })),
        ];

        items.sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
        const page = items.slice(0, limit);
        const hasMore = items.length > limit;

        return res.status(200).json({ items: page, hasMore });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: broadcast history ──────────────────────────────────────────────

    this.app.get('/api/internal/admin/broadcast/history', requireServiceAuth, async (req, res) => {
      const limit = Math.min(parseInt(String(req.query['limit'] ?? '50'), 10), 100);
      const before = req.query['before'] ? new Date(String(req.query['before'])) : new Date();
      try {
        const broadcasts = await prisma.broadcast.findMany({
          where: { createdAt: { lt: before } },
          orderBy: { createdAt: 'desc' },
          take: limit + 1,
        });
        const hasMore = broadcasts.length > limit;
        return res.status(200).json({ items: broadcasts.slice(0, limit), hasMore });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Admin: update user settings ───────────────────────────────────────────

    this.app.patch('/api/internal/admin/users/:userId/settings', requireServiceAuth, async (req, res) => {
      const userId = String(req.params['userId']);
      const { forwardNotificationsToAdmin } = req.body as { forwardNotificationsToAdmin?: boolean };
      if (typeof forwardNotificationsToAdmin !== 'boolean') {
        return res.status(400).json({ error: 'Missing or invalid forwardNotificationsToAdmin' });
      }
      try {
        await prisma.user.update({ where: { id: userId }, data: { forwardNotificationsToAdmin } });
        return res.status(200).json({ ok: true });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // ── Callback: suggestion selection ───────────────────────────────────────

    this.bot.action(/^sugsel_(.+)_(\d+)$/, async (ctx) => {
      try {
        const [, postId, indexStr] = ctx.match as RegExpMatchArray;
        const suggestionIndex = parseInt(indexStr, 10);

        const notification = await prisma.notificationQueue.findFirst({
          where: {
            payloadJson: { path: ['localPostId'], equals: postId },
            status: 'SENT',
          },
          orderBy: { sentAt: 'desc' },
        });

        if (!notification) {
          await ctx.answerCbQuery('No se encontró la notificación. ¿Ya fue procesada?');
          return;
        }

        const payload = notification.payloadJson as {
          suggestions: string[];
          brandId: string;
          localPostId: string;
        };

        const selectedComment = payload.suggestions[suggestionIndex];
        if (!selectedComment) {
          await ctx.answerCbQuery('Índice inválido.');
          return;
        }

        const nautUrl = process.env.NAUTHENTICITY_URL || 'http://nauthenticity:4000';
        const nautHeaders = await buildServiceHeaders('nauthenticity');

        await fetch(`${nautUrl}/api/v1/brands/${payload.brandId}/comment-feedback`, {
          method: 'POST',
          headers: nautHeaders,
          body: JSON.stringify({ commentText: selectedComment, postId, isSelected: true }),
        });

        await ctx.answerCbQuery(`✅ Opción ${suggestionIndex + 1} registrada. ¡El Brain aprende!`);

        const originalText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message
          ? ctx.callbackQuery.message.text
          : '';
        await ctx.editMessageText(
          `${originalText}\n\n✅ *Elegiste la opción ${suggestionIndex + 1}*`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } },
        ).catch(() => { /* Message too old or already edited */ });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        logger.error({ err: msg }, 'ProactiveDelivery sugsel callback error');
        await ctx.answerCbQuery('Error al registrar preferencia.');
      }
    });
  }

  private async isWindowOpen(userId: string): Promise<boolean> {
    const window = await prisma.deliveryWindow.findUnique({ where: { userId } });
    if (!window) return true;

    const now = new Date();
    const currentHour = now.getUTCHours();
    return currentHour >= window.startHour && currentHour < window.endHour;
  }

  private async forwardToAdmin(text: string): Promise<void> {
    if (!ADMIN_TELEGRAM_ID) return;
    try {
      await this.bot.telegram.sendMessage(ADMIN_TELEGRAM_ID, text, { parse_mode: 'Markdown' });
    } catch {
      // Non-critical — never let forwarding block delivery
    }
  }

  public async flushQueue() {
    logger.info('ProactiveDelivery: Evaluating queue...');
    const pendingItems = await prisma.notificationQueue.findMany({
      where: { status: { in: ['PENDING', 'READY'] } },
      include: { user: true },
    });

    if (!pendingItems.length) return;

    const userGroups = new Map<string, typeof pendingItems>();
    for (const item of pendingItems) {
      if (item.status === 'PENDING') {
        if (!(await this.isWindowOpen(item.userId))) continue;
      }
      const arr = userGroups.get(item.userId) ?? [];
      arr.push(item);
      userGroups.set(item.userId, arr);
    }

    for (const [, items] of userGroups.entries()) {
      const user = items[0].user;
      if (!user.telegramId) {
        await prisma.notificationQueue.updateMany({
          where: { id: { in: items.map(i => i.id) } },
          data: { status: 'FAILED' },
        });
        continue;
      }

      const tidStr = user.telegramId.toString();
      const shouldForward = user.forwardNotificationsToAdmin;

      const journalItems = items.filter(i => (i.payloadJson as any).type === 'journal_summary');
      const MARKDOWN_TYPES = new Set(['content_brief', 'calendar_fill_blocked', 'approval_digest_today', 'approval_digest_tomorrow', 'approval_next_in_line']);
      const briefItems = items.filter(i => MARKDOWN_TYPES.has((i.payloadJson as any).type));
      const suggestionItems = items.filter(i =>
        (i.payloadJson as any).type !== 'journal_summary' &&
        !MARKDOWN_TYPES.has((i.payloadJson as any).type),
      );

      for (const item of journalItems) {
        const payload = item.payloadJson as { summaryData: string; periodTitle: string };
        const text = `📊 *${payload.periodTitle}*\n\n${payload.summaryData}`;
        await this.bot.telegram.sendMessage(tidStr, text, { parse_mode: 'Markdown' });
        if (shouldForward) await this.forwardToAdmin(`👤 *${user.displayName ?? user.firstName ?? tidStr}*\n\n${text}`);
        await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'SENT', sentAt: new Date() } });
      }

      for (const item of briefItems) {
        const payload = item.payloadJson as { markdown: string; brandName: string };
        await this.bot.telegram.sendMessage(tidStr, payload.markdown, { parse_mode: 'Markdown' });
        if (shouldForward) await this.forwardToAdmin(`👤 *${user.displayName ?? user.firstName ?? tidStr}*\n\n${payload.markdown}`);
        await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'SENT', sentAt: new Date() } });
      }

      const brandGroups = new Map<string, typeof suggestionItems>();
      for (const item of suggestionItems) {
        const brand = item.brandName || 'General';
        const barr = brandGroups.get(brand) ?? [];
        barr.push(item);
        brandGroups.set(brand, barr);
      }

      for (const [brand, brandItems] of brandGroups.entries()) {
        for (const item of brandItems) {
          const payload = item.payloadJson as { postUrl: string; targetUsername: string; suggestions: string[]; brandId: string; localPostId: string };

          const textMsg = payload.suggestions
            .map((sug, idx) => `*Opción ${idx + 1}* (toca para copiar):\n\`${sug}\``)
            .join('\n\n---\n\n');
          const headerMsg = `🏢 *${brand}*\n📝 *Sugerencias para @${payload.targetUsername}*\n\n${textMsg}`;

          const inline_keyboard: import('telegraf/types').InlineKeyboardButton[][] = [
            [{ text: '📸 Ver Post en Instagram', url: payload.postUrl }],
            ...payload.suggestions.map((_s, idx) => [{
              text: `✅ Elegir opción ${idx + 1}`,
              callback_data: `sugsel_${payload.localPostId}_${idx}`,
            }]),
          ];

          await this.bot.telegram.sendMessage(tidStr, headerMsg, {
            parse_mode: 'Markdown',
            reply_markup: { inline_keyboard },
          });

          if (shouldForward) await this.forwardToAdmin(`👤 *${user.displayName ?? user.firstName ?? tidStr}*\n\n${headerMsg}`);

          await prisma.notificationQueue.update({ where: { id: item.id }, data: { status: 'SENT', sentAt: new Date() } });
        }
      }
    }
  }

  public start() {
    this.app.listen(3000, () => {
      logger.info('Zazŭ Proactive Gateway listening on :3000');
    });

    cron.schedule('*/5 * * * *', () => this.flushQueue());
    logger.info('Zazŭ Proactive Cron is online');

    this.flushQueue();
  }
}
