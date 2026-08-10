import { OperationsService } from './operationsService';
import { supabaseClient } from './supabaseClient';
import { SyncService } from './syncService';

interface CalendarResult {
  mode: 'google' | 'simulado';
  action: 'upsert' | 'cancel';
  meetingId: string;
  eventUrl?: string;
  message?: string;
}

export const CalendarService = {
  sync: async (meetingId: string, action: 'upsert' | 'cancel' = 'upsert') => {
    if (!SyncService.isRemoteMode() || !supabaseClient) {
      const meeting = OperationsService.updateMeeting(meetingId, { calendarSync: 'simulado' });
      return { mode: 'simulado', action, meetingId, message: 'Calendar está simulado en modo local.', meeting };
    }

    await SyncService.flush();
    const { data: persistedMeeting, error: persistenceError } = await supabaseClient
      .from('project_meetings')
      .select('id')
      .eq('id', meetingId)
      .maybeSingle();
    if (persistenceError) throw new Error('No fue posible verificar el guardado de la reunión en Supabase.');
    if (!persistedMeeting) throw new Error('La reunión no pudo guardarse en Supabase. Revisa la conexión e inténtalo de nuevo.');

    const { data, error } = await supabaseClient.functions.invoke<CalendarResult>('sync-google-calendar', {
      body: { meetingId, action },
    });
    if (error) throw error;
    if (!data) throw new Error('Calendar no devolvió una respuesta válida.');

    const meeting = OperationsService.updateMeeting(meetingId, {
      calendarSync: data.mode === 'google' ? 'sincronizado' : 'simulado',
      calendarEventUrl: action === 'cancel' ? undefined : data.eventUrl,
    });
    return { ...data, meeting };
  },
};
