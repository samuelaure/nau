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

        // Find active campaigns
        const campaigns = await db.campaign.findMany({
            where: { isActive: true },
            include: { stages: { orderBy: { order: 'asc' } } }
        });

        for (const campaign of campaigns) {
            // Find leads in this campaign that are in OUTREACH state
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

    private static async triggerFollowUp(lead: any, stage: any) {
        logger.info({ leadId: lead.id, stage: stage.name }, 'Triggering follow-up');

        // In a real scenario, we'd send a specific Template based on the stage name
        // For M2: "M2-Same-Day-FollowUp"
        // For M3: "M3-Final-Touch"

        let message = '';
        if (stage.name.includes('M2')) {
            message = 'Hola, soy yo de nuevo. Solo quería asegurarme de que viste mi mensaje anterior sobre el sistema de captura de leads. ¿Te interesaría charlar brevemente?';
        } else if (stage.name.includes('M3')) {
            message = 'Entiendo que quizás no es el mejor momento. Si te parece bien, puedo enviarte consejos semanales gratuitos sobre IA para tu negocio. ¿Te interesaría?';
        }

        if (message) {
            await WhatsAppService.sendText(lead.phoneNumber, message);

            await db.lead.update({
                where: { id: lead.id },
                data: {
                    currentStageId: stage.id,
                    lastInteraction: new Date()
                }
            });

            await db.message.create({
                data: {
                    leadId: lead.id,
                    direction: 'OUTBOUND',
                    content: message,
                    campaignStage: stage.name
                }
            });
        }
    }
}
