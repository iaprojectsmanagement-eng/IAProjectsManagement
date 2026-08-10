import { OperationsService } from './operationsService';
import { supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

interface CalendarResult {
  mode: 'google' | 'simulado';
  action: 'upsert' | 'cancel';
  meetingId: string;
  eventUrl?: string;
  message?: string;
  error?: string;
  googleStatus?: number;
}

const delay = (milliseconds: number) => new Promise<void>((resolve) => setTimeout(resolve, milliseconds));

/**
 * A just-created meeting can reach Postgres a few milliseconds after the UI
 * creates it.  Calendar must only be called once the row is actually visible
 * to the Edge Function; otherwise the first click wrongly looks like a failed
 * synchronization and users have to retry manually.
 */
const waitForPersistedMeeting = async (meetingId: string) => {
  let flushError: unknown;
  try {
    await SyncService.flush();
  } catch (error) {
    // A later, non-critical queued audit/activity write must not prevent us
    // from checking whether the meeting itself was already persisted.
    flushError = error;
  }

  for (let attempt = 0; attempt < 7; attempt += 1) {
    const { data: persistedMeeting, error: persistenceError } = await supabaseClient!
      .from('project_meetings')
      .select('id')
      .eq('id', meetingId)
      .maybeSingle();

    if (persistenceError) throw new Error('No fue posible verificar el guardado de la reunión en Supabase.');
    if (persistedMeeting) return;
    if (attempt < 6) await delay(250 * (attempt + 1));
  }

  if (flushError instanceof Error) throw flushError;
  throw new Error('La reunión no pudo guardarse en Supabase. Revisa la conexión e inténtalo de nuevo.');
};

export const CalendarService = {
  sync: async (meetingId: string, action: 'upsert' | 'cancel' = 'upsert') => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      const meeting = OperationsService.updateMeeting(meetingId, { calendarSync: 'simulado' });
      return { mode: 'simulado', action, meetingId, message: 'Calendar está simulado en modo local.', meeting };
    }

    await waitForPersistedMeeting(meetingId);

    const { data, error } = await supabaseClient.functions.invoke<CalendarResult>('sync-google-calendar', {
      body: { meetingId, action },
    });
    if (error) {
      const response = error.context;
      const failure = response instanceof Response
        ? await response.json().catch(() => null) as Pick<CalendarResult, 'error'> | null
        : null;
      throw new Error(failure?.error || 'No fue posible sincronizar la reunión con Google Calendar.');
    }
    if (!data) throw new Error('Calendar no devolvió una respuesta válida.');

    const meeting = OperationsService.updateMeeting(meetingId, {
      calendarSync: data.mode === 'google' ? 'sincronizado' : 'simulado',
      calendarEventUrl: action === 'cancel' ? undefined : data.eventUrl,
    });
    return { ...data, meeting };
  },
};
