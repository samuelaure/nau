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
            const raw = JSON.parse(lead.rawData);

            // 1. Basic phone validation
            if (!lead.phoneNumber || lead.phoneNumber.length < 9) {
                cleanseStatus = 'INVALID';
            }

            // 2. Duplicate Check (Industry Standard)
            const existingLead = await db.lead.findFirst({ where: { phoneNumber: lead.phoneNumber } });
            if (existingLead) {
                cleanseStatus = 'DUPLICATE';
            }

            // 3. Opportunity Detection (Deterministic/Non-AI)
            // No Website
            if (!lead.website || lead.website.trim() === '') {
                opportunities.push({
                    type: 'NO_WEBSITE',
                    description: 'Business has no website listed. Potential for web development services.',
                    severity: 'HIGH'
                });
            }

            // Low Reviews or Rating (Common in Gmaps data)
            const rating = parseFloat(raw.rating || raw.puntuacion || 0);
            const reviews = parseInt(raw.reviews || raw.reviews_count || raw.reseñas || 0);

            if (reviews > 0 && reviews < 10) {
                opportunities.push({
                    type: 'FEW_REVIEWS',
                    description: `Only ${reviews} reviews. Needs reputation management.`,
                    severity: 'MEDIUM'
                });
            }

            if (rating > 0 && rating < 3.5) {
                opportunities.push({
                    type: 'LOW_RATING',
                    description: `Critical rating of ${rating}. Urgent reputation fix needed.`,
                    severity: 'HIGH'
                });
            }

            // 4. Update Staging Lead
            // Delete old opportunities first to avoid duplicates on re-run
            await (db as any).opportunity.deleteMany({ where: { stagingLeadId: lead.id, aiGenerated: false } });

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
            const prompt = `Actúa como un experto en análisis comercial B2B. Analiza los siguientes datos de un cliente potencial y detecta oportunidades específicas de venta o mejora.\n\n` +
                `DATOS DEL NEGOCIO:\n${lead.rawData}\n\n` +
                `OPORTUNIDADES YA DETECTADAS: ${lead.opportunities.map((o: any) => o.type).join(', ')}\n\n` +
                `INSTRUCCIONES:\n` +
                `1. Identifica problemas que podamos resolver (falta de presencia online, mala reputación, procesos manuales, etc).\n` +
                `2. Sé muy específico en la descripción.\n` +
                `3. Asigna una severidad (LOW, MEDIUM, HIGH).\n` +
                `4. No repitas oportunidades que ya han sido detectadas.\n\n` +
                `RESPONDE ÚNICAMENTE CON UN ARRAY JSON de objetos con el formato: [{"type": "BREVE_CODIGO", "description": "explicación detallada", "severity": "HIGH/MEDIUM/LOW"}]`;

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
