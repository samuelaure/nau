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
            // Flexible detection of common headers
            const phoneKey = Object.keys(record).find(k => k.toLowerCase().includes('phone') || k.toLowerCase().includes('tel') || k.toLowerCase().includes('número')) || '';
            const nameKey = Object.keys(record).find(k => k.toLowerCase() === 'name' || k.toLowerCase().includes('nombre') || k.toLowerCase().includes('business')) || '';
            const websiteKey = Object.keys(record).find(k => k.toLowerCase().includes('web') || k.toLowerCase().includes('sitio') || k.toLowerCase().includes('url')) || '';
            const emailKey = Object.keys(record).find(k => k.toLowerCase().includes('email') || k.toLowerCase().includes('correo')) || '';

            let phone = record[phoneKey] || '';
            // Basic phone cleaning (remove spaces, dashes)
            phone = phone.replace(/[^0-9+]/g, '');
            if (phone && !phone.startsWith('+')) {
                // Default to +34 if missing (Spain first principle) or just keep as is if too short
                if (phone.length === 9) phone = `+34${phone}`;
            }

            return {
                batchId: batch.id,
                rawData: JSON.stringify(record),
                phoneNumber: phone,
                name: record[nameKey] || null,
                website: record[websiteKey] || null,
                email: record[emailKey] || null,
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
