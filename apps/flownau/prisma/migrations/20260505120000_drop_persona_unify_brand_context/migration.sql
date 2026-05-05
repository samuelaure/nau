-- Drop BrandPersona; unify brand context; rename custom prompts; drop BrandTemplateConfig.customPrompt; add Post.angle.

-- Brand: rename custom prompt fields, add context
ALTER TABLE "Brand" RENAME COLUMN "ideationPrompt" TO "ideationCustomPrompt";
ALTER TABLE "Brand" RENAME COLUMN "composerPrompt" TO "draftCustomPrompt";
ALTER TABLE "Brand" ADD COLUMN "context" JSONB;

-- BrandTemplateConfig: drop per-template custom prompt (replaced by Brand.draftCustomPrompt)
ALTER TABLE "BrandTemplateConfig" DROP COLUMN "customPrompt";

-- Post: drop brandPersonaId fk + column; add angle
ALTER TABLE "Post" DROP CONSTRAINT IF EXISTS "Post_brandPersonaId_fkey";
ALTER TABLE "Post" DROP COLUMN "brandPersonaId";
ALTER TABLE "Post" ADD COLUMN "angle" TEXT;

-- Drop BrandPersona table
DROP TABLE "BrandPersona";
