


SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;


CREATE SCHEMA IF NOT EXISTS "public";


ALTER SCHEMA "public" OWNER TO "pg_database_owner";


COMMENT ON SCHEMA "public" IS 'standard public schema';



CREATE TYPE "public"."cares_about_partner_children_preference" AS ENUM (
    'yes',
    'no'
);


ALTER TYPE "public"."cares_about_partner_children_preference" OWNER TO "postgres";


CREATE TYPE "public"."cares_about_partner_drinking_preference" AS ENUM (
    'yes',
    'no'
);


ALTER TYPE "public"."cares_about_partner_drinking_preference" OWNER TO "postgres";


CREATE TYPE "public"."cares_about_partner_smoking_preference" AS ENUM (
    'yes',
    'no'
);


ALTER TYPE "public"."cares_about_partner_smoking_preference" OWNER TO "postgres";


CREATE TYPE "public"."drinking_preference" AS ENUM (
    'no',
    'special_occasions',
    'socially',
    'frequently'
);


ALTER TYPE "public"."drinking_preference" OWNER TO "postgres";


CREATE TYPE "public"."looking_for_preference" AS ENUM (
    'male',
    'female',
    'both'
);


ALTER TYPE "public"."looking_for_preference" OWNER TO "postgres";


CREATE TYPE "public"."smoking_preference" AS ENUM (
    'no',
    'occasionally',
    'regularly'
);


ALTER TYPE "public"."smoking_preference" OWNER TO "postgres";


CREATE TYPE "public"."user_gender" AS ENUM (
    'male',
    'female',
    'non_binary'
);


ALTER TYPE "public"."user_gender" OWNER TO "postgres";


CREATE TYPE "public"."wants_children_preference" AS ENUM (
    'yes',
    'no',
    'not_sure'
);


ALTER TYPE "public"."wants_children_preference" OWNER TO "postgres";


CREATE OR REPLACE FUNCTION "public"."set_updated_at"() RETURNS "trigger"
    LANGUAGE "plpgsql"
    AS $$
BEGIN
  NEW.updated_at = timezone('utc', now());
  RETURN NEW;
END;
$$;


ALTER FUNCTION "public"."set_updated_at"() OWNER TO "postgres";

SET default_tablespace = '';

SET default_table_access_method = "heap";


CREATE TABLE IF NOT EXISTS "public"."blocked_users" (
    "blocker_id" "uuid" NOT NULL,
    "blocked_id" "uuid" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "blocked_users_no_self_block" CHECK (("blocker_id" <> "blocked_id"))
);


ALTER TABLE "public"."blocked_users" OWNER TO "postgres";


COMMENT ON TABLE "public"."blocked_users" IS 'Stores user blocking relationships. One record means blocker_id has blocked blocked_id.';



COMMENT ON COLUMN "public"."blocked_users"."blocker_id" IS 'User who performs the block.';



COMMENT ON COLUMN "public"."blocked_users"."blocked_id" IS 'User who is blocked.';



COMMENT ON COLUMN "public"."blocked_users"."created_at" IS 'Timestamp when the block action occurred.';



CREATE TABLE IF NOT EXISTS "public"."chat_participants" (
    "chat_id" "uuid" NOT NULL,
    "user_id" "uuid" NOT NULL,
    "last_read_message_id" "uuid",
    "joined_at" timestamp with time zone DEFAULT "now"(),
    "last_read_at" timestamp with time zone
);


ALTER TABLE "public"."chat_participants" OWNER TO "postgres";


COMMENT ON TABLE "public"."chat_participants" IS 'Links users to chats. One row per user per chat.';



COMMENT ON COLUMN "public"."chat_participants"."last_read_message_id" IS 'Last message seen by this participant.';



COMMENT ON COLUMN "public"."chat_participants"."joined_at" IS 'Timestamp when the user joined the chat.';



COMMENT ON COLUMN "public"."chat_participants"."last_read_at" IS 'Timestamp when user last read messages in this chat. Used for calculating unread counts.';



CREATE TABLE IF NOT EXISTS "public"."chats" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "affinity_sentence" "text"
);


ALTER TABLE "public"."chats" OWNER TO "postgres";


COMMENT ON TABLE "public"."chats" IS 'One record per conversation (1:1 or group).';



COMMENT ON COLUMN "public"."chats"."affinity_sentence" IS 'Generated affinity sentence explaining why two users matched, based on their AI profile summaries. Stored at match creation time.';



CREATE TABLE IF NOT EXISTS "public"."checkpoint_blobs" (
    "thread_id" "text" NOT NULL,
    "checkpoint_ns" "text" DEFAULT ''::"text" NOT NULL,
    "channel" "text" NOT NULL,
    "version" "text" NOT NULL,
    "type" "text" NOT NULL,
    "blob" "bytea"
);


ALTER TABLE "public"."checkpoint_blobs" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkpoint_migrations" (
    "v" integer NOT NULL
);


ALTER TABLE "public"."checkpoint_migrations" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkpoint_writes" (
    "thread_id" "text" NOT NULL,
    "checkpoint_ns" "text" DEFAULT ''::"text" NOT NULL,
    "checkpoint_id" "text" NOT NULL,
    "task_id" "text" NOT NULL,
    "idx" integer NOT NULL,
    "channel" "text" NOT NULL,
    "type" "text",
    "blob" "bytea" NOT NULL,
    "task_path" "text" DEFAULT ''::"text" NOT NULL
);


