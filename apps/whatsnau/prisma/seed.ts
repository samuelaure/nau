import { db } from '../src/core/db.js';
import { logger } from '../src/core/logger.js';

/**
 * Seed script for Platform v2.0
 * Seeds: System Tags, Campaigns, Stages, Templates, AI Prompts
 */

async function main() {
  logger.info('Starting database seed...');

  // 1. Seed System Tags
  logger.info('Seeding system tags...');
  const systemTags = [
    {
      name: 'black',
      category: 'SYSTEM',
      description: 'Do not contact - permanent exclusion',
    },
    {
      name: 'colder',
      category: 'SYSTEM',
      description: 'Inactive or rejected all offers',
    },
    {
      name: 'interested',
      category: 'SYSTEM',
      description: 'Showed interest in main offer',
    },
    {
      name: 'nurturing',
      category: 'SYSTEM',
      description: 'Subscribed to weekly tips',
    },
    {
      name: 'client',
      category: 'SYSTEM',
      description: 'Purchased the offer',
    },
    {
      name: 'high_intent',
      category: 'INTENT',
      description: 'Strong buying signals detected',
    },
    {
      name: 'demo_completed',
      category: 'INTENT',
      description: 'Finished demo session',
    },
    {
      name: 'onboarding_complete',
      category: 'SYSTEM',
      description: 'Completed nurturing onboarding',
    },
  ];

  for (const tag of systemTags) {
    await db.tag.upsert({
      where: { name: tag.name },
      update: tag,
      create: tag,
    });
  }
  logger.info(`✓ Seeded ${systemTags.length} system tags`);

  // 2. Seed Main Outreach Campaign
  logger.info('Seeding Main Outreach Campaign...');
  const mainCampaign = await db.campaign.upsert({
    where: { id: 'main-outreach-campaign' },
    update: {
      name: 'Main Outreach Campaign',
      description: 'Cold lead outreach with 3-message sequence (M1, M2, M3)',
      isActive: true,
    },
    create: {
      id: 'main-outreach-campaign',
      name: 'Main Outreach Campaign',
      description: 'Cold lead outreach with 3-message sequence (M1, M2, M3)',
      isActive: true,
    },
  });

  // 2.1 Seed M1 Stage (Pitch)
  const m1Stage = await db.campaignStage.upsert({
    where: { id: 'm1-pitch-stage' },
    update: {
      campaignId: mainCampaign.id,
      name: 'M1-Pitch',
      order: 1,
      waitHours: 8,
    },
    create: {
      id: 'm1-pitch-stage',
      campaignId: mainCampaign.id,
      name: 'M1-Pitch',
      order: 1,
      waitHours: 8,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'm1-pitch-template' },
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
      id: 'm1-pitch-template',
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
  const m2Stage = await db.campaignStage.upsert({
    where: { id: 'm2-followup-stage' },
    update: {
      campaignId: mainCampaign.id,
      name: 'M2-FollowUp',
      order: 2,
      waitHours: 10,
    },
    create: {
      id: 'm2-followup-stage',
      campaignId: mainCampaign.id,
      name: 'M2-FollowUp',
      order: 2,
      waitHours: 10,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'm2-followup-template' },
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
      id: 'm2-followup-template',
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
  const m3Stage = await db.campaignStage.upsert({
    where: { id: 'm3-weeklytips-stage' },
    update: {
      campaignId: mainCampaign.id,
      name: 'M3-WeeklyTipsInvite',
      order: 3,
      waitHours: 0,
    },
    create: {
      id: 'm3-weeklytips-stage',
      campaignId: mainCampaign.id,
      name: 'M3-WeeklyTipsInvite',
      order: 3,
      waitHours: 0,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'm3-weeklytips-template' },
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
      id: 'm3-weeklytips-template',
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

  logger.info('✓ Seeded Main Outreach Campaign with 3 stages and templates');

  // 3. Seed Nurturing Onboarding Campaign
  logger.info('Seeding Nurturing Onboarding Campaign...');
  const nurturingCampaign = await db.campaign.upsert({
    where: { id: 'nurturing-onboarding-campaign' },
    update: {
      name: 'Nurturing Onboarding',
      description: '3-message welcome sequence for new nurturing subscribers',
      isActive: true,
    },
    create: {
      id: 'nurturing-onboarding-campaign',
      name: 'Nurturing Onboarding',
      description: '3-message welcome sequence for new nurturing subscribers',
      isActive: true,
    },
  });

  // 3.1 Nurturing Welcome
  const n1Stage = await db.campaignStage.upsert({
    where: { id: 'nurturing-welcome-stage' },
    update: {
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Welcome',
      order: 1,
      waitHours: 0,
    },
    create: {
      id: 'nurturing-welcome-stage',
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Welcome',
      order: 1,
      waitHours: 0,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'nurturing-welcome-template' },
    update: {
      stageId: n1Stage.id,
      content:
        '¡Bienvenido/a a la comunidad! 🎉 Aquí está tu primer consejo poderoso:\n\n💡 **Automatiza tu primera respuesta**: El 80% de las consultas en WhatsApp son repetitivas. Identifica las 3 preguntas más frecuentes y crea respuestas automáticas. Esto libera tu tiempo para las conversaciones que realmente importan.',
      order: 1,
      hasButtons: false,
    },
    create: {
      id: 'nurturing-welcome-template',
      stageId: n1Stage.id,
      content:
        '¡Bienvenido/a a la comunidad! 🎉 Aquí está tu primer consejo poderoso:\n\n💡 **Automatiza tu primera respuesta**: El 80% de las consultas en WhatsApp son repetitivas. Identifica las 3 preguntas más frecuentes y crea respuestas automáticas. Esto libera tu tiempo para las conversaciones que realmente importan.',
      order: 1,
      hasButtons: false,
    },
  });

  // 3.2 Nurturing Tip 2
  const n2Stage = await db.campaignStage.upsert({
    where: { id: 'nurturing-tip2-stage' },
    update: {
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Tip2',
      order: 2,
      waitHours: 8,
    },
    create: {
      id: 'nurturing-tip2-stage',
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Tip2',
      order: 2,
      waitHours: 8,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'nurturing-tip2-template' },
    update: {
      stageId: n2Stage.id,
      content:
        'Aquí va el segundo consejo que puede transformar tu negocio:\n\n🚀 **La regla del 5-minuto**: Si una tarea te toma menos de 5 minutos y la haces más de 3 veces al día, automatízala. Suma esas horas al mes y verás el ROI inmediato de la automatización.',
      order: 1,
      hasButtons: false,
    },
    create: {
      id: 'nurturing-tip2-template',
      stageId: n2Stage.id,
      content:
        'Aquí va el segundo consejo que puede transformar tu negocio:\n\n🚀 **La regla del 5-minuto**: Si una tarea te toma menos de 5 minutos y la haces más de 3 veces al día, automatízala. Suma esas horas al mes y verás el ROI inmediato de la automatización.',
      order: 1,
      hasButtons: false,
    },
  });

  // 3.3 Nurturing Tip 3
  const n3Stage = await db.campaignStage.upsert({
    where: { id: 'nurturing-tip3-stage' },
    update: {
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Tip3',
      order: 3,
      waitHours: 15,
    },
    create: {
      id: 'nurturing-tip3-stage',
      campaignId: nurturingCampaign.id,
      name: 'Nurturing-Tip3',
      order: 3,
      waitHours: 15,
    },
  });

  await db.messageTemplate.upsert({
    where: { id: 'nurturing-tip3-template' },
    update: {
      stageId: n3Stage.id,
      content:
        'Y para cerrar tu onboarding, el consejo más valioso:\n\n✨ **Humaniza la automatización**: La mejor automatización es invisible. Usa delays naturales (2-3 segundos), varía tus mensajes, y siempre deja espacio para que un humano tome el control cuando sea necesario.\n\nNos vemos la próxima semana con más contenido exclusivo. 🎯',
      order: 1,
      hasButtons: false,
    },
    create: {
      id: 'nurturing-tip3-template',
      stageId: n3Stage.id,
      content:
        'Y para cerrar tu onboarding, el consejo más valioso:\n\n✨ **Humaniza la automatización**: La mejor automatización es invisible. Usa delays naturales (2-3 segundos), varía tus mensajes, y siempre deja espacio para que un humano tome el control cuando sea necesario.\n\nNos vemos la próxima semana con más contenido exclusivo. 🎯',
      order: 1,
      hasButtons: false,
    },
  });

  logger.info('✓ Seeded Nurturing Onboarding Campaign with 3 stages and templates');

  // 4. Seed AI Agent Prompts
  logger.info('Seeding AI agent prompts...');

  // 4.1 Conversational Closer
  await db.promptConfig.upsert({
    where: { role: 'CLOSER' },
    update: {
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
5. Nunca presiones, construye confianza primero

INFORMACIÓN QUE DEBES RECOPILAR:
- Tipo de negocio y servicios
- Volumen de consultas actual
- Principales desafíos en atención al cliente
- Presupuesto aproximado
- Timeline de decisión`,
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
5. Nunca presiones, construye confianza primero

INFORMACIÓN QUE DEBES RECOPILAR:
- Tipo de negocio y servicios
- Volumen de consultas actual
- Principales desafíos en atención al cliente
- Presupuesto aproximado
- Timeline de decisión`,
      includeLeadName: true,
      includeLeadMetadata: true,
      includeLeadTags: true,
      includeConversationHistory: true,
      historyMessageCount: 10,
      temperature: 0.7,
      usePremiumModel: true,
    },
  });

  // 4.2 Receptionist (Demo Agent)
  await db.promptConfig.upsert({
    where: { role: 'RECEPTIONIST' },
    update: {
      basePrompt: `Eres una Recepcionista IA profesional y competente en tu "entrevista de trabajo".

TU MISIÓN:
- Demostrar tus capacidades usando el contexto del negocio del lead
- Responder preguntas como si ya trabajaras en su empresa
- Mostrar inteligencia, eficiencia y profesionalismo
- Impresionar al lead con tu conocimiento contextual

REGLAS DE ORO:
1. Usa el nombre del negocio y detalles específicos naturalmente
2. Responde preguntas sobre servicios, horarios, precios (si están en el contexto)
3. Si no tienes información, admítelo profesionalmente
4. Mantén un tono amable pero profesional
5. Recuerda que tienes tiempo limitado (5-10 minutos)

CONTEXTO DE DEMO:
- Estás demostrando cómo funcionarías en el negocio del lead
- Cada respuesta debe mostrar valor y competencia
- Al final de la demo, regresarás al Closer`,
      includeLeadName: true,
      includeLeadMetadata: true,
      includeLeadTags: true,
      includeConversationHistory: true,
      historyMessageCount: 10,
      temperature: 0.6,
      usePremiumModel: true,
    },
    create: {
      role: 'RECEPTIONIST',
      basePrompt: `Eres una Recepcionista IA profesional y competente en tu "entrevista de trabajo".

TU MISIÓN:
- Demostrar tus capacidades usando el contexto del negocio del lead
- Responder preguntas como si ya trabajaras en su empresa
- Mostrar inteligencia, eficiencia y profesionalismo
- Impresionar al lead con tu conocimiento contextual

REGLAS DE ORO:
1. Usa el nombre del negocio y detalles específicos naturalmente
2. Responde preguntas sobre servicios, horarios, precios (si están en el contexto)
3. Si no tienes información, admítelo profesionalmente
4. Mantén un tono amable pero profesional
5. Recuerda que tienes tiempo limitado (5-10 minutos)

CONTEXTO DE DEMO:
- Estás demostrando cómo funcionarías en el negocio del lead
- Cada respuesta debe mostrar valor y competencia
- Al final de la demo, regresarás al Closer`,
      includeLeadName: true,
      includeLeadMetadata: true,
      includeLeadTags: true,
      includeConversationHistory: true,
      historyMessageCount: 10,
      temperature: 0.6,
      usePremiumModel: true,
    },
  });

  // 4.3 Nurturing Buddy
  await db.promptConfig.upsert({
    where: { role: 'NURTURING' },
    update: {
      basePrompt: `Eres el Nurturing Buddy de whatsnaŭ, el anfitrión cálido de la comunidad.

TU MISIÓN:
- Proporcionar atención de calidad a suscriptores de consejos semanales
- Escuchar activamente y hacer preguntas estratégicas
- Extender conversaciones agradables y valiosas
- Identificar oportunidades para propuestas personalizadas
- Construir relaciones a largo plazo

REGLAS DE ORO:
1. Sé cálido, humano y genuinamente interesado
2. Haz preguntas que revelen necesidades y oportunidades
3. Comparte insights valiosos relacionados con sus intereses
4. Detecta señales de compra y notifica (sin presionar)
5. Mantén el tono de "comunidad" no de "vendedor"

INFORMACIÓN QUE DEBES RECOPILAR:
- Qué temas les interesan más
- Desafíos actuales en su negocio
- Herramientas que usan actualmente
- Nivel de madurez en automatización/IA
- Oportunidades de upsell o propuestas customizadas

ENGAGEMENT:
- Responde a interacciones con broadcasts
- Maneja mensajes espontáneos con atención
- Construye rapport para conversiones futuras`,
      includeLeadName: true,
      includeLeadMetadata: true,
      includeLeadTags: true,
      includeConversationHistory: true,
      historyMessageCount: 10,
      temperature: 0.75,
      usePremiumModel: false,
    },
    create: {
      role: 'NURTURING',
      basePrompt: `Eres el Nurturing Buddy de whatsnaŭ, el anfitrión cálido de la comunidad.

TU MISIÓN:
- Proporcionar atención de calidad a suscriptores de consejos semanales
- Escuchar activamente y hacer preguntas estratégicas
- Extender conversaciones agradables y valiosas
- Identificar oportunidades para propuestas personalizadas
- Construir relaciones a largo plazo

REGLAS DE ORO:
1. Sé cálido, humano y genuinamente interesado
2. Haz preguntas que revelen necesidades y oportunidades
3. Comparte insights valiosos relacionados con sus intereses
4. Detecta señales de compra y notifica (sin presionar)
5. Mantén el tono de "comunidad" no de "vendedor"

INFORMACIÓN QUE DEBES RECOPILAR:
- Qué temas les interesan más
- Desafíos actuales en su negocio
- Herramientas que usan actualmente
- Nivel de madurez en automatización/IA
- Oportunidades de upsell o propuestas customizadas

ENGAGEMENT:
- Responde a interacciones con broadcasts
- Maneja mensajes espontáneos con atención
- Construye rapport para conversiones futuras`,
      includeLeadName: true,
      includeLeadMetadata: true,
      includeLeadTags: true,
      includeConversationHistory: true,
      historyMessageCount: 10,
      temperature: 0.75,
      usePremiumModel: false,
    },
  });

  logger.info('✓ Seeded 3 AI agent prompts (CLOSER, RECEPTIONIST, NURTURING)');

  logger.info('🎉 Database seed completed successfully!');
}

main()
  .catch((e) => {
    logger.error({ err: e }, 'Seed failed');
    process.exit(1);
  })
  .finally(async () => {
    await db.$disconnect();
  });
