import { parse } from 'csv-parse/sync';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class ImportService {
    static async processCSV(campaignId: string, name: string, csvContent: string) {
        logger.info({ campaignId, name }, 'Starting CSV import process');

        const records = parse(csvContent, {
            columns: true,
            skip_empty_lines: true,
            trim: true
        });

        const batch = await (db as any).leadImportBatch.create({
            data: {
                campaignId,
                name,
                status: 'STAGING'
            }
        });

        const stagingLeads = records.map((record: any) => {
            // Flexible detection of common headers (including common scraping tool outputs)
            const phoneKey = Object.keys(record).find(k => {
                const lower = k.toLowerCase();
                return lower.includes('phone') || lower.includes('tel') || lower.includes('nmero') || lower.includes('whatsapp') || lower.includes('mobile');
            }) || '';

            const nameKey = Object.keys(record).find(k => {
                const lower = k.toLowerCase();
                return lower === 'name' || lower.includes('nombre') || lower.includes('business') || lower.includes('company') || lower.includes('title');
            }) || '';

            const websiteKey = Object.keys(record).find(k => {
                const lower = k.toLowerCase();
                return lower.includes('web') || lower.includes('sitio') || lower.includes('url') || lower.includes('link') || lower.includes('domain');
            }) || '';

            const emailKey = Object.keys(record).find(k => {
                const lower = k.toLowerCase();
                return lower.includes('email') || lower.includes('correo') || lower.includes('mail');
            }) || '';

            const ratingKey = Object.keys(record).find(k => k.toLowerCase().includes('rating') || k.toLowerCase().includes('nota') || k.toLowerCase().includes('puntuacion')) || '';
            const reviewsKey = Object.keys(record).find(k => k.toLowerCase().includes('reviews') || k.toLowerCase().includes('reseñas') || k.toLowerCase().includes('count')) || '';

            let phone = (record[phoneKey] || '').toString().trim();
            // Basic phone cleaning (remove spaces, dashes, parentheses)
            phone = phone.replace(/[^0-9+]/g, '');
            if (phone && !phone.startsWith('+')) {
                // If it looks like a Spain number without prefix
                if (phone.length === 9 && (phone.startsWith('6') || phone.startsWith('7') || phone.startsWith('9'))) {
                    phone = `+34${phone}`;
                }
            }

            let website = (record[websiteKey] || '').toString().trim();
            if (website && !website.startsWith('http')) {
                website = `https://${website}`;
            }

            return {
                batchId: batch.id,
                rawData: JSON.stringify(record),
                phoneNumber: phone,
                name: (record[nameKey] || null)?.toString().trim(),
                website: website || null,
                email: (record[emailKey] || null)?.toString().trim(),
                cleanseStatus: 'PENDING'
            };
        });

        // Bulk create (Prisma SQLite limitation handles this in chunks or just many creates)
        // For simplicity and speed in SQLite, we can do multiple at once
        await (db as any).stagingLead.createMany({
            data: stagingLeads
        });

        return batch;
    }

    static async getBatchDetails(batchId: string) {
        return await (db as any).leadImportBatch.findUnique({
            where: { id: batchId },
            include: { stagingLeads: { include: { opportunities: true } } }
        });
    }
}