ALTER TABLE "public"."checkpoint_writes" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."checkpoints" (
    "thread_id" "text" NOT NULL,
    "checkpoint_ns" "text" DEFAULT ''::"text" NOT NULL,
    "checkpoint_id" "text" NOT NULL,
    "parent_checkpoint_id" "text",
    "type" "text",
    "checkpoint" "jsonb" NOT NULL,
    "metadata" "jsonb" DEFAULT '{}'::"jsonb" NOT NULL
);


ALTER TABLE "public"."checkpoints" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."contact_us_messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"()
);


ALTER TABLE "public"."contact_us_messages" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."deep_onboarding_answers" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "session_uuid" "uuid" NOT NULL,
    "question_code" "text" NOT NULL,
    "question_text_snapshot" "text" NOT NULL,
    "single_key" "text",
    "multi_keys" "text"[],
    "text_answer" "text",
    "other_details" "jsonb",
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."deep_onboarding_answers" OWNER TO "postgres";


COMMENT ON TABLE "public"."deep_onboarding_answers" IS 'Per-question answers with snapshot of prompt text';



CREATE TABLE IF NOT EXISTS "public"."deep_onboarding_blocks" (
    "block_index" integer NOT NULL,
    "intro_text" "text" NOT NULL,
    "sort_order" integer DEFAULT 0 NOT NULL,
    CONSTRAINT "deep_onboarding_blocks_block_index_check" CHECK ((("block_index" >= 1) AND ("block_index" <= 4)))
);


ALTER TABLE "public"."deep_onboarding_blocks" OWNER TO "postgres";


COMMENT ON TABLE "public"."deep_onboarding_blocks" IS 'Intro copy per questionnaire block';



CREATE TABLE IF NOT EXISTS "public"."deep_onboarding_questions" (
    "code" "text" NOT NULL,
    "block_index" integer NOT NULL,
    "sort_order" integer NOT NULL,
    "prompt_text" "text" NOT NULL,
    "answer_type" "text" NOT NULL,
    "max_chars" integer,
    "max_selections" integer,
    "options" "jsonb",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    CONSTRAINT "deep_onboarding_questions_answer_type_check" CHECK (("answer_type" = ANY (ARRAY['single'::"text", 'multi'::"text", 'text'::"text"])))
);


ALTER TABLE "public"."deep_onboarding_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."deep_onboarding_questions" IS 'Canonical questionnaire items for affinity onboarding';



CREATE TABLE IF NOT EXISTS "public"."deep_onboarding_sessions" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "client_session_id" "uuid" NOT NULL,
    "user_id" "uuid",
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."deep_onboarding_sessions" OWNER TO "postgres";


COMMENT ON TABLE "public"."deep_onboarding_sessions" IS 'Anonymous or logged-in submission sessions';



CREATE TABLE IF NOT EXISTS "public"."external_chat_files" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "file_path" "text" NOT NULL,
    "original_filename" "text",
    "file_size" bigint,
    "checksum" "text",
    "status" "text" DEFAULT 'uploaded'::"text" NOT NULL,
    "error_message" "text",
    "metadata" "jsonb",
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "updated_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "processed_at" timestamp with time zone,
    CONSTRAINT "external_chat_files_status_check" CHECK (("status" = ANY (ARRAY['uploaded'::"text", 'processing'::"text", 'processed'::"text", 'error'::"text"])))
);


ALTER TABLE "public"."external_chat_files" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."imported_conversations" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "owner_user_id" "uuid" NOT NULL,
    "source" "text" DEFAULT 'whatsapp'::"text",
    "ingress" "text" DEFAULT 'doclove'::"text",
    "upload_zip_path" "text" NOT NULL,
    "uploaded_at" timestamp with time zone DEFAULT "now"(),
    "file_size_bytes" integer
);


ALTER TABLE "public"."imported_conversations" OWNER TO "postgres";


COMMENT ON TABLE "public"."imported_conversations" IS 'Catálogo de archivos ZIP de conversaciones subidos desde Doc Love.';



COMMENT ON COLUMN "public"."imported_conversations"."owner_user_id" IS 'ID del usuario propietario del archivo.';



COMMENT ON COLUMN "public"."imported_conversations"."source" IS 'Fuente original del chat (whatsapp, telegram, etc.).';



COMMENT ON COLUMN "public"."imported_conversations"."ingress" IS 'Módulo o punto de subida (doclove, api, etc.).';



COMMENT ON COLUMN "public"."imported_conversations"."upload_zip_path" IS 'Ruta del archivo ZIP en el bucket external_conversations.';



COMMENT ON COLUMN "public"."imported_conversations"."uploaded_at" IS 'Marca temporal de subida (zona UTC).';



COMMENT ON COLUMN "public"."imported_conversations"."file_size_bytes" IS 'Tamaño del archivo ZIP en bytes.';



