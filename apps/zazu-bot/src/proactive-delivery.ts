import express from 'express';
import cron from 'node-cron';
import { Telegraf } from 'telegraf';
import { ZazuContext } from '@zazu/skills-core';
import prisma from '@zazu/db';

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
    this.app.post('/api/internal/notify', async (req, res) => {
      // 1. Auth Guard
      const authHeader = req.headers.authorization;
      const expectedKey = process.env.NAU_SERVICE_KEY || 'development_key';
      
      if (!authHeader || authHeader !== `Bearer ${expectedKey}`) {
        return res.status(401).json({ error: 'Unauthorized. Invalid Platform Key.' });
      }

      // 2. Parse Payload
      const payload = req.body; 
      if (!payload.userId) return res.status(400).json({ error: 'Missing userId' });

      // 3. Evaluate Time Window
      const windowOpen = await this.isWindowOpen(payload.userId);
      
      try {
        const item = await prisma.notificationQueue.create({
          data: {
            userId: payload.userId,
            brandName: payload.brandName,
            payloadJson: payload,
            status: windowOpen ? 'READY' : 'PENDING',
          },
          include: { user: true }
        });
        
        if (windowOpen) {
          // Trigger immediate delivery attempt without waiting for the next cron cycle
          setImmediate(() => this.flushQueue());
        }
        
        return res.status(200).json({ success: true, queued: !windowOpen });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 4. Handle Suggestion Selection — sends isSelected feedback to nauthenticity
    this.bot.action(/^sugsel_(.+)_(\d+)$/, async (ctx) => {
      try {
        const [, postId, indexStr] = ctx.match as RegExpMatchArray;
        const suggestionIndex = parseInt(indexStr, 10);

        // Retrieve the original payload from the notification that generated this message
        const notification = await prisma.notificationQueue.findFirst({
          where: {
            payloadJson: {
              path: ['localPostId'],
              equals: postId,
            },
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

        // Submit feedback to nauthenticity
        const nautUrl = process.env.NAUTHENTICITY_URL || 'http://nauthenticity:3000';
        const nauKey = process.env.NAU_SERVICE_KEY || '';

        await fetch(`${nautUrl}/api/v1/comment-feedback`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${nauKey}` },
          body: JSON.stringify({
            commentText: selectedComment,
            brandId: payload.brandId,
            sourcePostId: postId,
            isSelected: true,
          }),
        });

        await ctx.answerCbQuery(`✅ Opción ${suggestionIndex + 1} registrada. ¡El Brain aprende!`);

        // Edit the message to show which option was selected
        const originalText = ctx.callbackQuery.message && 'text' in ctx.callbackQuery.message
          ? ctx.callbackQuery.message.text
          : '';
        await ctx.editMessageText(
          `${originalText}\n\n✅ *Elegiste la opción ${suggestionIndex + 1}*`,
          { parse_mode: 'Markdown', reply_markup: { inline_keyboard: [] } },
        ).catch(() => { /* Message too old or already edited — ignore */ });
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : String(err);
        console.error(`[ProactiveDelivery] sugsel callback error: ${msg}`);
        await ctx.answerCbQuery('Error al registrar preferencia.');
      }
    });
  }

  private async isWindowOpen(userId: string): Promise<boolean> {
    const window = await prisma.deliveryWindow.findUnique({ where: { userId } });
    if (!window) return true; // Default open 24/7 if not configured

    const now = new Date();
    const currentHour = now.getUTCHours(); 
    return currentHour >= window.startHour && currentHour < window.endHour;
  }

  public async flushQueue() {
    console.log(`[ProactiveDelivery] Evaluating Queue...`);
    const pendingItems = await prisma.notificationQueue.findMany({
      where: { status: { in: ['PENDING', 'READY'] } },
      include: { user: true }
    });

    if (!pendingItems.length) return;

    // Group items by user
    const userGroups = new Map<string, any[]>();
    for (const item of pendingItems) {
      if (item.status === 'PENDING') {
         if (!(await this.isWindowOpen(item.userId))) continue;
      }
      const arr = userGroups.get(item.userId) || [];
      arr.push(item);
      userGroups.set(item.userId, arr);
    }

      // Flush to telegram grouped by brand
    for (const [userId, items] of userGroups.entries()) {
       const user = items[0].user;
       if (!user.telegramId) {
          await prisma.notificationQueue.updateMany({
             where: { id: { in: items.map(i => i.id) } },
             data: { status: 'FAILED' }
          });
          continue;
       }

       // Split items by type to format differently
       const journalItems = items.filter(i => (i.payloadJson as any).type === 'journal_summary');
       const briefItems = items.filter(i => (i.payloadJson as any).type === 'content_brief');
       const suggestionItems = items.filter(i => 
         (i.payloadJson as any).type !== 'journal_summary' && 
         (i.payloadJson as any).type !== 'content_brief'
       );

       // 1. Process Journal Summaries
       for (const item of journalItems) {
         const payload = item.payloadJson as { summaryData: string; periodTitle: string };
         
         const textMsg = `📊 *${payload.periodTitle}*\n\n${payload.summaryData}`;

         await this.bot.telegram.sendMessage(user.telegramId.toString(), textMsg, {
           parse_mode: 'Markdown'
         });

         await prisma.notificationQueue.update({
            where: { id: item.id },
            data: { status: 'SENT', sentAt: new Date() }
         });
       }

       // 1.5 Process Content Briefs
       for (const item of briefItems) {
         const payload = item.payloadJson as { markdown: string; brandName: string };
         
         await this.bot.telegram.sendMessage(user.telegramId.toString(), payload.markdown, {
           parse_mode: 'Markdown'
         });

         await prisma.notificationQueue.update({
            where: { id: item.id },
            data: { status: 'SENT', sentAt: new Date() }
         });
       }

       // 2. Process Suggestion Items (grouped by brand)
       const brandGroups = new Map<string, any[]>();
       for (const item of suggestionItems) {
          const brand = item.brandName || 'General';
          const barr = brandGroups.get(brand) || [];
          barr.push(item);
          brandGroups.set(brand, barr);
       }

        for (const [brand, brandItems] of brandGroups.entries()) {
          for (const item of brandItems) {
             const payload = item.payloadJson as { postUrl: string; targetUsername: string; suggestions: string[]; brandId: string; localPostId: string };
             const url = payload.postUrl;

              // Suggestion text (monospace for easy tap-to-copy)
              const textMsg = payload.suggestions
                .map((sug: string, idx: number) =>
                  `*Opción ${idx + 1}* (toca para copiar):\n\`${sug}\``
                )
                .join('\n\n---\n\n');

              const headerMsg = `🏢 *${brand}*\n📝 *Sugerencias para @${payload.targetUsername}*\n\n${textMsg}`;

              // Build inline keyboard:
              // Row 1: View post on Instagram
              // Rows N: "Elegir opción N" callback buttons (one per suggestion)
              const inline_keyboard: import('telegraf/types').InlineKeyboardButton[][] = [
                [{ text: '📸 Ver Post en Instagram', url }],
              ];

              (payload.suggestions as string[]).forEach((_sug: string, idx: number) => {
                inline_keyboard.push([{
                  text: `✅ Elegir opción ${idx + 1}`,
                  callback_data: `sugsel_${payload.localPostId}_${idx}`,
                }]);
              });

             await this.bot.telegram.sendMessage(user.telegramId.toString(), headerMsg, {
               parse_mode: 'Markdown',
               reply_markup: {
                 inline_keyboard
               }
             });

             await prisma.notificationQueue.update({
                where: { id: item.id },
                data: { status: 'SENT', sentAt: new Date() }
             });
          }
       }
    }
  }

  public start() {
    this.app.listen(3000, () => {
      console.log('✅ Zazŭ Proactive Gateway listening on :3000');
    });

    cron.schedule('*/5 * * * *', () => this.flushQueue());
    console.log('✅ Zazŭ Proactive Cron is online.');
    
    // Evaluate instantly on startup
    this.flushQueue();
  }
}
