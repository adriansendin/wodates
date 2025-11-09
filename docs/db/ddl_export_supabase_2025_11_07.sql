-- Creación del esquema (si no existe)
CREATE SCHEMA IF NOT EXISTS public;

-- Tipos enumerados usados en public (recreados si no existen)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'user_gender' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.user_gender AS ENUM ('male','female','non_binary');
  END IF;
END$$;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE t.typname = 'looking_for_preference' AND n.nspname = 'public'
  ) THEN
    CREATE TYPE public.looking_for_preference AS ENUM ('male','female','both');
  END IF;
END$$;

-- Tabla: users
CREATE TABLE IF NOT EXISTS public.users (
  active_chats_count integer DEFAULT 0 CHECK (active_chats_count >= 0),
  show_in_feed boolean DEFAULT TRUE,
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  "birthDate" date,
  gender public.user_gender,
  min_age integer CHECK (min_age >= 18),
  max_age integer CHECK (max_age >= 18),
  bio text,
  city text,
  looking_for public.looking_for_preference,
  avatar_url text,
  country text
);

-- Índices para users
CREATE INDEX IF NOT EXISTS idx_users_min_age ON public.users (min_age);
CREATE INDEX IF NOT EXISTS idx_users_max_age ON public.users (max_age);
CREATE INDEX IF NOT EXISTS idx_users_show_in_feed ON public.users (show_in_feed);
CREATE INDEX IF NOT EXISTS idx_users_gender ON public.users (gender);

-- Tabla: interactions
CREATE TABLE IF NOT EXISTS public.interactions (
  from_user uuid,
  to_user uuid,
  action text CHECK (action = ANY (ARRAY['like','pass'])),
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS public.interactions
  ADD CONSTRAINT interactions_from_user_fkey FOREIGN KEY (from_user)
    REFERENCES public.users(id) ON DELETE SET NULL;

ALTER TABLE IF EXISTS public.interactions
  ADD CONSTRAINT interactions_to_user_fkey FOREIGN KEY (to_user)
    REFERENCES public.users(id) ON DELETE SET NULL;

-- Índices para interactions
CREATE INDEX IF NOT EXISTS idx_interactions_from_user ON public.interactions (from_user);
CREATE INDEX IF NOT EXISTS idx_interactions_to_user ON public.interactions (to_user);
CREATE INDEX IF NOT EXISTS idx_interactions_created_at ON public.interactions (created_at);
CREATE INDEX IF NOT EXISTS idx_interactions_action ON public.interactions (action);

-- Tabla: chats
CREATE TABLE IF NOT EXISTS public.chats (
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_chats_created_at ON public.chats (created_at);

-- Tabla: chat_participants
CREATE TABLE IF NOT EXISTS public.chat_participants (
  chat_id uuid NOT NULL,
  user_id uuid NOT NULL,
  last_read_message_id uuid,
  joined_at timestamptz DEFAULT now(),
  PRIMARY KEY (chat_id, user_id)
);

ALTER TABLE IF EXISTS public.chat_participants
  ADD CONSTRAINT chat_participants_chat_id_fkey FOREIGN KEY (chat_id)
    REFERENCES public.chats(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.chat_participants
  ADD CONSTRAINT chat_participants_user_id_fkey FOREIGN KEY (user_id)
    REFERENCES public.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_chat_participants_user_id ON public.chat_participants (user_id);
CREATE INDEX IF NOT EXISTS idx_chat_participants_joined_at ON public.chat_participants (joined_at);

-- Tabla: messages
CREATE TABLE IF NOT EXISTS public.messages (
  chat_id uuid,
  sender_id uuid,
  content text,
  id uuid DEFAULT extensions.uuid_generate_v4() PRIMARY KEY,
  created_at timestamptz DEFAULT now()
);

ALTER TABLE IF EXISTS public.messages
  ADD CONSTRAINT messages_chat_id_fkey FOREIGN KEY (chat_id)
    REFERENCES public.chats(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.messages
  ADD CONSTRAINT messages_sender_id_fkey FOREIGN KEY (sender_id)
    REFERENCES public.users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_messages_chat_id_created_at ON public.messages (chat_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_messages_sender_id ON public.messages (sender_id);
CREATE INDEX IF NOT EXISTS idx_messages_created_at ON public.messages (created_at);

-- Tabla: blocked_users
CREATE TABLE IF NOT EXISTS public.blocked_users (
  blocker_id uuid NOT NULL,
  blocked_id uuid NOT NULL,
  created_at timestamptz DEFAULT now(),
  PRIMARY KEY (blocker_id, blocked_id)
);

ALTER TABLE IF EXISTS public.blocked_users
  ADD CONSTRAINT blocked_users_blocked_fkey FOREIGN KEY (blocked_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE IF EXISTS public.blocked_users
  ADD CONSTRAINT blocked_users_blocker_fkey FOREIGN KEY (blocker_id)
    REFERENCES auth.users(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_blocked_users_blocker_id ON public.blocked_users (blocker_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_blocked_id ON public.blocked_users (blocked_id);
CREATE INDEX IF NOT EXISTS idx_blocked_users_created_at ON public.blocked_users (created_at);

-- Comentarios descriptivos
COMMENT ON TABLE public.users IS 'Usuarios de la aplicación (esquema public)';
COMMENT ON COLUMN public.users.id IS 'UUID del usuario (generado por extensions.uuid_generate_v4())';
COMMENT ON TABLE public.chats IS 'One record per conversation (1:1 or group).';
COMMENT ON TABLE public.chat_participants IS 'Links users to chats. One row per user per chat.';
COMMENT ON TABLE public.messages IS 'Stores all messages linked to a chat.';
COMMENT ON TABLE public.interactions IS 'Stores user interactions (like/pass) between users.';

-- Fin del DDL del esquema public
