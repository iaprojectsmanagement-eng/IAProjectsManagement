# Guía de despliegue y pendientes manuales

Esta es la lista canónica para publicar IA Projects Management. No escriba valores secretos en el repositorio, en `render.yaml` ni en variables cuyo nombre comience por `VITE_`.

## 1. Seguridad urgente: rotar credenciales expuestas

Antes de invitar usuarios reales:

1. Entre a <https://platform.openai.com/api-keys>, elimine la clave que se compartió durante el desarrollo y cree una nueva clave exclusiva para este proyecto.
2. En OpenAI, configure facturación o créditos API y límites de uso. Una cuenta o clave creada sin saldo no garantiza que la API acepte solicitudes.
3. En Supabase, abra **Project Settings → Database** y restablezca la contraseña de la base de datos que se compartió durante el desarrollo.
4. No reutilice ninguna de esas dos credenciales. La contraseña de Postgres no se necesita en Render porque el frontend consume Supabase mediante su API y RLS.

## 2. Configurar secretos de las Edge Functions en Supabase

Proyecto actual: `avekyenkvrphkjijocyx`.

Abra **Supabase Dashboard → Edge Functions → Secrets** y configure:

| Variable | Obligatoria | Valor/propósito |
| --- | --- | --- |
| `OPENAI_API_KEY` | Sí, para IA | La clave nueva y rotada de OpenAI. |
| `OPENAI_MODEL` | Recomendado | `gpt-5-nano` para contener costo y latencia durante el piloto. |
| `CRON_SECRET` | Para recordatorios programados | Cadena aleatoria larga que autentica la función de cron. |
| `FOLLOW_UP_WEBHOOK_URL` | Solo si habrá canal externo | URL del webhook que recibirá recordatorios. |
| `GOOGLE_CALENDAR_ACCESS_TOKEN` | Temporal | Token de Google Calendar usado por la integración compartida actual. |

Supabase suministra automáticamente sus secretos internos de URL y service role a las Edge Functions. No los copie a Render ni al navegador.

Para comprobar la IA con bajo consumo, genere primero un acta corta de una sola página y revise **Edge Functions → Logs** y la tabla `ai_usage_log` antes de probar documentos extensos.

## 3. Crear el sitio en Render con el Blueprint

1. Entre a <https://dashboard.render.com/> con una cuenta que tenga acceso a GitHub.
2. Elija **New → Blueprint**.
3. Conecte GitHub y seleccione `iaprojectsmanagement-eng/IAProjectsManagement`.
4. Render detectará el `render.yaml` de la raíz y propondrá el servicio estático `ia-projects-management`.
5. Cuando Render solicite variables con `sync: false`, agregue:

| Variable de Render | Valor |
| --- | --- |
| `VITE_SUPABASE_URL` | `https://avekyenkvrphkjijocyx.supabase.co` |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | La clave **Publishable** (`sb_publishable_...`) de **Supabase → Project Settings → API Keys**. |

6. Confirme el Blueprint y espere el primer despliegue.
7. Verifique en el log que se ejecuten `npm ci` y `npm run build`, y que Render publique `dist`.

No agregue a Render `OPENAI_API_KEY`, la contraseña de Postgres, `service_role`, una secret key de Supabase ni una cadena de conexión. Las variables `VITE_*` quedan incorporadas al JavaScript que descarga el navegador. La clave publicable sí está diseñada para ese uso y su autorización depende de RLS.

El Blueprint fija modo Supabase, desactiva el cambio de rol/demo, usa Node 24.14.1, publica como sitio estático, conserva rutas de SPA mediante reescritura a `/index.html` y despliega automáticamente cada commit de `main`.

## 4. Registrar la URL pública en Supabase Auth

Cuando Render entregue una URL como `https://ia-projects-management.onrender.com`:

1. Abra **Supabase → Authentication → URL Configuration**.
2. Cambie **Site URL** por la URL HTTPS exacta de producción.
3. Agregue esa misma URL exacta a **Redirect URLs**. Si después se implementan recuperación de contraseña u OAuth, agregue también las rutas exactas que esos flujos utilicen.
4. Mantenga las URLs locales solo para desarrollo. En producción es preferible registrar rutas exactas y no comodines amplios.

Aunque el acceso actual es correo/contraseña, esto evita redirecciones a localhost en futuros correos de recuperación, invitaciones u OAuth.