CREATE TABLE IF NOT EXISTS "public"."interactions" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "from_user" "uuid",
    "to_user" "uuid",
    "action" "text",
    "created_at" timestamp with time zone DEFAULT "now"(),
    CONSTRAINT "interactions_action_check" CHECK (("action" = ANY (ARRAY['like'::"text", 'pass'::"text"])))
);


ALTER TABLE "public"."interactions" OWNER TO "postgres";


COMMENT ON TABLE "public"."interactions" IS 'Stores user interactions (like/pass) between users. Each record represents one user action toward another user.';



COMMENT ON COLUMN "public"."interactions"."id" IS 'Unique identifier for the interaction.';



COMMENT ON COLUMN "public"."interactions"."from_user" IS 'The user who performed the action (like or pass).';



COMMENT ON COLUMN "public"."interactions"."to_user" IS 'The target user who received the action.';



COMMENT ON COLUMN "public"."interactions"."action" IS 'The type of action performed: like or pass.';



COMMENT ON COLUMN "public"."interactions"."created_at" IS 'Timestamp when the interaction occurred.';



CREATE TABLE IF NOT EXISTS "public"."messages" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "chat_id" "uuid",
    "sender_id" "uuid",
    "content" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"(),
    "profile_processed_at" timestamp with time zone
);


ALTER TABLE "public"."messages" OWNER TO "postgres";


COMMENT ON TABLE "public"."messages" IS 'Stores all messages linked to a chat.';



COMMENT ON COLUMN "public"."messages"."sender_id" IS 'User who sent the message.';



COMMENT ON COLUMN "public"."messages"."content" IS 'Message text.';



COMMENT ON COLUMN "public"."messages"."created_at" IS 'When the message was sent.';



COMMENT ON COLUMN "public"."messages"."profile_processed_at" IS 'Marca cuándo este mensaje fue incorporado al perfil IA del usuario (summary + embedding). NULL = aún no procesado.';



CREATE TABLE IF NOT EXISTS "public"."question_bank" (
    "id" bigint NOT NULL,
    "category" "text" NOT NULL,
    "question" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    "deprecated" boolean DEFAULT false NOT NULL
);


ALTER TABLE "public"."question_bank" OWNER TO "postgres";


CREATE SEQUENCE IF NOT EXISTS "public"."question_bank_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


ALTER SEQUENCE "public"."question_bank_id_seq" OWNER TO "postgres";


ALTER SEQUENCE "public"."question_bank_id_seq" OWNED BY "public"."question_bank"."id";



CREATE TABLE IF NOT EXISTS "public"."user_ai_profiles" (
    "user_id" "uuid" NOT NULL,
    "summary" "text",
    "summary_updated_at" timestamp with time zone DEFAULT "now"(),
    "summary_incremental" "text",
    "summary_embedding" "public"."vector"(1536)
);


ALTER TABLE "public"."user_ai_profiles" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_ai_profiles" IS 'Perfil IA por usuario: resumen de personalidad/estilo y embedding asociado para matching. Relación 1:1 con public.users.';



COMMENT ON COLUMN "public"."user_ai_profiles"."user_id" IS 'ID del usuario (public.users.id) al que pertenece este perfil IA.';



COMMENT ON COLUMN "public"."user_ai_profiles"."summary" IS 'Resumen de alto nivel generado por IA sobre cómo es la persona (gustos, estilo de escritura, forma de relacionarse, etc.).';



COMMENT ON COLUMN "public"."user_ai_profiles"."summary_updated_at" IS 'Fecha/hora de la última actualización del resumen y del embedding para este usuario.';



COMMENT ON COLUMN "public"."user_ai_profiles"."summary_embedding" IS 'Embeddings for user summary. OpenAI text-embedding-3-small (1536 dims).';



CREATE TABLE IF NOT EXISTS "public"."user_asked_questions" (
    "user_id" "uuid" NOT NULL,
    "question_id" integer NOT NULL,
    "asked_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_asked_questions" OWNER TO "postgres";


COMMENT ON TABLE "public"."user_asked_questions" IS 'Tracks which questions from question_bank have been asked to each user (no repeats)';



COMMENT ON COLUMN "public"."user_asked_questions"."user_id" IS 'User (public.users) who was asked the question';



COMMENT ON COLUMN "public"."user_asked_questions"."question_id" IS 'Question (question_bank) that was asked';



COMMENT ON COLUMN "public"."user_asked_questions"."asked_at" IS 'UTC timestamp when the question was asked';



CREATE TABLE IF NOT EXISTS "public"."user_photos" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "storage_path" "text" NOT NULL,
    "public_url" "text" NOT NULL,
    "is_main" boolean DEFAULT false NOT NULL,
    "position" smallint DEFAULT 0 NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."user_photos" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_social_profile_interests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "code" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL,
    CONSTRAINT "user_social_profile_interests_code_format" CHECK ((TRIM(BOTH FROM "code") ~ '^[A-Za-z0-9_-]+$'::"text")),
    CONSTRAINT "user_social_profile_interests_code_len" CHECK ((("char_length"(TRIM(BOTH FROM "code")) >= 2) AND ("char_length"(TRIM(BOTH FROM "code")) <= 48)))
);


ALTER TABLE "public"."user_social_profile_interests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."user_verification_requests" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "user_id" "uuid" NOT NULL,
    "photo_storage_path" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "timezone"('utc'::"text", "now"()) NOT NULL
);


