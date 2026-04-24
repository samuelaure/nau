import { config } from '../core/config.js';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class TelegramService {
    /**
     * Send notification to system administrators (Ops/Dev team)
     * Uses system-level credentials defined in environment variables.
     */
    static async sendSystemNotification(message: string) {
        const botToken = config.TELEGRAM_BOT_TOKEN;
        const chatId = config.TELEGRAM_SYSTEM_CHAT_ID;

        if (!botToken || !chatId) {
            logger.warn('Telegram system credentials missing (TELEGRAM_BOT_TOKEN or TELEGRAM_SYSTEM_CHAT_ID)');
            return;
        }

        await this.sendMessage(botToken, chatId, message);
    }

    /**
     * Send notification to specific tenant's channel
     * Uses system-level bot token but tenant-specific chat ID from DB.
     */
    static async sendTenantNotification(tenantId: string, message: string) {
        if (!tenantId) {
            logger.warn('Cannot send tenant notification: tenantId is missing');
            return;
        }

        const botToken = config.TELEGRAM_BOT_TOKEN;
        if (!botToken) {
            logger.warn('Telegram bot token not configured');
            return;
        }

        try {
            // Lookup tenant chat ID
            // Note: We use findFirst allowing for potential multiple configs but typically 1:1 per tenant
            const conf = await db.telegramConfig.findFirst({
                where: { tenantId },
            });

            if (conf?.chatId && conf.isEnabled) {
                await this.sendMessage(botToken, conf.chatId, message);
            } else {
                logger.debug({ tenantId }, 'Telegram notifications disabled or not configured for tenant');
            }
        } catch (err) {
            logger.error({ err, tenantId }, 'Failed to resolve tenant Telegram config');
        }
    }

    private static async sendMessage(token: string, chatId: string, text: string) {
        const url = `https://api.telegram.org/bot${token}/sendMessage`;
        try {
            const res = await fetch(url, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    chat_id: chatId,
                    text,
                    parse_mode: 'HTML',
                    disable_web_page_preview: true,
                }),
            });

            if (!res.ok) {
                const errorText = await res.text();
                logger.error({ status: res.status, error: errorText, chatId }, 'Telegram Send Failed');
            }
        } catch (e) {
            logger.error({ err: e, chatId }, 'Telegram Network Error');
        }
    }
}