## 5. Endurecer autenticación antes del uso real

Los usuarios iniciales se cargaron con su código institucional como contraseña. Eso sirve para la puesta en marcha, pero es una contraseña predecible.

1. Defina un procedimiento de cambio obligatorio de contraseña en el primer acceso. La aplicación todavía no fuerza ese cambio.
2. En **Supabase → Authentication → Providers → Email**, deshabilite el registro público si solo el administrador creará usuarios.
3. Configure una longitud mínima fuerte y requisitos de caracteres.
4. Si el plan de Supabase lo permite, active **Authentication → Attack Protection → Leaked password protection**.
5. Considere MFA para monitores y profesores.
6. Defina una contraseña inicial válida para Milton Orlando Sarria Paja: su código figura como `N/A` y no fue posible aprovisionarlo con la regla “contraseña = código”.

Estado actual verificado: 50 cuentas confirmadas, 48 estudiantes y 2 superusuarios (José Ordoñez y William Verdesoto). Los estudiantes están inicialmente sin proyecto para que el monitor los asigne desde la interfaz.

## 6. Validación posterior al despliegue

Ejecute estas pruebas con datos ficticios antes de cargar información real:

- Inicie sesión con un superusuario y con un estudiante.
- Cree dos proyectos y asigne un estudiante al primero; después muévalo al segundo y confirme que desaparece automáticamente del primero.
- Confirme que el estudiante solo ve y modifica su proyecto, sin selector global para actas, tareas, incidentes ni documentos.
- Reporte un incidente, cree una tarea y registre/cancele/marque como no realizada una reunión.
- Genere los cuatro tipos de documento; para el acta, cargue un TXT corto.
- Previsualice el PDF, descárguelo, solicite una revisión a la IA y confirme que se conserva el historial de versiones.
- Intente acceder a un proyecto y archivo ajenos; RLS y Storage deben rechazarlo.
- Revise **Supabase → Edge Functions → Logs**, `ai_usage_log` y los errores del navegador.
- Revise que la acción de GitHub **Verificación continua** quede en verde.

## 7. Decisiones que aún requieren aprobación humana

### Plantillas y documentos

- Aprobar visualmente las cuatro plantillas HTML/CSS y sus datos institucionales fijos.
- Definir campos obligatorios y reglas de aprobación documental.
- Probar contenido extremo: textos largos, caracteres especiales, enlaces, tablas grandes y varias páginas.
- Decidir si el DOCX debe replicar por completo el diseño del PDF; hoy es una exportación estructurada más simple.
- Aprobar consentimiento, retención y eliminación de transcripciones, fuentes, versiones, PDFs y auditoría.

### Google Calendar

La integración actual usa un `GOOGLE_CALENDAR_ACCESS_TOKEN` compartido y temporal. Para producción sostenida debe elegirse una de estas opciones:

- OAuth por usuario, recomendado si cada estudiante/monitor administrará su propio calendario.
- Una cuenta institucional compartida, solo si la institución aprueba propiedad, renovación del token y permisos.

Después hay que probar crear, actualizar, cancelar, reprogramar y marcar reuniones como no realizadas. No declare Calendar listo para operación continua mientras dependa de un access token manual de corta duración.

### Operación

- Aprobar presupuesto y límites mensuales de OpenAI.
- Configurar backup/restauración, alertas y responsables de soporte en Supabase.
- Revisar periódicamente los asesores de seguridad y rendimiento de Supabase. Los avisos actuales sobre funciones `SECURITY DEFINER` fueron revisados: las RPC validan usuario, rol o acceso al proyecto y son necesarias para el flujo; no se deben revocar a ciegas.
- Hacer un piloto con un monitor y al menos dos equipos.
- Probar accesibilidad con teclado/lector de pantalla y teléfonos reales de 320 a 430 px.

## 8. Actualizaciones futuras

Cada push a `main` inicia GitHub Actions y, una vez conectado el Blueprint, un despliegue automático en Render. Si cambia una variable `VITE_*`, fuerce un nuevo deploy porque Vite la incorpora durante el build.

Si se modifica el esquema o una Edge Function, Render no aplica ese backend. Debe desplegarse a Supabase con la CLI enlazada al proyecto y después ejecutar las mismas pruebas funcionales. Nunca incluya contraseñas o claves en los comandos guardados, scripts o documentación.
