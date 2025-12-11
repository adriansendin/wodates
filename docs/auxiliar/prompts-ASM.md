# prompts-ASM.md

> Detalla en esta sección los prompts principales utilizados durante la creación del proyecto, que justifiquen el uso de asistentes de código en todas las fases del ciclo de vida del desarrollo. Máximo 3 por sección. (Puedes adjuntar la conversación completa como enlace o archivo si lo consideras.)

## Índice
- Descripción general del producto  
- Arquitectura del sistema  
- Modelo de datos  
- Especificación de la API  
- Historias de usuario  
- Tickets de trabajo  
- Pull requests

---

## 1. Descripción general del producto
**Prompt 1**  
*“Resume Wodates (app de citas para deportistas) en una descripción de producto clara y orientada a valor: público objetivo, problema, propuesta y funcionalidades MVP.”*  
**Resultado**: Texto base de visión de producto y lista de features MVP (registro, feed tipo swipe, match, chat, perfil con avatar).

**Prompt 2**  
*“Genera un mapa de funcionalidades para un MVP de citas: onboarding por pasos, validaciones de edad 18–99, preferencia de género y subida de avatar.”*  
**Resultado**: Checklist funcional para el stepper y criterios de aceptación (bloqueo por edad inválida, campos mínimos de perfil).

**Prompt 3**  
*“Redacta copia UX breve para pantallas de registro, feed, match y chat.”*  
**Resultado**: Microcopy en español coherente para botones/estados vacíos y mensajes de error.

---

## 2. Arquitectura del Sistema
### 2.1. Diagrama de arquitectura
**Prompt 1**  
*“Propón diagrama de alto nivel (Clean Architecture) con Mobile (Expo) ↔ Fastify API ↔ Supabase (Auth/DB/Storage).”*  
**Resultado**: Diagrama y descripción por capas (app/data/domain) y dependencias.

**Prompt 2**  
*“Enumera pros/contras de Clean Architecture en un MVP y justifica su elección.”*  
**Resultado**: Sección de beneficios (mantenibilidad, testabilidad) y trade-offs.

**Prompt 3**  
*“Define contratos (interfaces) entre dominio y data para Users, Feed, Matches y Messages.”*  
**Resultado**: Interfaces de repositorio y casos de uso.

### 2.2. Descripción de componentes principales
**Prompt 1**  
*“Detalla componentes del backend (Fastify+TS+Zod): rutas, middlewares, swagger, rate-limit, CORS.”*  
**Resultado**: Esqueleto de servidor y políticas transversales.

**Prompt 2**  
*“Describe app móvil (Expo Router + Zustand): stores, servicios API y flujo de navegación.”*  
**Resultado**: Estructura base de navegación y stores.

**Prompt 3**  
*“Explica integración con Supabase: Auth, Postgres y Storage (bucket avatars).”*  
**Resultado**: Decisiones de seguridad (RLS en Storage) y mapeo de URLs públicas.

### 2.3. Descripción de alto nivel y estructura de ficheros
**Prompt 1**  
*“Propón estructura monorepo con /mobile-app y /backend-api siguiendo app/data/domain.”*  
**Resultado**: Árbol de directorios y convenciones de nombrado.

**Prompt 2**  
*“Incluye scripts npm típicos (dev, build, start) y .env.example por paquete.”*  
**Resultado**: Scripts mínimos y plantillas de entorno.

**Prompt 3**  
*“Especifica dónde viven docs (README, API, SQL, cambios).”*  
**Resultado**: Carpeta /docs con subguías.

### 2.4. Infraestructura y despliegue
**Prompt 1**  
*“Recomienda despliegue simple: API Node en servicio gestionado y builds móviles con Expo (EAS).”*  
**Resultado**: Pasos de build y variables a configurar en producción.

**Prompt 2**  
*“Dibuja diagrama de infraestructura con cliente móvil, API y Supabase.”*  
**Resultado**: Diagrama de topología con flujos (HTTPS, Storage).

**Prompt 3**  
*“Lista riesgos y mitigaciones (latencia, cuotas, claves, CORS).”*  
**Resultado**: Checklist de hardening inicial.

### 2.5. Seguridad
**Prompt 1**  
*“Define RLS en public.users (select all, update/insert own) y en Storage (avatars por carpeta uid).”*  
**Resultado**: SQL de políticas y notas de activación de RLS.

