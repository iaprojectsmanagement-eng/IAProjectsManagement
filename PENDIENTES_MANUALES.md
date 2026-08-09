# Pendientes manuales antes de producción

La lista actualizada y las instrucciones paso a paso están en [GUIA_DESPLIEGUE_RENDER.md](GUIA_DESPLIEGUE_RENDER.md).

Prioridades bloqueantes:

1. Revocar la clave de OpenAI y rotar la contraseña de base de datos que se compartieron durante el desarrollo.
2. Guardar la nueva `OPENAI_API_KEY` únicamente en Supabase Edge Function Secrets y habilitar saldo/límites API.
3. Crear el Blueprint de Render y proporcionar únicamente la URL y la clave publicable de Supabase.
4. Registrar la URL final de Render en Supabase Auth.
5. Sustituir las contraseñas iniciales predecibles, resolver la cuenta sin código y probar los flujos con usuarios reales.
6. Aprobar plantillas, privacidad/retención y la estrategia definitiva de Google Calendar.

El repositorio no contiene valores secretos y el modo demo queda deshabilitado por la configuración de producción.
