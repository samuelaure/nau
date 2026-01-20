import { db } from './db.js';
import { logger } from './logger.js';
import { LeadService, LeadState } from '../services/lead.service.js';
import { AIService } from '../services/ai.service.js';
import { WhatsAppService } from '../services/whatsapp.service.js';

export class Orchestrator {
    /**
     * Main entry point for all incoming WhatsApp messages.
     */
    static async handleIncoming(from: string, text?: string, buttonId?: string, direction: 'INBOUND' | 'OUTBOUND' = 'INBOUND', whatsappId?: string) {
        const content = text || buttonId || '';
        logger.info({ from, content, direction, whatsappId }, 'Orchestrating interaction');

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
            if (direction === 'OUTBOUND') return; // Don't create leads from outbound if they don't exist
            const campaign = await db.campaign.findFirst({ where: { isActive: true } });
            if (!campaign) return;
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
        await db.message.upsert({
            where: { whatsappId: whatsappId || 'unknown' },
            create: {
                leadId: lead.id,
                direction,
                content,
                whatsappId,
                type: buttonId ? 'BUTTON_RESPONSE' : 'TEXT',
                campaignStage: lead.currentStage?.name || lead.state
            },
            update: {
                content // Update if it exists (idempotency)
            }
        });

        // 3. Source-Aware Takeover Check
        if (direction === 'OUTBOUND') {
            await this.handleOutboundTakeover(lead, content);
            return;
        } else {
            await this.handleInboundProcessing(lead, content, buttonId);
        }
    }

    /**
     * Update delivery status of a message.
     */
    static async handleStatusUpdate(whatsappId: string, status: string) {
        logger.info({ whatsappId, status }, 'Updating message status');
        try {
            await db.message.updateMany({
                where: { whatsappId },
                data: { status }
            });

            if (status === 'read') {
                await db.message.updateMany({
                    where: { whatsappId },
                    data: { wasRead: true }
                });
            }
        } catch (error) {
            logger.error({ err: error, whatsappId }, 'Failed to update message status');
        }
    }

    /**
     * SILENT TAKEOVER: Triggered by business/owner messages.
     */
    private static async handleOutboundTakeover(lead: any, content: string) {
        const internalKeywords = await db.takeoverKeyword.findMany({ where: { type: 'INTERNAL' } });
        const triggers = internalKeywords.map(k => k.word.toUpperCase());

        if (triggers.includes(content.toUpperCase().trim())) {
            await db.lead.update({
                where: { id: lead.id },
                data: { status: 'HANDOVER' }
            });
            logger.info({ leadId: lead.id }, 'Silent takeover triggered by owner message');
        }
    }

    /**
     * INTELLIGENT PROCESSING: Handle lead messages.
     */
    private static async handleInboundProcessing(lead: any, content: string, buttonId?: string) {
        if (lead.status === 'HANDOVER') {
            logger.info({ leadId: lead.id }, 'Lead in manual handover, skipping AI');
            return;
        }

        // Check for explicit LEAD keywords first (Deterministic)
        const leadKeywords = await db.takeoverKeyword.findMany({ where: { type: 'LEAD' } });
        const leadTriggers = leadKeywords.map(k => k.word.toUpperCase());

        let requiresHuman = leadTriggers.includes(content.toUpperCase().trim());
        let aiClassification = null;

        if (!requiresHuman) {
            // Intelligent intent detection (Cost-efficient using mini)
            aiClassification = await AIService.classifyIntent(content);
            requiresHuman = aiClassification?.intent === 'request_human';
        }

        if (requiresHuman) {
            return this.handleHumanRequest(lead, aiClassification?.reasoning);
        }

        // Standard flow processing
        switch (lead.state as LeadState) {
            case LeadState.OUTREACH:
                await this.handleOutreachPhase(lead, content, buttonId);
                break;
            case LeadState.PRE_SALE:
                await this.handlePreSalePhase(lead, content, buttonId);
                break;
            case LeadState.DEMO:
                await this.handleDemoPhase(lead, content, buttonId);
                break;
            case LeadState.NURTURING:
                await this.handleNurturingPhase(lead, content, buttonId);
                break;
        }
    }

    private static async handleHumanRequest(lead: any, reasoning?: string) {
        logger.info({ leadId: lead.id, reasoning }, 'Intelligent handover triggered by lead');

        await db.lead.update({
            where: { id: lead.id },
            data: { status: 'HANDOVER' } // Set to handover but we will still "entertain"
        });

        const config = await db.globalConfig.findUnique({ where: { id: 'singleton' } });
        const statusMsg = config?.availabilityStatus
            ? ` Samuel está actualmente ${config.availabilityStatus}, pero ya sabe que quieres hablar con él.`
            : ` Le he notificado a Samuel, vendrá lo antes que pueda.`;

        const responseMsg = `Perfecto, le avisaré a Samuel que deseas hablar con él directamente.${statusMsg} Mientras esperamos, aquí estaré si necesitas algo.`;

        const res = await WhatsAppService.sendText(lead.phoneNumber, responseMsg);
        await this.trackOutboundMessage(lead, responseMsg, res?.messages?.[0]?.id, 'HANDOVER_ENTERTAIN', true);
    }