**Prompt 2**  
*“Establece JWT en backend y cabecera Authorization en cliente.”*  
**Resultado**: Middleware de verificación y flujo de refresco opcional.

**Prompt 3**  
*“Buenas prácticas: validación Zod, rate limit, CORS estricto y manejo de errores.”*  
**Resultado**: Plantillas de esquemas y respuestas 4xx/5xx.

### 2.6. Tests
**Prompt 1**  
*“Plan de tests para casos de uso: LikeUser, SendMessage con repos fakes.”*  
**Resultado**: Batería de unit tests y escenarios de error.

**Prompt 2**  
*“Guía de pruebas manuales de integración (registro→like→match→chat).”*  
**Resultado**: Lista paso a paso para verificación local.

**Prompt 3**  
*“Sugerencias E2E móvil (Detox) y cobertura mínima.”*  
**Resultado**: Backlog de QA futuro.

---

## 3. Modelo de Datos
**Prompt 1**  
*“Diseña ER para users, interactions (like/pass), chats, chat_participants y messages.”*  
**Resultado**: Diagrama + claves FK y restricciones únicas en interactions.

**Prompt 2**  
*“Alinea public.users con auth.users (id compartido) y evita duplicar email/name.”*  
**Resultado**: Estrategia de combinar datos de Auth en respuestas de perfil.

**Prompt 3**  
*“Define enums (gender, looking_for) y validaciones de edad 18–99.”*  
**Resultado**: Tipos y checks en DB + validación en app.

---

## 4. Especificación de la API
**Prompt 1**  
*“Genera OpenAPI de 3 endpoints clave: POST /auth/register, GET /feed, POST /chats/{id}/messages (con ejemplos).”*  
**Resultado**: Esquemas y ejemplos de request/response para documentación.

**Prompt 2**  
*“Integra @fastify/swagger con Zod y expón /documentation.”*  
**Resultado**: Swagger UI habilitado en desarrollo.

**Prompt 3**  
*“Diseña paginación y filtros mínimos para feed y mensajes.”*  
**Resultado**: Parámetros limit/offset y before/limit.

---

## 5. Historias de Usuario
**Prompt 1**  
*“Redacta historias: registro con foto, swipe con like/pass, chat tras match (formato Como/Quiero/Para).”*  
**Resultado**: Tres historias base para priorizar desarrollo.

**Prompt 2**  
*“Deriva criterios de aceptación y estados vacíos/errores para cada historia.”*  
**Resultado**: Casuística de validaciones y UX.

**Prompt 3**  
*“Define métricas simples (activación, %con foto, ratio match).”*  
**Resultado**: Indicadores para evaluar MVP.

---

## 6. Tickets de Trabajo
**Prompt 1 (Backend)**  
*“Implementa mensajería 1:1 tras match: modelo, casos de uso, endpoints y paginación.”*  
**Resultado**: Tablas chats/messages, casos SendMessage/GetMessages y rutas REST.

**Prompt 2 (Frontend)**  
*“Subida de avatar en Expo: picker/cámara, compresión <500KB, subida a Supabase y actualización de perfil.”*  
**Resultado**: Paso de avatar en onboarding y cambio desde Perfil.

**Prompt 3 (DB)**  
*“Migración: mover name/email a auth.users y combinar perfil público con datos de Auth.”*  
**Resultado**: Migración SQL y ajustes de servicios de usuario.

---

## 7. Pull Requests
**Prompt 1**  
*“Redacta el resumen técnico de la PR inicial (estructura monorepo + MVP) con alcance y decisiones.”*  
**Resultado**: Descripción de componentes y lista de cambios clave.

**Prompt 2**  
*“Resume la PR de subida de avatar: dependencias nuevas, política de Storage y cambios en UI.”*  
**Resultado**: Changelog de feature y guía rápida de configuración.

**Prompt 3**  
*“Documenta la PR de refactor de modelo (name/email a Auth): migraciones, servicios y performance.”*  
**Resultado**: Riesgos, verificación post-migración y tareas de seguimiento.

---

> **Nota**: Este documento contiene prompts condensados y su resultado aplicado. Para el historial completo de conversaciones, adjuntar enlace/archivo aparte si se requiere por la evaluación.