ALTER TABLE "public"."user_verification_requests" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."users" (
    "id" "uuid" DEFAULT "extensions"."uuid_generate_v4"() NOT NULL,
    "birthDate" "date",
    "gender" "public"."user_gender",
    "looking_for" "public"."looking_for_preference",
    "min_age" integer,
    "max_age" integer,
    "bio" "text",
    "city" "text",
    "country" "text",
    "show_bio_in_feed" boolean DEFAULT true,
    "active_chats_count" integer DEFAULT 0,
    "is_bot" boolean DEFAULT false,
    "verification_status" "text" DEFAULT 'pending'::"text" NOT NULL,
    "has_children" boolean,
    "wants_children" "public"."wants_children_preference",
    "cares_about_partner_children" "public"."cares_about_partner_children_preference",
    "smoking" "public"."smoking_preference",
    "drinking" "public"."drinking_preference",
    "cares_about_partner_smoking" "public"."cares_about_partner_smoking_preference",
    "cares_about_partner_drinking" "public"."cares_about_partner_drinking_preference",
    "build_profile_cta_tapped_at" timestamp with time zone,
    "app_locale" "text" DEFAULT 'en'::"text" NOT NULL,
    "public_profile_code" "text",
    CONSTRAINT "users_active_chats_count_check" CHECK (("active_chats_count" >= 0)),
    CONSTRAINT "users_max_age_check" CHECK (("max_age" >= 18)),
    CONSTRAINT "users_min_age_check" CHECK (("min_age" >= 18)),
    CONSTRAINT "users_verification_status_check" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verifying'::"text", 'verified'::"text", 'rejected'::"text"]))),
    CONSTRAINT "users_verification_status_chk" CHECK (("verification_status" = ANY (ARRAY['pending'::"text", 'verifying'::"text", 'verified'::"text", 'rejected'::"text"])))
);


ALTER TABLE "public"."users" OWNER TO "postgres";


COMMENT ON COLUMN "public"."users"."public_profile_code" IS 'Unique public code (name slug + 3-digit suffix). Assigned when the profile row is created.';



CREATE OR REPLACE VIEW "public"."users_active" AS
 SELECT "u"."id",
    "u"."birthDate",
    "u"."gender",
    "u"."looking_for",
    "u"."min_age",
    "u"."max_age",
    "u"."bio",
    "u"."city",
    "u"."country",
    "u"."show_bio_in_feed",
    "u"."active_chats_count",
    "u"."is_bot",
    "u"."verification_status",
    "u"."has_children",
    "u"."wants_children",
    "u"."cares_about_partner_children",
    "u"."smoking",
    "u"."drinking",
    "u"."cares_about_partner_smoking",
    "u"."cares_about_partner_drinking",
    COALESCE(NULLIF(TRIM(BOTH FROM ("a"."raw_user_meta_data" ->> 'display_name'::"text")), ''::"text"), 'Usuario'::"text") AS "display_name"
   FROM ("public"."users" "u"
     JOIN "auth"."users" "a" ON (("u"."id" = "a"."id")))
  WHERE ("a"."deleted_at" IS NULL);


ALTER VIEW "public"."users_active" OWNER TO "postgres";


CREATE TABLE IF NOT EXISTS "public"."waitlist_signups" (
    "id" "uuid" DEFAULT "gen_random_uuid"() NOT NULL,
    "city" "text" NOT NULL,
    "email" "text" NOT NULL,
    "created_at" timestamp with time zone DEFAULT "now"() NOT NULL
);


ALTER TABLE "public"."waitlist_signups" OWNER TO "postgres";


ALTER TABLE ONLY "public"."question_bank" ALTER COLUMN "id" SET DEFAULT "nextval"('"public"."question_bank_id_seq"'::"regclass");



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_pkey" PRIMARY KEY ("blocker_id", "blocked_id");



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_pkey" PRIMARY KEY ("chat_id", "user_id");



ALTER TABLE ONLY "public"."chats"
    ADD CONSTRAINT "chats_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."checkpoint_blobs"
    ADD CONSTRAINT "checkpoint_blobs_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "channel", "version");



ALTER TABLE ONLY "public"."checkpoint_migrations"
    ADD CONSTRAINT "checkpoint_migrations_pkey" PRIMARY KEY ("v");



ALTER TABLE ONLY "public"."checkpoint_writes"
    ADD CONSTRAINT "checkpoint_writes_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id", "task_id", "idx");



ALTER TABLE ONLY "public"."checkpoints"
    ADD CONSTRAINT "checkpoints_pkey" PRIMARY KEY ("thread_id", "checkpoint_ns", "checkpoint_id");



ALTER TABLE ONLY "public"."contact_us_messages"
    ADD CONSTRAINT "contact_us_messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deep_onboarding_answers"
    ADD CONSTRAINT "deep_onboarding_answers_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."deep_onboarding_answers"
    ADD CONSTRAINT "deep_onboarding_answers_session_uuid_question_code_key" UNIQUE ("session_uuid", "question_code");



ALTER TABLE ONLY "public"."deep_onboarding_blocks"
    ADD CONSTRAINT "deep_onboarding_blocks_pkey" PRIMARY KEY ("block_index");



