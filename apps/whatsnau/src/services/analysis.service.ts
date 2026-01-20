import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { AIService } from './ai.service.js';
import { WhatsAppService } from './whatsapp.service.js';

export class AnalysisService {
    /**
     * CLEANSE: Deterministic data cleaning and basic opportunity detection
     */
    static async cleanseBatch(batchId: string) {
        const stagingLeads = await (db as any).stagingLead.findMany({ where: { batchId } });

        for (const lead of stagingLeads) {
            let cleanseStatus = 'CLEANED';
            const opportunities = [];

            // Example opportunistic logic: Missing website for Google Maps info
            if (!lead.website || lead.website.trim() === '') {
                opportunities.push({
                    type: 'NO_WEBSITE',
                    description: 'Business has no website listed. High potential for web development services.',
                    severity: 'HIGH'
                });
            }

            // Basic phone validation
            if (!lead.phoneNumber || lead.phoneNumber.length < 9) {
                cleanseStatus = 'INVALID';
            }

            await (db as any).stagingLead.update({
                where: { id: lead.id },
                data: {
                    cleanseStatus,
                    opportunities: {
                        create: opportunities
                    }
                }
            });
        }

        await (db as any).leadImportBatch.update({
            where: { id: batchId },
            data: { status: 'READY' } // Ready for verification or AI analysis
        });
    }

    /**
     * VERIFY: Check WhatsApp activity (Massive check)
     */
    static async verifyBatchWhatsApp(batchId: string) {
        const stagingLeads = await (db as any).stagingLead.findMany({
            where: { batchId, cleanseStatus: 'CLEANED' }
        });

        const phoneNumbers = stagingLeads.map((l: any) => l.phoneNumber);
        const chunks = this.chunkArray(phoneNumbers, 100);

        for (const chunk of chunks) {
            try {
                const results = await WhatsAppService.verifyNumbers(chunk);
                if (results.contacts) {
                    for (const contact of results.contacts) {
                        const isValid = contact.status === 'valid';
                        await (db as any).stagingLead.updateMany({
                            where: { batchId, phoneNumber: contact.input.replace('+', '').replace(/\s/g, '') },
                            data: {
                                isValidWhatsApp: isValid,
                                isVerified: true
                            }
                        });
                    }
                }
            } catch (err) {
                logger.error({ err, chunk }, 'WhatsApp verification chunk failed');
            }
        }
    }

    /**
     * AI ANALYSIS: Deep opportunity lookups (Costs money, manual trigger)
     */
    static async performDeepAIAnalysis(batchId: string) {
        const stagingLeads = await (db as any).stagingLead.findMany({
            where: { batchId, cleanseStatus: 'CLEANED', isValidWhatsApp: true },
            include: { opportunities: true }
        });

        for (const lead of stagingLeads) {
            const prompt = `Analiza los datos de este lead y detecta oportunidades de negocio.\n` +
                `Datos: ${lead.rawData}\n` +
                `Oportunidades actuales: ${lead.opportunities.map((o: any) => o.type).join(', ')}\n\n` +
                `Responde solo con un JSON array de objetos con {type, description, severity}.`;

            try {
                const aiResponse = await AIService.getChatResponse(
                    "Eres un experto en análisis de oportunidades comerciales B2B.",
                    [{ role: 'user', content: prompt }],
                    false // deterministic
                );

                if (aiResponse) {
                    const cleanJson = aiResponse.replace(/```json|```/g, '').trim();
                    const finds = JSON.parse(cleanJson);
                    if (Array.isArray(finds)) {
                        for (const find of finds) {
                            await (db as any).opportunity.create({
                                data: {
                                    stagingLeadId: lead.id,
                                    type: find.type,
                                    description: find.description,
                                    severity: find.severity || 'MEDIUM',
                                    aiGenerated: true
                                }
                            });
                        }
                    }
                }
            } catch (err) {
                logger.error({ err, leadId: lead.id }, 'AI Opportunity analysis failed for lead');
            }
        }

        await (db as any).leadImportBatch.update({
            where: { id: batchId },
            data: { status: 'ANALYZING' }
        });
    }

    private static chunkArray(array: any[], size: number) {
        const result = [];
        for (let i = 0; i < array.length; i += size) {
            result.push(array.slice(i, i + size));
        }
        return result;
    }
}
