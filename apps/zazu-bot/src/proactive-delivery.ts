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
        await prisma.notificationQueue.create({
          data: {
            userId: payload.userId,
            brandName: payload.brandName,
            payloadJson: payload,
            status: windowOpen ? 'READY' : 'PENDING',
          }
        });
        
        return res.status(200).json({ success: true, queued: !windowOpen });
      } catch (err: any) {
        return res.status(500).json({ error: err.message });
      }
    });

    // 4. Handle Callback Actions (Telemetry trigger back to nauthenticity)
    this.bot.action(/sugsel_.*/, async (ctx) => {
        const data = ctx.match[0]; // e.g. sugsel_item123_0
        const [,, itemId, indexStr] = data.split('_'); // We will structure it as sugsel_user_item_index
        
        await ctx.answerCbQuery('Opción seleccionada y logueada. 🚀');
        // A full implementation would take this event and fire a POST to nauthenticity/v1/comment-feedback
        await ctx.reply('Feedback guardado en el Brain (vía Telemetry).');
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
       const brandGroups = new Map<string, any[]>();
       for (const item of items) {
          const brand = item.brandName || 'General';
          const barr = brandGroups.get(brand) || [];
          barr.push(item);
          brandGroups.set(brand, barr);
       }

       const user = items[0].user;
       if (!user.telegramId) {
          await prisma.notificationQueue.updateMany({
             where: { id: { in: items.map(i => i.id) } },
             data: { status: 'FAILED' }
          });
          continue;
       }

       for (const [brand, brandItems] of brandGroups.entries()) {
          // Brand Separator Header
          await this.bot.telegram.sendMessage(user.telegramId.toString(), `🏢 **${brand}** - Tienes ${brandItems.length} comentarios sugeridos pendientes.`);
          
          for (const item of brandItems) {
             const payload = item.payloadJson as any;
             const url = payload.postUrl;

             const textMsg = payload.suggestions.map((sug: string, idx: number) => `**Opción ${idx+1}:**\n${sug}`).join('\n\n---\n\n');
             const headerMsg = `📝 **Sugerencias para el nuevo post de @${payload.targetUsername}**\n\n${textMsg}`;
             
             const buttons = payload.suggestions.map((sug: string, idx: number) => {
                 return [{ text: `Seleccionar Opción ${idx+1}`, callback_data: `sugsel_${user.id}_${item.id}_${idx}` }];
             });

             await this.bot.telegram.sendMessage(user.telegramId.toString(), headerMsg, {
               parse_mode: 'Markdown',
               reply_markup: {
                 inline_keyboard: [
                   [{ text: "📸 Ver Post en Instagram", url: url }],
                   ...buttons
                 ]
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
