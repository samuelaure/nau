-- Convert Brand.context from Json to String (plain text)
-- Existing JSON values are cast to text; they will be overwritten on next generation.
ALTER TABLE "Brand" ALTER COLUMN "context" TYPE TEXT USING "context"::text;
