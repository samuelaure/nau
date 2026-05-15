-- Convert BrandContext.content from Json to String (plain text)
-- Existing JSON values are cast to text; they will be overwritten on next generation.
ALTER TABLE "BrandContext" ALTER COLUMN "content" TYPE TEXT USING "content"::text;
