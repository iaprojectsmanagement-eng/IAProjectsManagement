import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const read = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('Supabase deployment contracts', () => {
  it('requires a real user and project access before transcript analysis', () => {
    const source = read('supabase/functions/analyze-transcript/index.ts');
    expect(source).toContain('supabase.auth.getUser()');
    expect(source).toContain('can_access_project');
    expect(source).toContain('rawText.length > 50_000');
    expect(source).toContain('requestOpenAIJson');
    expect(source).toContain('maxOutputTokens: 1400');
    expect(source).not.toContain('gemini-1.5-flash');
  });

  it('authenticates document and calendar functions and handles external failures', () => {
    const documents = read('supabase/functions/generate-document/index.ts');
    const calendar = read('supabase/functions/sync-google-calendar/index.ts');
    expect(documents).toContain('supabase.auth.getUser()');
    expect(documents).toContain('sanitizeGeneratedHtml');
    expect(documents).toContain('folder_name');
    expect(calendar).toContain('supabase.auth.getUser()');
    expect(calendar).toContain('calendar_sync_status: "error"');
    expect(calendar).toContain('timeZone');
    expect(calendar).toContain('IA proyecto "${meeting.projects?.title || "Proyecto"}" - ${meeting.title}');
  });

  it('protects scheduled follow-up with a dedicated secret', () => {
    expect(read('supabase/functions/weekly-follow-up/index.ts')).toContain('x-cron-secret');
    expect(read('supabase/functions/weekly-reminder-cron/index.ts')).toContain('x-cron-secret');
  });

  it('keeps project membership exclusive and removes the global read policy', () => {
    const sql = read('supabase/migrations/20260808_production_hardening.sql');
    expect(sql).toContain('DROP COLUMN IF EXISTS allow_multiple_projects');
    expect(sql).toContain('assign_student_to_project');
    expect(sql).toContain('one_minute_per_meeting');
    expect(sql).toContain('DROP POLICY IF EXISTS authenticated_read_projects');
    expect(sql).not.toMatch(/CREATE POLICY authenticated_read_projects[\s\S]*USING \(true\)/);
  });

  it('defines private buckets and audit RLS', () => {
    const sql = read('supabase/migrations/20260809_storage_and_audit.sql');
    expect(sql).toContain("'project-transcripts', 'project-transcripts', false");
    expect(sql).toContain("'project-documents', 'project-documents', false");
    expect(sql).toContain('ALTER TABLE public.audit_log ENABLE ROW LEVEL SECURITY');
    expect(sql).toContain('public.can_access_project((storage.foldername(name))[1]::uuid)');
  });

  it('limits link changes to an authorized project and lets a team resolve its own issues', () => {
    const sql = read('supabase/migrations/20260817_project_collaboration_controls.sql');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.set_project_links');
    expect(sql).toContain("RAISE EXCEPTION 'PROJECT_ACCESS_DENIED'");
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.set_project_links');
    expect(sql).toContain('CREATE POLICY issues_update_project');
    expect(sql).toContain('ISSUE_IDENTITY_IMMUTABLE');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.assign_student_to_project');
    expect(sql).not.toContain('assigned_count >= target_project.max_students');
  });

  it('limits AI requests without retaining prompt content', () => {
    const sql = read('supabase/migrations/20260810_ai_usage_limits.sql');
    const helper = read('supabase/functions/_shared/openai.ts');
    expect(sql).toContain("interval '1 minute'");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain('claim_ai_request');
    expect(sql).not.toContain('raw_text TEXT');
    expect(sql).not.toContain('prompt TEXT');
    expect(helper).toContain('store: false');
    expect(helper).toContain('OPENAI_MODEL = "gpt-5.6-luna"');
    expect(helper).toContain('reasoning: { effort: "medium" }');
    expect(helper).toContain('REQUEST_TIMEOUT_MS');
    expect(helper).toContain('OPENAI_REFUSAL');
    expect(helper).toContain('OPENAI_INVALID_STRUCTURED_OUTPUT');
  });

  it('enforces the confirmed AI windows and records private management incidents', () => {
    const sql = read('supabase/migrations/20260817_ai_limit_incidents_and_retention.sql');
    const helper = read('supabase/functions/_shared/openai.ts');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.ai_limit_incidents');
    expect(sql).toContain('ai_limit_incidents_read_management');
    expect(sql).toContain('used_calls >= 3');
    expect(sql).toContain('used_calls >= 10');
    expect(sql).toContain('used_calls >= 20');
    expect(sql).toContain('pg_advisory_xact_lock');
    expect(sql).toContain("bucket_id IN ('project-transcripts', 'project-source-files')");
    expect(helper).toContain('Límite de 3 llamadas por minuto excedido');
    expect(helper).toContain('AI_QUOTA_${result.quota.toUpperCase()}');
  });

  it('enforces password-login limits on the server without exposing account existence', () => {
    const config = read('supabase/config.toml');
    const auth = read('src/context/AuthContext.tsx');
    const sql = read('supabase/migrations/20260819_server_login_ip_rate_limit.sql');
    const login = read('supabase/functions/password-sign-in/index.ts');
    const sync = read('src/services/syncService.ts');
    expect(config).toContain('enable_signup = false');
    expect(config).toContain('sign_in_sign_ups = 10');
    expect(auth).toContain("functions.invoke('password-sign-in'");
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.login_ip_rate_limits');
    expect(sql).toContain("interval '5 minutes'");
    expect(sql).toContain('current_limit.attempts >= 10');
    expect(sql).toContain('FROM PUBLIC, anon, authenticated');
    expect(sql).toContain('GRANT EXECUTE ON FUNCTION public.claim_password_login_attempt(TEXT) TO service_role');
    expect(login).toContain('hashIp(getIp(request), serviceRoleKey)');
    expect(login).toContain('return json({ error: "Credenciales no válidas." }, 401)');
    expect(login).toContain('}, 429)');
    expect(sync).toContain('MIN_BOOTSTRAP_INTERVAL_MS');
    expect(sync).toContain('bootstrapPromise');
  });

  it('binds every institutional template to its own generation function', () => {
    const functions = [
      ['generate-contexto-proyecto', 'contexto_proyecto', '00365211c7d1c5d0afb9b2d0cd34cedec7d14cf8941103cd551f83b7ec91e328'],
      ['generate-plan-actividades', 'plan_actividades', 'b1667448c4d61b2ff61fcc8d66e56d6483dcf3109e8cc6ebf8a028b1a2a65ab0'],
      ['generate-acta-reunion', 'acta_reunion', '11f84c664a44d6f4a1f05b7eab5db529594fc931e0953ab00444bb1a0b5e5f2f'],
      ['generate-reporte-entregables', 'reporte_entregables', 'c6df020f459e3f4eb65a605f72859569bb81ba338f9c88203ac5cafee16376d8'],
    ];
    for (const [folder, type, hash] of functions) {
      const source = read(`supabase/functions/${folder}/index.ts`);
      expect(source).toContain('handleDocumentGeneration');
      expect(source).toContain(`documentType: '${type}'`);
      expect(source).toContain(hash);
    }
  });

  it('treats sources as untrusted, strips embedded assets from prompts and persists atomically', () => {
    const workflow = read('supabase/functions/_shared/document-workflow.ts');
    expect(workflow).toContain('datos no confiables');
    expect(workflow).toContain('detachEmbeddedImages');
    expect(workflow).toContain('base64');
    expect(workflow).toContain('maxOutputTokens: 12_000');
    expect(workflow).toContain("supabase.rpc('create_generated_document'");
    expect(workflow).toContain("supabase.rpc('save_document_revision'");
    expect(workflow).toContain('currentHtml: detached.promptHtml');
    expect(workflow).toContain('SOURCE_FILE_PROJECT_MISMATCH');
    expect(workflow).toContain('validateSourceFiles(body.sourceFiles || [], projectId)');
    expect(workflow).toContain('validateGeneratedDocument');
  });

  it('versions documents and protects source/PDF storage with project RLS', () => {
    const sql = read('supabase/migrations/20260812_institutional_document_workflow.sql');
    expect(sql).toContain('CREATE TABLE IF NOT EXISTS public.project_document_versions');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.create_generated_document');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.save_document_revision');
    expect(sql).toContain('CREATE OR REPLACE FUNCTION public.attach_document_pdf');
    expect(sql).toContain("'project-source-files', 'project-source-files', false");
    expect(sql).toContain("bucket_id IN ('project-transcripts', 'project-documents', 'project-source-files')");
    expect(sql).toContain('REVOKE ALL ON public.project_document_versions FROM anon');
  });

  it('allows authorized team members to delete mistaken project documents only', () => {
    const sql = read('supabase/migrations/20260818_document_deletion_and_acta_template.sql');
    const workflow = read('src/services/documentWorkflowService.ts');
    expect(sql).toContain('documents_delete_project');
    expect(sql).toContain('project_documents_delete_project');
    expect(sql).toContain('can_access_project(project_id)');
    expect(workflow).toContain("from('project_documents').delete()");
  });

  it('allows task deletion only inside the authenticated project', () => {
    const sql = read('supabase/migrations/20260819_authorized_task_deletion.sql');
    expect(sql).toContain('CREATE POLICY tasks_delete_project');
    expect(sql).toContain('can_access_project(project_id)');
  });
});
