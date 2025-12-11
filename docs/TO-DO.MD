# Índice de tareas pendientes

1. Mejora del motor de embeddings
2. Adaptación del job de procesamiento de perfiles según plataforma de despliegue
3. Integración de procesamiento de chats externos en el job de perfiles
4. Añadir análisis psicológico implícito a los perfiles de usuario
5. Verificación de identidad con cámara directa

---

## 1. Mejora del motor de embeddings

Contexto: Actualmente usamos multilingual-e5-base(de Ollama) para generar vectores de perfiles en Wodates (suficiente para el MVP).
Acción futura: Evaluar Alibaba GTE-multilingual-base (de Hugging Face) como encoder principal.
Motivo: Mayor calidad semántica → mejor matching entre usuarios.
Issue: #embedding-upgrade

## 2. Adaptación del job de procesamiento de perfiles según plataforma de despliegue

Contexto: El job process-user-profiles-job.ts actualmente está diseñado para ejecutarse vía cron del sistema. Necesita adaptarse según la plataforma donde se despliegue (AWS Lambda, Google Cloud Functions, Railway, Vercel, Azure, Heroku, etc.).
Acción futura: Implementar adaptadores/entry points específicos para cada plataforma:
- AWS Lambda: EventBridge (CloudWatch Events) para scheduling
- Google Cloud: Cloud Scheduler con Cloud Functions o Cloud Run
- Railway: Railway Cron Jobs o scheduled tasks
- Vercel: Vercel Cron Jobs (vercel.json configuration)
- Azure: Azure Functions con Timer Triggers
- Heroku: Heroku Scheduler add-on
Motivo: Cada plataforma tiene su propio mecanismo de scheduling y entry points. La lógica core debe mantenerse, pero el punto de entrada y el mecanismo de scheduling deben adaptarse.
Issue: #deployment-platform-adaptation

3. Integración de procesamiento de chats externos en el job de perfiles

Contexto: Actualmente existe un job (process-user-profiles-job.ts) que procesa mensajes de Buddy para generar perfiles de usuarios, y un script separado (extract-chat-from-zip.ts) que procesa archivos ZIP externos para extraer chats. Estos dos procesos están desconectados y se ejecutan de forma independiente.
Acción futura: Refactorizar la lógica de extract-chat-from-zip.ts en una función reutilizable y integrarla en process-user-profiles-job.ts. El job debe procesar tanto los mensajes de Buddy como los chats extraídos de los ZIPs externos en una sola ejecución. La función debe poder ser llamada tanto desde el script standalone (para uso manual) como desde el job (para ejecución automatizada).
Motivo: Unificar el procesamiento de todas las fuentes de datos de chat (Buddy + ZIPs externos) en un solo job mejora la eficiencia, reduce la duplicación de código (DRY), facilita el mantenimiento y asegura que todos los chats se procesen de forma consistente y coordinada.
Issue: #integrate-external-chats-job

## 3. Integración de procesamiento de chats externos en el job de perfiles

Aquí tienes **el informe claro, directo y sin verbosidad**, para que lo entiendas como si fuera la primera vez.

---

# 📌 1. CONTEXTO DEL PROBLEMA

Tu app tiene dos fuentes de información sobre cada usuario:

* **Chats reales** con otras personas.
* **Chats con DocLove**, donde el usuario responde preguntas personales.

Tu sistema actual:

1. Pasas toda la conversación a **Gemma 3:4B**.
2. Usando un **prompt estricto**, generas una **ficha limpia** con datos explícitos (gustos, actividades, etc.).
3. Esa ficha la conviertes en **embedding** usando `E5-multilingual`.
4. Luego comparas vectores entre usuarios para encontrar afinidades.

Problema detectado:

* **El perfil solo contiene lo explícitamente dicho**.
* **Gemma no puede inferir personalidad** (porque con tu prompt se lo prohíbes, y además no es buena en eso).
* Te falta la **capa psicológica implícita**, que sí se revela en cómo escribe y cómo habla la persona.

---

# 📌 2. SOLUCIÓN PROPUESTA

Añadir **una segunda capa de análisis** usando modelos pequeños especializados en **personalidad**, que extraen rasgos psicológicos reales desde la conversación cruda, no desde la ficha.

👉 Luego fusionas:

* tu ficha limpia (Gemma)
* * la personalidad oculta (modelo Big Five)
* * opcionalmente emociones/estilo social (otro modelo pequeño)

