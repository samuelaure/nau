-- Add per-brand per-template custom prompt and slot overrides to BrandTemplateConfig.
ALTER TABLE "BrandTemplateConfig" ADD COLUMN "customPrompt" TEXT;
ALTER TABLE "BrandTemplateConfig" ADD COLUMN "slotOverrides" JSONB;
