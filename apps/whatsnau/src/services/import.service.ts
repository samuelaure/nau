import { parse } from 'csv-parse/sync';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

export class ImportService {
  static async processCSV(campaignId: string, name: string, csvContent: string) {
    logger.info({ campaignId, name }, 'Starting CSV import process');

    const records = parse(csvContent, {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const batch = await (db as any).leadImportBatch.create({
      data: {
        campaignId,
        name,
        status: 'STAGING',
      },
    });

    const stagingLeads = records.map((record: any) => {
      // Flexible detection of common headers (including common scraping tool outputs)
      const phoneKey =
        Object.keys(record).find((k) => {
          const lower = k.toLowerCase();
          return (
            lower.includes('phone') ||
            lower.includes('tel') ||
            lower.includes('nmero') ||
            lower.includes('whatsapp') ||
            lower.includes('mobile')
          );
        }) || '';

      const nameKey =
        Object.keys(record).find((k) => {
          const lower = k.toLowerCase();
          return (
            lower === 'name' ||
            lower.includes('nombre') ||
            lower.includes('business') ||
            lower.includes('company') ||
            lower.includes('title')
          );
        }) || '';

      const websiteKey =
        Object.keys(record).find((k) => {
          const lower = k.toLowerCase();
          return (
            lower.includes('web') ||
            lower.includes('sitio') ||
            lower.includes('url') ||
            lower.includes('link') ||
            lower.includes('domain')
          );
        }) || '';

      const emailKey =
        Object.keys(record).find((k) => {
          const lower = k.toLowerCase();
          return lower.includes('email') || lower.includes('correo') || lower.includes('mail');
        }) || '';

      const ratingKey =
        Object.keys(record).find(
          (k) =>
            k.toLowerCase().includes('rating') ||
            k.toLowerCase().includes('nota') ||
            k.toLowerCase().includes('puntuacion')
        ) || '';
      const reviewsKey =
        Object.keys(record).find(
          (k) =>
            k.toLowerCase().includes('reviews') ||
            k.toLowerCase().includes('reseñas') ||
            k.toLowerCase().includes('count')
        ) || '';

      const phone = this.cleanPhoneNumber((record[phoneKey] || '').toString());
      const website = this.cleanWebsite((record[websiteKey] || '').toString());

      return {
        batchId: batch.id,
        rawData: JSON.stringify(record),
        phoneNumber: phone,
        name: (record[nameKey] || null)?.toString().trim(),
        website: website || null,
        email: (record[emailKey] || null)?.toString().trim(),
        cleanseStatus: 'PENDING',
      };
    });

    // Bulk create
    await (db as any).stagingLead.createMany({
      data: stagingLeads,
    });

    return batch;
  }

  /**
   * Cleans and normalizes phone numbers (Spain focus)
   */
  static cleanPhoneNumber(phone: string): string {
    let cleaned = phone.trim().replace(/[^0-9+]/g, '');
    if (cleaned && !cleaned.startsWith('+')) {
      // 9 digits and starts with common Spanish prefixes
      if (
        cleaned.length === 9 &&
        (cleaned.startsWith('6') || cleaned.startsWith('7') || cleaned.startsWith('9'))
      ) {
        cleaned = `+34${cleaned}`;
      }
    }
    return cleaned;
  }

  /**
   * Normalizes website URLs
   */
  static cleanWebsite(url: string | null): string | null {
    if (!url) return null;
    let website = url.trim();
    if (website && !website.startsWith('http')) {
      website = `https://${website}`;
    }
    return website || null;
  }

  static async getBatchDetails(batchId: string) {
    return await (db as any).leadImportBatch.findUnique({
      where: { id: batchId },
      include: { stagingLeads: { include: { opportunities: true } } },
    });
  }
}