    private static async trackOutboundMessage(lead: any, content: string, whatsappId: string, stage?: string, aiGenerated = false) {
        if (!whatsappId) return;
        await db.message.create({
            data: {
                leadId: lead.id,
                direction: 'OUTBOUND',
                content,
                whatsappId,
                aiGenerated,
                campaignStage: stage || lead.currentStage?.name || lead.state,
                status: 'sent'
            }
        });
    }

    private static async handleOutreachPhase(lead: any, content: string, buttonId?: string) {
        if (buttonId === 'sí_me_interesa' || content.toLowerCase().includes('si') || content.toLowerCase().includes('interesa')) {
            await LeadService.transition(lead.id, LeadState.PRE_SALE);
            await LeadService.addTag(lead.id, 'interested');
            await this.triggerAgent(lead, 'CLOSER');
        } else if (buttonId === 'no_me_interesa' || content.toLowerCase().includes('no')) {
            await LeadService.addTag(lead.id, 'not_interested');
            const msg = 'Entiendo perfectamente. ¿Te interesaría recibir consejos semanales gratuitos sobre automatización para tu negocio? (Responde con Sí o No)';
            const res = await WhatsAppService.sendText(lead.phoneNumber, msg);
            await this.trackOutboundMessage(lead, msg, res?.messages?.[0]?.id);
        } else {
            await this.triggerAgent(lead, 'CLOSER', content);
        }
    }

    private static async handlePreSalePhase(lead: any, content: string, buttonId?: string) {
        if (buttonId === 'ver_demo' || content.toLowerCase().includes('demo')) return this.startDemo(lead);
        await this.triggerAgent(lead, 'CLOSER', content);
    }

    private static async handleDemoPhase(lead: any, content: string, buttonId?: string) {
        if (lead.demoExpiresAt && new Date() > new Date(lead.demoExpiresAt)) {
            await LeadService.transition(lead.id, LeadState.PRE_SALE);
            const msg = 'La demo ha finalizado. Regresamos a nuestra charla. ¿Qué te ha parecido?';
            const res = await WhatsAppService.sendText(lead.phoneNumber, msg);
            await this.trackOutboundMessage(lead, msg, res?.messages?.[0]?.id);
            return;
        }
        await this.triggerAgent(lead, 'RECEPTIONIST', content);
    }

    private static async startDemo(lead: any) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);
        await db.lead.update({
            where: { id: lead.id },
            data: { state: LeadState.DEMO, demoStartedAt: new Date(), demoExpiresAt: expiresAt }
        });
        const msg = '¡Genial! A partir de ahora hablas con mi **Recepcionista IA**. Prueba a preguntarme sobre el negocio.';
        const res = await WhatsAppService.sendText(lead.phoneNumber, msg);
        await this.trackOutboundMessage({ ...lead, state: LeadState.DEMO }, msg, res?.messages?.[0]?.id);
        await this.triggerAgent({ ...lead, state: LeadState.DEMO }, 'RECEPTIONIST', 'Hola, soy tu nueva recepcionista.');
    }

    private static async triggerAgent(lead: any, role: 'CLOSER' | 'RECEPTIONIST', userMessage?: string) {
        const history = await db.message.findMany({ where: { leadId: lead.id }, orderBy: { timestamp: 'desc' }, take: 10 });
        const aiMessages = history.reverse().map(m => ({
            role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content
        }));
        if (userMessage && (!aiMessages.length || aiMessages[aiMessages.length - 1].content !== userMessage)) {
            aiMessages.push({ role: 'user', content: userMessage });
        }

        const systemPrompt = role === 'CLOSER'
            ? `Eres el "Conversational Closer" de whatsnaŭ. Tono profesional y humano. Objetivo: Validar interés y ofrecer DEMO.`
            : `Eres una **Recepcionista IA** amable y eficiente. Responde siempre en español.`;

        const response = await AIService.getChatResponse(systemPrompt, aiMessages, true);
        if (response) {
            const res = await WhatsAppService.sendText(lead.phoneNumber, response);
            await this.trackOutboundMessage(lead, response, res?.messages?.[0]?.id, lead.currentStage?.name || lead.state, true);
        }
    }

    private static async handleNurturingPhase(lead: any, content: string, buttonId?: string) { /* ... */ }
}