👉 Y SOLO DESPUÉS generas **un único texto final** y le haces el embedding.

Así tu vector final refleja:

* lo que el usuario dice explícitamente
* cómo se expresa
* su personalidad implícita
* su tono emocional
* su estilo social

Esto mejora mucho la afinidad y es barato de ejecutar.

---

# 📌 3. ESQUEMA DEL PIPELINE ÓPTIMO

```
(1) Recoger chats reales del usuario
(2) Recoger chats user ↔ DocLove

(3) Procesado explícito
    → Gemma 3:4B
    → Ficha limpia de 11 secciones

(4) Procesado implícito (psicológico)
    → Modelo Big Five (ligero)
    → Rasgos de personalidad (0–1)

(5) Procesado de estilo / emoción (opcional)
    → pysentimiento (sentiment + emotion)

(6) Fusionar datos en TEXTO PLANO
    → ficha explícita (Gemma)
    → descripción psicológica
    → estilo emocional

(7) Embedding final
    → `yxchia/multilingual-e5-base`

(8) Matching
    → similitud entre vectores
```

**Regla clave:** siempre haces el embedding desde **texto natural**, nunca desde JSON.

---

# 📌 4. MODELOS DISPONIBLES

Todos son **locales, descargables y ligeros**.

### A) Modelos Big Five en español (personalidad)

* `jorge-pramos/xlm-roberta-bigfive-es` (≈ 280M)
* `pysentimiento/robertuito-bigfive` (≈ 125M)

### B) Modelos de estilo emocional (opcional)

* `pysentimiento/robertuito-sentiment-analysis` (≈125M)

### C) Tu modelo actual para ficha explícita

* **Gemma 3:4B**

### D) Tu modelo actual para embeddings

* `yxchia/multilingual-e5-base` (≈560M)

---

# 📌 5. ¿CUÁL ES EL MEJOR PARA TU CASO?

Pensando en:

* MVP
* coste mínimo
* velocidad
* todo local
* fiable
* español
* y compatible con tu pipeline

El MEJOR modelo es:

### ⭐ **pysentimiento/robertuito-bigfive**

* muy ligero
* rápido
* entrenado en español
* suficiente precisión para inferir rasgos
* perfecto para MVP y escalable
* no te dispara RAM ni VRAM

Y si quieres algo un poco más fino:

### ⭐⭐ **jorge-pramos/xlm-roberta-bigfive-es**

* más grande
* un poco más preciso
* sigue siendo barato
* ideal para cuando tengas más tráfico

---

# 📌 6. RESUMEN FINAL (tu frase para recordar)

**Tu ficha con Gemma describe lo explícito.
Los modelos Big Five describen lo implícito.
Fusionas ambos en un solo texto y haces el embedding.
Esto da el vector más completo y barato para un MVP.**

---

Si quieres, te genero **el texto final consolidado**, para que sepas EXACTAMENTE qué debes meter a `E5-multilingual`.


## 5. Verificación de identidad con cámara directa

Contexto:
La verificación actual del usuario en Wodates no existe como flujo dedicado. En iPhone + Chrome no es posible abrir la cámara directamente porque el navegador obliga a mostrar el selector del sistema. En iPhone + Safari o como PWA sí es posible, y en app nativa con Expo funciona sin limitaciones.

Acción futura:
Añadir en la pantalla de perfil (profile.tsx) un botón “Verificar cuenta” que abra la cámara frontal directamente. Implementar el endpoint backend /users/me/verify para recibir la foto y almacenarla en Supabase (bucket verification_photos/). Añadir validaciones de formato y tamaño.

Motivo:
Reducir cuentas falsas y aumentar la confianza. La verificación biométrica con selfie aumenta la calidad del matching y la percepción de seguridad dentro de la app.

Limitación técnica importante:
Chrome en iOS no permite apertura directa de cámara. El flujo correcto es:

Detectar navegador → si es Chrome iOS, mostrar mensaje para usar Safari.

Permitir cámara directa solo en Safari, PWA o app nativa.

Tareas técnicas:

Añadir botón UI en profile.tsx.

Implementar handleVerifyAccount() usando takePictureWithCamera().

Crear endpoint backend /users/me/verify.

Subida segura del archivo a Supabase.

Guardar referencia en users.verification_status (pending, verified, rejected).

Añadir job para análisis automático (o revisión manual en dashboard interno).

Issue: #account-verification