ALTER TABLE ONLY "public"."deep_onboarding_questions"
    ADD CONSTRAINT "deep_onboarding_questions_pkey" PRIMARY KEY ("code");



ALTER TABLE ONLY "public"."deep_onboarding_sessions"
    ADD CONSTRAINT "deep_onboarding_sessions_client_session_id_key" UNIQUE ("client_session_id");



ALTER TABLE ONLY "public"."deep_onboarding_sessions"
    ADD CONSTRAINT "deep_onboarding_sessions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."external_chat_files"
    ADD CONSTRAINT "external_chat_files_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."imported_conversations"
    ADD CONSTRAINT "imported_conversations_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."question_bank"
    ADD CONSTRAINT "question_bank_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_ai_profiles"
    ADD CONSTRAINT "user_ai_profiles_pkey" PRIMARY KEY ("user_id");



ALTER TABLE ONLY "public"."user_asked_questions"
    ADD CONSTRAINT "user_asked_questions_pkey" PRIMARY KEY ("user_id", "question_id");



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_social_profile_interests"
    ADD CONSTRAINT "user_social_profile_interests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."user_verification_requests"
    ADD CONSTRAINT "user_verification_requests_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."users"
    ADD CONSTRAINT "users_pkey" PRIMARY KEY ("id");



ALTER TABLE ONLY "public"."waitlist_signups"
    ADD CONSTRAINT "waitlist_signups_pkey" PRIMARY KEY ("id");



CREATE INDEX "checkpoint_blobs_thread_id_idx" ON "public"."checkpoint_blobs" USING "btree" ("thread_id");



CREATE INDEX "checkpoint_writes_thread_id_idx" ON "public"."checkpoint_writes" USING "btree" ("thread_id");



CREATE INDEX "checkpoints_thread_id_idx" ON "public"."checkpoints" USING "btree" ("thread_id");



CREATE INDEX "external_chat_files_status_idx" ON "public"."external_chat_files" USING "btree" ("status");



CREATE UNIQUE INDEX "external_chat_files_unique_path" ON "public"."external_chat_files" USING "btree" ("file_path");



CREATE INDEX "external_chat_files_user_id_idx" ON "public"."external_chat_files" USING "btree" ("user_id");



CREATE INDEX "idx_blocked_users_blocked_id" ON "public"."blocked_users" USING "btree" ("blocked_id");



CREATE INDEX "idx_blocked_users_blocker_id" ON "public"."blocked_users" USING "btree" ("blocker_id");



CREATE INDEX "idx_chat_participants_chat_id_last_read_at" ON "public"."chat_participants" USING "btree" ("chat_id", "last_read_at");



CREATE INDEX "idx_chat_participants_last_read_at" ON "public"."chat_participants" USING "btree" ("last_read_at") WHERE ("last_read_at" IS NOT NULL);



CREATE INDEX "idx_chats_affinity_sentence" ON "public"."chats" USING "btree" ("affinity_sentence") WHERE ("affinity_sentence" IS NOT NULL);



CREATE INDEX "idx_contact_us_messages_created_at" ON "public"."contact_us_messages" USING "btree" ("created_at");



CREATE INDEX "idx_contact_us_messages_user_id" ON "public"."contact_us_messages" USING "btree" ("user_id");



CREATE INDEX "idx_deep_ans_session" ON "public"."deep_onboarding_answers" USING "btree" ("session_uuid");



CREATE INDEX "idx_deep_q_block_sort" ON "public"."deep_onboarding_questions" USING "btree" ("block_index", "sort_order");



CREATE INDEX "idx_deep_sess_client" ON "public"."deep_onboarding_sessions" USING "btree" ("client_session_id");



CREATE INDEX "idx_deep_sess_user" ON "public"."deep_onboarding_sessions" USING "btree" ("user_id");



CREATE INDEX "idx_imported_conversations_owner_user_id" ON "public"."imported_conversations" USING "btree" ("owner_user_id");



CREATE INDEX "idx_imported_conversations_uploaded_at" ON "public"."imported_conversations" USING "btree" ("uploaded_at" DESC);



CREATE INDEX "idx_messages_profile_processed_at" ON "public"."messages" USING "btree" ("profile_processed_at");



CREATE INDEX "idx_question_bank_category" ON "public"."question_bank" USING "btree" ("category");



CREATE INDEX "idx_question_bank_deprecated" ON "public"."question_bank" USING "btree" ("deprecated");



CREATE INDEX "idx_u_aq_question_id" ON "public"."user_asked_questions" USING "btree" ("question_id");



CREATE INDEX "idx_u_aq_user_asked_at" ON "public"."user_asked_questions" USING "btree" ("user_id", "asked_at" DESC);



CREATE INDEX "idx_user_ai_profiles_updated_at" ON "public"."user_ai_profiles" USING "btree" ("summary_updated_at");



CREATE INDEX "idx_user_social_profile_interests_user_id" ON "public"."user_social_profile_interests" USING "btree" ("user_id");



CREATE INDEX "idx_user_verification_requests_user_id_created_at" ON "public"."user_verification_requests" USING "btree" ("user_id", "created_at" DESC);



