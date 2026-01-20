import { config } from '../core/config.js';
import { logger } from '../core/logger.js';
import { db } from '../core/db.js';

export class NotificationService {
    private static botToken = config.TELEGRAM_BOT_TOKEN;
    private static chatId = config.TELEGRAM_CHAT_ID;

    private static async getSettings() {
        try {
            return await (db as any).telegramConfig.findUnique({ where: { id: 'singleton' } });
        } catch (error) {
            return null;
        }
    }

    static async sendTelegramAlert(message: string) {
        const settings = await this.getSettings();
        const token = settings?.botToken || this.botToken;
        const chat = settings?.chatId || this.chatId;
        const enabled = settings?.isEnabled ?? !!token;

        if (!enabled || !token || !chat) {
            logger.debug('Telegram notifications are disabled or not configured');
            return;
        }

        const url = `https://api.telegram.org/bot${token}/sendMessage`;

        try {
            const response = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chat,
                    text: message,
                    parse_mode: 'HTML'
                })
            });

            if (!response.ok) {
                const data = await response.json();
                logger.error({ data }, 'Telegram API Error');
            }
        } catch (error) {
            logger.error({ err: error }, 'Failed to send Telegram notification');
        }
    }

    static async notifyHandover(lead: any, reasoning?: string) {
        const dashboardUrl = `http://localhost:5173/`; // Should be configurable
        const text = `🚨 <b>Intelligent Handover Triggered</b>\n\n` +
            `👤 <b>Lead:</b> ${lead.name || 'Unknown'} (${lead.phoneNumber})\n` +
            `📝 <b>Reasoning:</b> ${reasoning || 'Lead requested human intervention.'}\n\n` +
            `🔗 <a href="${dashboardUrl}">Open Dashboard</a>`;

        await this.sendTelegramAlert(text);
    }

    static async notifyHighIntent(lead: any, message: string) {
        const text = `🔥 <b>High Intent Detected</b>\n\n` +
            `👤 <b>Lead:</b> ${lead.name || 'Unknown'} (${lead.phoneNumber})\n` +
            `💬 <b>Message:</b> "${message}"\n\n` +
            `Check the dashboard to intervene!`;

        await this.sendTelegramAlert(text);
    }
}
