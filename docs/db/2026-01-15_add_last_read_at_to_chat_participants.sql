-- Add last_read_at timestamp column to chat_participants table
-- This will replace the message ID-based approach with a timestamp-based approach
-- for more reliable and performant unread count calculations

ALTER TABLE public.chat_participants
ADD COLUMN last_read_at timestamptz DEFAULT NULL;

-- Add index for performance on timestamp-based queries
CREATE INDEX IF NOT EXISTS idx_chat_participants_last_read_at
ON public.chat_participants (last_read_at)
WHERE last_read_at IS NOT NULL;

-- Add composite index for chat_id + last_read_at for efficient unread count queries
CREATE INDEX IF NOT EXISTS idx_chat_participants_chat_id_last_read_at
ON public.chat_participants (chat_id, last_read_at);

COMMENT ON COLUMN public.chat_participants.last_read_at IS 'Timestamp when user last read messages in this chat. Used for calculating unread counts.';