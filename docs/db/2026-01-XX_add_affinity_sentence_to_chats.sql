-- Add affinity_sentence column to chats table
-- This stores the generated affinity sentence for a match, computed at match creation time
-- The sentence explains why two users matched based on their AI profile summaries

ALTER TABLE public.chats
ADD COLUMN affinity_sentence text DEFAULT NULL;

-- Add index for performance (though queries will typically be by chat_id which is already indexed)
CREATE INDEX IF NOT EXISTS idx_chats_affinity_sentence
ON public.chats (affinity_sentence)
WHERE affinity_sentence IS NOT NULL;

COMMENT ON COLUMN public.chats.affinity_sentence IS 'Generated affinity sentence explaining why two users matched, based on their AI profile summaries. Stored at match creation time.';
