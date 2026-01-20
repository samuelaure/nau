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

        // 2.5 Human Takeover Check
        const takeoverKeywords = ['HUMAN', 'AYUDA', 'AGENT', 'HUMANO', 'STOP'];
        if (takeoverKeywords.includes(content.toUpperCase().trim())) {
            await db.lead.update({
                where: { id: lead.id },
                data: { status: 'HANDOVER' }
            });
            await WhatsAppService.sendText(lead.phoneNumber, 'He avisado a un compañero humano. En breve se pondrán en contacto contigo.');
            return;
        }

        // 3. Process based on Current State
        if (lead.status === 'HANDOVER') {
            logger.info({ leadId: lead.id }, 'Lead in handover status, skipping AI processing');
            return;
        }
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
            default:
                logger.info({ state: lead.state }, 'Lead in unhandled or terminal state');
        }
    }

    private static async handleOutreachPhase(lead: any, content: string, buttonId?: string) {
        if (buttonId === 'sí_me_interesa' || content.toLowerCase().includes('si') || content.toLowerCase().includes('interesa')) {
            await LeadService.transition(lead.id, LeadState.PRE_SALE);
            await LeadService.addTag(lead.id, 'interested');
            await this.triggerAgent(lead, 'CLOSER');
        } else if (buttonId === 'no_me_interesa' || content.toLowerCase().includes('no')) {
            // Assume refusal for now, offer nurturing
            await LeadService.addTag(lead.id, 'not_interested');
            await WhatsAppService.sendText(lead.phoneNumber, 'Entiendo perfectamente. ¿Te interesaría recibir consejos semanales gratuitos sobre automatización para tu negocio? (Responde con Sí o No)');
        } else {
            const classification = await AIService.classifyIntent(content);
            if (classification?.intent === 'interesado') {
                await LeadService.transition(lead.id, LeadState.PRE_SALE);
                await this.triggerAgent(lead, 'CLOSER');
            }
        }
    }

    private static async handlePreSalePhase(lead: any, content: string, buttonId?: string) {
        // Check if lead wants the demo
        if (buttonId === 'ver_demo' || content.toLowerCase().includes('demo')) {
            return this.startDemo(lead);
        }

        await this.triggerAgent(lead, 'CLOSER', content);
    }

    private static async startDemo(lead: any) {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + 10);

        await db.lead.update({
            where: { id: lead.id },
            data: {
                state: LeadState.DEMO,
                demoStartedAt: new Date(),
                demoExpiresAt: expiresAt
            }
        });

        await WhatsAppService.sendText(lead.phoneNumber, '¡Genial! A partir de ahora, estás hablando con mi **Recepcionista IA**. \n\nHázle cualquier pregunta sobre tu negocio (ej. "¿Qué servicios ofrecéis?", "¿Cuál es el horario?") y verás cómo responde. \n\n*La demo durará 10 minutos.*');

        // Optional: Trigger first response from receptionist
        await this.triggerAgent({ ...lead, state: LeadState.DEMO }, 'RECEPTIONIST', 'Hola, soy tu nueva recepcionista.');
    }

    private static async handleDemoPhase(lead: any, content: string, buttonId?: string) {
        // Check expiration
        if (lead.demoExpiresAt && new Date() > new Date(lead.demoExpiresAt)) {
            await LeadService.transition(lead.id, LeadState.PRE_SALE);
            await LeadService.addTag(lead.id, 'demo_completed');
            await WhatsAppService.sendText(lead.phoneNumber, 'La demo ha finalizado. ¡Espero que te haya gustado! Volvemos a nuestra conversación. ¿Qué te ha parecido la experiencia?');
            return;
        }

        await this.triggerAgent(lead, 'RECEPTIONIST', content);
    }

    private static async triggerAgent(lead: any, role: 'CLOSER' | 'RECEPTIONIST', userMessage?: string) {
        const history = await db.message.findMany({
            where: { leadId: lead.id },
            orderBy: { timestamp: 'desc' },
            take: 10
        });

        const aiMessages = history.reverse().map(m => ({
            role: (m.direction === 'INBOUND' ? 'user' : 'assistant') as 'user' | 'assistant',
            content: m.content
        }));

        if (userMessage && (!aiMessages.length || aiMessages[aiMessages.length - 1].content !== userMessage)) {
            aiMessages.push({ role: 'user', content: userMessage });
        }

        let systemPrompt = '';
        if (role === 'CLOSER') {
            systemPrompt = `
        Eres el "Conversational Closer" de whatsnaŭ. Tono profesional, humano, sigue los Cuatro Acuerdos.
        Tu objetivo: Validar interés, pedir datos, ofrecer una DEMO de Recepcionista IA.
        Si el cliente está listo, dile que puede escribir "VER DEMO" o pulsar el botón (si existiera).
        Responde siempre en español.
      `;
        } else {
            systemPrompt = `
        Eres una **Recepcionista IA** de última generación para el negocio de este cliente.
        Tu tono es extremadamente amable, eficiente y resolutivo.
        Actúas como si ya trabajaras para ellos.
        Responde siempre en español.
      `;
        }

        const response = await AIService.getChatResponse(systemPrompt, aiMessages, true);

        if (response) {
            await WhatsAppService.sendText(lead.phoneNumber, response);
            await db.message.create({
                data: {
                    leadId: lead.id,
                    direction: 'OUTBOUND',
                    content: response,
                    aiGenerated: true,
                    campaignStage: lead.currentStage?.name || lead.state
                }
            });
        }
    }

    private static async handleNurturingPhase(lead: any, content: string, buttonId?: string) {
        logger.info('Nurturing logic pending...');
    }
}
