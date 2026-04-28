import { Injectable, NotFoundException, BadGatewayException, UnprocessableEntityException } from '@nestjs/common'
import { ConfigService } from '@nestjs/config'
import { PrismaService } from '../prisma/prisma.service'
import { CreateInspoItemDto, UpdateInspoItemDto } from './inspo.dto'
import { getClientForFeature, reportUsage } from '@nau/llm-client'
import { z } from 'zod'

const SynthesisOutputSchema = z.object({
  content: z.string(),
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
      ownedContentSynthesis = ownedSynthesis?.content ?? null
    }

    return { content: parts.join('\n'), attachedUrls, ownedContentSynthesis }
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

    const systemPrompt = `Eres un estratega de contenido experto. Se te proporcionan publicaciones reales de redes sociales.
Tu tarea: extraer y presentar directamente los temas de contenido abordados en las publicaciones.

CRÍTICO: Está terminantemente PROHIBIDO usar lenguaje interpretativo, introducciones o contexto (NO uses "La marca se centra en", "Los temas abordados incluyen", "El contenido habla de", "Se observa un tono", "Estas publicaciones tratan de", "Las publicaciones abordan").

Comienza INMEDIATAMENTE con los conceptos y temas de forma directa y cruda. 

EJEMPLO DE INICIO CORRECTO:
"El Diseño Humano aplicado a la crianza consciente. Estrategias de comunicación familiar personalizadas basadas en el tipo energético..."

El texto debe:
- Presentar directamente los conceptos, ideas y temas recurrentes tratados en las publicaciones.
- Ser útil directamente como temática para la generación de nuevo contenido.
- Estar escrito en español, en un párrafo continuo y rico de 150 a 300 palabras.

Devuelve un JSON con los campos:
- "content": la síntesis directa del contenido.
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
      
      const saved = await this.prisma.brandSynthesis.create({
        data: {
          brandId,
          type: 'owned_content',
          content: validated.content,
          attachedUrls: validated.attachedUrls,
        }
      })

      return {
        id: saved.id,
        content: saved.content,
        attachedUrls: saved.attachedUrls,
        createdAt: saved.createdAt,
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
