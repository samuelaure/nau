import { db } from './db.js';
import { logger } from './logger.js';
import { LeadService, LeadState } from '../services/lead.service.js';
import { AIService } from '../services/ai.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';

export class Orchestrator {
    /**
     * Main entry point for all incoming WhatsApp messages.
     */
    static async handleIncoming(from: string, text?: string, buttonId?: string) {
        const content = text || buttonId || '';
        logger.info({ from, content }, 'Orchestrating incoming interaction');

        // 1. Find or initialize Lead
        let lead = await db.lead.findUnique({
            where: { phoneNumber: from },
            include: {
                campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
                tags: true,
                currentStage: true
            }
        });

        if (!lead) {
            const campaign = await db.campaign.findFirst({ where: { isActive: true } });
            if (!campaign) {
                logger.warn('No active campaign found to assign new lead');
                return;
            }
            const initialLead = await LeadService.initiateLead(from, campaign.id);

            lead = await db.lead.findUnique({
                where: { id: initialLead.id },
                include: {
                    campaign: { include: { stages: { orderBy: { order: 'asc' } } } },
                    tags: true,
                    currentStage: true
                }
            });
        }

        if (!lead) return;

        // 2. Track message in DB
        await db.message.create({
            data: {
                leadId: lead.id,
                direction: 'INBOUND',
                content,
                type: buttonId ? 'BUTTON_RESPONSE' : 'TEXT',
                campaignStage: lead.currentStage?.name
            }
        });

        // 3. Process based on Current State
        switch (lead.state as LeadState) {
            case LeadState.OUTREACH:
                await this.handleOutreachPhase(lead, content, buttonId);
                break;
            case LeadState.PRE_SALE:
                await this.handlePreSalePhase(lead, content);
                break;
            case LeadState.DEMO:
                await this.handleDemoPhase(lead, content);
                break;
            case LeadState.NURTURING:
                await this.handleNurturingPhase(lead, content);
                break;
            default:
                logger.info({ state: lead.state }, 'Lead in unhandled or terminal state');
        }
    }

    private static async handleOutreachPhase(lead: any, content: string, buttonId?: string) {
        if (buttonId === 'sí_me_interesa' || content.toLowerCase().includes('si') || content.toLowerCase().includes('interesa')) {
            await LeadService.transition(lead.id, LeadState.PRE_SALE);
            await LeadService.addTag(lead.id, 'interested');
            await this.triggerCloser(lead);
        } else if (buttonId === 'no_me_interesa' || content.toLowerCase().includes('no')) {
            await LeadService.addTag(lead.id, 'not_interested');
            await WhatsAppService.sendText(lead.phoneNumber, 'Entiendo perfectamente. ¿Te interesaría recibir consejos semanales gratuitos sobre automatización para tu negocio? (Responde con Sí o No)');
        } else {
            const classification = await AIService.classifyIntent(content);
            if (classification?.intent === 'interesado') {
                await LeadService.transition(lead.id, LeadState.PRE_SALE);
                await this.triggerCloser(lead);
            }
        }
    }

    private static async triggerCloser(lead: any) {
        const systemPrompt = `
      Eres el "Conversational Closer" de whatsnaŭ. Tu tono es profesional, humano y sigue los "Cuatro Acuerdos".
      Tu objetivo es validar el interés, pedir datos del negocio y ofrecer una DEMO de Recepcionista IA.
      Responde siempre en español.
    `;

        const response = await AIService.getChatResponse(systemPrompt, [
            { role: 'user', content: 'He dicho que me interesa la oferta.' }
        ], true);

        if (response) {
            await WhatsAppService.sendText(lead.phoneNumber, response);
            await db.message.create({
                data: {
                    leadId: lead.id,
                    direction: 'OUTBOUND',
                    content: response,
                    aiGenerated: true,
                    campaignStage: 'CONVERSATIONAL_PRE_SALE'
                }
            });
        }
    }

    private static async handlePreSalePhase(lead: any, content: string) { logger.info('Pre-sale logic not fully implemented yet'); }
    private static async handleDemoPhase(lead: any, content: string) { logger.info('Demo logic not fully implemented yet'); }
    private static async handleNurturingPhase(lead: any, content: string) { logger.info('Nurturing logic not fully implemented yet'); }
}
