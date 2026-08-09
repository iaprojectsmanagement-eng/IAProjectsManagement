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

  it('limits AI requests without retaining prompt content', () => {
    const sql = read('supabase/migrations/20260810_ai_usage_limits.sql');
    const helper = read('supabase/functions/_shared/openai.ts');
    expect(sql).toContain("interval '1 minute'");
    expect(sql).toContain("interval '1 hour'");
    expect(sql).toContain('claim_ai_request');
    expect(sql).not.toContain('raw_text TEXT');
    expect(sql).not.toContain('prompt TEXT');
    expect(helper).toContain('store: false');
    expect(helper).toContain('gpt-5-nano');
  });

  it('binds every institutional template to its own generation function', () => {
    const functions = [
      ['generate-contexto-proyecto', 'contexto_proyecto', '00365211c7d1c5d0afb9b2d0cd34cedec7d14cf8941103cd551f83b7ec91e328'],
      ['generate-plan-actividades', 'plan_actividades', 'b1667448c4d61b2ff61fcc8d66e56d6483dcf3109e8cc6ebf8a028b1a2a65ab0'],
      ['generate-acta-reunion', 'acta_reunion', 'aa928f827dc30ff3bb11d0037cc38627c2e70a1a9c7ab5498215fa1d96fd9e3c'],
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
});
