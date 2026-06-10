import { createRequire } from 'node:module';
import { PrismaClient } from '../src/generated/prisma/index.js';
import * as fs from 'fs';

const _require = createRequire(import.meta.url);
const connectionString = process.env.DATABASE_URL;

// Use absolute paths inside the docker container
const pgMod = '/app/apps/flownau/.next/node_modules/pg';
const adapterMod = '/app/apps/flownau/.next/node_modules/@prisma/adapter-pg';

const pg = _require(pgMod);
const { PrismaPg } = _require(adapterMod);
const pool = new pg.Pool({ connectionString });
const adapter = new PrismaPg(pool);
const prisma = new PrismaClient({ adapter });

const generateId = () => Math.random().toString(36).substring(2, 15);

function createText(content: string, minWords: number, maxWords: number) {
    return {
        id: generateId(),
        font: null,
        mode: "prompt",
        color: null,
        content: content,
        maxWords: maxWords,
        minWords: minWords,
        textStyle: "background_block",
        styleColor: "#000000",
        maxTextSize: null,
        horizontalAlign: "center"
    };
}

function createScene(texts: any[]) {
    return {
        id: generateId(),
        texts: texts,
        overlayColor: null,
        overlayOpacity: null,
        textVerticalAlign: "center",
        backgroundVideoUrl: null,
        backgroundVideoAssetId: null,
        backgroundVideoDurationSecs: null
    };
}

// Structural definitions for the 10 standard hooks
const HOOK_STRUCTURES = [
  { index: 1, scenes: [[ { min: 12, max: 20 } ]] },
  { index: 2, scenes: [[ { min: 12, max: 22 }, { min: 8, max: 16 } ]] },
  { index: 3, scenes: [[ { min: 3, max: 6 }, { min: 10, max: 20 } ]] },
  { index: 4, scenes: [[ { min: 12, max: 20 } ], [ { min: 10, max: 18 } ]] },
  { index: 5, scenes: [[ { min: 12, max: 22 } ]] },
  { index: 6, scenes: [[ { min: 10, max: 18 }, { min: 8, max: 16 } ]] },
  { index: 7, scenes: [[ { min: 12, max: 20 } ]] },
  { index: 8, scenes: [[ { min: 14, max: 24 } ], [ { min: 10, max: 18 } ]] },
  { index: 9, scenes: [[ { min: 10, max: 18 }, { min: 6, max: 12 } ]] },
  { index: 10, scenes: [[ { min: 8, max: 16 } ]] }
];

async function main() {
    const inputPath = process.argv[2];
    if (!inputPath || !fs.existsSync(inputPath)) {
        throw new Error("Usage: npx tsx import-brand-hooks.ts <path-to-json>");
    }

    const inputData = JSON.parse(fs.readFileSync(inputPath, 'utf8'));
    const { brandName, baseBlock, presentationBlock, hooks } = inputData;

    console.log(`Looking for brand '${brandName}'...`);
    let brand = await prisma.brand.findFirst({
        where: { name: { contains: brandName } }
    });

    if (!brand) {
        throw new Error(`Could not find Brand for ${brandName}.`);
    }
    console.log("Found Brand:", brand.name, brand.id);

    for (const hook of hooks) {
        const struct = HOOK_STRUCTURES.find(h => h.index === hook.index);
        if (!struct) throw new Error(`Invalid hook index: ${hook.index}`);

        const fullSystemPrompt = `${baseBlock}\n\n${hook.systemPrompt}`;
        const fullCaptionPrompt = `${presentationBlock}\n\n${hook.captionPrompt}`;
        
        // Map texts to scenes
        let textIdx = 0;
        const mappedScenes = struct.scenes.map(sceneDef => {
            const texts = sceneDef.map(textDef => {
                const content = hook.texts[textIdx++];
                if (!content) throw new Error(`Missing text content for hook ${hook.index}`);
                return createText(content, textDef.min, textDef.max);
            });
            return createScene(texts);
        });

        const templateName = `${brand.name.replace(/\s+/g, '')} - Hook ${hook.index}: ${hook.name}`;
        console.log(`Recreating template: ${templateName}`);
        
        // Ensure no duplicates by name for this brand
        const existing = await prisma.template.findFirst({
            where: { name: templateName, brandId: brand.id },
            include: { brandConfigs: true }
        });

        if (existing) {
            console.log("Template already exists. Deleting it completely...");
            await prisma.brandTemplateConfig.deleteMany({
                where: { templateId: existing.id }
            });
            await prisma.template.delete({
                where: { id: existing.id }
            });
        }
        
        const newTemplate = await prisma.template.create({
            data: {
                name: templateName,
                format: "reel",
                remotionId: "DynamicReel",
                brandId: brand.id,
                scope: "brand",
                useBrandAssets: true,
                scenes: mappedScenes,
                sceneType: "dynamic",
                systemPrompt: null,
                creationPrompt: null,
                captionPrompt: null,
            }
        });

        const slotOverrides = {
            caption: {
                minWords: hook.minCap,
                maxWords: hook.maxCap,
                intention: fullCaptionPrompt
            }
        };

        await prisma.brandTemplateConfig.create({
            data: {
                brandId: brand.id,
                templateId: newTemplate.id,
                enabled: true,
                autoApproveDraft: false,
                autoApprovePost: false,
                customPrompt: fullSystemPrompt,
                slotOverrides: slotOverrides
            }
        });
        console.log("Created template", newTemplate.id);
    }
    console.log("Successfully imported brand hooks.");
}

main().catch(console.error).finally(() => prisma.$disconnect());
