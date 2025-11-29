1. Mejora del motor de embeddings

Contexto: Actualmente usamos multilingual-e5-base(de Ollama) para generar vectores de perfiles en Wodates (suficiente para el MVP).
Acción futura: Evaluar Alibaba GTE-multilingual-base (de Hugging Face) como encoder principal.
Motivo: Mayor calidad semántica → mejor matching entre usuarios.
Issue: #embedding-upgrade

2. Adaptación del job de procesamiento de perfiles según plataforma de despliegue

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