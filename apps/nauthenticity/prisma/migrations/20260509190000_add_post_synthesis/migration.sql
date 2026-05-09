-- Add postSynthesis to Post: LLM-generated interpretation of post content
-- Generated during synthesize-batch step in the compute pipeline.
ALTER TABLE "Post" ADD COLUMN "postSynthesis" TEXT;
