import { Injectable, NotFoundException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInspoItemDto, UpdateInspoItemDto } from './inspo.dto'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { z } from 'zod'

const SynthesisOutputSchema = z.object({
  content_summary: z.string(),
  brand_voice: z.string(),
  attachedUrls: z.array(z.string()),
  reasoning: z.string(),
})

const DEFAULT_OWNED_POST_LIMIT = 20

@Injectable()
export class InspoService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  async create(brandId: string, dto: CreateInspoItemDto) {
    return this.prisma.inspoItem.create({
      data: { brandId, ...dto },
    })
  }

  async list(brandId: string, filters: { type?: string; status?: string } = {}) {
    return this.prisma.inspoItem.findMany({
      where: { brandId, ...filters },
      orderBy: { createdAt: 'desc' },
    })
  }

  async findOne(id: string) {
    const item = await this.prisma.inspoItem.findUnique({ where: { id } })
    if (!item) throw new NotFoundException('Inspo item not found')
    return item
  }

  async update(id: string, brandId: string, dto: UpdateInspoItemDto) {
    await this.assertOwnership(id, brandId)
    return this.prisma.inspoItem.update({ where: { id }, data: dto })
  }

  async delete(id: string, brandId: string) {
    await this.assertOwnership(id, brandId)
    await this.prisma.inspoItem.delete({ where: { id } })
  }

  async digest(brandId: string): Promise<{ content: string; attachedUrls: string[]; ownedContentSynthesis?: string | null }> {
    const items = await this.prisma.inspoItem.findMany({
      where: { brandId },
      orderBy: { createdAt: 'desc' },
      take: 50,
    })

    const parts: string[] = []
    const attachedUrls: string[] = []

    for (const item of items) {
      const line = [item.extractedHook, item.extractedTheme, item.note].filter(Boolean).join(' — ')
      if (line) parts.push(line)
      if (item.sourceUrl) attachedUrls.push(item.sourceUrl)
    }

    const hasInspoBaseSynthesis = await this.prisma.brandSynthesis.findFirst({
      where: { brandId, type: { in: ['recent', 'global'] } },
      select: { id: true },
    })

    let ownedContentSynthesis: string | null = null
    if (!hasInspoBaseSynthesis) {
      const ownedSynthesis = await this.prisma.brandSynthesis.findFirst({
        where: { brandId, type: 'owned_content' },
        orderBy: { createdAt: 'desc' },
        select: { content: true },
      })
      
      if (ownedSynthesis) {
        ownedContentSynthesis = ownedSynthesis.content
      } else {
        try {
          const generated = await this.generateOwnedSynthesis(brandId)
          ownedContentSynthesis = generated.content_summary
        } catch (err) {
          // Auto generation fallback failed, proceed with null
        }
      }
    }

    let finalContent = parts.join('\n')
    if (!finalContent.trim() && ownedContentSynthesis) {
      finalContent = ownedContentSynthesis
    }

    return { content: finalContent, attachedUrls, ownedContentSynthesis }
  }

  async repost(brandId: string, postUrl: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    const post = await this.prisma.post.findUnique({
      where: { url: postUrl },
      include: { media: true },
    })
    if (!post) throw new NotFoundException('Post not found in database. Scrape it first.')

    const flownauUrl = this.config.get<string>('FLOWNAU_URL') ?? 'http://flownau:3000'
    const serviceKey = this.config.getOrThrow<string>('NAU_SERVICE_KEY')

    const response = await fetch(`${flownauUrl}/api/v1/content/ingest`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'x-nau-service-key': serviceKey },
      body: JSON.stringify({ brandId, postUrl, type: 'repost' }),
    })

    if (!response.ok) {
      const errText = await response.text()
      throw new BadGatewayException(`Failed to forward to flownaŭ: ${errText}`)
    }

    return { success: true, message: 'Repost forwarded to flownaŭ' }
  }

  async getLatestOwnedSynthesis(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    return this.prisma.brandSynthesis.findFirst({
      where: { brandId, type: 'owned_content' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, attachedUrls: true, createdAt: true },
    })
  }

  async getLatestOwnedVoice(brandId: string) {
    const brand = await this.prisma.brand.findUnique({ where: { id: brandId } })
    if (!brand) throw new NotFoundException('Brand not found')

    return this.prisma.brandSynthesis.findFirst({
      where: { brandId, type: 'owned_voice' },
      orderBy: { createdAt: 'desc' },
      select: { id: true, content: true, attachedUrls: true, createdAt: true },
    })
  }

  async generateOwnedSynthesis(brandId: string) {
    const brand = await this.prisma.brand.findUnique({
      where: { id: brandId },
      include: { ownedProfiles: { select: { id: true } } },
    })
    if (!brand) throw new NotFoundException('Brand not found')

    const profileIds = brand.ownedProfiles.map((p) => p.id)
    if (profileIds.length === 0) {
      throw new UnprocessableEntityException('No owned profiles assigned to this brand.')
    }

    const posts = await this.prisma.post.findMany({
      where: { socialProfileId: { in: profileIds } },
      select: { url: true, caption: true, postedAt: true },
      orderBy: { postedAt: 'desc' },
      take: DEFAULT_OWNED_POST_LIMIT,
    })

    if (posts.length === 0) {
      throw new UnprocessableEntityException('No posts found for the owned profiles. Scrape them first.')
    }

    const systemPrompt = `Eres un estratega de contenido y director creativo experto. Se te proporcionan publicaciones reales de redes sociales.
Tu tarea consiste en dos cosas:
1. Extraer y presentar directamente los temas de contenido abordados en las publicaciones.
2. Extraer y definir el tono y la voz de marca utilizados en las publicaciones.

CRÍTICO para el resumen de contenido (content_summary): Está terminantemente PROHIBIDO usar lenguaje interpretativo, introducciones o contexto (NO uses "La marca se centra en", "Los temas abordados incluyen", "El contenido habla de", "Se observa un tono", "Estas publicaciones tratan de", "Las publicaciones abordan"). Comienza INMEDIATAMENTE con los conceptos y temas de forma directa y cruda.

EJEMPLO DE INICIO CORRECTO para content_summary:
"El Diseño Humano aplicado a la crianza consciente. Estrategias de comunicación familiar personalizadas basadas en el tipo energético..."

CRÍTICO para la voz de marca (brand_voice): Define directamente las pautas del tono, adjetivos de personalidad y estilo lingüístico que se desprenden de las publicaciones de forma accionable para replicar la voz.

Devuelve un JSON con los campos:
- "content_summary": la síntesis directa del contenido (en español, de 150 a 300 palabras).
- "brand_voice": la pauta del tono y voz de la marca (en español, de 100 a 200 palabras).
- "attachedUrls": lista de URLs de las publicaciones que más influyeron (vacía si no hay URLs).
- "reasoning": breve explicación de los temas detectados.`

    const postsText = posts
      .map((p, i) => {
        let entry = `### Publicación ${i + 1}`
        if (p.url) entry += `\nURL: ${p.url}`
        if (p.caption) entry += `\nCaption: ${p.caption.slice(0, 400)}`
        return entry
      })
      .join('\n\n')

    const userContent = `## ADN DE MARCA\n${brand.voicePrompt}\n\n## PUBLICACIONES PROPIAS (${posts.length} más recientes)\n${postsText}\n\nGenera el resumen de contenido.`

    const { client, model, provider } = getClientForFeature('synthesis')

    const result = await client.chatCompletion({
      model,
      temperature: 0.7,
      messages: [
        { role: 'system', content: systemPrompt },
        { role: 'user', content: userContent },
      ],
      responseFormat: { type: 'json_object' },
    })

    const apiURL = this.config.get<string>('NAU_API_URL')
    const authSecret = this.config.get<string>('AUTH_SECRET')

    if (apiURL && authSecret) {
      const { signServiceToken } = await import('@nau/auth')
      signServiceToken({ secret: authSecret, iss: 'nauthenticity', aud: 'api' })
        .then((token) => {
          reportUsage({
            apiUrl: apiURL,
            serviceToken: token,
            workspaceId: brand.workspaceId || '',
            brandId,
            service: 'nauthenticity',
            operation: 'chat_completion',
            usage: result.usage,
          })
        })
        .catch(() => {})
    }

    let parsed: any
    try {
      parsed = JSON.parse(result.content)
      const validated = SynthesisOutputSchema.parse(parsed)
      
      const [savedContent, savedVoice] = await Promise.all([
        this.prisma.brandSynthesis.create({
          data: {
            brandId,
            type: 'owned_content',
            content: validated.content_summary,
            attachedUrls: validated.attachedUrls,
          }
        }),
        this.prisma.brandSynthesis.create({
          data: {
            brandId,
            type: 'owned_voice',
            content: validated.brand_voice,
            attachedUrls: validated.attachedUrls,
          }
        })
      ])

      return {
        id: savedContent.id,
        content_summary: savedContent.content,
        brand_voice: savedVoice.content,
        attachedUrls: savedContent.attachedUrls,
        createdAt: savedContent.createdAt,
      }
    } catch (err) {
      throw new BadGatewayException('LLM response was not valid JSON.')
    }
  }

  private async assertOwnership(id: string, brandId: string) {
    const item = await this.prisma.inspoItem.findUnique({ where: { id } })
    if (!item || item.brandId !== brandId) throw new NotFoundException('Inspo item not found')
  }
}
