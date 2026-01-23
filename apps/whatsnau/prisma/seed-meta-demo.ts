import { db } from '../core/db.js';
import { logger } from '../core/logger.js';

/**
 * Seed script for Meta Demo Tenant
 * Creates realistic Spanish-language demo data for Meta app review
 */

async function main() {
    logger.info('Starting Meta demo data seed...');

    // Find the Meta demo tenant
    const demoTenant = await (db as any).tenant.findUnique({
        where: { slug: 'meta-demo' },
    });

    if (!demoTenant) {
        logger.error('Meta demo tenant not found. Run seedAdmin first.');
        process.exit(1);
    }

    const tenantId = demoTenant.id;
    logger.info(`Seeding data for tenant: ${demoTenant.name} (${tenantId})`);

    // 1. Seed System Tags
    logger.info('Seeding demo tags...');
    const demoTags = [
        { name: 'black', category: 'SYSTEM', description: 'Do not contact - permanent exclusion', tenantId },
        { name: 'colder', category: 'SYSTEM', description: 'Inactive or rejected all offers', tenantId },
        { name: 'interested', category: 'SYSTEM', description: 'Showed interest in main offer', tenantId },
        { name: 'nurturing', category: 'SYSTEM', description: 'Subscribed to weekly tips', tenantId },
        { name: 'client', category: 'SYSTEM', description: 'Purchased the offer', tenantId },
        { name: 'high_intent', category: 'INTENT', description: 'Strong buying signals detected', tenantId },
        { name: 'demo_completed', category: 'INTENT', description: 'Finished demo session', tenantId },
        { name: 'onboarding_complete', category: 'SYSTEM', description: 'Completed nurturing onboarding', tenantId },
    ];

    for (const tag of demoTags) {
        await (db as any).tag.upsert({
            where: { tenantId_name: { tenantId, name: tag.name } },
            update: tag,
            create: tag,
        });
    }
    logger.info(`✓ Seeded ${demoTags.length} demo tags`);

    // 2. Seed Main Outreach Campaign
    logger.info('Seeding Main Outreach Campaign...');
    const mainCampaign = await (db as any).campaign.upsert({
        where: { id: 'meta-demo-main-campaign' },
        update: {
            name: 'Main Outreach Campaign',
            description: 'Cold lead outreach with 3-message sequence (M1, M2, M3)',
            isActive: true,
            tenantId,
        },
        create: {
            id: 'meta-demo-main-campaign',
            name: 'Main Outreach Campaign',
            description: 'Cold lead outreach with 3-message sequence (M1, M2, M3)',
            isActive: true,
            tenantId,
        },
    });

    // 2.1 Seed M1 Stage (Pitch)
    const m1Stage = await (db as any).campaignStage.upsert({
        where: { id: 'meta-demo-m1-pitch' },
        update: {
            campaignId: mainCampaign.id,
            name: 'M1-Pitch',
            order: 1,
            waitHours: 8,
        },
        create: {
            id: 'meta-demo-m1-pitch',
            campaignId: mainCampaign.id,
            name: 'M1-Pitch',
            order: 1,
            waitHours: 8,
        },
    });

    await (db as any).messageTemplate.upsert({
        where: { id: 'meta-demo-m1-template' },
        update: {
            stageId: m1Stage.id,
            content:
                '¡Hola {{name}}! Soy Samuel de whatsnaŭ. He visto {{business}} y me ha parecido muy interesante. ¿Te gustaría automatizar tus captaciones por WhatsApp?',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_interested', text: 'Sí, me interesa' },
                { id: 'no_thanks', text: 'No, gracias' },
            ]),
        },
        create: {
            id: 'meta-demo-m1-template',
            stageId: m1Stage.id,
            content:
                '¡Hola {{name}}! Soy Samuel de whatsnaŭ. He visto {{business}} y me ha parecido muy interesante. ¿Te gustaría automatizar tus captaciones por WhatsApp?',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_interested', text: 'Sí, me interesa' },
                { id: 'no_thanks', text: 'No, gracias' },
            ]),
        },
    });

    // 2.2 Seed M2 Stage (Follow-up)
    const m2Stage = await (db as any).campaignStage.upsert({
        where: { id: 'meta-demo-m2-followup' },
        update: {
            campaignId: mainCampaign.id,
            name: 'M2-FollowUp',
            order: 2,
            waitHours: 10,
        },
        create: {
            id: 'meta-demo-m2-followup',
            campaignId: mainCampaign.id,
            name: 'M2-FollowUp',
            order: 2,
            waitHours: 10,
        },
    });

    await (db as any).messageTemplate.upsert({
        where: { id: 'meta-demo-m2-template' },
        update: {
            stageId: m2Stage.id,
            content:
                'Hola de nuevo. Solo quería asegurarme de que viste mi mensaje sobre automatización de WhatsApp para {{business}}. ¿Te interesaría una charla rápida?',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_interested', text: 'Sí, cuéntame más' },
                { id: 'no_thanks', text: 'No me interesa' },
            ]),
        },
        create: {
            id: 'meta-demo-m2-template',
            stageId: m2Stage.id,
            content:
                'Hola de nuevo. Solo quería asegurarme de que viste mi mensaje sobre automatización de WhatsApp para {{business}}. ¿Te interesaría una charla rápida?',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_interested', text: 'Sí, cuéntame más' },
                { id: 'no_thanks', text: 'No me interesa' },
            ]),
        },
    });

    // 2.3 Seed M3 Stage (Weekly Tips Invite)
    const m3Stage = await (db as any).campaignStage.upsert({
        where: { id: 'meta-demo-m3-weeklytips' },
        update: {
            campaignId: mainCampaign.id,
            name: 'M3-WeeklyTipsInvite',
            order: 3,
            waitHours: 0,
        },
        create: {
            id: 'meta-demo-m3-weeklytips',
            campaignId: mainCampaign.id,
            name: 'M3-WeeklyTipsInvite',
            order: 3,
            waitHours: 0,
        },
    });

    await (db as any).messageTemplate.upsert({
        where: { id: 'meta-demo-m3-template' },
        update: {
            stageId: m3Stage.id,
            content:
                'Entiendo. ¿Te interesaría recibir consejos semanales gratuitos sobre IA y automatización para tu negocio? Son tips muy prácticos que puedes aplicar de inmediato.',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_nurturing', text: 'Sí, envíamelos' },
                { id: 'no_nurturing', text: 'No, gracias' },
            ]),
        },
        create: {
            id: 'meta-demo-m3-template',
            stageId: m3Stage.id,
            content:
                'Entiendo. ¿Te interesaría recibir consejos semanales gratuitos sobre IA y automatización para tu negocio? Son tips muy prácticos que puedes aplicar de inmediato.',
            order: 1,
            hasButtons: true,
            buttons: JSON.stringify([
                { id: 'yes_nurturing', text: 'Sí, envíamelos' },
                { id: 'no_nurturing', text: 'No, gracias' },
            ]),
        },
    });

    logger.info('✓ Seeded Main Outreach Campaign with 3 stages');

    // 3. Seed Nurturing Campaign
    logger.info('Seeding Nurturing Onboarding Campaign...');
    const nurturingCampaign = await (db as any).campaign.upsert({
        where: { id: 'meta-demo-nurturing-campaign' },
        update: {
            name: 'Nurturing Onboarding',
            description: '3-message welcome sequence for new nurturing subscribers',
            isActive: true,
            tenantId,
        },
        create: {
            id: 'meta-demo-nurturing-campaign',
            name: 'Nurturing Onboarding',
            description: '3-message welcome sequence for new nurturing subscribers',
            isActive: true,
            tenantId,
        },
    });

    logger.info('✓ Seeded Nurturing Campaign');

    // 4. Seed Demo Leads with Realistic Spanish Names and Businesses
    logger.info('Seeding demo leads...');
    const demoLeads = [
        // COLD Leads (3)
        {
            id: 'demo-lead-001',
            phoneNumber: '+34600111222',
            name: 'María García',
            state: 'COLD',
            status: 'ACTIVE',
            campaignId: mainCampaign.id,
            currentStageId: m1Stage.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Clínica Dental Sonrisa', city: 'Madrid' }),
            lastInteraction: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
            id: 'demo-lead-002',
            phoneNumber: '+34600222333',
            name: 'Carlos Rodríguez',
            state: 'COLD',
            status: 'ACTIVE',
            campaignId: mainCampaign.id,
            currentStageId: m1Stage.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Asesoría Fiscal RodríguezCo', city: 'Barcelona' }),
            lastInteraction: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
        {
            id: 'demo-lead-003',
            phoneNumber: '+34600333444',
            name: 'Ana Martínez',
            state: 'COLD',
            status: 'ACTIVE',
            campaignId: mainCampaign.id,
            currentStageId: m2Stage.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Estudio de Arquitectura Martínez', city: 'Valencia' }),
            lastInteraction: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },

        // INTERESTED Leads (4)
        {
            id: 'demo-lead-004',
            phoneNumber: '+34600444555',
            name: 'Javier López',
            state: 'INTERESTED',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Gimnasio FitLife', city: 'Sevilla', interest: 'Automatización de reservas' }),
            lastInteraction: new Date(Date.now() - 5 * 60 * 60 * 1000), // 5 hours ago
        },
        {
            id: 'demo-lead-005',
            phoneNumber: '+34600555666',
            name: 'Laura Fernández',
            state: 'INTERESTED',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Peluquería Estilo Laura', city: 'Málaga', interest: 'Recordatorios automáticos' }),
            lastInteraction: new Date(Date.now() - 2 * 60 * 60 * 1000), // 2 hours ago
        },
        {
            id: 'demo-lead-006',
            phoneNumber: '+34600666777',
            name: 'Miguel Sánchez',
            state: 'INTERESTED',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Restaurante El Rincón', city: 'Bilbao', interest: 'Gestión de pedidos' }),
            lastInteraction: new Date(Date.now() - 1 * 60 * 60 * 1000), // 1 hour ago
        },
        {
            id: 'demo-lead-007',
            phoneNumber: '+34600777888',
            name: 'Isabel Ruiz',
            state: 'INTERESTED',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Inmobiliaria Ruiz Properties', city: 'Zaragoza', interest: 'Calificación de leads' }),
            lastInteraction: new Date(Date.now() - 30 * 60 * 1000), // 30 min ago
        },

        // DEMO Leads (3)
        {
            id: 'demo-lead-008',
            phoneNumber: '+34600888999',
            name: 'Pedro Gómez',
            state: 'DEMO',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            demoStartedAt: new Date(Date.now() - 3 * 60 * 1000), // 3 min ago
            demoExpiresAt: new Date(Date.now() + 7 * 60 * 1000), // 7 min from now
            demoMinutes: 10,
            metadata: JSON.stringify({ business: 'Taller Mecánico Gómez', city: 'Granada', services: 'Reparación, Mantenimiento' }),
            lastInteraction: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
        },
        {
            id: 'demo-lead-009',
            phoneNumber: '+34600999000',
            name: 'Carmen Díaz',
            state: 'DEMO',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            demoStartedAt: new Date(Date.now() - 5 * 60 * 1000), // 5 min ago
            demoExpiresAt: new Date(Date.now() + 5 * 60 * 1000), // 5 min from now
            demoMinutes: 10,
            metadata: JSON.stringify({ business: 'Clínica Veterinaria PetCare', city: 'Murcia', services: 'Consultas, Urgencias' }),
            lastInteraction: new Date(Date.now() - 2 * 60 * 1000), // 2 min ago
        },
        {
            id: 'demo-lead-010',
            phoneNumber: '+34601000111',
            name: 'Francisco Torres',
            state: 'DEMO',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: mainCampaign.id,
            tenantId,
            demoStartedAt: new Date(Date.now() - 8 * 60 * 1000), // 8 min ago
            demoExpiresAt: new Date(Date.now() + 2 * 60 * 1000), // 2 min from now
            demoMinutes: 10,
            metadata: JSON.stringify({ business: 'Abogados Torres & Asociados', city: 'Alicante', services: 'Civil, Mercantil' }),
            lastInteraction: new Date(Date.now() - 1 * 60 * 1000), // 1 min ago
        },

        // NURTURING Leads (3)
        {
            id: 'demo-lead-011',
            phoneNumber: '+34601111222',
            name: 'Lucía Moreno',
            state: 'NURTURING',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: nurturingCampaign.id,
            tenantId,
            nurturingOptInAt: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000), // 7 days ago
            nurturingOnboardingComplete: true,
            metadata: JSON.stringify({ business: 'Escuela de Idiomas Global', city: 'Salamanca' }),
            lastInteraction: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000), // 2 days ago
        },
        {
            id: 'demo-lead-012',
            phoneNumber: '+34601222333',
            name: 'Antonio Jiménez',
            state: 'NURTURING',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: nurturingCampaign.id,
            tenantId,
            nurturingOptInAt: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000), // 14 days ago
            nurturingOnboardingComplete: true,
            metadata: JSON.stringify({ business: 'Agencia de Marketing Digital', city: 'Córdoba' }),
            lastInteraction: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000), // 1 day ago
        },
        {
            id: 'demo-lead-013',
            phoneNumber: '+34601333444',
            name: 'Rosa Navarro',
            state: 'NURTURING',
            status: 'ACTIVE',
            aiEnabled: true,
            campaignId: nurturingCampaign.id,
            tenantId,
            nurturingOptInAt: new Date(Date.now() - 21 * 24 * 60 * 60 * 1000), // 21 days ago
            nurturingOnboardingComplete: true,
            metadata: JSON.stringify({ business: 'Tienda de Moda Boutique Rosa', city: 'Santander' }),
            lastInteraction: new Date(Date.now() - 3 * 24 * 60 * 60 * 1000), // 3 days ago
        },

        // CLIENT Leads (2)
        {
            id: 'demo-lead-014',
            phoneNumber: '+34601444555',
            name: 'David Romero',
            state: 'CLIENTS',
            status: 'ACTIVE',
            aiEnabled: false, // Clients typically have AI disabled
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Consultoría Empresarial Romero', city: 'Pamplona', package: 'Premium' }),
            lastInteraction: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000), // 10 days ago
        },
        {
            id: 'demo-lead-015',
            phoneNumber: '+34601555666',
            name: 'Elena Castro',
            state: 'CLIENTS',
            status: 'ACTIVE',
            aiEnabled: false,
            campaignId: mainCampaign.id,
            tenantId,
            metadata: JSON.stringify({ business: 'Centro de Formación TechSkills', city: 'Valladolid', package: 'Enterprise' }),
            lastInteraction: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000), // 5 days ago
        },
    ];

    for (const lead of demoLeads) {
        await (db as any).lead.upsert({
            where: { id: lead.id },
            update: lead,
            create: lead,
        });
    }
    logger.info(`✓ Seeded ${demoLeads.length} demo leads`);

    // 5. Seed AI Prompts
    logger.info('Seeding AI agent prompts...');
    await (db as any).promptConfig.upsert({
        where: { role_campaignId: { role: 'CLOSER', campaignId: mainCampaign.id } },
        update: {
            campaignId: mainCampaign.id,
            basePrompt: `Eres el Conversational Closer de whatsnaŭ, un experto en ventas consultivas.

TU MISIÓN:
- Guiar conversaciones de pre-venta con leads interesados
- Comportarte como un humano genuino, nunca como un bot
- Mostrar empatía y hacer preguntas estratégicas
- Ofrecer la demo de la Recepcionista IA cuando sea apropiado
- Recopilar información clave del negocio del lead

REGLAS DE ORO:
1. Sé conversacional y natural, evita respuestas formuladas
2. Haz preguntas abiertas para entender el contexto del lead
3. Identifica pain points y oportunidades
4. Cuando el lead esté caliente, ofrece la demo con un botón
5. Nunca presiones, construye confianza primero`,
            includeLeadName: true,
            includeLeadMetadata: true,
            includeLeadTags: true,
            includeConversationHistory: true,
            historyMessageCount: 10,
            temperature: 0.7,
            usePremiumModel: true,
        },
        create: {
            role: 'CLOSER',
            campaignId: mainCampaign.id,
            basePrompt: `Eres el Conversational Closer de whatsnaŭ, un experto en ventas consultivas.

TU MISIÓN:
- Guiar conversaciones de pre-venta con leads interesados
- Comportarte como un humano genuino, nunca como un bot
- Mostrar empatía y hacer preguntas estratégicas
- Ofrecer la demo de la Recepcionista IA cuando sea apropiado
- Recopilar información clave del negocio del lead

REGLAS DE ORO:
1. Sé conversacional y natural, evita respuestas formuladas
2. Haz preguntas abiertas para entender el contexto del lead
3. Identifica pain points y oportunidades
4. Cuando el lead esté caliente, ofrece la demo con un botón
5. Nunca presiones, construye confianza primero`,
            includeLeadName: true,
            includeLeadMetadata: true,
            includeLeadTags: true,
            includeConversationHistory: true,
            historyMessageCount: 10,
            temperature: 0.7,
            usePremiumModel: true,
        },
    });

    logger.info('✓ Seeded AI prompts');

    logger.info('🎉 Meta demo data seed completed successfully!');
}

main()
    .catch((e) => {
        logger.error({ err: e }, 'Meta demo seed failed');
        process.exit(1);
    })
    .finally(async () => {
        await db.$disconnect();
    });
