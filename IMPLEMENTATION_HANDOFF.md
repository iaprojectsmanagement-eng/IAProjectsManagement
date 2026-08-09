# Traspaso de implementación — Project Hub

## Estado actual

El sistema puede probarse de extremo a extremo en modo local y ya está conectado al proyecto remoto de Supabase. Las migraciones, tres buckets privados y diez Edge Functions están desplegados. Falta crear el primer usuario monitor y configurar secretos externos para probar OpenAI y Calendar con cuentas reales.

Quedó implementado:

- UI diferenciada para monitor y estudiante, navegación completa y vistas por proyecto.
- Regla exclusiva de un estudiante/un proyecto, reasignación automática, retiro y postulaciones.
- Proyectos, equipos, tareas, incidencias, reuniones, actas, documentos, plantillas, reportes y actividad.
- Persistencia local para demostración y persistencia Supabase con caché, outbox, reintento y Realtime.
- Catálogo seguro para estudiantes sin proyecto, separado de los datos privados.
- Carga privada y extracción de TXT, VTT, PDF con texto y DOCX; almacenamiento privado separado de fuentes, transcripciones y documentos.
- Cuatro plantillas institucionales reales: contexto del proyecto, plan de actividades, acta de reunión y reporte de entregables.
- Cuatro Edge Functions de generación, una de revisión, versiones inmutables y asociación estricta con un único proyecto.
- Generación de PDF visual desde el HTML/CSS institucional, descarga mediante URL firmada, previsualización y revisión sobre el último estado.
- Análisis de transcripciones y generación documental mediante Edge Functions autenticadas, con borrador institucional determinista cuando OpenAI no está configurado.
- Sincronización de reuniones con Calendar, reintento y estados de error/simulación.
- Auditoría persistente sin copiar texto completo de transcripciones ni secretos.
- Pruebas unitarias, contratos de seguridad y recorridos E2E.

## Activación restante con Supabase

1. Revocar la clave OpenAI y la contraseña Supabase compartidas en la conversación.
2. Crear un usuario en Authentication y promover su perfil a `role = 'superuser'`.
3. Guardar una clave OpenAI nueva, con crédito API disponible, directamente como secreto `OPENAI_API_KEY` y definir `OPENAI_MODEL=gpt-5-nano`.
4. Cargar los secretos aprobados para Calendar, cron y webhook.
5. Probar RLS y Storage con cuentas reales de dos proyectos distintos.

## Trabajo que requiere decisión o insumos

- Proyecto y credenciales reales de Supabase.
- Padrón definitivo de estudiantes y proyectos.
- Aprobación final de las cuatro plantillas HTML institucionales, textos fijos, datos de contacto, firmas y campos obligatorios.
- Aprobación de privacidad, retención y tratamiento de transcripciones.
- OAuth de Google Calendar por usuario o decisión formal de usar una cuenta compartida.
- Proveedor y reglas de envío de recordatorios.
- Decisión sobre borrado lógico, permisos finales y retención de auditoría.
- Piloto con usuarios reales, accesibilidad y dispositivos físicos.

La lista exhaustiva y actualizada está al final de `DESARROLLO A REALIZAR.md`.

## Validación técnica realizada

```text
npm.cmd run typecheck  ✓
npm.cmd test           ✓  28 pruebas / 5 archivos
npm.cmd run test:e2e   ✓  4 recorridos Chromium
npm.cmd run build      ✓
npm.cmd run test:all   ✓
npm audit              ✓  0 vulnerabilidades reportadas tras la corrección
```

Las migraciones y funciones fueron desplegadas sobre una instancia real vacía. El PDF del acta se generó en navegador y se inspeccionó página por página: dos páginas, logo correcto, tablas legibles y títulos sin cortes. Antes de producción todavía deben probarse OpenAI, RLS y Storage con usuarios reales de roles distintos y datos representativos.

Para revisar la interfaz sin Supabase se puede ejecutar `npm.cmd run dev:demo`. El comando normal `npm.cmd run dev` conserva la conexión remota.
