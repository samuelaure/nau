import { db } from '../core/db.js';
import { logger } from '../core/logger.js';
import { WhatsAppService } from './whatsapp.service.js';
import { LeadState } from './lead.service.js';

export class SequenceService {
    /**
     * Scans for leads that are due for a campaign follow-up (M2, M3).
     */
    static async processFollowUps() {
        logger.info('Running follow-up sequence check...');
        await this.processCampaignSequences();
        await this.processHandoverFollowUps();
    }

    private static async processCampaignSequences() {
        // Find active campaigns
        const campaigns = await db.campaign.findMany({
            where: { isActive: true },
            include: { stages: { orderBy: { order: 'asc' } } }
        });

        for (const campaign of campaigns) {
            const leads = await db.lead.findMany({
                where: {
                    campaignId: campaign.id,
                    state: LeadState.OUTREACH,
                    status: 'ACTIVE'
                },
                include: { currentStage: true }
            });

            for (const lead of leads) {
                if (!lead.currentStage) continue;
                const nextStage = campaign.stages.find(s => s.order === lead.currentStage!.order + 1);
                if (nextStage && nextStage.waitHours > 0) {
                    const now = new Date();
                    const lastInteraction = new Date(lead.lastInteraction);
                    const hoursSinceInteraction = (now.getTime() - lastInteraction.getTime()) / (1000 * 60 * 60);
                    if (hoursSinceInteraction >= nextStage.waitHours) {
                        await this.triggerFollowUp(lead, nextStage);
                    }
                }
            }
        }
    }

    /**
     * REASSURANCE: Check for leads waiting for human handover.
     * Trigger if no outbound message in last 30 minutes.
     */
    private static async processHandoverFollowUps() {
        const thirtyMinutesAgo = new Date(Date.now() - 30 * 60 * 1000);

        const leadsWaiting = await db.lead.findMany({
            where: {
                status: 'HANDOVER',
                lastInteraction: { lt: thirtyMinutesAgo },
                tags: { none: { name: 'handover_reassurance_sent' } }
            }
        });

        for (const lead of leadsWaiting) {
            logger.info({ leadId: lead.id }, 'Sending handover reassurance message');
            const message = 'Hola, sigo aquí. Samuel está tardando un poco más de lo previsto en liberarse, pero no me he olvidado de ti. ¿Hay algo más en lo que pueda ayudarte mientras esperas?';

            const res = await WhatsAppService.sendText(lead.phoneNumber, message);
            const whatsappId = res?.messages?.[0]?.id;

            await db.lead.update({
                where: { id: lead.id },
                data: {
                    lastInteraction: new Date()
                }
            });

            await db.tag.create({
                data: { name: 'handover_reassurance_sent', category: 'SYSTEM', campaignId: lead.campaignId, leads: { connect: { id: lead.id } } }
            });

            if (whatsappId) {
                await db.message.create({
                    data: {
                        leadId: lead.id,
                        direction: 'OUTBOUND',
                        content: message,
                        whatsappId,
                        aiGenerated: true,
                        campaignStage: 'HANDOVER_REASSURANCE',
                        status: 'sent'
                    }
                });
            }
        }
    }

    private static async triggerFollowUp(lead: any, stage: any) {
        logger.info({ leadId: lead.id, stage: stage.name }, 'Triggering follow-up');

        let message = '';
        if (stage.name.includes('M2')) {
            message = 'Hola, soy yo de nuevo. Solo quería asegurarme de que viste mi mensaje anterior sobre el sistema de captura de leads. ¿Te interesaría charlar brevemente?';
        } else if (stage.name.includes('M3')) {
            message = 'Entiendo que quizás no es el mejor momento. Si te parece bien, puedo enviarte consejos semanales gratuitos sobre IA para tu negocio. ¿Te interesaría?';
        }

        if (message) {
            const res = await WhatsAppService.sendText(lead.phoneNumber, message);
            const whatsappId = res?.messages?.[0]?.id;

            await db.lead.update({
                where: { id: lead.id },
                data: {
                    currentStageId: stage.id,
                    lastInteraction: new Date()
                }
            });

            if (whatsappId) {
                await db.message.create({
                    data: {
                        leadId: lead.id,
                        direction: 'OUTBOUND',
                        content: message,
                        whatsappId,
                        campaignStage: stage.name,
                        status: 'sent'
                    }
                });
            }
        }
    }
}
