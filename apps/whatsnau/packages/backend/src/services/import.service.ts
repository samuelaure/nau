import { parse } from 'csv-parse';
import { Readable } from 'stream';
import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { generateContentHash } from '../core/hash.js';

export class ImportService {
  /**
   * Process CSV content with streaming and deduplication
   */
  static async processCSV(
    campaignId: string,
    name: string,
    csvContent: string,
    tenantId: string
  ) {
    logger.info({ campaignId, name }, 'Starting CSV import process');

    // Generate content hash for deduplication
    const contentHash = generateContentHash(csvContent);

    // Check if this exact file has been imported before
    const existingBatch = await (db as any).leadImportBatch.findUnique({
      where: { contentHash },
      include: { _count: { select: { stagingLeads: true } } },
    });

    if (existingBatch) {
      logger.info(
        { batchId: existingBatch.id, hash: contentHash },
        'Duplicate CSV detected, skipping import'
      );
      return {
        ...existingBatch,
        isDuplicate: true,
        message: `This file was already imported on ${existingBatch.createdAt.toISOString()}`,
      };
    }

    // Create batch first
    const batch = await (db as any).leadImportBatch.create({
      data: {
        campaignId,
        name,
        status: 'STAGING',
        contentHash,
        tenantId,
      },
    });

    // Process CSV with streaming parser
    const records: any[] = [];
    const stream = Readable.from([csvContent]);
    const parser = stream.pipe(
      parse({
        columns: true,
        skip_empty_lines: true,
        trim: true,
      })
    );

    for await (const record of parser) {
      records.push(record);
    }

    logger.info({ batchId: batch.id, recordCount: records.length }, 'CSV parsed successfully');

    // Transform records to staging leads
    const stagingLeads = records.map((record: any) => {
      const phoneKey = this.findKey(record, [
        'phone',
        'tel',
        'nmero',
        'whatsapp',
        'mobile',
      ]);
      const nameKey = this.findKey(record, ['name', 'nombre', 'business', 'company', 'title']);
      const websiteKey = this.findKey(record, ['web', 'sitio', 'url', 'link', 'domain']);
      const emailKey = this.findKey(record, ['email', 'correo', 'mail']);

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
        tenantId,
      };
    });

    // Bulk create in chunks to avoid memory issues
    const CHUNK_SIZE = 500;
    for (let i = 0; i < stagingLeads.length; i += CHUNK_SIZE) {
      const chunk = stagingLeads.slice(i, i + CHUNK_SIZE);
      await (db as any).stagingLead.createMany({
        data: chunk,
      });
      logger.info(
        { batchId: batch.id, processed: Math.min(i + CHUNK_SIZE, stagingLeads.length) },
        'Chunk inserted'
      );
    }

    return { ...batch, isDuplicate: false };
  }

  /**
   * Helper to find a key in a record by multiple possible names
   */
  private static findKey(record: any, keywords: string[]): string {
    return (
      Object.keys(record).find((k) => {
        const lower = k.toLowerCase();
        return keywords.some((keyword) => lower.includes(keyword));
      }) || ''
    );
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
