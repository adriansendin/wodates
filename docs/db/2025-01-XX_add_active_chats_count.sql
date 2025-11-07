-- Supabase migration: add active_chats_count column to users table
BEGIN;

-- 1. Agregar columna active_chats_count
ALTER TABLE public.users
ADD COLUMN IF NOT EXISTS active_chats_count INTEGER DEFAULT 0;

-- 2. Agregar constraint para validar rango (permitir valores > 3 para usuarios existentes)
ALTER TABLE public.users
ADD CONSTRAINT users_active_chats_count_check 
CHECK (active_chats_count >= 0);

-- 3. Inicializar valores existentes: contar chats activos (excluyendo bloqueados)
-- Un chat está activo si NO hay bloqueo bidireccional entre los participantes
UPDATE public.users u
SET active_chats_count = (
  SELECT COUNT(DISTINCT cp.chat_id)
  FROM chat_participants cp
  INNER JOIN chat_participants cp2 ON cp.chat_id = cp2.chat_id AND cp.user_id != cp2.user_id
  WHERE cp.user_id = u.id
    -- Excluir chats donde hay bloqueo bidireccional
    AND NOT EXISTS (
      SELECT 1
      FROM blocked_users bu
      WHERE (
        (bu.blocker_id = cp.user_id AND bu.blocked_id = cp2.user_id)
        OR
        (bu.blocker_id = cp2.user_id AND bu.blocked_id = cp.user_id)
      )
    )
);

COMMIT;