CREATE INDEX "idx_users_city_country" ON "public"."users" USING "btree" ("city", "country");



CREATE INDEX "idx_users_drinking" ON "public"."users" USING "btree" ("drinking") WHERE ("drinking" IS NOT NULL);



CREATE INDEX "idx_users_has_children" ON "public"."users" USING "btree" ("has_children") WHERE ("has_children" IS NOT NULL);



CREATE INDEX "idx_users_is_bot" ON "public"."users" USING "btree" ("is_bot") WHERE ("is_bot" = true);



CREATE INDEX "idx_users_show_bio_in_feed" ON "public"."users" USING "btree" ("show_bio_in_feed");



CREATE INDEX "idx_users_smoking" ON "public"."users" USING "btree" ("smoking") WHERE ("smoking" IS NOT NULL);



CREATE INDEX "idx_users_wants_children" ON "public"."users" USING "btree" ("wants_children") WHERE ("wants_children" IS NOT NULL);



CREATE INDEX "idx_waitlist_created_at" ON "public"."waitlist_signups" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "interactions_unique" ON "public"."interactions" USING "btree" ("from_user", "to_user");



CREATE INDEX "messages_chat_idx" ON "public"."messages" USING "btree" ("chat_id", "created_at" DESC);



CREATE INDEX "messages_sender_idx" ON "public"."messages" USING "btree" ("sender_id", "created_at" DESC);



CREATE UNIQUE INDEX "uq_owner_path_idx" ON "public"."imported_conversations" USING "btree" ("owner_user_id", "upload_zip_path");



CREATE UNIQUE INDEX "uq_user_social_profile_interests_user_code_lower" ON "public"."user_social_profile_interests" USING "btree" ("user_id", "lower"(TRIM(BOTH FROM "code")));



CREATE UNIQUE INDEX "uq_users_public_profile_code_lower" ON "public"."users" USING "btree" ("lower"(TRIM(BOTH FROM "public_profile_code"))) WHERE (("public_profile_code" IS NOT NULL) AND ("btrim"("public_profile_code") <> ''::"text"));



CREATE UNIQUE INDEX "user_photos_one_main_per_user" ON "public"."user_photos" USING "btree" ("user_id") WHERE ("is_main" = true);



CREATE UNIQUE INDEX "user_photos_user_position_unique" ON "public"."user_photos" USING "btree" ("user_id", "position");



CREATE UNIQUE INDEX "ux_waitlist_email_city" ON "public"."waitlist_signups" USING "btree" ("lower"("email"), "lower"("city"));



CREATE INDEX "waitlist_signups_created_at_idx" ON "public"."waitlist_signups" USING "btree" ("created_at" DESC);



CREATE UNIQUE INDEX "waitlist_signups_email_city_uniq" ON "public"."waitlist_signups" USING "btree" ("lower"("email"), "lower"("city"));



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocked_fkey" FOREIGN KEY ("blocked_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."blocked_users"
    ADD CONSTRAINT "blocked_users_blocker_fkey" FOREIGN KEY ("blocker_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."chat_participants"
    ADD CONSTRAINT "chat_participants_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."contact_us_messages"
    ADD CONSTRAINT "contact_us_messages_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_onboarding_answers"
    ADD CONSTRAINT "deep_onboarding_answers_question_code_fkey" FOREIGN KEY ("question_code") REFERENCES "public"."deep_onboarding_questions"("code") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_onboarding_answers"
    ADD CONSTRAINT "deep_onboarding_answers_session_uuid_fkey" FOREIGN KEY ("session_uuid") REFERENCES "public"."deep_onboarding_sessions"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_onboarding_questions"
    ADD CONSTRAINT "deep_onboarding_questions_block_index_fkey" FOREIGN KEY ("block_index") REFERENCES "public"."deep_onboarding_blocks"("block_index") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."deep_onboarding_sessions"
    ADD CONSTRAINT "deep_onboarding_sessions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE SET NULL;



ALTER TABLE ONLY "public"."external_chat_files"
    ADD CONSTRAINT "external_chat_files_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "auth"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_from_user_fkey" FOREIGN KEY ("from_user") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."interactions"
    ADD CONSTRAINT "interactions_to_user_fkey" FOREIGN KEY ("to_user") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_chat_id_fkey" FOREIGN KEY ("chat_id") REFERENCES "public"."chats"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."messages"
    ADD CONSTRAINT "messages_sender_id_fkey" FOREIGN KEY ("sender_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_ai_profiles"
    ADD CONSTRAINT "user_ai_profiles_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_asked_questions"
    ADD CONSTRAINT "user_asked_questions_question_id_fkey" FOREIGN KEY ("question_id") REFERENCES "public"."question_bank"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_asked_questions"
    ADD CONSTRAINT "user_asked_questions_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_photos"
    ADD CONSTRAINT "user_photos_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_social_profile_interests"
    ADD CONSTRAINT "user_social_profile_interests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



ALTER TABLE ONLY "public"."user_verification_requests"
    ADD CONSTRAINT "user_verification_requests_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "public"."users"("id") ON DELETE CASCADE;



CREATE POLICY "Allow inserts" ON "public"."contact_us_messages" FOR INSERT TO "anon" WITH CHECK (true);



CREATE POLICY "Users can delete own photos" ON "public"."user_photos" FOR DELETE USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert chats" ON "public"."chats" FOR INSERT WITH CHECK (true);



CREATE POLICY "Users can insert messages in their chats" ON "public"."messages" FOR INSERT WITH CHECK ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."chat_id" = "messages"."chat_id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can insert own photos" ON "public"."user_photos" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can insert their own profile" ON "public"."users" FOR INSERT TO "authenticated" WITH CHECK (("auth"."uid"() = "id"));



CREATE POLICY "Users can insert themselves as participants" ON "public"."chat_participants" FOR INSERT WITH CHECK (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can read all profiles" ON "public"."users" FOR SELECT USING (true);



CREATE POLICY "Users can update their own profile" ON "public"."users" FOR UPDATE USING (("auth"."uid"() = "id"));



CREATE POLICY "Users can view chats they participate in" ON "public"."chats" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."chat_id" = "chats"."id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view messages from chats they participate in" ON "public"."messages" FOR SELECT USING ((EXISTS ( SELECT 1
   FROM "public"."chat_participants"
  WHERE (("chat_participants"."chat_id" = "messages"."chat_id") AND ("chat_participants"."user_id" = "auth"."uid"())))));



CREATE POLICY "Users can view own photos" ON "public"."user_photos" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users can view their participant records" ON "public"."chat_participants" FOR SELECT USING (("user_id" = "auth"."uid"()));



CREATE POLICY "Users manage own verification requests" ON "public"."user_verification_requests" USING (("user_id" = "auth"."uid"())) WITH CHECK (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."blocked_users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "blocker_manage" ON "public"."blocked_users" TO "authenticated" USING (("blocker_id" = ( SELECT "auth"."uid"() AS "uid"))) WITH CHECK (("blocker_id" = ( SELECT "auth"."uid"() AS "uid")));



ALTER TABLE "public"."chat_participants" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."chats" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkpoint_blobs" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkpoint_migrations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkpoint_writes" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."checkpoints" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."contact_us_messages" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deep_onboarding_answers" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deep_onboarding_blocks" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deep_onboarding_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."deep_onboarding_sessions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."external_chat_files" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "imported_conv_delete" ON "public"."imported_conversations" FOR DELETE USING (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "imported_conv_insert" ON "public"."imported_conversations" FOR INSERT WITH CHECK (("auth"."uid"() = "owner_user_id"));



CREATE POLICY "imported_conv_select" ON "public"."imported_conversations" FOR SELECT USING (("auth"."uid"() = "owner_user_id"));



ALTER TABLE "public"."imported_conversations" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."interactions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."messages" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "qb_select_active" ON "public"."question_bank" FOR SELECT TO "authenticated", "anon" USING (("deprecated" = false));



ALTER TABLE "public"."question_bank" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "select_own_asked" ON "public"."user_asked_questions" FOR SELECT TO "authenticated" USING (("user_id" = "auth"."uid"()));



ALTER TABLE "public"."user_ai_profiles" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_asked_questions" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_photos" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_social_profile_interests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."user_verification_requests" ENABLE ROW LEVEL SECURITY;


ALTER TABLE "public"."users" ENABLE ROW LEVEL SECURITY;


CREATE POLICY "waitlist_insert_anyone" ON "public"."waitlist_signups" FOR INSERT TO "authenticated", "anon" WITH CHECK ((("length"(TRIM(BOTH FROM "city")) > 0) AND ("length"(TRIM(BOTH FROM "email")) >= 6) AND (POSITION(('@'::"text") IN ("email")) > 1)));



ALTER TABLE "public"."waitlist_signups" ENABLE ROW LEVEL SECURITY;


GRANT USAGE ON SCHEMA "public" TO "postgres";
GRANT USAGE ON SCHEMA "public" TO "anon";
GRANT USAGE ON SCHEMA "public" TO "authenticated";
GRANT USAGE ON SCHEMA "public" TO "service_role";



GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "anon";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "authenticated";
GRANT ALL ON FUNCTION "public"."set_updated_at"() TO "service_role";



GRANT ALL ON TABLE "public"."blocked_users" TO "anon";
GRANT ALL ON TABLE "public"."blocked_users" TO "authenticated";
GRANT ALL ON TABLE "public"."blocked_users" TO "service_role";



GRANT ALL ON TABLE "public"."chat_participants" TO "anon";
GRANT ALL ON TABLE "public"."chat_participants" TO "authenticated";
GRANT ALL ON TABLE "public"."chat_participants" TO "service_role";



GRANT ALL ON TABLE "public"."chats" TO "anon";
GRANT ALL ON TABLE "public"."chats" TO "authenticated";
GRANT ALL ON TABLE "public"."chats" TO "service_role";



GRANT ALL ON TABLE "public"."checkpoint_blobs" TO "anon";
GRANT ALL ON TABLE "public"."checkpoint_blobs" TO "authenticated";
GRANT ALL ON TABLE "public"."checkpoint_blobs" TO "service_role";



GRANT ALL ON TABLE "public"."checkpoint_migrations" TO "anon";
GRANT ALL ON TABLE "public"."checkpoint_migrations" TO "authenticated";
GRANT ALL ON TABLE "public"."checkpoint_migrations" TO "service_role";



GRANT ALL ON TABLE "public"."checkpoint_writes" TO "anon";
GRANT ALL ON TABLE "public"."checkpoint_writes" TO "authenticated";
GRANT ALL ON TABLE "public"."checkpoint_writes" TO "service_role";



GRANT ALL ON TABLE "public"."checkpoints" TO "anon";
GRANT ALL ON TABLE "public"."checkpoints" TO "authenticated";
GRANT ALL ON TABLE "public"."checkpoints" TO "service_role";



GRANT ALL ON TABLE "public"."contact_us_messages" TO "anon";
GRANT ALL ON TABLE "public"."contact_us_messages" TO "authenticated";
GRANT ALL ON TABLE "public"."contact_us_messages" TO "service_role";



GRANT ALL ON TABLE "public"."deep_onboarding_answers" TO "anon";
GRANT ALL ON TABLE "public"."deep_onboarding_answers" TO "authenticated";
GRANT ALL ON TABLE "public"."deep_onboarding_answers" TO "service_role";



GRANT ALL ON TABLE "public"."deep_onboarding_blocks" TO "anon";
GRANT ALL ON TABLE "public"."deep_onboarding_blocks" TO "authenticated";
GRANT ALL ON TABLE "public"."deep_onboarding_blocks" TO "service_role";



GRANT ALL ON TABLE "public"."deep_onboarding_questions" TO "anon";
GRANT ALL ON TABLE "public"."deep_onboarding_questions" TO "authenticated";
GRANT ALL ON TABLE "public"."deep_onboarding_questions" TO "service_role";



GRANT ALL ON TABLE "public"."deep_onboarding_sessions" TO "anon";
GRANT ALL ON TABLE "public"."deep_onboarding_sessions" TO "authenticated";
GRANT ALL ON TABLE "public"."deep_onboarding_sessions" TO "service_role";



GRANT ALL ON TABLE "public"."external_chat_files" TO "anon";
GRANT ALL ON TABLE "public"."external_chat_files" TO "authenticated";
GRANT ALL ON TABLE "public"."external_chat_files" TO "service_role";



GRANT ALL ON TABLE "public"."imported_conversations" TO "anon";
GRANT ALL ON TABLE "public"."imported_conversations" TO "authenticated";
GRANT ALL ON TABLE "public"."imported_conversations" TO "service_role";



GRANT ALL ON TABLE "public"."interactions" TO "anon";
GRANT ALL ON TABLE "public"."interactions" TO "authenticated";
GRANT ALL ON TABLE "public"."interactions" TO "service_role";



GRANT ALL ON TABLE "public"."messages" TO "anon";
GRANT ALL ON TABLE "public"."messages" TO "authenticated";
GRANT ALL ON TABLE "public"."messages" TO "service_role";



GRANT ALL ON TABLE "public"."question_bank" TO "service_role";
GRANT SELECT ON TABLE "public"."question_bank" TO "anon";
GRANT SELECT ON TABLE "public"."question_bank" TO "authenticated";



GRANT ALL ON SEQUENCE "public"."question_bank_id_seq" TO "anon";
GRANT ALL ON SEQUENCE "public"."question_bank_id_seq" TO "authenticated";
GRANT ALL ON SEQUENCE "public"."question_bank_id_seq" TO "service_role";



GRANT ALL ON TABLE "public"."user_ai_profiles" TO "anon";
GRANT ALL ON TABLE "public"."user_ai_profiles" TO "authenticated";
GRANT ALL ON TABLE "public"."user_ai_profiles" TO "service_role";



GRANT ALL ON TABLE "public"."user_asked_questions" TO "service_role";
GRANT SELECT ON TABLE "public"."user_asked_questions" TO "authenticated";



GRANT ALL ON TABLE "public"."user_photos" TO "anon";
GRANT ALL ON TABLE "public"."user_photos" TO "authenticated";
GRANT ALL ON TABLE "public"."user_photos" TO "service_role";



GRANT ALL ON TABLE "public"."user_social_profile_interests" TO "anon";
GRANT ALL ON TABLE "public"."user_social_profile_interests" TO "authenticated";
GRANT ALL ON TABLE "public"."user_social_profile_interests" TO "service_role";



GRANT ALL ON TABLE "public"."user_verification_requests" TO "anon";
GRANT ALL ON TABLE "public"."user_verification_requests" TO "authenticated";
GRANT ALL ON TABLE "public"."user_verification_requests" TO "service_role";



GRANT ALL ON TABLE "public"."users" TO "anon";
GRANT ALL ON TABLE "public"."users" TO "authenticated";
GRANT ALL ON TABLE "public"."users" TO "service_role";



GRANT ALL ON TABLE "public"."users_active" TO "service_role";



GRANT ALL ON TABLE "public"."waitlist_signups" TO "service_role";



ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON SEQUENCES TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON FUNCTIONS TO "service_role";






ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "postgres";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "anon";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "authenticated";
ALTER DEFAULT PRIVILEGES FOR ROLE "postgres" IN SCHEMA "public" GRANT ALL ON TABLES TO "service_role";







